/**
 * Export Job Status API Route
 * GET /api/v1/export/jobs/[jobId]/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import ExportService from '@/libs/services/export-service'
import { Database } from '@/libs/supabase/types'

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

    // Initialize export service
    const exportService = new ExportService(supabase)
    
    // Get job status
    const jobStatus = await exportService.getExportJobStatus(jobId, organizationId)

    if (!jobStatus) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    // Calculate additional status information
    const statusInfo = {
      ...jobStatus,
      progressPercentage: jobStatus.progress,
      isCompleted: jobStatus.status === 'completed',
      isFailed: jobStatus.status === 'failed',
      isProcessing: jobStatus.status === 'processing',
      isPending: jobStatus.status === 'pending',
      remainingItems: Math.max(0, jobStatus.totalItems - jobStatus.processedItems),
      estimatedTimeRemaining: calculateRemainingTime(jobStatus)
    }

    // If job is completed and has download URL, check if file still exists
    if (statusInfo.isCompleted && statusInfo.downloadUrl) {
      try {
        // Verify download URL is still valid
        const { data: fileData, error: fileError } = await supabase.storage
          .from('exports')
          .list(getPathFromUrl(statusInfo.downloadUrl))

        if (fileError) {
          statusInfo.downloadUrl = undefined
          statusInfo.errorMessage = 'Export file no longer available'
        }
      } catch (error) {
        // File check failed, but don't fail the whole request
        console.warn('Could not verify export file:', error)
      }
    }

    return NextResponse.json({
      success: true,
      job: statusInfo
    })

  } catch (error) {
    console.error('Get export job status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE method to cancel a pending/processing job
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

    // Check if user has permission to cancel jobs (admin or hr_manager)
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to cancel export jobs' }, { status: 403 })
    }

    // Get current job status
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('id, status, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    // Check if job can be cancelled
    if (!['pending', 'processing'].includes(job.status)) {
      return NextResponse.json({ 
        error: `Cannot cancel job with status: ${job.status}` 
      }, { status: 400 })
    }

    // Cancel the job
    const { error: cancelError } = await supabase
      .from('export_jobs')
      .update({
        status: 'cancelled',
        error_message: `Cancelled by user at ${new Date().toISOString()}`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (cancelError) {
      return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 })
    }

    // Log cancellation
    await supabase
      .from('user_activity_logs')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        action: 'export_job_cancelled',
        resource_type: 'export_job',
        resource_id: jobId,
        details: {
          cancelled_at: new Date().toISOString(),
          original_status: job.status
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Export job cancelled successfully',
      jobId: jobId
    })

  } catch (error) {
    console.error('Cancel export job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate remaining time
function calculateRemainingTime(jobStatus: any): string | null {
  if (jobStatus.status !== 'processing' || jobStatus.progress === 0) {
    return null
  }

  const startTime = new Date(jobStatus.started_at || jobStatus.created_at).getTime()
  const currentTime = Date.now()
  const elapsedTime = currentTime - startTime

  // Calculate time per item processed
  const timePerItem = elapsedTime / jobStatus.processedItems
  const remainingItems = jobStatus.totalItems - jobStatus.processedItems
  const estimatedRemainingMs = timePerItem * remainingItems

  const estimatedRemainingMinutes = Math.ceil(estimatedRemainingMs / (1000 * 60))

  if (estimatedRemainingMinutes < 1) return 'Less than 1 minute'
  if (estimatedRemainingMinutes === 1) return '1 minute'
  if (estimatedRemainingMinutes < 60) return `${estimatedRemainingMinutes} minutes`

  const hours = Math.floor(estimatedRemainingMinutes / 60)
  const remainingMinutes = estimatedRemainingMinutes % 60

  if (hours === 1 && remainingMinutes === 0) return '1 hour'
  if (remainingMinutes === 0) return `${hours} hours`

  return `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
}

// Helper function to extract path from storage URL
function getPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    // Remove the first few parts to get to the actual file path
    const relevantParts = pathParts.slice(-2) // Get last 2 parts for organization/filename
    return relevantParts.join('/')
  } catch (error) {
    return ''
  }
}