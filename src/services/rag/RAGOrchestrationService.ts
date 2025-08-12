import { EmbeddingGenerationService } from './EmbeddingGenerationService';
import { RetrievalService } from './RetrievalService';
import { ResponseGenerationService, RAGResponse } from './ResponseGenerationService';
import { ContextManagementService, ConversationContext } from './ContextManagementService';
import { supabaseAdmin } from '@/libs/supabase/supabase-admin';

export interface RAGQueryParams {
  query: string;
  organizationId: string;
  conversationId?: string;
  userId?: string;
  language?: 'ar' | 'en';
  maxResults?: number;
  includeContext?: boolean;
}

export interface RAGQueryResult {
  response: RAGResponse;
  conversationId: string;
  messageId: string;
  processingTime: number;
  metadata: {
    documentsRetrieved: number;
    contextUsed: boolean;
    tokensEstimated: number;
  };
}

export interface DocumentProcessingParams {
  documentId: string;
  organizationId: string;
  content: string;
  title?: string;
  documentType?: string;
  language?: 'ar' | 'en';
  metadata?: any;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class RAGOrchestrationService {
  private embeddingService: EmbeddingGenerationService;
  private retrievalService: RetrievalService;
  private responseService: ResponseGenerationService;
  private contextService: ContextManagementService;

  constructor() {
    this.embeddingService = new EmbeddingGenerationService();
    this.retrievalService = new RetrievalService();
    this.responseService = new ResponseGenerationService();
    this.contextService = new ContextManagementService();
  }

  /**
   * Main RAG query processing function
   */
  async processQuery(params: RAGQueryParams): Promise<RAGQueryResult> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        organizationId,
        conversationId,
        userId,
        language = 'ar',
        maxResults = 10,
        includeContext = true,
      } = params;

      // 1. Get or create conversation
      const finalConversationId = conversationId || await this.createConversation(organizationId, userId);

      // 2. Build conversation context if needed
      let context: ConversationContext | null = null;
      if (includeContext) {
        context = await this.contextService.buildConversationContext(finalConversationId);
      }

      // 3. Retrieve relevant content
      const retrievedContent = await this.retrievalService.retrieveRelevantContent(
        query,
        organizationId,
        language,
        maxResults
      );

      // 4. Generate AI response
      const response = await this.responseService.generateResponse(
        query,
        retrievedContent,
        context,
        language
      );

      // 5. Validate response quality
      const isValid = await this.responseService.validateResponse(response);
      if (!isValid) {
        throw new Error('Generated response did not meet quality standards');
      }

      // 6. Store conversation messages
      const messageId = await this.storeConversationMessages(
        finalConversationId,
        query,
        response.answer,
        {
          retrievedSources: retrievedContent.results.length,
          confidence: response.confidence,
          language,
        }
      );

      // 7. Update conversation context
      if (includeContext) {
        await this.contextService.updateContext(finalConversationId, {
          id: messageId,
          role: 'user',
          content: query,
          timestamp: new Date(),
        });
      }

      const processingTime = Date.now() - startTime;

