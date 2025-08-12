import { createClient } from 'redis';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Performance optimization interfaces
export interface CacheConfig {
  embeddings: {
    ttl: number; // seconds
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'ttl';
  };
  responses: {
    ttl: number;
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'ttl';
  };
  searchResults: {
    ttl: number;
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'ttl';
  };
  conversations: {
    ttl: number;
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'ttl';
  };
}

export interface PerformanceMetrics {
  cacheHitRatio: number;
  averageResponseTime: number;
  embedderLatency: number;
  retrievalLatency: number;
  generationLatency: number;
  totalRequests: number;
  errorRate: number;
  costMetrics: CostMetrics;
  qualityMetrics: QualityMetrics;
}

export interface CostMetrics {
  totalEmbeddingCost: number;
  totalGenerationCost: number;
  dailyCost: number;
  monthlyCost: number;
  averageCostPerQuery: number;
  tokenUsage: TokenUsage;
}

export interface TokenUsage {
  embeddingTokens: number;
  generationTokens: number;
  totalTokens: number;
  dailyTokens: number;
  monthlyTokens: number;
}

export interface QualityMetrics {
  averageConfidenceScore: number;
  factCheckingAccuracy: number;
  userSatisfactionScore: number;
  responseCompleteness: number;
  sourceRelevance: number;
  biasScore: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
  cost: number;
  quality: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRatio: number;
  averageAge: number;
  totalCostSaved: number;
  memoryUsage: number;
}

export interface OptimizationRecommendation {
  type: 'cache' | 'model' | 'strategy' | 'cost' | 'quality';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: string;
  implementation: string;
  estimatedCost: number;
  estimatedSavings: number;
}

export class PerformanceOptimizationService {
  private redis: any;
  private cacheConfig: CacheConfig;
  private metrics: PerformanceMetrics;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  private metricsInterval: NodeJS.Timeout | null = null;

  // In-memory caches for fallback
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;

