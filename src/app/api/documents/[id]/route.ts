import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';

// Get document details
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

    // Get document with organization and processing info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        organization:organizations(id, name),
        uploader:uploaded_by(id, email),
        category:document_categories(id, name, color)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check user has access to this organization
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

    // Get processing status if still processing
    let processingStatus = null;
    if (document.status === 'processing') {
      try {
        processingStatus = await DocumentProcessorService.getProcessingStatus(documentId);
      } catch (error) {
        console.error('Failed to get processing status:', error);
      }
    }

    // Get chunk count
    const { count: chunkCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    return NextResponse.json({
      document: {
        id: document.id,
        organization_id: document.organization_id,
        category_id: document.category_id,
        name: document.name,
        original_filename: document.original_filename,
        file_size_bytes: document.file_size_bytes,
        file_type: document.file_type,
        mime_type: document.mime_type,
        content_extracted: document.content_extracted,
        language: document.language,
        version_number: document.version_number,
        status: document.status,
        processing_metadata: document.processing_metadata,
        tags: document.tags,
        is_public: document.is_public,
        uploaded_by: document.uploaded_by,
        processed_at: document.processed_at,
        created_at: document.created_at,
        updated_at: document.updated_at,
        
        // Relations
        organization: document.organization,
        uploader: document.uploader,
        category: document.category,
        
        // Additional info
        chunk_count: chunkCount || 0,
        processing_status: processingStatus
      }
    });

  } catch (error) {
    console.error('Get document error:', error);
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

// Update document metadata
export async function PUT(
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
    const body = await req.json();
    
    const {
      name,
      category_id,
      tags,
      is_public,
      language
    } = body;

    // Get document to check permissions
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('organization_id, uploaded_by')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check user has permission (must be HR staff or document uploader)
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

    // Check if user can edit (HR staff or document owner)
    const canEdit = ['owner', 'admin', 'hr_manager', 'hr_staff'].includes(orgMember.role) || 
                   document.uploaded_by === user.id;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit document', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // Update document
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (tags !== undefined) updateData.tags = tags;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (language !== undefined) updateData.language = language;
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedDocument, error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message, code: 'UPDATE_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      document: updatedDocument
    });

  } catch (error) {
    console.error('Update document error:', error);
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

// Delete document
export async function DELETE(
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

    // Get document to check permissions and get storage path
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('organization_id, uploaded_by, storage_path, status')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check user has permission (must be HR manager/admin or document uploader)
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

    // Check if user can delete (HR managers/admins or document owner)
    const canDelete = ['owner', 'admin', 'hr_manager'].includes(orgMember.role) || 
                     document.uploaded_by === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete document', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // Cancel processing if still in progress
    if (document.status === 'processing') {
      try {
        await DocumentProcessorService.cancelProcessing(documentId);
      } catch (error) {
        console.error('Failed to cancel processing:', error);
      }
    }

    // Delete document chunks first (foreign key constraint)
    const { error: chunksError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    if (chunksError) {
      console.error('Failed to delete chunks:', chunksError);
      return NextResponse.json(
        { error: 'Failed to delete document chunks', code: 'DELETE_CHUNKS_FAILED' },
        { status: 400 }
      );
    }

    // Delete processing queue entries
    await supabase
      .from('document_processing_queue')
      .delete()
      .eq('document_id', documentId);

    // Delete file from storage
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.storage_path]);

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // Continue with document deletion even if file deletion fails
      }
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message, code: 'DELETE_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
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