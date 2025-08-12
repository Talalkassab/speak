/**
 * Export Job Status API Route
 * GET /api/v1/export/status/[jobId] - Check export job status and progress
 * DELETE /api/v1/export/status/[jobId] - Cancel export job if possible
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

    const jobId = params.jobId
    const organizationId = memberData.organization_id

    // Get export job status
    const exportService = new ExportService(supabase)
    const jobStatus = await exportService.getExportJobStatus(jobId, organizationId)

    if (!jobStatus) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    // Check if user can access this job (job owner or admin)
    const canAccess = jobStatus.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager'].includes(memberData.role)

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied to this export job' }, { status: 403 })
    }

    // Calculate additional metrics
    const now = new Date()
    const createdAt = new Date(jobStatus.created_at)
    const elapsedTime = now.getTime() - createdAt.getTime()
    
    let estimatedTimeRemaining = null
    if (jobStatus.status === 'processing' && jobStatus.progress > 0) {
      const estimatedTotalTime = elapsedTime / (jobStatus.progress / 100)
      estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime)
    }

    // Get recent job activity logs
    const { data: activityLogs } = await supabase
      .from('export_job_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      job: {
        id: jobStatus.id,
        status: jobStatus.status,
        type: jobStatus.type,
        format: jobStatus.format,
        progress: jobStatus.progress,
        totalItems: jobStatus.total_items,
        processedItems: jobStatus.processed_items,
        downloadUrl: jobStatus.download_url,
        errorMessage: jobStatus.error_message,
        createdAt: jobStatus.created_at,
        updatedAt: jobStatus.updated_at,
        completedAt: jobStatus.completed_at,
        estimatedCompletion: jobStatus.estimated_completion,
        options: jobStatus.options
      },
      metrics: {
        elapsedTimeMs: elapsedTime,
        estimatedTimeRemainingMs: estimatedTimeRemaining,
        processingRate: jobStatus.progress > 0 ? jobStatus.processed_items / (elapsedTime / 1000) : 0,
        isStuck: jobStatus.status === 'processing' && elapsedTime > 600000 && jobStatus.progress === 0, // 10 minutes with no progress
        canCancel: ['pending', 'processing'].includes(jobStatus.status),
        canRetry: jobStatus.status === 'failed'
      },
      activityLogs: activityLogs || []
    })

  } catch (error) {
    console.error('Get export job status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

    const jobId = params.jobId
    const organizationId = memberData.organization_id

    // Get export job
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    // Check if user can cancel this job (job owner or admin)
    const canCancel = job.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager'].includes(memberData.role)

    if (!canCancel) {
      return NextResponse.json({ error: 'Access denied to cancel this export job' }, { status: 403 })
    }

    // Check if job can be cancelled
    if (!['pending', 'processing'].includes(job.status)) {
      return NextResponse.json({ 
        error: `Cannot cancel job with status: ${job.status}` 
      }, { status: 400 })
    }

    // Update job status to cancelled
    const { error: updateError } = await supabase
      .from('export_jobs')
      .update({
        status: 'cancelled',
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to cancel export job' }, { status: 500 })
    }

    // Log cancellation activity
    await supabase
      .from('export_job_logs')
      .insert({
        job_id: jobId,
        organization_id: organizationId,
        level: 'info',
        message: 'Export job cancelled by user',
        details: {
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
          previous_status: job.status,
          progress_at_cancellation: job.progress
        }
      })

    // Log audit event
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'export_job_cancelled',
      'export_job',
      jobId,
      {
        job_type: job.type,
        job_format: job.format,
        progress_at_cancellation: job.progress,
        items_processed: job.processed_items,
        total_items: job.total_items
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Export job cancelled successfully',
      jobId,
      cancelledAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cancel export job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

    const jobId = params.jobId
    const organizationId = memberData.organization_id
    const { action } = await request.json()

    // Get export job
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    // Check permissions
    const canModify = job.user_id === user.id || 
                     ['owner', 'admin', 'hr_manager'].includes(memberData.role)

    if (!canModify) {
      return NextResponse.json({ error: 'Access denied to modify this export job' }, { status: 403 })
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    }

    switch (action) {
      case 'retry':
        if (job.status !== 'failed') {
          return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 })
        }
        
        updateData = {
          ...updateData,
          status: 'pending',
          progress: 0,
          processed_items: 0,
          error_message: null,
          completed_at: null,
          download_url: null
        }
        break

      case 'archive':
        if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
          return NextResponse.json({ error: 'Only completed, failed, or cancelled jobs can be archived' }, { status: 400 })
        }
        
        updateData.archived = true
        break

      case 'priority':
        const { priority } = await request.json()
        if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
          return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 })
        }
        
        if (!['pending', 'processing'].includes(job.status)) {
          return NextResponse.json({ error: 'Priority can only be changed for pending or processing jobs' }, { status: 400 })
        }
        
        updateData.priority = priority
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update job
    const { error: updateError } = await supabase
      .from('export_jobs')
      .update(updateData)
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update export job' }, { status: 500 })
    }

    // Log activity
    await supabase
      .from('export_job_logs')
      .insert({
        job_id: jobId,
        organization_id: organizationId,
        level: 'info',
        message: `Job ${action} by user`,
        details: {
          action,
          user_id: user.id,
          timestamp: new Date().toISOString(),
          previous_status: job.status
        }
      })

    // If retrying, queue the job again
    if (action === 'retry') {
      const exportService = new ExportService(supabase)
      await exportService.queueBulkExport(jobId, job.options, organizationId)
    }

    return NextResponse.json({
      success: true,
      message: `Export job ${action} completed successfully`,
      jobId,
      action,
      updatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Update export job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}