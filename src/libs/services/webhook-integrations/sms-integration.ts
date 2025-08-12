/**
 * SMS Integration
 * Sends webhook notifications via SMS using Twilio or AWS SNS
 */

import { BaseIntegration } from './base-integration';
import type { IntegrationConfig, WebhookConfig, BaseWebhookPayload } from '@/types/webhooks';

interface SMSProvider {
  name: 'twilio' | 'aws_sns';
  config: Record<string, any>;
}

interface SMSDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryTime: number;
  provider: string;
}

export class SMSIntegration extends BaseIntegration {
  private provider: SMSProvider;
  
  constructor(config: IntegrationConfig, webhookConfig: WebhookConfig) {
    super('sms', config, webhookConfig);
    
    if (!config.sms?.provider || !config.sms?.to) {
      throw new Error('SMS configuration must include provider and recipient phone numbers');
    }
    
    this.provider = {
      name: config.sms.provider,
      config: config.sms.providerConfig || {}
    };
  }

  validateConfig() {
    const smsConfig = this.integrationConfig.sms;
    
    if (!smsConfig) {
      return {
        isValid: false,
        error: 'SMS configuration is required'
      };
    }
    
    if (!smsConfig.to || !Array.isArray(smsConfig.to) || smsConfig.to.length === 0) {
      return {
        isValid: false,
        error: 'At least one recipient phone number is required'
      };
    }
    
    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const invalidNumbers = smsConfig.to.filter(phone => !phoneRegex.test(phone));
    if (invalidNumbers.length > 0) {
      return {
        isValid: false,
        error: `Invalid phone number format: ${invalidNumbers.join(', ')}`
      };
    }
    
    if (!smsConfig.provider || !['twilio', 'aws_sns'].includes(smsConfig.provider)) {
      return {
        isValid: false,
        error: 'Provider must be either "twilio" or "aws_sns"'
      };
    }
    
    // Validate provider-specific configuration
    if (smsConfig.provider === 'twilio') {
      if (!smsConfig.providerConfig?.accountSid || !smsConfig.providerConfig?.authToken) {
        return {
          isValid: false,
          error: 'Twilio configuration requires accountSid and authToken'
        };
      }
    } else if (smsConfig.provider === 'aws_sns') {
      if (!smsConfig.providerConfig?.accessKeyId || !smsConfig.providerConfig?.secretAccessKey || !smsConfig.providerConfig?.region) {
        return {
          isValid: false,
          error: 'AWS SNS configuration requires accessKeyId, secretAccessKey, and region'
        };
      }
    }
    
    return { isValid: true };
  }

  async transformPayload(payload: BaseWebhookPayload): Promise<string> {
    const { event, webhook } = payload;
    
    // Create a concise SMS message
    const eventTypeMap: Record<string, string> = {
      'document.uploaded': '📄 Document uploaded',
      'document.processing.completed': '✅ Document processed',
      'document.processing.failed': '❌ Document processing failed',
      'chat.conversation.created': '💬 New conversation started',
      'chat.ai.response.generated': '🤖 AI response generated',
      'analytics.usage.threshold': '📊 Usage threshold reached',
      'analytics.cost.alert': '💰 Cost alert',
      'system.health.alert': '🔧 System health alert',
      'system.error.critical': '🚨 Critical system error',
      'compliance.policy.violation': '⚠️ Policy violation detected'
    };
    
    const eventIcon = eventTypeMap[event.type] || '📢';
    let message = `${eventIcon} ${event.type}\n`;
    
    // Add relevant event data based on type
    if (event.type.startsWith('document.')) {
      const fileName = event.data.fileName || event.data.documentId || 'Unknown';
      message += `File: ${fileName}\n`;
    } else if (event.type.startsWith('chat.')) {
      const conversationId = event.data.conversationId?.substring(0, 8) || 'Unknown';
      message += `Conversation: ...${conversationId}\n`;
    } else if (event.type.startsWith('analytics.')) {
      message += `Metric: ${event.data.metric || 'Unknown'}\n`;
      if (event.data.value !== undefined) {
        message += `Value: ${event.data.value}\n`;
      }
    } else if (event.type.startsWith('system.')) {
      message += `Component: ${event.data.component || 'System'}\n`;
      message += `Message: ${event.data.message || 'No details'}\n`;
    } else if (event.type.startsWith('compliance.')) {
      message += `Type: ${event.data.violationType || 'Unknown'}\n`;
      message += `Severity: ${event.data.severity || 'Unknown'}\n`;
    }
    
    message += `Time: ${new Date(event.timestamp).toLocaleString()}\n`;
    message += `Webhook: ${webhook.name}`;
    
    // Ensure message fits in SMS character limits (160 for SMS, 1600 for long SMS)
    if (message.length > 800) {
      message = message.substring(0, 797) + '...';
    }
    
    return message;
  }

