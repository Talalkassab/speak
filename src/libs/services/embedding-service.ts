import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { openRouterClient, OpenRouterClient } from './openrouter-client';

// Embedding model configurations for different content types and languages
export interface EmbeddingModelConfig {
  name: string;
  dimensions: number;
  maxTokens: number;
  costPerToken: number;
  language: 'ar' | 'en' | 'multilingual';
  contentType: 'general' | 'legal' | 'document' | 'query';
}

// Available embedding models with their configurations
const EMBEDDING_MODELS: Record<string, EmbeddingModelConfig> = {
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    dimensions: 1536,
    maxTokens: 8191,
    costPerToken: 0.0001 / 1000,
    language: 'multilingual',
    contentType: 'general'
  },
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    dimensions: 1536,
    maxTokens: 8191,
    costPerToken: 0.00002 / 1000,
    language: 'multilingual',
    contentType: 'general'
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    dimensions: 3072,
    maxTokens: 8191,
    costPerToken: 0.00013 / 1000,
    language: 'multilingual',
    contentType: 'legal'
  }
};

export interface EmbeddingRequest {
  content: string;
  contentType: 'document' | 'query' | 'law';
  language: 'ar' | 'en';
  metadata?: Record<string, any>;
  cacheKey?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokensUsed: number;
  cost: number;
  processingTimeMs: number;
  qualityScore?: number;
}

export interface BatchEmbeddingRequest {
  items: EmbeddingRequest[];
  batchSize?: number;
  rateLimitMs?: number;
  validateQuality?: boolean;
}

export interface BatchEmbeddingResult {
  results: (EmbeddingResult | { error: string })[];
  totalTokens: number;
  totalCost: number;
  processingTimeMs: number;
  successCount: number;
  errorCount: number;
  qualityStats?: QualityStats;
}

interface QualityStats {
  averageScore: number;
  minScore: number;
  maxScore: number;
  belowThresholdCount: number;
}

// Cache interface for embeddings
interface EmbeddingCache {
  embedding: number[];
  model: string;
  timestamp: number;
  hits: number;
}

export class EmbeddingService {
  private openRouterClient: OpenRouterClient;
  private cache = new Map<string, EmbeddingCache>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 10000;

  constructor() {
    this.openRouterClient = openRouterClient;
  }

  /**
   * Select optimal embedding model based on content type and language
   */
  private selectModel(contentType: string, language: string): EmbeddingModelConfig {
    // For legal content, use the highest quality model
    if (contentType === 'law') {
      return EMBEDDING_MODELS['text-embedding-3-large'];
    }

    // For Arabic-heavy content, use multilingual model
    if (language === 'ar') {
      return EMBEDDING_MODELS['text-embedding-ada-002'];
    }

    // For general content, use cost-effective model
    return EMBEDDING_MODELS['text-embedding-3-small'];
  }

