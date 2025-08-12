import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { OpenAI } from 'openai';

export interface SearchResult {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number;
  documentTitle: string;
  filename: string;
  category?: string;
  pageNumber?: number;
  sectionTitle?: string;
  relevanceScore: number;
  sourceType: 'document' | 'labor_law';
  language: 'ar' | 'en';
}

export interface LaborLawResult {
  id: string;
  articleNumber: string;
  title: string;
  content: string;
  summary?: string;
  category: string;
  relevanceScore: number;
  language: 'ar' | 'en';
}

export interface HybridSearchParams {
  query: string;
  organizationId: string;
  language: 'ar' | 'en';
  limit?: number;
  threshold?: number;
  includeLabourLaw?: boolean;
  documentCategories?: string[];
  contentTypes?: string[];
}

export class VectorSearchService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate query embedding for semantic search
   */
  private async generateQueryEmbedding(
    query: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<number[]> {
    try {
      // Preprocess query for better embedding quality
      const processedQuery = this.preprocessQuery(query, language);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: processedQuery,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating query embedding:', error);
      throw new Error('Failed to generate query embedding');
    }
  }

  /**
   * Preprocess query for better semantic search results
   */
  private preprocessQuery(query: string, language: 'ar' | 'en'): string {
    // Add HR and labor law context to improve search relevance
    const contextPrefixes = {
      ar: 'استفسار في الموارد البشرية وقانون العمل السعودي: ',
      en: 'HR and Saudi Labor Law query: '
    };

    return `${contextPrefixes[language]}${query.trim()}`;
  }

  /**
   * Perform hybrid semantic + keyword search on organization documents
   */
  async searchOrganizationDocuments(
    params: HybridSearchParams
  ): Promise<SearchResult[]> {
    const supabase = await createSupabaseServerClient();
    const { query, organizationId, language, limit = 10, threshold = 0.75 } = params;

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query, language);
      
      // Build the search query with filters
      let searchQuery = supabase
        .rpc('match_organization_documents', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          match_threshold: threshold,
          match_count: limit,
          p_organization_id: organizationId,
          p_language: language
        });

      // Execute search
      const { data, error } = await searchQuery;
      
      if (error) {
        console.error('Error searching documents:', error);
        throw new Error('Document search failed');
      }

      // Transform results
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
        relevanceScore: row.similarity,
        sourceType: 'document' as const,
        language: row.language || language
      }));

    } catch (error) {
      console.error('Error in document search:', error);
      throw error;
    }
  }

  /**
   * Search Saudi labor law knowledge base
   */
  async searchSaudiLaborLaw(
    query: string,
    language: 'ar' | 'en' = 'ar',
    limit: number = 5,
    threshold: number = 0.70
  ): Promise<LaborLawResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query, language);

      // Search labor law embeddings
      const { data, error } = await supabase
        .rpc('match_labor_law_content', {
          query_embedding: `[${queryEmbedding.join(',')}]`,
          match_threshold: threshold,
          match_count: limit,
          p_language: language
        });

      if (error) {
        console.error('Error searching labor law:', error);
        throw new Error('Labor law search failed');
      }

      // Transform results
      return (data || []).map((row: any) => ({
        id: row.article_id,
        articleNumber: row.article_number,
        title: language === 'ar' ? row.title_ar : row.title_en,
        content: language === 'ar' ? row.content_ar : row.content_en,
        summary: language === 'ar' ? row.summary_ar : row.summary_en,
        category: language === 'ar' ? row.category_name_ar : row.category_name_en,
        relevanceScore: row.similarity,
        language
      }));

    } catch (error) {
      console.error('Error in labor law search:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive hybrid search combining company docs and labor law
   */
  async hybridSearch(params: HybridSearchParams): Promise<{
    documentResults: SearchResult[];
    laborLawResults: LaborLawResult[];
    combinedRelevance: number;
  }> {
    const { includeLabourLaw = true, limit = 10 } = params;
    
    try {
      // Search organization documents
      const documentResults = await this.searchOrganizationDocuments({
        ...params,
        limit: Math.ceil(limit * 0.7) // 70% for company docs
      });

      let laborLawResults: LaborLawResult[] = [];
      
      if (includeLabourLaw) {
        // Search Saudi labor law
        laborLawResults = await this.searchSaudiLaborLaw(
          params.query,
          params.language,
          Math.ceil(limit * 0.3), // 30% for labor law
          params.threshold
        );
      }

      // Calculate combined relevance score
      const avgDocRelevance = documentResults.length > 0 
        ? documentResults.reduce((sum, r) => sum + r.relevanceScore, 0) / documentResults.length
        : 0;
      
      const avgLawRelevance = laborLawResults.length > 0
        ? laborLawResults.reduce((sum, r) => sum + r.relevanceScore, 0) / laborLawResults.length
        : 0;

      const combinedRelevance = (avgDocRelevance + avgLawRelevance) / 2;

      return {
        documentResults,
        laborLawResults,
        combinedRelevance
      };

    } catch (error) {
      console.error('Error in hybrid search:', error);
      throw error;
    }
  }

  /**
   * Keyword search for fallback when semantic search has low relevance
   */
  async keywordSearch(
    query: string,
    organizationId: string,
    language: 'ar' | 'en' = 'ar',
    limit: number = 10
  ): Promise<SearchResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Use PostgreSQL full-text search
      const searchTerms = this.extractKeywords(query, language);
      const tsQuery = searchTerms.join(' | '); // OR search

      const { data, error } = await supabase
        .from('document_chunks')
        .select(`
          id,
          document_id,
          chunk_text,
          chunk_index,
          page_number,
          section_title,
          language,
          documents!inner (
            id,
            title,
            filename,
            organization_id,
            document_categories (
              name
            )
          )
        `)
        .eq('documents.organization_id', organizationId)
        .eq('language', language)
        .textSearch('chunk_text', tsQuery)
        .limit(limit);

      if (error) {
        console.error('Error in keyword search:', error);
        throw new Error('Keyword search failed');
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        documentTitle: row.documents.title,
        filename: row.documents.filename,
        category: row.documents.document_categories?.name,
        pageNumber: row.page_number,
        sectionTitle: row.section_title,
        relevanceScore: 0.5, // Default relevance for keyword search
        sourceType: 'document' as const,
        language: row.language || language
      }));

    } catch (error) {
      console.error('Error in keyword search:', error);
      throw error;
    }
  }

  /**
   * Extract keywords from query for text search
   */
  private extractKeywords(query: string, language: 'ar' | 'en'): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = {
      ar: ['في', 'من', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'كيف', 'ماذا', 'أين'],
      en: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'where']
    };

    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !stopWords[language].includes(word));

    return words.slice(0, 5); // Limit to 5 most important terms
  }

  /**
   * Get related documents based on document content similarity
   */
  async getRelatedDocuments(
    documentId: string,
    organizationId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Get a representative chunk from the source document
      const { data: sourceChunk } = await supabase
        .from('document_chunks')
        .select('embedding, language')
        .eq('document_id', documentId)
        .eq('chunk_index', 0) // Use first chunk as representative
        .single();

      if (!sourceChunk?.embedding) {
        return [];
      }

      // Find similar documents using the source embedding
      const { data, error } = await supabase
        .rpc('match_organization_documents', {
          query_embedding: `[${sourceChunk.embedding.join(',')}]`,
          match_threshold: 0.7,
          match_count: limit + 1, // +1 to exclude source document
          p_organization_id: organizationId,
          p_language: sourceChunk.language
        });

      if (error) {
        throw new Error('Related documents search failed');
      }

      // Filter out the source document and transform results
      return (data || [])
        .filter((row: any) => row.document_id !== documentId)
        .slice(0, limit)
        .map((row: any) => ({
          id: row.chunk_id,
          documentId: row.document_id,
          chunkText: row.chunk_text,
          chunkIndex: row.chunk_index,
          documentTitle: row.document_title,
          filename: row.filename,
          category: row.category_name,
          pageNumber: row.page_number,
          sectionTitle: row.section_title,
          relevanceScore: row.similarity,
          sourceType: 'document' as const,
          language: row.language
        }));

    } catch (error) {
      console.error('Error finding related documents:', error);
      return [];
    }
  }
}

