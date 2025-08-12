/**
 * Webhook Events Middleware
 * Automatically triggers webhook events based on API route activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEventPublisher } from '@/libs/services/webhook-event-publisher';
import type { WebhookEventType } from '@/types/webhooks';

interface EventTriggerConfig {
  eventType: WebhookEventType;
  extractData: (request: NextRequest, response: NextResponse, body?: any) => Record<string, any>;
  condition?: (request: NextRequest, response: NextResponse, body?: any) => boolean;
  userId?: string | ((request: NextRequest) => string | undefined);
}

interface WebhookMiddlewareOptions {
  enabled: boolean;
  events: EventTriggerConfig[];
  extractUserId?: (request: NextRequest) => Promise<string | undefined>;
}

export class WebhookEventsMiddleware {
  private options: WebhookMiddlewareOptions;
  private eventPublisher;

  constructor(options: WebhookMiddlewareOptions) {
    this.options = options;
    this.eventPublisher = getEventPublisher();
  }

  /**
   * Create middleware function for Next.js API routes
   */
  createMiddleware() {
    return async (request: NextRequest, context: any, next: () => Promise<NextResponse>) => {
      if (!this.options.enabled) {
        return next();
      }

      let requestBody: any = null;
      let response: NextResponse;

      try {
        // Capture request body if available
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          try {
            requestBody = await request.clone().json();
          } catch {
            // Body might not be JSON or might be empty
          }
        }

        // Execute the original handler
        response = await next();

        // Process webhook events after successful response
        if (response.status >= 200 && response.status < 300) {
          await this.processWebhookEvents(request, response, requestBody);
        }

        return response;
      } catch (error) {
        // Still try to trigger error events
        if (response!) {
          await this.processWebhookEvents(request, response, requestBody, error);
        }
        throw error;
      }
    };
  }

  /**
   * Process webhook events based on configuration
   */
  private async processWebhookEvents(
    request: NextRequest,
    response: NextResponse,
    requestBody?: any,
    error?: any
  ): Promise<void> {
    try {
      const userId = await this.extractUserId(request);

      for (const eventConfig of this.options.events) {
        try {
          // Check condition if specified
          if (eventConfig.condition && !eventConfig.condition(request, response, requestBody)) {
            continue;
          }

          // Extract event data
          const eventData = eventConfig.extractData(request, response, requestBody);

          // Determine user ID
          let eventUserId = userId;
          if (typeof eventConfig.userId === 'function') {
            eventUserId = eventConfig.userId(request);
          } else if (typeof eventConfig.userId === 'string') {
            eventUserId = eventConfig.userId;
          }

          // Publish the event
          await this.eventPublisher.publishEvent({
            eventType: eventConfig.eventType,
            eventId: `${eventConfig.eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: eventUserId,
            eventData: {
              ...eventData,
              httpMethod: request.method,
              url: request.url,
              statusCode: response.status,
              ...(error && { error: error.message })
            },
            metadata: {
              source: 'api_middleware',
              timestamp: new Date().toISOString(),
              userAgent: request.headers.get('user-agent') || undefined,
              ip: this.getClientIP(request)
            }
          });
        } catch (eventError) {
          console.error(`Failed to process webhook event ${eventConfig.eventType}:`, eventError);
        }
      }
    } catch (error) {
      console.error('Failed to process webhook events in middleware:', error);
    }
  }

  /**
   * Extract user ID from request
   */
  private async extractUserId(request: NextRequest): Promise<string | undefined> {
    if (this.options.extractUserId) {
      return await this.options.extractUserId(request);
    }

    // Default extraction from Authorization header or session
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // This would need to be implemented based on your auth system
      // For now, return undefined
      return undefined;
    }

    return undefined;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string | undefined {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    return undefined;
  }
}

/**
 * Pre-configured middleware for common document events
 */
export function createDocumentWebhookMiddleware(options: Partial<WebhookMiddlewareOptions> = {}) {
  return new WebhookEventsMiddleware({
    enabled: true,
    events: [
      // Document upload event
      {
        eventType: 'document.uploaded',
        condition: (req, res) => req.method === 'POST' && req.url.includes('/documents') && res.status === 201,
        extractData: (req, res, body) => ({
          fileName: body?.fileName || 'unknown',
          fileSize: body?.fileSize || 0,
          mimeType: body?.mimeType || 'application/octet-stream'
        })
      },
      // Document processing completed
      {
        eventType: 'document.processing.completed',
        condition: (req, res) => req.url.includes('/documents') && req.url.includes('/process') && res.status === 200,
        extractData: (req, res, body) => ({
          documentId: this.extractDocumentId(req.url),
          processingResult: body
        })
      },
      // Document deleted
      {
        eventType: 'document.deleted',
        condition: (req, res) => req.method === 'DELETE' && req.url.includes('/documents') && res.status === 200,
        extractData: (req, res) => ({
          documentId: this.extractDocumentId(req.url)
        })
      }
    ],
    ...options
  });
}

/**
 * Pre-configured middleware for chat events
 */
export function createChatWebhookMiddleware(options: Partial<WebhookMiddlewareOptions> = {}) {
  return new WebhookEventsMiddleware({
    enabled: true,
    events: [
      // New conversation
      {
        eventType: 'chat.conversation.created',
        condition: (req, res) => req.method === 'POST' && req.url.includes('/conversations') && res.status === 201,
        extractData: (req, res, body) => ({
          conversationId: body?.id || this.extractIdFromUrl(req.url),
          initialMessage: body?.initialMessage
        })
      },
      // AI response generated
      {
        eventType: 'chat.ai.response.generated',
        condition: (req, res) => req.url.includes('/chat') && req.url.includes('/stream') && res.status === 200,
        extractData: (req, res, body) => ({
          conversationId: this.extractIdFromUrl(req.url),
          responseLength: body?.content?.length || 0,
          processingTimeMs: body?.processingTime
        })
      }
    ],
    ...options
  });
}

/**
 * Pre-configured middleware for analytics events
 */
export function createAnalyticsWebhookMiddleware(options: Partial<WebhookMiddlewareOptions> = {}) {
  return new WebhookEventsMiddleware({
    enabled: true,
    events: [
      // Usage threshold events
      {
        eventType: 'analytics.usage.threshold',
        condition: (req, res, body) => body?.alert && body?.metric && body?.threshold,
        extractData: (req, res, body) => ({
          metric: body.metric,
          value: body.value,
          threshold: body.threshold,
          severity: body.severity || 'medium'
        })
      }
    ],
    ...options
  });
}

/**
 * Utility function to extract document ID from URL
 */
function extractDocumentId(url: string): string {
  const match = url.match(/\/documents\/([^\/\?]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Utility function to extract ID from URL
 */
function extractIdFromUrl(url: string): string {
  const segments = url.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return lastSegment && lastSegment !== 'stream' ? lastSegment : 'unknown';
}

export default WebhookEventsMiddleware;