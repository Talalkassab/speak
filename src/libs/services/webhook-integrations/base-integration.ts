/**
 * Base Integration Class
 * Abstract base class for all webhook integrations
 */

import type { 
  IntegrationConfig, 
  IntegrationType, 
  BaseWebhookPayload,
  WebhookConfig
} from '@/types/webhooks';

export interface IntegrationDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  deliveryTime: number;
}

export interface IntegrationValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export abstract class BaseIntegration {
  protected integrationType: IntegrationType;
  protected config: IntegrationConfig;
  protected webhookConfig: WebhookConfig;

  constructor(
    integrationType: IntegrationType,
    config: IntegrationConfig,
    webhookConfig: WebhookConfig
  ) {
    this.integrationType = integrationType;
    this.config = config;
    this.webhookConfig = webhookConfig;
  }

  /**
   * Validate integration configuration
   */
  abstract validateConfig(): IntegrationValidationResult;

  /**
   * Transform webhook payload for the specific integration
   */
  abstract transformPayload(payload: BaseWebhookPayload): Promise<any>;

  /**
   * Deliver webhook to the integration endpoint
   */
  abstract deliver(payload: BaseWebhookPayload): Promise<IntegrationDeliveryResult>;

  /**
   * Test integration connectivity and configuration
   */
  abstract test(): Promise<IntegrationDeliveryResult>;

  /**
   * Get integration-specific headers
   */
  protected abstract getHeaders(): Record<string, string>;

  /**
   * Get integration-specific delivery URL
   */
  protected abstract getDeliveryUrl(): string;

  /**
   * Format error message for integration
   */
  protected formatError(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return JSON.stringify(error);
  }

  /**
   * Common HTTP request method for integrations
   */
  protected async makeHttpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeoutMs: number = 30000
  ): Promise<IntegrationDeliveryResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HR-Intelligence-Platform/1.0 Webhook',
          ...headers
        },
        body,
        signal: controller.signal
      } as any);

      clearTimeout(timeoutId);
      
      const responseBody = await response.text();
      const deliveryTime = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        deliveryTime
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      return {
        success: false,
        error: this.formatError(error),
        deliveryTime
      };
    }
  }

  /**
   * Get common webhook metadata
   */
  protected getWebhookMetadata(payload: BaseWebhookPayload) {
    return {
      webhookId: payload.webhook.id,
      webhookName: payload.webhook.name,
      eventId: payload.event.id,
      eventType: payload.event.type,
      timestamp: payload.event.timestamp,
      deliveryId: payload.delivery.id,
      attemptNumber: payload.delivery.attempt
    };
  }

  /**
   * Truncate long text for better readability in integrations
   */
  protected truncateText(text: string, maxLength: number = 1000): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format timestamp for human readability
   */
  protected formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get severity color for different platforms
   */
  protected getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#FF0000';
      case 'high':
        return '#FF6600';
      case 'medium':
      case 'warning':
        return '#FFCC00';
      case 'low':
      case 'info':
        return '#0066CC';
      default:
        return '#666666';
    }
  }

  /**
   * Get emoji for event types
   */
  protected getEventEmoji(eventType: string): string {
    if (eventType.startsWith('document.')) {
      return '📄';
    } else if (eventType.startsWith('chat.')) {
      return '💬';
    } else if (eventType.startsWith('analytics.')) {
      return '📊';
    } else if (eventType.startsWith('compliance.')) {
      return '⚖️';
    } else if (eventType.startsWith('system.')) {
      return '🔧';
    }
    return '📡';
  }
}