      return {
        response,
        conversationId: finalConversationId,
        messageId,
        processingTime,
        metadata: {
          documentsRetrieved: retrievedContent.results.length,
          contextUsed: includeContext,
          tokensEstimated: await this.estimateResponseTokens(response),
        },
      };
    } catch (error) {
      console.error('Error processing RAG query:', error);
      throw new Error(`RAG query processing failed: ${error}`);
    }
  }

  /**
   * Process and index company documents
   */
  async processDocument(params: DocumentProcessingParams): Promise<void> {
    const {
      documentId,
      organizationId,
      content,
      title,
      documentType = 'policy',
      language = 'ar',
      metadata = {},
      chunkSize = 1000,
      chunkOverlap = 200,
    } = params;

    try {
      // 1. Create document record
      await this.createDocumentRecord(documentId, organizationId, title, documentType, metadata);

      // 2. Split content into chunks
      const chunks = await this.chunkDocument(content, chunkSize, chunkOverlap);

      // 3. Process chunks with embeddings
      const chunksWithMetadata = chunks.map((chunk, index) => ({
        content: chunk,
        chunk_index: index,
        metadata: {
          ...metadata,
          title,
          documentType,
          chunkSize,
        },
      }));

      // 4. Generate embeddings and store
      await this.embeddingService.processCompanyDocument(
        documentId,
        organizationId,
        chunksWithMetadata,
        language
      );

      // 5. Update document status
      await supabaseAdmin
        .from('documents')
        .update({
          status: 'indexed',
          indexed_at: new Date().toISOString(),
          chunk_count: chunks.length,
        })
        .eq('id', documentId);

      console.log(`Successfully processed document ${documentId} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error processing document:', error);
      
      // Mark document as failed
      await supabaseAdmin
        .from('documents')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', documentId);
      
      throw error;
    }
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(documents: DocumentProcessingParams[]): Promise<void> {
    const batchSize = 5; // Process 5 documents at a time
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(doc => this.processDocument(doc))
      );
      
      // Brief pause between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Process Saudi labor law articles
   */
  async processSaudiLawData(articles: Array<{
    article_number: string;
    title_ar: string;
    title_en: string;
    content_ar: string;
    content_en: string;
    category: string;
  }>): Promise<void> {
    try {
      console.log(`Processing ${articles.length} Saudi labor law articles...`);
      
      for (const article of articles) {
        await this.embeddingService.processSaudiLawArticle(article);
        
        // Brief pause to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('Successfully processed all Saudi labor law articles');
    } catch (error) {
      console.error('Error processing Saudi law data:', error);
      throw error;
    }
  }

  /**
   * Search functionality for testing and debugging
   */
  async searchDocuments(
    query: string,
    organizationId: string,
    language: 'ar' | 'en' = 'ar',
    limit: number = 10
  ): Promise<any> {
    return await this.retrievalService.retrieveRelevantContent(
      query,
      organizationId,
      language,
      limit
    );
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get conversation history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get system statistics
   */
  async getSystemStats(organizationId?: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalConversations: number;
    totalMessages: number;
    saudiLawArticles: number;
  }> {
    const stats = await Promise.all([
      this.getDocumentCount(organizationId),
      this.getChunkCount(organizationId),
      this.getConversationCount(organizationId),
      this.getMessageCount(organizationId),
      this.getSaudiLawCount(),
    ]);

    return {
      totalDocuments: stats[0],
      totalChunks: stats[1],
      totalConversations: stats[2],
      totalMessages: stats[3],
      saudiLawArticles: stats[4],
    };
  }

  // Private helper methods

  private async createConversation(organizationId: string, userId?: string): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data.id;
  }

  private async createDocumentRecord(
    documentId: string,
    organizationId: string,
    title?: string,
    documentType?: string,
    metadata?: any
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('documents')
      .insert({
        id: documentId,
        organization_id: organizationId,
        title: title || 'Untitled Document',
        document_type: documentType || 'policy',
        status: 'processing',
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to create document record: ${error.message}`);
    }
  }

  private async chunkDocument(
    content: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<string[]> {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + chunkSize, content.length);
      let chunk = content.slice(startIndex, endIndex);

      // Try to break at sentence boundaries
      if (endIndex < content.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > chunkSize * 0.5) {
          chunk = chunk.slice(0, breakPoint + 1);
          startIndex = startIndex + breakPoint + 1;
        } else {
          startIndex = endIndex - chunkOverlap;
        }
      } else {
        startIndex = endIndex;
      }

      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  private async storeConversationMessages(
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    metadata: any
  ): Promise<string> {
    const messages = [
      {
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMessage,
        metadata,
        created_at: new Date().toISOString(),
      },
    ];

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert(messages)
      .select('id');

    if (error) {
      throw new Error(`Failed to store messages: ${error.message}`);
    }

    return data[1].id; // Return assistant message ID
  }

  private async estimateResponseTokens(response: RAGResponse): Promise<number> {
    const text = response.answer + (response.reasoning || '') + response.recommendations?.join(' ');
    return Math.ceil(text.length / 4); // Rough estimation
  }

  // Statistics helper methods
  private async getDocumentCount(organizationId?: string): Promise<number> {
    let query = supabaseAdmin.from('documents').select('*', { count: 'exact', head: true });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { count } = await query;
    return count || 0;
  }

  private async getChunkCount(organizationId?: string): Promise<number> {
    let query = supabaseAdmin.from('document_chunks').select('*', { count: 'exact', head: true });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { count } = await query;
    return count || 0;
  }

  private async getConversationCount(organizationId?: string): Promise<number> {
    let query = supabaseAdmin.from('conversations').select('*', { count: 'exact', head: true });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { count } = await query;
    return count || 0;
  }

  private async getMessageCount(organizationId?: string): Promise<number> {
    let query = supabaseAdmin.from('messages').select('conversation_id', { count: 'exact', head: true });
    if (organizationId) {
      query = query.in('conversation_id', 
        supabaseAdmin.from('conversations').select('id').eq('organization_id', organizationId)
      );
    }
    const { count } = await query;
    return count || 0;
  }

  private async getSaudiLawCount(): Promise<number> {
    const { count } = await supabaseAdmin
      .from('saudi_labor_law_articles')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }
}

// Export singleton instance
export const ragOrchestrationService = new RAGOrchestrationService();