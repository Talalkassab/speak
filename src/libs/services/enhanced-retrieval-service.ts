import { EmbeddingService } from './embedding-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Advanced retrieval interfaces
export interface RetrievalOptions {
  query: string;
  organizationId: string;
  language: 'ar' | 'en';
  limit?: number;
  semanticThreshold?: number;
  keywordThreshold?: number;
  includeLabourLaw?: boolean;
  documentCategories?: string[];
  contentTypes?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  boostFactors?: BoostFactors;
  diversityMode?: 'balanced' | 'focused' | 'diverse';
}

export interface BoostFactors {
  recency?: number; // 0-2, default 1
  authority?: number; // 0-2, default 1
  category?: number; // 0-2, default 1
  language?: number; // 0-2, default 1
  userFeedback?: number; // 0-2, default 1
}

export interface EnhancedSearchResult {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number;
  documentTitle: string;
  filename: string;
  category?: string;
  pageNumber?: number;
  sectionTitle?: string;
  sourceType: 'document' | 'labor_law';
  language: 'ar' | 'en';
  
  // Enhanced scoring
  semanticScore: number;
  keywordScore: number;
  recencyScore: number;
  authorityScore: number;
  contextScore: number;
  finalScore: number;
  
  // Metadata
  contentType: 'title' | 'paragraph' | 'table' | 'list';
  chunkSize: number;
  qualityScore?: number;
  userFeedbackScore?: number;
  
  // Highlighting
  highlightedText?: string;
  keywordMatches?: string[];
}

export interface SearchAnalytics {
  queryId: string;
  totalResults: number;
  searchTimeMs: number;
  semanticResults: number;
  keywordResults: number;
  laborLawResults: number;
  averageScore: number;
  topCategories: string[];
  languageDistribution: Record<string, number>;
}

export interface RetrievalResult {
  results: EnhancedSearchResult[];
  analytics: SearchAnalytics;
  suggestions?: string[];
  relatedQueries?: string[];
}

export class EnhancedRetrievalService {
  private embeddingService: EmbeddingService;
  private readonly SEMANTIC_WEIGHT = 0.4;
  private readonly KEYWORD_WEIGHT = 0.25;
  private readonly RECENCY_WEIGHT = 0.15;
  private readonly AUTHORITY_WEIGHT = 0.1;
  private readonly CONTEXT_WEIGHT = 0.1;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Perform intelligent hybrid retrieval with advanced ranking
   */
  async performIntelligentRetrieval(options: RetrievalOptions): Promise<RetrievalResult> {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();

    try {
      // 1. Analyze and preprocess query
      const queryAnalysis = await this.analyzeQuery(options.query, options.language);
      
      // 2. Perform multi-strategy search
      const [semanticResults, keywordResults, laborLawResults] = await Promise.all([
        this.performSemanticSearch(options, queryAnalysis),
        this.performKeywordSearch(options, queryAnalysis),
        options.includeLabourLaw ? this.performLaborLawSearch(options, queryAnalysis) : Promise.resolve([])
      ]);

      // 3. Combine and rank results
      const combinedResults = await this.combineAndRankResults(
        semanticResults,
        keywordResults,
        laborLawResults,
        options,
        queryAnalysis
      );

      // 4. Apply diversity and final ranking
      const finalResults = await this.applyDiversityAndFinalRanking(
        combinedResults,
        options
      );

      // 5. Generate analytics
      const analytics = this.generateSearchAnalytics(
        queryId,
        finalResults,
        semanticResults,
        keywordResults,
        laborLawResults,
        Date.now() - startTime
      );

      // 6. Generate suggestions and related queries
      const [suggestions, relatedQueries] = await Promise.all([
        this.generateSuggestions(options.query, options.organizationId, options.language),
        this.generateRelatedQueries(options.query, finalResults, options.language)
      ]);

      return {
        results: finalResults,
        analytics,
        suggestions,
        relatedQueries
      };

    } catch (error) {
      console.error('Error in intelligent retrieval:', error);
      throw new Error('Intelligent retrieval failed');
    }
  }

