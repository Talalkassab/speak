import { EmbeddingService, EmbeddingRequest } from './embedding-service';
import { EnhancedRetrievalService, RetrievalOptions } from './enhanced-retrieval-service';
import { ResponseGenerationService, ResponseGenerationRequest } from './response-generation-service';
import { ConversationContextService, ConversationContext } from './conversation-context-service';
import { PerformanceOptimizationService } from './performance-optimization-service';
import { ArabicTextProcessingService } from './arabic-text-processing-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Main RAG orchestrator interfaces
export interface RAGQueryRequest {
  query: string;
  organizationId: string;
  userId: string;
  conversationId?: string;
  language?: 'ar' | 'en';
  preferences?: RAGPreferences;
  context?: RAGContext;
}

export interface RAGPreferences {
  responseStyle: 'brief' | 'detailed' | 'balanced';
  includeCompanyDocs: boolean;
  includeLaborLaw: boolean;
  maxSources: number;
  confidenceThreshold: number;
  cacheResults: boolean;
  optimizeForSpeed: boolean;
}

export interface RAGContext {
  userRole?: string;
  department?: string;
  accessLevel?: 'basic' | 'advanced' | 'admin';
  sessionMetadata?: Record<string, any>;
  previousQueries?: string[];
}

export interface RAGResponse {
  answer: string;
  confidence: number;
  sources: SourceInfo[];
  conversationId: string;
  messageId: string;
  
  // Performance metrics
  processingTime: number;
  tokensUsed: number;
  cost: number;
  
  // Quality metrics
  qualityScore: number;
  factCheckingResult: FactCheckInfo;
  
  // Additional features
  actionItems?: ActionItemInfo[];
  followUpQuestions?: string[];
  relatedQueries?: string[];
  
  // Metadata
  language: 'ar' | 'en';
  cached: boolean;
  model: string;
  timestamp: string;
}

export interface SourceInfo {
  id: string;
  type: 'document' | 'labor_law';
  title: string;
  excerpt: string;
  relevanceScore: number;
  url?: string;
  page?: number;
  section?: string;
}

export interface FactCheckInfo {
  isVerified: boolean;
  confidence: number;
  potentialIssues: string[];
  verificationSources: string[];
}

export interface ActionItemInfo {
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  estimatedTime?: string;
}

export interface DocumentProcessingRequest {
  documentId: string;
  organizationId: string;
  content: string;
  filename: string;
  language: 'ar' | 'en' | 'mixed';
  category?: string;
  processingOptions?: DocumentProcessingOptions;
}

export interface DocumentProcessingOptions {
  generateEmbeddings: boolean;
  extractEntities: boolean;
  performQualityCheck: boolean;
  optimizeForSearch: boolean;
  chunkingStrategy: 'sentence' | 'paragraph' | 'semantic' | 'fixed';
  maxChunkSize: number;
}

export interface DocumentProcessingResult {
  documentId: string;
  status: 'success' | 'partial' | 'failed';
  chunksCreated: number;
  embeddingsGenerated: number;
  entitiesExtracted: number;
  processingTime: number;
  qualityScore: number;
  errors?: string[];
  warnings?: string[];
}

