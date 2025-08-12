/**
 * Webhook Delivery Service
 * Handles reliable webhook delivery with retries, dead letter queue, and monitoring
 */

import { createClient } from '@supabase/supabase-js';
import type { 
  WebhookDelivery,
  WebhookDeliveryLog,
  WebhookConfig,
  WebhookEvent,
  BaseWebhookPayload,
  WebhookDeliveryService as IWebhookDeliveryService,
  WebhookDeliveryListResponse,
  ListOptions
} from '@/types/webhooks';
import { 
  WebhookError, 
  WebhookDeliveryError, 
  WebhookRateLimitError 
} from '@/types/webhooks';
import crypto from 'crypto';
import fetch from 'node-fetch';

interface DeliveryAttempt {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTimeMs: number;
  error?: string;
  errorType?: string;
}

export class WebhookDeliveryService implements IWebhookDeliveryService {
  private supabase;
  private deadLetterQueue: string[] = [];
  private rateLimitCache: Map<string, { hourly: number; daily: number; resetTime: Date }> = new Map();

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.startRetryProcessor();
    this.startDeadLetterProcessor();
  }

  // Delivery Management

  async scheduleDelivery(webhookId: string, eventId: string): Promise<WebhookDelivery> {
    const { data: delivery, error } = await this.supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhookId,
        event_id: eventId,
        delivery_status: 'pending',
        attempt_count: 0
      })
      .select()
      .single();

    if (error) {
      throw new WebhookError(`Failed to schedule delivery: ${error.message}`, 'SCHEDULE_FAILED');
    }

    return this.mapDbDeliveryToModel(delivery);
  }

  async deliverWebhook(deliveryId: string): Promise<WebhookDelivery> {
    // Get delivery details with webhook and event data
    const { data: deliveryData, error } = await this.supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhooks(*),
        webhook_events(*)
      `)
      .eq('id', deliveryId)
      .single();

    if (error || !deliveryData) {
      throw new WebhookError('Delivery not found', 'DELIVERY_NOT_FOUND', 404);
    }

    const delivery = deliveryData;
    const webhook = delivery.webhooks;
    const event = delivery.webhook_events;

    // Check if delivery has exceeded max attempts
    if (delivery.attempt_count >= delivery.max_attempts) {
      await this.markDeliveryAbandoned(deliveryId, 'Max attempts exceeded');
      this.addToDeadLetterQueue(deliveryId);
      return this.mapDbDeliveryToModel(delivery);
    }

    // Check rate limits
    await this.checkRateLimits(webhook.id);

    try {
      // Update delivery status to retrying
      await this.updateDeliveryStatus(deliveryId, 'retrying');

      // Prepare delivery attempt
      const attempt = await this.prepareDeliveryAttempt(webhook, event);
      
      // Execute delivery
      const result = await this.executeDelivery(attempt);
      
      // Log the attempt
      await this.logDeliveryAttempt(deliveryId, delivery.attempt_count + 1, attempt, result);
      
      // Update rate limits
      await this.updateRateLimits(webhook.id);

      if (result.success) {
        // Mark as delivered
        await this.updateDeliveryStatus(deliveryId, 'delivered', {
          response_status_code: result.statusCode,
          response_headers: result.responseHeaders,
          response_body: result.responseBody,
          delivered_at: new Date().toISOString()
        });
      } else {
        // Determine if we should retry
        const shouldRetry = this.shouldRetryDelivery(result.statusCode, delivery.attempt_count + 1, delivery.max_attempts);
        
        if (shouldRetry) {
          const nextRetryAt = this.calculateNextRetryTime(
            delivery.attempt_count + 1,
            webhook.retry_backoff_multiplier || 2.0,
            webhook.max_retry_delay_seconds || 3600
          );

          await this.updateDeliveryStatus(deliveryId, 'failed', {
            attempt_count: delivery.attempt_count + 1,
            response_status_code: result.statusCode,
            response_headers: result.responseHeaders,
            response_body: result.responseBody,
            error_message: result.error,
            next_retry_at: nextRetryAt.toISOString()
          });
        } else {
          await this.markDeliveryAbandoned(deliveryId, result.error || 'Delivery failed');
          this.addToDeadLetterQueue(deliveryId);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed attempt
      await this.logDeliveryAttempt(deliveryId, delivery.attempt_count + 1, 
        await this.prepareDeliveryAttempt(webhook, event), 
        {
          success: false,
          responseTimeMs: 0,
          error: errorMessage,
          errorType: 'EXECUTION_ERROR'
        }
      );

      // Update delivery status
      const shouldRetry = delivery.attempt_count + 1 < delivery.max_attempts;
      
      if (shouldRetry) {
        const nextRetryAt = this.calculateNextRetryTime(
          delivery.attempt_count + 1,
          webhook.retry_backoff_multiplier || 2.0,
          webhook.max_retry_delay_seconds || 3600
        );

        await this.updateDeliveryStatus(deliveryId, 'failed', {
          attempt_count: delivery.attempt_count + 1,
          error_message: errorMessage,
          next_retry_at: nextRetryAt.toISOString()
        });
      } else {
        await this.markDeliveryAbandoned(deliveryId, errorMessage);
        this.addToDeadLetterQueue(deliveryId);
      }

      throw new WebhookDeliveryError(errorMessage, deliveryId, delivery.attempt_count + 1);
    }

    // Fetch updated delivery
    const { data: updatedDelivery } = await this.supabase
      .from('webhook_deliveries')
      .select()
      .eq('id', deliveryId)
      .single();

    return this.mapDbDeliveryToModel(updatedDelivery);
  }

  async retryFailedDeliveries(): Promise<void> {
    // Get failed deliveries that are ready for retry
    const { data: failedDeliveries, error } = await this.supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('delivery_status', 'failed')
      .lte('next_retry_at', new Date().toISOString())
      .limit(50);

    if (error || !failedDeliveries?.length) {
      return;
    }

    // Process each failed delivery
    const retryPromises = failedDeliveries.map(async (delivery) => {
      try {
        await this.deliverWebhook(delivery.id);
      } catch (error) {
        console.error(`Failed to retry delivery ${delivery.id}:`, error);
      }
    });

    await Promise.allSettled(retryPromises);
  }

  // Delivery Tracking

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    const { data: delivery, error } = await this.supabase
      .from('webhook_deliveries')
      .select()
      .eq('id', deliveryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new WebhookError(`Failed to get delivery: ${error.message}`, 'GET_DELIVERY_FAILED');
    }

    return this.mapDbDeliveryToModel(delivery);
  }

  async listDeliveries(webhookId: string, options: ListOptions = {}): Promise<WebhookDeliveryListResponse> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('webhook_id', webhookId)
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data: deliveries, error, count } = await query;

    if (error) {
      throw new WebhookError(`Failed to list deliveries: ${error.message}`, 'LIST_DELIVERIES_FAILED');
    }

    return {
      deliveries: (deliveries || []).map(this.mapDbDeliveryToModel),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  async getDeliveryLogs(deliveryId: string): Promise<WebhookDeliveryLog[]> {
    const { data: logs, error } = await this.supabase
      .from('webhook_delivery_logs')
      .select()
      .eq('delivery_id', deliveryId)
      .order('attempt_number', { ascending: true });

    if (error) {
      throw new WebhookError(`Failed to get delivery logs: ${error.message}`, 'GET_LOGS_FAILED');
    }

    return (logs || []).map(this.mapDbLogToModel);
  }

  // Private Methods

  private async prepareDeliveryAttempt(webhook: any, event: any): Promise<DeliveryAttempt> {
    // Create payload
    const payload = await this.createPayload(webhook, event);
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'HR-Intelligence-Platform/1.0 Webhook',
      ...webhook.custom_headers
    };

    // Add authentication headers
    if (webhook.auth_type === 'api_key' && webhook.auth_config?.apiKey) {
      headers['X-API-Key'] = webhook.auth_config.apiKey;
    } else if (webhook.auth_type === 'bearer_token' && webhook.auth_config?.bearerToken) {
      headers['Authorization'] = `Bearer ${webhook.auth_config.bearerToken}`;
    } else if (webhook.auth_type === 'hmac_sha256' && webhook.secret_key) {
      const signature = crypto
        .createHmac('sha256', webhook.secret_key)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Add timestamp and unique identifier
    headers['X-Webhook-Timestamp'] = new Date().toISOString();
    headers['X-Webhook-ID'] = `${webhook.id}-${event.id}-${Date.now()}`;

    return {
      url: webhook.url,
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs: (webhook.timeout_seconds || 30) * 1000
    };
  }

  private async createPayload(webhook: any, event: any): Promise<BaseWebhookPayload> {
    const basePayload: BaseWebhookPayload = {
      event: {
        id: event.event_id,
        type: event.event_type,
        timestamp: event.created_at,
        data: event.event_data
      },
      webhook: {
        id: webhook.id,
        name: webhook.name
      },
      delivery: {
        id: crypto.randomUUID(), // Will be updated with actual delivery ID
        attempt: 1 // Will be updated with actual attempt number
      }
    };

    // Apply payload template if configured
    if (webhook.payload_template) {
      return this.applyPayloadTemplate(basePayload, webhook.payload_template);
    }

    return basePayload;
  }

  private applyPayloadTemplate(payload: BaseWebhookPayload, template: Record<string, any>): any {
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

  private async executeDelivery(attempt: DeliveryAttempt): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), attempt.timeoutMs);

      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers: attempt.headers,
        body: attempt.body,
        signal: controller.signal
      } as any);

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();
      const responseTimeMs = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        responseTimeMs,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        let errorType = 'UNKNOWN_ERROR';
        if (error.name === 'AbortError') {
          errorType = 'TIMEOUT_ERROR';
        } else if (error.message.includes('fetch')) {
          errorType = 'NETWORK_ERROR';
        }

        return {
          success: false,
          responseTimeMs,
          error: error.message,
          errorType
        };
      }

      return {
        success: false,
        responseTimeMs,
        error: 'Unknown error occurred',
        errorType: 'UNKNOWN_ERROR'
      };
    }
  }

  private shouldRetryDelivery(statusCode: number | undefined, attemptCount: number, maxAttempts: number): boolean {
    if (attemptCount >= maxAttempts) {
      return false;
    }

    // Don't retry on client errors (4xx), except for rate limiting (429)
    if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      return false;
    }

    // Retry on server errors (5xx), network errors, timeouts, and rate limiting
    return true;
  }

  private calculateNextRetryTime(attemptCount: number, backoffMultiplier: number, maxDelaySeconds: number): Date {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      Math.pow(2, attemptCount - 1) * 1000 * backoffMultiplier, 
      maxDelaySeconds * 1000
    );
    
    // Add jitter (±25%)
    const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
    const delayMs = Math.max(1000, baseDelay + jitter); // Minimum 1 second

    return new Date(Date.now() + delayMs);
  }

  private async checkRateLimits(webhookId: string): Promise<void> {
    const now = new Date();
    const hourBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get webhook rate limits
    const { data: webhook } = await this.supabase
      .from('webhooks')
      .select('rate_limit_per_hour, rate_limit_per_day')
      .eq('id', webhookId)
      .single();

    if (!webhook) {
      throw new WebhookError('Webhook not found', 'WEBHOOK_NOT_FOUND', 404);
    }

    // Get current rate limit usage
    const { data: rateLimits } = await this.supabase
      .from('webhook_rate_limits')
      .select('hourly_count, daily_count')
      .eq('webhook_id', webhookId)
      .or(`hour_bucket.eq.${hourBucket.toISOString()},day_bucket.eq.${dayBucket.toISOString().split('T')[0]}`)
      .order('created_at', { ascending: false });

    let hourlyCount = 0;
    let dailyCount = 0;

    rateLimits?.forEach((limit: any) => {
      if (limit.hour_bucket === hourBucket.toISOString()) {
        hourlyCount = limit.hourly_count;
      }
      if (limit.day_bucket === dayBucket.toISOString().split('T')[0]) {
        dailyCount = limit.daily_count;
      }
    });

    // Check limits
    if (hourlyCount >= webhook.rate_limit_per_hour) {
      const nextHour = new Date(hourBucket.getTime() + 60 * 60 * 1000);
      throw new WebhookRateLimitError(
        'Hourly rate limit exceeded',
        webhookId,
        nextHour
      );
    }

    if (dailyCount >= webhook.rate_limit_per_day) {
      const nextDay = new Date(dayBucket.getTime() + 24 * 60 * 60 * 1000);
      throw new WebhookRateLimitError(
        'Daily rate limit exceeded',
        webhookId,
        nextDay
      );
    }
  }

  private async updateRateLimits(webhookId: string): Promise<void> {
    const now = new Date();
    const hourBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Upsert hourly rate limit
    await this.supabase
      .from('webhook_rate_limits')
      .upsert({
        webhook_id: webhookId,
        hour_bucket: hourBucket.toISOString(),
        day_bucket: dayBucket.toISOString().split('T')[0],
        hourly_count: 1,
        daily_count: 1
      }, {
        onConflict: 'webhook_id,hour_bucket',
        ignoreDuplicates: false
      });

    // Update daily count separately if needed
    const { data: existingDaily } = await this.supabase
      .from('webhook_rate_limits')
      .select('daily_count')
      .eq('webhook_id', webhookId)
      .eq('day_bucket', dayBucket.toISOString().split('T')[0])
      .single();

    if (existingDaily) {
      await this.supabase
        .from('webhook_rate_limits')
        .update({ daily_count: existingDaily.daily_count + 1 })
        .eq('webhook_id', webhookId)
        .eq('day_bucket', dayBucket.toISOString().split('T')[0]);
    }
  }

  private async updateDeliveryStatus(
    deliveryId: string, 
    status: string, 
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    const updateData = {
      delivery_status: status,
      last_attempt_at: new Date().toISOString(),
      ...additionalData
    };

    if (status === 'retrying') {
      updateData.first_attempt_at = updateData.first_attempt_at || new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('webhook_deliveries')
      .update(updateData)
      .eq('id', deliveryId);

    if (error) {
      throw new WebhookError(`Failed to update delivery status: ${error.message}`, 'UPDATE_STATUS_FAILED');
    }
  }

  private async markDeliveryAbandoned(deliveryId: string, reason: string): Promise<void> {
    await this.updateDeliveryStatus(deliveryId, 'abandoned', {
      error_message: reason
    });
  }

  private async logDeliveryAttempt(
    deliveryId: string,
    attemptNumber: number,
    attempt: DeliveryAttempt,
    result: DeliveryResult
  ): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_delivery_logs')
      .insert({
        delivery_id: deliveryId,
        attempt_number: attemptNumber,
        request_url: attempt.url,
        request_method: attempt.method,
        request_headers: attempt.headers,
        request_body: attempt.body,
        response_status_code: result.statusCode,
        response_headers: result.responseHeaders,
        response_body: result.responseBody,
        response_time_ms: result.responseTimeMs,
        error_type: result.errorType,
        error_message: result.error,
        is_success: result.success
      });

    if (error) {
      console.error('Failed to log delivery attempt:', error);
    }
  }

  private addToDeadLetterQueue(deliveryId: string): void {
    this.deadLetterQueue.push(deliveryId);
  }

  private startRetryProcessor(): void {
    // Process retries every 30 seconds
    setInterval(async () => {
      try {
        await this.retryFailedDeliveries();
      } catch (error) {
        console.error('Error processing retries:', error);
      }
    }, 30000);
  }

  private startDeadLetterProcessor(): void {
    // Process dead letter queue every 5 minutes
    setInterval(async () => {
      if (this.deadLetterQueue.length === 0) {
        return;
      }

      const batch = this.deadLetterQueue.splice(0, 10); // Process 10 at a time
      
      // Log dead letter queue items for investigation
      console.log('Processing dead letter queue:', batch);
      
      // TODO: Implement dead letter queue handling logic
      // This could involve:
      // - Notifying administrators
      // - Moving to a separate table for manual investigation
      // - Sending alerts
      
      try {
        // For now, just log the abandoned deliveries
        const { data: abandonedDeliveries } = await this.supabase
          .from('webhook_deliveries')
          .select(`
            id,
            webhooks(name, url),
            webhook_events(event_type, event_id),
            error_message
          `)
          .in('id', batch);

        console.log('Abandoned deliveries:', abandonedDeliveries);
      } catch (error) {
        console.error('Error processing dead letter queue:', error);
      }
    }, 300000); // 5 minutes
  }

  private mapDbDeliveryToModel(dbDelivery: any): WebhookDelivery {
    return {
      id: dbDelivery.id,
      webhookId: dbDelivery.webhook_id,
      eventId: dbDelivery.event_id,
      deliveryStatus: dbDelivery.delivery_status,
      attemptCount: dbDelivery.attempt_count,
      maxAttempts: dbDelivery.max_attempts,
      requestPayload: dbDelivery.request_payload,
      requestHeaders: dbDelivery.request_headers,
      responseStatusCode: dbDelivery.response_status_code,
      responseHeaders: dbDelivery.response_headers,
      responseBody: dbDelivery.response_body,
      createdAt: dbDelivery.created_at,
      firstAttemptAt: dbDelivery.first_attempt_at,
      lastAttemptAt: dbDelivery.last_attempt_at,
      deliveredAt: dbDelivery.delivered_at,
      nextRetryAt: dbDelivery.next_retry_at,
      errorMessage: dbDelivery.error_message,
      errorDetails: dbDelivery.error_details
    };
  }

  private mapDbLogToModel(dbLog: any): WebhookDeliveryLog {
    return {
      id: dbLog.id,
      deliveryId: dbLog.delivery_id,
      attemptNumber: dbLog.attempt_number,
      attemptedAt: dbLog.attempted_at,
      requestUrl: dbLog.request_url,
      requestMethod: dbLog.request_method,
      requestHeaders: dbLog.request_headers,
      requestBody: dbLog.request_body,
      responseStatusCode: dbLog.response_status_code,
      responseHeaders: dbLog.response_headers,
      responseBody: dbLog.response_body,
      responseTimeMs: dbLog.response_time_ms,
      errorType: dbLog.error_type,
      errorMessage: dbLog.error_message,
      isSuccess: dbLog.is_success
    };
  }
}

export default WebhookDeliveryService;