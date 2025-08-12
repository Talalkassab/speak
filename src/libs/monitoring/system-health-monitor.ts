import { trace } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { EventEmitter } from 'events';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from './error-tracker';
import * as os from 'os';
import * as fs from 'fs/promises';

// Prometheus metrics for system health
const systemCpuUsage = new promClient.Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
});

const systemMemoryUsage = new promClient.Gauge({
  name: 'system_memory_usage_percent',
  help: 'System memory usage percentage',
});

const systemLoadAverage = new promClient.Gauge({
  name: 'system_load_average',
  help: 'System load average',
  labelNames: ['period'], // 1m, 5m, 15m
});

const systemDiskUsage = new promClient.Gauge({
  name: 'system_disk_usage_percent',
  help: 'System disk usage percentage',
  labelNames: ['mount_point'],
});

const nodeEventLoopLag = new promClient.Gauge({
  name: 'nodejs_event_loop_lag_ms',
  help: 'Node.js event loop lag in milliseconds',
});

const nodeHeapUsage = new promClient.Gauge({
  name: 'nodejs_heap_usage_bytes',
  help: 'Node.js heap usage in bytes',
  labelNames: ['type'], // used, total, external
});

const nodeGcDuration = new promClient.Histogram({
  name: 'nodejs_gc_duration_seconds',
  help: 'Node.js garbage collection duration',
  labelNames: ['type'], // scavenge, mark_sweep_compact, etc.
  buckets: [0.001, 0.01, 0.1, 1, 10],
});

const databaseConnectionPool = new promClient.Gauge({
  name: 'database_connection_pool_active',
  help: 'Active database connections',
});

const externalServiceHealth = new promClient.Gauge({
  name: 'external_service_health',
  help: 'External service health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
});

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    loadAverage: number[]; // 1m, 5m, 15m
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage_percent: number;
  };
  disk: {
    usage_percent: number;
    available_gb: number;
    total_gb: number;
  };
  network: {
    bytes_sent: number;
    bytes_received: number;
  };
  process: {
    memory: NodeJS.MemoryUsage;
    cpu_usage: number;
    event_loop_lag: number;
    uptime: number;
    pid: number;
  };
  database: {
    active_connections: number;
    query_duration_avg: number;
    health_status: 'healthy' | 'degraded' | 'unhealthy';
  };
  external_services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    response_time?: number;
    last_check: Date;
  }>;
}

export interface HealthAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'database' | 'service' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  threshold: number;
  current_value: number;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  type: HealthAlert['type'];
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: HealthAlert['severity'];
  enabled: boolean;
  cooldown_minutes: number; // Prevent alert spam
  actions: {
    log: boolean;
    webhook?: string;
    email?: string[];
    slack?: string;
  };
}

class SystemHealthMonitor extends EventEmitter {
  private tracer = trace.getTracer('system-health-monitor');
  private supabase = createSupabaseAdminClient();
  private monitoringInterval?: NodeJS.Timeout;
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  
  // Performance tracking
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();
  private eventLoopLag = 0;

  constructor() {
    super();
    this.initializeDefaultAlertRules();
    this.setupEventLoopMonitoring();
    this.setupGcMonitoring();
  }

