import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { supabaseAdminClient } from '../supabase/supabase-admin';

// Prometheus metrics for errors
const errorCount = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'severity', 'service', 'organization_id', 'route'],
});

const errorRate = new promClient.Gauge({
  name: 'error_rate',
  help: 'Error rate over time',
  labelNames: ['service', 'time_window'],
});

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorType = 
  | 'validation_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'database_error'
  | 'api_error'
  | 'openrouter_error'
  | 'file_processing_error'
  | 'rate_limit_error'
  | 'system_error'
  | 'unknown_error';

export interface ErrorInfo {
  id?: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  error?: Error;
  context?: {
    userId?: string;
    organizationId?: string;
    requestId?: string;
    route?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    additionalData?: Record<string, any>;
  };
  timestamp?: Date;
  stackTrace?: string;
  service: string;
  resolved?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    errorType?: ErrorType;
    severity?: ErrorSeverity;
    threshold: number;
    timeWindow: number; // minutes
  };
  actions: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  enabled: boolean;
}

class ErrorTracker {
  private tracer = trace.getTracer('hr-rag-platform-errors');
  private supabase = createSupabaseAdminClient();
  private recentErrors: Map<string, number> = new Map();
  private alertRules: AlertRule[] = [];

  constructor() {
    // Initialize error rate monitoring
    this.startErrorRateMonitoring();
    this.loadAlertRules();
  }

