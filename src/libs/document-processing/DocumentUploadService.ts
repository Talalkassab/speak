import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentMetadata {
  category?: 'policies' | 'contracts' | 'handbooks' | 'procedures' | 'forms' | 'compliance' | 'other';
  tags?: string[];
  language?: 'ar' | 'en' | 'mixed';
  description?: string;
  [key: string]: any;
}

export interface DocumentRecord {
  id: string;
  organization_id: string;
  name: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  category: string;
  language: string;
  status: 'processing' | 'completed' | 'failed';
  metadata: Record<string, any>;
  tags: string[];
  version_number: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface UploadProgress {
  documentId: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export class DocumentUploadService {
  private supabase;
  private organizationId: string;
  private userId: string;

  constructor(organizationId: string, userId: string) {
    this.supabase = createSupabaseServerClient();
    this.organizationId = organizationId;
    this.userId = userId;
  }

  /**
   * Upload a document to Supabase Storage and create a database record
   */
  async uploadDocument(
    file: File,
    metadata: DocumentMetadata = {}
  ): Promise<DocumentRecord> {
    try {
      // Validate file
      this.validateFile(file);

      // Generate storage path
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const fileName = `${uuidv4()}.${fileExt}`;
      const category = metadata.category || 'other';
      const storagePath = `${this.organizationId}/${category}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase
        .storage
        .from('documents')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Detect language if not provided
      const language = metadata.language || await this.detectLanguageFromFilename(file.name);

      // Create document record in database
      const documentData = {
        organization_id: this.organizationId,
        name: this.sanitizeFilename(file.name),
        original_filename: file.name,
        file_type: file.type || this.getFileTypeFromExtension(fileExt),
        file_size_bytes: file.size,
        storage_path: storagePath,
        category: category,
        language: language,
        status: 'processing' as const,
        metadata: {
          ...metadata,
          upload_source: 'web',
          upload_timestamp: new Date().toISOString()
        },
        tags: metadata.tags || [],
        version_number: 1,
        uploaded_by: this.userId
      };

      const { data: document, error: dbError } = await this.supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await this.supabase.storage
          .from('documents')
          .remove([storagePath]);
        throw new Error(`Failed to create document record: ${dbError.message}`);
      }

      // Add to processing queue
      await this.addToProcessingQueue(document.id);

      return document as DocumentRecord;
    } catch (error) {
      console.error('Document upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload multiple documents in batch
   */
  async bulkUploadDocuments(
    files: File[],
    metadata: DocumentMetadata = {}
  ): Promise<DocumentRecord[]> {
    const results: DocumentRecord[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      try {
        const document = await this.uploadDocument(file, metadata);
        results.push(document);
      } catch (error) {
        errors.push({
          file: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (errors.length > 0) {
      console.warn('Some files failed to upload:', errors);
    }

    return results;
  }

  /**
   * Process an uploaded document
   */
  async processDocument(documentId: string): Promise<void> {
    try {
      // Update status to processing
      await this.updateDocumentStatus(documentId, 'processing');

      // Get document details
      const { data: document, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new Error('Document not found');
      }

      // Trigger processing in the background
      // This will be handled by the DocumentProcessingQueue
      await this.supabase
        .from('document_processing_queue')
        .update({
          status: 'pending',
          retry_count: 0
        })
        .eq('document_id', documentId);

    } catch (error) {
      await this.updateDocumentStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Reprocess a document that failed or needs updating
   */
  async reprocessDocument(documentId: string): Promise<void> {
    try {
      // Clear existing chunks
      await this.supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // Reset document status
      await this.updateDocumentStatus(documentId, 'processing');

      // Add back to processing queue
      await this.addToProcessingQueue(documentId, 1); // Higher priority

    } catch (error) {
      console.error('Failed to reprocess document:', error);
      throw error;
    }
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(documentId: string): Promise<UploadProgress> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('id, status, metadata')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        throw new Error('Document not found');
      }

      // Check processing queue for more details
      const { data: queueData } = await this.supabase
        .from('document_processing_queue')
        .select('status, error_message')
        .eq('document_id', documentId)
        .single();

      let progress = 0;
      let message = '';

      switch (data.status) {
        case 'processing':
          progress = 50;
          message = 'Processing document...';
          break;
        case 'completed':
          progress = 100;
          message = 'Document processed successfully';
          break;
        case 'failed':
          progress = 0;
          message = queueData?.error_message || 'Processing failed';
          break;
      }

      return {
        documentId: data.id,
        status: data.status === 'processing' ? 'processing' : 
                data.status === 'completed' ? 'completed' : 'failed',
        progress,
        message,
        error: queueData?.error_message
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a document and all associated data
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document details first
      const { data: document, error } = await this.supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      if (document.storage_path) {
        await this.supabase.storage
          .from('documents')
          .remove([document.storage_path]);
      }

      // Delete from database (chunks will be cascade deleted)
      await this.supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private validateFile(file: File): void {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/rtf'
    ];

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'rtf'];

    if (!allowedExtensions.includes(fileExt || '')) {
      throw new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove file extension for display name
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Replace special characters with spaces
    return nameWithoutExt
      .replace(/[^\w\s\-\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getFileTypeFromExtension(ext: string): string {
    const typeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain',
      'rtf': 'application/rtf'
    };
    return typeMap[ext] || 'application/octet-stream';
  }

  private async detectLanguageFromFilename(filename: string): Promise<'ar' | 'en' | 'mixed'> {
    // Simple detection based on Arabic characters in filename
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
    const hasArabic = arabicPattern.test(filename);
    const hasEnglish = /[a-zA-Z]/.test(filename);

    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'ar';
    return 'en';
  }

  private async addToProcessingQueue(documentId: string, priority: number = 5): Promise<void> {
    await this.supabase
      .from('document_processing_queue')
      .insert({
        document_id: documentId,
        organization_id: this.organizationId,
        status: 'pending',
        priority: priority
      });
  }

  private async updateDocumentStatus(
    documentId: string, 
    status: 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'completed') {
      updateData.processed_at = new Date().toISOString();
    }

    await this.supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);
  }
}