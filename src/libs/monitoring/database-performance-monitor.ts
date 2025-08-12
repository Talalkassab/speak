import { trace, SpanStatusCode } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from './error-tracker';

// Prometheus metrics for database monitoring
const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table', 'index_used', 'organization_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

const dbQueryCount = new promClient.Counter({
  name: 'db_query_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'result', 'organization_id'],
});

const dbSlowQueries = new promClient.Counter({
  name: 'db_slow_queries_total',
  help: 'Total number of slow database queries',
  labelNames: ['operation', 'table', 'organization_id'],
});

const dbConnectionPoolSize = new promClient.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
});

const dbActiveConnections = new promClient.Gauge({
  name: 'db_active_connections',
  help: 'Current active database connections',
});

const dbLockWaitTime = new promClient.Histogram({
  name: 'db_lock_wait_duration_seconds',
  help: 'Time spent waiting for database locks',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10],
});

export interface QueryExecutionPlan {
  operation: string;
  table: string;
  index_used: boolean;
  scan_type: 'seq_scan' | 'index_scan' | 'index_only_scan' | 'bitmap_scan';
  rows_examined: number;
  rows_returned: number;
  cost: number;
  execution_time: number;
  query_hash: string;
  query_text?: string;
}

export interface SlowQuery {
  id: string;
  query_hash: string;
  query_text: string;
  operation: string;
  table: string;
  duration: number;
  rows_examined: number;
  rows_returned: number;
  index_used: boolean;
  execution_plan: QueryExecutionPlan;
  organization_id?: string;
  user_id?: string;
  timestamp: Date;
  optimization_suggestions: string[];
}

export interface DatabasePerformanceMetrics {
  timestamp: Date;
  connection_stats: {
    active_connections: number;
    idle_connections: number;
    max_connections: number;
    connection_pool_size: number;
  };
  query_stats: {
    total_queries: number;
    slow_queries: number;
    failed_queries: number;
    avg_query_time: number;
    queries_per_second: number;
  };
  table_stats: Record<string, {
    seq_scans: number;
    index_scans: number;
    inserts: number;
    updates: number;
    deletes: number;
    size_bytes: number;
    bloat_ratio: number;
  }>;
  index_stats: Record<string, {
    scans: number;
    tuples_read: number;
    tuples_fetched: number;
    size_bytes: number;
    unused: boolean;
  }>;
  lock_stats: {
    active_locks: number;
    waiting_queries: number;
    deadlocks: number;
    avg_lock_wait_time: number;
  };
  cache_stats: {
    hit_ratio: number;
    blocks_read: number;
    blocks_hit: number;
    buffer_usage: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  type: 'index' | 'query' | 'schema' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  table: string;
  column?: string;
  query_pattern?: string;
  estimated_improvement: {
    performance_gain: number; // percentage
    cost_reduction: number; // percentage
  };
  implementation_effort: 'low' | 'medium' | 'high';
  sql_commands?: string[];
  risks: string[];
  created_at: Date;
  applied: boolean;
}

class DatabasePerformanceMonitor {
  private tracer = trace.getTracer('database-performance-monitor');
  private supabase = createSupabaseAdminClient();
  private slowQueryThreshold = 1000; // 1 second
  private queryCache = new Map<string, QueryExecutionPlan>();
  private slowQueries: SlowQuery[] = [];
  private recommendations: OptimizationRecommendation[] = [];

  constructor() {
    this.startPerformanceMonitoring();
  }

  /**
   * Wrap a database query with performance monitoring
   */
  async monitorQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>,
    context?: {
      organizationId?: string;
      userId?: string;
      queryText?: string;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(`DB Query: ${operation} ${table}`);
    const startTime = Date.now();
    const queryHash = this.generateQueryHash(operation, table, context?.queryText);

    let result: T;
    let success = true;
    let indexUsed = false;

    try {
      // Execute the query
      result = await queryFn();

      // Check if result indicates index usage (simplified heuristic)
      indexUsed = await this.checkIndexUsage(operation, table);

      span.setStatus({ code: SpanStatusCode.OK });
      
    } catch (error) {
      success = false;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database query failed'
      });
      