  /**
   * Track and log an error
   */
  async trackError(errorInfo: ErrorInfo): Promise<void> {
    const timestamp = errorInfo.timestamp || new Date();
    const errorId = errorInfo.id || this.generateErrorId();

    // Update Prometheus metrics
    const labels = {
      error_type: errorInfo.type,
      severity: errorInfo.severity,
      service: errorInfo.service,
      organization_id: errorInfo.context?.organizationId || 'unknown',
      route: errorInfo.context?.route || 'unknown',
    };
    errorCount.inc(labels);

    // Create OpenTelemetry span
    const span = this.tracer.startSpan(`Error: ${errorInfo.type}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'error.type': errorInfo.type,
        'error.severity': errorInfo.severity,
        'error.message': errorInfo.message,
        'error.id': errorId,
        'service.name': errorInfo.service,
        'organization.id': errorInfo.context?.organizationId,
        'user.id': errorInfo.context?.userId,
        'request.id': errorInfo.context?.requestId,
        'http.route': errorInfo.context?.route,
        'http.method': errorInfo.context?.method,
      },
    });

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errorInfo.message,
    });

    if (errorInfo.error) {
      span.recordException(errorInfo.error);
    }

    span.end();

    try {
      // Store error in database
      await this.storeError({
        ...errorInfo,
        id: errorId,
        timestamp,
        stackTrace: errorInfo.error?.stack || errorInfo.stackTrace,
      });

      // Check alert rules
      await this.checkAlertRules(errorInfo);

    } catch (dbError) {
      console.error('Failed to store error in database:', dbError);
    }
  }

  /**
   * Store error in Supabase
   */
  private async storeError(errorInfo: ErrorInfo): Promise<void> {
    const { error } = await this.supabase
      .from('error_logs')
      .insert({
        id: errorInfo.id,
        error_type: errorInfo.type,
        severity: errorInfo.severity,
        message: errorInfo.message,
        service: errorInfo.service,
        stack_trace: errorInfo.stackTrace,
        user_id: errorInfo.context?.userId,
        organization_id: errorInfo.context?.organizationId,
        request_id: errorInfo.context?.requestId,
        route: errorInfo.context?.route,
        method: errorInfo.context?.method,
        user_agent: errorInfo.context?.userAgent,
        ip_address: errorInfo.context?.ip,
        additional_data: errorInfo.context?.additionalData,
        resolved: errorInfo.resolved || false,
        created_at: errorInfo.timestamp?.toISOString(),
      });

    if (error) {
      console.error('Failed to store error:', error);
    }
  }

  /**
   * Create error with automatic context detection
   */
  async createError(
    type: ErrorType,
    message: string,
    error?: Error,
    context?: Partial<ErrorInfo['context']>
  ): Promise<void> {
    const severity = this.determineSeverity(type, error);
    
    await this.trackError({
      type,
      severity,
      message,
      error,
      context,
      service: this.detectService(context?.route),
    });
  }

  /**
   * Determine error severity based on type and error details
   */
  private determineSeverity(type: ErrorType, error?: Error): ErrorSeverity {
    // Critical errors
    if (type === 'database_error' || type === 'system_error') {
      return 'critical';
    }

    // High severity errors
    if (type === 'authentication_error' || type === 'authorization_error') {
      return 'high';
    }

    // Medium severity errors
    if (type === 'api_error' || type === 'openrouter_error' || type === 'file_processing_error') {
      return 'medium';
    }

    // Low severity by default
    return 'low';
  }

  /**
   * Detect service based on route
   */
  private detectService(route?: string): string {
    if (!route) return 'unknown';

    if (route.includes('/api/rag/')) return 'rag-service';
    if (route.includes('/api/documents/')) return 'document-service';
    if (route.includes('/api/chat/')) return 'chat-service';
    if (route.includes('/api/v1/')) return 'api-v1';
    if (route.includes('/api/')) return 'api';

    return 'web';
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load alert rules from database
   */
  private async loadAlertRules(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true);

      if (error) {
        console.error('Failed to load alert rules:', error);
        return;
      }

      this.alertRules = data || [];
    } catch (error) {
      console.error('Error loading alert rules:', error);
    }
  }

  /**
   * Check if error triggers any alert rules
   */
  private async checkAlertRules(errorInfo: ErrorInfo): Promise<void> {
    for (const rule of this.alertRules) {
      if (this.matchesAlertRule(errorInfo, rule)) {
        const recentErrorCount = await this.getRecentErrorCount(rule);
        
        if (recentErrorCount >= rule.condition.threshold) {
          await this.triggerAlert(rule, errorInfo, recentErrorCount);
        }
      }
    }
  }

  /**
   * Check if error matches alert rule conditions
   */
  private matchesAlertRule(errorInfo: ErrorInfo, rule: AlertRule): boolean {
    if (rule.condition.errorType && rule.condition.errorType !== errorInfo.type) {
      return false;
    }

    if (rule.condition.severity && rule.condition.severity !== errorInfo.severity) {
      return false;
    }

    return true;
  }

  /**
   * Get recent error count for alert rule
   */
  private async getRecentErrorCount(rule: AlertRule): Promise<number> {
    const timeWindow = new Date(Date.now() - rule.condition.timeWindow * 60 * 1000);
    
    try {
      let query = this.supabase
        .from('error_logs')
        .select('id', { count: 'exact' })
        .gte('created_at', timeWindow.toISOString());

      if (rule.condition.errorType) {
        query = query.eq('error_type', rule.condition.errorType);
      }

      if (rule.condition.severity) {
        query = query.eq('severity', rule.condition.severity);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Failed to get recent error count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting recent error count:', error);
      return 0;
    }
  }

  /**
   * Trigger alert for rule
   */
  private async triggerAlert(
    rule: AlertRule,
    errorInfo: ErrorInfo,
    errorCount: number
  ): Promise<void> {
    console.log(`Alert triggered: ${rule.name} (${errorCount} errors)`);
    
    // TODO: Implement actual alerting (email, webhook, Slack)
    // For now, just log the alert
    
    // Store alert in database
    await this.supabase
      .from('alerts')
      .insert({
        rule_id: rule.id,
        rule_name: rule.name,
        error_type: errorInfo.type,
        severity: errorInfo.severity,
        error_count: errorCount,
        organization_id: errorInfo.context?.organizationId,
        triggered_at: new Date().toISOString(),
      });
  }

  /**
   * Start monitoring error rates
   */
  private startErrorRateMonitoring(): void {
    setInterval(() => {
      this.updateErrorRates();
    }, 60000); // Every minute
  }

  /**
   * Update error rate metrics
   */
  private updateErrorRates(): void {
    // Calculate error rates for different time windows
    const timeWindows = [5, 15, 30, 60]; // minutes

    timeWindows.forEach(window => {
      const errorCount = this.getErrorCountInWindow(window);
      errorRate.set(
        { service: 'all', time_window: `${window}m` },
        errorCount / window // errors per minute
      );
    });
  }

  /**
   * Get error count in time window
   */
  private getErrorCountInWindow(windowMinutes: number): number {
    const windowKey = `window_${windowMinutes}`;
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60 * 1000);

    let count = 0;
    this.recentErrors.forEach((timestamp, key) => {
      if (timestamp >= windowStart) {
        count++;
      }
    });

    return count;
  }

  /**
   * Get error statistics
   */
  async getErrorStats(organizationId?: string): Promise<{
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorInfo[];
  }> {
    try {
      let query = this.supabase
        .from('error_logs')
        .select('*');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      const errors = data || [];
      
      const errorsByType: Record<string, number> = {};
      const errorsBySeverity: Record<string, number> = {};

      errors.forEach(error => {
        errorsByType[error.error_type] = (errorsByType[error.error_type] || 0) + 1;
        errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      });

      return {
        totalErrors: errors.length,
        errorsByType: errorsByType as Record<ErrorType, number>,
        errorsBySeverity: errorsBySeverity as Record<ErrorSeverity, number>,
        recentErrors: errors.slice(0, 10).map(this.mapDbErrorToErrorInfo),
      };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        totalErrors: 0,
        errorsByType: {} as Record<ErrorType, number>,
        errorsBySeverity: {} as Record<ErrorSeverity, number>,
        recentErrors: [],
      };
    }
  }

  /**
   * Map database error to ErrorInfo
   */
  private mapDbErrorToErrorInfo(dbError: any): ErrorInfo {
    return {
      id: dbError.id,
      type: dbError.error_type,
      severity: dbError.severity,
      message: dbError.message,
      service: dbError.service,
      timestamp: new Date(dbError.created_at),
      context: {
        userId: dbError.user_id,
        organizationId: dbError.organization_id,
        requestId: dbError.request_id,
        route: dbError.route,
        method: dbError.method,
        userAgent: dbError.user_agent,
        ip: dbError.ip_address,
        additionalData: dbError.additional_data,
      },
      resolved: dbError.resolved,
    };
  }

  /**
   * Mark error as resolved
   */
  async resolveError(errorId: string): Promise<void> {
    const { error } = await this.supabase
      .from('error_logs')
      .update({ resolved: true })
      .eq('id', errorId);

    if (error) {
      console.error('Failed to resolve error:', error);
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();
export default errorTracker;