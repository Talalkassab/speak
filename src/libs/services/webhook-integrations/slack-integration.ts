/**
 * Slack Integration
 * Sends webhook notifications to Slack channels
 */

import { BaseIntegration, IntegrationDeliveryResult, IntegrationValidationResult } from './base-integration';
import type { BaseWebhookPayload, WebhookConfig, IntegrationConfig } from '@/types/webhooks';

interface SlackMessage {
  channel?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: any[];
}

interface SlackAttachment {
  color?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackField[];
  footer?: string;
  ts?: number;
}

interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

export class SlackIntegration extends BaseIntegration {
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('slack', config, webhookConfig);
  }

  validateConfig(): IntegrationValidationResult {
    const slackConfig = this.config.slack;

    if (!slackConfig) {
      return {
        isValid: false,
        error: 'Slack configuration is required'
      };
    }

    if (!slackConfig.channel) {
      return {
        isValid: false,
        error: 'Slack channel is required'
      };
    }

    // Validate channel format
    const channelPattern = /^[#@]?[\w-]+$/;
    if (!channelPattern.test(slackConfig.channel)) {
      return {
        isValid: false,
        error: 'Invalid Slack channel format',
        details: { channel: slackConfig.channel }
      };
    }

    return { isValid: true };
  }

  async transformPayload(payload: BaseWebhookPayload): Promise<SlackMessage> {
    const slackConfig = this.config.slack!;
    const eventType = payload.event.type;
    const eventData = payload.event.data;
    
    // Create rich message based on event type
    const message: SlackMessage = {
      channel: slackConfig.channel,
      username: slackConfig.username || 'HR Intelligence Platform',
      icon_emoji: slackConfig.iconEmoji || ':robot_face:',
      icon_url: slackConfig.iconUrl
    };

    // Create blocks for rich formatting
    const blocks: SlackBlock[] = [];
    const attachments: SlackAttachment[] = [];

    // Header block
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${this.getEventEmoji(eventType)} ${this.formatEventTitle(eventType)}`
      }
    });

    // Context block
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Event:* ${eventType} | *Time:* ${this.formatTimestamp(payload.event.timestamp)}`
        }
      ]
    });

    // Event-specific content
    const attachment = this.createEventAttachment(eventType, eventData, payload);
    if (attachment) {
      attachments.push(attachment);
    }

    // Add metadata section
    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Webhook: *${payload.webhook.name}* | Delivery: ${payload.delivery.id}`
        }
      ]
    });

    message.blocks = blocks;
    message.attachments = attachments;

    return message;
  }

  async deliver(payload: BaseWebhookPayload): Promise<IntegrationDeliveryResult> {
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

  async test(): Promise<IntegrationDeliveryResult> {
    const testPayload: BaseWebhookPayload = {
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
    return {
      'Content-Type': 'application/json'
    };
  }

  protected getDeliveryUrl(): string {
    return this.webhookConfig.url;
  }

  private formatEventTitle(eventType: string): string {
    const parts = eventType.split('.');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private createEventAttachment(eventType: string, eventData: any, payload: BaseWebhookPayload): SlackAttachment | null {
    const attachment: SlackAttachment = {
      color: this.getEventColor(eventType, eventData),
      fields: [],
      footer: 'HR Intelligence Platform',
      ts: Math.floor(new Date(payload.event.timestamp).getTime() / 1000)
    };

    if (eventType.startsWith('document.')) {
      return this.createDocumentAttachment(eventType, eventData, attachment);
    } else if (eventType.startsWith('chat.')) {
      return this.createChatAttachment(eventType, eventData, attachment);
    } else if (eventType.startsWith('analytics.')) {
      return this.createAnalyticsAttachment(eventType, eventData, attachment);
    } else if (eventType.startsWith('compliance.')) {
      return this.createComplianceAttachment(eventType, eventData, attachment);
    } else if (eventType.startsWith('system.')) {
      return this.createSystemAttachment(eventType, eventData, attachment);
    }

    // Generic attachment for unknown event types
    attachment.text = `Event data: ${this.truncateText(JSON.stringify(eventData, null, 2), 500)}`;
    return attachment;
  }

  private createDocumentAttachment(eventType: string, eventData: any, attachment: SlackAttachment): SlackAttachment {
    attachment.title = `Document: ${eventData.fileName || eventData.documentId}`;

    switch (eventType) {
      case 'document.uploaded':
        attachment.fields!.push(
          { title: 'File Size', value: this.formatFileSize(eventData.fileSize), short: true },
          { title: 'MIME Type', value: eventData.mimeType || 'Unknown', short: true }
        );
        break;
      case 'document.processing.completed':
        attachment.fields!.push(
          { title: 'Duration', value: `${eventData.processingDuration || 0}s`, short: true },
          { title: 'Pages Extracted', value: String(eventData.extractedPages || 0), short: true }
        );
        break;
      case 'document.processing.failed':
        attachment.color = '#FF0000';
        attachment.fields!.push(
          { title: 'Error', value: this.truncateText(eventData.error || 'Unknown error', 200), short: false },
          { title: 'Retry Count', value: String(eventData.retryCount || 0), short: true }
        );
        break;
      case 'document.analysis.completed':
        attachment.fields!.push(
          { title: 'Analysis Type', value: eventData.analysisType || 'General', short: true },
          { title: 'Confidence', value: `${Math.round((eventData.confidence || 0) * 100)}%`, short: true }
        );
        if (eventData.findings && Array.isArray(eventData.findings)) {
          attachment.fields!.push({
            title: 'Key Findings',
            value: eventData.findings.slice(0, 5).join('\n• '),
            short: false
          });
        }
        break;
    }

    return attachment;
  }

  private createChatAttachment(eventType: string, eventData: any, attachment: SlackAttachment): SlackAttachment {
    attachment.title = `Conversation: ${eventData.conversationId}`;

    switch (eventType) {
      case 'chat.conversation.created':
        attachment.fields!.push({
          title: 'Initial Message',
          value: this.truncateText(eventData.initialMessage || '', 300),
          short: false
        });
        break;
      case 'chat.message.sent':
      case 'chat.message.received':
        attachment.fields!.push({
          title: 'Message Content',
          value: this.truncateText(eventData.content || '', 300),
          short: false
        });
        break;
      case 'chat.ai.response.generated':
        attachment.fields!.push(
          { title: 'Response Length', value: `${eventData.responseLength || 0} chars`, short: true },
          { title: 'Processing Time', value: `${eventData.processingTime || 0}s`, short: true }
        );
        if (eventData.sourcesUsed && Array.isArray(eventData.sourcesUsed)) {
          attachment.fields!.push({
            title: 'Sources Used',
            value: eventData.sourcesUsed.slice(0, 3).join(', '),
            short: false
          });
        }
        break;
    }

    return attachment;
  }

  private createAnalyticsAttachment(eventType: string, eventData: any, attachment: SlackAttachment): SlackAttachment {
    attachment.title = `Analytics Alert: ${eventData.metric || 'Unknown Metric'}`;

    attachment.fields!.push(
      { title: 'Current Value', value: String(eventData.currentValue || 0), short: true },
      { title: 'Threshold', value: String(eventData.threshold || 0), short: true },
      { title: 'Severity', value: eventData.severity || 'Unknown', short: true }
    );

    if (eventData.period) {
      attachment.fields!.push({ title: 'Period', value: eventData.period, short: true });
    }

    return attachment;
  }

  private createComplianceAttachment(eventType: string, eventData: any, attachment: SlackAttachment): SlackAttachment {
    attachment.title = `Compliance Alert: ${eventData.violationType || eventData.alertType || 'Unknown'}`;
    attachment.color = this.getSeverityColor(eventData.severity || 'medium');

    if (eventData.details) {
      attachment.fields!.push({
        title: 'Details',
        value: this.truncateText(eventData.details, 300),
        short: false
      });
    }

    if (eventData.recommendedActions && Array.isArray(eventData.recommendedActions)) {
      attachment.fields!.push({
        title: 'Recommended Actions',
        value: eventData.recommendedActions.slice(0, 3).join('\n• '),
        short: false
      });
    }

    return attachment;
  }

  private createSystemAttachment(eventType: string, eventData: any, attachment: SlackAttachment): SlackAttachment {
    attachment.title = `System Alert: ${eventData.component || 'Unknown Component'}`;
    attachment.color = this.getSeverityColor(eventData.severity || 'info');

    attachment.fields!.push({
      title: 'Message',
      value: this.truncateText(eventData.message || '', 300),
      short: false
    });

    if (eventData.affectedServices && Array.isArray(eventData.affectedServices)) {
      attachment.fields!.push({
        title: 'Affected Services',
        value: eventData.affectedServices.join(', '),
        short: false
      });
    }

    return attachment;
  }

  private getEventColor(eventType: string, eventData: any): string {
    // Use severity if available
    if (eventData.severity) {
      return this.getSeverityColor(eventData.severity);
    }

    // Default colors by event type
    if (eventType.includes('failed') || eventType.includes('error')) {
      return '#FF0000';
    } else if (eventType.includes('completed') || eventType.includes('success')) {
      return '#00AA00';
    } else if (eventType.includes('alert') || eventType.includes('violation')) {
      return '#FFAA00';
    }

    return '#0066CC'; // Default blue
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default SlackIntegration;