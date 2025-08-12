import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';

// Bulk process multiple documents
export async function POST(req: NextRequest) {
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

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    // Check permissions - only HR staff and above can bulk process
    if (!['owner', 'admin', 'hr_manager', 'hr_staff'].includes(orgMember.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      document_ids,
      operation = 'reprocess', // 'reprocess', 'cancel', 'delete'
      force = false
    } = body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs array is required', code: 'DOCUMENT_IDS_REQUIRED' },
        { status: 400 }
      );
    }

    if (document_ids.length > 50) {
      return NextResponse.json(
        { error: 'Cannot process more than 50 documents at once', code: 'TOO_MANY_DOCUMENTS' },
        { status: 400 }
      );
    }

    // Get all documents to validate they belong to the organization
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, organization_id, status, name, uploaded_by, storage_path')
      .in('id', document_ids)
      .eq('organization_id', orgMember.organization_id);

    if (docsError) {
      return NextResponse.json(
        { error: docsError.message, code: 'DOCUMENTS_FETCH_FAILED' },
        { status: 400 }
      );
    }

    if (!documents || documents.length !== document_ids.length) {
      const foundIds = documents?.map(d => d.id) || [];
      const missingIds = document_ids.filter(id => !foundIds.includes(id));
      
      return NextResponse.json(
        { 
          error: 'Some documents not found or not accessible', 
          code: 'DOCUMENTS_NOT_FOUND',
          details: { missing_ids: missingIds }
        },
        { status: 404 }
      );
    }

    const results = [];
    const operationPromises = [];

    // Process each document based on operation
    for (const document of documents) {
      try {
        let operationResult;

        switch (operation) {
          case 'reprocess':
            // Check if document can be reprocessed
            if (!['failed', 'completed'].includes(document.status) && !force) {
              results.push({
                document_id: document.id,
                document_name: document.name,
                success: false,
                error: `Document cannot be reprocessed in status: ${document.status}`,
                code: 'INVALID_STATUS'
              });
              continue;
            }

            // Start reprocessing (don't await)
            const reprocessPromise = DocumentProcessorService.retryProcessing(document.id)
              .then(result => ({
                document_id: document.id,
                document_name: document.name,
                success: result.success,
                error: result.error,
                processing_time_ms: result.processingTimeMs
              }))
              .catch(error => ({
                document_id: document.id,
                document_name: document.name,
                success: false,
                error: error.message,
                code: 'REPROCESS_FAILED'
              }));

            operationPromises.push(reprocessPromise);
            
            results.push({
              document_id: document.id,
              document_name: document.name,
              success: true,
              status: 'reprocessing_started',
              message: 'Reprocessing started in background'
            });
            break;

          case 'cancel':
            if (document.status !== 'processing') {
              results.push({
                document_id: document.id,
                document_name: document.name,
                success: false,
                error: 'Document is not currently processing',
                code: 'NOT_PROCESSING'
              });
              continue;
            }

            const cancelSuccess = await DocumentProcessorService.cancelProcessing(document.id);
            results.push({
              document_id: document.id,
              document_name: document.name,
              success: cancelSuccess,
              status: cancelSuccess ? 'cancelled' : 'cancel_failed',
              error: cancelSuccess ? undefined : 'Failed to cancel processing'
            });
            break;

          case 'delete':
            // Check delete permissions
            const canDelete = ['owner', 'admin', 'hr_manager'].includes(orgMember.role) || 
                             document.uploaded_by === user.id;

            if (!canDelete) {
              results.push({
                document_id: document.id,
                document_name: document.name,
                success: false,
                error: 'Insufficient permissions to delete document',
                code: 'DELETE_PERMISSION_DENIED'
              });
              continue;
            }

            try {
              // Cancel processing if needed
              if (document.status === 'processing') {
                await DocumentProcessorService.cancelProcessing(document.id);
              }

              // Delete chunks
              await supabase
                .from('document_chunks')
                .delete()
                .eq('document_id', document.id);

              // Delete processing queue entries
              await supabase
                .from('document_processing_queue')
                .delete()
                .eq('document_id', document.id);

              // Delete file from storage
              if (document.storage_path) {
                await supabase.storage
                  .from('documents')
                  .remove([document.storage_path]);
              }

              // Delete document
              const { error: deleteError } = await supabase
                .from('documents')
                .delete()
                .eq('id', document.id);

              if (deleteError) {
                throw new Error(deleteError.message);
              }

              results.push({
                document_id: document.id,
                document_name: document.name,
                success: true,
                status: 'deleted',
                message: 'Document deleted successfully'
              });

            } catch (error) {
              results.push({
                document_id: document.id,
                document_name: document.name,
                success: false,
                error: error instanceof Error ? error.message : 'Delete failed',
                code: 'DELETE_FAILED'
              });
            }
            break;

          default:
            results.push({
              document_id: document.id,
              document_name: document.name,
              success: false,
              error: `Unknown operation: ${operation}`,
              code: 'UNKNOWN_OPERATION'
            });
        }

      } catch (error) {
        results.push({
          document_id: document.id,
          document_name: document.name,
          success: false,
          error: error instanceof Error ? error.message : 'Operation failed',
          code: 'OPERATION_ERROR'
        });
      }
    }

    // If reprocessing, we can optionally wait for some results
    if (operation === 'reprocess' && operationPromises.length > 0) {
      // Don't wait for all to complete, but could wait for a few seconds
      // to get immediate feedback for quickly processed documents
      try {
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
        const immediateResults = await Promise.race([
          Promise.allSettled(operationPromises),
          timeoutPromise
        ]);

        // Update results with any completed reprocessing operations
        if (Array.isArray(immediateResults)) {
          immediateResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const resultIndex = results.findIndex(r => r.document_id === result.value.document_id);
              if (resultIndex >= 0) {
                results[resultIndex] = {
                  ...results[resultIndex],
                  ...result.value,
                  status: result.value.success ? 'reprocessing_completed' : 'reprocessing_failed'
                };
              }
            }
          });
        }
      } catch (error) {
        console.error('Error waiting for immediate results:', error);
        // Continue with the original results
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      operation,
      results,
      summary: {
        total_documents: document_ids.length,
        successful_operations: successCount,
        failed_operations: failureCount,
        success_rate: (successCount / document_ids.length * 100).toFixed(1) + '%'
      },
      background_processing: operation === 'reprocess' && operationPromises.length > 0
    });

  } catch (error) {
    console.error('Bulk process error:', error);
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

// Get status of bulk operations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const document_ids = searchParams.get('document_ids')?.split(',') || [];
    
    if (document_ids.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs parameter is required', code: 'DOCUMENT_IDS_REQUIRED' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    // Get status for all documents
    const statusPromises = document_ids.map(async (documentId) => {
      try {
        const status = await DocumentProcessorService.getProcessingStatus(documentId);
        return {
          document_id: documentId,
          ...status
        };
      } catch (error) {
        return {
          document_id: documentId,
          error: error instanceof Error ? error.message : 'Status check failed'
        };
      }
    });

    const statuses = await Promise.all(statusPromises);

    // Group by status
    const statusSummary = {
      processing: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      unknown: 0
    };

    statuses.forEach(status => {
      const docStatus = status.document_status || 'unknown';
      if (docStatus in statusSummary) {
        statusSummary[docStatus as keyof typeof statusSummary]++;
      } else {
        statusSummary.unknown++;
      }
    });

    return NextResponse.json({
      success: true,
      documents: statuses,
      summary: {
        total_documents: document_ids.length,
        status_breakdown: statusSummary,
        all_completed: statusSummary.processing === 0 && statusSummary.pending === 0,
        any_failed: statusSummary.failed > 0
      }
    });

  } catch (error) {
    console.error('Bulk status check error:', error);
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