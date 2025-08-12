/**
 * Scheduled Exports API Route
 * POST /api/v1/export/scheduled - Create scheduled export
 * GET /api/v1/export/scheduled - List scheduled exports
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

interface ScheduledExportRequest {
  name: string
  description?: string
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    dayOfWeek?: number // 0-6 for weekly
    dayOfMonth?: number // 1-31 for monthly
    hour: number // 0-23
    timezone: string
  }
  filters: {
    dateRange: 'last_week' | 'last_month' | 'last_quarter' | 'custom'
    customDateFrom?: string
    customDateTo?: string
    categories?: string[]
    userIds?: string[]
    complianceScoreMin?: number
  }
  export: {
    format: 'pdf' | 'docx' | 'html'
    template: string
    language: 'ar' | 'en'
    includeMetadata: boolean
    includeSources: boolean
    includeUserFeedback: boolean
    includeComplianceAnalysis: boolean
    includeCostBreakdown: boolean
    organizationBranding: boolean
    watermark?: string
  }
  delivery: {
    method: 'email' | 'storage' | 'both'
    emailRecipients?: string[]
    storageLocation?: string
    notifyOnCompletion: boolean
    notifyOnFailure: boolean
  }
  isActive: boolean
}

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

    // Check if user has permission to create scheduled exports
    if (!['owner', 'admin', 'hr_manager', 'hr_analyst'].includes(memberData.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to create scheduled exports' 
      }, { status: 403 })
    }

    const organizationId = memberData.organization_id
    const body: ScheduledExportRequest = await request.json()

    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Export name is required' }, { status: 400 })
    }

    if (!['daily', 'weekly', 'monthly', 'quarterly'].includes(body.schedule.type)) {
      return NextResponse.json({ error: 'Invalid schedule type' }, { status: 400 })
    }

    if (body.schedule.hour < 0 || body.schedule.hour > 23) {
      return NextResponse.json({ error: 'Invalid hour (must be 0-23)' }, { status: 400 })
    }

    if (!['pdf', 'docx', 'html'].includes(body.export.format)) {
      return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
    }

    // Check organization limits for scheduled exports
    const { count: existingCount } = await supabase
      .from('scheduled_exports')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    const maxScheduledExports = getScheduledExportLimit(memberData.role)
    if ((existingCount || 0) >= maxScheduledExports) {
      return NextResponse.json({ 
        error: `Maximum ${maxScheduledExports} scheduled exports allowed for ${memberData.role} role` 
      }, { status: 400 })
    }

    // Calculate next execution time
    const nextExecution = calculateNextExecution(body.schedule)

    // Create scheduled export
    const { data: scheduledExport, error: createError } = await supabase
      .from('scheduled_exports')
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        name: body.name.trim(),
        description: body.description?.trim(),
        schedule_config: body.schedule,
        filter_config: body.filters,
        export_config: body.export,
        delivery_config: body.delivery,
        is_active: body.isActive,
        next_execution: nextExecution.toISOString()
      })
      .select()
      .single()

    if (createError) {
      console.error('Create scheduled export error:', createError)
      return NextResponse.json({ error: 'Failed to create scheduled export' }, { status: 500 })
    }

    // Log creation
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'create_scheduled_export',
      'scheduled_export',
      scheduledExport.id,
      {
        name: body.name,
        schedule_type: body.schedule.type,
        export_format: body.export.format,
        is_active: body.isActive
      }
    )

    return NextResponse.json({
      success: true,
      scheduledExport: {
        id: scheduledExport.id,
        name: scheduledExport.name,
        description: scheduledExport.description,
        schedule: scheduledExport.schedule_config,
        filters: scheduledExport.filter_config,
        export: scheduledExport.export_config,
        delivery: scheduledExport.delivery_config,
        isActive: scheduledExport.is_active,
        nextExecution: scheduledExport.next_execution,
        createdAt: scheduledExport.created_at
      }
    })

  } catch (error) {
    console.error('Create scheduled export error:', error)
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
    
    // Get query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const isActive = searchParams.get('active')
    const scheduleType = searchParams.get('scheduleType')

    // Build query
    let query = supabase
      .from('scheduled_exports')
      .select(`
        *,
        users!scheduled_exports_created_by_fkey(full_name, email),
        recent_executions:scheduled_export_executions!scheduled_export_id(
          id,
          status,
          started_at,
          completed_at,
          error_message,
          download_url
        )
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }
    if (scheduleType) {
      query = query.eq('schedule_config->>type', scheduleType)
    }

    // Filter by user access if not admin/manager
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      query = query.eq('created_by', user.id)
    }

    const { data: scheduledExports, error: fetchError, count } = await query

    if (fetchError) {
      console.error('Fetch scheduled exports error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch scheduled exports' }, { status: 500 })
    }

    // Get execution statistics
    const { data: execStats } = await supabase
      .rpc('get_scheduled_export_stats', { org_id: organizationId })

    return NextResponse.json({
      success: true,
      scheduledExports: (scheduledExports || []).map(se => ({
        id: se.id,
        name: se.name,
        description: se.description,
        schedule: se.schedule_config,
        filters: se.filter_config,
        export: se.export_config,
        delivery: se.delivery_config,
        isActive: se.is_active,
        nextExecution: se.next_execution,
        lastExecution: se.last_execution,
        createdAt: se.created_at,
        createdBy: se.users,
        recentExecutions: se.recent_executions?.slice(0, 5) || []
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      },
      statistics: execStats ? {
        totalScheduledExports: execStats.total_scheduled_exports,
        activeExports: execStats.active_exports,
        totalExecutions: execStats.total_executions,
        successfulExecutions: execStats.successful_executions,
        failedExecutions: execStats.failed_executions,
        successRate: execStats.success_rate,
        nextUpcoming: execStats.next_upcoming
      } : null,
      limits: {
        maxScheduledExports: getScheduledExportLimit(memberData.role),
        currentCount: count || 0
      }
    })

  } catch (error) {
    console.error('Get scheduled exports error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate next execution time based on schedule
 */
function calculateNextExecution(schedule: any): Date {
  const now = new Date()
  const next = new Date()
  
  // Set the hour
  next.setHours(schedule.hour, 0, 0, 0)
  
  switch (schedule.type) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      break
      
    case 'weekly':
      const dayOfWeek = schedule.dayOfWeek || 1 // Default to Monday
      const daysUntilTarget = (dayOfWeek - next.getDay() + 7) % 7
      next.setDate(next.getDate() + daysUntilTarget)
      if (next <= now) {
        next.setDate(next.getDate() + 7)
      }
      break
      
    case 'monthly':
      const dayOfMonth = schedule.dayOfMonth || 1
      next.setDate(dayOfMonth)
      if (next <= now) {
        next.setMonth(next.getMonth() + 1)
        next.setDate(dayOfMonth)
      }
      break
      
    case 'quarterly':
      const currentMonth = next.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      next.setMonth(quarterStartMonth)
      next.setDate(1)
      if (next <= now) {
        next.setMonth(quarterStartMonth + 3)
        next.setDate(1)
      }
      break
      
    default:
      // Default to next hour
      next.setHours(next.getHours() + 1, 0, 0, 0)
  }
  
  return next
}

/**
 * Get scheduled export limits based on role
 */
function getScheduledExportLimit(role: string): number {
  const limits: Record<string, number> = {
    owner: 50,
    admin: 25,
    hr_manager: 15,
    hr_analyst: 10,
    hr_specialist: 5,
    employee: 0
  }
  
  return limits[role] || 0
}