  /**
   * Preprocess content for optimal embedding generation
   */
  private preprocessContent(content: string, language: 'ar' | 'en'): string {
    let processed = content;

    // Arabic-specific preprocessing
    if (language === 'ar') {
      processed = this.preprocessArabicText(processed);
    }

    // General preprocessing
    processed = processed
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n]+/g, '\n') // Normalize line breaks
      .substring(0, 8000); // Truncate to safe token limit

    return processed;
  }

  /**
   * Arabic text preprocessing for better embeddings
   */
  private preprocessArabicText(text: string): string {
    return text
      .normalize('NFKC') // Unicode normalization
      .replace(/[\u064B-\u065F]/g, '') // Remove diacritics
      .replace(/\u0640/g, '') // Remove tatweel (kashida)
      .replace(/[\u200B-\u200F\u202A-\u202E]/g, '') // Remove zero-width characters
      .replace(/ي/g, 'ى') // Normalize Yaa
      .replace(/ء/g, 'أ') // Normalize Hamza
      .trim();
  }

  /**
   * Generate cache key for embedding request
   */
  private generateCacheKey(request: EmbeddingRequest, model: string): string {
    const contentHash = Buffer.from(request.content).toString('base64').substring(0, 32);
    return `${model}:${request.contentType}:${request.language}:${contentHash}`;
  }

  /**
   * Check and manage embedding cache
   */
  private getCachedEmbedding(cacheKey: string): EmbeddingResult | null {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update hit count
    cached.hits++;

    return {
      embedding: cached.embedding,
      model: cached.model,
      dimensions: cached.embedding.length,
      tokensUsed: 0, // Cached, no tokens used
      cost: 0,
      processingTimeMs: 0
    };
  }

  /**
   * Cache embedding result
   */
  private cacheEmbedding(cacheKey: string, result: EmbeddingResult): void {
    // Manage cache size
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove least recently used entries
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.hits - b.hits);
      
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.1));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    this.cache.set(cacheKey, {
      embedding: result.embedding,
      model: result.model,
      timestamp: Date.now(),
      hits: 1
    });
  }

  /**
   * Validate embedding quality
   */
  private validateEmbeddingQuality(
    embedding: number[],
    content: string,
    language: 'ar' | 'en'
  ): number {
    // Basic quality checks
    let score = 1.0;

    // Check for zero vectors (indicates poor embedding)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude < 0.1) {
      score -= 0.5;
    }

    // Check for excessive sparsity
    const nonZeroCount = embedding.filter(val => Math.abs(val) > 0.001).length;
    const sparsityRatio = nonZeroCount / embedding.length;
    if (sparsityRatio < 0.1) {
      score -= 0.3;
    }

    // Content length quality factor
    const contentLength = content.length;
    if (contentLength < 50) {
      score -= 0.2; // Penalty for very short content
    }

    // Language-specific quality checks
    if (language === 'ar') {
      // Check for proper Arabic content
      const arabicCharCount = (content.match(/[\u0600-\u06FF]/g) || []).length;
      if (arabicCharCount / content.length < 0.1) {
        score -= 0.2; // Content might not be properly Arabic
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate single embedding with optimization
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    try {
      // Select optimal model
      const modelConfig = this.selectModel(request.contentType, request.language);
      
      // Check cache first
      const cacheKey = request.cacheKey || this.generateCacheKey(request, modelConfig.name);
      const cached = this.getCachedEmbedding(cacheKey);
      if (cached) {
        return cached;
      }

      // Preprocess content
      const processedContent = this.preprocessContent(request.content, request.language);
      
      if (processedContent.length === 0) {
        throw new Error('Content is empty after preprocessing');
      }

      // Generate embedding using OpenRouter
      const response = await this.openRouterClient.generateEmbedding(
        processedContent,
        {
          model: modelConfig.name,
          encoding_format: 'float'
        }
      );

      const embedding = Array.isArray(response.data) ? response.data[0] : response.data;
      const tokensUsed = response.usage.totalTokens;
      const cost = response.usage.cost;
      const processingTimeMs = response.processingTime;

      // Validate quality if requested
      const qualityScore = this.validateEmbeddingQuality(
        embedding, 
        processedContent, 
        request.language
      );

      const result: EmbeddingResult = {
        embedding,
        model: modelConfig.name,
        dimensions: modelConfig.dimensions,
        tokensUsed,
        cost,
        processingTimeMs,
        qualityScore
      };

      // Cache the result
      this.cacheEmbedding(cacheKey, result);

      return result;

    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings in batches with rate limiting and error handling
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResult> {
    const {
      items,
      batchSize = 50,
      rateLimitMs = 1000,
      validateQuality = false
    } = request;

    const startTime = Date.now();
    const results: (EmbeddingResult | { error: string })[] = [];
    let totalTokens = 0;
    let totalCost = 0;
    let successCount = 0;
    let errorCount = 0;
    const qualityScores: number[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch items concurrently
      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await this.generateEmbedding(item);
          
          totalTokens += result.tokensUsed;
          totalCost += result.cost;
          successCount++;
          
          if (validateQuality && result.qualityScore !== undefined) {
            qualityScores.push(result.qualityScore);
          }
          
          return result;
        } catch (error) {
          errorCount++;
          console.error(`Error processing item ${i + index}:`, error);
          return { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting between batches
      if (i + batchSize < items.length && rateLimitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, rateLimitMs));
      }
    }

    const processingTimeMs = Date.now() - startTime;

    // Calculate quality statistics
    let qualityStats: QualityStats | undefined;
    if (qualityScores.length > 0) {
      qualityStats = {
        averageScore: qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length,
        minScore: Math.min(...qualityScores),
        maxScore: Math.max(...qualityScores),
        belowThresholdCount: qualityScores.filter(score => score < 0.7).length
      };
    }

    return {
      results,
      totalTokens,
      totalCost,
      processingTimeMs,
      successCount,
      errorCount,
      qualityStats
    };
  }

  /**
   * Store embeddings in database with metadata
   */
  async storeDocumentEmbeddings(
    documentId: string,
    organizationId: string,
    chunks: Array<{
      chunkText: string;
      chunkIndex: number;
      chunkType: 'title' | 'paragraph' | 'table' | 'list';
      pageNumber?: number;
      sectionTitle?: string;
      language: 'ar' | 'en';
    }>
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      // Prepare embedding requests
      const embeddingRequests: EmbeddingRequest[] = chunks.map(chunk => ({
        content: chunk.chunkText,
        contentType: 'document' as const,
        language: chunk.language,
        metadata: {
          chunkType: chunk.chunkType,
          pageNumber: chunk.pageNumber,
          sectionTitle: chunk.sectionTitle
        }
      }));

      // Generate embeddings in batches
      const batchResult = await this.generateBatchEmbeddings({
        items: embeddingRequests,
        batchSize: 25,
        rateLimitMs: 500,
        validateQuality: true
      });

      // Prepare database records
      const dbRecords = chunks.map((chunk, index) => {
        const embeddingResult = batchResult.results[index];
        
        if ('error' in embeddingResult) {
          console.error(`Failed to generate embedding for chunk ${index}:`, embeddingResult.error);
          return null;
        }

        return {
          id: crypto.randomUUID(),
          organization_id: organizationId,
          document_id: documentId,
          chunk_text: chunk.chunkText,
          chunk_index: chunk.chunkIndex,
          chunk_type: chunk.chunkType,
          page_number: chunk.pageNumber,
          section_title: chunk.sectionTitle,
          embedding: embeddingResult.embedding,
          embedding_model: embeddingResult.model,
          language: chunk.language,
          quality_score: embeddingResult.qualityScore,
          tokens_used: embeddingResult.tokensUsed,
          created_at: new Date().toISOString()
        };
      }).filter(Boolean);

      // Insert embeddings into database
      if (dbRecords.length > 0) {
        const { error } = await supabase
          .from('document_chunks')
          .insert(dbRecords);

        if (error) {
          console.error('Error storing document embeddings:', error);
          throw new Error('Failed to store embeddings in database');
        }
      }

      // Update document processing status
      await supabase
        .from('documents')
        .update({
          processing_metadata: {
            embeddings_generated: true,
            chunks_created: dbRecords.length,
            embedding_model: batchResult.results[0] && 'model' in batchResult.results[0] 
              ? batchResult.results[0].model 
              : 'unknown',
            total_tokens: batchResult.totalTokens,
            total_cost: batchResult.totalCost,
            quality_stats: batchResult.qualityStats
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

    } catch (error) {
      console.error('Error in storeDocumentEmbeddings:', error);
      throw error;
    }
  }

  /**
   * Update embeddings for existing content (versioning support)
   */
  async updateEmbeddings(
    documentId: string,
    organizationId: string,
    newVersion: number = 1
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      // Get document content
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('content, content_language')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        throw new Error('Document not found');
      }

      // Archive old embeddings
      await supabase
        .from('document_chunks')
        .update({ archived: true })
        .eq('document_id', documentId);

      // Generate new embeddings with version tag
      // This would involve re-chunking and re-embedding the content
      // Implementation depends on your chunking strategy

    } catch (error) {
      console.error('Error updating embeddings:', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics for monitoring
   */
  async getEmbeddingStats(organizationId?: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    averageQualityScore: number;
    modelDistribution: Record<string, number>;
    languageDistribution: Record<string, number>;
    totalCost: number;
    processingTimes: {
      average: number;
      median: number;
      p95: number;
    };
  }> {
    const supabase = await createSupabaseServerClient();

    try {
      let query = supabase
        .from('document_chunks')
        .select(`
          quality_score,
          embedding_model,
          language,
          tokens_used,
          created_at,
          documents!inner(organization_id)
        `);

      if (organizationId) {
        query = query.eq('documents.organization_id', organizationId);
      }

      const { data: chunks, error } = await query;

      if (error || !chunks) {
        throw new Error('Failed to fetch embedding statistics');
      }

      // Calculate statistics
      const totalChunks = chunks.length;
      const totalDocuments = new Set(chunks.map(c => c.documents?.organization_id)).size;
      const averageQualityScore = chunks
        .filter(c => c.quality_score !== null)
        .reduce((sum, c) => sum + (c.quality_score || 0), 0) / chunks.length;

      const modelDistribution = chunks.reduce((acc, chunk) => {
        const model = chunk.embedding_model || 'unknown';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const languageDistribution = chunks.reduce((acc, chunk) => {
        const lang = chunk.language || 'unknown';
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalCost = chunks.reduce((sum, chunk) => {
        const tokens = chunk.tokens_used || 0;
        const model = EMBEDDING_MODELS[chunk.embedding_model || 'text-embedding-ada-002'];
        return sum + (tokens * (model?.costPerToken || 0));
      }, 0);

      return {
        totalDocuments,
        totalChunks,
        averageQualityScore,
        modelDistribution,
        languageDistribution,
        totalCost,
        processingTimes: {
          average: 0, // These would need to be stored separately
          median: 0,
          p95: 0
        }
      };

    } catch (error) {
      console.error('Error getting embedding statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old cached embeddings
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}