// Create database functions for vector search (add to migration)
export const vectorSearchFunctions = `
-- Function to search organization documents with vector similarity
CREATE OR REPLACE FUNCTION match_organization_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10,
  p_organization_id uuid DEFAULT NULL,
  p_language text DEFAULT 'ar'
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  document_title text,
  filename text,
  category_name text,
  page_number integer,
  section_title text,
  similarity float,
  language text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id as chunk_id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    d.title as document_title,
    d.filename,
    cat.name as category_name,
    dc.page_number,
    dc.section_title,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.language
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  LEFT JOIN document_categories cat ON d.category_id = cat.id
  WHERE 
    dc.organization_id = p_organization_id
    AND dc.language = p_language
    AND d.status = 'completed'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search Saudi labor law content
CREATE OR REPLACE FUNCTION match_labor_law_content(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.70,
  match_count int DEFAULT 5,
  p_language text DEFAULT 'ar'
)
RETURNS TABLE (
  article_id uuid,
  article_number text,
  title_ar text,
  title_en text,
  content_ar text,
  content_en text,
  summary_ar text,
  summary_en text,
  category_name_ar text,
  category_name_en text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    la.id as article_id,
    la.article_number,
    la.title_ar,
    la.title_en,
    la.content_ar,
    la.content_en,
    la.summary_ar,
    la.summary_en,
    cat.name_ar as category_name_ar,
    cat.name_en as category_name_en,
    1 - (le.embedding <=> query_embedding) as similarity
  FROM labor_law_embeddings le
  JOIN labor_law_articles la ON le.article_id = la.id
  JOIN labor_law_categories cat ON la.category_id = cat.id
  WHERE 
    le.language = p_language
    AND la.is_active = true
    AND 1 - (le.embedding <=> query_embedding) > match_threshold
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;