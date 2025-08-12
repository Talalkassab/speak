import { supabaseAdmin } from '@/libs/supabase/supabase-admin';

/**
 * Vector search optimization utilities for better performance and accuracy
 */

export interface VectorSearchConfig {
  indexType: 'ivfflat' | 'hnsw';
  lists?: number; // For ivfflat
  m?: number; // For HNSW
  efConstruction?: number; // For HNSW
  efSearch?: number; // For HNSW search
}

export interface SearchOptimizationResult {
  queryTime: number;
  resultCount: number;
  avgSimilarity: number;
  optimizationApplied: string[];
}

export class VectorSearchOptimizer {
  private static instance: VectorSearchOptimizer;
  private indexConfigs: Map<string, VectorSearchConfig> = new Map();

  public static getInstance(): VectorSearchOptimizer {
    if (!VectorSearchOptimizer.instance) {
      VectorSearchOptimizer.instance = new VectorSearchOptimizer();
    }
    return VectorSearchOptimizer.instance;
  }

  /**
   * Create optimized vector indexes for better search performance
   */
  async createOptimizedIndexes(): Promise<void> {
    try {
      console.log('Creating optimized vector indexes...');

      // Create HNSW index for company documents (better for real-time queries)
      await this.createHNSWIndex('document_chunks', 'embedding', 'idx_document_chunks_embedding_hnsw');

      // Create IVFFlat index for Saudi labor law (better for batch processing)
      await this.createIVFFlatIndex('saudi_labor_law_articles', 'embedding_ar', 'idx_saudi_law_ar_embedding_ivf');
      await this.createIVFFlatIndex('saudi_labor_law_articles', 'embedding_en', 'idx_saudi_law_en_embedding_ivf');

      console.log('Vector indexes created successfully');
    } catch (error) {
      console.error('Error creating vector indexes:', error);
      throw error;
    }
  }

