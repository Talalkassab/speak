import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';

// Reprocess a failed document
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Get document to check permissions and status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('organization_id, status, storage_path')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check user has permission
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('role, is_active')
      .eq('organization_id', document.organization_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Only HR staff and above can reprocess
    if (!['owner', 'admin', 'hr_manager', 'hr_staff'].includes(orgMember.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // Check if document is in a state that can be reprocessed
    if (!['failed', 'completed'].includes(document.status)) {
      return NextResponse.json(
        { error: 'Document cannot be reprocessed in current state', code: 'INVALID_STATE' },
        { status: 400 }
      );
    }

    // Check retry limits
    const { data: queueItem } = await supabase
      .from('document_processing_queue')
      .select('retry_count, max_retries')
      .eq('document_id', documentId)
      .single();

    if (queueItem && queueItem.retry_count >= queueItem.max_retries) {
      return NextResponse.json(
        { 
          error: 'Maximum retry attempts exceeded', 
          code: 'MAX_RETRIES_EXCEEDED',
          details: {
            retry_count: queueItem.retry_count,
            max_retries: queueItem.max_retries
          }
        },
        { status: 409 }
      );
    }

    // Start reprocessing
    console.log(`Starting reprocess for document ${documentId}`);
    
    // Start reprocessing in background
    const processingPromise = DocumentProcessorService.retryProcessing(documentId);
    
    // Don't await the processing, return immediately
    processingPromise.catch(error => {
      console.error(`Background reprocessing failed for ${documentId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Document reprocessing started',
      document_id: documentId,
      status: 'reprocessing_started'
    });

  } catch (error) {
    console.error('Reprocess document error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get reprocessing status
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Get document to check permissions
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('organization_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check user has access
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('role, is_active')
      .eq('organization_id', document.organization_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Get processing status
    const status = await DocumentProcessorService.getProcessingStatus(documentId);

    return NextResponse.json({
      document_id: documentId,
      ...status
    });

  } catch (error) {
    console.error('Get reprocess status error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}