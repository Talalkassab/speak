/**
 * Email Integration
 * Sends webhook notifications via email using Resend
 */

import { BaseIntegration, IntegrationDeliveryResult, IntegrationValidationResult } from './base-integration';
import type { BaseWebhookPayload, WebhookConfig, IntegrationConfig } from '@/types/webhooks';
import { resendClient } from '@/libs/resend/resend-client';

interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export class EmailIntegration extends BaseIntegration {
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('email', config, webhookConfig);
  }

  validateConfig(): IntegrationValidationResult {
    const emailConfig = this.config.email;

    if (!emailConfig) {
      return {
        isValid: false,
        error: 'Email configuration is required'
      };
    }

    if (!emailConfig.to || emailConfig.to.length === 0) {
      return {
        isValid: false,
        error: 'At least one recipient email address is required'
      };
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmails = [
      ...emailConfig.to,
      ...(emailConfig.cc || []),
      ...(emailConfig.bcc || [])
    ];

    for (const email of allEmails) {
      if (!emailRegex.test(email)) {
        return {
          isValid: false,
          error: `Invalid email address: ${email}`,
          details: { email }
        };
      }
    }

    return { isValid: true };
  }

  async transformPayload(payload: BaseWebhookPayload): Promise<EmailMessage> {
    const emailConfig = this.config.email!;
    const eventType = payload.event.type;
    const eventData = payload.event.data;
    
    const subject = emailConfig.subject || this.generateSubject(eventType, eventData);
    const html = await this.generateHtmlContent(payload);
    const text = this.generateTextContent(payload);

    return {
      to: emailConfig.to,
      cc: emailConfig.cc,
      bcc: emailConfig.bcc,
      subject,
      html,
      text
    };
  }

  async deliver(payload: BaseWebhookPayload): Promise<IntegrationDeliveryResult> {
    const startTime = Date.now();

    try {
      const emailMessage = await this.transformPayload(payload);
      
      const result = await resendClient.emails.send({
        from: 'HR Intelligence Platform <noreply@your-domain.com>',
        to: emailMessage.to,
        cc: emailMessage.cc,
        bcc: emailMessage.bcc,
        subject: emailMessage.subject,
        html: emailMessage.html,
        text: emailMessage.text
      });

      const deliveryTime = Date.now() - startTime;

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
          deliveryTime
        };
      }

      return {
        success: true,
        statusCode: 200,
        responseBody: JSON.stringify({ id: result.data?.id }),
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
    return {};
  }

  protected getDeliveryUrl(): string {
    return ''; // Not used for email integration
  }

  private generateSubject(eventType: string, eventData: any): string {
    const severity = eventData.severity || 'info';
    const severityPrefix = severity === 'critical' ? '🚨 CRITICAL' : 
                          severity === 'high' ? '⚠️ HIGH' :
                          severity === 'medium' ? '📊 MEDIUM' : 
                          '📋 INFO';

    const title = this.formatEventTitle(eventType);
    return `${severityPrefix}: ${title} - HR Intelligence Platform`;
  }

  private formatEventTitle(eventType: string): string {
    const parts = eventType.split('.');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async generateHtmlContent(payload: BaseWebhookPayload): Promise<string> {
    const { event, webhook, delivery } = payload;
    const eventData = event.data;
    const eventType = event.type;

    const severityColor = this.getSeverityColor(eventData.severity || 'info');
    const eventTitle = this.formatEventTitle(eventType);
    const eventEmoji = this.getEventEmoji(eventType);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventTitle}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid ${severityColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: ${severityColor};
            font-size: 24px;
        }
        .event-info {
            background-color: #f8f9fa;
            border-left: 4px solid ${severityColor};
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .event-details {
            margin: 20px 0;
        }
        .detail-item {
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-item:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
            display: inline-block;
            min-width: 120px;
        }
        .detail-value {
            color: #212529;
        }
        .metadata {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-top: 30px;
            font-size: 14px;
            color: #6c757d;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: ${severityColor};
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 5px;
            font-weight: 500;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 14px;
        }
        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-info { color: #0d6efd; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${eventEmoji} ${eventTitle}</h1>
            <p style="margin: 10px 0 0; color: #6c757d;">
                ${this.formatTimestamp(event.timestamp)}
            </p>
        </div>

        <div class="event-info">
            <strong>Event Type:</strong> ${eventType}<br>
            <strong>Event ID:</strong> ${event.id}
        </div>

        <div class="event-details">
            <h3>Event Details</h3>
            ${this.generateEventDetailsHtml(eventType, eventData)}
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/dashboard" class="button">
                View Dashboard
            </a>
            ${this.generateActionButtonsHtml(eventType, eventData)}
        </div>

        <div class="metadata">
            <strong>Webhook Information</strong><br>
            <div class="detail-item">
                <span class="detail-label">Webhook Name:</span>
                <span class="detail-value">${webhook.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Webhook ID:</span>
                <span class="detail-value">${webhook.id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Delivery ID:</span>
                <span class="detail-value">${delivery.id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Attempt:</span>
                <span class="detail-value">${delivery.attempt}</span>
            </div>
        </div>

        <div class="footer">
            <p>This notification was sent by HR Intelligence Platform</p>
            <p>If you no longer wish to receive these notifications, please update your webhook settings.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateEventDetailsHtml(eventType: string, eventData: any): string {
    let details = '';

    if (eventType.startsWith('document.')) {
      details += this.generateDocumentDetailsHtml(eventType, eventData);
    } else if (eventType.startsWith('chat.')) {
      details += this.generateChatDetailsHtml(eventType, eventData);
    } else if (eventType.startsWith('analytics.')) {
      details += this.generateAnalyticsDetailsHtml(eventType, eventData);
    } else if (eventType.startsWith('compliance.')) {
      details += this.generateComplianceDetailsHtml(eventType, eventData);
    } else if (eventType.startsWith('system.')) {
      details += this.generateSystemDetailsHtml(eventType, eventData);
    } else {
      // Generic details
      details += '<div class="detail-item">';
      details += '<span class="detail-label">Data:</span>';
      details += `<span class="detail-value"><pre>${JSON.stringify(eventData, null, 2)}</pre></span>`;
      details += '</div>';
    }

    return details;
  }

  private generateDocumentDetailsHtml(eventType: string, eventData: any): string {
    let html = '';

    if (eventData.fileName) {
      html += `<div class="detail-item">
        <span class="detail-label">File Name:</span>
        <span class="detail-value">${eventData.fileName}</span>
      </div>`;
    }

    if (eventData.documentId) {
      html += `<div class="detail-item">
        <span class="detail-label">Document ID:</span>
        <span class="detail-value">${eventData.documentId}</span>
      </div>`;
    }

    switch (eventType) {
      case 'document.uploaded':
        if (eventData.fileSize) {
          html += `<div class="detail-item">
            <span class="detail-label">File Size:</span>
            <span class="detail-value">${this.formatFileSize(eventData.fileSize)}</span>
          </div>`;
        }
        break;
      case 'document.processing.failed':
        if (eventData.error) {
          html += `<div class="detail-item">
            <span class="detail-label">Error:</span>
            <span class="detail-value" style="color: #dc3545;">${eventData.error}</span>
          </div>`;
        }
        break;
      case 'document.analysis.completed':
        if (eventData.findings && Array.isArray(eventData.findings)) {
          html += `<div class="detail-item">
            <span class="detail-label">Key Findings:</span>
            <div class="detail-value">
              <ul>
                ${eventData.findings.slice(0, 5).map((finding: string) => `<li>${finding}</li>`).join('')}
              </ul>
            </div>
          </div>`;
        }
        break;
    }

    return html;
  }

  private generateChatDetailsHtml(eventType: string, eventData: any): string {
    let html = '';

    if (eventData.conversationId) {
      html += `<div class="detail-item">
        <span class="detail-label">Conversation:</span>
        <span class="detail-value">${eventData.conversationId}</span>
      </div>`;
    }

    if (eventData.content) {
      html += `<div class="detail-item">
        <span class="detail-label">Content:</span>
        <span class="detail-value">${this.truncateText(eventData.content, 300)}</span>
      </div>`;
    }

    if (eventType === 'chat.ai.response.generated' && eventData.sourcesUsed) {
      html += `<div class="detail-item">
        <span class="detail-label">Sources Used:</span>
        <span class="detail-value">${eventData.sourcesUsed.length} document(s)</span>
      </div>`;
    }

    return html;
  }

  private generateAnalyticsDetailsHtml(eventType: string, eventData: any): string {
    let html = '';

    ['metric', 'currentValue', 'threshold', 'severity', 'period'].forEach(field => {
      if (eventData[field] !== undefined) {
        html += `<div class="detail-item">
          <span class="detail-label">${field.charAt(0).toUpperCase() + field.slice(1)}:</span>
          <span class="detail-value">${eventData[field]}</span>
        </div>`;
      }
    });

    return html;
  }

  private generateComplianceDetailsHtml(eventType: string, eventData: any): string {
    let html = '';

    if (eventData.details) {
      html += `<div class="detail-item">
        <span class="detail-label">Details:</span>
        <span class="detail-value">${this.truncateText(eventData.details, 400)}</span>
      </div>`;
    }

    if (eventData.recommendedActions && Array.isArray(eventData.recommendedActions)) {
      html += `<div class="detail-item">
        <span class="detail-label">Recommended Actions:</span>
        <div class="detail-value">
          <ul>
            ${eventData.recommendedActions.slice(0, 3).map((action: string) => `<li>${action}</li>`).join('')}
          </ul>
        </div>
      </div>`;
    }

    return html;
  }

  private generateSystemDetailsHtml(eventType: string, eventData: any): string {
    let html = '';

    if (eventData.message) {
      html += `<div class="detail-item">
        <span class="detail-label">Message:</span>
        <span class="detail-value">${this.truncateText(eventData.message, 400)}</span>
      </div>`;
    }

    if (eventData.component) {
      html += `<div class="detail-item">
        <span class="detail-label">Component:</span>
        <span class="detail-value">${eventData.component}</span>
      </div>`;
    }

    if (eventData.affectedServices && Array.isArray(eventData.affectedServices)) {
      html += `<div class="detail-item">
        <span class="detail-label">Affected Services:</span>
        <span class="detail-value">${eventData.affectedServices.join(', ')}</span>
      </div>`;
    }

    return html;
  }

  private generateActionButtonsHtml(eventType: string, eventData: any): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com';
    let buttons = '';

    if (eventType.startsWith('document.') && eventData.documentId) {
      buttons += `<a href="${baseUrl}/documents/${eventData.documentId}" class="button">View Document</a>`;
    }

    if (eventType.startsWith('chat.') && eventData.conversationId) {
      buttons += `<a href="${baseUrl}/chat/${eventData.conversationId}" class="button">View Conversation</a>`;
    }

    if (eventType.startsWith('analytics.')) {
      buttons += `<a href="${baseUrl}/dashboard/analytics" class="button">View Analytics</a>`;
    }

    return buttons;
  }

  private generateTextContent(payload: BaseWebhookPayload): string {
    const { event, webhook, delivery } = payload;
    const eventData = event.data;
    const eventType = event.type;

    let text = `HR Intelligence Platform - ${this.formatEventTitle(eventType)}\n\n`;
    text += `Event: ${eventType}\n`;
    text += `Time: ${this.formatTimestamp(event.timestamp)}\n`;
    text += `Event ID: ${event.id}\n\n`;

    text += `Event Details:\n`;
    Object.entries(eventData).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 100) {
        text += `${key}: ${value.substring(0, 100)}...\n`;
      } else {
        text += `${key}: ${value}\n`;
      }
    });

    text += `\n---\n`;
    text += `Webhook: ${webhook.name} (${webhook.id})\n`;
    text += `Delivery: ${delivery.id} (Attempt ${delivery.attempt})\n\n`;
    text += `View Dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com'}/dashboard\n`;

    return text;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default EmailIntegration;