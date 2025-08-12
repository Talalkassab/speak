import { EventEmitter } from 'events';
import { trace } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from './error-tracker';

// Prometheus metrics for cache monitoring
const cacheHits = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'cache_name', 'operation'],
});

const cacheMisses = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'cache_name', 'operation'],
});

const cacheOperationDuration = new promClient.Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations',
  labelNames: ['cache_type', 'cache_name', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
});

const cacheSize = new promClient.Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type', 'cache_name'],
});

const cacheEntryCount = new promClient.Gauge({
  name: 'cache_entries_total',
  help: 'Total number of cache entries',
  labelNames: ['cache_type', 'cache_name'],
});

const cacheEvictions = new promClient.Counter({
  name: 'cache_evictions_total',
  help: 'Total number of cache evictions',
  labelNames: ['cache_type', 'cache_name', 'reason'],
});

export type CacheType = 'memory' | 'redis' | 'cdn' | 'database';
export type CacheOperation = 'get' | 'set' | 'delete' | 'clear' | 'exists';
export type EvictionReason = 'ttl_expired' | 'lru_evicted' | 'manual_delete' | 'memory_pressure';

export interface CacheConfig {
  type: CacheType;
  name: string;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum size in bytes
  maxEntries: number; // Maximum number of entries
  evictionPolicy: 'lru' | 'fifo' | 'ttl';
  compression: boolean;
  monitoring: {
    enabled: boolean;
    logOperations: boolean;
    trackHitRate: boolean;
  };
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number; // Size in bytes
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  ttl: number;
  compressed: boolean;
}

export interface CacheStats {
  type: CacheType;
  name: string;
  hitRate: number;
  hits: number;
  misses: number;
  entries: number;
  size: number; // Current size in bytes
  maxSize: number;
  evictions: number;
  avgAccessTime: number;
  memoryUsage: number; // Percentage of max size used
  uptime: number; // Cache uptime in milliseconds
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
    lastAccess: Date;
  }>;
}

export interface CachePerformanceReport {
  timestamp: Date;
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    totalSize: number;
    totalEntries: number;
  };
  byCache: Record<string, CacheStats>;
  recommendations: Array<{
    cache: string;
    type: 'increase_ttl' | 'increase_size' | 'add_cache_layer' | 'optimize_keys';
    description: string;
    impact: 'low' | 'medium' | 'high';
  }>;
}

class CacheMonitor extends EventEmitter {
  private tracer = trace.getTracer('cache-monitor');
  private caches = new Map<string, InternalCacheStats>();
  private startTime = Date.now();

  constructor() {
    super();
    this.startMetricsCollection();
  }

  /**
   * Register a cache for monitoring
   */
  registerCache(config: CacheConfig): void {
    const cacheId = `${config.type}:${config.name}`;
    
    this.caches.set(cacheId, {
      config,
      stats: {
        hits: 0,
        misses: 0,
        entries: 0,
        size: 0,
        evictions: 0,
        operations: new Map(),
        keyStats: new Map(),
        createdAt: new Date()
      }
    });

    structuredLogger.info('Cache registered for monitoring', {
      service: 'cache-monitor',
      component: 'cache-registry',
      operation: 'register-cache',
      additionalData: {
        cacheType: config.type,
        cacheName: config.name,
        ttl: config.ttl,
        maxSize: config.maxSize
      }
    });
  }

