import { NextRequest, NextResponse } from 'next/server';
import { formidable } from 'formidable';
import { readFileSync, unlinkSync } from 'fs';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { validateFile, extractDocumentMetadata } from '@/types/documents';
import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file uploads

interface UploadedFile {
  filepath: string;
  originalFilename: string;
  mimetype: string;
  size: number;
}

async function parseFormData(req: NextRequest): Promise<{
  files: UploadedFile[];
  fields: Record<string, any>;
}> {
  const data = await req.formData();
  const files: UploadedFile[] = [];
  const fields: Record<string, any> = {};

  for (const [key, value] of data.entries()) {
    if (value instanceof File) {
      // Convert File to a temporary file path for processing
      const buffer = await value.arrayBuffer();
      const tempPath = `/tmp/${Date.now()}-${value.name}`;
      require('fs').writeFileSync(tempPath, Buffer.from(buffer));
      
      files.push({
        filepath: tempPath,
        originalFilename: value.name,
        mimetype: value.type,
        size: value.size,
      });
    } else {
      try {
        fields[key] = JSON.parse(value as string);
      } catch {
        fields[key] = value;
      }
    }
  }

  return { files, fields };
}

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
      .select(`
        organization_id,
        role,
        is_active,
        organization:organizations(
          id,
          name,
          subscription_tier,
          max_documents,
          max_storage_gb
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    // Check permissions
    if (!['owner', 'admin', 'hr_manager', 'hr_staff'].includes(orgMember.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // Parse form data
    const { files, fields } = await parseFormData(req);
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided', code: 'NO_FILES' },
        { status: 400 }
      );
    }

    const {
      category_id,
      tags = [],
      language = 'mixed',
      is_public = false,
      description
    } = fields;

    // Check organization limits
    const { data: currentDocs } = await supabase
      .from('documents')
      .select('id, file_size_bytes')
      .eq('organization_id', orgMember.organization_id)
      .neq('status', 'archived');

    const currentDocCount = currentDocs?.length || 0;
    const currentStorageBytes = currentDocs?.reduce((sum, doc) => sum + (doc.file_size_bytes || 0), 0) || 0;
    const currentStorageGB = currentStorageBytes / (1024 * 1024 * 1024);

    if (currentDocCount >= (orgMember.organization.max_documents || 100)) {
      return NextResponse.json(
        { 
          error: 'Document limit exceeded', 
          code: 'DOCUMENT_LIMIT_EXCEEDED',
          details: {
            current: currentDocCount,
            max: orgMember.organization.max_documents
          }
        },
        { status: 409 }
      );
    }

    const results = [];
    const processingJobs = [];

    for (const file of files) {
      try {
        // Create File object from uploaded file for validation
        const fileBuffer = readFileSync(file.filepath);
        const fileForValidation = new File([fileBuffer], file.originalFilename, {
          type: file.mimetype
        });

        // Validate file
        const validation = validateFile(fileForValidation);
        if (!validation.isValid) {
          results.push({
            filename: file.originalFilename,
            success: false,
            error: validation.error,
            code: 'VALIDATION_FAILED'
          });
          unlinkSync(file.filepath); // Clean up temp file
          continue;
        }

        // Check storage limit
        const newTotalStorage = currentStorageGB + (file.size / (1024 * 1024 * 1024));
        if (newTotalStorage > (orgMember.organization.max_storage_gb || 10)) {
          results.push({
            filename: file.originalFilename,
            success: false,
            error: 'Storage limit exceeded',
            code: 'STORAGE_LIMIT_EXCEEDED'
          });
          unlinkSync(file.filepath); // Clean up temp file
          continue;
        }

        // Generate storage path
        const fileExtension = file.originalFilename.split('.').pop()?.toLowerCase() || 'bin';
        const storagePath = `organizations/${orgMember.organization_id}/documents/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          results.push({
            filename: file.originalFilename,
            success: false,
            error: uploadError.message,
            code: 'UPLOAD_FAILED'
          });
          unlinkSync(file.filepath); // Clean up temp file
          continue;
        }

        // Create document record
        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            organization_id: orgMember.organization_id,
            category_id,
            name: file.originalFilename.split('.')[0], // Remove extension for name
            original_filename: file.originalFilename,
            file_size_bytes: file.size,
            file_type: fileExtension,
            mime_type: file.mimetype,
            storage_path: storagePath,
            language,
            tags,
            is_public,
            uploaded_by: user.id,
            status: 'processing',
            metadata: {
              ...extractDocumentMetadata(fileForValidation),
              upload_source: 'web',
              user_agent: req.headers.get('user-agent'),
              ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
            },
            version_number: 1
          })
          .select()
          .single();

        if (docError) {
          // Clean up uploaded file
          await supabase.storage.from('documents').remove([storagePath]);
          results.push({
            filename: file.originalFilename,
            success: false,
            error: docError.message,
            code: 'DATABASE_ERROR'
          });
          unlinkSync(file.filepath); // Clean up temp file
          continue;
        }

        // Add to processing queue
        const { error: queueError } = await supabase
          .from('document_processing_queue')
          .insert({
            document_id: document.id,
            organization_id: orgMember.organization_id,
            status: 'pending',
            priority: 5,
            retry_count: 0,
            max_retries: 3
          });

        if (queueError) {
          console.error('Failed to add to processing queue:', queueError);
        }

        results.push({
          filename: file.originalFilename,
          success: true,
          document_id: document.id,
          storage_path: storagePath,
          processing_status: 'queued'
        });

        // Start background processing
        processingJobs.push(
          DocumentProcessorService.processDocument(document.id, file.filepath, orgMember.organization_id)
            .catch(error => {
              console.error(`Processing failed for document ${document.id}:`, error);
            })
            .finally(() => {
              // Clean up temp file
              try {
                unlinkSync(file.filepath);
              } catch (e) {
                console.error('Failed to clean up temp file:', e);
              }
            })
        );

      } catch (error) {
        console.error('Error processing file:', error);
        results.push({
          filename: file.originalFilename,
          success: false,
          error: 'Internal processing error',
          code: 'PROCESSING_ERROR'
        });
        
        // Clean up temp file
        try {
          unlinkSync(file.filepath);
        } catch (e) {
          console.error('Failed to clean up temp file:', e);
        }
      }
    }

    // Don't wait for processing to complete, return immediately
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      results,
      summary: {
        total: files.length,
        successful: successCount,
        failed: failureCount
      },
      processing_started: processingJobs.length > 0
    });

  } catch (error) {
    console.error('Document upload error:', error);
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

// Get upload progress/status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('document_id');
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required', code: 'MISSING_DOCUMENT_ID' },
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

    // Get document with organization check
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        organization:organizations(id, name)
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

    // Get processing status
    const { data: queueItem } = await supabase
      .from('document_processing_queue')
      .select('*')
      .eq('document_id', documentId)
      .single();

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        filename: document.original_filename,
        status: document.status,
        file_size: document.file_size_bytes,
        file_type: document.file_type,
        language: document.language,
        created_at: document.created_at,
        processed_at: document.processed_at,
        processing_metadata: document.processing_metadata
      },
      processing: queueItem ? {
        status: queueItem.status,
        priority: queueItem.priority,
        retry_count: queueItem.retry_count,
        error_message: queueItem.error_message,
        started_at: queueItem.started_at,
        completed_at: queueItem.completed_at
      } : null
    });

  } catch (error) {
    console.error('Get upload status error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}