  /**
   * Start system health monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stop();
    }

    structuredLogger.info('Starting system health monitoring', {
      service: 'system-health-monitor',
      component: 'monitor',
      operation: 'start',
      additionalData: { intervalMs }
    });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        structuredLogger.error('System health monitoring error', {
          service: 'system-health-monitor',
          component: 'monitor',
          operation: 'collect-metrics',
          error: error instanceof Error ? error : undefined
        });
      }
    }, intervalMs);

    // Initial collection
    this.collectMetrics().catch(error => {
      structuredLogger.error('Initial metrics collection failed', {
        service: 'system-health-monitor',
        component: 'monitor',
        operation: 'initial-collection',
        error: error instanceof Error ? error : undefined
      });
    });
  }

  /**
   * Stop system health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      
      structuredLogger.info('System health monitoring stopped', {
        service: 'system-health-monitor',
        component: 'monitor',
        operation: 'stop'
      });
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const startTime = Date.now();
    
    try {
      const [
        cpuMetrics,
        memoryMetrics,
        diskMetrics,
        processMetrics,
        databaseMetrics,
        externalServiceMetrics
      ] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
        this.getProcessMetrics(),
        this.getDatabaseMetrics(),
        this.getExternalServiceMetrics()
      ]);

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: cpuMetrics,
        memory: memoryMetrics,
        disk: diskMetrics,
        network: { bytes_sent: 0, bytes_received: 0 }, // Would implement with platform-specific APIs
        process: processMetrics,
        database: databaseMetrics,
        external_services: externalServiceMetrics
      };

      // Update Prometheus metrics
      this.updatePrometheusMetrics(metrics);

      // Check alert rules
      await this.checkAlertRules(metrics);

      // Store metrics in database for historical analysis
      await this.storeMetrics(metrics);

      this.emit('metrics', metrics);

      return metrics;
    } catch (error) {
      structuredLogger.error('Failed to collect system metrics', {
        service: 'system-health-monitor',
        component: 'metrics-collector',
        operation: 'collect-metrics',
        error: error instanceof Error ? error : undefined,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    return new Promise((resolve) => {
      const currentUsage = process.cpuUsage();
      const currentTime = Date.now();
      
      const userDiff = currentUsage.user - this.lastCpuUsage.user;
      const sysDiff = currentUsage.system - this.lastCpuUsage.system;
      const timeDiff = currentTime - this.lastCpuTime;
      
      const cpuPercent = ((userDiff + sysDiff) / (timeDiff * 1000)) * 100;
      
      this.lastCpuUsage = currentUsage;
      this.lastCpuTime = currentTime;

      resolve({
        usage: Math.min(cpuPercent, 100), // Cap at 100%
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      });
    });
  }

  /**
   * Get memory metrics
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage_percent: (usedMem / totalMem) * 100
    };
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      // Note: This is a simplified implementation
      // In production, you'd want to use proper disk usage libraries
      const stats = await fs.stat(process.cwd());
      
      return {
        usage_percent: 50, // Placeholder - implement proper disk usage check
        available_gb: 100, // Placeholder
        total_gb: 200 // Placeholder
      };
    } catch (error) {
      return {
        usage_percent: 0,
        available_gb: 0,
        total_gb: 0
      };
    }
  }

  /**
   * Get process metrics
   */
  private getProcessMetrics(): SystemMetrics['process'] {
    return {
      memory: process.memoryUsage(),
      cpu_usage: 0, // Would calculate from process.cpuUsage()
      event_loop_lag: this.eventLoopLag,
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const startTime = Date.now();
      
      // Test database connectivity and measure response time
      const { error } = await this.supabase
        .from('organizations')
        .select('count')
        .limit(1);

      const queryDuration = Date.now() - startTime;

      if (error) {
        return {
          active_connections: 0,
          query_duration_avg: queryDuration,
          health_status: 'unhealthy'
        };
      }

      return {
        active_connections: 1, // Simplified - would get from connection pool
        query_duration_avg: queryDuration,
        health_status: queryDuration < 100 ? 'healthy' : queryDuration < 1000 ? 'degraded' : 'unhealthy'
      };
    } catch (error) {
      return {
        active_connections: 0,
        query_duration_avg: 0,
        health_status: 'unhealthy'
      };
    }
  }

  /**
   * Get external service metrics
   */
  private async getExternalServiceMetrics(): Promise<SystemMetrics['external_services']> {
    const services = [];

    // Check OpenRouter API
    if (process.env.OPENROUTER_API_KEY) {
      services.push({
        name: 'openrouter',
        status: 'healthy' as const, // Simplified - would do actual health check
        response_time: 100,
        last_check: new Date()
      });
    }

    // Add other external services as needed

    return services;
  }

  /**
   * Update Prometheus metrics
   */
  private updatePrometheusMetrics(metrics: SystemMetrics): void {
    // System metrics
    systemCpuUsage.set(metrics.cpu.usage);
    systemMemoryUsage.set(metrics.memory.usage_percent);
    
    metrics.cpu.loadAverage.forEach((load, index) => {
      const periods = ['1m', '5m', '15m'];
      systemLoadAverage.set({ period: periods[index] }, load);
    });

    systemDiskUsage.set({ mount_point: '/' }, metrics.disk.usage_percent);

    // Node.js metrics
    nodeEventLoopLag.set(metrics.process.event_loop_lag);
    
    const memUsage = metrics.process.memory;
    nodeHeapUsage.set({ type: 'used' }, memUsage.heapUsed);
    nodeHeapUsage.set({ type: 'total' }, memUsage.heapTotal);
    nodeHeapUsage.set({ type: 'external' }, memUsage.external);

    // Database metrics
    databaseConnectionPool.set(metrics.database.active_connections);

    // External service metrics
    metrics.external_services.forEach(service => {
      externalServiceHealth.set(
        { service: service.name },
        service.status === 'healthy' ? 1 : 0
      );
    });
  }

