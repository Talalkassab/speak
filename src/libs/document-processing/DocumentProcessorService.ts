import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { TextExtractionService } from './TextExtractionService';
import { DocumentChunkingService } from './DocumentChunkingService';
import { EmbeddingGenerationService } from '@/services/rag/EmbeddingGenerationService';

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  extractedText?: string;
  language?: 'ar' | 'en' | 'mixed';
  chunksCreated?: number;
  embeddingsGenerated?: boolean;
  processingTimeMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class DocumentProcessorService {
  
  /**
   * Process a document through the complete pipeline:
   * 1. Extract text from file
   * 2. Chunk the content appropriately 
   * 3. Generate embeddings
   * 4. Store chunks and embeddings in database
   */
  static async processDocument(
    documentId: string,
    filePath: string,
    organizationId: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const supabase = createSupabaseServerClient();
    
    try {
      console.log(`Starting document processing for ${documentId}`);

      // Update processing queue status
      await supabase
        .from('document_processing_queue')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      // Get document info
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
      }

      // Update document status
      await supabase
        .from('documents')
        .update({ 
          status: 'processing',
          processing_metadata: {
            stage: 'text_extraction',
            started_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      // Step 1: Extract text from the document
      console.log(`Extracting text from ${document.mime_type} file`);
      const extractedContent = await TextExtractionService.extractText(
        filePath, 
        document.mime_type
      );

      if (!extractedContent.text || extractedContent.text.trim().length === 0) {
        throw new Error('No text could be extracted from the document');
      }

      // Update document with extracted content
      await supabase
        .from('documents')
        .update({
          content_extracted: extractedContent.text,
          language: extractedContent.language,
          processing_metadata: {
            ...document.processing_metadata,
            stage: 'chunking',
            text_extraction_complete: true,
            extraction_method: extractedContent.metadata.extraction_method,
            ocr_applied: extractedContent.metadata.ocr_applied || false,
            word_count: extractedContent.metadata.word_count,
            processing_time_ms: extractedContent.metadata.processing_time_ms
          }
        })
        .eq('id', documentId);

      // Step 2: Chunk the extracted text
      console.log(`Chunking text for document ${documentId}`);
      const chunks = await DocumentChunkingService.chunkDocument({
        text: extractedContent.text,
        language: extractedContent.language,
        documentId,
        organizationId,
        documentName: document.name || document.original_filename,
        metadata: {
          file_type: document.file_type,
          mime_type: document.mime_type,
          ...extractedContent.metadata
        }
      });

      if (chunks.length === 0) {
        throw new Error('No chunks could be created from the document text');
      }

      // Update processing status
      await supabase
        .from('documents')
        .update({
          processing_metadata: {
            ...document.processing_metadata,
            stage: 'embedding_generation',
            chunks_created: chunks.length
          }
        })
        .eq('id', documentId);

      // Step 3: Generate embeddings for chunks
      console.log(`Generating embeddings for ${chunks.length} chunks`);
      const embeddingService = new EmbeddingGenerationService();
      
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const embedding = await embeddingService.generateEmbedding(chunk.content);
            return {
              ...chunk,
              embedding
            };
          } catch (error) {
            console.error(`Failed to generate embedding for chunk ${chunk.chunk_index}:`, error);
            return {
              ...chunk,
              embedding: null
            };
          }
        })
      );

      // Step 4: Store chunks in database
      console.log(`Storing ${chunksWithEmbeddings.length} chunks in database`);
      const { error: chunksError } = await supabase
        .from('document_chunks')
        .insert(chunksWithEmbeddings);

      if (chunksError) {
        throw new Error(`Failed to store chunks: ${chunksError.message}`);
      }

      // Step 5: Update final status
      const processingTimeMs = Date.now() - startTime;
      const successfulEmbeddings = chunksWithEmbeddings.filter(c => c.embedding !== null).length;

      await supabase
        .from('documents')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          processing_metadata: {
            stage: 'completed',
            chunks_created: chunks.length,
            embeddings_generated: successfulEmbeddings > 0,
            successful_embeddings: successfulEmbeddings,
            failed_embeddings: chunks.length - successfulEmbeddings,
            processing_time_ms: processingTimeMs,
            text_extraction_complete: true,
            extraction_method: extractedContent.metadata.extraction_method,
            ocr_applied: extractedContent.metadata.ocr_applied || false,
            word_count: extractedContent.metadata.word_count
          }
        })
        .eq('id', documentId);

      // Update processing queue
      await supabase
        .from('document_processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      console.log(`Document processing completed successfully for ${documentId}`);

      return {
        success: true,
        documentId,
        extractedText: extractedContent.text,
        language: extractedContent.language,
        chunksCreated: chunks.length,
        embeddingsGenerated: successfulEmbeddings > 0,
        processingTimeMs,
        metadata: extractedContent.metadata
      };

    } catch (error) {
      console.error(`Document processing failed for ${documentId}:`, error);
      
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';

      // Update document status to failed
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_metadata: {
            stage: 'failed',
            error: errorMessage,
            processing_time_ms: processingTimeMs,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      // Update processing queue
      await supabase
        .from('document_processing_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          retry_count: supabase.from('document_processing_queue')
            .select('retry_count')
            .eq('document_id', documentId)
            .then(({ data }) => (data?.[0]?.retry_count || 0) + 1)
        })
        .eq('document_id', documentId);

      return {
        success: false,
        documentId,
        error: errorMessage,
        processingTimeMs
      };
    }
  }

  /**
   * Retry processing for a failed document
   */
  static async retryProcessing(documentId: string): Promise<ProcessingResult> {
    const supabase = createSupabaseServerClient();
    
    try {
      // Get document info
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
      }

      // Check retry count
      const { data: queueItem } = await supabase
        .from('document_processing_queue')
        .select('retry_count, max_retries')
        .eq('document_id', documentId)
        .single();

      if (queueItem && queueItem.retry_count >= queueItem.max_retries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      // Reset document status
      await supabase
        .from('documents')
        .update({
          status: 'processing',
          processing_metadata: {
            stage: 'retry',
            retry_attempt: (queueItem?.retry_count || 0) + 1,
            started_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      // Clean up existing chunks
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // Download file from storage for reprocessing
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download file for reprocessing: ${downloadError.message}`);
      }

      // Save to temporary location
      const tempPath = `/tmp/retry_${Date.now()}_${document.original_filename}`;
      const buffer = Buffer.from(await fileData.arrayBuffer());
      require('fs').writeFileSync(tempPath, buffer);

      try {
        // Process the document
        return await this.processDocument(documentId, tempPath, document.organization_id);
      } finally {
        // Clean up temp file
        try {
          require('fs').unlinkSync(tempPath);
        } catch (e) {
          console.error('Failed to clean up temp file:', e);
        }
      }

    } catch (error) {
      console.error(`Retry processing failed for ${documentId}:`, error);
      return {
        success: false,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown retry error'
      };
    }
  }

  /**
   * Get processing status for a document
   */
  static async getProcessingStatus(documentId: string): Promise<{
    document_status: string;
    processing_stage?: string;
    queue_status?: string;
    progress?: number;
    error?: string;
    retry_count?: number;
    chunks_created?: number;
    embeddings_generated?: boolean;
  }> {
    const supabase = createSupabaseServerClient();

    try {
      // Get document info
      const { data: document } = await supabase
        .from('documents')
        .select('status, processing_metadata')
        .eq('id', documentId)
        .single();

      // Get queue info
      const { data: queueItem } = await supabase
        .from('document_processing_queue')
        .select('status, retry_count, error_message')
        .eq('document_id', documentId)
        .single();

      if (!document) {
        throw new Error('Document not found');
      }

      // Calculate progress based on stage
      let progress = 0;
      const stage = document.processing_metadata?.stage;
      
      switch (stage) {
        case 'text_extraction':
          progress = 25;
          break;
        case 'chunking':
          progress = 50;
          break;
        case 'embedding_generation':
          progress = 75;
          break;
        case 'completed':
          progress = 100;
          break;
        case 'failed':
          progress = 0;
          break;
        default:
          progress = 0;
      }

      return {
        document_status: document.status,
        processing_stage: stage,
        queue_status: queueItem?.status,
        progress,
        error: document.processing_metadata?.error || queueItem?.error_message,
        retry_count: queueItem?.retry_count,
        chunks_created: document.processing_metadata?.chunks_created,
        embeddings_generated: document.processing_metadata?.embeddings_generated
      };

    } catch (error) {
      console.error(`Failed to get processing status for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel document processing
   */
  static async cancelProcessing(documentId: string): Promise<boolean> {
    const supabase = createSupabaseServerClient();

    try {
      // Update queue status
      await supabase
        .from('document_processing_queue')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_metadata: {
            stage: 'cancelled',
            error: 'Processing cancelled by user',
            cancelled_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      return true;

    } catch (error) {
      console.error(`Failed to cancel processing for ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Clean up failed or cancelled documents
   */
  static async cleanup(): Promise<{
    documentsDeleted: number;
    chunksDeleted: number;
    filesDeleted: number;
  }> {
    const supabase = createSupabaseServerClient();
    let documentsDeleted = 0;
    let chunksDeleted = 0;
    let filesDeleted = 0;

    try {
      // Get documents that have been failed for more than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: failedDocs } = await supabase
        .from('documents')
        .select('id, storage_path')
        .eq('status', 'failed')
        .lt('updated_at', oneDayAgo);

      if (failedDocs && failedDocs.length > 0) {
        for (const doc of failedDocs) {
          try {
            // Delete chunks
            const { error: chunksError } = await supabase
              .from('document_chunks')
              .delete()
              .eq('document_id', doc.id);

            if (!chunksError) {
              chunksDeleted += 1;
            }

            // Delete file from storage
            if (doc.storage_path) {
              const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([doc.storage_path]);

              if (!storageError) {
                filesDeleted += 1;
              }
            }

            // Delete document record
            const { error: docError } = await supabase
              .from('documents')
              .delete()
              .eq('id', doc.id);

            if (!docError) {
              documentsDeleted += 1;
            }

          } catch (error) {
            console.error(`Failed to cleanup document ${doc.id}:`, error);
          }
        }
      }

      console.log(`Cleanup completed: ${documentsDeleted} documents, ${chunksDeleted} chunks, ${filesDeleted} files deleted`);

      return {
        documentsDeleted,
        chunksDeleted,
        filesDeleted
      };

    } catch (error) {
      console.error('Cleanup process failed:', error);
      return {
        documentsDeleted: 0,
        chunksDeleted: 0,
        filesDeleted: 0
      };
    }
  }
}