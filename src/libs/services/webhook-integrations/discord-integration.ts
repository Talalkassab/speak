/**
 * Discord Integration
 * Sends webhook notifications to Discord channels
 */

import { BaseIntegration } from './base-integration';
import type { IntegrationConfig, WebhookConfig, BaseWebhookPayload } from '@/types/webhooks';

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  timestamp?: string;
  url?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    icon_url?: string;
    url?: string;
  };
  thumbnail?: {
    url: string;
  };
}

interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  tts?: boolean;
}

export class DiscordIntegration extends BaseIntegration {
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('discord', config, webhookConfig);
  }

  validateConfig() {
    const discordConfig = this.integrationConfig.discord;
    
    if (!discordConfig) {
      return {
        isValid: false,
        error: 'Discord configuration is required'
      };
    }
    
    if (!discordConfig.webhookUrl) {
      return {
        isValid: false,
        error: 'Discord webhook URL is required'
      };
    }
    
    // Validate Discord webhook URL format
    const discordWebhookRegex = /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    if (!discordWebhookRegex.test(discordConfig.webhookUrl)) {
      return {
        isValid: false,
        error: 'Invalid Discord webhook URL format'
      };
    }
    
    return { isValid: true };
  }

  async transformPayload(payload: BaseWebhookPayload): Promise<DiscordMessage> {
    const { event, webhook } = payload;
    const discordConfig = this.integrationConfig.discord!;
    
    // Color scheme for different event types
    const colorMap: Record<string, number> = {
      // Document events - Blue shades
      'document.uploaded': 0x3498db,
      'document.processing.completed': 0x2ecc71,
      'document.processing.failed': 0xe74c3c,
      'document.analysis.completed': 0x9b59b6,
      'document.deleted': 0x95a5a6,
      
      // Chat events - Green shades
      'chat.conversation.created': 0x2ecc71,
      'chat.message.sent': 0x27ae60,
      'chat.message.received': 0x00d2d3,
      'chat.ai.response.generated': 0x8e44ad,
      'chat.conversation.archived': 0x7f8c8d,
      
      // Analytics events - Orange/Yellow shades
      'analytics.usage.threshold': 0xf39c12,
      'analytics.cost.alert': 0xe67e22,
      'analytics.performance.degraded': 0xd35400,
      'analytics.quota.exceeded': 0xc0392b,
      
      // Compliance events - Red shades
      'compliance.policy.violation': 0xe74c3c,
      'compliance.audit.trigger': 0xc0392b,
      'compliance.regulatory.alert': 0xa93226,
      'compliance.data.breach.detected': 0x922b21,
      
      // System events - Various colors based on severity
      'system.health.alert': 0xf39c12,
      'system.error.critical': 0xe74c3c,
      'system.maintenance.scheduled': 0x3498db,
      'system.maintenance.started': 0x17a2b8,
      'system.maintenance.completed': 0x2ecc71,
      'system.backup.completed': 0x28b463,
      'system.backup.failed': 0xe74c3c
    };
    
    // Emoji mapping for event types
    const emojiMap: Record<string, string> = {
      'document.uploaded': '📄',
      'document.processing.completed': '✅',
      'document.processing.failed': '❌',
      'document.analysis.completed': '🔍',
      'document.deleted': '🗑️',
      'chat.conversation.created': '💬',
      'chat.message.sent': '📤',
      'chat.message.received': '📥',
      'chat.ai.response.generated': '🤖',
      'chat.conversation.archived': '📁',
      'analytics.usage.threshold': '📊',
      'analytics.cost.alert': '💰',
      'analytics.performance.degraded': '⚠️',
      'analytics.quota.exceeded': '🚫',
      'compliance.policy.violation': '⚠️',
      'compliance.audit.trigger': '🔍',
      'compliance.regulatory.alert': '📋',
      'compliance.data.breach.detected': '🚨',
      'system.health.alert': '🔧',
      'system.error.critical': '🚨',
      'system.maintenance.scheduled': '🔧',
      'system.maintenance.started': '🚧',
      'system.maintenance.completed': '✅',
      'system.backup.completed': '💾',
      'system.backup.failed': '❌'
    };
    
    const eventEmoji = emojiMap[event.type] || '📢';
    const eventColor = colorMap[event.type] || 0x95a5a6;
    
    // Create embed
    const embed: DiscordEmbed = {
      title: `${eventEmoji} ${this.formatEventType(event.type)}`,
      color: eventColor,
      timestamp: event.timestamp,
      footer: {
        text: `HR Intelligence Platform • Webhook: ${webhook.name}`,
        icon_url: 'https://your-domain.com/logo-small.png' // Replace with actual logo URL
      }
    };
    
    // Add event-specific fields
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    
    if (event.type.startsWith('document.')) {
      if (event.data.fileName) {
        fields.push({ name: 'File Name', value: event.data.fileName, inline: true });
      }
      if (event.data.fileSize) {
        fields.push({ name: 'File Size', value: this.formatFileSize(event.data.fileSize), inline: true });
      }
      if (event.data.mimeType) {
        fields.push({ name: 'Type', value: event.data.mimeType, inline: true });
      }
      if (event.data.status) {
        fields.push({ name: 'Status', value: event.data.status, inline: true });
      }
      if (event.data.error) {
        fields.push({ name: 'Error', value: event.data.error });
      }
    } else if (event.type.startsWith('chat.')) {
      if (event.data.conversationId) {
        fields.push({ name: 'Conversation', value: `...${event.data.conversationId.substring(-8)}`, inline: true });
      }
      if (event.data.role) {
        fields.push({ name: 'Role', value: event.data.role, inline: true });
      }
      if (event.data.content && event.data.content.length <= 200) {
        fields.push({ name: 'Content', value: event.data.content });
      }
    } else if (event.type.startsWith('analytics.')) {
      if (event.data.metric) {
        fields.push({ name: 'Metric', value: event.data.metric, inline: true });
      }
      if (event.data.value !== undefined) {
        fields.push({ name: 'Value', value: event.data.value.toString(), inline: true });
      }
      if (event.data.threshold !== undefined) {
        fields.push({ name: 'Threshold', value: event.data.threshold.toString(), inline: true });
      }
      if (event.data.severity) {
        fields.push({ name: 'Severity', value: event.data.severity, inline: true });
      }
    } else if (event.type.startsWith('system.')) {
      if (event.data.component) {
        fields.push({ name: 'Component', value: event.data.component, inline: true });
      }
      if (event.data.severity) {
        fields.push({ name: 'Severity', value: event.data.severity, inline: true });
      }
      if (event.data.message) {
        fields.push({ name: 'Message', value: event.data.message });
      }
      if (event.data.affectedServices && event.data.affectedServices.length > 0) {
        fields.push({ name: 'Affected Services', value: event.data.affectedServices.join(', ') });
      }
    } else if (event.type.startsWith('compliance.')) {
      if (event.data.violationType) {
        fields.push({ name: 'Violation Type', value: event.data.violationType, inline: true });
      }
      if (event.data.severity) {
        fields.push({ name: 'Severity', value: event.data.severity, inline: true });
      }
      if (event.data.resourceType) {
        fields.push({ name: 'Resource Type', value: event.data.resourceType, inline: true });
      }
      if (event.data.recommendedActions && event.data.recommendedActions.length > 0) {
        fields.push({ name: 'Recommended Actions', value: event.data.recommendedActions.join(', ') });
      }
    }
    
    // Add event ID as a field
    fields.push({ name: 'Event ID', value: event.id, inline: true });
    
    embed.fields = fields;
    
    // Create Discord message
    const message: DiscordMessage = {
      username: discordConfig.username || 'HR Intelligence Platform',
      avatar_url: discordConfig.avatarUrl,
      embeds: [embed]
    };
    
    return message;
  }

  async deliver(payload: BaseWebhookPayload) {
    try {
      const discordMessage = await this.transformPayload(payload);
      const url = this.integrationConfig.discord!.webhookUrl;
      const headers = { 'Content-Type': 'application/json' };
      
      return await this.makeHttpRequest(
        url,
        'POST',
        headers,
        JSON.stringify(discordMessage),
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
    const testPayload: BaseWebhookPayload = {
      event: {
        id: 'test-event-id',
        type: 'system.health.alert',
        timestamp: new Date().toISOString(),
        data: {
          component: 'webhook_system',
          message: 'Discord integration test from HR Intelligence Platform',
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
    return { 'Content-Type': 'application/json' };
  }

  protected getDeliveryUrl(): string {
    return this.integrationConfig.discord?.webhookUrl || '';
  }

  private formatEventType(eventType: string): string {
    return eventType
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default DiscordIntegration;