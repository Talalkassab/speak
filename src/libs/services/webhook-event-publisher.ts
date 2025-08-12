/**
 * Webhook Event Publisher
 * Middleware for automatically triggering webhook events throughout the application
 */

import { createClient } from '@supabase/supabase-js';
import { WebhookService } from './webhook-service';
import type { 
  WebhookEvent, 
  WebhookEventType, 
  DocumentWebhookPayload,
  ChatWebhookPayload,
  AnalyticsWebhookPayload,
  ComplianceWebhookPayload,
  SystemWebhookPayload
} from '@/types/webhooks';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface EventPublisherConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
  retryAttempts: number;
  enableAsyncProcessing: boolean;
}

interface QueuedEvent {
  event: WebhookEvent;
  timestamp: number;
  retryCount: number;
}

export class WebhookEventPublisher extends EventEmitter {
  private webhookService: WebhookService;
  private config: EventPublisherConfig;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config: Partial<EventPublisherConfig> = {}
  ) {
    super();
    
    this.webhookService = new WebhookService(supabaseUrl, supabaseServiceKey);
    this.config = {
      enabled: true,
      batchSize: 10,
      flushInterval: 5000, // 5 seconds
      retryAttempts: 3,
      enableAsyncProcessing: true,
      ...config
    };

    if (this.config.enabled) {
      this.startEventProcessor();
    }
  }

  /**
   * Publish a document-related event
   */
  async publishDocumentEvent(
    eventType: 'document.uploaded' | 'document.processing.started' | 'document.processing.completed' | 
              'document.processing.failed' | 'document.analysis.completed' | 'document.deleted',
    data: {
      documentId: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      userId?: string;
      status?: string;
      processingResult?: any;
      error?: string;
    },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      eventId: this.generateEventId(eventType),
      userId: data.userId,
      resourceId: data.documentId,
      resourceType: 'document',
      eventData: {
        documentId: data.documentId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        status: data.status,
        processingResult: data.processingResult,
        error: data.error
      },
      metadata: {
        source: 'document_service',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    await this.publishEvent(event);
  }

  /**
   * Publish a chat-related event
   */
  async publishChatEvent(
    eventType: 'chat.conversation.created' | 'chat.message.sent' | 'chat.message.received' | 
              'chat.ai.response.generated' | 'chat.conversation.archived',
    data: {
      conversationId: string;
      messageId?: string;
      content?: string;
      role?: 'user' | 'assistant';
      userId?: string;
      processingTimeMs?: number;
      modelUsed?: string;
    },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      eventId: this.generateEventId(eventType),
      userId: data.userId,
      resourceId: data.conversationId,
      resourceType: 'conversation',
      eventData: {
        conversationId: data.conversationId,
        messageId: data.messageId,
        content: data.content,
        role: data.role,
        processingTimeMs: data.processingTimeMs,
        modelUsed: data.modelUsed
      },
      metadata: {
        source: 'chat_service',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    await this.publishEvent(event);
  }

  /**
   * Publish an analytics-related event
   */
  async publishAnalyticsEvent(
    eventType: 'analytics.usage.threshold' | 'analytics.cost.alert' | 
              'analytics.performance.degraded' | 'analytics.quota.exceeded',
    data: {
      metric: string;
      value: number;
      threshold?: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      userId?: string;
      period?: string;
      service?: string;
    },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      eventId: this.generateEventId(eventType),
      userId: data.userId,
      resourceType: 'analytics',
      eventData: {
        metric: data.metric,
        value: data.value,
        threshold: data.threshold,
        severity: data.severity,
        period: data.period,
        service: data.service
      },
      metadata: {
        source: 'analytics_service',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    await this.publishEvent(event);
  }

  /**
   * Publish a compliance-related event
   */
  async publishComplianceEvent(
    eventType: 'compliance.policy.violation' | 'compliance.audit.trigger' | 
              'compliance.regulatory.alert' | 'compliance.data.breach.detected',
    data: {
      violationType?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      resourceId?: string;
      resourceType?: string;
      userId?: string;
      auditType?: string;
      action?: string;
      regulation?: string;
      recommendedActions?: string[];
      affectedUsers?: string[];
    },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      eventId: this.generateEventId(eventType),
      userId: data.userId,
      resourceId: data.resourceId,
      resourceType: data.resourceType || 'compliance',
      eventData: {
        violationType: data.violationType,
        severity: data.severity,
        auditType: data.auditType,
        action: data.action,
        regulation: data.regulation,
        recommendedActions: data.recommendedActions,
        affectedUsers: data.affectedUsers
      },
      metadata: {
        source: 'compliance_service',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    await this.publishEvent(event);
  }

  /**
   * Publish a system-related event
   */
  async publishSystemEvent(
    eventType: 'system.health.alert' | 'system.error.critical' | 'system.maintenance.scheduled' |
              'system.maintenance.started' | 'system.maintenance.completed' | 
              'system.backup.completed' | 'system.backup.failed',
    data: {
      component: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      affectedServices?: string[];
      errorCode?: string;
      maintenanceId?: string;
      scheduledTime?: string;
      duration?: number;
      backupId?: string;
      backupType?: string;
      size?: string;
    },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      eventId: this.generateEventId(eventType),
      resourceType: 'system',
      eventData: {
        component: data.component,
        severity: data.severity,
        message: data.message,
        affectedServices: data.affectedServices,
        errorCode: data.errorCode,
        maintenanceId: data.maintenanceId,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        backupId: data.backupId,
        backupType: data.backupType,
        size: data.size
      },
      metadata: {
        source: 'system_monitor',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    await this.publishEvent(event);
  }

  /**
   * Publish a generic webhook event
   */
  async publishEvent(event: WebhookEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Validate event
      this.validateEvent(event);

      // Add to queue for processing
      const queuedEvent: QueuedEvent = {
        event,
        timestamp: Date.now(),
        retryCount: 0
      };

      this.eventQueue.push(queuedEvent);

      // Process immediately if async processing is disabled or queue is full
      if (!this.config.enableAsyncProcessing || this.eventQueue.length >= this.config.batchSize) {
        await this.processEventQueue();
      }

      // Emit event for real-time listeners
      this.emit('event:published', event);

    } catch (error) {
      console.error('Failed to publish event:', error);
      this.emit('event:error', { event, error });
    }
  }

  /**
   * Process events in the queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const eventsToProcess = this.eventQueue.splice(0, this.config.batchSize);
      
      const publishPromises = eventsToProcess.map(async (queuedEvent) => {
        try {
          await this.webhookService.publishEvent(queuedEvent.event);
          this.emit('event:processed', queuedEvent.event);
        } catch (error) {
          console.error(`Failed to publish event ${queuedEvent.event.eventId}:`, error);
          
          // Retry logic
          if (queuedEvent.retryCount < this.config.retryAttempts) {
            queuedEvent.retryCount++;
            this.eventQueue.unshift(queuedEvent); // Add back to front of queue
          } else {
            this.emit('event:failed', { event: queuedEvent.event, error });
          }
        }
      });

      await Promise.allSettled(publishPromises);
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start the event processor
   */
  private startEventProcessor(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      await this.processEventQueue();
    }, this.config.flushInterval);
  }

  /**
   * Stop the event processor
   */
  stopEventProcessor(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Flush all pending events immediately
   */
  async flush(): Promise<void> {
    await this.processEventQueue();
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(eventType: WebhookEventType): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${eventType}-${timestamp}-${random}`;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: WebhookEvent): void {
    if (!event.eventType) {
      throw new Error('Event type is required');
    }

    if (!event.eventId) {
      throw new Error('Event ID is required');
    }

    if (!event.eventData || typeof event.eventData !== 'object') {
      throw new Error('Event data must be an object');
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    config: EventPublisherConfig;
  } {
    return {
      queueSize: this.eventQueue.length,
      isProcessing: this.isProcessing,
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EventPublisherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled && this.flushTimer) {
      this.stopEventProcessor();
    } else if (this.config.enabled && !this.flushTimer) {
      this.startEventProcessor();
    }
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }
}

// Singleton instance for global use
let globalEventPublisher: WebhookEventPublisher | null = null;

export function getEventPublisher(): WebhookEventPublisher {
  if (!globalEventPublisher) {
    globalEventPublisher = new WebhookEventPublisher(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return globalEventPublisher;
}

export function initializeEventPublisher(
  supabaseUrl: string,
  supabaseServiceKey: string,
  config?: Partial<EventPublisherConfig>
): WebhookEventPublisher {
  globalEventPublisher = new WebhookEventPublisher(supabaseUrl, supabaseServiceKey, config);
  return globalEventPublisher;
}

export default WebhookEventPublisher;