  constructor() {
    this.cacheConfig = {
      embeddings: {
        ttl: 24 * 60 * 60, // 24 hours
        maxSize: 10000,
        strategy: 'lfu'
      },
      responses: {
        ttl: 60 * 60, // 1 hour
        maxSize: 5000,
        strategy: 'lru'
      },
      searchResults: {
        ttl: 30 * 60, // 30 minutes
        maxSize: 3000,
        strategy: 'ttl'
      },
      conversations: {
        ttl: 2 * 60 * 60, // 2 hours
        maxSize: 1000,
        strategy: 'lru'
      }
    };

    this.metrics = this.initializeMetrics();
    this.initializeRedis();
    this.startMetricsCollection();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      if (process.env.REDIS_URL) {
        this.redis = createClient({
          url: process.env.REDIS_URL,
          socket: {
            connectTimeout: 5000,
            commandTimeout: 5000,
          },
          retry_strategy: (options) => {
            if (options.total_retry_time > 1000 * 60 * 60) {
              return new Error('Redis retry time exhausted');
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        this.redis.on('error', (err: Error) => {
          console.error('Redis error:', err);
        });

        this.redis.on('connect', () => {
          console.log('Redis connected successfully');
        });

        await this.redis.connect();
      } else {
        console.warn('Redis URL not configured, using in-memory cache only');
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      console.log('Falling back to in-memory cache');
    }
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      cacheHitRatio: 0,
      averageResponseTime: 0,
      embedderLatency: 0,
      retrievalLatency: 0,
      generationLatency: 0,
      totalRequests: 0,
      errorRate: 0,
      costMetrics: {
        totalEmbeddingCost: 0,
        totalGenerationCost: 0,
        dailyCost: 0,
        monthlyCost: 0,
        averageCostPerQuery: 0,
        tokenUsage: {
          embeddingTokens: 0,
          generationTokens: 0,
          totalTokens: 0,
          dailyTokens: 0,
          monthlyTokens: 0
        }
      },
      qualityMetrics: {
        averageConfidenceScore: 0,
        factCheckingAccuracy: 0,
        userSatisfactionScore: 0,
        responseCompleteness: 0,
        sourceRelevance: 0,
        biasScore: 0
      }
    };
  }

  /**
   * Generic cache operations
   */
  async setCache<T>(
    key: string,
    data: T,
    category: keyof CacheConfig,
    metadata?: Partial<CacheEntry>
  ): Promise<void> {
    const config = this.cacheConfig[category];
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hits: 0,
      lastAccessed: Date.now(),
      cost: metadata?.cost || 0,
      quality: metadata?.quality || 0,
      ttl: config.ttl,
      ...metadata
    };

    const cacheKey = `${category}:${key}`;

    try {
      if (this.redis) {
        await this.redis.setEx(
          cacheKey,
          config.ttl,
          JSON.stringify(entry)
        );
      } else {
        // Fallback to memory cache
        this.memoryCache.set(cacheKey, entry);
        this.enforceMemoryCacheSize();
      }
    } catch (error) {
      console.error('Cache set error:', error);
      // Fallback to memory cache
      this.memoryCache.set(cacheKey, entry);
      this.enforceMemoryCacheSize();
    }
  }

  /**
   * Get from cache
   */
  async getCache<T>(
    key: string,
    category: keyof CacheConfig
  ): Promise<T | null> {
    const cacheKey = `${category}:${key}`;

    try {
      let entryData: string | null = null;

      if (this.redis) {
        entryData = await this.redis.get(cacheKey);
      } else {
        const entry = this.memoryCache.get(cacheKey);
        entryData = entry ? JSON.stringify(entry) : null;
      }

      if (!entryData) {
        this.updateMetrics('cache_miss');
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(entryData);
      
      // Check TTL for memory cache
      if (!this.redis && Date.now() - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(cacheKey);
        this.updateMetrics('cache_miss');
        return null;
      }

      // Update access statistics
      entry.hits++;
      entry.lastAccessed = Date.now();

      if (this.redis) {
        await this.redis.setEx(cacheKey, entry.ttl, JSON.stringify(entry));
      } else {
        this.memoryCache.set(cacheKey, entry);
      }

      this.updateMetrics('cache_hit', {
        savedCost: entry.cost,
        quality: entry.quality
      });

      return entry.data;

    } catch (error) {
      console.error('Cache get error:', error);
      this.updateMetrics('cache_miss');
      return null;
    }
  }

  /**
   * Cache embeddings with quality scoring
   */
  async cacheEmbedding(
    content: string,
    contentType: string,
    language: string,
    embedding: number[],
    metadata: {
      model: string;
      tokensUsed: number;
      cost: number;
      qualityScore?: number;
      processingTime: number;
    }
  ): Promise<void> {
    const key = this.generateEmbeddingCacheKey(content, contentType, language);
    
    await this.setCache(key, {
      embedding,
      model: metadata.model,
      tokensUsed: metadata.tokensUsed,
      processingTime: metadata.processingTime
    }, 'embeddings', {
      cost: metadata.cost,
      quality: metadata.qualityScore || 0.8
    });

    // Update cost metrics
    this.updateCostMetrics('embedding', metadata.tokensUsed, metadata.cost);
  }

  /**
   * Get cached embedding
   */
  async getCachedEmbedding(
    content: string,
    contentType: string,
    language: string
  ): Promise<{
    embedding: number[];
    model: string;
    tokensUsed: number;
    processingTime: number;
  } | null> {
    const key = this.generateEmbeddingCacheKey(content, contentType, language);
    return await this.getCache(key, 'embeddings');
  }

  /**
   * Cache search results with relevance scoring
   */
  async cacheSearchResults(
    query: string,
    organizationId: string,
    language: string,
    results: any[],
    metadata: {
      searchTime: number;
      totalResults: number;
      averageRelevance: number;
    }
  ): Promise<void> {
    const key = this.generateSearchCacheKey(query, organizationId, language);
    
    await this.setCache(key, {
      results,
      totalResults: metadata.totalResults,
      searchTime: metadata.searchTime
    }, 'searchResults', {
      quality: metadata.averageRelevance
    });
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(
    query: string,
    organizationId: string,
    language: string
  ): Promise<{
    results: any[];
    totalResults: number;
    searchTime: number;
  } | null> {
    const key = this.generateSearchCacheKey(query, organizationId, language);
    return await this.getCache(key, 'searchResults');
  }

  /**
   * Cache AI response with quality metrics
   */
  async cacheResponse(
    prompt: string,
    response: string,
    metadata: {
      model: string;
      tokensUsed: number;
      cost: number;
      confidence: number;
      processingTime: number;
      qualityScore: number;
    }
  ): Promise<void> {
    const key = this.generateResponseCacheKey(prompt);
    
    await this.setCache(key, {
      response,
      model: metadata.model,
      tokensUsed: metadata.tokensUsed,
      confidence: metadata.confidence,
      processingTime: metadata.processingTime
    }, 'responses', {
      cost: metadata.cost,
      quality: metadata.qualityScore
    });

    // Update cost and quality metrics
    this.updateCostMetrics('generation', metadata.tokensUsed, metadata.cost);
    this.updateQualityMetrics(metadata.confidence, metadata.qualityScore);
  }

  /**
   * Get cached response
   */
  async getCachedResponse(prompt: string): Promise<{
    response: string;
    model: string;
    tokensUsed: number;
    confidence: number;
    processingTime: number;
  } | null> {
    const key = this.generateResponseCacheKey(prompt);
    return await this.getCache(key, 'responses');
  }

  /**
   * Cache conversation context
   */
  async cacheConversationContext(
    conversationId: string,
    context: any,
    metadata: {
      messageCount: number;
      topics: string[];
      entities: number;
    }
  ): Promise<void> {
    await this.setCache(conversationId, {
      context,
      messageCount: metadata.messageCount,
      topics: metadata.topics,
      entities: metadata.entities
    }, 'conversations', {
      quality: Math.min(metadata.messageCount / 10, 1) // Quality based on conversation depth
    });
  }

  /**
   * Get cached conversation context
   */
  async getCachedConversationContext(conversationId: string): Promise<{
    context: any;
    messageCount: number;
    topics: string[];
    entities: number;
  } | null> {
    return await this.getCache(conversationId, 'conversations');
  }

  /**
   * Generate cache keys
   */
  private generateEmbeddingCacheKey(content: string, contentType: string, language: string): string {
    const contentHash = this.hashString(content);
    return `${contentType}:${language}:${contentHash}`;
  }

  private generateSearchCacheKey(query: string, organizationId: string, language: string): string {
    const queryHash = this.hashString(query);
    return `${organizationId}:${language}:${queryHash}`;
  }

  private generateResponseCacheKey(prompt: string): string {
    return this.hashString(prompt);
  }

  /**
   * Simple string hashing for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(event: string, data?: any): void {
    switch (event) {
      case 'cache_hit':
        this.metrics.cacheHitRatio = (this.metrics.cacheHitRatio * this.metrics.totalRequests + 1) / 
                                    (this.metrics.totalRequests + 1);
        if (data?.savedCost) {
          this.metrics.costMetrics.totalEmbeddingCost -= data.savedCost;
        }
        break;
        
      case 'cache_miss':
        this.metrics.cacheHitRatio = (this.metrics.cacheHitRatio * this.metrics.totalRequests) / 
                                    (this.metrics.totalRequests + 1);
        break;
        
      case 'request':
        this.metrics.totalRequests++;
        if (data?.responseTime) {
          this.metrics.averageResponseTime = (this.metrics.averageResponseTime * 
            (this.metrics.totalRequests - 1) + data.responseTime) / this.metrics.totalRequests;
        }
        break;
        
      case 'error':
        this.metrics.errorRate = (this.metrics.errorRate * this.metrics.totalRequests + 1) / 
                                 (this.metrics.totalRequests + 1);
        break;
    }
  }

  /**
   * Update cost metrics
   */
  private updateCostMetrics(type: 'embedding' | 'generation', tokens: number, cost: number): void {
    const costMetrics = this.metrics.costMetrics;
    const tokenUsage = costMetrics.tokenUsage;

    if (type === 'embedding') {
      costMetrics.totalEmbeddingCost += cost;
      tokenUsage.embeddingTokens += tokens;
    } else {
      costMetrics.totalGenerationCost += cost;
      tokenUsage.generationTokens += tokens;
    }

    tokenUsage.totalTokens = tokenUsage.embeddingTokens + tokenUsage.generationTokens;
    costMetrics.dailyCost += cost; // Simplified - would reset daily
    costMetrics.monthlyCost += cost; // Simplified - would reset monthly
    
    if (this.metrics.totalRequests > 0) {
      costMetrics.averageCostPerQuery = (costMetrics.totalEmbeddingCost + 
        costMetrics.totalGenerationCost) / this.metrics.totalRequests;
    }
  }

  /**
   * Update quality metrics
   */
  private updateQualityMetrics(confidence: number, quality: number): void {
    const qualityMetrics = this.metrics.qualityMetrics;
    const total = this.metrics.totalRequests;
    
    qualityMetrics.averageConfidenceScore = (qualityMetrics.averageConfidenceScore * 
      (total - 1) + confidence) / total;
    qualityMetrics.responseCompleteness = (qualityMetrics.responseCompleteness * 
      (total - 1) + quality) / total;
  }

  /**
   * Enforce memory cache size limits
   */
  private enforceMemoryCacheSize(): void {
    if (this.memoryCache.size <= this.MAX_MEMORY_CACHE_SIZE) return;

    // Convert to array and sort by last accessed time
    const entries = Array.from(this.memoryCache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

    // Remove oldest entries
    const toRemove = entries.slice(0, this.memoryCache.size - this.MAX_MEMORY_CACHE_SIZE);
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(category?: keyof CacheConfig): Promise<CacheStats> {
    const stats: CacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRatio: 0,
      averageAge: 0,
      totalCostSaved: 0,
      memoryUsage: 0
    };

    try {
      if (this.redis && category) {
        // Get cache keys for category
        const pattern = `${category}:*`;
        const keys = await this.redis.keys(pattern);
        stats.size = keys.length;

        // Sample some entries to calculate statistics
        const sampleSize = Math.min(keys.length, 100);
        const sampleKeys = keys.slice(0, sampleSize);
        
        let totalAge = 0;
        let totalHits = 0;
        let totalCostSaved = 0;

        for (const key of sampleKeys) {
          try {
            const entryData = await this.redis.get(key);
            if (entryData) {
              const entry: CacheEntry = JSON.parse(entryData);
              totalAge += Date.now() - entry.timestamp;
              totalHits += entry.hits;
              totalCostSaved += entry.cost * entry.hits;
            }
          } catch (error) {
            // Ignore parsing errors for individual entries
          }
        }

        if (sampleSize > 0) {
          stats.averageAge = totalAge / sampleSize;
          stats.totalCostSaved = totalCostSaved;
        }
      } else {
        // Memory cache stats
        stats.size = this.memoryCache.size;
        stats.memoryUsage = this.estimateMemoryUsage();
        
        let totalAge = 0;
        let totalHits = 0;
        let totalCostSaved = 0;

        for (const entry of this.memoryCache.values()) {
          totalAge += Date.now() - entry.timestamp;
          totalHits += entry.hits;
          totalCostSaved += entry.cost * entry.hits;
        }

        if (stats.size > 0) {
          stats.averageAge = totalAge / stats.size;
          stats.totalCostSaved = totalCostSaved;
        }
      }

      stats.hitRatio = this.metrics.cacheHitRatio;

    } catch (error) {
      console.error('Error getting cache stats:', error);
    }

    return stats;
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry).length * 2;
    }
    return totalSize; // bytes
  }

  /**
   * Clear cache by category or entirely
   */
  async clearCache(category?: keyof CacheConfig): Promise<void> {
    try {
      if (this.redis && category) {
        const pattern = `${category}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } else if (this.redis && !category) {
        await this.redis.flushAll();
      } else {
        // Memory cache
        if (category) {
          const keysToDelete = Array.from(this.memoryCache.keys())
            .filter(key => key.startsWith(`${category}:`));
          keysToDelete.forEach(key => this.memoryCache.delete(key));
        } else {
          this.memoryCache.clear();
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      await this.persistMetrics();
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      
      await supabase
        .from('performance_metrics')
        .insert({
          timestamp: new Date().toISOString(),
          metrics: JSON.stringify(this.metrics),
          cache_stats: JSON.stringify({
            embeddings: await this.getCacheStats('embeddings'),
            responses: await this.getCacheStats('responses'),
            searchResults: await this.getCacheStats('searchResults'),
            conversations: await this.getCacheStats('conversations')
          })
        });
    } catch (error) {
      console.error('Error persisting metrics:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = this.metrics;

    // Cache optimization recommendations
    if (metrics.cacheHitRatio < 0.6) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        description: 'Low cache hit ratio detected',
        expectedImpact: 'Reduce costs by 20-30% and improve response times',
        implementation: 'Increase cache TTL for stable content, implement better cache keys',
        estimatedCost: 0,
        estimatedSavings: metrics.costMetrics.dailyCost * 0.25
      });
    }

    // Cost optimization recommendations
    if (metrics.costMetrics.averageCostPerQuery > 0.01) {
      recommendations.push({
        type: 'cost',
        priority: 'medium',
        description: 'High cost per query detected',
        expectedImpact: 'Reduce operational costs by optimizing model selection',
        implementation: 'Use smaller models for simple queries, implement query complexity analysis',
        estimatedCost: 1000, // Development cost
        estimatedSavings: metrics.costMetrics.dailyCost * 0.3
      });
    }

    // Quality optimization recommendations
    if (metrics.qualityMetrics.averageConfidenceScore < 0.7) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        description: 'Low response confidence detected',
        expectedImpact: 'Improve user satisfaction and response accuracy',
        implementation: 'Enhance retrieval system, improve prompt engineering',
        estimatedCost: 2000,
        estimatedSavings: 0
      });
    }

    // Performance optimization recommendations
    if (metrics.averageResponseTime > 3000) {
      recommendations.push({
        type: 'cache',
        priority: 'critical',
        description: 'High response times detected',
        expectedImpact: 'Improve user experience with faster responses',
        implementation: 'Implement response caching, optimize database queries',
        estimatedCost: 1500,
        estimatedSavings: 0
      });
    }

    // Model optimization recommendations
    if (metrics.errorRate > 0.05) {
      recommendations.push({
        type: 'strategy',
        priority: 'high',
        description: 'High error rate detected',
        expectedImpact: 'Improve system reliability and user experience',
        implementation: 'Add fallback strategies, improve error handling',
        estimatedCost: 1000,
        estimatedSavings: metrics.costMetrics.dailyCost * 0.1
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Health check for performance systems
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
    metrics: Partial<PerformanceMetrics>;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check Redis connection
    try {
      if (this.redis) {
        await this.redis.ping();
      }
    } catch (error) {
      issues.push('Redis connection failed');
      recommendations.push('Check Redis server status and connection configuration');
      status = 'degraded';
    }

    // Check cache performance
    if (this.metrics.cacheHitRatio < 0.3) {
      issues.push('Very low cache hit ratio');
      recommendations.push('Review caching strategy and increase cache TTL');
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check response times
    if (this.metrics.averageResponseTime > 5000) {
      issues.push('High average response time');
      recommendations.push('Optimize queries and consider scaling infrastructure');
      status = 'unhealthy';
    }

    // Check error rate
    if (this.metrics.errorRate > 0.1) {
      issues.push('High error rate detected');
      recommendations.push('Review error logs and implement better error handling');
      status = 'unhealthy';
    }

    // Check cost trends
    if (this.metrics.costMetrics.dailyCost > 100) {
      issues.push('High daily costs detected');
      recommendations.push('Implement cost optimization strategies');
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      issues,
      recommendations,
      metrics: {
        cacheHitRatio: this.metrics.cacheHitRatio,
        averageResponseTime: this.metrics.averageResponseTime,
        errorRate: this.metrics.errorRate,
        totalRequests: this.metrics.totalRequests,
        costMetrics: this.metrics.costMetrics
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMetricsCollection();
    
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }

    this.memoryCache.clear();
  }
}