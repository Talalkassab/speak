import { NextRequest, NextResponse } from 'next/server';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { telemetryManager } from '@/libs/monitoring/telemetry';
import { performanceMonitor } from '@/libs/monitoring/performance-monitor';
import { structuredLogger } from '@/libs/logging/structured-logger';
import { errorTracker } from '@/libs/monitoring/error-tracker';
import { usageTracker } from '@/libs/monitoring/usage-tracker';
import * as promClient from 'prom-client';

// Prometheus metrics for middleware
const httpRequestsInFlight = new promClient.Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method', 'route'],
});

const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

const rateLimitCounter = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['route', 'limit_type'],
});

export interface RequestContext {
  requestId: string;
  userId?: string;
  organizationId?: string;
  userAgent?: string;
  ip?: string;
  sessionId?: string;
  apiKey?: string;
  userTier?: string;
  route: string;
  method: string;
  startTime: number;
  traceId?: string;
  spanId?: string;
}

export interface MonitoringConfig {
  enableTracing: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
  enableErrorTracking: boolean;
  enableUsageTracking: boolean;
  enablePerformanceMonitoring: boolean;
  logRequestBodies: boolean;
  logResponseBodies: boolean;
  maxBodySize: number; // Maximum body size to log in bytes
  excludedRoutes: string[];
  slowRequestThresholdMs: number;
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
}