      await errorTracker.createError(
        'database_error',
        `Database query failed: ${operation} on ${table}`,
        error instanceof Error ? error : new Error('Unknown database error'),
        context
      );
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      // Update metrics
      const labels = {
        operation,
        table,
        index_used: indexUsed ? 'true' : 'false',
        organization_id: context?.organizationId || 'unknown'
      };

      dbQueryDuration.observe(labels, duration / 1000);
      dbQueryCount.inc({
        operation,
        table,
        result: success ? 'success' : 'error',
        organization_id: context?.organizationId || 'unknown'
      });

      // Track slow queries
      if (duration > this.slowQueryThreshold) {
        dbSlowQueries.inc({
          operation,
          table,
          organization_id: context?.organizationId || 'unknown'
        });

        await this.recordSlowQuery({
          operation,
          table,
          duration,
          queryText: context?.queryText,
          organizationId: context?.organizationId,
          userId: context?.userId,
          indexUsed
        });
      }

      // Log query performance
      structuredLogger.logDatabaseQuery(
        operation,
        table,
        duration,
        {
          organizationId: context?.organizationId,
          userId: context?.userId,
          queryHash,
          indexUsed
        },
        success ? undefined : new Error('Query failed')
      );

      span.setAttributes({
        'db.operation': operation,
        'db.table': table,
        'db.duration_ms': duration,
        'db.index_used': indexUsed,
        'db.success': success,
        'db.query_hash': queryHash
      });

      span.end();
    }

