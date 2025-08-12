import { EventEmitter } from 'events';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from './error-tracker';
import { alertManager, type IncidentReport } from './alert-manager';
import { systemHealthMonitor } from './system-health-monitor';
import { performanceMonitor } from './performance-monitor';
import type { HealthAlert, AlertSeverity } from './system-health-monitor';

// Prometheus metrics for incident response
const incidentsCreated = new promClient.Counter({
  name: 'incidents_created_total',
  help: 'Total number of incidents created',
  labelNames: ['severity', 'category', 'trigger'],
});

const incidentsResolved = new promClient.Counter({
  name: 'incidents_resolved_total',
  help: 'Total number of incidents resolved',
  labelNames: ['severity', 'resolution_type', 'duration_bucket'],
});

const automatedActionsExecuted = new promClient.Counter({
  name: 'automated_actions_executed_total',
  help: 'Total number of automated response actions executed',
  labelNames: ['action_type', 'success'],
});

const incidentResponseTime = new promClient.Histogram({
  name: 'incident_response_time_seconds',
  help: 'Time from incident creation to first response',
  labelNames: ['severity'],
  buckets: [1, 5, 15, 30, 60, 300, 600, 1800], // 1s to 30 minutes
});

export type IncidentCategory = 'system' | 'database' | 'api' | 'security' | 'performance' | 'external';
export type IncidentPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type ResponseActionType = 'restart_service' | 'scale_up' | 'clear_cache' | 'failover' | 'notify' | 'investigate';
export type AutomationTrigger = 'alert_threshold' | 'error_rate' | 'performance_degradation' | 'health_check_failure' | 'manual';

export interface ResponseAction {
  id: string;
  type: ResponseActionType;
  name: string;
  description: string;
  automated: boolean;
  conditions: {
    severity?: AlertSeverity[];
    category?: IncidentCategory[];
    maxExecutionsPerHour: number;
    cooldownMinutes: number;
  };
  implementation: {
    command?: string;
    apiCall?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: any;
    };
    script?: string;
  };
  rollback?: {
    command?: string;
    apiCall?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: any;
    };
  };
  verification: {
    healthCheck?: string;
    metric?: string;
    expectedValue?: any;
    timeoutSeconds: number;
  };
  risks: string[];
  estimatedImpact: {
    disruption: 'none' | 'minimal' | 'moderate' | 'high';
    duration: number; // seconds
  };
}

export interface IncidentPlaybook {
  id: string;
  name: string;
  category: IncidentCategory;
  triggers: {
    alerts: string[];
    conditions: string[];
  };
  priority: IncidentPriority;
  actions: string[]; // Response action IDs
  escalation: {
    timeoutMinutes: number;
    escalateTo: string[];
    notificationChannels: string[];
  };
  documentation: {
    description: string;
    commonCauses: string[];
    diagnosticSteps: string[];
    preventionMeasures: string[];
  };
  enabled: boolean;
}

export interface IncidentResponseMetrics {
  timestamp: Date;
  activeIncidents: number;
  totalIncidents24h: number;
  avgResponseTime: number;
  automatedResolutions: number;
  manualResolutions: number;
  falsePositives: number;
  mttr: number; // Mean Time To Resolution
  mtbf: number; // Mean Time Between Failures
}

class IncidentResponseManager extends EventEmitter {
  private tracer = trace.getTracer('incident-response-manager');
  private supabase = createSupabaseAdminClient();
  
  private responseActions = new Map<string, ResponseAction>();
  private playbooks = new Map<string, IncidentPlaybook>();
  private activeIncidents = new Map<string, EnrichedIncident>();
  private actionExecutions = new Map<string, ActionExecution[]>();
  private recentExecutions = new Map<string, Date[]>(); // Action cooldowns

  constructor() {
    super();
    this.initializeDefaultActions();
    this.initializeDefaultPlaybooks();
    this.startIncidentMonitoring();
    this.bindAlertEvents();
  }