class MonitoringMiddleware {
  private tracer = trace.getTracer('http-middleware');
  private defaultConfig: MonitoringConfig;
  private requestContexts = new Map<string, RequestContext>();
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    this.defaultConfig = {
      enableTracing: true,
      enableMetrics: true,
      enableLogging: true,
      enableErrorTracking: true,
      enableUsageTracking: true,
      enablePerformanceMonitoring: true,
      logRequestBodies: process.env.NODE_ENV === 'development',
      logResponseBodies: false, // Usually too verbose for production
      maxBodySize: 10000, // 10KB
      excludedRoutes: ['/api/health', '/api/ready', '/api/metrics', '/_next', '/favicon.ico'],
      slowRequestThresholdMs: 1000,
      rateLimiting: {
        enabled: true,
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        skipSuccessfulRequests: false,
      },
    };
  }

  /**
   * Create monitoring middleware
   */
  create(config: Partial<MonitoringConfig> = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };

    return async (request: NextRequest): Promise<NextResponse> => {
      const requestContext = this.createRequestContext(request);
      
      // Skip monitoring for excluded routes
      if (this.shouldSkipRoute(request.url, finalConfig.excludedRoutes)) {
        return NextResponse.next();
      }

      // Check rate limiting
      if (finalConfig.rateLimiting.enabled) {
        const rateLimitResult = this.checkRateLimit(requestContext, finalConfig.rateLimiting);
        if (!rateLimitResult.allowed) {
          return this.handleRateLimitExceeded(requestContext, rateLimitResult);
        }
      }

      let span: any;
      let response: NextResponse;

      try {
        // Start tracing
        if (finalConfig.enableTracing) {
          span = this.startTracing(requestContext);
        }

        // Update in-flight metrics
        if (finalConfig.enableMetrics) {
          httpRequestsInFlight.inc({ method: requestContext.method, route: requestContext.route });
        }

        // Log request start
        if (finalConfig.enableLogging) {
          await this.logRequestStart(request, requestContext, finalConfig);
        }

        // Store request context
        this.requestContexts.set(requestContext.requestId, requestContext);

        // Process request and get response
        response = await this.processRequest(request, requestContext, finalConfig);

        // Process response
        response = await this.processResponse(request, response, requestContext, finalConfig);

        return response;

      } catch (error) {
        // Handle errors
        return this.handleError(error, requestContext, finalConfig, span);

      } finally {
        // Cleanup
        this.cleanup(requestContext, finalConfig, span);
      }
    };
  }

  /**
   * Create request context
   */
  private createRequestContext(request: NextRequest): RequestContext {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const route = this.normalizeRoute(url.pathname);
    
    return {
      requestId,
      route,
      method: request.method,
      startTime: Date.now(),
      userAgent: request.headers.get('user-agent') || '',
      ip: this.getClientIP(request),
      sessionId: request.cookies.get('session-id')?.value,
      apiKey: request.headers.get('x-api-key') || undefined,
      userTier: request.headers.get('x-user-tier') || 'free',
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers for the real IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    
    return 'unknown';
  }

  /**
   * Normalize route for metrics grouping
   */
  private normalizeRoute(pathname: string): string {
    // Replace dynamic segments with placeholders
    return pathname
      .replace(/\/api\/v1\/[^/]+\/[a-f0-9-]{36}/g, '/api/v1/:resource/:id') // UUIDs
      .replace(/\/api\/v1\/[^/]+\/\d+/g, '/api/v1/:resource/:id') // Numeric IDs
      .replace(/\/[a-f0-9-]{36}/g, '/:id') // General UUIDs
      .replace(/\/\d+/g, '/:id') // General numeric IDs
      .replace(/\/api\/webhooks\/[^/]+/g, '/api/webhooks/:provider');
  }

  /**
   * Check if route should be skipped
   */
  private shouldSkipRoute(url: string, excludedRoutes: string[]): boolean {
    const pathname = new URL(url).pathname;
    return excludedRoutes.some(route => pathname.startsWith(route));
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(
    context: RequestContext, 
    rateLimitConfig: MonitoringConfig['rateLimiting']
  ): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
    const key = `${context.ip}:${context.route}`;
    const now = Date.now();
    
    let bucket = this.rateLimitStore.get(key);
    
    // Reset bucket if window expired
    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 0,
        resetTime: now + rateLimitConfig.windowMs
      };
    }

    bucket.count += 1;
    this.rateLimitStore.set(key, bucket);

    const allowed = bucket.count <= rateLimitConfig.maxRequests;
    
    if (!allowed) {
      rateLimitCounter.inc({ route: context.route, limit_type: 'ip' });
    }

    return {
      allowed,
      limit: rateLimitConfig.maxRequests,
      remaining: Math.max(0, rateLimitConfig.maxRequests - bucket.count),
      resetTime: bucket.resetTime
    };
  }

  /**
   * Handle rate limit exceeded
   */
  private handleRateLimitExceeded(
    context: RequestContext,
    rateLimitResult: { limit: number; remaining: number; resetTime: number }
  ): NextResponse {
    structuredLogger.warn('Rate limit exceeded', {
      service: 'middleware',
      component: 'rate-limiter',
      operation: 'rate-limit-check'
    }, context);

    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      },
      { status: 429 }
    );

    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

    return response;
  }

  /**
   * Start distributed tracing
   */
  private startTracing(requestContext: RequestContext) {
    const span = this.tracer.startSpan(`HTTP ${requestContext.method} ${requestContext.route}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': requestContext.method,
        'http.route': requestContext.route,
        'http.request_id': requestContext.requestId,
        'user.id': requestContext.userId,
        'organization.id': requestContext.organizationId,
        'user.tier': requestContext.userTier,
        'http.user_agent': requestContext.userAgent,
        'http.client_ip': requestContext.ip,
      }
    });

    // Store trace context in request context
    const traceContext = telemetryManager.getTraceContext();
    requestContext.traceId = traceContext.traceId;
    requestContext.spanId = traceContext.spanId;

    return span;
  }

  /**
   * Log request start
   */
  private async logRequestStart(
    request: NextRequest, 
    requestContext: RequestContext,
    config: MonitoringConfig
  ): Promise<void> {
    let requestBody: string | undefined;
    
    if (config.logRequestBodies && 
        ['POST', 'PUT', 'PATCH'].includes(requestContext.method) &&
        request.headers.get('content-type')?.includes('application/json')) {
      
      try {
        const body = await request.clone().text();
        if (body.length <= config.maxBodySize) {
          requestBody = body;
        } else {
          requestBody = `[Body too large: ${body.length} bytes]`;
        }
      } catch (error) {
        requestBody = '[Failed to read request body]';
      }
    }

    structuredLogger.logApiRequestStart(
      requestContext.method,
      requestContext.route,
      {
        ...requestContext,
        requestBody: config.logRequestBodies ? requestBody : undefined,
      }
    );

    // Track request size
    if (request.headers.get('content-length')) {
      const size = parseInt(request.headers.get('content-length')!);
      httpRequestSize.observe(
        { method: requestContext.method, route: requestContext.route },
        size
      );
    }
  }

  /**
   * Process request
   */
  private async processRequest(
    request: NextRequest,
    requestContext: RequestContext,
    config: MonitoringConfig
  ): Promise<NextResponse> {
    // Add monitoring headers to request
    const headers = new Headers(request.headers);
    headers.set('X-Request-ID', requestContext.requestId);
    headers.set('X-Trace-ID', requestContext.traceId || '');
    headers.set('X-Span-ID', requestContext.spanId || '');

    // Create new request with monitoring headers
    const monitoredRequest = new NextRequest(request.url, {
      method: request.method,
      headers,
      body: request.body,
    });

    // Continue to next middleware/handler
    return NextResponse.next();
  }

  /**
   * Process response
   */
  private async processResponse(
    request: NextRequest,
    response: NextResponse,
    requestContext: RequestContext,
    config: MonitoringConfig
  ): Promise<NextResponse> {
    const duration = Date.now() - requestContext.startTime;
    const statusCode = response.status;

    // Add monitoring headers to response
    const monitoredResponse = NextResponse.next(response);
    monitoredResponse.headers.set('X-Request-ID', requestContext.requestId);
    monitoredResponse.headers.set('X-Response-Time', `${duration}ms`);
    monitoredResponse.headers.set('X-Trace-ID', requestContext.traceId || '');

    // Track performance metrics
    if (config.enablePerformanceMonitoring) {
      performanceMonitor.trackHttpRequest({
        requestId: requestContext.requestId,
        method: requestContext.method,
        route: requestContext.route,
        statusCode,
        duration,
        organizationId: requestContext.organizationId,
        userId: requestContext.userId,
        timestamp: new Date(),
      });
    }

    // Track usage metrics
    if (config.enableUsageTracking) {
      await usageTracker.trackApiUsage({
        endpoint: requestContext.route,
        method: requestContext.method,
        organizationId: requestContext.organizationId || 'unknown',
        userId: requestContext.userId,
        userTier: requestContext.userTier || 'free',
        statusCode,
        responseTime: duration,
        timestamp: new Date(),
      });
    }

    // Log response
    if (config.enableLogging) {
      let responseBody: string | undefined;
      
      if (config.logResponseBodies && statusCode >= 400) {
        try {
          const body = await response.clone().text();
          if (body.length <= config.maxBodySize) {
            responseBody = body;
          } else {
            responseBody = `[Body too large: ${body.length} bytes]`;
          }
        } catch (error) {
          responseBody = '[Failed to read response body]';
        }
      }

      structuredLogger.logApiRequestComplete(
        requestContext.method,
        requestContext.route,
        statusCode,
        duration,
        {
          ...requestContext,
          responseBody: config.logResponseBodies ? responseBody : undefined,
        }
      );

      // Log slow requests
      if (duration > config.slowRequestThresholdMs) {
        structuredLogger.warn('Slow request detected', {
          service: 'middleware',
          component: 'performance-monitor',
          operation: 'slow-request-detection',
          additionalData: {
            duration,
            threshold: config.slowRequestThresholdMs,
            route: requestContext.route,
            method: requestContext.method,
            statusCode,
          }
        }, requestContext);
      }
    }

    // Track response size
    const responseSize = response.headers.get('content-length');
    if (responseSize) {
      httpResponseSize.observe(
        { 
          method: requestContext.method, 
          route: requestContext.route,
          status_code: statusCode.toString()
        },
        parseInt(responseSize)
      );
    }

    // Track errors
    if (config.enableErrorTracking && statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'system_error' : 
                      statusCode === 429 ? 'rate_limit_error' :
                      statusCode >= 400 ? 'api_error' : 'unknown_error';

      await errorTracker.createError(
        errorType,
        `HTTP ${statusCode} error on ${requestContext.method} ${requestContext.route}`,
        new Error(`HTTP ${statusCode}: ${response.statusText}`),
        {
          ...requestContext,
          route: requestContext.route,
          method: requestContext.method,
        }
      );
    }

    return monitoredResponse;
  }

  /**
   * Handle errors during request processing
   */
  private handleError(
    error: unknown,
    requestContext: RequestContext,
    config: MonitoringConfig,
    span?: any
  ): NextResponse {
    const duration = Date.now() - requestContext.startTime;

    // Log error
    structuredLogger.error('Request processing error', {
      service: 'middleware',
      component: 'error-handler',
      operation: 'handle-error',
      error: error instanceof Error ? error : undefined,
      duration,
    }, requestContext);

    // Track error
    if (config.enableErrorTracking) {
      errorTracker.createError(
        'system_error',
        'Request processing failed',
        error instanceof Error ? error : new Error('Unknown middleware error'),
        requestContext
      );
    }

    // Update span with error
    if (span && config.enableTracing) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
    }

    // Return error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        requestId: requestContext.requestId,
      },
      { 
        status: 500,
        headers: {
          'X-Request-ID': requestContext.requestId,
          'X-Response-Time': `${duration}ms`,
        }
      }
    );
  }

  /**
   * Cleanup after request processing
   */
  private cleanup(
    requestContext: RequestContext,
    config: MonitoringConfig,
    span?: any
  ): void {
    // Update in-flight metrics
    if (config.enableMetrics) {
      httpRequestsInFlight.dec({ method: requestContext.method, route: requestContext.route });
    }

    // End span
    if (span && config.enableTracing) {
      span.end();
    }

    // Remove request context
    this.requestContexts.delete(requestContext.requestId);

    // Clean up old rate limit entries (periodically)
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupRateLimitStore();
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, bucket] of this.rateLimitStore.entries()) {
      if (now > bucket.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Get middleware statistics
   */
  getStats(): {
    activeRequests: number;
    rateLimitEntries: number;
    requestContexts: number;
  } {
    return {
      activeRequests: this.requestContexts.size,
      rateLimitEntries: this.rateLimitStore.size,
      requestContexts: this.requestContexts.size,
    };
  }

  /**
   * Get request context by ID
   */
  getRequestContext(requestId: string): RequestContext | undefined {
    return this.requestContexts.get(requestId);
  }
}

// Export singleton instance
export const monitoringMiddleware = new MonitoringMiddleware();

// Export types
export type { RequestContext, MonitoringConfig };

export default monitoringMiddleware;