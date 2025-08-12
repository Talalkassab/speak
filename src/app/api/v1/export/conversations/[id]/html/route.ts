/**
 * HTML Export API Route for Single Conversation
 * GET /api/v1/export/conversations/[id]/html - Export conversation as HTML with search functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

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
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const language = searchParams.get('language') as 'ar' | 'en' || 'ar'
    const template = searchParams.get('template') || 'default'
    const includeSearch = searchParams.get('includeSearch') === 'true'
    const includeMetadata = searchParams.get('includeMetadata') !== 'false'
    const includeSources = searchParams.get('includeSources') !== 'false'
    const includeUserFeedback = searchParams.get('includeUserFeedback') !== 'false'
    const watermark = searchParams.get('watermark')
    const download = searchParams.get('download') === 'true'

    // Validate conversation access
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, user_id, category, language')
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

    // Create export options
    const exportOptions = {
      format: 'html' as const,
      includeMetadata,
      includeSources,
      includeUserFeedback,
      includeSearch,
      language,
      template,
      watermark,
      organizationBranding: true
    }

    // Initialize export service and generate HTML
    const exportService = new ExportService(supabase)
    const result = await exportService.exportSingleConversation(
      conversationId,
      exportOptions,
      organizationId
    )

    if (!result.success || !result.htmlContent) {
      return NextResponse.json(
        { error: result.error || 'HTML export failed' },
        { status: 500 }
      )
    }

    // Log export activity
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'export_conversation_html',
      'conversation',
      conversationId,
      {
        conversation_title: conversation.title,
        include_search: includeSearch,
        template,
        language
      }
    )

    // Return HTML content or download response
    if (download) {
      const filename = `conversation-${conversation.title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '')}-${new Date().toISOString().split('T')[0]}.html`
      
      return new NextResponse(result.htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      // Return for preview or embedding
      return new NextResponse(result.htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      })
    }

  } catch (error) {
    console.error('HTML export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const conversationId = params.id
    const organizationId = memberData.organization_id

    // Validate conversation access
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, user_id')
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

    // Parse request body for custom HTML export options
    const body = await request.json()
    
    const exportOptions = {
      format: 'html' as const,
      includeMetadata: body.includeMetadata ?? true,
      includeSources: body.includeSources ?? true,
      includeUserFeedback: body.includeUserFeedback ?? true,
      includeSearch: body.includeSearch ?? true,
      includeTableOfContents: body.includeTableOfContents ?? true,
      language: body.language ?? 'ar',
      template: body.template ?? 'default',
      watermark: body.watermark,
      organizationBranding: body.organizationBranding ?? true,
      customCSS: body.customCSS,
      theme: body.theme || 'light', // light, dark, auto
      interactiveFeatures: body.interactiveFeatures ?? true
    }

    // Initialize export service and generate enhanced HTML
    const exportService = new ExportService(supabase)
    const result = await exportService.exportSingleConversation(
      conversationId,
      exportOptions,
      organizationId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'HTML export failed' },
        { status: 500 }
      )
    }

    // Log export activity
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'export_conversation_html_custom',
      'conversation',
      conversationId,
      {
        conversation_title: conversation.title,
        options: exportOptions
      }
    )

    return NextResponse.json({
      success: true,
      downloadUrl: result.downloadUrl,
      htmlContent: result.htmlContent,
      filename: result.filename,
      conversationTitle: conversation.title,
      exportedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Custom HTML export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}