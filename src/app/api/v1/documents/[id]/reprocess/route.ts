import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, logUserActivity, updateUsageStats, AuthError, hasRole, validateDocumentAccess } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Reprocess options schema
const reprocessOptionsSchema = z.object({
  forceReprocess: z.boolean().default(false),
  updateEmbeddings: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
});

interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

function createErrorResponse(code: string, message: string, status: number = 400, details?: any): NextResponse {
  const error: APIError = {
    code,
    message,
    details,
    timestamp: new Date()
  };
  
  console.error('API Error:', error);
  return NextResponse.json({ error }, { status });
}

function createSuccessResponse<T>(data: T, status: number = 200, metadata?: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    metadata,
    timestamp: new Date()
  }, { status });
}

// POST /api/v1/documents/[id]/reprocess - Reprocess document
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for reprocessing
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager', 'hr_staff'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to reprocess documents',
        403
      );
    }

    // Validate document access
    const hasAccess = await validateDocumentAccess(documentId, userContext, 'write');
    if (!hasAccess) {
      return createErrorResponse(
        'DOCUMENT_ACCESS_DENIED',
        'Access denied to reprocess this document',
        403
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const { forceReprocess, updateEmbeddings, priority } = reprocessOptionsSchema.parse(body);

    const supabase = await createSupabaseServerClient();
    
    // Get document details
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', userContext.organizationId)
      .single();

    if (fetchError || !document) {
      return createErrorResponse('DOCUMENT_NOT_FOUND', 'Document not found', 404);
    }

    // Check if document is already being processed
    const { data: existingJob } = await supabase
      .from('document_processing_queue')
      .select('*')
      .eq('document_id', documentId)
      .in('status', ['pending', 'processing'])
      .single();

    if (existingJob && !forceReprocess) {
      return createErrorResponse(
        'PROCESSING_IN_PROGRESS',
        'Document is already being processed. Use forceReprocess=true to override.',
        409,
        { existingJobId: existingJob.id, status: existingJob.status }
      );
    }

    // Cancel existing job if force reprocess
    if (existingJob && forceReprocess) {
      await supabase
        .from('document_processing_queue')
        .update({ 
          status: 'cancelled',
          error_message: 'Cancelled due to force reprocess request'
        })
        .eq('id', existingJob.id);
    }

    // Create priority mapping
    const priorityMapping = {
      'low': 3,
      'normal': 5,
      'high': 8
    };

    // Create new processing job
    const { data: processingJob, error: jobError } = await supabase
      .from('document_processing_queue')
      .insert({
        document_id: documentId,
        organization_id: userContext.organizationId,
        status: 'pending',
        priority: priorityMapping[priority],
        retry_count: 0,
        max_retries: 3,
        metadata: {
          reprocess_options: {
            force_reprocess: forceReprocess,
            update_embeddings: updateEmbeddings,
            requested_by: userContext.userId,
            requested_at: new Date().toISOString()
          }
        }
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating processing job:', jobError);
      return createErrorResponse('DB_ERROR', 'Failed to create processing job', 500);
    }

    // Update document status
    await supabase
      .from('documents')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // If updating embeddings, clear existing chunks
    if (updateEmbeddings) {
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'document_reprocessing_requested',
      'document',
      documentId,
      { 
        jobId: processingJob.id,
        priority,
        options: { forceReprocess, updateEmbeddings },
        documentName: document.name
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    const response = {
      job_id: processingJob.id,
      document_id: documentId,
      status: 'pending',
      priority,
      estimated_completion: calculateEstimatedCompletion(priority),
      options: {
        force_reprocess: forceReprocess,
        update_embeddings: updateEmbeddings,
        priority
      },
      created_at: processingJob.created_at
    };

    return createSuccessResponse(response, 202);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error requesting document reprocessing:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// GET /api/v1/documents/[id]/reprocess - Get reprocessing status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Validate document access
    const hasAccess = await validateDocumentAccess(documentId, userContext, 'read');
    if (!hasAccess) {
      return createErrorResponse(
        'DOCUMENT_ACCESS_DENIED',
        'Access denied to view processing status for this document',
        403
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // Get processing jobs for this document
    const { data: jobs, error } = await supabase
      .from('document_processing_queue')
      .select('*')
      .eq('document_id', documentId)
      .eq('organization_id', userContext.organizationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching processing jobs:', error);
      return createErrorResponse('DB_ERROR', 'Failed to fetch processing status', 500);
    }

    const currentJob = jobs?.find(job => job.status === 'processing' || job.status === 'pending');
    
    const response = {
      document_id: documentId,
      current_job: currentJob ? {
        job_id: currentJob.id,
        status: currentJob.status,
        priority: currentJob.priority,
        retry_count: currentJob.retry_count,
        max_retries: currentJob.max_retries,
        error_message: currentJob.error_message,
        started_at: currentJob.started_at,
        estimated_completion: currentJob.started_at ? 
          calculateEstimatedCompletion(getPriorityFromNumber(currentJob.priority)) : 
          null,
        created_at: currentJob.created_at,
        metadata: currentJob.metadata
      } : null,
      processing_history: jobs?.map(job => ({
        job_id: job.id,
        status: job.status,
        priority: job.priority,
        retry_count: job.retry_count,
        error_message: job.error_message,
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at
      })) || []
    };

    // Log activity
    await logUserActivity(
      userContext,
      'processing_status_viewed',
      'document',
      documentId,
      { currentStatus: currentJob?.status || 'none' },
      request
    );

    return createSuccessResponse(response);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error getting processing status:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to calculate estimated completion time
function calculateEstimatedCompletion(priority: 'low' | 'normal' | 'high'): string {
  const baseMinutes = {
    'high': 2,
    'normal': 5,
    'low': 15
  };
  
  const estimatedTime = new Date();
  estimatedTime.setMinutes(estimatedTime.getMinutes() + baseMinutes[priority]);
  
  return estimatedTime.toISOString();
}

// Helper function to convert priority number to string
function getPriorityFromNumber(priorityNum: number): 'low' | 'normal' | 'high' {
  if (priorityNum >= 8) return 'high';
  if (priorityNum >= 5) return 'normal';
  return 'low';
}