/**
 * Single Conversation Export API Route
 * GET /api/v1/export/conversations/[id] - Get conversation export info
 * POST /api/v1/export/conversations/[id] - Export single conversation in any format
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

interface SingleExportRequest {
  format: 'pdf' | 'docx' | 'html' | 'email'
  options?: {
    includeMetadata?: boolean
    includeSources?: boolean
    includeUserFeedback?: boolean
    includeComplianceAnalysis?: boolean
    includeCostBreakdown?: boolean
    language?: 'ar' | 'en'
    template?: 'default' | 'legal' | 'executive' | 'compliance' | 'custom'
    customTemplateId?: string
    watermark?: string
    organizationBranding?: boolean
    redactSensitive?: boolean
    emailRecipients?: string[]
    digitalSignature?: boolean
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    const organizationId = memberData.organization_id
    const conversationId = params.id

    // Validate conversation exists and user has access
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, 
        title, 
        user_id, 
        category, 
        language,
        created_at,
        updated_at,
        metadata
      `)
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if user can access this conversation
    const canAccess = conversation.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role)

    if (!canAccess) {
      await auditLogger.logSecurityEvent(
        'unauthorized_single_conversation_export',
        { 
          user_id: user.id, 
          organization_id: organizationId,
          conversation_id: conversationId,
          user_role: memberData.role
        },
        user.id,
        organizationId
      )
      return NextResponse.json({ error: 'Access denied to this conversation' }, { status: 403 })
    }

    // Parse request options
    const body: SingleExportRequest = await request.json()
    
    if (!['pdf', 'docx', 'html', 'email'].includes(body.format)) {
      return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
    }

    const exportOptions = {
      format: body.format,
      includeMetadata: body.options?.includeMetadata ?? true,
      includeSources: body.options?.includeSources ?? true,
      includeUserFeedback: body.options?.includeUserFeedback ?? true,
      includeComplianceAnalysis: body.options?.includeComplianceAnalysis ?? false,
      includeCostBreakdown: body.options?.includeCostBreakdown ?? false,
      language: body.options?.language ?? (conversation.language as 'ar' | 'en') ?? 'ar',
      template: body.options?.template ?? 'default',
      customTemplateId: body.options?.customTemplateId,
      watermark: body.options?.watermark,
      organizationBranding: body.options?.organizationBranding ?? true,
      redactSensitive: body.options?.redactSensitive ?? false,
      emailRecipients: body.options?.emailRecipients || [],
      digitalSignature: body.options?.digitalSignature ?? false
    }

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    let result
    if (body.format === 'email') {
      // Handle email export
      result = await exportService.exportViaEmail(
        [conversationId],
        exportOptions,
        organizationId
      )
    } else {
      // Handle direct file export
      result = await exportService.exportSingleConversation(
        conversationId,
        exportOptions,
        organizationId
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      )
    }

    // Log successful export
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      `export_conversation_${body.format}`,
      'conversation',
      conversationId,
      {
        conversation_title: conversation.title,
        export_options: exportOptions,
        format: body.format,
        template: exportOptions.template
      }
    )

    // Return appropriate response based on format
    if (body.format === 'email') {
      return NextResponse.json({
        success: true,
        message: 'Conversation exported and sent via email',
        recipients: exportOptions.emailRecipients,
        conversationTitle: conversation.title,
        exportedAt: new Date().toISOString()
      })
    } else if (body.format === 'html') {
      // For HTML, return the content directly
      return NextResponse.json({
        success: true,
        downloadUrl: result.downloadUrl,
        htmlContent: result.htmlContent, // Direct HTML content for preview
        conversationTitle: conversation.title,
        exportedAt: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: true,
        downloadUrl: result.downloadUrl,
        filename: result.filename,
        conversationTitle: conversation.title,
        exportedAt: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Single conversation export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    const conversationId = params.id
    const organizationId = memberData.organization_id

    // Get conversation info with message counts
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, 
        title, 
        category, 
        language, 
        created_at, 
        updated_at, 
        user_id,
        metadata,
        users!conversations_user_id_fkey(full_name, email)
      `)
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check access permissions
    const canAccess = conversation.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied to this conversation' }, { status: 403 })
    }

    // Get message statistics
    const { data: messageStats } = await supabase
      .rpc('get_conversation_message_stats', { conv_id: conversationId })

    // Get compliance analysis if available
    const { data: complianceData } = await supabase
      .from('conversation_compliance_analysis')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('organization_id', organizationId)
      .single()

    // Get cost analysis
    const { data: costData } = await supabase
      .from('conversation_cost_tracking')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('organization_id', organizationId)
      .single()

    // Get available custom templates
    const { data: customTemplates } = await supabase
      .from('export_templates')
      .select('id, name, description, template_type')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        category: conversation.category,
        language: conversation.language,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        user: conversation.users,
        message_count: messageStats?.message_count || 0,
        user_messages: messageStats?.user_messages || 0,
        assistant_messages: messageStats?.assistant_messages || 0,
        total_tokens: messageStats?.total_tokens || 0,
        avg_response_time: messageStats?.avg_response_time || 0,
        sources_count: messageStats?.sources_count || 0
      },
      analytics: {
        compliance: complianceData ? {
          overall_score: complianceData.overall_score,
          policy_compliance: complianceData.policy_compliance,
          legal_compliance: complianceData.legal_compliance,
          risk_level: complianceData.risk_level,
          recommendations: complianceData.recommendations
        } : null,
        cost: costData ? {
          total_cost: costData.total_cost,
          input_tokens: costData.input_tokens,
          output_tokens: costData.output_tokens,
          model_costs: costData.model_costs
        } : null
      },
      exportOptions: {
        availableFormats: ['pdf', 'docx', 'html', 'email'],
        availableLanguages: ['ar', 'en'],
        availableTemplates: [
          { id: 'default', name: 'Default', description: 'Standard conversation export' },
          { id: 'legal', name: 'Legal Document', description: 'Legal format with compliance details' },
          { id: 'executive', name: 'Executive Summary', description: 'High-level summary format' },
          { id: 'compliance', name: 'Compliance Report', description: 'Detailed compliance analysis' },
          ...(customTemplates || [])
        ],
        features: {
          watermarks: true,
          digitalSignatures: ['owner', 'admin', 'hr_manager'].includes(memberData.role),
          sensitiveDataRedaction: true,
          organizationBranding: true,
          emailExport: true,
          complianceAnalysis: !!complianceData,
          costBreakdown: !!costData
        }
      }
    })

  } catch (error) {
    console.error('Get conversation export info error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}