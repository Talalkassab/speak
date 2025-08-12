import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from './structured-logger';
import { performanceMonitor } from '../monitoring/performance-monitor';

export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'RPC' | 'FUNCTION';

export interface DatabaseQuery {
  id?: string;
  type: QueryType;
  table: string;
  query: string;
  parameters?: Record<string, any>;
  executionTime: number; // milliseconds
  rowsAffected: number;
  organizationId?: string;
  userId?: string;
  context?: {
    operation?: string;
    component?: string;
    requestId?: string;
    traceId?: string;
    sessionId?: string;
  };
  performance: {
    planningTime?: number;
    executionTime: number;
    bufferHits?: number;
    bufferReads?: number;
    indexScans?: number;
    seqScans?: number;
  };
  error?: {
    message: string;
    code: string;
    severity: 'ERROR' | 'WARNING' | 'NOTICE';
    hint?: string;
  };
  timestamp: Date;
}

export interface QueryPerformanceAlert {
  queryId: string;
  alertType: 'slow_query' | 'high_resource_usage' | 'missing_index' | 'inefficient_query';
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  actualValue: number;
  recommendation: string;
  organizationId?: string;
}

export interface QueryStats {
  organizationId?: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number; // queries > 1000ms
  errorQueries: number;
  queryTypes: Record<QueryType, number>;
  topSlowQueries: Array<{
    query: string;
    avgExecutionTime: number;
    count: number;
  }>;
  topErrorQueries: Array<{
    query: string;
    errorCount: number;
    lastError: string;
  }>;
  tableStats: Record<string, {
    queries: number;
    avgTime: number;
    errors: number;
  }>;
}

class QueryLogger {
  private supabase = createSupabaseAdminClient();
  private logger = structuredLogger.forComponent('query-logger', 'database');
  private slowQueryThreshold = 1000; // milliseconds
  private enableQueryLogging = process.env.ENABLE_QUERY_LOGGING !== 'false';
  private logOnlySlowQueries = process.env.LOG_ONLY_SLOW_QUERIES === 'true';

  constructor() {
    this.setupPerformanceAlerts();
  }

  /**
   * Log a database query
   */
  async logQuery(query: DatabaseQuery): Promise<void> {
    if (!this.enableQueryLogging) return;

    // Only log slow queries if configured
    if (this.logOnlySlowQueries && query.executionTime < this.slowQueryThreshold) {
      return;
    }

    const queryId = query.id || this.generateQueryId();
    const isSlowQuery = query.executionTime > this.slowQueryThreshold;

    try {
      // Track performance metrics
      performanceMonitor.trackDatabaseQuery({
        queryType: query.type,
        table: query.table,
        duration: query.executionTime,
        organizationId: query.organizationId,
        rowsAffected: query.rowsAffected,
        query: this.sanitizeQuery(query.query),
        timestamp: query.timestamp,
      });

      // Log to structured logger
      const logLevel = query.error ? 'error' : isSlowQuery ? 'warn' : 'debug';
      
      this.logger[logLevel](`Database Query: ${query.type} ${query.table}`, {
        service: 'database',
        component: 'query-executor',
        operation: `db-${query.type.toLowerCase()}`,
        duration: query.executionTime,
        error: query.error,
        additionalData: {
          queryId,
          table: query.table,
          rowsAffected: query.rowsAffected,
          isSlowQuery,
          planningTime: query.performance.planningTime,
          bufferHits: query.performance.bufferHits,
          bufferReads: query.performance.bufferReads,
        },
      }, {
        organizationId: query.organizationId,
        userId: query.userId,
        requestId: query.context?.requestId,
        traceId: query.context?.traceId,
        sessionId: query.context?.sessionId,
      });

      // Store detailed query log in database for analysis
      await this.storeQueryLog(queryId, query);

      // Check for performance alerts
      if (isSlowQuery || query.error) {
        await this.checkPerformanceAlerts(query);
      }

    } catch (error) {
      this.logger.error('Failed to log database query', {
        service: 'database',
        component: 'query-logger',
        operation: 'log-query-failed',
        error: error as Error,
        additionalData: {
          queryType: query.type,
          table: query.table,
        },
      });
    }
  }