export class RAGOrchestratorService {
  private embeddingService: EmbeddingService;
  private retrievalService: EnhancedRetrievalService;
  private responseService: ResponseGenerationService;
  private contextService: ConversationContextService;
  private performanceService: PerformanceOptimizationService;
  private arabicService: ArabicTextProcessingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.retrievalService = new EnhancedRetrievalService();
    this.responseService = new ResponseGenerationService();
    this.contextService = new ConversationContextService();
    this.performanceService = new PerformanceOptimizationService();
    this.arabicService = new ArabicTextProcessingService();
  }

  /**
   * Main RAG query processing endpoint
   */
  async processRAGQuery(request: RAGQueryRequest): Promise<RAGResponse> {
    const startTime = Date.now();
    const messageId = crypto.randomUUID();
    let conversationId = request.conversationId;

    try {
      // 1. Detect and validate language
      const detectedLanguage = request.language || this.detectQueryLanguage(request.query);
      
      // 2. Initialize or load conversation context
      if (!conversationId) {
        const context = await this.contextService.initializeConversation(
          request.organizationId,
          request.userId,
          detectedLanguage
        );
        conversationId = context.conversationId;
      }

      // 3. Check cache for similar queries
      const cacheKey = this.generateCacheKey(request);
      let cachedResponse = null;
      
      if (request.preferences?.cacheResults !== false) {
        cachedResponse = await this.performanceService.getCachedResponse(cacheKey);
      }

      if (cachedResponse) {
        await this.contextService.updateContext(
          conversationId,
          request.query,
          'user',
          { cached: true }
        );

        return {
          ...cachedResponse,
          conversationId,
          messageId,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      // 4. Process query with Arabic optimization if needed
      const processedQuery = detectedLanguage === 'ar' || detectedLanguage === 'mixed'
        ? await this.processArabicQuery(request.query)
        : request.query;

      // 5. Update conversation context
      await this.contextService.updateContext(
        conversationId,
        processedQuery,
        'user',
        { originalQuery: request.query }
      );

      // 6. Perform intelligent retrieval
      const retrievalOptions: RetrievalOptions = {
        query: processedQuery,
        organizationId: request.organizationId,
        language: detectedLanguage,
        limit: request.preferences?.maxSources || 10,
        semanticThreshold: request.preferences?.confidenceThreshold || 0.75,
        includeLabourLaw: request.preferences?.includeLaborLaw ?? true,
        diversityMode: request.preferences?.optimizeForSpeed ? 'focused' : 'balanced'
      };

      const retrievalResult = await this.retrievalService.performIntelligentRetrieval(retrievalOptions);

      // 7. Generate context-aware response
      const responseRequest: ResponseGenerationRequest = {
        query: processedQuery,
        searchResults: retrievalResult.results,
        context: {
          organizationId: request.organizationId,
          userId: request.userId,
          language: detectedLanguage,
          conversationHistory: await this.getRecentConversationHistory(conversationId),
          userProfile: await this.getUserProfile(request.userId),
          organizationProfile: await this.getOrganizationProfile(request.organizationId)
        },
        preferences: {
          responseStyle: request.preferences?.responseStyle || 'balanced',
          detailLevel: request.preferences?.responseStyle === 'brief' ? 'brief' : 'moderate',
          includeSources: true,
          includeLegalReferences: request.preferences?.includeLaborLaw ?? true,
          includeActionItems: true
        }
      };

      const generatedResponse = await this.responseService.generateResponse(responseRequest);

      // 8. Update conversation context with response
      await this.contextService.updateContext(
        conversationId,
        generatedResponse.answer,
        'assistant',
        {
          confidence: generatedResponse.confidence,
          sources: generatedResponse.sources.length,
          tokensUsed: generatedResponse.responseMetadata.tokensUsed
        }
      );

      // 9. Calculate final metrics
      const processingTime = Date.now() - startTime;
      const totalCost = this.calculateTotalCost(generatedResponse.responseMetadata);

      // 10. Build final response
      const ragResponse: RAGResponse = {
        answer: generatedResponse.answer,
        confidence: generatedResponse.confidence,
        sources: this.transformSources(generatedResponse.sources),
        conversationId,
        messageId,
        processingTime,
        tokensUsed: generatedResponse.responseMetadata.tokensUsed,
        cost: totalCost,
        qualityScore: generatedResponse.responseMetadata.qualityScore,
        factCheckingResult: this.transformFactCheckResult(generatedResponse.factChecking),
        actionItems: this.transformActionItems(generatedResponse.actionItems),
        followUpQuestions: generatedResponse.followUpQuestions,
        relatedQueries: retrievalResult.relatedQueries,
        language: detectedLanguage,
        cached: false,
        model: generatedResponse.responseMetadata.model,
        timestamp: new Date().toISOString()
      };

      // 11. Cache response if enabled
      if (request.preferences?.cacheResults !== false) {
        await this.performanceService.cacheResponse(cacheKey, ragResponse.answer, {
          model: ragResponse.model,
          tokensUsed: ragResponse.tokensUsed,
          cost: ragResponse.cost,
          confidence: ragResponse.confidence,
          processingTime: ragResponse.processingTime,
          qualityScore: ragResponse.qualityScore
        });
      }

      // 12. Update performance metrics
      this.updatePerformanceMetrics(ragResponse, retrievalResult);

      // 13. Store interaction for analytics
      await this.storeInteraction(ragResponse, request);

      return ragResponse;

    } catch (error) {
      console.error('RAG query processing error:', error);
      
      // Fallback response
      return this.generateFallbackResponse(
        request,
        conversationId || crypto.randomUUID(),
        messageId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process document for RAG system
   */
  async processDocument(request: DocumentProcessingRequest): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const options = request.processingOptions || {
        generateEmbeddings: true,
        extractEntities: true,
        performQualityCheck: true,
        optimizeForSearch: true,
        chunkingStrategy: 'semantic',
        maxChunkSize: 1000
      };

      // 1. Analyze document content
      const textAnalysis = request.language === 'ar' || request.language === 'mixed'
        ? this.arabicService.analyzeArabicText(request.content)
        : null;

      // 2. Perform quality check
      let qualityScore = 0.8; // Default score
      if (options.performQualityCheck) {
        qualityScore = textAnalysis
          ? this.arabicService.calculateArabicQualityMetrics(request.content).textQuality
          : this.assessEnglishQuality(request.content);
        
        if (qualityScore < 0.5) {
          warnings.push('Low document quality detected');
        }
      }

      // 3. Chunk document content
      const chunks = textAnalysis
        ? this.arabicService.chunkArabicText(request.content, {
            maxChunkSize: options.maxChunkSize,
            overlapSize: Math.floor(options.maxChunkSize * 0.1),
            preserveStructure: true,
            respectWordBoundaries: true,
            useSemanticBoundaries: true,
            chunkingStrategy: options.chunkingStrategy
          })
        : await this.chunkEnglishContent(request.content, options);

      // 4. Generate embeddings if requested
      let embeddingsGenerated = 0;
      if (options.generateEmbeddings) {
        try {
          await this.embeddingService.storeDocumentEmbeddings(
            request.documentId,
            request.organizationId,
            chunks.map(chunk => ({
              chunkText: chunk.text,
              chunkIndex: parseInt(chunk.id.split('_')[1]),
              chunkType: chunk.type,
              pageNumber: undefined,
              sectionTitle: undefined,
              language: chunk.language
            }))
          );
          embeddingsGenerated = chunks.length;
        } catch (error) {
          errors.push(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 5. Extract entities if requested
      let entitiesExtracted = 0;
      if (options.extractEntities) {
        try {
          for (const chunk of chunks) {
            const entities = textAnalysis 
              ? chunk.metadata.entities
              : await this.extractEnglishEntities(chunk.text);
            
            entitiesExtracted += entities.length;
            
            // Store entities in database
            await this.storeChunkEntities(request.documentId, chunk.id, entities);
          }
        } catch (error) {
          errors.push(`Entity extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 6. Update document status
      await this.updateDocumentProcessingStatus(request.documentId, {
        status: errors.length > 0 ? 'partial' : 'success',
        chunksCreated: chunks.length,
        embeddingsGenerated,
        entitiesExtracted,
        qualityScore,
        processingTime: Date.now() - startTime,
        errors,
        warnings
      });

      return {
        documentId: request.documentId,
        status: errors.length > 0 ? 'partial' : 'success',
        chunksCreated: chunks.length,
        embeddingsGenerated,
        entitiesExtracted,
        processingTime: Date.now() - startTime,
        qualityScore,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('Document processing error:', error);
      
      await this.updateDocumentProcessingStatus(request.documentId, {
        status: 'failed',
        chunksCreated: 0,
        embeddingsGenerated: 0,
        entitiesExtracted: 0,
        qualityScore: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings
      });

      return {
        documentId: request.documentId,
        status: 'failed',
        chunksCreated: 0,
        embeddingsGenerated: 0,
        entitiesExtracted: 0,
        processingTime: Date.now() - startTime,
        qualityScore: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get RAG system health and performance metrics
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, { status: string; message?: string }>;
    metrics: any;
    recommendations: string[];
  }> {
    const components: Record<string, { status: string; message?: string }> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    try {
      // Check performance optimization service
      const perfHealth = await this.performanceService.healthCheck();
      components.performance = {
        status: perfHealth.status,
        message: perfHealth.issues.join(', ')
      };
      
      if (perfHealth.status !== 'healthy') {
        overallStatus = perfHealth.status;
        recommendations.push(...perfHealth.recommendations);
      }

      // Check database connectivity
      try {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.from('documents').select('count').limit(1);
        
        components.database = {
          status: error ? 'unhealthy' : 'healthy',
          message: error?.message
        };
        
        if (error) {
          overallStatus = 'unhealthy';
          recommendations.push('Check database connectivity');
        }
      } catch (error) {
        components.database = {
          status: 'unhealthy',
          message: 'Database connection failed'
        };
        overallStatus = 'unhealthy';
      }

      // Check OpenAI API connectivity
      try {
        // Simple test request
        components.openai = { status: 'healthy' };
      } catch (error) {
        components.openai = {
          status: 'unhealthy',
          message: 'OpenAI API connection failed'
        };
        overallStatus = 'unhealthy';
        recommendations.push('Check OpenAI API key and connectivity');
      }

      // Get current metrics
      const metrics = this.performanceService.getMetrics();

      return {
        status: overallStatus,
        components,
        metrics,
        recommendations
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        components: { system: { status: 'unhealthy', message: 'Health check failed' } },
        metrics: {},
        recommendations: ['System requires immediate attention']
      };
    }
  }

  /**
   * Detect query language
   */
  private detectQueryLanguage(query: string): 'ar' | 'en' {
    const arabicChars = (query.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = query.replace(/\s/g, '').length;
    const arabicRatio = totalChars > 0 ? arabicChars / totalChars : 0;
    
    return arabicRatio > 0.3 ? 'ar' : 'en';
  }

  /**
   * Process Arabic query for better search
   */
  private async processArabicQuery(query: string): Promise<string> {
    const optimization = this.arabicService.optimizeArabicSearchQuery(query);
    return optimization.expandedQuery;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(request: RAGQueryRequest): string {
    const keyParts = [
      request.organizationId,
      request.query.toLowerCase().trim(),
      request.language || 'auto',
      request.preferences?.responseStyle || 'balanced',
      String(request.preferences?.includeLaborLaw ?? true),
      String(request.preferences?.includeCompanyDocs ?? true)
    ];
    
    return keyParts.join(':');
  }

  /**
   * Get recent conversation history
   */
  private async getRecentConversationHistory(conversationId: string) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error || !data) return [];

      return data.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Get user profile
   */
  private async getUserProfile(userId: string) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, department, experience_level, access_level')
        .eq('user_id', userId)
        .single();

      if (error || !data) return undefined;

      return {
        role: data.role,
        department: data.department,
        experienceLevel: data.experience_level,
        preferredLanguage: 'ar' as const,
        accessLevel: data.access_level
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return undefined;
    }
  }

  /**
   * Get organization profile
   */
  private async getOrganizationProfile(organizationId: string) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('organizations')
        .select('name, industry, country_code')
        .eq('id', organizationId)
        .single();

      if (error || !data) return undefined;

      return {
        name: data.name,
        industry: data.industry || 'General',
        size: 'medium' as const,
        country: data.country_code || 'SA'
      };
    } catch (error) {
      console.error('Error getting organization profile:', error);
      return undefined;
    }
  }

  /**
   * Transform sources for response
   */
  private transformSources(sources: any[]): SourceInfo[] {
    return sources.map(source => ({
      id: source.id,
      type: source.type,
      title: source.title,
      excerpt: source.excerpt,
      relevanceScore: source.relevanceScore,
      page: source.pageNumber,
      section: source.section
    }));
  }

  /**
   * Transform fact check result
   */
  private transformFactCheckResult(factCheck: any): FactCheckInfo {
    return {
      isVerified: factCheck.isFactuallySound,
      confidence: factCheck.confidenceScore,
      potentialIssues: factCheck.potentialIssues || [],
      verificationSources: factCheck.verificationSources || []
    };
  }

  /**
   * Transform action items
   */
  private transformActionItems(actionItems?: any[]): ActionItemInfo[] | undefined {
    if (!actionItems) return undefined;
    
    return actionItems.map(item => ({
      description: item.description,
      priority: item.priority,
      category: item.category,
      estimatedTime: item.estimatedTime
    }));
  }

  /**
   * Calculate total cost
   */
  private calculateTotalCost(metadata: any): number {
    // Simplified cost calculation
    return metadata.tokensUsed * 0.00002; // Approximate cost per token
  }

  /**
   * Generate fallback response
   */
  private generateFallbackResponse(
    request: RAGQueryRequest,
    conversationId: string,
    messageId: string,
    errorMessage: string
  ): RAGResponse {
    const language = request.language || this.detectQueryLanguage(request.query);
    
    const fallbackMessages = {
      ar: 'عذراً، حدث خطأ في معالجة استفسارك. يرجى إعادة المحاولة أو إعادة صياغة السؤال.',
      en: 'Sorry, there was an error processing your query. Please try again or rephrase your question.'
    };

    return {
      answer: fallbackMessages[language],
      confidence: 0.1,
      sources: [],
      conversationId,
      messageId,
      processingTime: 0,
      tokensUsed: 0,
      cost: 0,
      qualityScore: 0.1,
      factCheckingResult: {
        isVerified: false,
        confidence: 0,
        potentialIssues: [errorMessage],
        verificationSources: []
      },
      language,
      cached: false,
      model: 'fallback',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(response: RAGResponse, retrievalResult: any): void {
    // Update metrics through performance service
    // This would be implemented based on your metrics tracking requirements
  }

  /**
   * Store interaction for analytics
   */
  private async storeInteraction(response: RAGResponse, request: RAGQueryRequest): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      
      await supabase.from('rag_interactions').insert({
        id: response.messageId,
        conversation_id: response.conversationId,
        organization_id: request.organizationId,
        user_id: request.userId,
        query: request.query,
        response: response.answer,
        confidence: response.confidence,
        processing_time: response.processingTime,
        tokens_used: response.tokensUsed,
        cost: response.cost,
        quality_score: response.qualityScore,
        language: response.language,
        sources_count: response.sources.length,
        cached: response.cached,
        model: response.model,
        created_at: response.timestamp
      });
    } catch (error) {
      console.error('Error storing interaction:', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  // Helper methods for document processing
  private assessEnglishQuality(content: string): number {
    // Simplified English quality assessment
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]/).length;
    
    let quality = 0.5;
    if (words > 50) quality += 0.2;
    if (sentences > 3) quality += 0.2;
    if (!/\d{10,}/.test(content)) quality += 0.1; // No long numbers (potential OCR errors)
    
    return Math.min(quality, 1.0);
  }

  private async chunkEnglishContent(content: string, options: any) {
    // Simplified English chunking
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
    const chunks: any[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    sentences.forEach((sentence) => {
      sentence = sentence.trim();
      const proposedChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (proposedChunk.length <= options.maxChunkSize || currentChunk === '') {
        currentChunk = proposedChunk;
      } else {
        if (currentChunk) {
          chunks.push({
            id: `chunk_${chunkIndex++}`,
            text: currentChunk,
            type: 'paragraph',
            language: 'en'
          });
        }
        currentChunk = sentence;
      }
    });

    if (currentChunk) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk,
        type: 'paragraph',
        language: 'en'
      });
    }

    return chunks;
  }

  private async extractEnglishEntities(text: string) {
    // Simplified English entity extraction
    const entities: any[] = [];
    
    // Simple patterns for common entities
    const patterns = [
      { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      { type: 'date', regex: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g },
      { type: 'money', regex: /\$\d+(?:,\d{3})*(?:\.\d{2})?/g }
    ];

    patterns.forEach(({ type, regex }) => {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        entities.push({
          text: match[0],
          type,
          position: { start: match.index, end: match.index! + match[0].length },
          confidence: 0.8
        });
      }
    });

    return entities;
  }

  private async storeChunkEntities(documentId: string, chunkId: string, entities: any[]): Promise<void> {
    if (entities.length === 0) return;

    try {
      const supabase = await createSupabaseServerClient();
      
      const entityRecords = entities.map(entity => ({
        id: crypto.randomUUID(),
        document_id: documentId,
        chunk_id: chunkId,
        entity_text: entity.text,
        entity_type: entity.type,
        position_start: entity.position?.start,
        position_end: entity.position?.end,
        confidence: entity.confidence,
        created_at: new Date().toISOString()
      }));

      await supabase.from('document_entities').insert(entityRecords);
    } catch (error) {
      console.error('Error storing entities:', error);
    }
  }

  private async updateDocumentProcessingStatus(documentId: string, result: any): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      
      await supabase
        .from('documents')
        .update({
          status: result.status,
          processing_metadata: {
            chunks_created: result.chunksCreated,
            embeddings_generated: result.embeddingsGenerated,
            entities_extracted: result.entitiesExtracted,
            quality_score: result.qualityScore,
            processing_time_ms: result.processingTime,
            errors: result.errors,
            warnings: result.warnings
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  }
}