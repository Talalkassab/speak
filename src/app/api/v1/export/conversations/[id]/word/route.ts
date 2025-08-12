/**
 * Export Single Conversation as Word Document API Route
 * POST /api/v1/export/conversations/[id]/word
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'

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
      .select('id, title, user_id')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if user can access this conversation (owner or admin roles)
    const canAccess = conversation.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager'].includes(memberData.role)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied to this conversation' }, { status: 403 })
    }

    // Parse request options
    const body = await request.json()
    const exportOptions = {
      format: 'docx' as const,
      includeMetadata: body.includeMetadata ?? true,
      includeSources: body.includeSources ?? true,
      includeUserFeedback: body.includeUserFeedback ?? true,
      language: body.language ?? 'ar',
      template: body.template ?? 'default',
      watermark: body.watermark,
      organizationBranding: body.organizationBranding ?? true
    }

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    // Export conversation
    const result = await exportService.exportSingleConversation(
      conversationId,
      exportOptions,
      organizationId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      )
    }

    // Log successful export
    await supabase
      .from('user_activity_logs')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        action: 'export_conversation_word',
        resource_type: 'conversation',
        resource_id: conversationId,
        details: {
          conversation_title: conversation.title,
          export_options: exportOptions
        }
      })

    return NextResponse.json({
      success: true,
      downloadUrl: result.downloadUrl,
      conversationTitle: conversation.title,
      exportedAt: new Date().toISOString(),
      format: 'docx'
    })

  } catch (error) {
    console.error('Export conversation Word error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}