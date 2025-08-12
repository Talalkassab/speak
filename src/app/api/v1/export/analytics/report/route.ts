/**
 * Export Analytics Report API Route
 * GET /api/v1/export/analytics/report
 * POST /api/v1/export/analytics/report (generate report)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'

// GET analytics data
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and check admin permissions
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    // Check permissions (analytics requires admin level access)
    if (!['owner', 'admin'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions for analytics' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const organizationId = memberData.organization_id

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    // Get export analytics
    const analyticsResult = await exportService.getExportAnalytics(
      organizationId,
      dateFrom || undefined,
      dateTo || undefined
    )

    if (!analyticsResult.success) {
      return NextResponse.json(
        { error: analyticsResult.error || 'Failed to get analytics' },
        { status: 500 }
      )
    }

    // Get additional organization metrics
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, created_at, subscription_tier')
      .eq('id', organizationId)
      .single()

    // Get total conversations and messages
    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get active users count
    const { count: activeUsers } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    // Get export trends by month
    const { data: exportTrends, error: trendsError } = await supabase
      .from('user_activity_logs')
      .select('created_at, action, details')
      .eq('organization_id', organizationId)
      .in('action', ['export_single', 'export_bulk'])
      .order('created_at', { ascending: true })

    if (trendsError) {
      console.error('Export trends error:', trendsError)
    }

    // Process trends data
    const monthlyTrends = exportTrends?.reduce((acc, log) => {
      const month = new Date(log.created_at).toISOString().substring(0, 7) // YYYY-MM format
      if (!acc[month]) {
        acc[month] = { month, pdf: 0, docx: 0, single: 0, bulk: 0, total: 0 }
      }
      
      const format = (log.details as any)?.format
      if (format) acc[month][format]++
      
      const type = log.action === 'export_single' ? 'single' : 'bulk'
      acc[month][type]++
      acc[month].total++
      
      return acc
    }, {} as Record<string, any>) || {}

    const trendsArray = Object.values(monthlyTrends).sort((a: any, b: any) => a.month.localeCompare(b.month))

    return NextResponse.json({
      success: true,
      analytics: analyticsResult.analytics,
      organization: {
        name: orgData?.name,
        created_at: orgData?.created_at,
        subscription_tier: orgData?.subscription_tier,
        total_conversations: totalConversations || 0,
        total_messages: totalMessages || 0,
        active_users: activeUsers || 0
      },
      trends: trendsArray,
      period: {
        from: dateFrom || 'inception',
        to: dateTo || 'now'
      },
      generated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get analytics report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Generate and export analytics report
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and check admin permissions
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    // Check permissions
    if (!['owner', 'admin'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions for analytics export' }, { status: 403 })
    }

    const organizationId = memberData.organization_id
    const body = await request.json()
    
    const {
      format = 'pdf',
      dateFrom,
      dateTo,
      includeCharts = true,
      includeDetailedBreakdown = true,
      language = 'ar',
      template = 'executive'
    } = body

    // Validate format
    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Must be pdf or docx' }, { status: 400 })
    }

    // Get analytics data for report generation
    const exportService = new ExportService(supabase)
    const analyticsResult = await exportService.getExportAnalytics(
      organizationId,
      dateFrom,
      dateTo
    )

    if (!analyticsResult.success) {
      return NextResponse.json(
        { error: analyticsResult.error || 'Failed to get analytics' },
        { status: 500 }
      )
    }

    // Get organization info
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, created_at, subscription_tier')
      .eq('id', organizationId)
      .single()

    // Prepare report data structure
    const reportData = {
      id: `analytics-${Date.now()}`,
      title: language === 'ar' ? 'تقرير تحليلات التصدير' : 'Export Analytics Report',
      category: 'analytics',
      language: language,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization_id: organizationId,
      user: {
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Admin User',
        email: user.email
      },
      messages: [
        {
          id: `msg-summary-${Date.now()}`,
          role: 'system' as const,
          content: generateAnalyticsReportContent(
            analyticsResult.analytics,
            orgData,
            { dateFrom, dateTo, includeCharts, includeDetailedBreakdown },
            language === 'ar'
          ),
          content_type: 'markdown',
          language: language,
          tokens_used: null,
          model_used: null,
          response_time_ms: null,
          confidence_score: null,
          user_rating: null,
          user_feedback: null,
          created_at: new Date().toISOString(),
          sources: []
        }
      ],
      metadata: {
        report_type: 'analytics',
        period: { from: dateFrom, to: dateTo },
        analytics: analyticsResult.analytics,
        organization: orgData
      }
    }

    // Generate export options
    const exportOptions = {
      format: format as 'pdf' | 'docx',
      includeMetadata: true,
      includeSources: false,
      includeUserFeedback: false,
      language: language as 'ar' | 'en',
      template: template as 'default' | 'legal' | 'executive',
      organizationBranding: true,
      watermark: language === 'ar' ? 'تقرير سري' : 'Confidential Report'
    }

    // Generate the report
    const result = await exportService.exportSingleConversation(
      reportData.id,
      exportOptions,
      organizationId
    )

    // For analytics report, we bypass the normal conversation lookup
    // and directly generate from our prepared data
    let exportResult: { buffer: Buffer; filename: string; mimeType: string }
    
    if (format === 'pdf') {
      const { PDFGenerator } = await import('@/libs/export/pdf-generator')
      const pdfGenerator = new PDFGenerator()
      exportResult = await pdfGenerator.generateConversationPDF(reportData as any, exportOptions)
    } else {
      const { DocxGenerator } = await import('@/libs/export/docx-generator')
      const docxGenerator = new DocxGenerator()
      exportResult = await docxGenerator.generateConversationDocx(reportData as any, exportOptions)
    }

    // Upload to storage
    const path = `exports/${organizationId}/analytics-${Date.now()}-${exportResult.filename}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exports')
      .upload(path, exportResult.buffer, {
        contentType: exportResult.mimeType,
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('exports')
      .getPublicUrl(path)

    // Log analytics report export
    await supabase
      .from('user_activity_logs')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        action: 'export_analytics_report',
        resource_type: 'analytics',
        details: {
          format,
          period: { from: dateFrom, to: dateTo },
          analytics_summary: analyticsResult.analytics
        }
      })

    return NextResponse.json({
      success: true,
      downloadUrl: urlData.publicUrl,
      format,
      reportTitle: reportData.title,
      analytics: analyticsResult.analytics,
      exportedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Generate analytics report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to generate analytics report content
function generateAnalyticsReportContent(
  analytics: any,
  orgData: any,
  options: any,
  isArabic: boolean
): string {
  const { dateFrom, dateTo, includeCharts, includeDetailedBreakdown } = options

  if (isArabic) {
    return `# تقرير تحليلات التصدير

## معلومات المؤسسة
- **اسم المؤسسة:** ${orgData?.name || 'غير محدد'}
- **نوع الاشتراك:** ${orgData?.subscription_tier || 'أساسي'}
- **تاريخ الإنشاء:** ${orgData?.created_at ? new Date(orgData.created_at).toLocaleDateString('ar-SA') : 'غير محدد'}

## فترة التقرير
- **من:** ${dateFrom ? new Date(dateFrom).toLocaleDateString('ar-SA') : 'البداية'}
- **إلى:** ${dateTo ? new Date(dateTo).toLocaleDateString('ar-SA') : 'الآن'}

## ملخص الإحصائيات

### إجمالي عمليات التصدير
- **العدد الإجمالي:** ${analytics.totalExports}
- **تصدير PDF:** ${analytics.pdfExports}
- **تصدير Word:** ${analytics.docxExports}

### أنواع التصدير
- **تصدير فردي:** ${analytics.singleExports}
- **تصدير مجمع:** ${analytics.bulkExports}

### المحادثات المُصدرة
- **إجمالي المحادثات:** ${analytics.totalConversationsExported}

${includeDetailedBreakdown ? `
## التفاصيل المتقدمة

### معدل استخدام التصدير
- **معدل التصدير الفردي:** ${((analytics.singleExports / analytics.totalExports) * 100).toFixed(1)}%
- **معدل التصدير المجمع:** ${((analytics.bulkExports / analytics.totalExports) * 100).toFixed(1)}%

### تفضيلات التنسيق
- **تفضيل PDF:** ${((analytics.pdfExports / analytics.totalExports) * 100).toFixed(1)}%
- **تفضيل Word:** ${((analytics.docxExports / analytics.totalExports) * 100).toFixed(1)}%

### الأداء
- **متوسط المحادثات لكل عملية تصدير:** ${(analytics.totalConversationsExported / Math.max(1, analytics.totalExports)).toFixed(1)}
` : ''}

---
*تم إنشاء هذا التقرير تلقائياً في ${new Date().toLocaleDateString('ar-SA')}*`
  } else {
    return `# Export Analytics Report

## Organization Information
- **Organization Name:** ${orgData?.name || 'Not specified'}
- **Subscription Tier:** ${orgData?.subscription_tier || 'Basic'}
- **Created:** ${orgData?.created_at ? new Date(orgData.created_at).toLocaleDateString() : 'Not specified'}

## Report Period
- **From:** ${dateFrom ? new Date(dateFrom).toLocaleDateString() : 'Inception'}
- **To:** ${dateTo ? new Date(dateTo).toLocaleDateString() : 'Now'}

## Statistics Summary

### Total Exports
- **Total Count:** ${analytics.totalExports}
- **PDF Exports:** ${analytics.pdfExports}
- **Word Exports:** ${analytics.docxExports}

### Export Types
- **Single Exports:** ${analytics.singleExports}
- **Bulk Exports:** ${analytics.bulkExports}

### Conversations Exported
- **Total Conversations:** ${analytics.totalConversationsExported}

${includeDetailedBreakdown ? `
## Detailed Analysis

### Export Usage Patterns
- **Single Export Rate:** ${((analytics.singleExports / analytics.totalExports) * 100).toFixed(1)}%
- **Bulk Export Rate:** ${((analytics.bulkExports / analytics.totalExports) * 100).toFixed(1)}%

### Format Preferences
- **PDF Preference:** ${((analytics.pdfExports / analytics.totalExports) * 100).toFixed(1)}%
- **Word Preference:** ${((analytics.docxExports / analytics.totalExports) * 100).toFixed(1)}%

### Performance Metrics
- **Average Conversations per Export:** ${(analytics.totalConversationsExported / Math.max(1, analytics.totalExports)).toFixed(1)}
` : ''}

---
*This report was automatically generated on ${new Date().toLocaleDateString()}*`
  }
}