  /**
   * Analyze query to understand intent and extract key information
   */
  private async analyzeQuery(query: string, language: 'ar' | 'en'): Promise<{
    keywords: string[];
    entities: string[];
    intent: 'question' | 'request' | 'search' | 'comparison';
    complexity: 'simple' | 'moderate' | 'complex';
    domain: 'hr' | 'legal' | 'general';
    sentiment: 'positive' | 'neutral' | 'negative';
    originalQuery: string;
    expandedQuery: string;
  }> {
    const keywords = this.extractKeywords(query, language);
    const entities = this.extractEntities(query, language);
    const intent = this.classifyIntent(query, language);
    const complexity = this.assessComplexity(query);
    const domain = this.identifyDomain(query, language);
    const sentiment = this.analyzeSentiment(query, language);
    
    // Expand query with synonyms and related terms
    const expandedQuery = await this.expandQuery(query, language);

    return {
      keywords,
      entities,
      intent,
      complexity,
      domain,
      sentiment,
      originalQuery: query,
      expandedQuery
    };
  }

  /**
   * Extract keywords from query using language-specific techniques
   */
  private extractKeywords(query: string, language: 'ar' | 'en'): string[] {
    const stopWords = {
      ar: ['في', 'من', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'كيف', 'ماذا', 'أين', 'متى', 'لماذا', 'هل', 'ما'],
      en: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'where', 'when', 'why', 'is', 'are']
    };

    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !stopWords[language].includes(word))
      .filter(word => !/^\d+$/.test(word)); // Remove pure numbers

    // Remove duplicates and return top keywords
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Extract named entities (HR terms, legal concepts, etc.)
   */
  private extractEntities(query: string, language: 'ar' | 'en'): string[] {
    const hrEntities = {
      ar: [
        'راتب', 'مرتب', 'أجر', 'مكافأة', 'علاوة', 'بدل',
        'إجازة', 'غياب', 'عطلة', 'مرض',
        'تأمين', 'تقاعد', 'خدمة',
        'عقد', 'توظيف', 'استقالة', 'فصل',
        'موظف', 'عامل', 'مدير', 'رئيس'
      ],
      en: [
        'salary', 'wage', 'pay', 'bonus', 'allowance', 'benefit',
        'leave', 'vacation', 'sick', 'absence',
        'insurance', 'retirement', 'service',
        'contract', 'employment', 'resignation', 'termination',
        'employee', 'worker', 'manager', 'supervisor'
      ]
    };

    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();

    hrEntities[language].forEach(entity => {
      if (lowerQuery.includes(entity.toLowerCase())) {
        entities.push(entity);
      }
    });

    return entities;
  }

  /**
   * Classify query intent
   */
  private classifyIntent(query: string, language: 'ar' | 'en'): 'question' | 'request' | 'search' | 'comparison' {
    const questionWords = {
      ar: ['كيف', 'ماذا', 'أين', 'متى', 'لماذا', 'هل', 'ما'],
      en: ['how', 'what', 'where', 'when', 'why', 'is', 'are', 'can', 'do', 'does']
    };

    const requestWords = {
      ar: ['أريد', 'أحتاج', 'ساعدني', 'اشرح', 'وضح'],
      en: ['i need', 'i want', 'help me', 'explain', 'show me', 'tell me']
    };

    const comparisonWords = {
      ar: ['مقارنة', 'فرق', 'أفضل', 'أسوأ', 'مقابل'],
      en: ['compare', 'difference', 'better', 'worse', 'versus', 'vs']
    };

    const lowerQuery = query.toLowerCase();

    if (questionWords[language].some(word => lowerQuery.includes(word))) {
      return 'question';
    }
    
    if (requestWords[language].some(word => lowerQuery.includes(word))) {
      return 'request';
    }
    
    if (comparisonWords[language].some(word => lowerQuery.includes(word))) {
      return 'comparison';
    }

    return 'search';
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    const hasConjunctions = /\b(and|or|but|however|while|although|إذا|لكن|ولكن|أو|و)\b/i.test(query);
    const hasMultipleClauses = query.split(/[.,;!?]/).length > 1;

    if (wordCount <= 5 && !hasConjunctions) return 'simple';
    if (wordCount <= 15 && !hasMultipleClauses) return 'moderate';
    return 'complex';
  }

  /**
   * Identify domain of the query
   */
  private identifyDomain(query: string, language: 'ar' | 'en'): 'hr' | 'legal' | 'general' {
    const hrTerms = {
      ar: ['موارد بشرية', 'موظف', 'راتب', 'إجازة', 'تدريب', 'أداء', 'تقييم'],
      en: ['hr', 'employee', 'salary', 'leave', 'training', 'performance', 'evaluation']
    };

    const legalTerms = {
      ar: ['قانون', 'نظام', 'لائحة', 'مادة', 'فقرة', 'حكم', 'قرار'],
      en: ['law', 'legal', 'regulation', 'article', 'clause', 'ruling', 'decision']
    };

    const lowerQuery = query.toLowerCase();

    if (legalTerms[language].some(term => lowerQuery.includes(term))) return 'legal';
    if (hrTerms[language].some(term => lowerQuery.includes(term))) return 'hr';
    return 'general';
  }

  /**
   * Analyze sentiment of the query
   */
  private analyzeSentiment(query: string, language: 'ar' | 'en'): 'positive' | 'neutral' | 'negative' {
    const positiveWords = {
      ar: ['جيد', 'ممتاز', 'رائع', 'مفيد', 'مساعدة', 'شكر'],
      en: ['good', 'excellent', 'great', 'helpful', 'help', 'thank']
    };

    const negativeWords = {
      ar: ['سيء', 'خطأ', 'مشكلة', 'صعوبة', 'فشل', 'خطأ'],
      en: ['bad', 'wrong', 'problem', 'issue', 'error', 'fail']
    };

    const lowerQuery = query.toLowerCase();

    if (negativeWords[language].some(word => lowerQuery.includes(word))) return 'negative';
    if (positiveWords[language].some(word => lowerQuery.includes(word))) return 'positive';
    return 'neutral';
  }

  /**
   * Expand query with synonyms and related terms
   */
  private async expandQuery(query: string, language: 'ar' | 'en'): Promise<string> {
    const synonyms = {
      ar: {
        'راتب': ['مرتب', 'أجر', 'دخل'],
        'إجازة': ['عطلة', 'استراحة'],
        'موظف': ['عامل', 'مستخدم'],
        'شركة': ['مؤسسة', 'منظمة', 'منشأة']
      },
      en: {
        'salary': ['wage', 'pay', 'income'],
        'leave': ['vacation', 'time off'],
        'employee': ['worker', 'staff'],
        'company': ['organization', 'firm', 'business']
      }
    };

    let expandedQuery = query;
    const queryWords = query.toLowerCase().split(/\s+/);

    queryWords.forEach(word => {
      if (synonyms[language][word]) {
        expandedQuery += ' ' + synonyms[language][word].join(' ');
      }
    });

    return expandedQuery;
  }

  /**
   * Perform semantic search with enhanced ranking
   */
  private async performSemanticSearch(
    options: RetrievalOptions,
    queryAnalysis: any
  ): Promise<EnhancedSearchResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Generate query embedding
      const embeddingResult = await this.embeddingService.generateEmbedding({
        content: queryAnalysis.expandedQuery,
        contentType: 'query',
        language: options.language
      });

      // Perform semantic search
      const { data, error } = await supabase
        .rpc('enhanced_semantic_search', {
          query_embedding: `[${embeddingResult.embedding.join(',')}]`,
          match_threshold: options.semanticThreshold || 0.75,
          match_count: options.limit || 20,
          p_organization_id: options.organizationId,
          p_language: options.language,
          p_categories: options.documentCategories || null,
          p_date_from: options.dateRange?.from || null,
          p_date_to: options.dateRange?.to || null
        });

      if (error) {
        console.error('Semantic search error:', error);
        return [];
      }

      // Transform results with enhanced metadata
      return (data || []).map((row: any) => ({
        id: row.chunk_id,
        documentId: row.document_id,
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        documentTitle: row.document_title,
        filename: row.filename,
        category: row.category_name,
        pageNumber: row.page_number,
        sectionTitle: row.section_title,
        sourceType: 'document' as const,
        language: row.language,
        
        semanticScore: row.similarity,
        keywordScore: 0,
        recencyScore: this.calculateRecencyScore(row.created_at),
        authorityScore: this.calculateAuthorityScore(row.category_name, row.document_title),
        contextScore: this.calculateContextScore(row, queryAnalysis),
        finalScore: 0, // Will be calculated later
        
        contentType: row.chunk_type,
        chunkSize: row.chunk_text.length,
        qualityScore: row.quality_score
      }));

    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Perform keyword search with TF-IDF ranking
   */
  private async performKeywordSearch(
    options: RetrievalOptions,
    queryAnalysis: any
  ): Promise<EnhancedSearchResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Build search terms
      const searchTerms = [...queryAnalysis.keywords, ...queryAnalysis.entities];
      const tsQuery = searchTerms.join(' | '); // OR search

      if (!tsQuery.trim()) return [];

      const { data, error } = await supabase
        .from('document_chunks')
        .select(`
          id,
          document_id,
          chunk_text,
          chunk_index,
          chunk_type,
          page_number,
          section_title,
          language,
          quality_score,
          created_at,
          documents!inner (
            id,
            title,
            filename,
            organization_id,
            created_at,
            document_categories (
              name
            )
          )
        `)
        .eq('documents.organization_id', options.organizationId)
        .eq('language', options.language)
        .textSearch('chunk_text', tsQuery)
        .limit(options.limit || 20);

      if (error) {
        console.error('Keyword search error:', error);
        return [];
      }

      // Calculate keyword scores and transform results
      return (data || []).map((row: any) => {
        const keywordScore = this.calculateKeywordScore(row.chunk_text, searchTerms, options.language);
        
        return {
          id: row.id,
          documentId: row.document_id,
          chunkText: row.chunk_text,
          chunkIndex: row.chunk_index,
          documentTitle: row.documents.title,
          filename: row.documents.filename,
          category: row.documents.document_categories?.name,
          pageNumber: row.page_number,
          sectionTitle: row.section_title,
          sourceType: 'document' as const,
          language: row.language,
          
          semanticScore: 0,
          keywordScore,
          recencyScore: this.calculateRecencyScore(row.documents.created_at),
          authorityScore: this.calculateAuthorityScore(row.documents.document_categories?.name, row.documents.title),
          contextScore: this.calculateContextScore(row, queryAnalysis),
          finalScore: 0,
          
          contentType: row.chunk_type,
          chunkSize: row.chunk_text.length,
          qualityScore: row.quality_score,
          highlightedText: this.highlightKeywords(row.chunk_text, searchTerms, options.language),
          keywordMatches: searchTerms.filter(term => 
            row.chunk_text.toLowerCase().includes(term.toLowerCase())
          )
        };
      });

    } catch (error) {
      console.error('Error in keyword search:', error);
      return [];
    }
  }

  /**
   * Perform labor law search
   */
  private async performLaborLawSearch(
    options: RetrievalOptions,
    queryAnalysis: any
  ): Promise<EnhancedSearchResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Generate embedding for labor law search
      const embeddingResult = await this.embeddingService.generateEmbedding({
        content: queryAnalysis.expandedQuery,
        contentType: 'query',
        language: options.language
      });

      const { data, error } = await supabase
        .rpc('match_labor_law_content', {
          query_embedding: `[${embeddingResult.embedding.join(',')}]`,
          match_threshold: 0.70,
          match_count: Math.min(options.limit || 10, 5),
          p_language: options.language
        });

      if (error) {
        console.error('Labor law search error:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.article_id,
        documentId: row.article_id,
        chunkText: options.language === 'ar' ? row.content_ar : row.content_en,
        chunkIndex: 0,
        documentTitle: options.language === 'ar' ? row.title_ar : row.title_en,
        filename: `Labor Law Article ${row.article_number}`,
        category: options.language === 'ar' ? row.category_name_ar : row.category_name_en,
        pageNumber: undefined,
        sectionTitle: `Article ${row.article_number}`,
        sourceType: 'labor_law' as const,
        language: options.language,
        
        semanticScore: row.similarity,
        keywordScore: 0,
        recencyScore: 1.0, // Labor law is always current
        authorityScore: 1.0, // Maximum authority for legal sources
        contextScore: this.calculateLaborLawContextScore(row, queryAnalysis),
        finalScore: 0,
        
        contentType: 'paragraph' as const,
        chunkSize: (options.language === 'ar' ? row.content_ar : row.content_en).length,
        qualityScore: 1.0
      }));

    } catch (error) {
      console.error('Error in labor law search:', error);
      return [];
    }
  }

  /**
   * Calculate keyword score using TF-IDF approach
   */
  private calculateKeywordScore(text: string, keywords: string[], language: 'ar' | 'en'): number {
    const lowerText = text.toLowerCase();
    const textWords = lowerText.split(/\s+/);
    const textLength = textWords.length;
    
    let score = 0;
    
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      const occurrences = (lowerText.match(new RegExp(lowerKeyword, 'g')) || []).length;
      
      if (occurrences > 0) {
        // TF (Term Frequency)
        const tf = occurrences / textLength;
        
        // Simple IDF approximation (would need document corpus for real IDF)
        const idf = Math.log(1000 / (occurrences + 1));
        
        score += tf * idf;
      }
    });

    return Math.min(score, 1.0); // Normalize to 0-1
  }

  /**
   * Calculate recency score based on document age
   */
  private calculateRecencyScore(createdAt: string): number {
    const now = new Date();
    const docDate = new Date(createdAt);
    const ageInDays = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay: newer documents get higher scores
    return Math.exp(-ageInDays / 365); // Half-life of 1 year
  }

  /**
   * Calculate authority score based on document category and title
   */
  private calculateAuthorityScore(category?: string, title?: string): number {
    let score = 0.5; // Base score
    
    // High authority categories
    const highAuthorityCategories = [
      'Compliance & Legal', 'الامتثال والقوانين',
      'HR Policies', 'سياسات الموارد البشرية',
      'Employment Contracts', 'عقود العمل'
    ];
    
    if (category && highAuthorityCategories.some(cat => 
      category.toLowerCase().includes(cat.toLowerCase())
    )) {
      score += 0.3;
    }
    
    // Official document indicators
    if (title && (/policy|procedure|regulation|نظام|لائحة|سياسة/i.test(title))) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate context score based on query analysis
   */
  private calculateContextScore(result: any, queryAnalysis: any): number {
    let score = 0.5; // Base score
    
    // Domain relevance
    if (queryAnalysis.domain === 'hr' && result.category?.toLowerCase().includes('hr')) {
      score += 0.2;
    }
    
    if (queryAnalysis.domain === 'legal' && result.category?.toLowerCase().includes('legal')) {
      score += 0.2;
    }
    
    // Entity matching
    const entityMatches = queryAnalysis.entities.filter((entity: string) =>
      result.chunkText.toLowerCase().includes(entity.toLowerCase())
    ).length;
    
    score += (entityMatches / Math.max(queryAnalysis.entities.length, 1)) * 0.3;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate context score for labor law results
   */
  private calculateLaborLawContextScore(result: any, queryAnalysis: any): number {
    let score = 0.7; // Higher base score for legal sources
    
    // Legal domain gets full score
    if (queryAnalysis.domain === 'legal') {
      score = 1.0;
    }
    
    return score;
  }

  /**
   * Highlight keywords in text for better user experience
   */
  private highlightKeywords(text: string, keywords: string[], language: 'ar' | 'en'): string {
    let highlighted = text;
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  }

  /**
   * Combine and rank all search results
   */
  private async combineAndRankResults(
    semanticResults: EnhancedSearchResult[],
    keywordResults: EnhancedSearchResult[],
    laborLawResults: EnhancedSearchResult[],
    options: RetrievalOptions,
    queryAnalysis: any
  ): Promise<EnhancedSearchResult[]> {
    
    // Merge results, avoiding duplicates
    const resultMap = new Map<string, EnhancedSearchResult>();
    
    // Add semantic results
    semanticResults.forEach(result => {
      resultMap.set(result.id, result);
    });
    
    // Merge keyword results with semantic results
    keywordResults.forEach(result => {
      const existing = resultMap.get(result.id);
      if (existing) {
        // Combine scores
        existing.keywordScore = result.keywordScore;
        existing.highlightedText = result.highlightedText;
        existing.keywordMatches = result.keywordMatches;
      } else {
        resultMap.set(result.id, result);
      }
    });
    
    // Add labor law results
    laborLawResults.forEach(result => {
      resultMap.set(result.id, result);
    });
    
    const allResults = Array.from(resultMap.values());
    
    // Calculate final scores with boost factors
    const boostFactors = options.boostFactors || {};
    
    allResults.forEach(result => {
      result.finalScore = (
        result.semanticScore * this.SEMANTIC_WEIGHT +
        result.keywordScore * this.KEYWORD_WEIGHT +
        result.recencyScore * this.RECENCY_WEIGHT * (boostFactors.recency || 1) +
        result.authorityScore * this.AUTHORITY_WEIGHT * (boostFactors.authority || 1) +
        result.contextScore * this.CONTEXT_WEIGHT
      );
      
      // Apply quality score if available
      if (result.qualityScore && result.qualityScore < 0.7) {
        result.finalScore *= 0.8; // Penalty for low quality
      }
    });
    
    // Sort by final score
    return allResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, options.limit || 20);
  }

  /**
   * Apply diversity and final ranking adjustments
   */
  private async applyDiversityAndFinalRanking(
    results: EnhancedSearchResult[],
    options: RetrievalOptions
  ): Promise<EnhancedSearchResult[]> {
    
    if (options.diversityMode === 'focused') {
      // Return results as-is for focused search
      return results;
    }
    
    if (options.diversityMode === 'diverse') {
      // Implement MMR (Maximal Marginal Relevance) for diversity
      return this.applyMMRDiversification(results, 0.7); // Lambda = 0.7 for balance
    }
    
    // Default balanced approach
    return this.applyBalancedDiversification(results);
  }

  /**
   * Apply MMR diversification
   */
  private applyMMRDiversification(
    results: EnhancedSearchResult[],
    lambda: number = 0.7
  ): EnhancedSearchResult[] {
    if (results.length <= 1) return results;
    
    const diversified: EnhancedSearchResult[] = [];
    const remaining = [...results];
    
    // Select first result (highest relevance)
    diversified.push(remaining.shift()!);
    
    while (remaining.length > 0 && diversified.length < results.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      
      remaining.forEach((candidate, index) => {
        // Relevance score
        const relevance = candidate.finalScore;
        
        // Diversity score (lowest similarity to already selected)
        let maxSimilarity = 0;
        diversified.forEach(selected => {
          const similarity = this.calculateContentSimilarity(candidate, selected);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        });
        
        const diversity = 1 - maxSimilarity;
        const mmrScore = lambda * relevance + (1 - lambda) * diversity;
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = index;
        }
      });
      
      diversified.push(remaining.splice(bestIndex, 1)[0]);
    }
    
    return diversified;
  }

  /**
   * Apply balanced diversification
   */
  private applyBalancedDiversification(results: EnhancedSearchResult[]): EnhancedSearchResult[] {
    // Ensure category diversity in top results
    const diversified: EnhancedSearchResult[] = [];
    const categoryMap = new Map<string, EnhancedSearchResult[]>();
    
    // Group by category
    results.forEach(result => {
      const category = result.category || 'uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(result);
    });
    
    // Distribute results across categories
    const categories = Array.from(categoryMap.keys());
    let categoryIndex = 0;
    
    while (diversified.length < results.length) {
      const category = categories[categoryIndex % categories.length];
      const categoryResults = categoryMap.get(category)!;
      
      if (categoryResults.length > 0) {
        diversified.push(categoryResults.shift()!);
      }
      
      categoryIndex++;
      
      // Remove empty categories
      if (categoryResults.length === 0) {
        categories.splice(categories.indexOf(category), 1);
      }
      
      if (categories.length === 0) break;
    }
    
    return diversified;
  }

  /**
   * Calculate content similarity between two results
   */
  private calculateContentSimilarity(result1: EnhancedSearchResult, result2: EnhancedSearchResult): number {
    // Simple Jaccard similarity based on words
    const words1 = new Set(result1.chunkText.toLowerCase().split(/\s+/));
    const words2 = new Set(result2.chunkText.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Generate search analytics
   */
  private generateSearchAnalytics(
    queryId: string,
    results: EnhancedSearchResult[],
    semanticResults: EnhancedSearchResult[],
    keywordResults: EnhancedSearchResult[],
    laborLawResults: EnhancedSearchResult[],
    searchTimeMs: number
  ): SearchAnalytics {
    
    const categories = results
      .map(r => r.category)
      .filter(Boolean)
      .reduce((acc, cat) => {
        acc[cat!] = (acc[cat!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topCategories = Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    
    const languageDistribution = results.reduce((acc, result) => {
      acc[result.language] = (acc[result.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const averageScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.finalScore, 0) / results.length
      : 0;

    return {
      queryId,
      totalResults: results.length,
      searchTimeMs,
      semanticResults: semanticResults.length,
      keywordResults: keywordResults.length,
      laborLawResults: laborLawResults.length,
      averageScore,
      topCategories,
      languageDistribution
    };
  }

  /**
   * Generate query suggestions based on search results and patterns
   */
  private async generateSuggestions(
    query: string,
    organizationId: string,
    language: 'ar' | 'en'
  ): Promise<string[]> {
    // This would ideally use ML to generate contextual suggestions
    // For now, return template-based suggestions
    
    const suggestions = {
      ar: [
        'كيف يتم احتساب مكافأة نهاية الخدمة؟',
        'ما هي سياسة الإجازات المرضية؟',
        'إجراءات تقديم طلب إجازة سنوية',
        'حقوق الموظف في فترة التجربة',
        'آلية تقييم الأداء السنوي'
      ],
      en: [
        'How to calculate end of service benefits?',
        'What is the sick leave policy?',
        'Annual leave request procedures',
        'Employee rights during probation',
        'Annual performance evaluation process'
      ]
    };

    return suggestions[language].slice(0, 3);
  }

  /**
   * Generate related queries based on search results
   */
  private async generateRelatedQueries(
    query: string,
    results: EnhancedSearchResult[],
    language: 'ar' | 'en'
  ): Promise<string[]> {
    // Analyze common themes in results to generate related queries
    const categories = results.map(r => r.category).filter(Boolean);
    const uniqueCategories = [...new Set(categories)];
    
    // Generate related queries based on categories found
    const relatedQueries: string[] = [];
    
    uniqueCategories.slice(0, 3).forEach(category => {
      if (language === 'ar') {
        relatedQueries.push(`المزيد عن ${category}`);
      } else {
        relatedQueries.push(`More about ${category}`);
      }
    });

    return relatedQueries;
  }
}