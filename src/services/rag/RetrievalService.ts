import { supabaseAdmin } from '@/libs/supabase/supabase-admin';
import { EmbeddingGenerationService } from './EmbeddingGenerationService';

interface SearchParams {
  organizationId: string;
  queryEmbedding: number[];
  query: string;
  language: 'ar' | 'en';
  limit: number;
}

interface LawSearchParams {
  queryEmbedding: number[];
  query: string;
  language: 'ar' | 'en';
  limit: number;
}

export interface SearchResult {
  id: string;
  content: string;
  title?: string;
  score: number;
  source: 'company' | 'saudi_law';
  metadata?: any;
  article_number?: string;
}

export interface RetrievalResult {
  results: SearchResult[];
  companyDocCount: number;
  laborLawCount: number;
  totalRelevanceScore: number;
}

export class RetrievalService {
  private embeddingService: EmbeddingGenerationService;
  private similarityThreshold = 0.7;
  private maxResults = 20;

  constructor() {
    this.embeddingService = new EmbeddingGenerationService();
  }

  /**
   * Main retrieval function combining company docs and Saudi labor law
   */
  async retrieveRelevantContent(
    query: string,
    organizationId: string,
    language: 'ar' | 'en' = 'ar',
    maxResults: number = 10
  ): Promise<RetrievalResult> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query, language);
      
      // Parallel search for company documents and Saudi labor law
      const [companyResults, lawResults] = await Promise.all([
        this.searchCompanyDocuments({
          organizationId,
          queryEmbedding,
          query,
          language,
          limit: Math.ceil(maxResults * 0.6), // 60% company docs
        }),
        this.searchSaudiLaborLaw({
          queryEmbedding,
          query,
          language,
          limit: Math.ceil(maxResults * 0.4), // 40% labor law
        }),
      ]);
      
      // Rank and combine results
      const combinedResults = await this.rankAndCombineResults(
        companyResults,
        lawResults,
        query,
        language
      );
      
      return {
        results: combinedResults.slice(0, maxResults),
        companyDocCount: companyResults.length,
        laborLawCount: lawResults.length,
        totalRelevanceScore: combinedResults
          .slice(0, maxResults)
          .reduce((sum, r) => sum + r.score, 0),
      };
    } catch (error) {
      console.error('Error retrieving relevant content:', error);
      throw new Error(`Retrieval failed: ${error}`);
    }
  }

  /**
   * Search company documents with hybrid approach
   */
  private async searchCompanyDocuments(params: SearchParams): Promise<SearchResult[]> {
    const { organizationId, queryEmbedding, query, language, limit } = params;
    
    try {
      // Vector similarity search
      const vectorResults = await this.vectorSearchCompanyDocs(
        queryEmbedding,
        organizationId,
        language,
        limit * 2
      );
      
      // Keyword search
      const keywordResults = await this.keywordSearchCompanyDocs(
        query,
        organizationId,
        language,
        limit * 2
      );
      
      // Merge and deduplicate results
      return this.mergeSearchResults(vectorResults, keywordResults, limit);
    } catch (error) {
      console.error('Error searching company documents:', error);
      return [];
    }
  }

  /**
   * Vector similarity search for company documents
   */
  private async vectorSearchCompanyDocs(
    queryEmbedding: number[],
    organizationId: string,
    language: 'ar' | 'en',
    limit: number
  ): Promise<SearchResult[]> {
    // Use RPC function for vector similarity search
    const { data, error } = await supabaseAdmin.rpc('search_company_documents', {
      query_embedding: JSON.stringify(queryEmbedding),
      org_id: organizationId,
      lang: language,
      similarity_threshold: this.similarityThreshold,
      match_count: limit,
    });
    
    if (error) {
      console.error('Vector search error:', error);
      return [];
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      score: item.similarity_score,
      source: 'company' as const,
      metadata: item.metadata,
    }));
  }

  /**
   * Keyword search for company documents
   */
  private async keywordSearchCompanyDocs(
    query: string,
    organizationId: string,
    language: 'ar' | 'en',
    limit: number
  ): Promise<SearchResult[]> {
    // Prepare search query based on language
    const searchQuery = language === 'ar' 
      ? this.prepareArabicSearchQuery(query)
      : this.prepareEnglishSearchQuery(query);
    
    const { data, error } = await supabaseAdmin
      .from('document_chunks')
      .select('id, content, metadata')
      .eq('organization_id', organizationId)
      .eq('language', language)
      .textSearch('content', searchQuery, {
        type: 'websearch',
        config: language === 'ar' ? 'arabic' : 'english',
      })
      .limit(limit);
    
    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      score: 0.5, // Default score for keyword matches
      source: 'company' as const,
      metadata: item.metadata,
    }));
  }

  /**
   * Search Saudi labor law articles
   */
  private async searchSaudiLaborLaw(params: LawSearchParams): Promise<SearchResult[]> {
    const { queryEmbedding, query, language, limit } = params;
    
    try {
      // Use RPC function for vector similarity search in Saudi law
      const { data, error } = await supabaseAdmin.rpc('search_saudi_labor_law', {
        query_embedding: JSON.stringify(queryEmbedding),
        lang: language,
        search_query: query,
        similarity_threshold: this.similarityThreshold,
        match_count: limit,
      });
      
      if (error) {
        console.error('Saudi law search error:', error);
        return [];
      }
      
      return (data || []).map((item: any) => ({
        id: item.id,
        content: language === 'ar' ? item.content_ar : item.content_en,
        title: language === 'ar' ? item.title_ar : item.title_en,
        score: item.similarity_score,
        source: 'saudi_law' as const,
        article_number: item.article_number,
        metadata: {
          category: item.category,
          article_number: item.article_number,
        },
      }));
    } catch (error) {
      console.error('Error searching Saudi labor law:', error);
      return [];
    }
  }

  /**
   * Merge and deduplicate search results
   */
  private mergeSearchResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();
    
    // Add vector results (higher priority)
    vectorResults.forEach(result => {
      merged.set(result.id, result);
    });
    
    // Add keyword results (boost score if already exists)
    keywordResults.forEach(result => {
      if (merged.has(result.id)) {
        const existing = merged.get(result.id)!;
        existing.score = Math.min(1.0, existing.score * 1.2); // Boost score
      } else {
        merged.set(result.id, result);
      }
    });
    
    // Sort by score and return top results
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Rank and combine results from different sources
   */
  private async rankAndCombineResults(
    companyResults: SearchResult[],
    lawResults: SearchResult[],
    query: string,
    language: 'ar' | 'en'
  ): Promise<SearchResult[]> {
    // Apply source-specific weights
    const weightedResults = [
      ...companyResults.map(r => ({ ...r, score: r.score * 0.8 })), // Company docs weight
      ...lawResults.map(r => ({ ...r, score: r.score * 1.2 })), // Law articles get priority
    ];
    
    // Additional ranking factors
    const rerankedResults = weightedResults.map(result => {
      let adjustedScore = result.score;
      
      // Boost if query terms appear in content
      const queryTerms = this.extractQueryTerms(query, language);
      const contentLower = result.content.toLowerCase();
      const matchCount = queryTerms.filter(term => 
        contentLower.includes(term.toLowerCase())
      ).length;
      adjustedScore += matchCount * 0.1;
      
      // Boost Saudi law for legal/compliance queries
      if (this.isLegalQuery(query, language) && result.source === 'saudi_law') {
        adjustedScore *= 1.3;
      }
      
      return { ...result, score: Math.min(1.0, adjustedScore) };
    });
    
    // Sort by final score
    return rerankedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Prepare Arabic search query
   */
  private prepareArabicSearchQuery(query: string): string {
    return query
      .replace(/[\u064B-\u065F]/g, '') // Remove diacritics
      .replace(/ة/g, 'ه')               // Normalize ta marbuta
      .replace(/[أإآ]/g, 'ا')           // Normalize alif
      .replace(/ى/g, 'ي')               // Normalize ya
      .trim();
  }

  /**
   * Prepare English search query
   */
  private prepareEnglishSearchQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .trim();
  }

  /**
   * Extract query terms for ranking
   */
  private extractQueryTerms(query: string, language: 'ar' | 'en'): string[] {
    const processed = language === 'ar' 
      ? this.prepareArabicSearchQuery(query)
      : this.prepareEnglishSearchQuery(query);
    
    return processed.split(/\s+/).filter(term => term.length > 2);
  }

  /**
   * Check if query is legal/compliance related
   */
  private isLegalQuery(query: string, language: 'ar' | 'en'): boolean {
    const legalKeywords = language === 'ar'
      ? ['قانون', 'نظام', 'مادة', 'حكم', 'لائحة', 'تنظيم', 'قرار', 'عقوبة']
      : ['law', 'legal', 'regulation', 'article', 'compliance', 'penalty', 'violation'];
    
    const queryLower = query.toLowerCase();
    return legalKeywords.some(keyword => queryLower.includes(keyword));
  }
}

// Export singleton instance
export const retrievalService = new RetrievalService();