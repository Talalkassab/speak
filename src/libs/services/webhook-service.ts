/**
 * Core Webhook Service
 * Handles webhook management, event publishing, and delivery coordination
 */

import { createClient } from '@supabase/supabase-js';
import type { 
  WebhookConfig, 
  WebhookEvent, 
  WebhookEventType,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookListResponse,
  WebhookTestRequest,
  WebhookTestResponse,
  WebhookAnalytics,
  ListOptions,
  WebhookService as IWebhookService,
  BaseWebhookPayload
} from '@/types/webhooks';
import { WebhookError, WebhookValidationError } from '@/types/webhooks';
import { EventEmitter } from 'events';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schemas
const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  url: z.string().url().refine(url => url.startsWith('http'), {
    message: 'URL must use HTTP or HTTPS protocol'
  }),
  eventTypes: z.array(z.string()).min(1),
  eventFilters: z.record(z.any()).optional().default({}),
  authType: z.enum(['none', 'api_key', 'bearer_token', 'hmac_sha256', 'oauth2']).optional().default('none'),
  authConfig: z.record(z.any()).optional().default({}),
  integrationType: z.enum(['custom', 'slack', 'microsoft_teams', 'email', 'sms', 'discord', 'webhook']).optional().default('custom'),
  integrationConfig: z.record(z.any()).optional().default({}),
  timeoutSeconds: z.number().min(1).max(300).optional().default(30),
  retryCount: z.number().min(0).max(10).optional().default(3),
  customHeaders: z.record(z.string()).optional().default({}),
  rateLimitPerHour: z.number().min(1).optional().default(1000),
  rateLimitPerDay: z.number().min(1).optional().default(10000),
  payloadTemplate: z.record(z.any()).optional()
});

const updateWebhookSchema = createWebhookSchema.partial().extend({
  isActive: z.boolean().optional()
});

const eventSchema = z.object({
  eventType: z.string(),
  eventId: z.string(),
  userId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  eventData: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({})
});

