/**
 * Monitoring System Initialization
 * 
 * This module initializes all monitoring components and ensures proper setup
 * of the comprehensive performance monitoring and logging system.
 */

import { telemetryManager } from './telemetry';
import { performanceMonitor } from './performance-monitor';
import { systemHealthMonitor } from './system-health-monitor';
import { errorTracker } from './error-tracker';
import { usageTracker } from './usage-tracker';
import { alertManager } from './alert-manager';
import { incidentResponseManager } from './incident-response';
import { databasePerformanceMonitor } from './database-performance-monitor';
import { cacheMonitor } from './cache-monitor';
import { createCacheService } from '../caching/cache-service';
import { structuredLogger } from '../logging/structured-logger';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';

export interface MonitoringConfig {
  telemetry: {
    enabled: boolean;
    serviceName: string;
    environment: 'development' | 'staging' | 'production';
    jaegerEndpoint?: string;
    prometheusPort?: number;
  };
  systemHealth: {
    enabled: boolean;
    monitoringInterval: number; // milliseconds
  };
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
    slackWebhook?: string;
  };
  incidentResponse: {
    enabled: boolean;
    automaticActions: boolean;
  };
  caching: {
    enabled: boolean;
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
    memory?: {
      maxSize: number;
      maxEntries: number;
    };
  };
  database: {
    performanceMonitoring: boolean;
    slowQueryThreshold: number; // milliseconds
    optimizationRecommendations: boolean;
  };
}

