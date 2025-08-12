import Redis from 'ioredis';

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  lazyConnect: boolean;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large payloads
}

interface CacheMetadata {
  key: string;
  createdAt: string;
  expiresAt: string;
  compressed: boolean;
  dataType: string;
}

class AnalyticsCache {
  private static instance: AnalyticsCache;
  private redis: Redis | null = null;
  private connected: boolean = false;
  private readonly defaultTTL = 300; // 5 minutes
  private readonly compressionThreshold = 1024; // 1KB

  static getInstance(): AnalyticsCache {
    if (!AnalyticsCache.instance) {
      AnalyticsCache.instance = new AnalyticsCache();
    }
    return AnalyticsCache.instance;
  }

  private constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      const config: CacheConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'analytics:',
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true
      };

      this.redis = new Redis(config);

      this.redis.on('connect', () => {
        console.log('Analytics cache connected to Redis');
        this.connected = true;
      });

      this.redis.on('error', (error) => {
        console.error('Analytics cache Redis error:', error);
        this.connected = false;
      });

      this.redis.on('close', () => {
        console.log('Analytics cache Redis connection closed');
        this.connected = false;
      });

      // Test connection
      if (process.env.NODE_ENV === 'production') {
        await this.redis.ping();
      }
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error);
      this.redis = null;
      this.connected = false;
    }
  }

  private isAvailable(): boolean {
    return this.redis !== null && this.connected;
  }

  private generateKey(type: string, organizationId: string, params?: Record<string, any>): string {
    let key = `${type}:${organizationId}`;
    
    if (params) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(k => `${k}:${params[k]}`)
        .join(':');
      key += `:${sortedParams}`;
    }
    
    return key;
  }

  private compress(data: string): string {
    // Simple compression using gzip (in production, consider using a proper compression library)
    if (typeof Buffer !== 'undefined') {
      const zlib = require('zlib');
      return zlib.gzipSync(data).toString('base64');
    }
    return data;
  }

  private decompress(data: string): string {
    // Simple decompression
    if (typeof Buffer !== 'undefined') {
      try {
        const zlib = require('zlib');
        const buffer = Buffer.from(data, 'base64');
        return zlib.gunzipSync(buffer).toString();
      } catch (error) {
        console.warn('Failed to decompress data, returning as-is:', error);
        return data;
      }
    }
    return data;
  }

  async set<T>(
    type: string,
    organizationId: string,
    data: T,
    options: CacheOptions = {},
    params?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      console.warn('Analytics cache not available, skipping set operation');
      return false;
    }

    try {
      const key = this.generateKey(type, organizationId, params);
      const ttl = options.ttl || this.defaultTTL;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttl * 1000);

      let serializedData = JSON.stringify(data);
      let compressed = false;

      // Compress large payloads
      if (options.compress || serializedData.length > this.compressionThreshold) {
        serializedData = this.compress(serializedData);
        compressed = true;
      }

      const cacheEntry = {
        data: serializedData,
        metadata: {
          key,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          compressed,
          dataType: typeof data
        } as CacheMetadata
      };

      await this.redis!.setex(key, ttl, JSON.stringify(cacheEntry));
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  }

  async get<T>(
    type: string,
    organizationId: string,
    params?: Record<string, any>
  ): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.generateKey(type, organizationId, params);
      const cached = await this.redis!.get(key);

      if (!cached) {
        return null;
      }

      const cacheEntry = JSON.parse(cached);
      let data = cacheEntry.data;

      // Decompress if needed
      if (cacheEntry.metadata.compressed) {
        data = this.decompress(data);
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  async delete(
    type: string,
    organizationId: string,
    params?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateKey(type, organizationId, params);
      const result = await this.redis!.del(key);
      return result > 0;
    } catch (error) {
      console.error('Error deleting from cache:', error);
      return false;
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      // Get all keys matching the pattern
      const keys = await this.redis!.keys(`analytics:${pattern}`);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const result = await this.redis!.del(...keys);
      return result;
    } catch (error) {
      console.error('Error deleting by pattern:', error);
      return 0;
    }
  }

  async invalidateOrganization(organizationId: string): Promise<number> {
    return await this.deleteByPattern(`*:${organizationId}:*`);
  }

  async exists(
    type: string,
    organizationId: string,
    params?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateKey(type, organizationId, params);
      const result = await this.redis!.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Error checking cache existence:', error);
      return false;
    }
  }

  async getMetadata(
    type: string,
    organizationId: string,
    params?: Record<string, any>
  ): Promise<CacheMetadata | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.generateKey(type, organizationId, params);
      const cached = await this.redis!.get(key);

      if (!cached) {
        return null;
      }

      const cacheEntry = JSON.parse(cached);
      return cacheEntry.metadata;
    } catch (error) {
      console.error('Error getting cache metadata:', error);
      return null;
    }
  }

  async getOrSet<T>(
    type: string,
    organizationId: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {},
    params?: Record<string, any>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(type, organizationId, params);
    
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch the data
    const data = await fetchFunction();
    
    // Store in cache for next time
    await this.set(type, organizationId, data, options, params);
    
    return data;
  }

  async warmup(
    type: string,
    organizationId: string,
    data: any,
    options: CacheOptions = {},
    params?: Record<string, any>
  ): Promise<boolean> {
    // Pre-populate cache with data
    return await this.set(type, organizationId, data, options, params);
  }

  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    if (!this.isAvailable()) {
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0B'
      };
    }

    try {
      const info = await this.redis!.info('memory');
      const dbSize = await this.redis!.dbsize();
      
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : '0B';

      return {
        connected: this.connected,
        keyCount: dbSize,
        memoryUsage
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0B'
      };
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.redis!.flushdb();
      return true;
    } catch (error) {
      console.error('Error flushing cache:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.connected = false;
    }
  }

  // Specialized methods for analytics data types
  async cacheUsageMetrics(
    organizationId: string,
    metrics: any,
    period: string,
    ttl: number = 300
  ): Promise<boolean> {
    return await this.set(
      'usage_metrics',
      organizationId,
      metrics,
      { ttl },
      { period }
    );
  }

  async getCachedUsageMetrics(
    organizationId: string,
    period: string
  ): Promise<any | null> {
    return await this.get(
      'usage_metrics',
      organizationId,
      { period }
    );
  }

  async cacheCostMetrics(
    organizationId: string,
    metrics: any,
    period: string,
    currency: string = 'USD',
    ttl: number = 600
  ): Promise<boolean> {
    return await this.set(
      'cost_metrics',
      organizationId,
      metrics,
      { ttl },
      { period, currency }
    );
  }

  async getCachedCostMetrics(
    organizationId: string,
    period: string,
    currency: string = 'USD'
  ): Promise<any | null> {
    return await this.get(
      'cost_metrics',
      organizationId,
      { period, currency }
    );
  }

  async cachePerformanceMetrics(
    organizationId: string,
    metrics: any,
    ttl: number = 180 // 3 minutes for performance data
  ): Promise<boolean> {
    return await this.set(
      'performance_metrics',
      organizationId,
      metrics,
      { ttl }
    );
  }

  async getCachedPerformanceMetrics(
    organizationId: string
  ): Promise<any | null> {
    return await this.get(
      'performance_metrics',
      organizationId
    );
  }

  async cacheComplianceMetrics(
    organizationId: string,
    metrics: any,
    categories?: string[],
    ttl: number = 1800 // 30 minutes for compliance data
  ): Promise<boolean> {
    return await this.set(
      'compliance_metrics',
      organizationId,
      metrics,
      { ttl },
      categories ? { categories: categories.sort().join(',') } : undefined
    );
  }

  async getCachedComplianceMetrics(
    organizationId: string,
    categories?: string[]
  ): Promise<any | null> {
    return await this.get(
      'compliance_metrics',
      organizationId,
      categories ? { categories: categories.sort().join(',') } : undefined
    );
  }

  async cacheRealtimeMetrics(
    organizationId: string,
    metrics: any,
    ttl: number = 30 // 30 seconds for real-time data
  ): Promise<boolean> {
    return await this.set(
      'realtime_metrics',
      organizationId,
      metrics,
      { ttl }
    );
  }

  async getCachedRealtimeMetrics(
    organizationId: string
  ): Promise<any | null> {
    return await this.get(
      'realtime_metrics',
      organizationId
    );
  }
}

// Export singleton instance
export const analyticsCache = AnalyticsCache.getInstance();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing analytics cache...');
  await analyticsCache.close();
});

process.on('SIGINT', async () => {
  console.log('Closing analytics cache...');
  await analyticsCache.close();
});