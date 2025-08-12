/**
 * Webhook Monitoring Service
 * Provides comprehensive monitoring, alerting, and analytics for the webhook system
 */

import { createClient } from '@supabase/supabase-js';
import type { 
  WebhookAnalytics,
  WebhookEventType,
  WebhookDeliveryStatus
} from '@/types/webhooks';
import { WebhookError } from '@/types/webhooks';
import { EventEmitter } from 'events';

interface WebhookHealthMetrics {
  webhookId: string;
  webhookName: string;
  isHealthy: boolean;
  metrics: {
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    lastSuccessfulDelivery?: string;
    consecutiveFailures: number;
    totalEvents: number;
    totalDeliveries: number;
  };
  alerts: WebhookAlert[];
  lastUpdated: string;
}

interface WebhookAlert {
  id: string;
  type: 'success_rate' | 'response_time' | 'consecutive_failures' | 'rate_limit' | 'endpoint_down';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold?: number;
  currentValue?: number;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
}

interface SystemHealthDashboard {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  totalWebhooks: number;
  activeWebhooks: number;
  healthyWebhooks: number;
  degradedWebhooks: number;
  criticalWebhooks: number;
  systemMetrics: {
    totalEvents: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    overallSuccessRate: number;
  };
  topFailingWebhooks: Array<{
    webhookId: string;
    name: string;
    failureRate: number;
    consecutiveFailures: number;
  }>;
  recentAlerts: WebhookAlert[];
  performanceTrends: {
    period: string;
    data: Array<{
      timestamp: string;
      successRate: number;
      responseTime: number;
      eventCount: number;
    }>;
  };
}

interface MonitoringConfig {
  successRateThreshold: number; // Minimum success rate (0-1)
  responseTimeThreshold: number; // Maximum response time in ms
  consecutiveFailuresThreshold: number; // Maximum consecutive failures
  alertCooldown: number; // Cooldown period in minutes
  healthCheckInterval: number; // Health check interval in minutes
}

export class WebhookMonitoringService extends EventEmitter {
  private supabase;
  private config: MonitoringConfig;
  private alerts: Map<string, WebhookAlert[]> = new Map();
  private healthCache: Map<string, WebhookHealthMetrics> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = {
      successRateThreshold: 0.95, // 95%
      responseTimeThreshold: 5000, // 5 seconds
      consecutiveFailuresThreshold: 5,
      alertCooldown: 15, // 15 minutes
      healthCheckInterval: 5, // 5 minutes
      ...config
    };