  /**
   * Check alert rules against current metrics
   */
  private async checkAlertRules(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = this.evaluateAlertRule(rule, metrics);
        
        if (shouldAlert) {
          await this.triggerAlert(rule, metrics);
        }
      } catch (error) {
        structuredLogger.error('Alert rule evaluation failed', {
          service: 'system-health-monitor',
          component: 'alert-engine',
          operation: 'evaluate-rule',
          error: error instanceof Error ? error : undefined,
          additionalData: { ruleId: rule.id, ruleName: rule.name }
        });
      }
    }
  }

  /**
   * Evaluate if alert rule should trigger
   */
  private evaluateAlertRule(rule: AlertRule, metrics: SystemMetrics): boolean {
    let value: number;

    // Get metric value based on rule type and metric name
    switch (rule.type) {
      case 'cpu':
        value = rule.metric === 'usage' ? metrics.cpu.usage : 0;
        break;
      case 'memory':
        value = rule.metric === 'usage' ? metrics.memory.usage_percent : 0;
        break;
      case 'disk':
        value = rule.metric === 'usage' ? metrics.disk.usage_percent : 0;
        break;
      case 'database':
        value = rule.metric === 'response_time' ? metrics.database.query_duration_avg : 0;
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (rule.condition) {
      case 'gt': return value > rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'lte': return value <= rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }

  /**
   * Trigger alert for rule
   */
  private async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    // Check cooldown period
    const lastAlert = this.lastAlertTime.get(rule.id);
    if (lastAlert) {
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      if (Date.now() - lastAlert.getTime() < cooldownMs) {
        return; // Still in cooldown
      }
    }

    const alertId = `${rule.id}_${Date.now()}`;
    const alert: HealthAlert = {
      id: alertId,
      type: rule.type,
      severity: rule.severity,
      title: `${rule.name} Alert`,
      message: `Alert triggered: ${rule.name}`,
      threshold: rule.threshold,
      current_value: 0, // Would calculate based on rule
      timestamp: new Date(),
      resolved: false,
      metadata: { ruleId: rule.id, metrics }
    };

    this.activeAlerts.set(alertId, alert);
    this.lastAlertTime.set(rule.id, new Date());

    // Execute alert actions
    if (rule.actions.log) {
      structuredLogger.warn('System health alert triggered', {
        service: 'system-health-monitor',
        component: 'alert-engine',
        operation: 'alert-triggered',
        additionalData: {
          alertId,
          ruleName: rule.name,
          severity: rule.severity,
          threshold: rule.threshold
        }
      });
    }

    // Store alert in database
    try {
      await this.supabase
        .from('system_alerts')
        .insert({
          id: alertId,
          rule_id: rule.id,
          rule_name: rule.name,
          alert_type: rule.type,
          severity: rule.severity,
          title: alert.title,
          message: alert.message,
          threshold: rule.threshold,
          current_value: alert.current_value,
          resolved: false,
          metadata: alert.metadata,
          created_at: alert.timestamp.toISOString()
        });
    } catch (error) {
      structuredLogger.error('Failed to store alert', {
        service: 'system-health-monitor',
        component: 'alert-engine',
        operation: 'store-alert',
        error: error instanceof Error ? error : undefined
      });
    }

    this.emit('alert', alert);

    // TODO: Implement webhook, email, Slack notifications
    // if (rule.actions.webhook) await this.sendWebhookAlert(rule.actions.webhook, alert);
    // if (rule.actions.email) await this.sendEmailAlert(rule.actions.email, alert);
    // if (rule.actions.slack) await this.sendSlackAlert(rule.actions.slack, alert);
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await this.supabase
        .from('system_metrics')
        .insert({
          timestamp: metrics.timestamp.toISOString(),
          cpu_usage: metrics.cpu.usage,
          memory_usage: metrics.memory.usage_percent,
          disk_usage: metrics.disk.usage_percent,
          load_average: metrics.cpu.loadAverage,
          heap_used: metrics.process.memory.heapUsed,
          heap_total: metrics.process.memory.heapTotal,
          event_loop_lag: metrics.process.event_loop_lag,
          database_response_time: metrics.database.query_duration_avg,
          database_status: metrics.database.health_status,
          external_services: metrics.external_services
        });
    } catch (error) {
      // Don't throw - metrics storage failure shouldn't break monitoring
      structuredLogger.error('Failed to store system metrics', {
        service: 'system-health-monitor',
        component: 'metrics-storage',
        operation: 'store-metrics',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  /**
   * Setup event loop monitoring
   */
  private setupEventLoopMonitoring(): void {
    setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        this.eventLoopLag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      });
    }, 1000);
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGcMonitoring(): void {
    try {
      const v8 = require('v8');
      const performanceHooks = require('perf_hooks');
      
      const obs = new performanceHooks.PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name.startsWith('gc')) {
            nodeGcDuration.observe(
              { type: entry.detail?.kind || 'unknown' },
              entry.duration / 1000 // Convert to seconds
            );
          }
        });
      });
      
      obs.observe({ entryTypes: ['gc'] });
    } catch (error) {
      // GC monitoring not available in this Node.js version
      structuredLogger.debug('GC monitoring not available', {
        service: 'system-health-monitor',
        component: 'gc-monitor',
        operation: 'setup'
      });
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'cpu-high',
        name: 'High CPU Usage',
        type: 'cpu',
        metric: 'usage',
        condition: 'gt',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldown_minutes: 5,
        actions: { log: true }
      },
      {
        id: 'memory-high',
        name: 'High Memory Usage',
        type: 'memory',
        metric: 'usage',
        condition: 'gt',
        threshold: 85,
        severity: 'high',
        enabled: true,
        cooldown_minutes: 5,
        actions: { log: true }
      },
      {
        id: 'database-slow',
        name: 'Slow Database Response',
        type: 'database',
        metric: 'response_time',
        condition: 'gt',
        threshold: 1000,
        severity: 'medium',
        enabled: true,
        cooldown_minutes: 10,
        actions: { log: true }
      }
    ];
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: SystemMetrics;
    active_alerts: HealthAlert[];
  }> {
    const metrics = await this.collectMetrics();
    const activeAlerts = Array.from(this.activeAlerts.values());
    
    // Determine overall status
    const hasUnhealthy = activeAlerts.some(alert => alert.severity === 'critical');
    const hasDegraded = activeAlerts.some(alert => alert.severity === 'high' || alert.severity === 'medium');
    
    const status = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    return {
      status,
      metrics,
      active_alerts: activeAlerts
    };
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(hours: number = 24): Promise<SystemMetrics[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    try {
      const { data, error } = await this.supabase
        .from('system_metrics')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp');

      if (error) throw error;

      return (data || []).map(record => ({
        timestamp: new Date(record.timestamp),
        cpu: {
          usage: record.cpu_usage,
          loadAverage: record.load_average || [0, 0, 0],
          cores: os.cpus().length
        },
        memory: {
          total: os.totalmem(),
          used: 0,
          free: 0,
          usage_percent: record.memory_usage
        },
        disk: {
          usage_percent: record.disk_usage,
          available_gb: 0,
          total_gb: 0
        },
        network: { bytes_sent: 0, bytes_received: 0 },
        process: {
          memory: {
            heapUsed: record.heap_used,
            heapTotal: record.heap_total,
            external: 0,
            rss: 0,
            arrayBuffers: 0
          },
          cpu_usage: 0,
          event_loop_lag: record.event_loop_lag,
          uptime: process.uptime(),
          pid: process.pid
        },
        database: {
          active_connections: 0,
          query_duration_avg: record.database_response_time,
          health_status: record.database_status as any
        },
        external_services: record.external_services || []
      }));
    } catch (error) {
      structuredLogger.error('Failed to get historical metrics', {
        service: 'system-health-monitor',
        component: 'metrics-query',
        operation: 'get-historical-metrics',
        error: error instanceof Error ? error : undefined
      });
      return [];
    }
  }
}

// Export singleton instance
export const systemHealthMonitor = new SystemHealthMonitor();

// Export types
export type { SystemMetrics, HealthAlert, AlertRule };

export default systemHealthMonitor;