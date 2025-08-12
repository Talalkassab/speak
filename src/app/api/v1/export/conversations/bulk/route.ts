/**
 * Bulk Export Conversations API Route
 * POST /api/v1/export/conversations/bulk
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and role
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    // Check permissions for bulk export (requires admin or hr_manager role)
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions for bulk export' }, { status: 403 })
    }

    const organizationId = memberData.organization_id

    // Parse request body
    const body = await request.json()
    const {
      conversationIds,
      format = 'pdf',
      dateFrom,
      dateTo,
      category,
      userId,
      maxConversations = 100,
      includeMetadata = true,
      includeSources = true,
      includeUserFeedback = true,
      language = 'ar',
      template = 'default',
      watermark,
      organizationBranding = true
    } = body

    // Validate format
    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Must be pdf or docx' }, { status: 400 })
    }

    // Validate conversation limit
    if (maxConversations > 500) {
      return NextResponse.json({ error: 'Maximum conversations limit is 500' }, { status: 400 })
    }

    let finalConversationIds = conversationIds || []

    // If no specific conversation IDs provided, build query based on filters
    if (!conversationIds || conversationIds.length === 0) {
      let query = supabase
        .from('conversations')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(maxConversations)
        .order('created_at', { ascending: false })

      // Apply filters
      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }
      if (category) {
        query = query.eq('category', category)
      }
      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: conversations, error: queryError } = await query

      if (queryError) {
        return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
      }

      finalConversationIds = conversations.map(conv => conv.id)
    }

    // Validate that conversations exist and user has access
    if (finalConversationIds.length === 0) {
      return NextResponse.json({ error: 'No conversations found matching criteria' }, { status: 400 })
    }

    if (finalConversationIds.length > maxConversations) {
      return NextResponse.json({ 
        error: `Too many conversations selected. Maximum is ${maxConversations}` 
      }, { status: 400 })
    }

    // Verify conversations belong to organization
    const { data: conversationCheck, error: checkError } = await supabase
      .from('conversations')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', finalConversationIds)

    if (checkError) {
      return NextResponse.json({ error: 'Failed to validate conversations' }, { status: 500 })
    }

    const validConversationIds = conversationCheck.map(conv => conv.id)
    if (validConversationIds.length !== finalConversationIds.length) {
      return NextResponse.json({ error: 'Some conversations not found or access denied' }, { status: 403 })
    }

    // Prepare bulk export options
    const bulkExportOptions = {
      conversationIds: validConversationIds,
      format: format as 'pdf' | 'docx',
      dateFrom,
      dateTo,
      category,
      userId,
      maxConversations,
      includeMetadata,
      includeSources,
      includeUserFeedback,
      language: language as 'ar' | 'en',
      template,
      watermark,
      organizationBranding
    }

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    // Start bulk export (creates background job)
    const result = await exportService.exportBulkConversations(
      bulkExportOptions,
      organizationId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Bulk export failed' },
        { status: 500 }
      )
    }

    // Log bulk export initiation
    await supabase
      .from('user_activity_logs')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        action: 'export_conversations_bulk_start',
        resource_type: 'conversation',
        details: {
          job_id: result.jobId,
          conversation_count: validConversationIds.length,
          format,
          export_options: bulkExportOptions
        }
      })

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      conversationCount: validConversationIds.length,
      format,
      estimatedCompletionTime: this.calculateEstimatedTime(validConversationIds.length),
      statusUrl: `/api/v1/export/jobs/${result.jobId}/status`
    })

  } catch (error) {
    console.error('Bulk export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET method to retrieve available conversations for export
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

    // Check permissions
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const category = searchParams.get('category')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const offset = (page - 1) * limit

    // Build conversations query
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
        users!conversations_user_id_fkey(full_name)
      `, { count: 'exact' })
      .eq('organization_id', memberData.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (category) query = query.eq('category', category)
    if (userId) query = query.eq('user_id', userId)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)

    const { data: conversations, error: convError, count } = await query

    if (convError) {
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const { count: messageCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)

        return {
          ...conv,
          message_count: messageCount || 0
        }
      })
    )

    // Get available categories and users for filtering
    const { data: categories } = await supabase
      .from('conversations')
      .select('category')
      .eq('organization_id', memberData.organization_id)
      .not('category', 'is', null)

    const { data: users } = await supabase
      .from('conversations')
      .select('user_id, users!conversations_user_id_fkey(id, full_name)')
      .eq('organization_id', memberData.organization_id)

    const uniqueCategories = [...new Set(categories?.map(c => c.category).filter(Boolean))]
    const uniqueUsers = users?.reduce((acc, u) => {
      const userData = u.users as any
      if (userData && !acc.find(existing => existing.id === userData.id)) {
        acc.push(userData)
      }
      return acc
    }, [] as any[]) || []

    return NextResponse.json({
      success: true,
      conversations: conversationsWithCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      },
      filters: {
        categories: uniqueCategories,
        users: uniqueUsers
      },
      exportOptions: {
        availableFormats: ['pdf', 'docx'],
        availableLanguages: ['ar', 'en'],
        availableTemplates: ['default', 'legal', 'executive'],
        maxConversations: 500
      }
    })

  } catch (error) {
    console.error('Get conversations for bulk export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate estimated completion time
function calculateEstimatedTime(conversationCount: number): string {
  // Rough estimate: 2 seconds per conversation for processing
  const estimatedSeconds = conversationCount * 2
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60)
  
  if (estimatedMinutes < 1) return 'Less than 1 minute'
  if (estimatedMinutes === 1) return '1 minute'
  if (estimatedMinutes < 60) return `${estimatedMinutes} minutes`
  
  const hours = Math.floor(estimatedMinutes / 60)
  const remainingMinutes = estimatedMinutes % 60
  
  if (hours === 1 && remainingMinutes === 0) return '1 hour'
  if (remainingMinutes === 0) return `${hours} hours`
  
  return `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
}