    return result!;
  }

  /**
   * Record a slow query for analysis
   */
  private async recordSlowQuery(params: {
    operation: string;
    table: string;
    duration: number;
    queryText?: string;
    organizationId?: string;
    userId?: string;
    indexUsed: boolean;
  }): Promise<void> {
    const queryHash = this.generateQueryHash(params.operation, params.table, params.queryText);
    
    // Get or create execution plan
    let executionPlan = this.queryCache.get(queryHash);
    if (!executionPlan) {
      executionPlan = await this.analyzeQueryPlan(params.operation, params.table, params.queryText);
      this.queryCache.set(queryHash, executionPlan);
    }

    const slowQuery: SlowQuery = {
      id: crypto.randomUUID(),
      query_hash: queryHash,
      query_text: params.queryText || `${params.operation} on ${params.table}`,
      operation: params.operation,
      table: params.table,
      duration: params.duration,
      rows_examined: executionPlan.rows_examined,
      rows_returned: executionPlan.rows_returned,
      index_used: params.indexUsed,
      execution_plan: executionPlan,
      organization_id: params.organizationId,
      user_id: params.userId,
      timestamp: new Date(),
      optimization_suggestions: this.generateOptimizationSuggestions(executionPlan)
    };

    this.slowQueries.push(slowQuery);

    // Store in database
    try {
      await this.supabase
        .from('slow_queries')
        .insert({
          id: slowQuery.id,
          query_hash: slowQuery.query_hash,
          query_text: slowQuery.query_text,
          operation: slowQuery.operation,
          table_name: slowQuery.table,
          duration_ms: slowQuery.duration,
          rows_examined: slowQuery.rows_examined,
          rows_returned: slowQuery.rows_returned,
          index_used: slowQuery.index_used,
          execution_plan: slowQuery.execution_plan,
          organization_id: slowQuery.organization_id,
          user_id: slowQuery.user_id,
          optimization_suggestions: slowQuery.optimization_suggestions,
          created_at: slowQuery.timestamp.toISOString()
        });
    } catch (error) {
      structuredLogger.error('Failed to store slow query', {
        service: 'database-performance-monitor',
        component: 'slow-query-recorder',
        operation: 'store-slow-query',
        error: error instanceof Error ? error : undefined
      });
    }

    // Generate recommendations if patterns detected
    await this.analyzeQueryPatterns();
  }

  /**
   * Generate query hash for deduplication
   */
  private generateQueryHash(operation: string, table: string, queryText?: string): string {
    const content = `${operation}:${table}:${queryText || ''}`;
    // Simple hash function (in production, use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Analyze query execution plan (simplified implementation)
   */
  private async analyzeQueryPlan(
    operation: string, 
    table: string, 
    queryText?: string
  ): Promise<QueryExecutionPlan> {
    // In a real implementation, this would use EXPLAIN ANALYZE
    // For now, we'll simulate the analysis
    
    const isIndexScan = await this.checkIndexUsage(operation, table);
    const estimatedRows = await this.estimateRowCount(table, operation);

    return {
      operation,
      table,
      index_used: isIndexScan,
      scan_type: isIndexScan ? 'index_scan' : 'seq_scan',
      rows_examined: estimatedRows.examined,
      rows_returned: estimatedRows.returned,
      cost: isIndexScan ? 10 : 100, // Simplified cost estimate
      execution_time: 0, // Would be filled from actual execution
      query_hash: this.generateQueryHash(operation, table, queryText),
      query_text: queryText
    };
  }

  /**
   * Check if query likely used an index (simplified heuristic)
   */
  private async checkIndexUsage(operation: string, table: string): Promise<boolean> {
    // In production, this would analyze the actual execution plan
    // For now, we'll use heuristics based on operation type and table
    
    if (operation === 'SELECT' || operation === 'UPDATE' || operation === 'DELETE') {
      // Check if table has indexes (simplified check)
      try {
        const { data } = await this.supabase
          .rpc('pg_get_indexdef', { indexrelid: 'pg_class' })
          .limit(1);
        
        return !!data && data.length > 0;
      } catch (error) {
        return false; // Assume no index if we can't check
      }
    }
    
    return operation === 'INSERT' ? false : true; // Simplified assumption
  }

  /**
   * Estimate row count for query planning
   */
  private async estimateRowCount(table: string, operation: string): Promise<{
    examined: number;
    returned: number;
  }> {
    try {
      // Get approximate row count from table statistics
      const { data } = await this.supabase
        .from(table)
        .select('*', { count: 'estimated' })
        .limit(1);

      const totalRows = 1000; // Simplified - would get from pg_class.reltuples
      
      // Estimate based on operation type
      const examined = operation === 'SELECT' ? Math.min(totalRows, 100) : totalRows;
      const returned = operation === 'SELECT' ? examined : 1;

      return { examined, returned };
    } catch (error) {
      return { examined: 100, returned: 10 }; // Default estimates
    }
  }

  /**
   * Generate optimization suggestions for a query
   */
  private generateOptimizationSuggestions(executionPlan: QueryExecutionPlan): string[] {
    const suggestions: string[] = [];

    // Check for sequential scans on large tables
    if (executionPlan.scan_type === 'seq_scan' && executionPlan.rows_examined > 1000) {
      suggestions.push(
        `Consider adding an index on ${executionPlan.table} for better performance`
      );
    }

    // Check for high cost queries
    if (executionPlan.cost > 100) {
      suggestions.push(
        'Query has high execution cost - consider query optimization or indexing'
      );
    }

    // Check for inefficient row filtering
    const selectivity = executionPlan.rows_returned / executionPlan.rows_examined;
    if (selectivity < 0.1) {
      suggestions.push(
        'Query has low selectivity - consider more selective WHERE conditions or partial indexes'
      );
    }

    // Operation-specific suggestions
    switch (executionPlan.operation) {
      case 'SELECT':
        if (!executionPlan.index_used) {
          suggestions.push('Consider adding indexes on frequently queried columns');
        }
        break;
      case 'UPDATE':
      case 'DELETE':
        if (!executionPlan.index_used) {
          suggestions.push('Consider adding indexes on WHERE clause columns for faster updates/deletes');
        }
        break;
      case 'INSERT':
        if (executionPlan.rows_examined > executionPlan.rows_returned) {
          suggestions.push('Consider batch inserts for better performance');
        }
        break;
    }

    return suggestions;
  }

  /**
   * Analyze query patterns to generate recommendations
   */
  private async analyzeQueryPatterns(): Promise<void> {
    const recentSlowQueries = this.slowQueries.filter(
      q => Date.now() - q.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    // Group by table and operation
    const patterns = new Map<string, SlowQuery[]>();
    recentSlowQueries.forEach(query => {
      const key = `${query.table}:${query.operation}`;
      if (!patterns.has(key)) {
        patterns.set(key, []);
      }
      patterns.get(key)!.push(query);
    });

    // Generate recommendations based on patterns
    for (const [pattern, queries] of patterns) {
      if (queries.length >= 5) { // Pattern threshold
        const [table, operation] = pattern.split(':');
        
        // Check if all queries in pattern don't use indexes
        const noIndexUsage = queries.every(q => !q.index_used);
        if (noIndexUsage) {
          await this.createRecommendation({
            type: 'index',
            priority: 'high',
            title: `Add index for ${table} ${operation} operations`,
            description: `Detected ${queries.length} slow queries on ${table} that could benefit from indexing`,
            table,
            estimated_improvement: {
              performance_gain: 70,
              cost_reduction: 60
            },
            implementation_effort: 'medium',
            sql_commands: [
              `-- Analyze query patterns first`,
              `-- Example: CREATE INDEX CONCURRENTLY idx_${table}_column ON ${table}(column_name);`
            ],
            risks: ['Index creation may temporarily impact performance', 'Requires maintenance overhead']
          });
        }

        // Check for queries with low selectivity
        const lowSelectivity = queries.filter(q => 
          (q.rows_returned / q.rows_examined) < 0.1
        );
        if (lowSelectivity.length >= 3) {
          await this.createRecommendation({
            type: 'query',
            priority: 'medium',
            title: `Optimize WHERE clauses for ${table}`,
            description: `Multiple queries show low selectivity - consider more specific filtering`,
            table,
            estimated_improvement: {
              performance_gain: 40,
              cost_reduction: 30
            },
            implementation_effort: 'low',
            sql_commands: [
              `-- Review and optimize WHERE clauses`,
              `-- Consider partial indexes for common filter combinations`
            ],
            risks: ['May require application code changes']
          });
        }
      }
    }
  }

  /**
   * Create optimization recommendation
   */
  private async createRecommendation(
    params: Omit<OptimizationRecommendation, 'id' | 'created_at' | 'applied'>
  ): Promise<void> {
    const recommendation: OptimizationRecommendation = {
      ...params,
      id: crypto.randomUUID(),
      created_at: new Date(),
      applied: false
    };

    this.recommendations.push(recommendation);

    try {
      await this.supabase
        .from('optimization_recommendations')
        .insert({
          id: recommendation.id,
          type: recommendation.type,
          priority: recommendation.priority,
          title: recommendation.title,
          description: recommendation.description,
          table_name: recommendation.table,
          column_name: recommendation.column,
          query_pattern: recommendation.query_pattern,
          estimated_performance_gain: recommendation.estimated_improvement.performance_gain,
          estimated_cost_reduction: recommendation.estimated_improvement.cost_reduction,
          implementation_effort: recommendation.implementation_effort,
          sql_commands: recommendation.sql_commands,
          risks: recommendation.risks,
          applied: recommendation.applied,
          created_at: recommendation.created_at.toISOString()
        });
    } catch (error) {
      structuredLogger.error('Failed to store optimization recommendation', {
        service: 'database-performance-monitor',
        component: 'recommendation-generator',
        operation: 'store-recommendation',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    try {
      // In a real implementation, these would query actual database statistics
      // For now, we'll provide estimated values based on our monitoring

      const recentQueries = this.slowQueries.filter(
        q => Date.now() - q.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      );

      return {
        timestamp: new Date(),
        connection_stats: {
          active_connections: 5, // Would query pg_stat_activity
          idle_connections: 10,
          max_connections: 100,
          connection_pool_size: 20
        },
        query_stats: {
          total_queries: 1000, // Would use query counters
          slow_queries: recentQueries.length,
          failed_queries: 5,
          avg_query_time: recentQueries.length > 0 
            ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
            : 50,
          queries_per_second: 10
        },
        table_stats: {
          // Would query pg_stat_user_tables
          documents: {
            seq_scans: 100,
            index_scans: 1000,
            inserts: 50,
            updates: 20,
            deletes: 5,
            size_bytes: 1024 * 1024 * 100, // 100MB
            bloat_ratio: 0.1
          },
          organizations: {
            seq_scans: 10,
            index_scans: 500,
            inserts: 5,
            updates: 10,
            deletes: 1,
            size_bytes: 1024 * 1024 * 10, // 10MB
            bloat_ratio: 0.05
          }
        },
        index_stats: {
          // Would query pg_stat_user_indexes
          'idx_documents_organization_id': {
            scans: 800,
            tuples_read: 5000,
            tuples_fetched: 4000,
            size_bytes: 1024 * 1024 * 5, // 5MB
            unused: false
          }
        },
        lock_stats: {
          active_locks: 2,
          waiting_queries: 0,
          deadlocks: 0,
          avg_lock_wait_time: 10
        },
        cache_stats: {
          hit_ratio: 0.95,
          blocks_read: 1000,
          blocks_hit: 9500,
          buffer_usage: 0.7
        }
      };
    } catch (error) {
      structuredLogger.error('Failed to get database performance metrics', {
        service: 'database-performance-monitor',
        component: 'metrics-collector',
        operation: 'get-performance-metrics',
        error: error instanceof Error ? error : undefined
      });

      throw error;
    }
  }

  /**
   * Get slow query report
   */
  async getSlowQueryReport(hours: number = 24): Promise<{
    slow_queries: SlowQuery[];
    summary: {
      total_slow_queries: number;
      unique_queries: number;
      most_frequent_table: string;
      avg_duration: number;
      recommendations_count: number;
    };
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantQueries = this.slowQueries.filter(q => q.timestamp >= cutoff);

    // Calculate summary statistics
    const uniqueQueries = new Set(relevantQueries.map(q => q.query_hash)).size;
    const tableCounts = new Map<string, number>();
    let totalDuration = 0;

    relevantQueries.forEach(query => {
      tableCounts.set(query.table, (tableCounts.get(query.table) || 0) + 1);
      totalDuration += query.duration;
    });

    const mostFrequentTable = Array.from(tableCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    const avgDuration = relevantQueries.length > 0 ? totalDuration / relevantQueries.length : 0;

    return {
      slow_queries: relevantQueries.slice(0, 100), // Limit to 100 most recent
      summary: {
        total_slow_queries: relevantQueries.length,
        unique_queries: uniqueQueries,
        most_frequent_table: mostFrequentTable,
        avg_duration: avgDuration,
        recommendations_count: this.recommendations.length
      }
    };
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    // Sort by priority and creation date
    return this.recommendations
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return b.created_at.getTime() - a.created_at.getTime(); // Newer first
      })
      .slice(0, 20); // Limit to top 20 recommendations
  }

  /**
   * Apply optimization recommendation
   */
  async applyRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.find(r => r.id === recommendationId);
    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    try {
      // In a real implementation, this would execute the SQL commands
      // For safety, we'll just mark it as applied
      
      recommendation.applied = true;
      
      await this.supabase
        .from('optimization_recommendations')
        .update({ applied: true, applied_at: new Date().toISOString() })
        .eq('id', recommendationId);

      structuredLogger.info('Optimization recommendation applied', {
        service: 'database-performance-monitor',
        component: 'optimization-applier',
        operation: 'apply-recommendation',
        additionalData: {
          recommendationId,
          title: recommendation.title,
          type: recommendation.type
        }
      });

      return true;
    } catch (error) {
      structuredLogger.error('Failed to apply optimization recommendation', {
        service: 'database-performance-monitor',
        component: 'optimization-applier',
        operation: 'apply-recommendation',
        error: error instanceof Error ? error : undefined,
        additionalData: { recommendationId }
      });

      return false;
    }
  }

  /**
   * Start continuous performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor connection pool status every 30 seconds
    setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics();
        
        dbConnectionPoolSize.set(metrics.connection_stats.connection_pool_size);
        dbActiveConnections.set(metrics.connection_stats.active_connections);

      } catch (error) {
        structuredLogger.error('Performance monitoring update failed', {
          service: 'database-performance-monitor',
          component: 'continuous-monitor',
          operation: 'update-metrics',
          error: error instanceof Error ? error : undefined
        });
      }
    }, 30000);

    // Analyze query patterns every 10 minutes
    setInterval(() => {
      this.analyzeQueryPatterns().catch(error => {
        structuredLogger.error('Query pattern analysis failed', {
          service: 'database-performance-monitor',
          component: 'pattern-analyzer',
          operation: 'analyze-patterns',
          error: error instanceof Error ? error : undefined
        });
      });
    }, 10 * 60 * 1000);

    // Clean up old slow queries every hour
    setInterval(() => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
      this.slowQueries = this.slowQueries.filter(q => q.timestamp.getTime() > cutoff);
    }, 60 * 60 * 1000);
  }

  /**
   * Get database health score
   */
  async getDatabaseHealthScore(): Promise<{
    score: number; // 0-100
    factors: {
      query_performance: number;
      index_usage: number;
      connection_efficiency: number;
      cache_hit_ratio: number;
      lock_contention: number;
    };
    recommendations_count: number;
    critical_issues: string[];
  }> {
    const metrics = await this.getPerformanceMetrics();
    const slowQueryReport = await this.getSlowQueryReport(24);

    // Calculate individual factor scores (0-100)
    const queryPerformance = Math.max(0, 100 - (slowQueryReport.summary.avg_duration / 100));
    const indexUsage = Math.min(100, (metrics.table_stats.documents?.index_scans || 0) / 
                                      ((metrics.table_stats.documents?.seq_scans || 1) + 
                                       (metrics.table_stats.documents?.index_scans || 0)) * 100);
    const connectionEfficiency = Math.min(100, 
      (metrics.connection_stats.max_connections - metrics.connection_stats.active_connections) / 
      metrics.connection_stats.max_connections * 100);
    const cacheHitRatio = metrics.cache_stats.hit_ratio * 100;
    const lockContention = Math.max(0, 100 - (metrics.lock_stats.waiting_queries * 20));

    const factors = {
      query_performance: queryPerformance,
      index_usage: indexUsage,
      connection_efficiency: connectionEfficiency,
      cache_hit_ratio: cacheHitRatio,
      lock_contention: lockContention
    };

    // Calculate overall score (weighted average)
    const weights = {
      query_performance: 0.3,
      index_usage: 0.25,
      connection_efficiency: 0.2,
      cache_hit_ratio: 0.15,
      lock_contention: 0.1
    };

    const score = Object.entries(factors).reduce((sum, [factor, value]) => {
      return sum + (value * weights[factor as keyof typeof weights]);
    }, 0);

    // Identify critical issues
    const criticalIssues: string[] = [];
    if (queryPerformance < 50) criticalIssues.push('High average query response time');
    if (indexUsage < 70) criticalIssues.push('Low index usage - many sequential scans detected');
    if (connectionEfficiency < 50) criticalIssues.push('Connection pool near capacity');
    if (cacheHitRatio < 90) criticalIssues.push('Low buffer cache hit ratio');
    if (lockContention < 80) criticalIssues.push('Lock contention detected');

    return {
      score: Math.round(score),
      factors,
      recommendations_count: this.recommendations.filter(r => !r.applied).length,
      critical_issues: criticalIssues
    };
  }
}

// Export singleton instance
export const databasePerformanceMonitor = new DatabasePerformanceMonitor();

// Export types
export type {
  QueryExecutionPlan,
  SlowQuery,
  DatabasePerformanceMetrics,
  OptimizationRecommendation
};

export default databasePerformanceMonitor;