/**
 * Integration Factory
 * Creates appropriate integration instances based on type
 */

import type { IntegrationType, IntegrationConfig, WebhookConfig } from '@/types/webhooks';
import { BaseIntegration } from './base-integration';
import SlackIntegration from './slack-integration';
import TeamsIntegration from './teams-integration';
import EmailIntegration from './email-integration';
import SMSIntegration from './sms-integration';
import DiscordIntegration from './discord-integration';

export class IntegrationFactory {
  static createIntegration(
    integrationType: IntegrationType,
    config: IntegrationConfig,
    webhookConfig: WebhookConfig
  ): BaseIntegration {
    switch (integrationType) {
      case 'slack':
        return new SlackIntegration(config, webhookConfig);
      
      case 'microsoft_teams':
        return new TeamsIntegration(config, webhookConfig);
      
      case 'email':
        return new EmailIntegration(config, webhookConfig);
      
      case 'custom':
      case 'webhook':
        // For custom webhooks, we can use a generic HTTP integration
        return new CustomWebhookIntegration(config, webhookConfig);
      
      case 'sms':
        return new SMSIntegration(config, webhookConfig);
      
      case 'discord':
        return new DiscordIntegration(config, webhookConfig);
      
      default:
        throw new Error(`Unsupported integration type: ${integrationType}`);
    }
  }

  static getSupportedIntegrations(): IntegrationType[] {
    return ['custom', 'webhook', 'slack', 'microsoft_teams', 'email', 'sms', 'discord'];
  }

  static getIntegrationInfo(integrationType: IntegrationType) {
    const integrationInfo = {
      custom: {
        name: 'Custom Webhook',
        description: 'Send webhooks to any HTTP endpoint',
        requiredFields: ['url'],
        optionalFields: ['headers', 'authentication']
      },
      webhook: {
        name: 'HTTP Webhook',
        description: 'Standard HTTP webhook delivery',
        requiredFields: ['url'],
        optionalFields: ['headers', 'authentication']
      },
      slack: {
        name: 'Slack',
        description: 'Send notifications to Slack channels',
        requiredFields: ['channel'],
        optionalFields: ['username', 'iconEmoji', 'iconUrl']
      },
      microsoft_teams: {
        name: 'Microsoft Teams',
        description: 'Send notifications to Microsoft Teams channels',
        requiredFields: ['webhookUrl'],
        optionalFields: ['theme']
      },
      email: {
        name: 'Email',
        description: 'Send notifications via email',
        requiredFields: ['to'],
        optionalFields: ['cc', 'bcc', 'subject', 'template']
      },
      sms: {
        name: 'SMS',
        description: 'Send notifications via SMS',
        requiredFields: ['to', 'provider'],
        optionalFields: ['from']
      },
      discord: {
        name: 'Discord',
        description: 'Send notifications to Discord channels',
        requiredFields: ['webhookUrl'],
        optionalFields: ['username', 'avatarUrl']
      }
    };

    return integrationInfo[integrationType];
  }
}

/**
 * Custom/Generic Webhook Integration
 * Handles standard HTTP webhook delivery
 */
class CustomWebhookIntegration extends BaseIntegration {
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('custom', config, webhookConfig);
  }

  validateConfig() {
    return { isValid: true }; // Basic validation is handled by webhook service
  }

  async transformPayload(payload: any) {
    // Apply custom payload template if configured
    if (this.webhookConfig.payloadTemplate) {
      return this.applyPayloadTemplate(payload, this.webhookConfig.payloadTemplate);
    }
    
    // Return payload as-is for custom webhooks
    return payload;
  }

  async deliver(payload: any) {
    try {
      const transformedPayload = await this.transformPayload(payload);
      const url = this.getDeliveryUrl();
      const headers = this.getHeaders();
      
      return await this.makeHttpRequest(
        url,
        'POST',
        headers,
        JSON.stringify(transformedPayload),
        this.webhookConfig.timeoutSeconds * 1000
      );
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        deliveryTime: 0
      };
    }
  }

  async test() {
    const testPayload = {
      event: {
        id: 'test-event-id',
        type: 'system.health.alert',
        timestamp: new Date().toISOString(),
        data: {
          component: 'webhook_system',
          message: 'This is a test message from HR Intelligence Platform',
          severity: 'info'
        }
      },
      webhook: {
        id: this.webhookConfig.id || 'test-webhook',
        name: this.webhookConfig.name || 'Test Webhook'
      },
      delivery: {
        id: 'test-delivery-id',
        attempt: 1
      }
    };

    return await this.deliver(testPayload);
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.webhookConfig.customHeaders
    };

    // Add authentication headers based on webhook config
    if (this.webhookConfig.authType === 'api_key' && this.webhookConfig.authConfig.apiKey) {
      headers['X-API-Key'] = this.webhookConfig.authConfig.apiKey;
    } else if (this.webhookConfig.authType === 'bearer_token' && this.webhookConfig.authConfig.bearerToken) {
      headers['Authorization'] = `Bearer ${this.webhookConfig.authConfig.bearerToken}`;
    }

    return headers;
  }

  protected getDeliveryUrl(): string {
    return this.webhookConfig.url;
  }

  private applyPayloadTemplate(payload: any, template: Record<string, any>): any {
    // Simple template application - can be enhanced with more sophisticated templating
    const templateString = JSON.stringify(template);
    const filledTemplate = templateString.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(payload, path.trim());
      return value !== undefined ? JSON.stringify(value) : match;
    });
    
    try {
      return JSON.parse(filledTemplate);
    } catch {
      return payload; // Fallback to original payload if template parsing fails
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

export default IntegrationFactory;