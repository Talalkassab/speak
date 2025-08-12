import { EventEmitter } from 'events';
import { trace } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from '../logging/structured-logger';
import { errorTracker } from './error-tracker';
import type { HealthAlert, AlertRule } from './system-health-monitor';

// Prometheus metrics for alerting
const alertsTriggered = new promClient.Counter({
  name: 'alerts_triggered_total',
  help: 'Total number of alerts triggered',
  labelNames: ['alert_type', 'severity', 'rule_id'],
});

const alertsResolved = new promClient.Counter({
  name: 'alerts_resolved_total',
  help: 'Total number of alerts resolved',
  labelNames: ['alert_type', 'severity', 'resolution_type'],
});

const notificationsSent = new promClient.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'success'],
});

const notificationDeliveryTime = new promClient.Histogram({
  name: 'notification_delivery_duration_seconds',
  help: 'Time taken to deliver notifications',
  labelNames: ['channel'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export type NotificationChannel = 'webhook' | 'email' | 'slack' | 'teams' | 'sms' | 'pagerduty';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'resolved' | 'suppressed' | 'acknowledged';

export interface NotificationConfig {
  channel: NotificationChannel;
  endpoint: string;
  enabled: boolean;
  severity_filter: AlertSeverity[];
  rate_limit: {
    max_per_hour: number;
    burst_limit: number;
  };
  retry: {
    max_attempts: number;
    backoff_seconds: number[];
  };
  template?: string;
  metadata?: Record<string, any>;
}

export interface AlertNotification {
  id: string;
  alert_id: string;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'rate_limited';
  attempts: number;
  last_attempt?: Date;
  next_retry?: Date;
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: {
    severity: AlertSeverity[];
    unresolved_minutes: number;
    alert_types?: string[];
  };
  actions: {
    escalate_to: NotificationChannel[];
    increase_severity: boolean;
    create_incident: boolean;
  };
  enabled: boolean;
}

export interface IncidentReport {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: 'open' | 'investigating' | 'resolved' | 'cancelled';
  alerts: string[]; // alert IDs
  created_at: Date;
  resolved_at?: Date;
  assignee?: string;
  tags: string[];
  timeline: Array<{
    timestamp: Date;
    action: string;
    details: string;
    user?: string;
  }>;
}

class AlertManager extends EventEmitter {
  private tracer = trace.getTracer('alert-manager');
  private supabase = createSupabaseAdminClient();
  
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private notificationConfigs: NotificationConfig[] = [];
  private escalationRules: EscalationRule[] = [];
  private activeIncidents: Map<string, IncidentReport> = new Map();
  
  // Rate limiting
  private notificationCounts: Map<string, { hour: number; count: number; burst: number }> = new Map();
  private processingQueue: AlertNotification[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.initializeDefaultConfigs();
    this.startNotificationProcessor();
    this.startEscalationChecker();
  }

  /**
   * Process an incoming alert
   */
  async processAlert(alert: HealthAlert): Promise<void> {
    const span = this.tracer.startSpan(`Alert Processing: ${alert.type}`);
    
    try {
      // Check if this is a new alert or update to existing
      const existingAlert = this.activeAlerts.get(alert.id);
      const isNewAlert = !existingAlert;
      
      if (isNewAlert) {
        this.activeAlerts.set(alert.id, alert);
        await this.handleNewAlert(alert);
      } else {
        await this.handleAlertUpdate(alert, existingAlert);
      }

      // Update metrics
      if (isNewAlert) {
        alertsTriggered.inc({
          alert_type: alert.type,
          severity: alert.severity,
          rule_id: alert.metadata?.ruleId || 'unknown'
        });
      }

      span.setStatus({ code: 1 }); // OK
      this.emit('alert_processed', alert);

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' });
      
      await errorTracker.createError(
        'system_error',
        'Alert processing failed',
        error instanceof Error ? error : new Error('Unknown alert processing error'),
        { alertId: alert.id, alertType: alert.type }
      );
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle new alert
   */
  private async handleNewAlert(alert: HealthAlert): Promise<void> {
    structuredLogger.warn('New alert triggered', {
      service: 'alert-manager',
      component: 'alert-processor',
      operation: 'new-alert',
      additionalData: {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      }
    });

    // Store alert in database
    await this.storeAlert(alert);

    // Queue notifications
    await this.queueNotifications(alert);

    // Check if incident should be created
    if (alert.severity === 'critical' || alert.severity === 'high') {
      await this.maybeCreateIncident(alert);
    }
  }

  /**
   * Handle alert update
   */
  private async handleAlertUpdate(alert: HealthAlert, existing: HealthAlert): Promise<void> {
    // Update the stored alert
    this.activeAlerts.set(alert.id, alert);

    // Check if alert was resolved
    if (alert.resolved && !existing.resolved) {
      await this.handleAlertResolution(alert);
    }

    // Update alert in database
    await this.updateAlert(alert);
  }

  /**
   * Handle alert resolution
   */
  private async handleAlertResolution(alert: HealthAlert): Promise<void> {
    structuredLogger.info('Alert resolved', {
      service: 'alert-manager',
      component: 'alert-processor',
      operation: 'alert-resolved',
      additionalData: {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        duration: alert.timestamp.getTime() - (alert.metadata?.created_at || Date.now())
      }
    });

    // Remove from active alerts
    this.activeAlerts.delete(alert.id);

    // Update metrics
    alertsResolved.inc({
      alert_type: alert.type,
      severity: alert.severity,
      resolution_type: 'automatic'
    });

    // Send resolution notifications if configured
    await this.queueResolutionNotifications(alert);

    // Check if related incident should be resolved
    await this.maybeResolveIncident(alert);

    this.emit('alert_resolved', alert);
  }

  /**
   * Queue notifications for alert
   */
  private async queueNotifications(alert: HealthAlert): Promise<void> {
    const applicableConfigs = this.notificationConfigs.filter(config => 
      config.enabled && 
      config.severity_filter.includes(alert.severity)
    );

    for (const config of applicableConfigs) {
      // Check rate limiting
      if (!this.checkRateLimit(config)) {
        structuredLogger.warn('Notification rate limited', {
          service: 'alert-manager',
          component: 'notification-queue',
          operation: 'rate-limit',
          additionalData: {
            channel: config.channel,
            alertId: alert.id
          }
        });
        continue;
      }

      const notification: AlertNotification = {
        id: crypto.randomUUID(),
        alert_id: alert.id,
        channel: config.channel,
        status: 'pending',
        attempts: 0,
        created_at: new Date()
      };

      this.processingQueue.push(notification);
      await this.storeNotification(notification);
    }

    // Trigger notification processing
    this.processNotificationQueue();
  }

  /**
   * Queue resolution notifications
   */
  private async queueResolutionNotifications(alert: HealthAlert): Promise<void> {
    // Only send resolution notifications for high/critical alerts
    if (alert.severity !== 'high' && alert.severity !== 'critical') {
      return;
    }

    const resolutionConfigs = this.notificationConfigs.filter(config =>
      config.enabled && 
      config.metadata?.send_resolutions === true
    );

    for (const config of resolutionConfigs) {
      const notification: AlertNotification = {
        id: crypto.randomUUID(),
        alert_id: alert.id,
        channel: config.channel,
        status: 'pending',
        attempts: 0,
        created_at: new Date()
      };

      this.processingQueue.push(notification);
      await this.storeNotification(notification);
    }
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const notification = this.processingQueue.shift()!;
        await this.sendNotification(notification);
        
        // Small delay to prevent overwhelming external services
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      structuredLogger.error('Notification queue processing failed', {
        service: 'alert-manager',
        component: 'notification-processor',
        operation: 'process-queue',
        error: error instanceof Error ? error : undefined
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    const startTime = Date.now();
    const config = this.notificationConfigs.find(c => c.channel === notification.channel);
    const alert = this.activeAlerts.get(notification.alert_id);

    if (!config || !alert) {
      notification.status = 'failed';
      notification.error_message = 'Configuration or alert not found';
      await this.updateNotification(notification);
      return;
    }

    notification.attempts += 1;
    notification.last_attempt = new Date();

    try {
      const success = await this.deliverNotification(config, alert, notification);
      
      if (success) {
        notification.status = 'sent';
        notification.sent_at = new Date();
        
        notificationsSent.inc({ channel: config.channel, success: 'true' });
        notificationDeliveryTime.observe(
          { channel: config.channel },
          (Date.now() - startTime) / 1000
        );

        structuredLogger.info('Notification sent successfully', {
          service: 'alert-manager',
          component: 'notification-sender',
          operation: 'send-notification',
          additionalData: {
            notificationId: notification.id,
            channel: config.channel,
            alertId: alert.id,
            attempts: notification.attempts
          }
        });
      } else {
        throw new Error('Notification delivery failed');
      }

    } catch (error) {
      notification.status = 'failed';
      notification.error_message = error instanceof Error ? error.message : 'Unknown error';
      
      notificationsSent.inc({ channel: config.channel, success: 'false' });

      // Schedule retry if attempts remaining
      if (notification.attempts < config.retry.max_attempts) {
        const backoffIndex = Math.min(notification.attempts - 1, config.retry.backoff_seconds.length - 1);
        const backoffSeconds = config.retry.backoff_seconds[backoffIndex];
        
        notification.next_retry = new Date(Date.now() + backoffSeconds * 1000);
        notification.status = 'pending';
        
        // Re-queue for retry
        setTimeout(() => {
          this.processingQueue.push(notification);
          this.processNotificationQueue();
        }, backoffSeconds * 1000);
      }

      structuredLogger.error('Notification delivery failed', {
        service: 'alert-manager',
        component: 'notification-sender',
        operation: 'send-notification',
        error: error instanceof Error ? error : undefined,
        additionalData: {
          notificationId: notification.id,
          channel: config.channel,
          alertId: alert.id,
          attempts: notification.attempts,
          willRetry: notification.attempts < config.retry.max_attempts
        }
      });
    }

    await this.updateNotification(notification);
  }

  /**
   * Deliver notification to specific channel
   */
  private async deliverNotification(
    config: NotificationConfig,
    alert: HealthAlert,
    notification: AlertNotification
  ): Promise<boolean> {
    switch (config.channel) {
      case 'webhook':
        return this.sendWebhookNotification(config, alert);
      case 'email':
        return this.sendEmailNotification(config, alert);
      case 'slack':
        return this.sendSlackNotification(config, alert);
      default:
        structuredLogger.warn('Unsupported notification channel', {
          service: 'alert-manager',
          component: 'notification-sender',
          operation: 'deliver-notification',
          additionalData: { channel: config.channel }
        });
        return false;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(config: NotificationConfig, alert: HealthAlert): Promise<boolean> {
    try {
      const payload = {
        alert_id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        current_value: alert.current_value,
        threshold: alert.threshold,
        resolved: alert.resolved,
        metadata: alert.metadata
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HR-RAG-Platform-AlertManager/1.0',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(config: NotificationConfig, alert: HealthAlert): Promise<boolean> {
    // TODO: Implement email notification using Resend or similar
    // This would integrate with your existing email service
    return true; // Placeholder
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(config: NotificationConfig, alert: HealthAlert): Promise<boolean> {
    try {
      const color = {
        low: '#36a64f',
        medium: '#ff9500',
        high: '#ff0000',
        critical: '#8b0000'
      }[alert.severity];

      const payload = {
        text: `Alert: ${alert.title}`,
        attachments: [{
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Type', value: alert.type, short: true },
            { title: 'Current Value', value: alert.current_value?.toString(), short: true },
            { title: 'Threshold', value: alert.threshold?.toString(), short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: false }
          ],
          footer: 'HR RAG Platform Monitoring',
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }]
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(config: NotificationConfig): boolean {
    const now = Date.now();
    const currentHour = Math.floor(now / (60 * 60 * 1000));
    const key = `${config.channel}-${config.endpoint}`;
    
    const limits = this.notificationCounts.get(key) || { hour: currentHour, count: 0, burst: 0 };
    
    // Reset if new hour
    if (limits.hour !== currentHour) {
      limits.hour = currentHour;
      limits.count = 0;
      limits.burst = 0;
    }
    
    // Check hourly limit
    if (limits.count >= config.rate_limit.max_per_hour) {
      return false;
    }
    
    // Check burst limit (reset every 5 minutes)
    const burstWindow = Math.floor(now / (5 * 60 * 1000));
    if (burstWindow !== Math.floor((limits.burst || 0) / config.rate_limit.burst_limit)) {
      limits.burst = 0;
    }
    
    if (limits.burst >= config.rate_limit.burst_limit) {
      return false;
    }
    
    // Update counters
    limits.count += 1;
    limits.burst += 1;
    this.notificationCounts.set(key, limits);
    
    return true;
  }

  /**
   * Create incident from critical alert
   */
  private async maybeCreateIncident(alert: HealthAlert): Promise<void> {
    // Only create incidents for critical alerts or specific patterns
    if (alert.severity !== 'critical') {
      return;
    }

    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const incident: IncidentReport = {
      id: incidentId,
      title: `Critical Alert: ${alert.title}`,
      description: alert.message,
      severity: alert.severity,
      status: 'open',
      alerts: [alert.id],
      created_at: new Date(),
      tags: [alert.type, 'automated'],
      timeline: [{
        timestamp: new Date(),
        action: 'incident_created',
        details: 'Incident created automatically from critical alert'
      }]
    };

    this.activeIncidents.set(incidentId, incident);
    await this.storeIncident(incident);

    structuredLogger.warn('Incident created from critical alert', {
      service: 'alert-manager',
      component: 'incident-manager',
      operation: 'create-incident',
      additionalData: {
        incidentId,
        alertId: alert.id,
        severity: alert.severity
      }
    });

    this.emit('incident_created', incident);
  }

  /**
   * Maybe resolve incident when alert resolves
   */
  private async maybeResolveIncident(alert: HealthAlert): Promise<void> {
    // Find incidents containing this alert
    const relatedIncidents = Array.from(this.activeIncidents.values())
      .filter(incident => 
        incident.alerts.includes(alert.id) && 
        incident.status === 'open'
      );

    for (const incident of relatedIncidents) {
      // Check if all alerts in incident are resolved
      const allAlertsResolved = incident.alerts.every(alertId => {
        const alertObj = this.activeAlerts.get(alertId);
        return !alertObj || alertObj.resolved;
      });

      if (allAlertsResolved) {
        incident.status = 'resolved';
        incident.resolved_at = new Date();
        incident.timeline.push({
          timestamp: new Date(),
          action: 'incident_resolved',
          details: 'All related alerts have been resolved'
        });

        await this.updateIncident(incident);
        this.activeIncidents.delete(incident.id);

        structuredLogger.info('Incident auto-resolved', {
          service: 'alert-manager',
          component: 'incident-manager',
          operation: 'resolve-incident',
          additionalData: {
            incidentId: incident.id,
            alertId: alert.id
          }
        });

        this.emit('incident_resolved', incident);
      }
    }
  }

  /**
   * Start escalation checker
   */
  private startEscalationChecker(): void {
    setInterval(() => {
      this.checkEscalations().catch(error => {
        structuredLogger.error('Escalation check failed', {
          service: 'alert-manager',
          component: 'escalation-checker',
          operation: 'check-escalations',
          error: error instanceof Error ? error : undefined
        });
      });
    }, 60000); // Check every minute
  }

  /**
   * Check for alerts that need escalation
   */
  private async checkEscalations(): Promise<void> {
    const now = Date.now();
    
    for (const alert of this.activeAlerts.values()) {
      if (alert.resolved) continue;

      const alertAge = now - alert.timestamp.getTime();
      const ageMinutes = alertAge / (60 * 1000);

      for (const rule of this.escalationRules) {
        if (!rule.enabled) continue;

        const matchesSeverity = rule.conditions.severity.includes(alert.severity);
        const exceedsTime = ageMinutes >= rule.conditions.unresolved_minutes;
        const matchesType = !rule.conditions.alert_types || 
                          rule.conditions.alert_types.includes(alert.type);

        if (matchesSeverity && exceedsTime && matchesType) {
          await this.executeEscalation(rule, alert);
        }
      }
    }
  }

  /**
   * Execute escalation rule
   */
  private async executeEscalation(rule: EscalationRule, alert: HealthAlert): Promise<void> {
    structuredLogger.warn('Alert escalation triggered', {
      service: 'alert-manager',
      component: 'escalation-manager',
      operation: 'execute-escalation',
      additionalData: {
        ruleId: rule.id,
        ruleName: rule.name,
        alertId: alert.id,
        currentSeverity: alert.severity
      }
    });

    // Increase severity if configured
    if (rule.actions.increase_severity) {
      const severityLevels: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
      const currentIndex = severityLevels.indexOf(alert.severity);
      if (currentIndex < severityLevels.length - 1) {
        alert.severity = severityLevels[currentIndex + 1];
        await this.updateAlert(alert);
      }
    }

    // Send escalated notifications
    // This would trigger notifications to escalated channels
    
    // Create incident if configured
    if (rule.actions.create_incident && alert.severity === 'critical') {
      await this.maybeCreateIncident(alert);
    }

    this.emit('alert_escalated', { rule, alert });
  }

  /**
   * Start notification processor
   */
  private startNotificationProcessor(): void {
    setInterval(() => {
      this.processNotificationQueue().catch(error => {
        structuredLogger.error('Notification processor error', {
          service: 'alert-manager',
          component: 'notification-processor',
          operation: 'process-loop',
          error: error instanceof Error ? error : undefined
        });
      });
    }, 10000); // Process every 10 seconds
  }

  /**
   * Initialize default notification configurations
   */
  private initializeDefaultConfigs(): void {
    // This would typically be loaded from database/config
    this.notificationConfigs = [
      {
        channel: 'webhook',
        endpoint: process.env.ALERT_WEBHOOK_URL || 'http://localhost:3000/api/alerts/webhook',
        enabled: true,
        severity_filter: ['medium', 'high', 'critical'],
        rate_limit: {
          max_per_hour: 100,
          burst_limit: 10
        },
        retry: {
          max_attempts: 3,
          backoff_seconds: [1, 5, 15]
        }
      }
    ];

    this.escalationRules = [
      {
        id: 'critical-escalation',
        name: 'Critical Alert Escalation',
        conditions: {
          severity: ['high', 'critical'],
          unresolved_minutes: 30
        },
        actions: {
          escalate_to: ['email', 'slack'],
          increase_severity: true,
          create_incident: true
        },
        enabled: true
      }
    ];
  }

  // Database operations
  private async storeAlert(alert: HealthAlert): Promise<void> {
    try {
      await this.supabase.from('alerts').insert({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        threshold: alert.threshold,
        current_value: alert.current_value,
        resolved: alert.resolved,
        metadata: alert.metadata,
        created_at: alert.timestamp.toISOString()
      });
    } catch (error) {
      structuredLogger.error('Failed to store alert', {
        service: 'alert-manager',
        component: 'database',
        operation: 'store-alert',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  private async updateAlert(alert: HealthAlert): Promise<void> {
    try {
      await this.supabase.from('alerts')
        .update({
          severity: alert.severity,
          resolved: alert.resolved,
          metadata: alert.metadata
        })
        .eq('id', alert.id);
    } catch (error) {
      structuredLogger.error('Failed to update alert', {
        service: 'alert-manager',
        component: 'database',
        operation: 'update-alert',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  private async storeNotification(notification: AlertNotification): Promise<void> {
    try {
      await this.supabase.from('alert_notifications').insert({
        id: notification.id,
        alert_id: notification.alert_id,
        channel: notification.channel,
        status: notification.status,
        attempts: notification.attempts,
        created_at: notification.created_at.toISOString()
      });
    } catch (error) {
      structuredLogger.error('Failed to store notification', {
        service: 'alert-manager',
        component: 'database',
        operation: 'store-notification',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  private async updateNotification(notification: AlertNotification): Promise<void> {
    try {
      await this.supabase.from('alert_notifications')
        .update({
          status: notification.status,
          attempts: notification.attempts,
          error_message: notification.error_message,
          sent_at: notification.sent_at?.toISOString(),
          last_attempt: notification.last_attempt?.toISOString()
        })
        .eq('id', notification.id);
    } catch (error) {
      structuredLogger.error('Failed to update notification', {
        service: 'alert-manager',
        component: 'database',
        operation: 'update-notification',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  private async storeIncident(incident: IncidentReport): Promise<void> {
    try {
      await this.supabase.from('incidents').insert({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        alerts: incident.alerts,
        assignee: incident.assignee,
        tags: incident.tags,
        timeline: incident.timeline,
        created_at: incident.created_at.toISOString()
      });
    } catch (error) {
      structuredLogger.error('Failed to store incident', {
        service: 'alert-manager',
        component: 'database',
        operation: 'store-incident',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  private async updateIncident(incident: IncidentReport): Promise<void> {
    try {
      await this.supabase.from('incidents')
        .update({
          status: incident.status,
          resolved_at: incident.resolved_at?.toISOString(),
          timeline: incident.timeline
        })
        .eq('id', incident.id);
    } catch (error) {
      structuredLogger.error('Failed to update incident', {
        service: 'alert-manager',
        component: 'database',
        operation: 'update-incident',
        error: error instanceof Error ? error : undefined
      });
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    active_alerts: number;
    resolved_today: number;
    by_severity: Record<AlertSeverity, number>;
    by_type: Record<string, number>;
    avg_resolution_time: number;
  }> {
    try {
      const { data } = await this.supabase
        .from('alerts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const stats = {
        active_alerts: this.activeAlerts.size,
        resolved_today: 0,
        by_severity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<AlertSeverity, number>,
        by_type: {} as Record<string, number>,
        avg_resolution_time: 0
      };

      data?.forEach(alert => {
        stats.by_severity[alert.severity as AlertSeverity] += 1;
        stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;
        
        if (alert.resolved) {
          stats.resolved_today += 1;
        }
      });

      return stats;
    } catch (error) {
      structuredLogger.error('Failed to get alert stats', {
        service: 'alert-manager',
        component: 'stats',
        operation: 'get-alert-stats',
        error: error instanceof Error ? error : undefined
      });
      
      return {
        active_alerts: 0,
        resolved_today: 0,
        by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
        by_type: {},
        avg_resolution_time: 0
      };
    }
  }
}

// Export singleton instance
export const alertManager = new AlertManager();

// Export types
export type { NotificationConfig, AlertNotification, EscalationRule, IncidentReport };

export default alertManager;