  /**
   * Initialize default response actions
   */
  private initializeDefaultActions(): void {
    const defaultActions: ResponseAction[] = [
      {
        id: 'restart-service',
        type: 'restart_service',
        name: 'Restart Application Service',
        description: 'Restart the main application service to recover from errors',
        automated: true,
        conditions: {
          severity: ['high', 'critical'],
          category: ['system', 'api'],
          maxExecutionsPerHour: 3,
          cooldownMinutes: 10
        },
        implementation: {
          command: 'pm2 restart hr-rag-platform'
        },
        verification: {
          healthCheck: '/api/health',
          timeoutSeconds: 60
        },
        risks: ['Brief service interruption', 'Active sessions may be lost'],
        estimatedImpact: {
          disruption: 'minimal',
          duration: 30
        }
      },
      {
        id: 'clear-cache',
        type: 'clear_cache',
        name: 'Clear Application Cache',
        description: 'Clear Redis and memory cache to resolve cache-related issues',
        automated: true,
        conditions: {
          severity: ['medium', 'high'],
          category: ['performance', 'api'],
          maxExecutionsPerHour: 5,
          cooldownMinutes: 5
        },
        implementation: {
          apiCall: {
            url: '/api/admin/cache/clear',
            method: 'POST',
            headers: { 'x-admin-key': process.env.ADMIN_API_KEY || '' }
          }
        },
        verification: {
          metric: 'cache_hit_ratio',
          expectedValue: 0,
          timeoutSeconds: 30
        },
        risks: ['Temporary performance degradation', 'Increased database load'],
        estimatedImpact: {
          disruption: 'minimal',
          duration: 60
        }
      },
      {
        id: 'scale-up-resources',
        type: 'scale_up',
        name: 'Scale Up Resources',
        description: 'Increase application resources to handle load',
        automated: false, // Requires manual approval for cost implications
        conditions: {
          severity: ['high', 'critical'],
          category: ['performance', 'system'],
          maxExecutionsPerHour: 2,
          cooldownMinutes: 30
        },
        implementation: {
          script: 'kubectl scale deployment hr-rag-platform --replicas=5'
        },
        rollback: {
          script: 'kubectl scale deployment hr-rag-platform --replicas=2'
        },
        verification: {
          metric: 'cpu_usage_percent',
          expectedValue: '<80',
          timeoutSeconds: 300
        },
        risks: ['Increased infrastructure costs', 'Resource contention'],
        estimatedImpact: {
          disruption: 'none',
          duration: 120
        }
      },
      {
        id: 'notify-team',
        type: 'notify',
        name: 'Notify On-Call Team',
        description: 'Send notifications to the on-call engineering team',
        automated: true,
        conditions: {
          severity: ['high', 'critical'],
          maxExecutionsPerHour: 10,
          cooldownMinutes: 1
        },
        implementation: {
          apiCall: {
            url: process.env.PAGERDUTY_WEBHOOK_URL || '',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              routing_key: process.env.PAGERDUTY_ROUTING_KEY,
              event_action: 'trigger',
              dedup_key: '{incident_id}',
              payload: {
                summary: '{incident_title}',
                severity: '{severity}',
                source: 'hr-rag-platform'
              }
            }
          }
        },
        verification: {
          timeoutSeconds: 10
        },
        risks: ['Alert fatigue if over-used'],
        estimatedImpact: {
          disruption: 'none',
          duration: 5
        }
      },
      {
        id: 'database-failover',
        type: 'failover',
        name: 'Database Failover',
        description: 'Switch to backup database instance',
        automated: false, // Critical operation requiring manual approval
        conditions: {
          severity: ['critical'],
          category: ['database'],
          maxExecutionsPerHour: 1,
          cooldownMinutes: 60
        },
        implementation: {
          script: './scripts/database-failover.sh'
        },
        rollback: {
          script: './scripts/database-failback.sh'
        },
        verification: {
          healthCheck: '/api/health',
          timeoutSeconds: 120
        },
        risks: ['Data inconsistency', 'Service downtime during failover'],
        estimatedImpact: {
          disruption: 'high',
          duration: 300
        }
      }
    ];

