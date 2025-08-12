import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  QuerySuggestion,
  AutocompleteRequest,
  AutocompleteResponse,
  RelatedQuestionsRequest,
  RelatedQuestionsResponse,
  PopularQueriesRequest,
  PopularQueriesResponse,
  QueryRefinementRequest,
  QueryRefinementResponse,
  QueryTemplate,
  ArabicTextAnalysis,
  PersonalizationData,
  SuggestionAnalytics,
  ExtractedEntity,
  QueryIntent,
  SuggestionType,
  SuggestionCategory,
  QueryAnalysis,
  ArabicProcessingConfig,
  SuggestionAPIResponse
} from '@/types/suggestions';
import { Database } from '@/libs/supabase/types';

export class IntelligentSuggestionService {
  private supabase: ReturnType<typeof createClient<Database>>;
  private openai: OpenAI;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private arabicConfig: ArabicProcessingConfig;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.arabicConfig = {
      enableDialectSupport: true,
      supportedDialects: ['msa', 'gulf', 'saudi'],
      enableTransliteration: true,
      enableDiacriticHandling: true,
      enableRootExtraction: true,
      customDictionary: []
    };
  }

  // Main autocomplete functionality
  async getAutocompleteSuggestions(request: AutocompleteRequest): Promise<SuggestionAPIResponse<AutocompleteResponse>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('autocomplete', request);
    
    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            processingTime: Date.now() - startTime,
            cacheHit: true,
            source: 'cache',
            version: '1.0',
            requestId: this.generateRequestId()
          }
        };
      }

      const suggestions = await this.generateAutocompleteSuggestions(request);
      
      // Cache the results
      this.setCache(cacheKey, suggestions, 300); // 5 minutes TTL

      return {
        success: true,
        data: suggestions,
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'ai',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    } catch (error) {
      console.error('Autocomplete error:', error);
      return {
        success: false,
        data: { suggestions: [], hasMore: false, metadata: { processingTime: 0, language: 'en', totalMatches: 0 } },
        error: {
          code: 'AUTOCOMPLETE_ERROR',
          message: 'Failed to generate autocomplete suggestions',
          messageArabic: 'فشل في توليد اقتراحات الإكمال التلقائي',
          details: error
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'error',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    }
  }

  private async generateAutocompleteSuggestions(request: AutocompleteRequest): Promise<AutocompleteResponse> {
    const { query, language, maxSuggestions, userId, organizationId, context, includePopular, includePersonalized } = request;

    // Analyze the partial query
    const analysis = await this.analyzeQuery(query, language);
    
    // Get suggestions from multiple sources
    const [
      aiSuggestions,
      dbSuggestions,
      popularSuggestions,
      personalizedSuggestions
    ] = await Promise.all([
      this.getAISuggestions(query, language, analysis),
      this.getDatabaseSuggestions(query, organizationId),
      includePopular ? this.getPopularSuggestions(query, organizationId) : [],
      includePersonalized ? this.getPersonalizedSuggestions(query, userId) : []
    ]);

    // Combine and rank suggestions
    const allSuggestions = [
      ...aiSuggestions,
      ...dbSuggestions,
      ...popularSuggestions,
      ...personalizedSuggestions
    ];

    // Deduplicate and score
    const uniqueSuggestions = this.deduplicateAndScore(allSuggestions, query);
    
    // Sort by score and limit
    const topSuggestions = uniqueSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return {
      suggestions: topSuggestions,
      hasMore: uniqueSuggestions.length > maxSuggestions,
      metadata: {
        processingTime: 0,
        language: language === 'both' ? 'both' : language,
        totalMatches: uniqueSuggestions.length
      }
    };
  }

  // AI-powered suggestions using OpenAI
  private async getAISuggestions(query: string, language: string, analysis: QueryAnalysis): Promise<any[]> {
    const systemPrompt = `You are an expert HR consultant specializing in Saudi Arabian labor law and HR practices. 
    Generate intelligent autocomplete suggestions for the partial query: "${query}"
    
    Context:
    - User language preference: ${language}
    - Query clarity: ${analysis.clarity}/10
    - Detected entities: ${analysis.entities.map(e => e.text).join(', ')}
    
    Generate 5-8 relevant completions that:
    1. Complete the user's intent naturally
    2. Are specific to Saudi HR and labor law
    3. Include both Arabic and English if applicable
    4. Cover different aspects of the topic
    5. Vary in complexity (simple to advanced)
    
    Return as JSON array with format:
    {
      "text": "completed query in primary language",
      "textArabic": "completed query in Arabic (if applicable)",
      "category": "labor_law|employment|compensation|etc",
      "confidence": 0.0-1.0,
      "description": "brief description of what this query addresses"
    }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const suggestions = JSON.parse(content);
      return suggestions.map((suggestion: any, index: number) => ({
        text: suggestion.text,
        textArabic: suggestion.textArabic,
        highlightedText: this.highlightMatch(suggestion.text, query),
        highlightedTextArabic: suggestion.textArabic ? this.highlightMatch(suggestion.textArabic, query) : undefined,
        type: 'autocomplete' as SuggestionType,
        score: suggestion.confidence * 0.9, // AI suggestions get high but not perfect score
        category: suggestion.category as SuggestionCategory,
        description: suggestion.description,
        descriptionArabic: suggestion.descriptionArabic
      }));
    } catch (error) {
      console.error('AI suggestions error:', error);
      return [];
    }
  }

  // Database-based suggestions
  private async getDatabaseSuggestions(query: string, organizationId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('query_suggestions')
        .select('*')
        .eq('organization_id', organizationId)
        .or(`text.ilike.%${query}%,text_arabic.ilike.%${query}%`)
        .order('popularity', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Database suggestions error:', error);
        return [];
      }

      return (data || []).map(suggestion => ({
        text: suggestion.text,
        textArabic: suggestion.text_arabic,
        highlightedText: this.highlightMatch(suggestion.text, query),
        highlightedTextArabic: suggestion.text_arabic ? this.highlightMatch(suggestion.text_arabic, query) : undefined,
        type: 'autocomplete' as SuggestionType,
        score: suggestion.popularity / 100, // Normalize popularity to 0-1 score
        category: suggestion.category as SuggestionCategory,
        description: suggestion.description,
        descriptionArabic: suggestion.description_arabic
      }));
    } catch (error) {
      console.error('Database suggestions error:', error);
      return [];
    }
  }

  // Popular suggestions based on organization data
  private async getPopularSuggestions(query: string, organizationId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_messages')
        .select('content')
        .eq('organization_id', organizationId)
        .eq('role', 'user')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return [];

      // Analyze popular patterns
      const queries = data?.map(d => d.content) || [];
      const patterns = this.extractQueryPatterns(queries, query);

      return patterns.map(pattern => ({
        text: pattern,
        textArabic: pattern, // Would need translation service
        highlightedText: this.highlightMatch(pattern, query),
        type: 'popular' as SuggestionType,
        score: 0.7, // Popular suggestions get medium-high score
        category: 'general' as SuggestionCategory,
        description: 'Popular query from your organization',
        descriptionArabic: 'استعلام شائع من مؤسستك'
      }));
    } catch (error) {
      console.error('Popular suggestions error:', error);
      return [];
    }
  }

  // Personalized suggestions based on user history
  private async getPersonalizedSuggestions(query: string, userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_query_history')
        .select('query, category, success_rate')
        .eq('user_id', userId)
        .ilike('query', `%${query}%`)
        .order('frequency', { ascending: false })
        .limit(5);

      if (error) return [];

      return (data || []).map(item => ({
        text: item.query,
        textArabic: item.query, // Would need translation
        highlightedText: this.highlightMatch(item.query, query),
        type: 'contextual' as SuggestionType,
        score: item.success_rate / 100 * 0.8, // Personalized score based on success rate
        category: item.category as SuggestionCategory,
        description: 'Based on your query history',
        descriptionArabic: 'بناءً على تاريخ استعلاماتك'
      }));
    } catch (error) {
      console.error('Personalized suggestions error:', error);
      return [];
    }
  }

  // Related questions functionality
  async getRelatedQuestions(request: RelatedQuestionsRequest): Promise<SuggestionAPIResponse<RelatedQuestionsResponse>> {
    const startTime = Date.now();
    
    try {
      const { currentQuery, conversationHistory, maxSuggestions, userId, organizationId, includeFollowup } = request;

      // Analyze current query to understand context
      const queryAnalysis = await this.analyzeQuery(currentQuery, 'both');
      
      // Get related questions from different sources
      const [aiRelated, semanticRelated, followupQuestions] = await Promise.all([
        this.getAIRelatedQuestions(currentQuery, queryAnalysis, maxSuggestions),
        this.getSemanticRelatedQuestions(currentQuery, organizationId),
        includeFollowup ? this.getFollowupQuestions(conversationHistory, currentQuery) : []
      ]);

      const allQuestions = [...aiRelated, ...semanticRelated, ...followupQuestions];
      const uniqueQuestions = this.deduplicateQuestions(allQuestions);
      const topQuestions = uniqueQuestions.slice(0, maxSuggestions);

      const context = {
        mainTopic: queryAnalysis.entities[0]?.text || 'General HR',
        mainTopicArabic: this.translateToArabic(queryAnalysis.entities[0]?.text || 'الموارد البشرية العامة'),
        relatedTopics: queryAnalysis.entities.slice(1, 4).map(e => e.text),
        suggestedDocuments: await this.getSuggestedDocuments(currentQuery, organizationId)
      };

      return {
        success: true,
        data: {
          questions: topQuestions,
          context
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'ai',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    } catch (error) {
      console.error('Related questions error:', error);
      return {
        success: false,
        data: {
          questions: [],
          context: {
            mainTopic: '',
            mainTopicArabic: '',
            relatedTopics: [],
            suggestedDocuments: []
          }
        },
        error: {
          code: 'RELATED_QUESTIONS_ERROR',
          message: 'Failed to generate related questions',
          messageArabic: 'فشل في توليد الأسئلة المرتبطة'
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'error',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    }
  }

  // AI-powered related questions
  private async getAIRelatedQuestions(currentQuery: string, analysis: QueryAnalysis, maxSuggestions: number): Promise<any[]> {
    const systemPrompt = `Generate ${maxSuggestions} related questions for Saudi HR professionals based on the current query: "${currentQuery}"

    Context:
    - Detected entities: ${analysis.entities.map(e => e.text).join(', ')}
    - Query complexity: ${analysis.complexity}
    - Detected language: ${analysis.detectedLanguage}

    Generate questions that:
    1. Explore different aspects of the topic
    2. Include follow-up clarifications
    3. Cover compliance and legal implications
    4. Suggest practical implementation questions
    5. Include both strategic and tactical perspectives

    Return JSON array with:
    {
      "text": "question in English",
      "textArabic": "question in Arabic",
      "category": "relevant category",
      "relevanceScore": 0.0-1.0,
      "isFollowup": boolean,
      "estimatedComplexity": "simple|medium|complex",
      "relatedEntities": ["entity1", "entity2"]
    }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: currentQuery }
        ],
        temperature: 0.8,
        max_tokens: 1500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      return JSON.parse(content);
    } catch (error) {
      console.error('AI related questions error:', error);
      return [];
    }
  }

  // Query refinement functionality
  async refineQuery(request: QueryRefinementRequest): Promise<SuggestionAPIResponse<QueryRefinementResponse>> {
    const startTime = Date.now();

    try {
      const { originalQuery, context, userId, organizationId, includeTranslation } = request;

      // Analyze the original query
      const analysis = await this.analyzeQuery(originalQuery, 'both');
      
      // Get AI-powered refinements
      const refinements = await this.getAIRefinements(originalQuery, analysis, context);
      
      // Get recommendations
      const recommendations = await this.getRefinementRecommendations(analysis);

      return {
        success: true,
        data: {
          refinements,
          originalAnalysis: analysis,
          recommendations
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'ai',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    } catch (error) {
      console.error('Query refinement error:', error);
      return {
        success: false,
        data: {
          refinements: [],
          originalAnalysis: {} as QueryAnalysis,
          recommendations: []
        },
        error: {
          code: 'REFINEMENT_ERROR',
          message: 'Failed to refine query',
          messageArabic: 'فشل في تحسين الاستعلام'
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'error',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    }
  }

  // Popular queries functionality
  async getPopularQueries(request: PopularQueriesRequest): Promise<SuggestionAPIResponse<PopularQueriesResponse>> {
    const startTime = Date.now();

    try {
      const { organizationId, department, timeframe, category, language, maxResults } = request;

      // Build query conditions
      let query = this.supabase
        .from('popular_queries')
        .select('*')
        .eq('organization_id', organizationId);

      if (department) {
        query = query.eq('department', department);
      }

      if (category) {
        query = query.eq('category', category);
      }

      // Add timeframe filter
      const timeframeDate = this.getTimeframeDate(timeframe);
      query = query.gte('created_at', timeframeDate.toISOString());

      const { data, error } = await query
        .order('frequency', { ascending: false })
        .limit(maxResults);

      if (error) throw error;

      // Get trends and insights
      const [trends, insights] = await Promise.all([
        this.getPopularityTrends(organizationId, timeframe),
        this.getPopularityInsights(organizationId, timeframe)
      ]);

      const queries = (data || []).map(item => ({
        text: item.text,
        textArabic: item.text_arabic || item.text,
        frequency: item.frequency,
        uniqueUsers: item.unique_users,
        avgRating: item.avg_rating,
        category: item.category as SuggestionCategory,
        trending: item.trending || false,
        trendDirection: item.trend_direction || 'stable',
        lastUsed: item.last_used,
        successRate: item.success_rate
      }));

      return {
        success: true,
        data: {
          queries,
          trends,
          insights
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'database',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    } catch (error) {
      console.error('Popular queries error:', error);
      return {
        success: false,
        data: {
          queries: [],
          trends: [],
          insights: {
            topCategories: [],
            peakUsageHours: [],
            seasonalPatterns: [],
            emergingQueries: []
          }
        },
        error: {
          code: 'POPULAR_QUERIES_ERROR',
          message: 'Failed to fetch popular queries',
          messageArabic: 'فشل في جلب الاستعلامات الشائعة'
        },
        metadata: {
          processingTime: Date.now() - startTime,
          cacheHit: false,
          source: 'error',
          version: '1.0',
          requestId: this.generateRequestId()
        }
      };
    }
  }

  // Arabic text analysis
  async analyzeArabicText(text: string): Promise<ArabicTextAnalysis> {
    // This would integrate with Arabic NLP services
    // For now, providing a basic implementation
    
    const systemPrompt = `Analyze this Arabic text for HR context: "${text}"
    
    Provide analysis including:
    1. Normalized text (remove diacritics, standardize)
    2. Detected dialect
    3. Entity extraction
    4. Transliteration
    5. English translation
    6. HR/Legal terms identification
    7. Improvement suggestions

    Return as JSON with proper structure.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No analysis content received');
      }

      const analysis = JSON.parse(content);
      
      return {
        originalText: text,
        normalizedText: analysis.normalizedText || text,
        detectedDialect: analysis.detectedDialect || 'msa',
        confidence: analysis.confidence || 0.8,
        entities: analysis.entities || [],
        transliteration: analysis.transliteration || '',
        translation: analysis.translation || '',
        hrTerms: analysis.hrTerms || [],
        suggestions: analysis.suggestions || []
      };
    } catch (error) {
      console.error('Arabic text analysis error:', error);
      return {
        originalText: text,
        normalizedText: text,
        detectedDialect: 'msa',
        confidence: 0.5,
        entities: [],
        transliteration: text,
        translation: text,
        hrTerms: [],
        suggestions: []
      };
    }
  }

  // Utility methods
  private async analyzeQuery(query: string, language: string): Promise<QueryAnalysis> {
    const systemPrompt = `Analyze this query for clarity, specificity, completeness, and other quality metrics: "${query}"
    Language context: ${language}
    
    Return JSON with:
    {
      "clarity": 0-10,
      "specificity": 0-10, 
      "completeness": 0-10,
      "grammarScore": 0-10,
      "terminologyAccuracy": 0-10,
      "issues": [{"type": "issue_type", "description": "desc", "severity": "low|medium|high"}],
      "detectedLanguage": "ar|en|mixed",
      "entities": [{"text": "entity", "type": "entity_type", "confidence": 0.0-1.0}],
      "complexity": "simple|medium|complex"
    }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.2,
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No analysis received');

      return JSON.parse(content);
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        clarity: 5,
        specificity: 5,
        completeness: 5,
        grammarScore: 7,
        terminologyAccuracy: 6,
        issues: [],
        detectedLanguage: language as any,
        entities: [],
        complexity: 'medium'
      };
    }
  }

  private deduplicateAndScore(suggestions: any[], originalQuery: string): any[] {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      
      // Boost score based on similarity to original query
      const similarity = this.calculateSimilarity(suggestion.text, originalQuery);
      suggestion.score = (suggestion.score + similarity) / 2;
      
      return true;
    });
  }

  private highlightMatch(text: string, query: string): string {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation - could be enhanced with more sophisticated algorithms
    const words1 = text1.toLowerCase().split(' ');
    const words2 = text2.toLowerCase().split(' ');
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private extractQueryPatterns(queries: string[], partial: string): string[] {
    // Extract common patterns from queries that start with the partial string
    return queries
      .filter(q => q.toLowerCase().includes(partial.toLowerCase()))
      .slice(0, 5)
      .map(q => q.trim());
  }

  private generateCacheKey(type: string, request: any): string {
    return `${type}:${JSON.stringify(request)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private translateToArabic(text: string): string {
    // Placeholder - would integrate with translation service
    return text; // Return original for now
  }

  private async getSuggestedDocuments(query: string, organizationId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('title')
        .eq('organization_id', organizationId)
        .textSearch('content', query)
        .limit(5);

      if (error) return [];
      return data?.map(d => d.title) || [];
    } catch {
      return [];
    }
  }

  private deduplicateQuestions(questions: any[]): any[] {
    const seen = new Set();
    return questions.filter(q => {
      const key = q.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async getSemanticRelatedQuestions(query: string, organizationId: string): Promise<any[]> {
    // Placeholder for semantic search implementation
    return [];
  }

  private async getFollowupQuestions(history: any[], currentQuery: string): Promise<any[]> {
    // Placeholder for followup question generation
    return [];
  }

  private async getAIRefinements(query: string, analysis: QueryAnalysis, context: any): Promise<any[]> {
    // Placeholder for AI refinement implementation
    return [];
  }

  private async getRefinementRecommendations(analysis: QueryAnalysis): Promise<any[]> {
    // Placeholder for refinement recommendations
    return [];
  }

  private async getPopularityTrends(organizationId: string, timeframe: string): Promise<any[]> {
    // Placeholder for popularity trends
    return [];
  }

  private async getPopularityInsights(organizationId: string, timeframe: string): Promise<any> {
    // Placeholder for popularity insights
    return {
      topCategories: [],
      peakUsageHours: [],
      seasonalPatterns: [],
      emergingQueries: []
    };
  }

  private getTimeframeDate(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}