  async deliver(payload: BaseWebhookPayload): Promise<SMSDeliveryResult> {
    const startTime = Date.now();
    
    try {
      const message = await this.transformPayload(payload);
      const recipients = this.integrationConfig.sms!.to;
      
      // Send to all recipients
      const deliveryPromises = recipients.map(phoneNumber => 
        this.sendSMS(phoneNumber, message)
      );
      
      const results = await Promise.allSettled(deliveryPromises);
      
      // Check if at least one delivery was successful
      const successfulDeliveries = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      );
      
      const deliveryTime = Date.now() - startTime;
      
      if (successfulDeliveries.length > 0) {
        return {
          success: true,
          messageId: (successfulDeliveries[0] as any).value.messageId,
          deliveryTime,
          provider: this.provider.name
        };
      } else {
        const errors = results.map(result => 
          result.status === 'rejected' ? result.reason : 
          result.status === 'fulfilled' ? result.value.error : 'Unknown error'
        );
        
        return {
          success: false,
          error: `Failed to deliver to all recipients: ${errors.join(', ')}`,
          deliveryTime,
          provider: this.provider.name
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        deliveryTime: Date.now() - startTime,
        provider: this.provider.name
      };
    }
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    switch (this.provider.name) {
      case 'twilio':
        return this.sendViaTwilio(phoneNumber, message);
      case 'aws_sns':
        return this.sendViaAWSSNS(phoneNumber, message);
      default:
        throw new Error(`Unsupported SMS provider: ${this.provider.name}`);
    }
  }

  private async sendViaTwilio(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { accountSid, authToken, fromNumber } = this.provider.config;
      const from = this.integrationConfig.sms?.from || fromNumber;
      
      if (!from) {
        throw new Error('Twilio sender phone number not configured');
      }
      
      // Create Twilio client (would require installing Twilio SDK)
      const twilioClient = require('twilio')(accountSid, authToken);
      
      const result = await twilioClient.messages.create({
        body: message,
        from: from,
        to: phoneNumber
      });
      
      return {
        success: true,
        messageId: result.sid
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send via Twilio'
      };
    }
  }

  private async sendViaAWSSNS(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // This would require AWS SDK setup
      const AWS = require('aws-sdk');
      
      const { accessKeyId, secretAccessKey, region } = this.provider.config;
      
      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region
      });
      
      const sns = new AWS.SNS({ apiVersion: '2010-03-31' });
      
      const params = {
        Message: message,
        PhoneNumber: phoneNumber,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional'
          }
        }
      };
      
      const result = await sns.publish(params).promise();
      
      return {
        success: true,
        messageId: result.MessageId
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send via AWS SNS'
      };
    }
  }

  async test(): Promise<SMSDeliveryResult> {
    const testPayload: BaseWebhookPayload = {
      event: {
        id: 'test-event-id',
        type: 'system.health.alert',
        timestamp: new Date().toISOString(),
        data: {
          component: 'webhook_system',
          message: 'SMS integration test from HR Intelligence Platform',
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
    return {}; // SMS doesn't use HTTP headers
  }

  protected getDeliveryUrl(): string {
    return ''; // SMS doesn't use URLs
  }
}

export default SMSIntegration;