    this.startMonitoring();
  }

  /**
   * Get comprehensive health metrics for a specific webhook
   */
  async getWebhookHealth(webhookId: string, period: { start: string; end: string }): Promise<WebhookHealthMetrics> {
    try {
      // Get webhook details
      const { data: webhook, error: webhookError } = await this.supabase
        .from('webhooks')
        .select('name')
        .eq('id', webhookId)
        .single();

      if (webhookError) {
        throw new WebhookError(`Failed to get webhook: ${webhookError.message}`, 'WEBHOOK_NOT_FOUND');
      }

      // Get delivery statistics
      const { data: deliveries, error: deliveriesError } = await this.supabase
        .from('webhook_deliveries')
        .select('delivery_status, created_at, delivered_at, response_status_code')
        .eq('webhook_id', webhookId)
        .gte('created_at', period.start)
        .lte('created_at', period.end);

      if (deliveriesError) {
        throw new WebhookError(`Failed to get deliveries: ${deliveriesError.message}`, 'QUERY_FAILED');
      }

      // Calculate metrics
      const totalDeliveries = deliveries?.length || 0;
      const successfulDeliveries = deliveries?.filter(d => d.delivery_status === 'delivered').length || 0;
      const failedDeliveries = totalDeliveries - successfulDeliveries;
      const successRate = totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 1;

      // Calculate average response time from logs
      const avgResponseTime = await this.calculateAverageResponseTime(webhookId, period);

      // Count consecutive failures
      const consecutiveFailures = this.countConsecutiveFailures(deliveries || []);

      // Find last successful delivery
      const lastSuccess = deliveries?.find(d => d.delivery_status === 'delivered');
      const lastSuccessfulDelivery = lastSuccess?.delivered_at;

      // Generate alerts
      const alerts = this.generateAlerts(webhookId, {
        successRate,
        averageResponseTime: avgResponseTime,
        consecutiveFailures,
        lastSuccessfulDelivery
      });

      // Determine overall health
      const isHealthy = successRate >= this.config.successRateThreshold &&
                       avgResponseTime <= this.config.responseTimeThreshold &&
                       consecutiveFailures < this.config.consecutiveFailuresThreshold;

      const healthMetrics: WebhookHealthMetrics = {
        webhookId,
        webhookName: webhook.name,
        isHealthy,
        metrics: {
          successRate,
          averageResponseTime: avgResponseTime,
          errorRate: 1 - successRate,
          lastSuccessfulDelivery,
          consecutiveFailures,
          totalEvents: totalDeliveries, // Approximation
          totalDeliveries
        },
        alerts,
        lastUpdated: new Date().toISOString()
      };

      // Cache the health metrics
      this.healthCache.set(webhookId, healthMetrics);

      return healthMetrics;

    } catch (error) {
      throw error instanceof WebhookError ? error : 
        new WebhookError(`Failed to get webhook health: ${error}`, 'HEALTH_CHECK_FAILED');
    }
  }

  /**
   * Get system-wide health dashboard
   */
  async getSystemHealthDashboard(period: { start: string; end: string }): Promise<SystemHealthDashboard> {
    try {
      // Get all active webhooks
      const { data: webhooks, error: webhooksError } = await this.supabase
        .from('webhooks')
        .select('id, name, is_active')
        .eq('is_active', true);

      if (webhooksError) {
        throw new WebhookError(`Failed to get webhooks: ${webhooksError.message}`, 'QUERY_FAILED');
      }

      const totalWebhooks = webhooks?.length || 0;
      const activeWebhooks = totalWebhooks;

      // Get health metrics for all webhooks
      const healthPromises = (webhooks || []).map(webhook => 
        this.getWebhookHealth(webhook.id, period).catch(() => null)
      );
      const healthMetrics = (await Promise.all(healthPromises)).filter(Boolean) as WebhookHealthMetrics[];

      // Categorize webhooks by health
      const healthyWebhooks = healthMetrics.filter(h => h.isHealthy).length;
      const degradedWebhooks = healthMetrics.filter(h => !h.isHealthy && h.alerts.some(a => a.severity === 'medium' || a.severity === 'high')).length;
      const criticalWebhooks = healthMetrics.filter(h => !h.isHealthy && h.alerts.some(a => a.severity === 'critical')).length;

      // Determine overall system health
      let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (criticalWebhooks > 0 || (degradedWebhooks / totalWebhooks) > 0.3) {
        overallHealth = 'critical';
      } else if (degradedWebhooks > 0 || (healthyWebhooks / totalWebhooks) < 0.9) {
        overallHealth = 'degraded';
      }

      // Calculate system-wide metrics
      const systemMetrics = this.calculateSystemMetrics(healthMetrics);

      // Get top failing webhooks
      const topFailingWebhooks = healthMetrics
        .filter(h => !h.isHealthy)
        .sort((a, b) => b.metrics.errorRate - a.metrics.errorRate)
        .slice(0, 5)
        .map(h => ({
          webhookId: h.webhookId,
          name: h.webhookName,
          failureRate: h.metrics.errorRate,
          consecutiveFailures: h.metrics.consecutiveFailures
        }));

      // Get recent alerts
      const recentAlerts = healthMetrics
        .flatMap(h => h.alerts)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      // Get performance trends
      const performanceTrends = await this.getPerformanceTrends(period);

      return {
        overallHealth,
        totalWebhooks,
        activeWebhooks,
        healthyWebhooks,
        degradedWebhooks,
        criticalWebhooks,
        systemMetrics,
        topFailingWebhooks,
        recentAlerts,
        performanceTrends
      };

    } catch (error) {
      throw error instanceof WebhookError ? error : 
        new WebhookError(`Failed to get system health dashboard: ${error}`, 'DASHBOARD_FAILED');
    }
  }

  /**
   * Get detailed webhook analytics with trends and breakdowns
   */
  async getWebhookAnalytics(
    webhookId: string,
    period: { start: string; end: string },
    granularity: 'hour' | 'day' = 'hour'
  ): Promise<WebhookAnalytics & { trends: any; breakdowns: any }> {
    try {
      // Get basic analytics
      const { data: deliveries, error } = await this.supabase
        .from('webhook_deliveries')
        .select(`
          delivery_status,
          created_at,
          delivered_at,
          response_status_code,
          webhook_events(event_type)
        `)
        .eq('webhook_id', webhookId)
        .gte('created_at', period.start)
        .lte('created_at', period.end);

      if (error) {
        throw new WebhookError(`Failed to get analytics: ${error.message}`, 'QUERY_FAILED');
      }

      const totalEvents = deliveries?.length || 0;
      const successfulDeliveries = deliveries?.filter(d => d.delivery_status === 'delivered').length || 0;
      const failedDeliveries = totalEvents - successfulDeliveries;
      const successRate = totalEvents > 0 ? successfulDeliveries / totalEvents : 0;

      // Calculate average response time
      const avgResponseTime = await this.calculateAverageResponseTime(webhookId, period);

      // Event breakdown
      const eventBreakdown: Record<WebhookEventType, number> = {};
      const statusBreakdown: Record<WebhookDeliveryStatus, number> = {};

      (deliveries || []).forEach((delivery: any) => {
        const eventType = delivery.webhook_events?.event_type;
        const status = delivery.delivery_status;

        if (eventType) {
          eventBreakdown[eventType as WebhookEventType] = (eventBreakdown[eventType as WebhookEventType] || 0) + 1;
        }

        if (status) {
          statusBreakdown[status as WebhookDeliveryStatus] = (statusBreakdown[status as WebhookDeliveryStatus] || 0) + 1;
        }
      });

      // Generate trends data
      const trends = await this.generateTrends(webhookId, period, granularity);

      // Additional breakdowns
      const breakdowns = {
        responseCodeBreakdown: this.generateResponseCodeBreakdown(deliveries || []),
        timeOfDayBreakdown: this.generateTimeOfDayBreakdown(deliveries || []),
        errorBreakdown: await this.getErrorBreakdown(webhookId, period)
      };

      return {
        webhookId,
        period,
        metrics: {
          totalEvents,
          successfulDeliveries,
          failedDeliveries,
          averageResponseTime: avgResponseTime,
          successRate
        },
        eventBreakdown,
        statusBreakdown,
        trends,
        breakdowns
      };

    } catch (error) {
      throw error instanceof WebhookError ? error : 
        new WebhookError(`Failed to get webhook analytics: ${error}`, 'ANALYTICS_FAILED');
    }
  }

  /**
   * Set up alerting rules for a webhook
   */
  async configureAlerting(
    webhookId: string,
    rules: {
      successRateThreshold?: number;
      responseTimeThreshold?: number;
      consecutiveFailuresThreshold?: number;
      alertChannels: string[]; // webhook URLs or email addresses for alerts
    }
  ): Promise<void> {
    try {
      // Store alerting configuration in database
      const { error } = await this.supabase
        .from('webhook_alerting_config')
        .upsert({
          webhook_id: webhookId,
          success_rate_threshold: rules.successRateThreshold || this.config.successRateThreshold,
          response_time_threshold: rules.responseTimeThreshold || this.config.responseTimeThreshold,
          consecutive_failures_threshold: rules.consecutiveFailuresThreshold || this.config.consecutiveFailuresThreshold,
          alert_channels: rules.alertChannels
        }, {
          onConflict: 'webhook_id'
        });

      if (error) {
        throw new WebhookError(`Failed to configure alerting: ${error.message}`, 'CONFIG_FAILED');
      }

    } catch (error) {
      throw error instanceof WebhookError ? error : 
        new WebhookError(`Failed to configure alerting: ${error}`, 'CONFIG_FAILED');
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: WebhookAlert, webhookId: string): Promise<void> {
    try {
      // Get alerting configuration
      const { data: config } = await this.supabase
        .from('webhook_alerting_config')
        .select('alert_channels')
        .eq('webhook_id', webhookId)
        .single();

      const alertChannels = config?.alert_channels || [];

      // Send alert to configured channels
      const alertPromises = alertChannels.map(async (channel: string) => {
        if (channel.startsWith('http')) {
          // Send to webhook
          try {
            await fetch(channel, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'webhook_alert',
                alert,
                webhookId,
                timestamp: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error(`Failed to send alert to webhook ${channel}:`, error);
          }
        } else if (channel.includes('@')) {
          // Send email alert (would require email service integration)
          // This is a placeholder - implement email sending logic
          console.log(`Would send email alert to ${channel}:`, alert);
        }
      });

      await Promise.allSettled(alertPromises);

      // Emit alert event for real-time notifications
      this.emit('alert', { alert, webhookId });

    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Error during health checks:', error);
      }
    }, this.config.healthCheckInterval * 60 * 1000);
  }

  /**
   * Perform health checks on all webhooks
   */
  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get all active webhooks
    const { data: webhooks } = await this.supabase
      .from('webhooks')
      .select('id')
      .eq('is_active', true);

    if (!webhooks) return;

    // Check health of each webhook
    const healthPromises = webhooks.map(async (webhook) => {
      try {
        const health = await this.getWebhookHealth(webhook.id, {
          start: oneHourAgo.toISOString(),
          end: now.toISOString()
        });

        // Send alerts for unhealthy webhooks
        for (const alert of health.alerts) {
          if (!alert.resolved && this.shouldSendAlert(alert, webhook.id)) {
            await this.sendAlert(alert, webhook.id);
          }
        }

      } catch (error) {
        console.error(`Failed to check health for webhook ${webhook.id}:`, error);
      }
    });

    await Promise.allSettled(healthPromises);
  }

  // Private helper methods

  private async calculateAverageResponseTime(webhookId: string, period: { start: string; end: string }): Promise<number> {
    const { data: logs, error } = await this.supabase
      .from('webhook_delivery_logs')
      .select('response_time_ms')
      .eq('webhook_id', webhookId)
      .gte('attempted_at', period.start)
      .lte('attempted_at', period.end)
      .not('response_time_ms', 'is', null);

    if (error || !logs?.length) return 0;

    const totalTime = logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0);
    return totalTime / logs.length;
  }

  private countConsecutiveFailures(deliveries: any[]): number {
    const sortedDeliveries = deliveries
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let consecutiveFailures = 0;
    for (const delivery of sortedDeliveries) {
      if (delivery.delivery_status === 'failed' || delivery.delivery_status === 'abandoned') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return consecutiveFailures;
  }

  private generateAlerts(webhookId: string, metrics: any): WebhookAlert[] {
    const alerts: WebhookAlert[] = [];

    // Success rate alert
    if (metrics.successRate < this.config.successRateThreshold) {
      alerts.push({
        id: `${webhookId}-success-rate-${Date.now()}`,
        type: 'success_rate',
        severity: metrics.successRate < 0.5 ? 'critical' : 'high',
        message: `Success rate (${Math.round(metrics.successRate * 100)}%) is below threshold (${Math.round(this.config.successRateThreshold * 100)}%)`,
        threshold: this.config.successRateThreshold,
        currentValue: metrics.successRate,
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    // Response time alert
    if (metrics.averageResponseTime > this.config.responseTimeThreshold) {
      alerts.push({
        id: `${webhookId}-response-time-${Date.now()}`,
        type: 'response_time',
        severity: metrics.averageResponseTime > this.config.responseTimeThreshold * 2 ? 'critical' : 'medium',
        message: `Average response time (${Math.round(metrics.averageResponseTime)}ms) exceeds threshold (${this.config.responseTimeThreshold}ms)`,
        threshold: this.config.responseTimeThreshold,
        currentValue: metrics.averageResponseTime,
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    // Consecutive failures alert
    if (metrics.consecutiveFailures >= this.config.consecutiveFailuresThreshold) {
      alerts.push({
        id: `${webhookId}-consecutive-failures-${Date.now()}`,
        type: 'consecutive_failures',
        severity: metrics.consecutiveFailures >= this.config.consecutiveFailuresThreshold * 2 ? 'critical' : 'high',
        message: `${metrics.consecutiveFailures} consecutive failures detected`,
        threshold: this.config.consecutiveFailuresThreshold,
        currentValue: metrics.consecutiveFailures,
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    return alerts;
  }

  private calculateSystemMetrics(healthMetrics: WebhookHealthMetrics[]) {
    const totalDeliveries = healthMetrics.reduce((sum, h) => sum + h.metrics.totalDeliveries, 0);
    const successfulDeliveries = healthMetrics.reduce((sum, h) => sum + (h.metrics.totalDeliveries * h.metrics.successRate), 0);
    const totalResponseTime = healthMetrics.reduce((sum, h) => sum + h.metrics.averageResponseTime, 0);

    return {
      totalEvents: totalDeliveries,
      totalDeliveries,
      successfulDeliveries: Math.round(successfulDeliveries),
      failedDeliveries: totalDeliveries - Math.round(successfulDeliveries),
      averageResponseTime: healthMetrics.length > 0 ? totalResponseTime / healthMetrics.length : 0,
      overallSuccessRate: totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 1
    };
  }

  private async getPerformanceTrends(period: { start: string; end: string }) {
    // This would generate time-series data for performance trends
    // Placeholder implementation
    return {
      period: '24h',
      data: []
    };
  }

  private async generateTrends(webhookId: string, period: { start: string; end: string }, granularity: 'hour' | 'day') {
    // Generate time-series trends data
    // Placeholder implementation
    return {
      successRate: [],
      responseTime: [],
      eventVolume: []
    };
  }

  private generateResponseCodeBreakdown(deliveries: any[]) {
    const breakdown: Record<string, number> = {};
    deliveries.forEach(delivery => {
      const code = delivery.response_status_code || 'unknown';
      breakdown[code] = (breakdown[code] || 0) + 1;
    });
    return breakdown;
  }

  private generateTimeOfDayBreakdown(deliveries: any[]) {
    const breakdown: Record<string, number> = {};
    deliveries.forEach(delivery => {
      const hour = new Date(delivery.created_at).getHours();
      const timeSlot = `${hour}:00`;
      breakdown[timeSlot] = (breakdown[timeSlot] || 0) + 1;
    });
    return breakdown;
  }

  private async getErrorBreakdown(webhookId: string, period: { start: string; end: string }) {
    const { data: errorLogs } = await this.supabase
      .from('webhook_delivery_logs')
      .select('error_type, error_message')
      .eq('webhook_id', webhookId)
      .eq('is_success', false)
      .gte('attempted_at', period.start)
      .lte('attempted_at', period.end);

    const breakdown: Record<string, number> = {};
    (errorLogs || []).forEach(log => {
      const errorType = log.error_type || 'unknown';
      breakdown[errorType] = (breakdown[errorType] || 0) + 1;
    });

    return breakdown;
  }

  private shouldSendAlert(alert: WebhookAlert, webhookId: string): boolean {
    const existingAlerts = this.alerts.get(webhookId) || [];
    const recentAlert = existingAlerts.find(a => 
      a.type === alert.type && 
      new Date().getTime() - new Date(a.createdAt).getTime() < this.config.alertCooldown * 60 * 1000
    );

    return !recentAlert;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

export default WebhookMonitoringService;