import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { OpenAI } from 'openai';
import { VectorSearchService, SearchResult } from './vector-search-service';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';

export interface Document {
  id: string;
  organizationId: string;
  categoryId?: string;
  categoryName?: string;
  title: string;
  description?: string;
  filename: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  content?: string;
  contentLanguage: 'ar' | 'en';
  uploadUrl?: string;
  storagePath?: string;
  version: number;
  parentDocumentId?: string;
  status: 'processing' | 'completed' | 'failed' | 'archived';
  processingMetadata: Record<string, any>;
  tags: string[];
  isPublic: boolean;
  uploadedBy: string;
  uploaderName?: string;
  approvedBy?: string;
  approvedAt?: Date;
  chunkCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number;
  chunkType: 'title' | 'paragraph' | 'table' | 'list';
  pageNumber?: number;
  sectionTitle?: string;
  language: 'ar' | 'en';
  embedding?: number[];
  createdAt: Date;
}

export interface DocumentCategory {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  color: string;
  isSystem: boolean;
  documentCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFilters {
  categoryId?: string;
  status?: 'processing' | 'completed' | 'failed' | 'archived';
  language?: 'ar' | 'en';
  uploadedBy?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  isPublic?: boolean;
}

export interface UploadDocumentParams {
  organizationId: string;
  userId: string;
  file: File;
  title?: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface DocumentSearchParams {
  query: string;
  organizationId: string;
  language?: 'ar' | 'en';
  categoryId?: string;
  limit?: number;
  threshold?: number;
}

export class DocumentService {
  private openai: OpenAI;
  private vectorSearch: VectorSearchService;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.vectorSearch = new VectorSearchService();
  }

  /**
   * Upload and process a new document
   */
  async uploadDocument(params: UploadDocumentParams): Promise<Document> {
    const supabase = await createSupabaseServerClient();

    try {
      // Extract file content based on type
      const content = await this.extractFileContent(params.file);
      const language = this.detectLanguage(content);

      // Create document record
      const documentData = {
        organization_id: params.organizationId,
        category_id: params.categoryId,
        title: params.title || params.file.name.replace(/\.[^/.]+$/, ''),
        description: params.description,
        filename: params.file.name,
        file_size: params.file.size,
        file_type: this.getFileType(params.file.name),
        mime_type: params.file.type,
        content,
        content_language: language,
        tags: params.tags || [],
        is_public: params.isPublic || false,
        uploaded_by: params.userId,
        status: 'processing',
        processing_metadata: {}
      };

      const { data: document, error } = await supabase
        .from('documents')
        .insert(documentData)
        .select(`
          *,
          document_categories (
            name
          ),
          users:uploaded_by (
            email,
            raw_user_meta_data
          )
        `)
        .single();

      if (error) {
        console.error('Error creating document:', error);
        throw new Error('Failed to create document record');
      }

      // Process document in background
      this.processDocumentAsync(document.id, content, language);

      return this.mapDocumentFromDB(document);

    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Get document by ID with permission check
   */
  async getDocument(
    documentId: string,
    organizationId: string,
    userId: string
  ): Promise<Document | null> {
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_categories (
            name
          ),
          users:uploaded_by (
            email,
            raw_user_meta_data
          ),
          _chunk_count:document_chunks(count)
        `)
        .eq('id', documentId)
        .eq('organization_id', organizationId)
        .single();

      if (error || !data) {
        return null;
      }

      // Check access permissions
      if (!data.is_public && data.uploaded_by !== userId) {
        // Check if user has role-based access
        const { data: member } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single();

        if (!member || !['owner', 'admin', 'hr_manager', 'hr_staff'].includes(member.role)) {
          return null;
        }
      }

      return this.mapDocumentFromDB(data);

    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * List documents with filters and pagination
   */
  async listDocuments(
    organizationId: string,
    userId: string,
    filters: DocumentFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    documents: Document[];
    total: number;
    hasMore: boolean;
  }> {
    const supabase = await createSupabaseServerClient();

    try {
      let query = supabase
        .from('documents')
        .select(`
          *,
          document_categories (
            name
          ),
          users:uploaded_by (
            email,
            raw_user_meta_data
          ),
          _chunk_count:document_chunks(count)
        `, { count: 'exact' })
        .eq('organization_id', organizationId);

      // Apply filters
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      } else {
        query = query.neq('status', 'archived');
      }

      if (filters.language) {
        query = query.eq('content_language', filters.language);
      }

      if (filters.uploadedBy) {
        query = query.eq('uploaded_by', filters.uploadedBy);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,filename.ilike.%${filters.search}%`
        );
      }

      // Access control: show public documents or user's own documents
      // Role-based access handled by RLS policies
      if (filters.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }

      // Pagination and ordering
      const offset = (page - 1) * limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error listing documents:', error);
        throw new Error('Failed to list documents');
      }

      const documents = (data || []).map(doc => this.mapDocumentFromDB(doc));
      const total = count || 0;
      const hasMore = total > page * limit;

