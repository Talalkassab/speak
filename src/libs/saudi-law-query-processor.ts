import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Types for the query processor
interface QueryContext {
  query: string;
  language: 'ar' | 'en' | 'auto';
  userId?: string;
  category?: string;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'emergency';
}

interface QueryResult {
  articles: LawArticleResult[];
  scenarios: ScenarioResult[];
  confidence: number;
  category: string;
  language: 'ar' | 'en';
  suggestions: string[];
  totalResults: number;
}

interface LawArticleResult {
  articleId: string;
  articleNumber: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  category: string;
  subcategory?: string;
  lawSource: string;
  similarity: number;
  relevanceScore: number;
}

interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  relevantArticles: LawArticleResult[];
  confidence: number;
}

interface HRCategoryMapping {
  metadata: any;
  hrCategories: Record<string, any>;
  searchPatterns: Record<string, any>;
  emergencyScenarios: Record<string, any>;
}

export class SaudiLawQueryProcessor {
  private supabase;
  private openai;
  private categoryMapping: HRCategoryMapping;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });

    // Load HR category mapping
    this.loadCategoryMapping();
  }

  private loadCategoryMapping(): void {
    try {
      const mappingPath = path.join(process.cwd(), 'src', 'data', 'hr-category-mapping.json');
      this.categoryMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    } catch (error) {
      console.error('Error loading category mapping:', error);
      throw error;
    }
  }

  /**
   * Main query processing method
   */
  async processQuery(context: QueryContext): Promise<QueryResult> {
    console.log(`🔍 Processing query: "${context.query}"`);

    try {
      // 1. Detect language if auto
      const detectedLanguage = context.language === 'auto' 
        ? this.detectLanguage(context.query) 
        : context.language;

      // 2. Analyze query intent and category
      const queryAnalysis = await this.analyzeQueryIntent(context.query, detectedLanguage);

      // 3. Check for emergency scenarios
      const emergencyCheck = this.checkEmergencyScenarios(context.query);

      // 4. Generate embedding for semantic search
      const queryEmbedding = await this.generateEmbedding(context.query);

      // 5. Search law articles using embeddings
      const articleResults = await this.searchLawArticles(
        queryEmbedding,
        detectedLanguage,
        queryAnalysis.category,
        emergencyCheck ? 10 : 5
      );

      // 6. Search scenarios
      const scenarioResults = await this.searchScenarios(
        context.query,
        queryAnalysis.category,
        detectedLanguage
      );

      // 7. Calculate confidence and relevance scores
      const confidence = this.calculateConfidence(articleResults, queryAnalysis);

      // 8. Generate suggestions for follow-up questions
      const suggestions = await this.generateSuggestions(
        context.query,
        queryAnalysis.category,
        detectedLanguage
      );

      // 9. Log query for analytics
      await this.logQuery(context, queryAnalysis, articleResults.length);

      const result: QueryResult = {
        articles: articleResults,
        scenarios: scenarioResults,
        confidence,
        category: queryAnalysis.category,
        language: detectedLanguage,
        suggestions,
        totalResults: articleResults.length
      };

      console.log(`✅ Query processed successfully. Found ${articleResults.length} articles with ${confidence.toFixed(1)}% confidence`);

      return result;

    } catch (error) {
      console.error('❌ Error processing query:', error);
      throw error;
    }
  }

  private detectLanguage(query: string): 'ar' | 'en' {
    // Simple language detection based on Unicode ranges
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F]/;
    return arabicPattern.test(query) ? 'ar' : 'en';
  }

  private async analyzeQueryIntent(query: string, language: 'ar' | 'en') {
    // Check against search patterns and categories
    let bestCategory = 'employment';
    let maxScore = 0;

    for (const [categoryKey, category] of Object.entries(this.categoryMapping.hrCategories)) {
      const score = this.calculateCategoryScore(query, category, language);
      if (score > maxScore) {
        maxScore = score;
        bestCategory = categoryKey;
      }
    }

    // Check search patterns
    let queryType = 'general';
    for (const [patternKey, pattern] of Object.entries(this.categoryMapping.searchPatterns)) {
      const keywords = language === 'ar' ? pattern.keywordsAr : pattern.keywordsEn;
      if (keywords.some((keyword: string) => query.toLowerCase().includes(keyword.toLowerCase()))) {
        queryType = patternKey;
        break;
      }
    }

    return {
      category: bestCategory,
      queryType,
      confidence: maxScore
    };
  }

  private calculateCategoryScore(query: string, category: any, language: 'ar' | 'en'): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Check common questions
    if (category.commonQuestions) {
      for (const question of category.commonQuestions) {
        const questionText = language === 'ar' ? question.questionAr : question.questionEn;
        const questionKeywords = question.searchKeywords || [];

        // Check for keyword matches
        for (const keyword of questionKeywords) {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 2;
          }
        }

        // Check for semantic similarity (simplified)
        if (this.calculateTextSimilarity(queryLower, questionText.toLowerCase()) > 0.5) {
          score += 3;
        }
      }
    }

    return score;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simplified Jaccard similarity
    const set1 = new Set(text1.split(' '));
    const set2 = new Set(text2.split(' '));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private checkEmergencyScenarios(query: string): boolean {
    for (const scenario of Object.values(this.categoryMapping.emergencyScenarios)) {
      if (scenario.triggerKeywords.some((keyword: string) => 
        query.toLowerCase().includes(keyword.toLowerCase()))) {
        return true;
      }
    }
    return false;
  }

  private async searchLawArticles(
    queryEmbedding: number[],
    language: 'ar' | 'en',
    category?: string,
    limit: number = 5
  ): Promise<LawArticleResult[]> {
    const contentTypes = language === 'ar' 
      ? ['content_ar', 'combined_ar'] 
      : ['content_en', 'combined_en'];

    const { data, error } = await this.supabase.rpc('match_saudi_law_articles', {
      query_embedding: queryEmbedding,
      content_types: contentTypes,
      match_threshold: 0.70,
      match_count: limit,
      category_filter: category,
      language_preference: language
    });

    if (error) {
      console.error('Error searching law articles:', error);
      throw error;
    }

    return data.map((article: any) => ({
      articleId: article.article_id,
      articleNumber: article.article_number,
      titleAr: article.title_ar,
      titleEn: article.title_en,
      contentAr: article.content_ar,
      contentEn: article.content_en,
      category: article.category,
      subcategory: article.subcategory,
      lawSource: article.law_source,
      similarity: article.similarity,
      relevanceScore: article.similarity * 100
    }));
  }

  private async searchScenarios(
    query: string,
    category: string,
    language: 'ar' | 'en'
  ): Promise<ScenarioResult[]> {
    // Search for relevant scenarios
    const { data: scenarios, error } = await this.supabase
      .from('hr_scenario_mappings')
      .select(`
        id,
        scenario_name,
        scenario_description,
        scenario_keywords,
        priority,
        scenario_article_mappings (
          relevance_score,
          saudi_law_articles (
            id,
            article_number,
            title_ar,
            title_en,
            content_ar,
            content_en,
            category,
            subcategory,
            law_source
          )
        )
      `)
      .contains('scenario_keywords', [category])
      .limit(3);

    if (error) {
      console.error('Error searching scenarios:', error);
      return [];
    }

    return scenarios.map((scenario: any) => ({
      scenarioId: scenario.id,
      scenarioName: scenario.scenario_name,
      description: scenario.scenario_description,
      relevantArticles: scenario.scenario_article_mappings.map((mapping: any) => ({
        articleId: mapping.saudi_law_articles.id,
        articleNumber: mapping.saudi_law_articles.article_number,
        titleAr: mapping.saudi_law_articles.title_ar,
        titleEn: mapping.saudi_law_articles.title_en,
        contentAr: mapping.saudi_law_articles.content_ar,
        contentEn: mapping.saudi_law_articles.content_en,
        category: mapping.saudi_law_articles.category,
        subcategory: mapping.saudi_law_articles.subcategory,
        lawSource: mapping.saudi_law_articles.law_source,
        similarity: mapping.relevance_score,
        relevanceScore: mapping.relevance_score * 100
      })),
      confidence: scenario.priority * 10
    }));
  }

  private calculateConfidence(articles: LawArticleResult[], analysis: any): number {
    if (articles.length === 0) return 0;

    const avgSimilarity = articles.reduce((sum, article) => sum + article.similarity, 0) / articles.length;
    const categoryConfidence = analysis.confidence / 10;
    const resultCount = Math.min(articles.length / 5, 1);

    return (avgSimilarity * 70 + categoryConfidence * 20 + resultCount * 10) * 100;
  }

  private async generateSuggestions(
    query: string,
    category: string,
    language: 'ar' | 'en'
  ): Promise<string[]> {
    const categoryData = this.categoryMapping.hrCategories[category];
    if (!categoryData || !categoryData.commonQuestions) return [];

    // Return related questions from the same category
    return categoryData.commonQuestions
      .slice(0, 3)
      .map((q: any) => language === 'ar' ? q.questionAr : q.questionEn);
  }

  private async logQuery(
    context: QueryContext,
    analysis: any,
    resultCount: number
  ): Promise<void> {
    try {
      await this.supabase.from('rag_queries').insert({
        user_id: context.userId,
        query_text: context.query,
        response_text: `Found ${resultCount} relevant articles in category: ${analysis.category}`,
        sources_used: { 
          category: analysis.category,
          queryType: analysis.queryType,
          resultCount 
        },
        tokens_used: this.estimateTokens(context.query),
        response_time_ms: Date.now() // This would be calculated properly in a real implementation
      });
    } catch (error) {
      console.error('Error logging query:', error);
      // Don't throw here as logging failure shouldn't break the main functionality
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;

    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get article by number
   */
  async getArticleByNumber(articleNumber: string): Promise<LawArticleResult | null> {
    const { data, error } = await this.supabase
      .from('saudi_law_articles')
      .select('*')
      .eq('article_number', articleNumber)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return {
      articleId: data.id,
      articleNumber: data.article_number,
      titleAr: data.title_ar,
      titleEn: data.title_en,
      contentAr: data.content_ar,
      contentEn: data.content_en,
      category: data.category,
      subcategory: data.subcategory,
      lawSource: data.law_source,
      similarity: 1.0,
      relevanceScore: 100
    };
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(category: string, limit: number = 10): Promise<LawArticleResult[]> {
    const { data, error } = await this.supabase
      .from('saudi_law_articles')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .limit(limit);

    if (error) throw error;

    return data.map(article => ({
      articleId: article.id,
      articleNumber: article.article_number,
      titleAr: article.title_ar,
      titleEn: article.title_en,
      contentAr: article.content_ar,
      contentEn: article.content_en,
      category: article.category,
      subcategory: article.subcategory,
      lawSource: article.law_source,
      similarity: 1.0,
      relevanceScore: 100
    }));
  }

  /**
   * Get query statistics
   */
  async getQueryStats(userId?: string): Promise<any> {
    let query = this.supabase
      .from('rag_queries')
      .select('category:sources_used->category, created_at')
      .not('sources_used', 'is', null);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.limit(1000);

    if (error) throw error;

    // Aggregate statistics
    const stats = {
      totalQueries: data.length,
      categoryCounts: {} as Record<string, number>,
      dailyQueries: {} as Record<string, number>
    };

    data.forEach(record => {
      const category = record.category || 'unknown';
      stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;

      const date = new Date(record.created_at).toISOString().split('T')[0];
      stats.dailyQueries[date] = (stats.dailyQueries[date] || 0) + 1;
    });

    return stats;
  }
}

// Export types for use in other files
export type { QueryContext, QueryResult, LawArticleResult, ScenarioResult };