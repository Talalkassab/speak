/**
 * Microsoft Teams Integration
 * Sends webhook notifications to Microsoft Teams channels
 */

import { BaseIntegration, IntegrationDeliveryResult, IntegrationValidationResult } from './base-integration';
import type { BaseWebhookPayload, WebhookConfig, IntegrationConfig } from '@/types/webhooks';

interface TeamsMessage {
  '@type': string;
  '@context': string;
  themeColor?: string;
  summary?: string;
  sections?: TeamsSection[];
  potentialAction?: TeamsAction[];
}

interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: TeamsFact[];
  markdown?: boolean;
  text?: string;
}

interface TeamsFact {
  name: string;
  value: string;
}

interface TeamsAction {
  '@type': string;
  name: string;
  target?: string[];
}

export class TeamsIntegration extends BaseIntegration {
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('microsoft_teams', config, webhookConfig);
  }

  validateConfig(): IntegrationValidationResult {
    const teamsConfig = this.config.teams;

    if (!teamsConfig) {
      return {
        isValid: false,
        error: 'Microsoft Teams configuration is required'
      };
    }

    if (!teamsConfig.webhookUrl) {
      return {
        isValid: false,
        error: 'Microsoft Teams webhook URL is required'
      };
    }

    // Validate webhook URL format
    if (!teamsConfig.webhookUrl.includes('office.com') && !teamsConfig.webhookUrl.includes('outlook.com')) {
      return {
        isValid: false,
        error: 'Invalid Microsoft Teams webhook URL format'
      };
    }

    return { isValid: true };
  }

  async transformPayload(payload: BaseWebhookPayload): Promise<TeamsMessage> {
    const teamsConfig = this.config.teams!;
    const eventType = payload.event.type;
    const eventData = payload.event.data;
    
    const message: TeamsMessage = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getEventThemeColor(eventType, eventData),
      summary: `${this.getEventEmoji(eventType)} ${this.formatEventTitle(eventType)}`
    };

    const sections: TeamsSection[] = [];

    // Main section
    const mainSection: TeamsSection = {
      activityTitle: `${this.getEventEmoji(eventType)} ${this.formatEventTitle(eventType)}`,
      activitySubtitle: `Event: ${eventType} • ${this.formatTimestamp(payload.event.timestamp)}`,
      facts: [],
      markdown: true
    };

    // Add event-specific facts
    this.addEventSpecificFacts(eventType, eventData, mainSection.facts!);

    // Add metadata facts
    mainSection.facts!.push(
      { name: 'Webhook', value: payload.webhook.name },
      { name: 'Delivery ID', value: payload.delivery.id },
      { name: 'Attempt', value: String(payload.delivery.attempt) }
    );

    sections.push(mainSection);

    // Add detailed section for complex events
    const detailSection = this.createDetailSection(eventType, eventData);
    if (detailSection) {
      sections.push(detailSection);
    }

    message.sections = sections;

    // Add potential actions for certain event types
    const actions = this.createPotentialActions(eventType, eventData);
    if (actions.length > 0) {
      message.potentialAction = actions;
    }

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
    return this.config.teams!.webhookUrl;
  }

  private formatEventTitle(eventType: string): string {
    const parts = eventType.split('.');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private getEventThemeColor(eventType: string, eventData: any): string {
    // Use severity if available
    if (eventData.severity) {
      switch (eventData.severity.toLowerCase()) {
        case 'critical':
          return 'FF0000';
        case 'high':
          return 'FF6600';
        case 'medium':
        case 'warning':
          return 'FFCC00';
        case 'low':
        case 'info':
          return '0066CC';
      }
    }

    // Default colors by event type
    if (eventType.includes('failed') || eventType.includes('error')) {
      return 'FF0000';
    } else if (eventType.includes('completed') || eventType.includes('success')) {
      return '00AA00';
    } else if (eventType.includes('alert') || eventType.includes('violation')) {
      return 'FFAA00';
    }

    return '0066CC'; // Default blue
  }

  private addEventSpecificFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventType.startsWith('document.')) {
      this.addDocumentFacts(eventType, eventData, facts);
    } else if (eventType.startsWith('chat.')) {
      this.addChatFacts(eventType, eventData, facts);
    } else if (eventType.startsWith('analytics.')) {
      this.addAnalyticsFacts(eventType, eventData, facts);
    } else if (eventType.startsWith('compliance.')) {
      this.addComplianceFacts(eventType, eventData, facts);
    } else if (eventType.startsWith('system.')) {
      this.addSystemFacts(eventType, eventData, facts);
    }
  }

  private addDocumentFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventData.fileName) {
      facts.push({ name: 'File Name', value: eventData.fileName });
    }
    if (eventData.documentId) {
      facts.push({ name: 'Document ID', value: eventData.documentId });
    }

    switch (eventType) {
      case 'document.uploaded':
        if (eventData.fileSize) {
          facts.push({ name: 'File Size', value: this.formatFileSize(eventData.fileSize) });
        }
        if (eventData.mimeType) {
          facts.push({ name: 'Type', value: eventData.mimeType });
        }
        break;
      case 'document.processing.completed':
        if (eventData.processingDuration) {
          facts.push({ name: 'Duration', value: `${eventData.processingDuration}s` });
        }
        if (eventData.extractedPages) {
          facts.push({ name: 'Pages', value: String(eventData.extractedPages) });
        }
        break;
      case 'document.processing.failed':
        if (eventData.retryCount) {
          facts.push({ name: 'Retry Count', value: String(eventData.retryCount) });
        }
        break;
      case 'document.analysis.completed':
        if (eventData.analysisType) {
          facts.push({ name: 'Analysis Type', value: eventData.analysisType });
        }
        if (eventData.confidence) {
          facts.push({ name: 'Confidence', value: `${Math.round(eventData.confidence * 100)}%` });
        }
        break;
    }
  }

  private addChatFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventData.conversationId) {
      facts.push({ name: 'Conversation', value: eventData.conversationId });
    }

    switch (eventType) {
      case 'chat.ai.response.generated':
        if (eventData.responseLength) {
          facts.push({ name: 'Response Length', value: `${eventData.responseLength} chars` });
        }
        if (eventData.processingTime) {
          facts.push({ name: 'Processing Time', value: `${eventData.processingTime}s` });
        }
        if (eventData.sourcesUsed && Array.isArray(eventData.sourcesUsed)) {
          facts.push({ name: 'Sources Used', value: eventData.sourcesUsed.length.toString() });
        }
        break;
      case 'chat.conversation.archived':
        if (eventData.messageCount) {
          facts.push({ name: 'Messages', value: String(eventData.messageCount) });
        }
        break;
    }
  }

  private addAnalyticsFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventData.metric) {
      facts.push({ name: 'Metric', value: eventData.metric });
    }
    if (eventData.currentValue !== undefined) {
      facts.push({ name: 'Current Value', value: String(eventData.currentValue) });
    }
    if (eventData.threshold !== undefined) {
      facts.push({ name: 'Threshold', value: String(eventData.threshold) });
    }
    if (eventData.severity) {
      facts.push({ name: 'Severity', value: eventData.severity });
    }
    if (eventData.period) {
      facts.push({ name: 'Period', value: eventData.period });
    }
  }

  private addComplianceFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventData.violationType) {
      facts.push({ name: 'Violation Type', value: eventData.violationType });
    }
    if (eventData.alertType) {
      facts.push({ name: 'Alert Type', value: eventData.alertType });
    }
    if (eventData.severity) {
      facts.push({ name: 'Severity', value: eventData.severity });
    }
    if (eventData.affectedRecords) {
      facts.push({ name: 'Affected Records', value: String(eventData.affectedRecords) });
    }
    if (eventData.regulation) {
      facts.push({ name: 'Regulation', value: eventData.regulation });
    }
  }

  private addSystemFacts(eventType: string, eventData: any, facts: TeamsFact[]): void {
    if (eventData.component) {
      facts.push({ name: 'Component', value: eventData.component });
    }
    if (eventData.severity) {
      facts.push({ name: 'Severity', value: eventData.severity });
    }
    if (eventData.healthStatus) {
      facts.push({ name: 'Health Status', value: eventData.healthStatus });
    }
    if (eventData.errorCode) {
      facts.push({ name: 'Error Code', value: eventData.errorCode });
    }
    if (eventData.estimatedDuration) {
      facts.push({ name: 'Est. Duration', value: `${eventData.estimatedDuration} min` });
    }
    if (eventData.actualDuration) {
      facts.push({ name: 'Duration', value: `${eventData.actualDuration} min` });
    }
  }

  private createDetailSection(eventType: string, eventData: any): TeamsSection | null {
    const section: TeamsSection = {
      facts: [],
      markdown: true
    };

    // Add detailed information based on event type
    if (eventType === 'document.processing.failed' && eventData.error) {
      section.activityTitle = '❌ Error Details';
      section.text = `**Error:** ${this.truncateText(eventData.error, 500)}`;
      return section;
    }

    if (eventType === 'document.analysis.completed' && eventData.findings) {
      section.activityTitle = '🔍 Analysis Findings';
      const findings = Array.isArray(eventData.findings) ? eventData.findings : [];
      section.text = findings.slice(0, 5).map(finding => `• ${finding}`).join('\n');
      return section;
    }

    if (eventType === 'chat.message.sent' && eventData.content) {
      section.activityTitle = '💬 Message Content';
      section.text = this.truncateText(eventData.content, 500);
      return section;
    }

    if (eventType === 'compliance.policy.violation' && eventData.details) {
      section.activityTitle = '⚖️ Violation Details';
      section.text = this.truncateText(eventData.details, 500);
      if (eventData.recommendedActions && Array.isArray(eventData.recommendedActions)) {
        section.text += '\n\n**Recommended Actions:**\n';
        section.text += eventData.recommendedActions.slice(0, 3).map(action => `• ${action}`).join('\n');
      }
      return section;
    }

    if (eventType === 'system.error.critical' && eventData.message) {
      section.activityTitle = '🚨 Error Message';
      section.text = this.truncateText(eventData.message, 500);
      return section;
    }

    return null;
  }

  private createPotentialActions(eventType: string, eventData: any): TeamsAction[] {
    const actions: TeamsAction[] = [];

    // Add generic dashboard action
    actions.push({
      '@type': 'OpenUri',
      name: 'Open Dashboard',
      target: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/dashboard`]
    });

    // Add event-specific actions
    if (eventType.startsWith('document.') && eventData.documentId) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Document',
        target: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/documents/${eventData.documentId}`]
      });
    }

    if (eventType.startsWith('chat.') && eventData.conversationId) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Conversation',
        target: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/chat/${eventData.conversationId}`]
      });
    }

    if (eventType.startsWith('analytics.')) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Analytics',
        target: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/dashboard/analytics`]
      });
    }

    return actions;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default TeamsIntegration;