  /**
   * Create HNSW index for high-performance similarity search
   */
  private async createHNSWIndex(
    table: string, 
    column: string, 
    indexName: string,
    m: number = 16,
    efConstruction: number = 64
  ): Promise<void> {
    const query = `
      CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} 
      USING hnsw (${column} vector_cosine_ops) 
      WITH (m = ${m}, ef_construction = ${efConstruction});
    `;

    const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: query });
    
    if (error) {
      console.error(`Error creating HNSW index ${indexName}:`, error);
      throw error;
    }

    this.indexConfigs.set(indexName, {
      indexType: 'hnsw',
      m,
      efConstruction,
    });
  }

  /**
   * Create IVFFlat index for memory-efficient similarity search
   */
  private async createIVFFlatIndex(
    table: string, 
    column: string, 
    indexName: string,
    lists: number = 100
  ): Promise<void> {
    const query = `
      CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} 
      USING ivfflat (${column} vector_cosine_ops) 
      WITH (lists = ${lists});
    `;

    const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: query });
    
    if (error) {
      console.error(`Error creating IVFFlat index ${indexName}:`, error);
      throw error;
    }

    this.indexConfigs.set(indexName, {
      indexType: 'ivfflat',
      lists,
    });
  }

  /**
   * Optimize search parameters based on query characteristics
   */
  async optimizeSearchParameters(
    queryEmbedding: number[],
    searchType: 'company_docs' | 'saudi_law',
    expectedResults: number
  ): Promise<{
    probes?: number;
    efSearch?: number;
    indexHint?: string;
  }> {
    const optimizations: any = {};

    if (searchType === 'company_docs') {
      // HNSW optimizations
      optimizations.efSearch = Math.max(expectedResults * 2, 40);
      optimizations.indexHint = 'USE INDEX (idx_document_chunks_embedding_hnsw)';
    } else {
      // IVFFlat optimizations
      const lists = this.indexConfigs.get('idx_saudi_law_ar_embedding_ivf')?.lists || 100;
      optimizations.probes = Math.min(Math.max(1, Math.floor(lists * 0.1)), 20);
      optimizations.indexHint = 'USE INDEX (idx_saudi_law_ar_embedding_ivf)';
    }

    return optimizations;
  }

  /**
   * Perform optimized vector similarity search
   */
  async performOptimizedSearch(
    queryEmbedding: number[],
    table: string,
    embeddingColumn: string,
    filters: any = {},
    limit: number = 10,
    similarityThreshold: number = 0.7
  ): Promise<{
    results: any[];
    performance: SearchOptimizationResult;
  }> {
    const startTime = Date.now();
    const optimizationApplied: string[] = [];

    try {
      // Determine search type
      const searchType = table === 'document_chunks' ? 'company_docs' : 'saudi_law';
      const searchParams = await this.optimizeSearchParameters(queryEmbedding, searchType, limit);

      // Apply search optimizations
      if (searchParams.efSearch) {
        await supabaseAdmin.rpc('set_hnsw_ef_search', { ef_value: searchParams.efSearch });
        optimizationApplied.push(`HNSW ef_search=${searchParams.efSearch}`);
      }

      if (searchParams.probes) {
        await supabaseAdmin.rpc('set_ivfflat_probes', { probe_count: searchParams.probes });
        optimizationApplied.push(`IVFFlat probes=${searchParams.probes}`);
      }

      // Perform search with optimizations
      const searchQuery = this.buildOptimizedSearchQuery(
        table,
        embeddingColumn,
        filters,
        limit,
        similarityThreshold,
        searchParams.indexHint
      );

      const { data, error } = await supabaseAdmin.rpc('vector_similarity_search', {
        query_embedding: JSON.stringify(queryEmbedding),
        search_query: searchQuery,
      });

      if (error) {
        throw error;
      }

      const results = data || [];
      const queryTime = Date.now() - startTime;
      const avgSimilarity = results.length > 0 
        ? results.reduce((sum: number, r: any) => sum + r.similarity_score, 0) / results.length 
        : 0;

      return {
        results,
        performance: {
          queryTime,
          resultCount: results.length,
          avgSimilarity,
          optimizationApplied,
        },
      };
    } catch (error) {
      console.error('Error in optimized search:', error);
      throw error;
    }
  }

  /**
   * Build optimized SQL query for vector search
   */
  private buildOptimizedSearchQuery(
    table: string,
    embeddingColumn: string,
    filters: any,
    limit: number,
    threshold: number,
    indexHint?: string
  ): string {
    let query = `
      SELECT *, (1 - (${embeddingColumn} <=> $1::vector)) as similarity_score
      FROM ${table}
      ${indexHint || ''}
      WHERE (1 - (${embeddingColumn} <=> $1::vector)) > ${threshold}
    `;

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        query += ` AND ${key} = '${value}'`;
      }
    });

    query += `
      ORDER BY ${embeddingColumn} <=> $1::vector
      LIMIT ${limit}
    `;

    return query;
  }

  /**
   * Analyze search performance and suggest optimizations
   */
  async analyzeSearchPerformance(
    queryHistory: Array<{
      queryTime: number;
      resultCount: number;
      searchType: string;
    }>
  ): Promise<{
    avgQueryTime: number;
    recommendations: string[];
  }> {
    const avgQueryTime = queryHistory.reduce((sum, q) => sum + q.queryTime, 0) / queryHistory.length;
    const recommendations: string[] = [];

    if (avgQueryTime > 1000) {
      recommendations.push('Consider increasing HNSW ef_search for better performance');
    }

    const lowResultQueries = queryHistory.filter(q => q.resultCount < 3).length;
    if (lowResultQueries / queryHistory.length > 0.3) {
      recommendations.push('Lower similarity threshold might improve result count');
    }

    const companyDocQueries = queryHistory.filter(q => q.searchType === 'company_docs');
    if (companyDocQueries.length > 0) {
      const avgCompanyQueryTime = companyDocQueries.reduce((sum, q) => sum + q.queryTime, 0) / companyDocQueries.length;
      if (avgCompanyQueryTime > 800) {
        recommendations.push('Consider optimizing company document index parameters');
      }
    }

    return {
      avgQueryTime,
      recommendations,
    };
  }

  /**
   * Pre-compute and cache frequent query embeddings
   */
  async cacheFrequentQueries(frequentQueries: string[], language: 'ar' | 'en'): Promise<void> {
    // This would integrate with your embedding service
    // to pre-compute embeddings for common queries
    console.log(`Caching ${frequentQueries.length} frequent queries for ${language}`);
    
    // Implementation would store pre-computed embeddings
    // in a cache (Redis, in-memory, etc.) for faster retrieval
  }

  /**
   * Monitor and log search performance
   */
  async logSearchPerformance(
    query: string,
    searchType: string,
    performance: SearchOptimizationResult
  ): Promise<void> {
    // Log performance metrics for analysis
    console.log('Search Performance:', {
      query: query.substring(0, 50) + '...',
      searchType,
      ...performance,
    });

    // In production, you might want to store this in a metrics database
    // or send to a monitoring service like DataDog, New Relic, etc.
  }

  /**
   * Get index statistics
   */
  async getIndexStatistics(): Promise<{
    indexName: string;
    size: string;
    tuples: number;
    pages: number;
  }[]> {
    const { data, error } = await supabaseAdmin.rpc('get_index_stats');
    
    if (error) {
      console.error('Error getting index statistics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Rebuild indexes if needed
   */
  async rebuildIndexes(): Promise<void> {
    console.log('Rebuilding vector indexes...');
    
    try {
      // Drop existing indexes
      await supabaseAdmin.rpc('execute_sql', { 
        sql_query: 'DROP INDEX IF EXISTS idx_document_chunks_embedding_hnsw;' 
      });
      
      await supabaseAdmin.rpc('execute_sql', { 
        sql_query: 'DROP INDEX IF EXISTS idx_saudi_law_ar_embedding_ivf;' 
      });
      
      await supabaseAdmin.rpc('execute_sql', { 
        sql_query: 'DROP INDEX IF EXISTS idx_saudi_law_en_embedding_ivf;' 
      });

      // Recreate optimized indexes
      await this.createOptimizedIndexes();
      
      console.log('Index rebuild completed');
    } catch (error) {
      console.error('Error rebuilding indexes:', error);
      throw error;
    }
  }
}

export const vectorSearchOptimizer = VectorSearchOptimizer.getInstance();