  /**
   * Track cache operation
   */
  async trackOperation<T>(
    cacheType: CacheType,
    cacheName: string,
    operation: CacheOperation,
    key: string,
    operationFn: () => Promise<{ hit: boolean; value?: T; size?: number }>
  ): Promise<{ hit: boolean; value?: T; size?: number }> {
    const cacheId = `${cacheType}:${cacheName}`;
    const cache = this.caches.get(cacheId);
    
    if (!cache) {
      structuredLogger.warn('Attempted to track operation on unregistered cache', {
        service: 'cache-monitor',
        component: 'operation-tracker',
        operation: 'track-operation',
        additionalData: { cacheType, cacheName, operation, key }
      });
      return operationFn();
    }

    const span = this.tracer.startSpan(`Cache ${operation}: ${cacheId}`);
    const startTime = Date.now();

    try {
      const result = await operationFn();
      const duration = Date.now() - startTime;

      // Update metrics
      this.updateOperationMetrics(cache, operation, key, result, duration);

      // Log if enabled
      if (cache.config.monitoring.logOperations) {
        structuredLogger.debug('Cache operation completed', {
          service: 'cache-monitor',
          component: 'operation-tracker',
          operation: `cache-${operation}`,
          additionalData: {
            cacheType,
            cacheName,
            key,
            hit: result.hit,
            duration,
            size: result.size
          }
        });
      }

      span.setAttributes({
        'cache.type': cacheType,
        'cache.name': cacheName,
        'cache.operation': operation,
        'cache.key': key,
        'cache.hit': result.hit,
        'cache.duration_ms': duration,
        'cache.size_bytes': result.size || 0
      });

      span.end();

      return result;

    } catch (error) {
      span.recordException(error as Error);
      span.end();

      await errorTracker.createError(
        'system_error',
        `Cache operation failed: ${operation} on ${cacheId}`,
        error instanceof Error ? error : new Error('Unknown cache error'),
        { cacheType, cacheName, operation, key }
      );

      throw error;
    }
  }

  /**
   * Update operation metrics
   */
  private updateOperationMetrics(
    cache: InternalCacheStats,
    operation: CacheOperation,
    key: string,
    result: { hit: boolean; value?: any; size?: number },
    duration: number
  ): void {
    const { config, stats } = cache;
    
    // Update Prometheus metrics
    const labels = {
      cache_type: config.type,
      cache_name: config.name,
      operation
    };

    cacheOperationDuration.observe(labels, duration / 1000);

    // Update hit/miss counters
    if (operation === 'get') {
      if (result.hit) {
        stats.hits++;
        cacheHits.inc(labels);
      } else {
        stats.misses++;
        cacheMisses.inc(labels);
      }
    }

    // Update operation stats
    if (!stats.operations.has(operation)) {
      stats.operations.set(operation, { count: 0, totalDuration: 0, errors: 0 });
    }
    const opStats = stats.operations.get(operation)!;
    opStats.count++;
    opStats.totalDuration += duration;

    // Update key-level stats
    if (config.monitoring.trackHitRate && operation === 'get') {
      if (!stats.keyStats.has(key)) {
        stats.keyStats.set(key, {
          hits: 0,
          misses: 0,
          size: result.size || 0,
          lastAccess: new Date(),
          createdAt: new Date()
        });
      }
      const keyStats = stats.keyStats.get(key)!;
      
      if (result.hit) {
        keyStats.hits++;
      } else {
        keyStats.misses++;
      }
      keyStats.lastAccess = new Date();
      if (result.size) keyStats.size = result.size;
    }

    // Emit events for real-time monitoring
    this.emit('cache_operation', {
      cache: `${config.type}:${config.name}`,
      operation,
      key,
      hit: result.hit,
      duration,
      size: result.size
    });
  }

  /**
   * Track cache eviction
   */
  trackEviction(
    cacheType: CacheType,
    cacheName: string,
    key: string,
    reason: EvictionReason,
    size: number = 0
  ): void {
    const cacheId = `${cacheType}:${cacheName}`;
    const cache = this.caches.get(cacheId);
    
    if (cache) {
      cache.stats.evictions++;
      cache.stats.size = Math.max(0, cache.stats.size - size);
      cache.stats.entries = Math.max(0, cache.stats.entries - 1);

      // Update Prometheus metrics
      cacheEvictions.inc({
        cache_type: cacheType,
        cache_name: cacheName,
        reason
      });

      // Remove from key stats if tracked
      cache.stats.keyStats.delete(key);

      structuredLogger.debug('Cache eviction tracked', {
        service: 'cache-monitor',
        component: 'eviction-tracker',
        operation: 'track-eviction',
        additionalData: { cacheType, cacheName, key, reason, size }
      });

      this.emit('cache_eviction', {
        cache: cacheId,
        key,
        reason,
        size
      });
    }
  }

