/**
 * Export Conversations API Route
 * POST /api/v1/export/conversations - Export conversations with various options
 * GET /api/v1/export/conversations - Get export options and user's conversations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

interface ExportConversationsRequest {
  conversationIds: string[]
  format: 'pdf' | 'docx' | 'html' | 'email'
  options: {
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
    compressionFormat?: 'zip' | 'none'
    digitalSignature?: boolean
  }
  filters?: {
    dateFrom?: string
    dateTo?: string
    category?: string
    userId?: string
    complianceScore?: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      await auditLogger.logSecurityEvent(
        'unauthorized_export_attempt',
        { ip: request.headers.get('x-forwarded-for') || 'unknown' },
        null,
        null
      )
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

    // Parse request body
    const body: ExportConversationsRequest = await request.json()
    
    // Validate request
    if (!body.conversationIds || body.conversationIds.length === 0) {
      return NextResponse.json({ error: 'No conversations selected for export' }, { status: 400 })
    }

    if (!['pdf', 'docx', 'html', 'email'].includes(body.format)) {
      return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
    }

    // Check export limits based on user role
    const maxConversations = getExportLimits(memberData.role)
    if (body.conversationIds.length > maxConversations) {
      return NextResponse.json({ 
        error: `Export limit exceeded. Maximum ${maxConversations} conversations allowed for ${memberData.role} role` 
      }, { status: 400 })
    }

    // Validate conversation access
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, user_id, category')
      .in('id', body.conversationIds)
      .eq('organization_id', organizationId)

    if (convError) {
      return NextResponse.json({ error: 'Failed to validate conversations' }, { status: 500 })
    }

    if (conversations.length !== body.conversationIds.length) {
      return NextResponse.json({ error: 'Some conversations not found or access denied' }, { status: 404 })
    }

    // Check individual conversation access
    const canAccessAll = conversations.every(conv => 
      conv.user_id === user.id || 
      ['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role)
    )

    if (!canAccessAll) {
      await auditLogger.logSecurityEvent(
        'unauthorized_conversation_export_attempt',
        { 
          user_id: user.id, 
          organization_id: organizationId,
          conversation_ids: body.conversationIds,
          user_role: memberData.role
        },
        user.id,
        organizationId
      )
      return NextResponse.json({ error: 'Access denied to some conversations' }, { status: 403 })
    }

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    // Create export options
    const exportOptions = {
      format: body.format,
      includeMetadata: body.options?.includeMetadata ?? true,
      includeSources: body.options?.includeSources ?? true,
      includeUserFeedback: body.options?.includeUserFeedback ?? true,
      includeComplianceAnalysis: body.options?.includeComplianceAnalysis ?? false,
      includeCostBreakdown: body.options?.includeCostBreakdown ?? false,
      language: body.options?.language ?? 'ar',
      template: body.options?.template ?? 'default',
      customTemplateId: body.options?.customTemplateId,
      watermark: body.options?.watermark,
      organizationBranding: body.options?.organizationBranding ?? true,
      redactSensitive: body.options?.redactSensitive ?? false,
      emailRecipients: body.options?.emailRecipients || [],
      compressionFormat: body.options?.compressionFormat ?? 'none',
      digitalSignature: body.options?.digitalSignature ?? false,
      conversationIds: body.conversationIds,
      dateFrom: body.filters?.dateFrom,
      dateTo: body.filters?.dateTo,
      category: body.filters?.category,
      userId: body.filters?.userId,
      complianceScore: body.filters?.complianceScore
    }

    let result
    
    // Handle different export types
    if (body.conversationIds.length === 1 && body.format !== 'email') {
      // Single conversation export
      result = await exportService.exportSingleConversation(
        body.conversationIds[0],
        exportOptions,
        organizationId
      )
    } else {
      // Bulk export or email export
      result = await exportService.exportBulkConversations(
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
      `export_conversations_${body.format}`,
      'conversation',
      {
        conversation_count: body.conversationIds.length,
        conversation_ids: body.conversationIds,
        format: body.format,
        template: body.options?.template,
        options: exportOptions
      }
    )

    // Return appropriate response
    if (body.format === 'email') {
      return NextResponse.json({
        success: true,
        message: 'Export sent via email successfully',
        recipients: body.options?.emailRecipients,
        exportedAt: new Date().toISOString()
      })
    } else if (result.jobId) {
      // Background job started
      return NextResponse.json({
        success: true,
        jobId: result.jobId,
        message: 'Export job started. Use the job ID to check status.',
        estimatedCompletion: calculateEstimatedCompletion(body.conversationIds.length, body.format)
      })
    } else {
      // Direct download
      return NextResponse.json({
        success: true,
        downloadUrl: result.downloadUrl,
        filename: result.filename,
        exportedAt: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Export conversations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    
    // Get pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const searchQuery = searchParams.get('search')

    // Build query for conversations
    let query = supabase
      .from('conversations')
      .select(`
        id,
        title,
        category,
        language,
        created_at,
        updated_at,
        user_id,
        users!conversations_user_id_fkey(full_name, email)
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (category) query = query.eq('category', category)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)
    if (searchQuery) query = query.ilike('title', `%${searchQuery}%`)

    // Filter by user access if not admin/manager
    if (!['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role)) {
      query = query.eq('user_id', user.id)
    }

    const { data: conversations, error: convError, count } = await query

    if (convError) {
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Get export templates
    const { data: templates } = await supabase
      .from('export_templates')
      .select('id, name, description, template_type, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')

    // Get export analytics
    const exportService = new ExportService(supabase)
    const analyticsResult = await exportService.getExportAnalytics(
      organizationId, 
      dateFrom || undefined, 
      dateTo || undefined
    )

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      },
      exportOptions: {
        availableFormats: ['pdf', 'docx', 'html', 'email'],
        availableLanguages: ['ar', 'en'],
        availableTemplates: [
          { id: 'default', name: 'Default', description: 'Standard export template' },
          { id: 'legal', name: 'Legal', description: 'Legal document format with enhanced compliance details' },
          { id: 'executive', name: 'Executive', description: 'Executive summary format' },
          { id: 'compliance', name: 'Compliance', description: 'Compliance-focused template with detailed analysis' },
          ...(templates || []).map(t => ({ id: t.id, name: t.name, description: t.description }))
        ],
        exportLimits: {
          maxConversations: getExportLimits(memberData.role),
          role: memberData.role
        },
        features: {
          watermarks: true,
          digitalSignatures: ['owner', 'admin', 'hr_manager'].includes(memberData.role),
          customTemplates: true,
          scheduledExports: ['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role),
          bulkOperations: true,
          emailExport: true,
          compressionFormats: ['zip', 'none']
        }
      },
      analytics: analyticsResult.success ? analyticsResult.analytics : null
    })

  } catch (error) {
    console.error('Get export options error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get export limits based on user role
 */
function getExportLimits(role: string): number {
  const limits: Record<string, number> = {
    owner: 1000,
    admin: 500,
    hr_manager: 200,
    hr_analyst: 100,
    hr_specialist: 50,
    employee: 10
  }
  
  return limits[role] || 5
}

/**
 * Calculate estimated completion time
 */
function calculateEstimatedCompletion(conversationCount: number, format: string): string {
  // Base processing time per conversation in seconds
  const baseTime = format === 'pdf' ? 3 : format === 'docx' ? 2 : 1
  const estimatedSeconds = conversationCount * baseTime + 10 // +10 for overhead
  
  const completionTime = new Date()
  completionTime.setSeconds(completionTime.getSeconds() + estimatedSeconds)
  
  return completionTime.toISOString()
}