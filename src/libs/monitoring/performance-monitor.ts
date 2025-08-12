import { trace, metrics, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import * as promClient from 'prom-client';

// Prometheus metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'organization_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'organization_id'],
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table', 'organization_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const dbConnectionPoolSize = new promClient.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
});

const activeConnections = new promClient.Gauge({
  name: 'db_active_connections',
  help: 'Current active database connections',
});

const cacheHitRatio = new promClient.Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio',
  labelNames: ['cache_type', 'organization_id'],
});

const memoryUsage = new promClient.Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type'], // heap_used, heap_total, external, rss
});

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  duration: number;
  organizationId?: string;
  userId?: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface DatabaseMetrics {
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  table: string;
  duration: number;
  organizationId?: string;
  rowsAffected?: number;
  query?: string; // Only for debugging, remove in production
  timestamp: Date;
}

export interface CacheMetrics {
  cacheType: 'redis' | 'memory' | 'cdn';
  operation: 'GET' | 'SET' | 'DELETE' | 'INVALIDATE';
  hit: boolean;
  organizationId?: string;
  key: string;
  timestamp: Date;
}

class PerformanceMonitor {
  private tracer = trace.getTracer('hr-rag-platform');
  
  constructor() {
    // Initialize memory usage collection
    this.startMemoryMonitoring();
  }

  /**
   * Track HTTP request performance
   */
  trackHttpRequest(metrics: PerformanceMetrics): void {
    const labels = {
      method: metrics.method,
      route: metrics.route,
      status_code: metrics.statusCode.toString(),
      organization_id: metrics.organizationId || 'unknown',
    };

    // Record metrics
    httpRequestDuration.observe(labels, metrics.duration / 1000);
    httpRequestsTotal.inc(labels);

    // Create OpenTelemetry span
    const span = this.tracer.startSpan(`HTTP ${metrics.method} ${metrics.route}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': metrics.method,
        'http.route': metrics.route,
        'http.status_code': metrics.statusCode,
        'organization.id': metrics.organizationId,
        'user.id': metrics.userId,
        'request.id': metrics.requestId,
      },
    });

    span.setStatus({
      code: metrics.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });

    span.end();
  }

  /**
   * Create a timing wrapper for async operations
   */
  async timeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: { organizationId?: string; userId?: string; [key: string]: any }
  ): Promise<T> {
    const startTime = Date.now();
    const span = this.tracer.startSpan(operationName, {
      attributes: {
        ...context,
        'operation.name': operationName,
      },
    });

    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
      });
      span.end();
    }
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(metrics: DatabaseMetrics): void {
    const labels = {
      query_type: metrics.queryType,
      table: metrics.table,
      organization_id: metrics.organizationId || 'unknown',
    };

    dbQueryDuration.observe(labels, metrics.duration / 1000);

    // Create span for database operation
    const span = this.tracer.startSpan(`DB ${metrics.queryType} ${metrics.table}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.operation': metrics.queryType,
        'db.table': metrics.table,
        'db.duration_ms': metrics.duration,
        'db.rows_affected': metrics.rowsAffected,
        'organization.id': metrics.organizationId,
      },
    });

    span.end();
  }

  /**
   * Track cache operations
   */
  trackCacheOperation(metrics: CacheMetrics): void {
    const labels = {
      cache_type: metrics.cacheType,
      organization_id: metrics.organizationId || 'unknown',
    };

    // Update cache hit ratio
    const currentRatio = cacheHitRatio.get(labels);
    const newHitCount = metrics.hit ? (currentRatio?.value || 0) + 1 : (currentRatio?.value || 0);
    cacheHitRatio.set(labels, metrics.hit ? 1 : 0);

    // Create span
    const span = this.tracer.startSpan(`Cache ${metrics.operation}`, {
      attributes: {
        'cache.type': metrics.cacheType,
        'cache.operation': metrics.operation,
        'cache.hit': metrics.hit,
        'cache.key': metrics.key,
        'organization.id': metrics.organizationId,
      },
    });

    span.end();
  }

  /**
   * Track database connection pool metrics
   */
  updateConnectionPoolMetrics(poolSize: number, activeConns: number): void {
    dbConnectionPoolSize.set(poolSize);
    activeConnections.set(activeConns);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      memoryUsage.set({ type: 'heap_used' }, usage.heapUsed);
      memoryUsage.set({ type: 'heap_total' }, usage.heapTotal);
      memoryUsage.set({ type: 'external' }, usage.external);
      memoryUsage.set({ type: 'rss' }, usage.rss);
    }, 10000); // Every 10 seconds
  }

  /**
   * Get current performance snapshot
   */
  async getPerformanceSnapshot(): Promise<{
    memory: NodeJS.MemoryUsage;
    uptime: number;
    timestamp: Date;
  }> {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a middleware-friendly timing function
   */
  createTimer() {
    const startTime = process.hrtime.bigint();
    
    return {
      end: (): number => {
        const endTime = process.hrtime.bigint();
        return Number(endTime - startTime) / 1000000; // Convert to milliseconds
      }
    };
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    promClient.register.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;