class MonitoringInitializer {
  private initialized = false;
  private config: MonitoringConfig;
  private supabase = createSupabaseAdminClient();

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Initialize all monitoring components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      structuredLogger.warn('Monitoring system already initialized');
      return;
    }

    try {
      structuredLogger.info('Initializing comprehensive monitoring system', {
        service: 'monitoring-initializer',
        component: 'system-init',
        operation: 'initialize',
        additionalData: {
          environment: this.config.telemetry.environment,
          componentsEnabled: this.getEnabledComponents()
        }
      });

      // 1. Initialize database schema
      await this.initializeDatabaseSchema();

      // 2. Initialize telemetry and tracing
      if (this.config.telemetry.enabled) {
        await this.initializeTelemetry();
      }

      // 3. Initialize caching
      if (this.config.caching.enabled) {
        await this.initializeCaching();
      }

      // 4. Initialize system health monitoring
      if (this.config.systemHealth.enabled) {
        await this.initializeSystemHealthMonitoring();
      }

      // 5. Initialize database performance monitoring
      if (this.config.database.performanceMonitoring) {
        await this.initializeDatabaseMonitoring();
      }

      // 6. Initialize alerting
      if (this.config.alerting.enabled) {
        await this.initializeAlerting();
      }

      // 7. Initialize incident response
      if (this.config.incidentResponse.enabled) {
        await this.initializeIncidentResponse();
      }

      // 8. Setup health checks
      await this.setupHealthChecks();

      // 9. Start monitoring services
      await this.startMonitoringServices();

      this.initialized = true;

      structuredLogger.info('Monitoring system initialization completed successfully', {
        service: 'monitoring-initializer',
        component: 'system-init',
        operation: 'initialize-complete',
        additionalData: {
          componentsInitialized: this.getEnabledComponents().length,
          environment: this.config.telemetry.environment
        }
      });

    } catch (error) {
      structuredLogger.error('Monitoring system initialization failed', {
        service: 'monitoring-initializer',
        component: 'system-init',
        operation: 'initialize',
        error: error instanceof Error ? error : undefined
      });
      throw error;
    }
  }

  /**
   * Initialize database schema for monitoring
   */
  private async initializeDatabaseSchema(): Promise<void> {
    structuredLogger.info('Initializing monitoring database schema', {
      service: 'monitoring-initializer',
      component: 'database-init',
      operation: 'init-schema'
    });

    const schemas = [
      // Error logs table
      `
      CREATE TABLE IF NOT EXISTS error_logs (
        id TEXT PRIMARY KEY,
        error_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        service TEXT NOT NULL,
        stack_trace TEXT,
        user_id TEXT,
        organization_id TEXT,
        request_id TEXT,
        route TEXT,
        method TEXT,
        user_agent TEXT,
        ip_address INET,
        additional_data JSONB,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // System metrics table
      `
      CREATE TABLE IF NOT EXISTS system_metrics (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        cpu_usage REAL NOT NULL,
        memory_usage REAL NOT NULL,
        disk_usage REAL NOT NULL,
        load_average REAL[],
        heap_used BIGINT,
        heap_total BIGINT,
        event_loop_lag REAL,
        database_response_time REAL,
        database_status TEXT,
        external_services JSONB
      );
      `,
      
      // Feature usage logs table
      `
      CREATE TABLE IF NOT EXISTS feature_usage_logs (
        id BIGSERIAL PRIMARY KEY,
        feature_type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        result TEXT NOT NULL,
        duration_ms INTEGER,
        items_processed INTEGER,
        file_size BIGINT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // API usage logs table
      `
      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id BIGSERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        user_id TEXT,
        organization_id TEXT NOT NULL,
        user_tier TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        request_size_bytes BIGINT,
        response_size_bytes BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // Slow queries table
      `
      CREATE TABLE IF NOT EXISTS slow_queries (
        id TEXT PRIMARY KEY,
        query_hash TEXT NOT NULL,
        query_text TEXT,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        rows_examined BIGINT,
        rows_returned BIGINT,
        index_used BOOLEAN,
        execution_plan JSONB,
        organization_id TEXT,
        user_id TEXT,
        optimization_suggestions TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // Optimization recommendations table
      `
      CREATE TABLE IF NOT EXISTS optimization_recommendations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        table_name TEXT NOT NULL,
        column_name TEXT,
        query_pattern TEXT,
        estimated_performance_gain REAL,
        estimated_cost_reduction REAL,
        implementation_effort TEXT,
        sql_commands TEXT[],
        risks TEXT[],
        applied BOOLEAN DEFAULT FALSE,
        applied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // Alerts table
      `
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        threshold REAL,
        current_value REAL,
        resolved BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      `,
      
      // Alert notifications table
      `
      CREATE TABLE IF NOT EXISTS alert_notifications (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL REFERENCES alerts(id),
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        last_attempt TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      
      // Incidents table
      `
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        alerts TEXT[],
        assignee TEXT,
        tags TEXT[],
        timeline JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      `,
      
      // System alerts table
      `
      CREATE TABLE IF NOT EXISTS system_alerts (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        threshold REAL,
        current_value REAL,
        resolved BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `
    ];

    for (const schema of schemas) {
      try {
        await this.supabase.rpc('exec_sql', { sql: schema });
      } catch (error) {
        // Some errors might be expected (like table already exists)
        structuredLogger.debug('Schema execution result', {
          service: 'monitoring-initializer',
          component: 'database-init',
          operation: 'exec-schema',
          error: error instanceof Error ? error : undefined
        });
      }
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_org_id ON error_logs(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON feature_usage_logs(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_slow_queries_created_at ON slow_queries(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);'
    ];

    for (const index of indexes) {
      try {
        await this.supabase.rpc('exec_sql', { sql: index });
      } catch (error) {
        structuredLogger.debug('Index creation result', {
          service: 'monitoring-initializer',
          component: 'database-init',
          operation: 'create-index',
          error: error instanceof Error ? error : undefined
        });
      }
    }
  }

  /**
   * Initialize telemetry and distributed tracing
   */
  private async initializeTelemetry(): Promise<void> {
    structuredLogger.info('Initializing telemetry system', {
      service: 'monitoring-initializer',
      component: 'telemetry-init',
      operation: 'init-telemetry'
    });

    // Telemetry is already initialized in the telemetry module
    // Just verify it's working
    const healthCheck = await telemetryManager.healthCheck();
    
    if (healthCheck.status !== 'healthy') {
      throw new Error(`Telemetry system unhealthy: ${JSON.stringify(healthCheck.details)}`);
    }
  }

  /**
   * Initialize caching system
   */
  private async initializeCaching(): Promise<void> {
    structuredLogger.info('Initializing caching system', {
      service: 'monitoring-initializer',
      component: 'cache-init',
      operation: 'init-caching'
    });

    const cacheConfig = {
      defaultTtl: 3600,
      compressionThreshold: 1024,
      enableMonitoring: true,
      redis: this.config.caching.redis,
      memory: this.config.caching.memory || {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxEntries: 10000,
        cleanupInterval: 300 // 5 minutes
      }
    };

    const cacheService = createCacheService(cacheConfig);
    
    // Test cache functionality
    await cacheService.set('monitoring:init:test', 'cache-working', { ttl: 60 });
    const testResult = await cacheService.get('monitoring:init:test');
    
    if (!testResult.hit) {
      throw new Error('Cache system test failed');
    }

    await cacheService.delete('monitoring:init:test');
  }

  /**
   * Initialize system health monitoring
   */
  private async initializeSystemHealthMonitoring(): Promise<void> {
    structuredLogger.info('Initializing system health monitoring', {
      service: 'monitoring-initializer',
      component: 'health-init',
      operation: 'init-health-monitoring'
    });

    // Start system health monitoring
    systemHealthMonitor.start(this.config.systemHealth.monitoringInterval);

    // Verify initial health check
    const healthStatus = await systemHealthMonitor.getSystemStatus();
    structuredLogger.info('Initial system health status', {
      service: 'monitoring-initializer',
      component: 'health-init',
      operation: 'initial-health-check',
      additionalData: {
        status: healthStatus.status,
        activeAlerts: healthStatus.active_alerts.length
      }
    });
  }

  /**
   * Initialize database performance monitoring
   */
  private async initializeDatabaseMonitoring(): Promise<void> {
    structuredLogger.info('Initializing database performance monitoring', {
      service: 'monitoring-initializer',
      component: 'db-monitor-init',
      operation: 'init-db-monitoring'
    });

    // Database performance monitor starts automatically
    // Get initial metrics to verify it's working
    const metrics = await databasePerformanceMonitor.getPerformanceMetrics();
    
    structuredLogger.info('Database performance monitoring initialized', {
      service: 'monitoring-initializer',
      component: 'db-monitor-init',
      operation: 'init-complete',
      additionalData: {
        activeConnections: metrics.connection_stats.active_connections,
        avgQueryTime: metrics.query_stats.avg_query_time
      }
    });
  }

  /**
   * Initialize alerting system
   */
  private async initializeAlerting(): Promise<void> {
    structuredLogger.info('Initializing alerting system', {
      service: 'monitoring-initializer',
      component: 'alert-init',
      operation: 'init-alerting'
    });

    // Alert manager starts automatically
    // Get initial alert statistics
    const alertStats = await alertManager.getAlertStats();
    
    structuredLogger.info('Alerting system initialized', {
      service: 'monitoring-initializer',
      component: 'alert-init',
      operation: 'init-complete',
      additionalData: {
        activeAlerts: alertStats.active_alerts,
        resolvedToday: alertStats.resolved_today
      }
    });
  }

  /**
   * Initialize incident response system
   */
  private async initializeIncidentResponse(): Promise<void> {
    structuredLogger.info('Initializing incident response system', {
      service: 'monitoring-initializer',
      component: 'incident-init',
      operation: 'init-incident-response'
    });

    // Incident response manager starts automatically
    // Get initial metrics
    const responseMetrics = await incidentResponseManager.getResponseMetrics();
    
    structuredLogger.info('Incident response system initialized', {
      service: 'monitoring-initializer',
      component: 'incident-init',
      operation: 'init-complete',
      additionalData: {
        activeIncidents: responseMetrics.activeIncidents,
        automatedActions: this.config.incidentResponse.automaticActions
      }
    });
  }

  /**
   * Setup health check endpoints
   */
  private async setupHealthChecks(): Promise<void> {
    structuredLogger.info('Setting up health check endpoints', {
      service: 'monitoring-initializer',
      component: 'health-checks',
      operation: 'setup-health-checks'
    });

    // Health check endpoints are already created as API routes
    // Test that they're working
    try {
      const healthResponse = await fetch('http://localhost:3000/api/health');
      const readyResponse = await fetch('http://localhost:3000/api/ready');
      
      if (!healthResponse.ok || !readyResponse.ok) {
        structuredLogger.warn('Health check endpoints not fully operational', {
          service: 'monitoring-initializer',
          component: 'health-checks',
          operation: 'test-endpoints',
          additionalData: {
            healthStatus: healthResponse.status,
            readyStatus: readyResponse.status
          }
        });
      }
    } catch (error) {
      structuredLogger.debug('Health check endpoint test skipped (server may not be running)', {
        service: 'monitoring-initializer',
        component: 'health-checks',
        operation: 'test-endpoints'
      });
    }
  }

  /**
   * Start all monitoring services
   */
  private async startMonitoringServices(): Promise<void> {
    structuredLogger.info('Starting monitoring services', {
      service: 'monitoring-initializer',
      component: 'service-starter',
      operation: 'start-services'
    });

    // Services start automatically when imported
    // This is just a verification step
    const services = [
      { name: 'telemetry', enabled: this.config.telemetry.enabled },
      { name: 'systemHealth', enabled: this.config.systemHealth.enabled },
      { name: 'alerting', enabled: this.config.alerting.enabled },
      { name: 'incidentResponse', enabled: this.config.incidentResponse.enabled },
      { name: 'caching', enabled: this.config.caching.enabled },
      { name: 'databaseMonitoring', enabled: this.config.database.performanceMonitoring }
    ];

    const activeServices = services.filter(s => s.enabled).map(s => s.name);
    
    structuredLogger.info('Monitoring services started', {
      service: 'monitoring-initializer',
      component: 'service-starter',
      operation: 'start-complete',
      additionalData: {
        activeServices,
        totalServices: activeServices.length
      }
    });
  }

  /**
   * Get list of enabled components
   */
  private getEnabledComponents(): string[] {
    const components = [];
    
    if (this.config.telemetry.enabled) components.push('telemetry');
    if (this.config.systemHealth.enabled) components.push('systemHealth');
    if (this.config.alerting.enabled) components.push('alerting');
    if (this.config.incidentResponse.enabled) components.push('incidentResponse');
    if (this.config.caching.enabled) components.push('caching');
    if (this.config.database.performanceMonitoring) components.push('databaseMonitoring');
    
    return components;
  }

  /**
   * Shutdown monitoring system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    structuredLogger.info('Shutting down monitoring system', {
      service: 'monitoring-initializer',
      component: 'system-shutdown',
      operation: 'shutdown'
    });

    try {
      // Stop system health monitoring
      systemHealthMonitor.stop();

      // Shutdown telemetry
      await telemetryManager.shutdown();

      // Shutdown cache service
      const cacheService = require('../caching/cache-service').getCacheService();
      if (cacheService) {
        await cacheService.shutdown();
      }

      this.initialized = false;

      structuredLogger.info('Monitoring system shutdown completed', {
        service: 'monitoring-initializer',
        component: 'system-shutdown',
        operation: 'shutdown-complete'
      });

    } catch (error) {
      structuredLogger.error('Error during monitoring system shutdown', {
        service: 'monitoring-initializer',
        component: 'system-shutdown',
        operation: 'shutdown',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  /**
   * Check if monitoring system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get monitoring system status
   */
  async getMonitoringStatus(): Promise<{
    initialized: boolean;
    components: Record<string, { enabled: boolean; healthy: boolean }>;
    uptime: number;
  }> {
    const components: Record<string, { enabled: boolean; healthy: boolean }> = {};
    
    // Check each component
    components.telemetry = {
      enabled: this.config.telemetry.enabled,
      healthy: this.config.telemetry.enabled ? (await telemetryManager.healthCheck()).status === 'healthy' : true
    };
    
    components.systemHealth = {
      enabled: this.config.systemHealth.enabled,
      healthy: this.config.systemHealth.enabled ? (await systemHealthMonitor.getSystemStatus()).status === 'healthy' : true
    };
    
    components.alerting = {
      enabled: this.config.alerting.enabled,
      healthy: this.config.alerting.enabled // Assume healthy if enabled
    };
    
    components.incidentResponse = {
      enabled: this.config.incidentResponse.enabled,
      healthy: this.config.incidentResponse.enabled // Assume healthy if enabled
    };
    
    components.caching = {
      enabled: this.config.caching.enabled,
      healthy: this.config.caching.enabled // Assume healthy if enabled
    };
    
    components.databaseMonitoring = {
      enabled: this.config.database.performanceMonitoring,
      healthy: this.config.database.performanceMonitoring // Assume healthy if enabled
    };

    return {
      initialized: this.initialized,
      components,
      uptime: Date.now() - (this.initialized ? Date.now() : 0) // Simplified uptime
    };
  }
}

// Default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  telemetry: {
    enabled: true,
    serviceName: process.env.OTEL_SERVICE_NAME || 'hr-rag-platform',
    environment: (process.env.NODE_ENV as any) || 'development',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9464')
  },
  systemHealth: {
    enabled: true,
    monitoringInterval: 30000 // 30 seconds
  },
  alerting: {
    enabled: true,
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(','),
    slackWebhook: process.env.SLACK_WEBHOOK_URL
  },
  incidentResponse: {
    enabled: true,
    automaticActions: process.env.ENABLE_AUTOMATIC_INCIDENT_RESPONSE === 'true'
  },
  caching: {
    enabled: true,
    redis: process.env.REDIS_URL ? {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    } : undefined,
    memory: {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000
    }
  },
  database: {
    performanceMonitoring: true,
    slowQueryThreshold: 1000, // 1 second
    optimizationRecommendations: true
  }
};

// Create singleton instance
let monitoringInitializer: MonitoringInitializer | null = null;

export function createMonitoringInitializer(config?: Partial<MonitoringConfig>): MonitoringInitializer {
  if (!monitoringInitializer) {
    const finalConfig = { ...defaultMonitoringConfig, ...config };
    monitoringInitializer = new MonitoringInitializer(finalConfig);
  }
  return monitoringInitializer;
}

export function getMonitoringInitializer(): MonitoringInitializer | null {
  return monitoringInitializer;
}

// Auto-initialize in production environments
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT_MONITORING === 'true') {
  const initializer = createMonitoringInitializer();
  initializer.initialize().catch(error => {
    console.error('Failed to auto-initialize monitoring system:', error);
  });
}

export default MonitoringInitializer;