  /**
   * Create a query timer for measuring execution time
   */
  startQueryTimer(): {
    end: (queryInfo: Omit<DatabaseQuery, 'executionTime' | 'timestamp'>) => Promise<void>;
  } {
    const startTime = process.hrtime.bigint();
    
    return {
      end: async (queryInfo: Omit<DatabaseQuery, 'executionTime' | 'timestamp'>) => {
        const endTime = process.hrtime.bigint();
        const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        await this.logQuery({
          ...queryInfo,
          executionTime,
          timestamp: new Date(),
        });
      },
    };
  }

  /**
   * Wrapper for logging Supabase queries
   */
  async logSupabaseQuery<T>(
    queryBuilder: any,
    context?: {
      table: string;
      operation: string;
      organizationId?: string;
      userId?: string;
      requestContext?: DatabaseQuery['context'];
    }
  ): Promise<T> {
    const timer = this.startQueryTimer();
    const startTime = Date.now();

    try {
      const result = await queryBuilder;
      const executionTime = Date.now() - startTime;

      // Extract query information from Supabase result
      const queryType = this.extractQueryType(context?.operation || 'SELECT');
      
      await timer.end({
        type: queryType,
        table: context?.table || 'unknown',
        query: this.extractQueryFromBuilder(queryBuilder),
        rowsAffected: this.extractRowsAffected(result),
        organizationId: context?.organizationId,
        userId: context?.userId,
        context: context?.requestContext,
        performance: {
          executionTime,
        },
        error: result.error ? {
          message: result.error.message,
          code: result.error.code || 'UNKNOWN',
          severity: 'ERROR' as const,
          hint: result.error.hint,
        } : undefined,
      });

      if (result.error) {
        throw result.error;
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      await timer.end({
        type: this.extractQueryType(context?.operation || 'SELECT'),
        table: context?.table || 'unknown',
        query: this.extractQueryFromBuilder(queryBuilder),
        rowsAffected: 0,
        organizationId: context?.organizationId,
        userId: context?.userId,
        context: context?.requestContext,
        performance: {
          executionTime,
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_ERROR',
          severity: 'ERROR' as const,
        },
      });

      throw error;
    }
  }

  /**
   * Get query performance statistics
   */
  async getQueryStats(
    organizationId?: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<QueryStats> {
    const periodStart = this.getPeriodStart(period);

    try {
      let query = this.supabase
        .from('query_performance_logs')
        .select('*')
        .gte('created_at', periodStart.toISOString());

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.limit(10000); // Reasonable limit

      if (error) {
        throw error;
      }

      const logs = data || [];
      
      // Calculate statistics
      const totalQueries = logs.length;
      const totalExecutionTime = logs.reduce((sum, log) => sum + log.execution_time_ms, 0);
      const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
      
      const slowQueries = logs.filter(log => log.execution_time_ms > this.slowQueryThreshold).length;
      const errorQueries = logs.filter(log => log.error_message).length;

      // Group by query type
      const queryTypes: Record<QueryType, number> = {} as Record<QueryType, number>;
      logs.forEach(log => {
        queryTypes[log.query_type as QueryType] = (queryTypes[log.query_type as QueryType] || 0) + 1;
      });

      // Top slow queries
      const queryPerformanceMap = new Map<string, { totalTime: number; count: number }>();
      logs.forEach(log => {
        const normalizedQuery = this.normalizeQuery(log.query_text);
        const existing = queryPerformanceMap.get(normalizedQuery) || { totalTime: 0, count: 0 };
        queryPerformanceMap.set(normalizedQuery, {
          totalTime: existing.totalTime + log.execution_time_ms,
          count: existing.count + 1,
        });
      });

      const topSlowQueries = Array.from(queryPerformanceMap.entries())
        .map(([query, stats]) => ({
          query,
          avgExecutionTime: stats.totalTime / stats.count,
          count: stats.count,
        }))
        .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
        .slice(0, 10);

      // Top error queries
      const errorQueryMap = new Map<string, { count: number; lastError: string }>();
      logs.filter(log => log.error_message).forEach(log => {
        const normalizedQuery = this.normalizeQuery(log.query_text);
        errorQueryMap.set(normalizedQuery, {
          count: (errorQueryMap.get(normalizedQuery)?.count || 0) + 1,
          lastError: log.error_message,
        });
      });

      const topErrorQueries = Array.from(errorQueryMap.entries())
        .map(([query, stats]) => ({
          query,
          errorCount: stats.count,
          lastError: stats.lastError,
        }))
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 10);

      // Table statistics
      const tableStats: Record<string, { queries: number; avgTime: number; errors: number }> = {};
      logs.forEach(log => {
        const table = log.table_name;
        if (!tableStats[table]) {
          tableStats[table] = { queries: 0, avgTime: 0, errors: 0 };
        }
        tableStats[table].queries += 1;
        tableStats[table].avgTime += log.execution_time_ms;
        if (log.error_message) {
          tableStats[table].errors += 1;
        }
      });

      // Calculate average times
      Object.values(tableStats).forEach(stats => {
        stats.avgTime = stats.queries > 0 ? stats.avgTime / stats.queries : 0;
      });

      return {
        organizationId,
        period,
        totalQueries,
        averageExecutionTime,
        slowQueries,
        errorQueries,
        queryTypes,
        topSlowQueries,
        topErrorQueries,
        tableStats,
      };
    } catch (error) {
      this.logger.error('Failed to get query stats', {
        service: 'database',
        component: 'query-logger',
        operation: 'get-stats-failed',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Get slow queries that need optimization
   */
  async getSlowQueries(
    organizationId?: string,
    limit: number = 50
  ): Promise<Array<{
    query: string;
    table: string;
    avgExecutionTime: number;
    count: number;
    lastSeen: Date;
    recommendation: string;
  }>> {
    try {
      let query = this.supabase
        .from('query_performance_logs')
        .select('*')
        .gte('execution_time_ms', this.slowQueryThreshold)
        .order('execution_time_ms', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.limit(limit * 2); // Get more to deduplicate

      if (error) {
        throw error;
      }

      // Group similar queries
      const queryGroups = new Map<string, {
        queries: any[];
        totalTime: number;
        count: number;
      }>();

      (data || []).forEach(log => {
        const normalizedQuery = this.normalizeQuery(log.query_text);
        const existing = queryGroups.get(normalizedQuery) || {
          queries: [],
          totalTime: 0,
          count: 0,
        };
        
        existing.queries.push(log);
        existing.totalTime += log.execution_time_ms;
        existing.count += 1;
        
        queryGroups.set(normalizedQuery, existing);
      });

      return Array.from(queryGroups.entries())
        .map(([normalizedQuery, group]) => {
          const latestQuery = group.queries[group.queries.length - 1];
          return {
            query: normalizedQuery,
            table: latestQuery.table_name,
            avgExecutionTime: group.totalTime / group.count,
            count: group.count,
            lastSeen: new Date(latestQuery.created_at),
            recommendation: this.generateOptimizationRecommendation(latestQuery),
          };
        })
        .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get slow queries', {
        service: 'database',
        component: 'query-logger',
        operation: 'get-slow-queries-failed',
        error: error as Error,
      });
      return [];
    }
  }

  /**
   * Store query log in database
   */
  private async storeQueryLog(queryId: string, query: DatabaseQuery): Promise<void> {
    const { error } = await this.supabase
      .from('query_performance_logs')
      .insert({
        id: queryId,
        query_type: query.type,
        table_name: query.table,
        query_text: this.sanitizeQuery(query.query),
        parameters: query.parameters,
        execution_time_ms: query.executionTime,
        rows_affected: query.rowsAffected,
        organization_id: query.organizationId,
        user_id: query.userId,
        
        // Context
        operation: query.context?.operation,
        component: query.context?.component,
        request_id: query.context?.requestId,
        trace_id: query.context?.traceId,
        session_id: query.context?.sessionId,
        
        // Performance metrics
        planning_time_ms: query.performance.planningTime,
        buffer_hits: query.performance.bufferHits,
        buffer_reads: query.performance.bufferReads,
        index_scans: query.performance.indexScans,
        seq_scans: query.performance.seqScans,
        
        // Error information
        error_message: query.error?.message,
        error_code: query.error?.code,
        error_severity: query.error?.severity,
        error_hint: query.error?.hint,
        
        created_at: query.timestamp.toISOString(),
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(query: DatabaseQuery): Promise<void> {
    const alerts: QueryPerformanceAlert[] = [];

    // Slow query alert
    if (query.executionTime > this.slowQueryThreshold) {
      alerts.push({
        queryId: query.id || 'unknown',
        alertType: 'slow_query',
        severity: query.executionTime > 5000 ? 'critical' : query.executionTime > 3000 ? 'high' : 'medium',
        threshold: this.slowQueryThreshold,
        actualValue: query.executionTime,
        recommendation: this.generateOptimizationRecommendation(query),
        organizationId: query.organizationId,
      });
    }

    // High sequential scan alert
    if (query.performance.seqScans && query.performance.seqScans > 0) {
      alerts.push({
        queryId: query.id || 'unknown',
        alertType: 'missing_index',
        severity: 'medium',
        threshold: 0,
        actualValue: query.performance.seqScans,
        recommendation: `Consider adding an index to table '${query.table}' for better performance`,
        organizationId: query.organizationId,
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processPerformanceAlert(alert);
    }
  }

  /**
   * Process a performance alert
   */
  private async processPerformanceAlert(alert: QueryPerformanceAlert): Promise<void> {
    this.logger.warn(`Query Performance Alert: ${alert.alertType}`, {
      service: 'database',
      component: 'query-logger',
      operation: 'performance-alert',
      additionalData: {
        alertType: alert.alertType,
        severity: alert.severity,
        threshold: alert.threshold,
        actualValue: alert.actualValue,
        recommendation: alert.recommendation,
      },
    }, {
      organizationId: alert.organizationId,
    });

    // Store alert for monitoring dashboard
    await this.supabase
      .from('query_performance_alerts')
      .insert({
        query_id: alert.queryId,
        alert_type: alert.alertType,
        severity: alert.severity,
        threshold: alert.threshold,
        actual_value: alert.actualValue,
        recommendation: alert.recommendation,
        organization_id: alert.organizationId,
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendation(query: any): string {
    const recommendations = [];

    if (query.execution_time_ms > 5000) {
      recommendations.push('Consider breaking down complex queries into simpler ones');
    }

    if (query.seq_scans > 0) {
      recommendations.push(`Add indexes to table '${query.table_name}' for frequently queried columns`);
    }

    if (query.buffer_reads && query.buffer_hits && query.buffer_reads > query.buffer_hits) {
      recommendations.push('Consider increasing shared_buffers configuration');
    }

    if (query.query_text?.includes('SELECT *')) {
      recommendations.push('Select only needed columns instead of using SELECT *');
    }

    if (query.query_text?.includes('LIKE %')) {
      recommendations.push('Consider using full-text search instead of LIKE with leading wildcards');
    }

    return recommendations.join('. ') || 'Review query structure and consider adding appropriate indexes.';
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceAlerts(): void {
    // This could be extended to set up automated alerts, notifications, etc.
    this.logger.info('Query performance monitoring initialized', {
      service: 'database',
      component: 'query-logger',
      operation: 'setup-alerts',
      additionalData: {
        slowQueryThreshold: this.slowQueryThreshold,
        enableQueryLogging: this.enableQueryLogging,
        logOnlySlowQueries: this.logOnlySlowQueries,
      },
    });
  }

  /**
   * Utility methods
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from query strings
    return query
      .replace(/('.*?')/g, "'***'") // Replace string literals
      .replace(/(\$\d+)/g, '$***') // Replace parameters
      .slice(0, 1000); // Limit length
  }

  private normalizeQuery(query: string): string {
    // Normalize query for grouping similar queries
    return query
      .replace(/('.*?')/g, "'?'")
      .replace(/(\$\d+)/g, '$?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private extractQueryType(operation: string): QueryType {
    const op = operation.toUpperCase();
    if (op.includes('SELECT') || op.includes('QUERY')) return 'SELECT';
    if (op.includes('INSERT')) return 'INSERT';
    if (op.includes('UPDATE')) return 'UPDATE';
    if (op.includes('DELETE')) return 'DELETE';
    if (op.includes('UPSERT')) return 'UPSERT';
    if (op.includes('RPC') || op.includes('FUNCTION')) return 'RPC';
    return 'SELECT';
  }

  private extractQueryFromBuilder(builder: any): string {
    // This is a simplified extraction - in practice, you'd need more sophisticated parsing
    return builder?.toString?.() || 'Unknown query';
  }

  private extractRowsAffected(result: any): number {
    if (result.data && Array.isArray(result.data)) {
      return result.data.length;
    }
    if (result.count !== null && result.count !== undefined) {
      return result.count;
    }
    return 0;
  }

  private getPeriodStart(period: 'hour' | 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

// Singleton instance
export const queryLogger = new QueryLogger();
export default queryLogger;