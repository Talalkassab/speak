import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, logUserActivity, updateUsageStats, AuthError, hasRole, validateDocumentAccess } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Update document schema
const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['policies', 'contracts', 'handbooks', 'procedures', 'forms', 'compliance', 'other']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  is_public: z.boolean().optional()
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

// GET /api/v1/documents/[id] - Get document details
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
        'Access denied to this document',
        403
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // Get document with related data
    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:auth.users!uploaded_by(email, raw_user_meta_data),
        document_chunks(
          id,
          chunk_index,
          content,
          metadata,
          created_at
        ),
        processing_jobs:document_processing_queue(
          id,
          status,
          error_message,
          started_at,
          completed_at,
          created_at
        )
      `)
      .eq('id', documentId)
      .eq('organization_id', userContext.organizationId)
      .single();

    if (error || !document) {
      return createErrorResponse('DOCUMENT_NOT_FOUND', 'Document not found', 404);
    }

    // Get usage analytics for this document
    const { data: analytics } = await supabase
      .from('rag_queries')
      .select('id, created_at')
      .contains('sources', [{ document_id: documentId }])
      .eq('organization_id', userContext.organizationId);

    const formattedDocument = {
      id: document.id,
      name: document.name,
      original_filename: document.original_filename,
      category: document.category,
      language: document.language,
      file_size_bytes: document.file_size_bytes,
      status: document.status,
      tags: document.tags || [],
      metadata: document.metadata || {},
      is_public: document.is_public,
      uploaded_by: document.uploaded_by,
      uploader: {
        email: document.uploader?.email,
        name: document.uploader?.raw_user_meta_data?.name || document.uploader?.email
      },
      storage_path: document.storage_path,
      content_extracted: document.content_extracted,
      processed_at: document.processed_at,
      created_at: document.created_at,
      updated_at: document.updated_at,
      version_number: document.version_number,
      chunks: document.document_chunks?.map((chunk: any) => ({
        id: chunk.id,
        chunk_index: chunk.chunk_index,
        content_preview: chunk.content.substring(0, 200) + '...',
        content_length: chunk.content.length,
        metadata: chunk.metadata || {},
        created_at: chunk.created_at
      })) || [],
      processing_history: document.processing_jobs || [],
      analytics: {
        total_queries: analytics?.length || 0,
        recent_queries: analytics?.slice(-10).map((q: any) => ({
          id: q.id,
          created_at: q.created_at
        })) || []
      }
    };

    // Log activity
    await logUserActivity(
      userContext,
      'document_viewed',
      'document',
      documentId,
      { name: document.name, category: document.category },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(formattedDocument);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error getting document:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// PUT /api/v1/documents/[id] - Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Validate document access
    const hasAccess = await validateDocumentAccess(documentId, userContext, 'write');
    if (!hasAccess) {
      return createErrorResponse(
        'DOCUMENT_ACCESS_DENIED',
        'Access denied to update this document',
        403
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const updateData = updateDocumentSchema.parse(body);

    const supabase = await createSupabaseServerClient();
    
    // Update document
    const { data: document, error } = await supabase
      .from('documents')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('organization_id', userContext.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Database error updating document:', error);
      return createErrorResponse('DB_ERROR', 'Failed to update document', 500);
    }

    if (!document) {
      return createErrorResponse('DOCUMENT_NOT_FOUND', 'Document not found', 404);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'document_updated',
      'document',
      documentId,
      { 
        changes: updateData,
        name: document.name 
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(document);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error updating document:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// DELETE /api/v1/documents/[id] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Validate document access for deletion
    const hasAccess = await validateDocumentAccess(documentId, userContext, 'delete');
    if (!hasAccess) {
      return createErrorResponse(
        'DOCUMENT_ACCESS_DENIED',
        'Access denied to delete this document',
        403
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // Get document details before deletion
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('name, storage_path, file_size_bytes')
      .eq('id', documentId)
      .eq('organization_id', userContext.organizationId)
      .single();

    if (fetchError || !document) {
      return createErrorResponse('DOCUMENT_NOT_FOUND', 'Document not found', 404);
    }

    // Delete document (cascade will handle chunks and processing queue)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('organization_id', userContext.organizationId);

    if (deleteError) {
      console.error('Database error deleting document:', deleteError);
      return createErrorResponse('DB_ERROR', 'Failed to delete document', 500);
    }

    // Delete file from storage
    try {
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.storage_path]);
        
        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Don't fail the API call if storage deletion fails
        }
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'document_deleted',
      'document',
      documentId,
      { 
        name: document.name,
        fileSizeBytes: document.file_size_bytes 
      },
      request
    );

    // Update usage stats (negative document count)
    await updateUsageStats(userContext.organizationId, { 
      documents_count: -1,
      api_calls: 1
    });

    return createSuccessResponse(
      { 
        id: documentId, 
        deleted: true,
        message: 'Document deleted successfully' 
      },
      200
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error deleting document:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}