export class WebhookService extends EventEmitter implements IWebhookService {
  private supabase;
  private deliveryQueue: Map<string, WebhookEvent[]> = new Map();
  private isProcessing = false;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.startDeliveryProcessor();
  }

  // Webhook Management

  async createWebhook(userId: string, config: CreateWebhookRequest): Promise<WebhookConfig> {
    try {
      // Validate input
      const validatedConfig = createWebhookSchema.parse(config);
      
      // Generate secret key for HMAC if auth type is hmac_sha256
      let secretKey: string | undefined;
      if (validatedConfig.authType === 'hmac_sha256') {
        secretKey = crypto.randomBytes(32).toString('hex');
      }

      // Insert webhook
      const { data: webhook, error } = await this.supabase
        .from('webhooks')
        .insert({
          user_id: userId,
          name: validatedConfig.name,
          description: validatedConfig.description,
          url: validatedConfig.url,
          event_types: validatedConfig.eventTypes,
          event_filters: validatedConfig.eventFilters,
          auth_type: validatedConfig.authType,
          auth_config: validatedConfig.authConfig,
          secret_key: secretKey,
          integration_type: validatedConfig.integrationType,
          integration_config: validatedConfig.integrationConfig,
          timeout_seconds: validatedConfig.timeoutSeconds,
          retry_count: validatedConfig.retryCount,
          custom_headers: validatedConfig.customHeaders,
          rate_limit_per_hour: validatedConfig.rateLimitPerHour,
          rate_limit_per_day: validatedConfig.rateLimitPerDay,
          payload_template: validatedConfig.payloadTemplate
        })
        .select()
        .single();

      if (error) {
        throw new WebhookError(`Failed to create webhook: ${error.message}`, 'CREATE_FAILED');
      }

      return this.mapDbWebhookToConfig(webhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new WebhookValidationError(
          'Invalid webhook configuration',
          error.errors[0]?.path.join('.') || 'unknown',
          { errors: error.errors }
        );
      }
      throw error;
    }
  }

  async updateWebhook(webhookId: string, config: UpdateWebhookRequest): Promise<WebhookConfig> {
    try {
      // Validate input
      const validatedConfig = updateWebhookSchema.parse(config);

      // Get current webhook to check ownership
      const { data: currentWebhook, error: fetchError } = await this.supabase
        .from('webhooks')
        .select()
        .eq('id', webhookId)
        .single();

      if (fetchError || !currentWebhook) {
        throw new WebhookError('Webhook not found', 'NOT_FOUND', 404);
      }

      // Generate new secret key if auth type changed to hmac_sha256
      let secretKey = currentWebhook.secret_key;
      if (validatedConfig.authType === 'hmac_sha256' && currentWebhook.auth_type !== 'hmac_sha256') {
        secretKey = crypto.randomBytes(32).toString('hex');
      } else if (validatedConfig.authType && validatedConfig.authType !== 'hmac_sha256') {
        secretKey = null;
      }

      // Update webhook
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (validatedConfig.name) updateData.name = validatedConfig.name;
      if (validatedConfig.description !== undefined) updateData.description = validatedConfig.description;
      if (validatedConfig.url) updateData.url = validatedConfig.url;
      if (validatedConfig.eventTypes) updateData.event_types = validatedConfig.eventTypes;
      if (validatedConfig.eventFilters !== undefined) updateData.event_filters = validatedConfig.eventFilters;
      if (validatedConfig.authType) updateData.auth_type = validatedConfig.authType;
      if (validatedConfig.authConfig !== undefined) updateData.auth_config = validatedConfig.authConfig;
      if (secretKey !== currentWebhook.secret_key) updateData.secret_key = secretKey;
      if (validatedConfig.integrationType) updateData.integration_type = validatedConfig.integrationType;
      if (validatedConfig.integrationConfig !== undefined) updateData.integration_config = validatedConfig.integrationConfig;
      if (validatedConfig.timeoutSeconds) updateData.timeout_seconds = validatedConfig.timeoutSeconds;
      if (validatedConfig.retryCount !== undefined) updateData.retry_count = validatedConfig.retryCount;
      if (validatedConfig.customHeaders !== undefined) updateData.custom_headers = validatedConfig.customHeaders;
      if (validatedConfig.rateLimitPerHour) updateData.rate_limit_per_hour = validatedConfig.rateLimitPerHour;
      if (validatedConfig.rateLimitPerDay) updateData.rate_limit_per_day = validatedConfig.rateLimitPerDay;
      if (validatedConfig.payloadTemplate !== undefined) updateData.payload_template = validatedConfig.payloadTemplate;
      if (validatedConfig.isActive !== undefined) updateData.is_active = validatedConfig.isActive;

      const { data: webhook, error } = await this.supabase
        .from('webhooks')
        .update(updateData)
        .eq('id', webhookId)
        .select()
        .single();

      if (error) {
        throw new WebhookError(`Failed to update webhook: ${error.message}`, 'UPDATE_FAILED');
      }

      return this.mapDbWebhookToConfig(webhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new WebhookValidationError(
          'Invalid webhook configuration',
          error.errors[0]?.path.join('.') || 'unknown',
          { errors: error.errors }
        );
      }
      throw error;
    }
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const { error } = await this.supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId);

    if (error) {
      throw new WebhookError(`Failed to delete webhook: ${error.message}`, 'DELETE_FAILED');
    }
  }

  async getWebhook(webhookId: string): Promise<WebhookConfig | null> {
    const { data: webhook, error } = await this.supabase
      .from('webhooks')
      .select()
      .eq('id', webhookId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new WebhookError(`Failed to get webhook: ${error.message}`, 'GET_FAILED');
    }

    return this.mapDbWebhookToConfig(webhook);
  }

  async listWebhooks(userId: string, options: ListOptions = {}): Promise<WebhookListResponse> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('webhooks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data: webhooks, error, count } = await query;

    if (error) {
      throw new WebhookError(`Failed to list webhooks: ${error.message}`, 'LIST_FAILED');
    }

    return {
      webhooks: (webhooks || []).map(this.mapDbWebhookToConfig),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  // Event Publishing

  async publishEvent(event: WebhookEvent): Promise<void> {
    try {
      // Validate event
      const validatedEvent = eventSchema.parse(event);

      // Store event in database
      const { data: storedEvent, error } = await this.supabase
        .from('webhook_events')
        .insert({
          event_type: validatedEvent.eventType,
          event_id: validatedEvent.eventId,
          user_id: validatedEvent.userId,
          resource_id: validatedEvent.resourceId,
          resource_type: validatedEvent.resourceType,
          event_data: validatedEvent.eventData,
          metadata: validatedEvent.metadata
        })
        .select()
        .single();

      if (error) {
        throw new WebhookError(`Failed to store event: ${error.message}`, 'STORE_EVENT_FAILED');
      }

      // Find webhooks that should receive this event
      const { data: webhooks, error: webhookError } = await this.supabase
        .rpc('get_webhooks_for_event', {
          p_event_type: validatedEvent.eventType,
          p_user_id: validatedEvent.userId,
          p_event_data: validatedEvent.eventData
        });

      if (webhookError) {
        throw new WebhookError(`Failed to find webhooks: ${webhookError.message}`, 'FIND_WEBHOOKS_FAILED');
      }

      // Queue deliveries for each webhook
      const deliveryPromises = (webhooks || []).map(async (webhook: any) => {
        return this.scheduleDelivery(webhook.webhook_id, storedEvent.id);
      });

      await Promise.allSettled(deliveryPromises);

      // Add to delivery queue for immediate processing
      if (!this.deliveryQueue.has(validatedEvent.eventType)) {
        this.deliveryQueue.set(validatedEvent.eventType, []);
      }
      this.deliveryQueue.get(validatedEvent.eventType)?.push(storedEvent);

      // Emit event for real-time processing
      this.emit('event:published', storedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new WebhookValidationError(
          'Invalid event data',
          error.errors[0]?.path.join('.') || 'unknown',
          { errors: error.errors }
        );
      }
      throw error;
    }
  }

  // Webhook Testing

  async testWebhook(webhookId: string, request: WebhookTestRequest): Promise<WebhookTestResponse> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook) {
      throw new WebhookError('Webhook not found', 'NOT_FOUND', 404);
    }

    // Create test event
    const testEvent: WebhookEvent = {
      eventType: request.eventType,
      eventId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventData: request.testData || { test: true },
      metadata: { isTest: true }
    };

    // Create test delivery
    const { data: delivery, error } = await this.supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhookId,
        event_id: testEvent.id,
        max_attempts: 1
      })
      .select()
      .single();

    if (error) {
      throw new WebhookError(`Failed to create test delivery: ${error.message}`, 'TEST_FAILED');
    }

    try {
      // Import delivery service dynamically to avoid circular dependencies
      const { WebhookDeliveryService } = await import('./webhook-delivery-service');
      const deliveryService = new WebhookDeliveryService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const result = await deliveryService.deliverWebhook(delivery.id);

      return {
        success: result.deliveryStatus === 'delivered',
        deliveryId: result.id!,
        responseStatusCode: result.responseStatusCode,
        responseTime: undefined, // TODO: Calculate from delivery logs
        error: result.errorMessage
      };
    } catch (error) {
      return {
        success: false,
        deliveryId: delivery.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Analytics

  async getWebhookAnalytics(webhookId: string, period: { start: string; end: string }): Promise<WebhookAnalytics> {
    // Get total events
    const { count: totalEvents } = await this.supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('webhook_id', webhookId)
      .gte('created_at', period.start)
      .lte('created_at', period.end);

    // Get successful deliveries
    const { count: successfulDeliveries } = await this.supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('webhook_id', webhookId)
      .eq('delivery_status', 'delivered')
      .gte('created_at', period.start)
      .lte('created_at', period.end);

    // Get failed deliveries
    const failedDeliveries = (totalEvents || 0) - (successfulDeliveries || 0);

    // Get event breakdown
    const { data: eventBreakdownData } = await this.supabase
      .from('webhook_deliveries')
      .select(`
        webhook_events(event_type),
        delivery_status
      `)
      .eq('webhook_id', webhookId)
      .gte('created_at', period.start)
      .lte('created_at', period.end);

    const eventBreakdown: Record<WebhookEventType, number> = {};
    const statusBreakdown: Record<string, number> = {};

    (eventBreakdownData || []).forEach((item: any) => {
      const eventType = item.webhook_events?.event_type;
      const status = item.delivery_status;

      if (eventType) {
        eventBreakdown[eventType as WebhookEventType] = (eventBreakdown[eventType as WebhookEventType] || 0) + 1;
      }

      if (status) {
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      }
    });

    return {
      webhookId,
      period,
      metrics: {
        totalEvents: totalEvents || 0,
        successfulDeliveries: successfulDeliveries || 0,
        failedDeliveries,
        averageResponseTime: 0, // TODO: Calculate from delivery logs
        successRate: totalEvents ? (successfulDeliveries || 0) / totalEvents : 0
      },
      eventBreakdown,
      statusBreakdown: statusBreakdown as Record<any, number>
    };
  }

  // Private Methods

  private async scheduleDelivery(webhookId: string, eventId: string) {
    const { data: delivery, error } = await this.supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhookId,
        event_id: eventId
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to schedule delivery:', error);
    }

    return delivery;
  }

  private startDeliveryProcessor() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    setInterval(async () => {
      try {
        await this.processPendingDeliveries();
      } catch (error) {
        console.error('Error processing deliveries:', error);
      }
    }, 5000); // Process every 5 seconds
  }

  private async processPendingDeliveries() {
    // Get pending deliveries
    const { data: pendingDeliveries, error } = await this.supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('delivery_status', 'pending')
      .limit(10);

    if (error || !pendingDeliveries?.length) {
      return;
    }

    // Process each delivery
    const { WebhookDeliveryService } = await import('./webhook-delivery-service');
    const deliveryService = new WebhookDeliveryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const deliveryPromises = pendingDeliveries.map(async (delivery) => {
      try {
        await deliveryService.deliverWebhook(delivery.id);
      } catch (error) {
        console.error(`Failed to process delivery ${delivery.id}:`, error);
      }
    });

    await Promise.allSettled(deliveryPromises);
  }

  private mapDbWebhookToConfig(dbWebhook: any): WebhookConfig {
    return {
      id: dbWebhook.id,
      userId: dbWebhook.user_id,
      name: dbWebhook.name,
      description: dbWebhook.description,
      url: dbWebhook.url,
      isActive: dbWebhook.is_active,
      eventTypes: dbWebhook.event_types || [],
      eventFilters: dbWebhook.event_filters || {},
      authType: dbWebhook.auth_type,
      authConfig: dbWebhook.auth_config || {},
      secretKey: dbWebhook.secret_key,
      integrationType: dbWebhook.integration_type,
      integrationConfig: dbWebhook.integration_config || {},
      timeoutSeconds: dbWebhook.timeout_seconds,
      retryCount: dbWebhook.retry_count,
      retryBackoffMultiplier: dbWebhook.retry_backoff_multiplier,
      maxRetryDelaySeconds: dbWebhook.max_retry_delay_seconds,
      payloadTemplate: dbWebhook.payload_template,
      customHeaders: dbWebhook.custom_headers || {},
      rateLimitPerHour: dbWebhook.rate_limit_per_hour,
      rateLimitPerDay: dbWebhook.rate_limit_per_day,
      createdAt: dbWebhook.created_at,
      updatedAt: dbWebhook.updated_at,
      lastTriggeredAt: dbWebhook.last_triggered_at
    };
  }
}

export default WebhookService;