      return {
        documents,
        total,
        hasMore
      };

    } catch (error) {
      console.error('Error in listDocuments:', error);
      throw error;
    }
  }

  /**
   * Search documents using vector and text search
   */
  async searchDocuments(params: DocumentSearchParams): Promise<SearchResult[]> {
    try {
      const searchResults = await this.vectorSearch.searchOrganizationDocuments({
        query: params.query,
        organizationId: params.organizationId,
        language: params.language || 'ar',
        limit: params.limit || 20,
        threshold: params.threshold || 0.75
      });

      return searchResults;

    } catch (error) {
      console.error('Error searching documents:', error);
      // Fallback to keyword search
      return await this.vectorSearch.keywordSearch(
        params.query,
        params.organizationId,
        params.language || 'ar',
        params.limit || 20
      );
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    organizationId: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      categoryId?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<Document> {
    const supabase = await createSupabaseServerClient();

    try {
      // Check permissions
      const { data: document } = await supabase
        .from('documents')
        .select('uploaded_by')
        .eq('id', documentId)
        .eq('organization_id', organizationId)
        .single();

      if (!document) {
        throw new Error('Document not found');
      }

      // Only owner or admins can update
      if (document.uploaded_by !== userId) {
        const { data: member } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single();

        if (!member || !['owner', 'admin', 'hr_manager'].includes(member.role)) {
          throw new Error('Insufficient permissions to update document');
        }
      }

      // Update document
      const { data: updatedDoc, error } = await supabase
        .from('documents')
        .update({
          title: updates.title,
          description: updates.description,
          category_id: updates.categoryId,
          tags: updates.tags,
          is_public: updates.isPublic,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select(`
          *,
          document_categories (
            name
          ),
          users:uploaded_by (
            email,
            raw_user_meta_data
          ),
          _chunk_count:document_chunks(count)
        `)
        .single();

      if (error || !updatedDoc) {
        throw new Error('Failed to update document');
      }

      return this.mapDocumentFromDB(updatedDoc);

    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete document (soft delete)
   */
  async deleteDocument(
    documentId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      // Check permissions - only owner or admin can delete
      const { data: document } = await supabase
        .from('documents')
        .select('uploaded_by')
        .eq('id', documentId)
        .eq('organization_id', organizationId)
        .single();

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.uploaded_by !== userId) {
        const { data: member } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
          throw new Error('Insufficient permissions to delete document');
        }
      }

      // Soft delete
      const { error } = await supabase
        .from('documents')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) {
        throw new Error('Failed to delete document');
      }

    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Reprocess document for RAG (regenerate embeddings)
   */
  async reprocessDocument(
    documentId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      // Check permissions
      const { data: document } = await supabase
        .from('documents')
        .select('content, content_language')
        .eq('id', documentId)
        .eq('organization_id', organizationId)
        .single();

      if (!document) {
        throw new Error('Document not found');
      }

      // Update status to processing
      await supabase
        .from('documents')
        .update({
          status: 'processing',
          processing_metadata: { reprocessed_at: new Date().toISOString() }
        })
        .eq('id', documentId);

      // Delete existing chunks
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // Reprocess in background
      await this.processDocumentAsync(documentId, document.content, document.content_language);

    } catch (error) {
      console.error('Error reprocessing document:', error);
      throw error;
    }
  }

  /**
   * Get document categories for organization
   */
  async getDocumentCategories(organizationId: string): Promise<DocumentCategory[]> {
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from('document_categories')
        .select(`
          *,
          _document_count:documents(count)
        `)
        .eq('organization_id', organizationId)
        .order('name');

      if (error) {
        throw new Error('Failed to get document categories');
      }

      return (data || []).map(cat => ({
        id: cat.id,
        organizationId: cat.organization_id,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        isSystem: cat.is_system,
        documentCount: cat._document_count?.[0]?.count || 0,
        createdBy: cat.created_by,
        createdAt: new Date(cat.created_at),
        updatedAt: new Date(cat.updated_at)
      }));

    } catch (error) {
      console.error('Error getting document categories:', error);
      throw error;
    }
  }

  /**
   * Create new document category
   */
  async createDocumentCategory(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
    }
  ): Promise<DocumentCategory> {
    const supabase = await createSupabaseServerClient();

    try {
      const { data: category, error } = await supabase
        .from('document_categories')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description,
          color: data.color || '#6B7280',
          created_by: userId
        })
        .select('*')
        .single();

      if (error) {
        throw new Error('Failed to create document category');
      }

      return {
        id: category.id,
        organizationId: category.organization_id,
        name: category.name,
        description: category.description,
        color: category.color,
        isSystem: category.is_system,
        documentCount: 0,
        createdBy: category.created_by,
        createdAt: new Date(category.created_at),
        updatedAt: new Date(category.updated_at)
      };

    } catch (error) {
      console.error('Error creating document category:', error);
      throw error;
    }
  }

  /**
   * Extract content from uploaded file
   */
  private async extractFileContent(file: File): Promise<string> {
    try {
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const data = await pdf(Buffer.from(buffer));
        return data.text;
      }

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }

      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        return await file.text();
      }

      throw new Error(`Unsupported file type: ${file.type}`);

    } catch (error) {
      console.error('Error extracting file content:', error);
      throw new Error('Failed to extract file content');
    }
  }

  /**
   * Detect content language (Arabic/English)
   */
  private detectLanguage(content: string): 'ar' | 'en' {
    // Simple language detection based on Arabic characters
    const arabicCharCount = (content.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = content.replace(/\s/g, '').length;
    
    return totalChars > 0 && (arabicCharCount / totalChars) > 0.3 ? 'ar' : 'en';
  }

  /**
   * Get file type from filename
   */
  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'docx': return 'docx';
      case 'doc': return 'doc';
      case 'txt': return 'text';
      case 'md': return 'markdown';
      default: return 'unknown';
    }
  }

  /**
   * Process document asynchronously (chunking and embedding)
   */
  private async processDocumentAsync(
    documentId: string,
    content: string,
    language: 'ar' | 'en'
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      // Get document info
      const { data: document } = await supabase
        .from('documents')
        .select('organization_id')
        .eq('id', documentId)
        .single();

      if (!document) {
        throw new Error('Document not found');
      }

      // Split content into chunks
      const chunks = await this.splitIntoChunks(content, language);

      // Generate embeddings for chunks
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk, index) => {
          const embedding = await this.generateEmbedding(chunk.text);
          
          return {
            organization_id: document.organization_id,
            document_id: documentId,
            chunk_text: chunk.text,
            chunk_index: index,
            chunk_type: chunk.type,
            page_number: chunk.pageNumber,
            section_title: chunk.sectionTitle,
            language,
            embedding: `[${embedding.join(',')}]`
          };
        })
      );

      // Insert chunks in batches
      const batchSize = 100;
      for (let i = 0; i < chunksWithEmbeddings.length; i += batchSize) {
        const batch = chunksWithEmbeddings.slice(i, i + batchSize);
        await supabase.from('document_chunks').insert(batch);
      }

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'completed',
          processing_metadata: {
            chunks_created: chunks.length,
            processed_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);

    } catch (error) {
      console.error('Error processing document:', error);
      
      // Update document status to failed
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', documentId);
    }
  }

  /**
   * Split content into chunks for embedding
   */
  private async splitIntoChunks(
    content: string,
    language: 'ar' | 'en'
  ): Promise<Array<{
    text: string;
    type: 'title' | 'paragraph' | 'table' | 'list';
    pageNumber?: number;
    sectionTitle?: string;
  }>> {
    const chunks = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentSection = '';
    let pageNumber = 1;

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) continue;

      // Detect if this might be a title/heading
      const isTitle = paragraph.length < 100 && 
                     !paragraph.includes('.') && 
                     paragraph === paragraph.trim();

      if (isTitle && paragraph.length > 0) {
        currentSection = paragraph;
        chunks.push({
          text: paragraph,
          type: 'title' as const,
          pageNumber,
          sectionTitle: paragraph
        });
      } else {
        // Split long paragraphs into smaller chunks
        const maxChunkSize = 500; // characters
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.split(/[.!?]+/);
          let currentChunk = '';
          
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
              chunks.push({
                text: currentChunk.trim(),
                type: 'paragraph' as const,
                pageNumber,
                sectionTitle: currentSection
              });
              currentChunk = sentence;
            } else {
              currentChunk += sentence + '. ';
            }
          }
          
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              type: 'paragraph' as const,
              pageNumber,
              sectionTitle: currentSection
            });
          }
        } else {
          chunks.push({
            text: paragraph,
            type: 'paragraph' as const,
            pageNumber,
            sectionTitle: currentSection
          });
        }
      }

      // Simulate page breaks for long content
      if (chunks.length % 10 === 0) {
        pageNumber++;
      }
    }

    return chunks;
  }

  /**
   * Generate embedding for text chunk
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;

    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Map database row to Document object
   */
  private mapDocumentFromDB(data: any): Document {
    return {
      id: data.id,
      organizationId: data.organization_id,
      categoryId: data.category_id,
      categoryName: data.document_categories?.name,
      title: data.title,
      description: data.description,
      filename: data.filename,
      fileSize: data.file_size,
      fileType: data.file_type,
      mimeType: data.mime_type,
      content: data.content,
      contentLanguage: data.content_language,
      uploadUrl: data.upload_url,
      storagePath: data.storage_path,
      version: data.version,
      parentDocumentId: data.parent_document_id,
      status: data.status,
      processingMetadata: data.processing_metadata || {},
      tags: data.tags || [],
      isPublic: data.is_public,
      uploadedBy: data.uploaded_by,
      uploaderName: data.users?.raw_user_meta_data?.name || data.users?.email,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      chunkCount: data._chunk_count?.[0]?.count || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}