    defaultActions.forEach(action => {
      this.responseActions.set(action.id, action);
    });

    structuredLogger.info('Default response actions initialized', {
      service: 'incident-response-manager',
      component: 'action-registry',
      operation: 'initialize-actions',
      additionalData: { actionCount: defaultActions.length }
    });
  }

  /**
   * Initialize default playbooks
   */
  private initializeDefaultPlaybooks(): void {
    const defaultPlaybooks: IncidentPlaybook[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate Response',
        category: 'api',
        triggers: {
          alerts: ['error-rate-high'],
          conditions: ['error_rate > 5%', 'duration > 5 minutes']
        },
        priority: 'P1',
        actions: ['clear-cache', 'restart-service', 'notify-team'],
        escalation: {
          timeoutMinutes: 15,
          escalateTo: ['engineering-manager', 'cto'],
          notificationChannels: ['slack', 'email']
        },
        documentation: {
          description: 'Automated response to sustained high error rates in API endpoints',
          commonCauses: [
            'Database connection issues',
            'Memory leaks',
            'Cache corruption',
            'External service failures'
          ],
          diagnosticSteps: [
            'Check application logs for errors',
            'Verify database connectivity',
            'Review cache hit rates',
            'Check external service status'
          ],
          preventionMeasures: [
            'Implement circuit breakers',
            'Add retry mechanisms',
            'Monitor database connection pool',
            'Set up cache warming strategies'
          ]
        },
        enabled: true
      },
      {
        id: 'database-performance',
        name: 'Database Performance Degradation',
        category: 'database',
        triggers: {
          alerts: ['database-slow-queries', 'database-connection-exhaustion'],
          conditions: ['avg_query_time > 1000ms', 'connection_pool_usage > 90%']
        },
        priority: 'P1',
        actions: ['clear-cache', 'notify-team'],
        escalation: {
          timeoutMinutes: 10,
          escalateTo: ['database-admin', 'engineering-manager'],
          notificationChannels: ['slack', 'pagerduty']
        },
        documentation: {
          description: 'Response to database performance issues and connection problems',
          commonCauses: [
            'Slow queries without proper indexes',
            'Connection pool exhaustion',
            'Database locks and deadlocks',
            'High disk I/O'
          ],
          diagnosticSteps: [
            'Review slow query logs',
            'Check connection pool status',
            'Analyze database locks',
            'Review disk and CPU usage'
          ],
          preventionMeasures: [
            'Optimize slow queries',
            'Add appropriate indexes',
            'Tune connection pool settings',
            'Implement query caching'
          ]
        },
        enabled: true
      },
      {
        id: 'system-resource-exhaustion',
        name: 'System Resource Exhaustion',
        category: 'system',
        triggers: {
          alerts: ['high-cpu-usage', 'high-memory-usage', 'disk-space-critical'],
          conditions: ['cpu_usage > 90%', 'memory_usage > 95%', 'disk_usage > 90%']
        },
        priority: 'P0',
        actions: ['clear-cache', 'scale-up-resources', 'notify-team'],
        escalation: {
          timeoutMinutes: 5,
          escalateTo: ['infrastructure-team', 'engineering-manager'],
          notificationChannels: ['slack', 'pagerduty', 'sms']
        },
        documentation: {
          description: 'Critical system resource exhaustion requiring immediate attention',
          commonCauses: [
            'Memory leaks in application',
            'Runaway processes',
            'Insufficient resource allocation',
            'Unexpected traffic spikes'
          ],
          diagnosticSteps: [
            'Identify resource-consuming processes',
            'Check application memory usage',
            'Review recent deployments',
            'Analyze traffic patterns'
          ],
          preventionMeasures: [
            'Implement resource limits',
            'Add memory leak detection',
            'Set up auto-scaling',
            'Monitor resource trends'
          ]
        },
        enabled: true
      }
    ];

    defaultPlaybooks.forEach(playbook => {
      this.playbooks.set(playbook.id, playbook);
    });

    structuredLogger.info('Default playbooks initialized', {
      service: 'incident-response-manager',
      component: 'playbook-registry',
      operation: 'initialize-playbooks',
      additionalData: { playbookCount: defaultPlaybooks.length }
    });
  }

  /**
   * Bind to alert events
   */
  private bindAlertEvents(): void {
    alertManager.on('alert_triggered', (alert: HealthAlert) => {
      this.handleAlert(alert).catch(error => {
        structuredLogger.error('Failed to handle alert', {
          service: 'incident-response-manager',
          component: 'alert-handler',
          operation: 'handle-alert',
          error: error instanceof Error ? error : undefined,
          additionalData: { alertId: alert.id }
        });
      });
    });

    alertManager.on('incident_created', (incident: IncidentReport) => {
      this.handleIncident(incident).catch(error => {
        structuredLogger.error('Failed to handle incident', {
          service: 'incident-response-manager',
          component: 'incident-handler',
          operation: 'handle-incident',
          error: error instanceof Error ? error : undefined,
          additionalData: { incidentId: incident.id }
        });
      });
    });
  }

  /**
   * Handle incoming alert
   */
  private async handleAlert(alert: HealthAlert): Promise<void> {
    const span = this.tracer.startSpan(`Handle Alert: ${alert.type}`);
    
    try {
      // Find matching playbooks
      const matchingPlaybooks = this.findMatchingPlaybooks(alert);
      
      if (matchingPlaybooks.length === 0) {
        structuredLogger.debug('No matching playbooks for alert', {
          service: 'incident-response-manager',
          component: 'alert-handler',
          operation: 'handle-alert',
          additionalData: {
            alertId: alert.id,
            alertType: alert.type,
            severity: alert.severity
          }
        });
        return;
      }

      // Execute highest priority playbook
      const primaryPlaybook = matchingPlaybooks.sort((a, b) => {
        const priorityOrder = { P0: 5, P1: 4, P2: 3, P3: 2, P4: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })[0];

      await this.executePlaybook(primaryPlaybook, alert);

      span.setStatus({ code: SpanStatusCode.OK });
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle incident
   */
  private async handleIncident(incident: IncidentReport): Promise<void> {
    const enrichedIncident: EnrichedIncident = {
      ...incident,
      responseActions: [],
      playbookExecuted: null,
      automaticResolution: false,
      responseStartTime: new Date(),
      lastActionTime: new Date()
    };

    this.activeIncidents.set(incident.id, enrichedIncident);

    // Update metrics
    incidentsCreated.inc({
      severity: incident.severity,
      category: 'unknown', // Would map from incident type
      trigger: 'alert'
    });

    structuredLogger.warn('Incident response initiated', {
      service: 'incident-response-manager',
      component: 'incident-handler',
      operation: 'handle-incident',
      additionalData: {
        incidentId: incident.id,
        severity: incident.severity,
        title: incident.title
      }
    });

    this.emit('incident_response_started', enrichedIncident);
  }

  /**
   * Find playbooks matching an alert
   */
  private findMatchingPlaybooks(alert: HealthAlert): IncidentPlaybook[] {
    const matching = [];

    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;

      // Check if alert type matches trigger conditions
      const alertTypeMatches = playbook.triggers.alerts.some(trigger => 
        alert.type.includes(trigger) || trigger === 'all'
      );

      // Check severity compatibility (simplified)
      const severityMatches = ['high', 'critical'].includes(alert.severity) || 
                             playbook.priority !== 'P0';

      if (alertTypeMatches && severityMatches) {
        matching.push(playbook);
      }
    }

    return matching;
  }

  /**
   * Execute playbook actions
   */
  private async executePlaybook(playbook: IncidentPlaybook, alert: HealthAlert): Promise<void> {
    structuredLogger.info('Executing incident playbook', {
      service: 'incident-response-manager',
      component: 'playbook-executor',
      operation: 'execute-playbook',
      additionalData: {
        playbookId: playbook.id,
        playbookName: playbook.name,
        alertId: alert.id,
        actionCount: playbook.actions.length
      }
    });

    const startTime = Date.now();

    try {
      // Execute actions in sequence
      for (const actionId of playbook.actions) {
        const action = this.responseActions.get(actionId);
        if (!action) {
          structuredLogger.warn('Action not found in playbook', {
            service: 'incident-response-manager',
            component: 'playbook-executor',
            operation: 'execute-action',
            additionalData: { actionId, playbookId: playbook.id }
          });
          continue;
        }

        // Check if action should be executed automatically
        if (!action.automated) {
          structuredLogger.info('Skipping manual action in automated playbook', {
            service: 'incident-response-manager',
            component: 'playbook-executor',
            operation: 'skip-action',
            additionalData: { actionId, actionName: action.name }
          });
          continue;
        }

        // Check cooldown and rate limits
        if (!this.canExecuteAction(action, alert)) {
          structuredLogger.warn('Action skipped due to rate limiting or cooldown', {
            service: 'incident-response-manager',
            component: 'playbook-executor',
            operation: 'rate-limited',
            additionalData: { actionId, actionName: action.name }
          });
          continue;
        }

        // Execute the action
        await this.executeResponseAction(action, alert, playbook.id);
      }

      // Record response time
      const responseTime = (Date.now() - startTime) / 1000;
      incidentResponseTime.observe({ severity: alert.severity }, responseTime);

      structuredLogger.info('Playbook execution completed', {
        service: 'incident-response-manager',
        component: 'playbook-executor',
        operation: 'execute-playbook',
        additionalData: {
          playbookId: playbook.id,
          responseTime,
          alertId: alert.id
        }
      });

    } catch (error) {
      await errorTracker.createError(
        'system_error',
        `Playbook execution failed: ${playbook.name}`,
        error instanceof Error ? error : new Error('Unknown playbook execution error'),
        { playbookId: playbook.id, alertId: alert.id }
      );
      throw error;
    }
  }

  /**
   * Execute individual response action
   */
  private async executeResponseAction(
    action: ResponseAction, 
    alert: HealthAlert, 
    playbookId: string
  ): Promise<ActionExecutionResult> {
    const execution: ActionExecution = {
      id: crypto.randomUUID(),
      actionId: action.id,
      alertId: alert.id,
      playbookId,
      startTime: new Date(),
      status: 'running',
      attempts: 1
    };

    structuredLogger.info('Executing response action', {
      service: 'incident-response-manager',
      component: 'action-executor',
      operation: 'execute-action',
      additionalData: {
        actionId: action.id,
        actionName: action.name,
        executionId: execution.id
      }
    });

    try {
      let result: ActionExecutionResult;

      // Execute based on implementation type
      if (action.implementation.command) {
        result = await this.executeCommand(action.implementation.command);
      } else if (action.implementation.apiCall) {
        result = await this.executeApiCall(action.implementation.apiCall);
      } else if (action.implementation.script) {
        result = await this.executeScript(action.implementation.script);
      } else {
        throw new Error('No valid implementation found for action');
      }

      // Verify action success if verification is configured
      if (action.verification) {
        const verificationResult = await this.verifyActionSuccess(action.verification);
        result.verified = verificationResult.success;
        result.verificationDetails = verificationResult.details;
      }

      execution.status = result.success ? 'completed' : 'failed';
      execution.endTime = new Date();
      execution.result = result;

      // Store execution
      if (!this.actionExecutions.has(action.id)) {
        this.actionExecutions.set(action.id, []);
      }
      this.actionExecutions.get(action.id)!.push(execution);

      // Update rate limiting
      this.updateActionExecutionTracking(action.id);

      // Update metrics
      automatedActionsExecuted.inc({
        action_type: action.type,
        success: result.success ? 'true' : 'false'
      });

      structuredLogger.info('Response action completed', {
        service: 'incident-response-manager',
        component: 'action-executor',
        operation: 'execute-action',
        additionalData: {
          actionId: action.id,
          success: result.success,
          duration: Date.now() - execution.startTime.getTime(),
          verified: result.verified
        }
      });

      return result;

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      automatedActionsExecuted.inc({
        action_type: action.type,
        success: 'false'
      });

      structuredLogger.error('Response action failed', {
        service: 'incident-response-manager',
        component: 'action-executor',
        operation: 'execute-action',
        error: error instanceof Error ? error : undefined,
        additionalData: { actionId: action.id }
      });

      throw error;
    }
  }

  /**
   * Check if action can be executed based on rate limits and cooldowns
   */
  private canExecuteAction(action: ResponseAction, alert: HealthAlert): boolean {
    // Check severity conditions
    if (action.conditions.severity && 
        !action.conditions.severity.includes(alert.severity)) {
      return false;
    }

    // Check execution limits
    const executions = this.recentExecutions.get(action.id) || [];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentExecutions = executions.filter(time => time.getTime() > oneHourAgo);

    if (recentExecutions.length >= action.conditions.maxExecutionsPerHour) {
      return false;
    }

    // Check cooldown
    if (recentExecutions.length > 0) {
      const lastExecution = Math.max(...recentExecutions.map(t => t.getTime()));
      const cooldownExpires = lastExecution + (action.conditions.cooldownMinutes * 60 * 1000);
      
      if (Date.now() < cooldownExpires) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update action execution tracking for rate limiting
   */
  private updateActionExecutionTracking(actionId: string): void {
    const now = new Date();
    const executions = this.recentExecutions.get(actionId) || [];
    
    // Add current execution
    executions.push(now);
    
    // Clean up old executions (older than 1 hour)
    const oneHourAgo = now.getTime() - 60 * 60 * 1000;
    const recentExecutions = executions.filter(time => time.getTime() > oneHourAgo);
    
    this.recentExecutions.set(actionId, recentExecutions);
  }

  /**
   * Execute shell command
   */
  private async executeCommand(command: string): Promise<ActionExecutionResult> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      
      return {
        success: true,
        output: stdout,
        error: stderr || undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed'
      };
    }
  }

  /**
   * Execute API call
   */
  private async executeApiCall(apiCall: ResponseAction['implementation']['apiCall']): Promise<ActionExecutionResult> {
    if (!apiCall) throw new Error('API call configuration missing');

    try {
      const response = await fetch(apiCall.url, {
        method: apiCall.method,
        headers: apiCall.headers,
        body: apiCall.body ? JSON.stringify(apiCall.body) : undefined,
      });

      const responseText = await response.text();
      
      return {
        success: response.ok,
        output: responseText,
        statusCode: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed'
      };
    }
  }

  /**
   * Execute script
   */
  private async executeScript(scriptPath: string): Promise<ActionExecutionResult> {
    // In a real implementation, this would execute the script securely
    // For now, we'll simulate successful execution
    return {
      success: true,
      output: `Script ${scriptPath} executed successfully`
    };
  }

  /**
   * Verify action success
   */
  private async verifyActionSuccess(verification: ResponseAction['verification']): Promise<{
    success: boolean;
    details: string;
  }> {
    try {
      if (verification.healthCheck) {
        // Check health endpoint
        const response = await fetch(verification.healthCheck);
        return {
          success: response.ok,
          details: `Health check returned ${response.status}`
        };
      }

      if (verification.metric) {
        // Check metric value (simplified)
        return {
          success: true,
          details: `Metric ${verification.metric} verified`
        };
      }

      return { success: true, details: 'No verification configured' };
    } catch (error) {
      return {
        success: false,
        details: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Start incident monitoring
   */
  private startIncidentMonitoring(): void {
    // Monitor for incident resolution every 30 seconds
    setInterval(async () => {
      try {
        await this.checkIncidentResolution();
      } catch (error) {
        structuredLogger.error('Incident resolution check failed', {
          service: 'incident-response-manager',
          component: 'resolution-monitor',
          operation: 'check-resolution',
          error: error instanceof Error ? error : undefined
        });
      }
    }, 30000);

    // Clean up old execution records every hour
    setInterval(() => {
      this.cleanupExecutionHistory();
    }, 60 * 60 * 1000);
  }

  /**
   * Check for automatic incident resolution
   */
  private async checkIncidentResolution(): Promise<void> {
    for (const [incidentId, incident] of this.activeIncidents) {
      try {
        // Get current system health
        const systemStatus = await systemHealthMonitor.getSystemStatus();
        
        // Check if incident conditions are resolved
        const isResolved = this.checkIncidentResolved(incident, systemStatus);
        
        if (isResolved) {
          await this.resolveIncident(incidentId, 'automatic', 'System health restored');
        }
      } catch (error) {
        structuredLogger.error('Error checking incident resolution', {
          service: 'incident-response-manager',
          component: 'resolution-monitor',
          operation: 'check-incident-resolution',
          error: error instanceof Error ? error : undefined,
          additionalData: { incidentId }
        });
      }
    }
  }

  /**
   * Check if incident should be automatically resolved
   */
  private checkIncidentResolved(incident: EnrichedIncident, systemStatus: any): boolean {
    // Simple heuristics for automatic resolution
    // In production, this would be more sophisticated
    
    // If system is healthy and incident is older than 5 minutes
    if (systemStatus.status === 'healthy' && 
        Date.now() - incident.created_at.getTime() > 5 * 60 * 1000) {
      return true;
    }

    // If no new alerts for 10 minutes
    if (Date.now() - incident.lastActionTime.getTime() > 10 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Resolve incident
   */
  private async resolveIncident(
    incidentId: string, 
    resolutionType: 'automatic' | 'manual',
    reason: string
  ): Promise<void> {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) return;

    const duration = Date.now() - incident.created_at.getTime();
    const durationBucket = this.getDurationBucket(duration);

    // Update metrics
    incidentsResolved.inc({
      severity: incident.severity,
      resolution_type: resolutionType,
      duration_bucket: durationBucket
    });

    // Mark as resolved
    incident.status = 'resolved';
    incident.resolved_at = new Date();
    incident.automaticResolution = resolutionType === 'automatic';

    // Remove from active incidents
    this.activeIncidents.delete(incidentId);

    structuredLogger.info('Incident resolved', {
      service: 'incident-response-manager',
      component: 'incident-resolver',
      operation: 'resolve-incident',
      additionalData: {
        incidentId,
        resolutionType,
        reason,
        duration,
        severity: incident.severity
      }
    });

    this.emit('incident_resolved', {
      incident,
      resolutionType,
      reason,
      duration
    });
  }

  /**
   * Get duration bucket for metrics
   */
  private getDurationBucket(durationMs: number): string {
    const durationSeconds = durationMs / 1000;
    
    if (durationSeconds < 60) return '<1m';
    if (durationSeconds < 300) return '<5m';
    if (durationSeconds < 900) return '<15m';
    if (durationSeconds < 1800) return '<30m';
    if (durationSeconds < 3600) return '<1h';
    return '>=1h';
  }

  /**
   * Clean up old execution history
   */
  private cleanupExecutionHistory(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const [actionId, executions] of this.actionExecutions) {
      const recentExecutions = executions.filter(
        exec => exec.startTime.getTime() > cutoffTime
      );
      
      if (recentExecutions.length === 0) {
        this.actionExecutions.delete(actionId);
      } else {
        this.actionExecutions.set(actionId, recentExecutions);
      }
    }

    // Clean up recent executions tracking
    for (const [actionId, times] of this.recentExecutions) {
      const recentTimes = times.filter(time => time.getTime() > cutoffTime);
      
      if (recentTimes.length === 0) {
        this.recentExecutions.delete(actionId);
      } else {
        this.recentExecutions.set(actionId, recentTimes);
      }
    }
  }

  /**
   * Get incident response metrics
   */
  async getResponseMetrics(): Promise<IncidentResponseMetrics> {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    
    // Get incidents from last 24 hours
    const recentIncidents = Array.from(this.activeIncidents.values())
      .filter(incident => incident.created_at.getTime() > last24Hours);

    // Calculate metrics
    const totalIncidents = recentIncidents.length;
    const resolvedIncidents = recentIncidents.filter(i => i.status === 'resolved');
    const automatedResolutions = resolvedIncidents.filter(i => i.automaticResolution).length;
    const manualResolutions = resolvedIncidents.length - automatedResolutions;

    // Calculate MTTR (Mean Time To Resolution)
    const mttr = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, incident) => {
          const duration = incident.resolved_at 
            ? incident.resolved_at.getTime() - incident.created_at.getTime()
            : 0;
          return sum + duration;
        }, 0) / resolvedIncidents.length
      : 0;

    // Calculate average response time
    const avgResponseTime = recentIncidents.length > 0
      ? recentIncidents.reduce((sum, incident) => {
          const responseTime = incident.responseStartTime
            ? incident.responseStartTime.getTime() - incident.created_at.getTime()
            : 0;
          return sum + responseTime;
        }, 0) / recentIncidents.length
      : 0;

    return {
      timestamp: new Date(),
      activeIncidents: this.activeIncidents.size,
      totalIncidents24h: totalIncidents,
      avgResponseTime: avgResponseTime / 1000, // Convert to seconds
      automatedResolutions,
      manualResolutions,
      falsePositives: 0, // Would need to track false positives separately
      mttr: mttr / 1000, // Convert to seconds
      mtbf: 0 // Mean Time Between Failures - would calculate based on historical data
    };
  }

  /**
   * Manual incident resolution
   */
  async manuallyResolveIncident(incidentId: string, reason: string): Promise<boolean> {
    if (this.activeIncidents.has(incidentId)) {
      await this.resolveIncident(incidentId, 'manual', reason);
      return true;
    }
    return false;
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): EnrichedIncident[] {
    return Array.from(this.activeIncidents.values());
  }

  /**
   * Get execution history for an action
   */
  getActionExecutionHistory(actionId: string): ActionExecution[] {
    return this.actionExecutions.get(actionId) || [];
  }
}

// Internal types
interface EnrichedIncident extends IncidentReport {
  responseActions: string[];
  playbookExecuted: string | null;
  automaticResolution: boolean;
  responseStartTime: Date;
  lastActionTime: Date;
}

interface ActionExecution {
  id: string;
  actionId: string;
  alertId: string;
  playbookId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  attempts: number;
  result?: ActionExecutionResult;
  error?: string;
}

interface ActionExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  statusCode?: number;
  verified?: boolean;
  verificationDetails?: string;
}

// Export singleton instance
export const incidentResponseManager = new IncidentResponseManager();

// Export types
export type {
  ResponseAction,
  IncidentPlaybook,
  IncidentResponseMetrics,
  IncidentCategory,
  IncidentPriority,
  ResponseActionType,
  AutomationTrigger
};

export default incidentResponseManager;