  /**
   * Update cache size metrics
   */
  updateCacheSize(cacheType: CacheType, cacheName: string, entries: number, size: number): void {
    const cacheId = `${cacheType}:${cacheName}`;
    const cache = this.caches.get(cacheId);
    
    if (cache) {
      cache.stats.entries = entries;
      cache.stats.size = size;

      // Update Prometheus metrics
      cacheEntryCount.set(
        { cache_type: cacheType, cache_name: cacheName },
        entries
      );
      cacheSize.set(
        { cache_type: cacheType, cache_name: cacheName },
        size
      );
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(cacheType: CacheType, cacheName: string): CacheStats | null {
    const cacheId = `${cacheType}:${cacheName}`;
    const cache = this.caches.get(cacheId);
    
    if (!cache) return null;

    const { config, stats } = cache;
    const totalOperations = stats.hits + stats.misses;
    const hitRate = totalOperations > 0 ? (stats.hits / totalOperations) * 100 : 0;
    
    // Calculate average access time
    const getOpStats = stats.operations.get('get');
    const avgAccessTime = getOpStats && getOpStats.count > 0 
      ? getOpStats.totalDuration / getOpStats.count 
      : 0;

    // Get top keys by access frequency
    const topKeys = Array.from(stats.keyStats.entries())
      .map(([key, keyStats]) => ({
        key,
        hits: keyStats.hits,
        size: keyStats.size,
        lastAccess: keyStats.lastAccess
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      type: config.type,
      name: config.name,
      hitRate: Math.round(hitRate * 100) / 100,
      hits: stats.hits,
      misses: stats.misses,
      entries: stats.entries,
      size: stats.size,
      maxSize: config.maxSize,
      evictions: stats.evictions,
      avgAccessTime: Math.round(avgAccessTime * 100) / 100,
      memoryUsage: config.maxSize > 0 ? (stats.size / config.maxSize) * 100 : 0,
      uptime: Date.now() - stats.createdAt.getTime(),
      topKeys
    };
  }

  /**
   * Get performance report for all caches
   */
  getPerformanceReport(): CachePerformanceReport {
    const byCache: Record<string, CacheStats> = {};
    let totalHits = 0;
    let totalMisses = 0;
    let totalSize = 0;
    let totalEntries = 0;

    // Collect stats for each cache
    for (const [cacheId, cache] of this.caches) {
      const stats = this.getCacheStats(cache.config.type, cache.config.name);
      if (stats) {
        byCache[cacheId] = stats;
        totalHits += stats.hits;
        totalMisses += stats.misses;
        totalSize += stats.size;
        totalEntries += stats.entries;
      }
    }

    const overallHitRate = (totalHits + totalMisses) > 0 
      ? (totalHits / (totalHits + totalMisses)) * 100 
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(byCache);

    return {
      timestamp: new Date(),
      overall: {
        totalHits,
        totalMisses,
        overallHitRate: Math.round(overallHitRate * 100) / 100,
        totalSize,
        totalEntries
      },
      byCache,
      recommendations
    };
  }

  /**
   * Generate cache optimization recommendations
   */
  private generateRecommendations(cacheStats: Record<string, CacheStats>): Array<{
    cache: string;
    type: 'increase_ttl' | 'increase_size' | 'add_cache_layer' | 'optimize_keys';
    description: string;
    impact: 'low' | 'medium' | 'high';
  }> {
    const recommendations = [];

    for (const [cacheId, stats] of Object.entries(cacheStats)) {
      // Low hit rate recommendation
      if (stats.hitRate < 50) {
        recommendations.push({
          cache: cacheId,
          type: 'increase_ttl' as const,
          description: `Cache hit rate is low (${stats.hitRate.toFixed(1)}%). Consider increasing TTL or reviewing cache keys.`,
          impact: 'high' as const
        });
      }

      // High memory usage recommendation
      if (stats.memoryUsage > 90) {
        recommendations.push({
          cache: cacheId,
          type: 'increase_size' as const,
          description: `Cache is ${stats.memoryUsage.toFixed(1)}% full. Consider increasing cache size or implementing better eviction.`,
          impact: 'medium' as const
        });
      }

      // High eviction rate recommendation
      const evictionRate = stats.evictions / (stats.hits + stats.misses + stats.evictions);
      if (evictionRate > 0.2) {
        recommendations.push({
          cache: cacheId,
          type: 'optimize_keys' as const,
          description: `High eviction rate (${(evictionRate * 100).toFixed(1)}%). Review cache key patterns and TTL settings.`,
          impact: 'medium' as const
        });
      }

      // Slow access time recommendation
      if (stats.avgAccessTime > 10) {
        recommendations.push({
          cache: cacheId,
          type: 'add_cache_layer' as const,
          description: `Average access time is ${stats.avgAccessTime.toFixed(1)}ms. Consider adding a faster cache layer.`,
          impact: 'low' as const
        });
      }
    }

    return recommendations;
  }

  /**
   * Clear statistics for a cache
   */
  clearStats(cacheType: CacheType, cacheName: string): void {
    const cacheId = `${cacheType}:${cacheName}`;
    const cache = this.caches.get(cacheId);
    
    if (cache) {
      cache.stats.hits = 0;
      cache.stats.misses = 0;
      cache.stats.evictions = 0;
      cache.stats.operations.clear();
      cache.stats.keyStats.clear();
      cache.stats.createdAt = new Date();

      structuredLogger.info('Cache statistics cleared', {
        service: 'cache-monitor',
        component: 'stats-manager',
        operation: 'clear-stats',
        additionalData: { cacheType, cacheName }
      });
    }
  }

  /**
   * Remove cache from monitoring
   */
  unregisterCache(cacheType: CacheType, cacheName: string): void {
    const cacheId = `${cacheType}:${cacheName}`;
    
    if (this.caches.has(cacheId)) {
      this.caches.delete(cacheId);
      
      structuredLogger.info('Cache unregistered from monitoring', {
        service: 'cache-monitor',
        component: 'cache-registry',
        operation: 'unregister-cache',
        additionalData: { cacheType, cacheName }
      });
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Update Prometheus metrics every 30 seconds
    setInterval(() => {
      for (const [cacheId, cache] of this.caches) {
        const stats = this.getCacheStats(cache.config.type, cache.config.name);
        if (stats) {
          cacheEntryCount.set(
            { cache_type: stats.type, cache_name: stats.name },
            stats.entries
          );
          cacheSize.set(
            { cache_type: stats.type, cache_name: stats.name },
            stats.size
          );
        }
      }
    }, 30000);

    // Generate performance report every 5 minutes
    setInterval(() => {
      try {
        const report = this.getPerformanceReport();
        this.emit('performance_report', report);

        // Log summary
        structuredLogger.info('Cache performance summary', {
          service: 'cache-monitor',
          component: 'performance-reporter',
          operation: 'generate-report',
          additionalData: {
            overallHitRate: report.overall.overallHitRate,
            totalCaches: Object.keys(report.byCache).length,
            recommendationsCount: report.recommendations.length
          }
        });
      } catch (error) {
        structuredLogger.error('Failed to generate cache performance report', {
          service: 'cache-monitor',
          component: 'performance-reporter',
          operation: 'generate-report',
          error: error instanceof Error ? error : undefined
        });
      }
    }, 5 * 60 * 1000);

    // Clean up old key statistics every hour
    setInterval(() => {
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
      
      for (const [cacheId, cache] of this.caches) {
        for (const [key, keyStats] of cache.stats.keyStats) {
          if (keyStats.lastAccess.getTime() < cutoffTime) {
            cache.stats.keyStats.delete(key);
          }
        }
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Export cache metrics for external monitoring
   */
  exportMetrics(): Record<string, any> {
    const report = this.getPerformanceReport();
    
    return {
      timestamp: report.timestamp,
      uptime: Date.now() - this.startTime,
      overall_stats: report.overall,
      cache_details: Object.entries(report.byCache).map(([id, stats]) => ({
        id,
        type: stats.type,
        name: stats.name,
        hit_rate: stats.hitRate,
        memory_usage: stats.memoryUsage,
        entries: stats.entries,
        size_mb: Math.round(stats.size / (1024 * 1024) * 100) / 100,
        evictions: stats.evictions
      })),
      recommendations: report.recommendations
    };
  }
}

interface InternalCacheStats {
  config: CacheConfig;
  stats: {
    hits: number;
    misses: number;
    entries: number;
    size: number;
    evictions: number;
    operations: Map<string, {
      count: number;
      totalDuration: number;
      errors: number;
    }>;
    keyStats: Map<string, {
      hits: number;
      misses: number;
      size: number;
      lastAccess: Date;
      createdAt: Date;
    }>;
    createdAt: Date;
  };
}

// Export singleton instance
export const cacheMonitor = new CacheMonitor();

// Export types
export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CachePerformanceReport
};

export default cacheMonitor;