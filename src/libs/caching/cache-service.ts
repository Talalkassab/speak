import Redis from 'ioredis';
import { compress, decompress } from 'zlib';
import { promisify } from 'util';
import { cacheMonitor, type CacheConfig, type CacheType } from '../monitoring/cache-monitor';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from '../monitoring/error-tracker';

const compressAsync = promisify(compress);
const decompressAsync = promisify(decompress);

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress the value
  tags?: string[]; // Tags for cache invalidation
  namespace?: string; // Namespace for the key
}

export interface CacheResult<T> {
  value: T | null;
  hit: boolean;
  cached_at?: Date;
  expires_at?: Date;
  compressed?: boolean;
}

export interface CacheServiceConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  memory?: {
    maxSize: number; // Max size in bytes
    maxEntries: number; // Max number of entries
    cleanupInterval: number; // Cleanup interval in seconds
  };
  defaultTtl: number;
  compressionThreshold: number; // Compress values larger than this (bytes)
  enableMonitoring: boolean;
}

class CacheService {
  private redis?: Redis;
  private memoryCache = new Map<string, CacheEntry>();
  private config: CacheServiceConfig;
  private memorySize = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheServiceConfig) {
    this.config = {
      defaultTtl: 3600, // 1 hour
      compressionThreshold: 1024, // 1KB
      enableMonitoring: true,
      ...config
    };

    this.initializeRedis();
    this.initializeMemoryCache();
    this.registerCacheMonitors();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    if (this.config.redis) {
      try {
        this.redis = new Redis({
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          db: this.config.redis.db || 0,
          keyPrefix: this.config.redis.keyPrefix || 'hr-rag:',
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.redis.on('error', (error) => {
          structuredLogger.error('Redis connection error', {
            service: 'cache-service',
            component: 'redis-client',
            operation: 'connection-error',
            error
          });

          errorTracker.createError(
            'system_error',
            'Redis connection error',
            error,
            { cacheType: 'redis' }
          );
        });

        this.redis.on('connect', () => {
          structuredLogger.info('Redis connected', {
            service: 'cache-service',
            component: 'redis-client',
            operation: 'connection-established'
          });
        });

        structuredLogger.info('Redis cache initialized', {
          service: 'cache-service',
          component: 'redis-client',
          operation: 'initialization',
          additionalData: {
            host: this.config.redis.host,
            port: this.config.redis.port,
            db: this.config.redis.db
          }
        });
      } catch (error) {
        structuredLogger.error('Failed to initialize Redis', {
          service: 'cache-service',
          component: 'redis-client',
          operation: 'initialization',
          error: error instanceof Error ? error : undefined
        });
      }
    }
  }

  /**
   * Initialize memory cache
   */
  private initializeMemoryCache(): void {
    if (this.config.memory) {
      // Start cleanup timer
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredMemoryEntries();
      }, this.config.memory.cleanupInterval * 1000);

      structuredLogger.info('Memory cache initialized', {
        service: 'cache-service',
        component: 'memory-cache',
        operation: 'initialization',
        additionalData: {
          maxSize: this.config.memory.maxSize,
          maxEntries: this.config.memory.maxEntries
        }
      });
    }
  }

  /**
   * Register cache monitors
   */
  private registerCacheMonitors(): void {
    if (!this.config.enableMonitoring) return;

    // Register Redis cache monitor
    if (this.redis) {
      cacheMonitor.registerCache({
        type: 'redis',
        name: 'main',
        ttl: this.config.defaultTtl,
        maxSize: 1024 * 1024 * 1024, // 1GB default
        maxEntries: 100000,
        evictionPolicy: 'lru',
        compression: true,
        monitoring: {
          enabled: true,
          logOperations: false, // Too verbose for Redis
          trackHitRate: true
        }
      });
    }

    // Register memory cache monitor
    if (this.config.memory) {
      cacheMonitor.registerCache({
        type: 'memory',
        name: 'main',
        ttl: this.config.defaultTtl,
        maxSize: this.config.memory.maxSize,
        maxEntries: this.config.memory.maxEntries,
        evictionPolicy: 'lru',
        compression: false,
        monitoring: {
          enabled: true,
          logOperations: true,
          trackHitRate: true
        }
      });
    }
  }

  /**
   * Get value from cache (tries memory first, then Redis)
   */
  async get<T>(key: string, options?: CacheOptions): Promise<CacheResult<T>> {
    const fullKey = this.buildKey(key, options?.namespace);

    // Try memory cache first
    const memoryResult = await this.getFromMemory<T>(fullKey);
    if (memoryResult.hit) {
      return memoryResult;
    }

    // Try Redis cache
    if (this.redis) {
      const redisResult = await this.getFromRedis<T>(fullKey);
      
      // Promote to memory cache if hit
      if (redisResult.hit && redisResult.value !== null) {
        await this.setToMemory(fullKey, redisResult.value, options);
      }
      
      return redisResult;
    }

    return { value: null, hit: false };
  }

  /**
   * Set value in cache (both memory and Redis if available)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttl = options?.ttl || this.config.defaultTtl;

    // Set in memory cache
    await this.setToMemory(fullKey, value, options);

    // Set in Redis cache
    if (this.redis) {
      await this.setToRedis(fullKey, value, ttl, options);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.namespace);
    let deleted = false;

    // Delete from memory
    if (this.config.enableMonitoring) {
      await cacheMonitor.trackOperation(
        'memory',
        'main',
        'delete',
        fullKey,
        async () => {
          const existed = this.memoryCache.has(fullKey);
          if (existed) {
            const entry = this.memoryCache.get(fullKey)!;
            this.memorySize -= entry.size;
            this.memoryCache.delete(fullKey);
            cacheMonitor.trackEviction('memory', 'main', fullKey, 'manual_delete', entry.size);
          }
          return { hit: existed };
        }
      );
      deleted = true;
    } else {
      deleted = this.memoryCache.delete(fullKey);
    }

    // Delete from Redis
    if (this.redis) {
      if (this.config.enableMonitoring) {
        await cacheMonitor.trackOperation(
          'redis',
          'main',
          'delete',
          fullKey,
          async () => {
            const result = await this.redis!.del(fullKey);
            return { hit: result > 0 };
          }
        );
      } else {
        await this.redis.del(fullKey);
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      // Clear specific namespace
      const pattern = this.buildKey('*', namespace);
      
      // Clear memory entries matching pattern
      for (const [key] of this.memoryCache) {
        if (key.startsWith(this.buildKey('', namespace))) {
          await this.delete(key.substring(this.buildKey('', namespace).length));
        }
      }
      
      // Clear Redis entries matching pattern
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } else {
      // Clear all
      this.memoryCache.clear();
      this.memorySize = 0;
      
      if (this.redis) {
        await this.redis.flushdb();
      }
    }

    structuredLogger.info('Cache cleared', {
      service: 'cache-service',
      component: 'cache-manager',
      operation: 'clear',
      additionalData: { namespace: namespace || 'all' }
    });
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.namespace);

    // Check memory first
    if (this.memoryCache.has(fullKey)) {
      const entry = this.memoryCache.get(fullKey)!;
      if (!this.isExpired(entry)) {
        return true;
      } else {
        // Clean up expired entry
        this.evictMemoryEntry(fullKey, 'ttl_expired');
      }
    }

    // Check Redis
    if (this.redis) {
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    }

    return false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memory: {
      entries: number;
      size: number;
      hitRate?: number;
    };
    redis?: {
      connected: boolean;
      hitRate?: number;
    };
  } {
    const memoryStats = this.config.enableMonitoring 
      ? cacheMonitor.getCacheStats('memory', 'main')
      : null;

    const redisStats = this.config.enableMonitoring && this.redis
      ? cacheMonitor.getCacheStats('redis', 'main')
      : null;

    return {
      memory: {
        entries: this.memoryCache.size,
        size: this.memorySize,
        hitRate: memoryStats?.hitRate
      },
      redis: this.redis ? {
        connected: this.redis.status === 'ready',
        hitRate: redisStats?.hitRate
      } : undefined
    };
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    // Memory cache invalidation
    const toDelete: string[] = [];
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags?.some(tag => tags.includes(tag))) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      await this.delete(key);
      invalidated++;
    }

    // Redis cache invalidation (simplified - would use Redis tags in production)
    if (this.redis) {
      // In production, you'd maintain a separate Redis set for each tag
      // For now, we'll skip Redis tag invalidation
    }

    structuredLogger.info('Cache invalidated by tags', {
      service: 'cache-service',
      component: 'cache-manager',
      operation: 'invalidate-by-tags',
      additionalData: { tags, invalidated }
    });

    return invalidated;
  }

  // Private helper methods

  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private async getFromMemory<T>(key: string): Promise<CacheResult<T>> {
    if (!this.config.enableMonitoring) {
      const entry = this.memoryCache.get(key);
      if (entry && !this.isExpired(entry)) {
        entry.accessedAt = new Date();
        entry.accessCount++;
        return {
          value: entry.value as T,
          hit: true,
          cached_at: entry.createdAt,
          expires_at: new Date(entry.createdAt.getTime() + entry.ttl * 1000),
          compressed: entry.compressed
        };
      }
      return { value: null, hit: false };
    }

    return cacheMonitor.trackOperation(
      'memory',
      'main',
      'get',
      key,
      async () => {
        const entry = this.memoryCache.get(key);
        
        if (entry && !this.isExpired(entry)) {
          entry.accessedAt = new Date();
          entry.accessCount++;
          
          return {
            hit: true,
            value: entry.value as T,
            size: entry.size
          };
        }
        
        if (entry && this.isExpired(entry)) {
          this.evictMemoryEntry(key, 'ttl_expired');
        }
        
        return { hit: false, value: null };
      }
    ).then(result => ({
      value: result.value,
      hit: result.hit,
      cached_at: result.hit ? this.memoryCache.get(key)?.createdAt : undefined,
      expires_at: result.hit ? new Date(this.memoryCache.get(key)!.createdAt.getTime() + this.memoryCache.get(key)!.ttl * 1000) : undefined,
      compressed: result.hit ? this.memoryCache.get(key)?.compressed : undefined
    }));
  }

  private async setToMemory<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.config.defaultTtl;
    const shouldCompress = options?.compress || false;
    const size = this.estimateSize(value);

    // Check if we need to make space
    if (this.config.memory) {
      await this.ensureMemorySpace(size);
    }

    const entry: CacheEntry = {
      key,
      value: shouldCompress ? await this.compressValue(value) : value,
      size,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 1,
      ttl,
      compressed: shouldCompress,
      tags: options?.tags
    };

    this.memoryCache.set(key, entry);
    this.memorySize += size;

    // Update monitoring
    if (this.config.enableMonitoring) {
      cacheMonitor.updateCacheSize('memory', 'main', this.memoryCache.size, this.memorySize);
    }
  }

  private async getFromRedis<T>(key: string): Promise<CacheResult<T>> {
    if (!this.redis) return { value: null, hit: false };

    if (!this.config.enableMonitoring) {
      try {
        const result = await this.redis.get(key);
        if (result) {
          const parsed = await this.deserializeValue<T>(result);
          return {
            value: parsed.value,
            hit: true,
            compressed: parsed.compressed
          };
        }
        return { value: null, hit: false };
      } catch (error) {
        structuredLogger.error('Redis get operation failed', {
          service: 'cache-service',
          component: 'redis-client',
          operation: 'get',
          error: error instanceof Error ? error : undefined,
          additionalData: { key }
        });
        return { value: null, hit: false };
      }
    }

    return cacheMonitor.trackOperation(
      'redis',
      'main',
      'get',
      key,
      async () => {
        try {
          const result = await this.redis!.get(key);
          if (result) {
            const parsed = await this.deserializeValue<T>(result);
            return {
              hit: true,
              value: parsed.value,
              size: result.length
            };
          }
          return { hit: false, value: null };
        } catch (error) {
          throw error;
        }
      }
    ).then(result => ({
      value: result.value,
      hit: result.hit,
      compressed: result.hit ? true : false // Assume Redis values might be compressed
    }));
  }

  private async setToRedis<T>(key: string, value: T, ttl: number, options?: CacheOptions): Promise<void> {
    if (!this.redis) return;

    try {
      const shouldCompress = options?.compress || this.estimateSize(value) > this.config.compressionThreshold;
      const serialized = await this.serializeValue(value, shouldCompress);

      if (this.config.enableMonitoring) {
        await cacheMonitor.trackOperation(
          'redis',
          'main',
          'set',
          key,
          async () => {
            await this.redis!.setex(key, ttl, serialized);
            return { hit: false, size: serialized.length };
          }
        );
      } else {
        await this.redis.setex(key, ttl, serialized);
      }

      // Store tags in Redis sets for invalidation (if tags provided)
      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
          await this.redis.expire(`tag:${tag}`, ttl);
        }
      }

    } catch (error) {
      structuredLogger.error('Redis set operation failed', {
        service: 'cache-service',
        component: 'redis-client',
        operation: 'set',
        error: error instanceof Error ? error : undefined,
        additionalData: { key, ttl }
      });
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.createdAt.getTime() + entry.ttl * 1000;
  }

  private evictMemoryEntry(key: string, reason: 'ttl_expired' | 'lru_evicted' | 'manual_delete' | 'memory_pressure'): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.memoryCache.delete(key);
      this.memorySize -= entry.size;
      
      if (this.config.enableMonitoring) {
        cacheMonitor.trackEviction('memory', 'main', key, reason, entry.size);
        cacheMonitor.updateCacheSize('memory', 'main', this.memoryCache.size, this.memorySize);
      }
    }
  }

  private async ensureMemorySpace(neededSize: number): Promise<void> {
    if (!this.config.memory) return;

    // Check if we need to evict entries
    while (
      (this.memorySize + neededSize > this.config.memory.maxSize || 
       this.memoryCache.size >= this.config.memory.maxEntries) &&
      this.memoryCache.size > 0
    ) {
      // Find LRU entry
      let lruKey = '';
      let lruTime = Date.now();
      
      for (const [key, entry] of this.memoryCache) {
        if (entry.accessedAt.getTime() < lruTime) {
          lruTime = entry.accessedAt.getTime();
          lruKey = key;
        }
      }

      if (lruKey) {
        this.evictMemoryEntry(lruKey, 'lru_evicted');
      } else {
        break; // Safety break
      }
    }
  }

  private cleanupExpiredMemoryEntries(): void {
    const now = Date.now();
    const toEvict: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (now > entry.createdAt.getTime() + entry.ttl * 1000) {
        toEvict.push(key);
      }
    }

    for (const key of toEvict) {
      this.evictMemoryEntry(key, 'ttl_expired');
    }

    if (toEvict.length > 0) {
      structuredLogger.debug('Memory cache cleanup completed', {
        service: 'cache-service',
        component: 'memory-cache',
        operation: 'cleanup',
        additionalData: { evictedCount: toEvict.length }
      });
    }
  }

  private estimateSize(value: any): number {
    // Simple size estimation
    if (typeof value === 'string') return value.length * 2; // UTF-16
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (value === null || value === undefined) return 0;
    
    // For objects, stringify and estimate
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1000; // Default estimate for complex objects
    }
  }

  private async compressValue<T>(value: T): Promise<Buffer> {
    const serialized = JSON.stringify(value);
    return compressAsync(Buffer.from(serialized, 'utf8'));
  }

  private async decompressValue<T>(compressed: Buffer): Promise<T> {
    const decompressed = await decompressAsync(compressed);
    return JSON.parse(decompressed.toString('utf8'));
  }

  private async serializeValue<T>(value: T, compress: boolean): Promise<string> {
    if (compress) {
      const compressed = await this.compressValue(value);
      return `compressed:${compressed.toString('base64')}`;
    } else {
      return JSON.stringify(value);
    }
  }

  private async deserializeValue<T>(serialized: string): Promise<{ value: T; compressed: boolean }> {
    if (serialized.startsWith('compressed:')) {
      const base64Data = serialized.substring(11);
      const compressed = Buffer.from(base64Data, 'base64');
      const value = await this.decompressValue<T>(compressed);
      return { value, compressed: true };
    } else {
      return { value: JSON.parse(serialized), compressed: false };
    }
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    structuredLogger.info('Cache service shut down', {
      service: 'cache-service',
      component: 'cache-manager',
      operation: 'shutdown'
    });
  }
}

interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  ttl: number;
  compressed: boolean;
  tags?: string[];
}

// Create singleton instance
let cacheService: CacheService | null = null;

export function createCacheService(config: CacheServiceConfig): CacheService {
  if (!cacheService) {
    cacheService = new CacheService(config);
  }
  return cacheService;
}

export function getCacheService(): CacheService | null {
  return cacheService;
}

// Export types
export type {
  CacheServiceConfig,
  CacheOptions,
  CacheResult
};

export default CacheService;