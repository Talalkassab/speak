import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '../libs/monitoring/performance-monitor';
import { usageTracker } from '../libs/monitoring/usage-tracker';
import { structuredLogger } from '../libs/logging/structured-logger';
import { telemetryManager } from '../libs/monitoring/telemetry';

export interface MonitoringContext {
  requestId: string;
  organizationId?: string;
  userId?: string;
  startTime: number;
  traceId?: string;
  spanId?: string;
}

/**
 * Enhanced monitoring middleware for Next.js
 */
export async function monitoringMiddleware(
  request: NextRequest,
  next: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Extract user context from request headers (set by auth middleware)
  const organizationId = request.headers.get('x-organization-id') || undefined;
  const userId = request.headers.get('x-user-id') || undefined;
  
  // Get trace context
  const traceContext = telemetryManager.getTraceContext();
  
  // Create monitoring context
  const context: MonitoringContext = {
    requestId,
    organizationId,
    userId,
    startTime,
    traceId: traceContext.traceId,
    spanId: traceContext.spanId,
  };

  // Set request ID header for downstream services
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  
  // Create new request with headers
  const modifiedRequest = new NextRequest(request.url, {
    method: request.method,
    headers: requestHeaders,
    body: request.body,
  });

  // Start telemetry span
  const span = telemetryManager.createSpan(`HTTP ${request.method} ${getRoutePath(request)}`, {
    organizationId,
    userId,
    requestId,
    additionalAttributes: {
      'http.method': request.method,
      'http.url': request.url,
      'http.route': getRoutePath(request),
      'user_agent': request.headers.get('user-agent') || 'unknown',
      'client_ip': getClientIP(request),
    },
  });

  try {
    // Log request start
    await logRequestStart(modifiedRequest, context);
    
    // Execute the actual request
    const response = await next();
    
    // Calculate duration
    const duration = Date.now() - startTime;
    const statusCode = response.status;
    
    // Track performance metrics
    await trackRequestMetrics(modifiedRequest, response, duration, context);
    
    // Log request completion
    await logRequestComplete(modifiedRequest, response, duration, context);
    
    // Track usage for billing/analytics
    await trackUsage(modifiedRequest, response, context);
    
    // Set response headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('x-request-id', requestId);
    responseHeaders.set('x-response-time', duration.toString());
    
    if (traceContext.traceId) {
      responseHeaders.set('x-trace-id', traceContext.traceId);
    }
    
    // Update telemetry span
    span.setAttributes({
      'http.status_code': statusCode,
      'http.response_size': response.headers.get('content-length') || '0',
      'operation.duration_ms': duration,
    });
    
    // Create response with headers
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Track error metrics
    await trackErrorMetrics(modifiedRequest, error, duration, context);
    
    // Log error
    await logRequestError(modifiedRequest, error as Error, duration, context);
    
    // Update telemetry span with error
    span.recordException(error as Error);
    
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Log request start
 */
async function logRequestStart(
  request: NextRequest,
  context: MonitoringContext
): Promise<void> {
  const route = getRoutePath(request);
  
  structuredLogger.logApiRequestStart(
    request.method,
    route,
    {
      requestId: context.requestId,
      organizationId: context.organizationId,
      userId: context.userId,
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      traceId: context.traceId,
      spanId: context.spanId,
      route,
      method: request.method,
    }
  );
}

/**
 * Log request completion
 */
async function logRequestComplete(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  context: MonitoringContext
): Promise<void> {
  const route = getRoutePath(request);
  
  structuredLogger.logApiRequestComplete(
    request.method,
    route,
    response.status,
    duration,
    {
      requestId: context.requestId,
      organizationId: context.organizationId,
      userId: context.userId,
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      traceId: context.traceId,
      spanId: context.spanId,
      route,
      method: request.method,
    }
  );
}

/**
 * Log request error
 */
async function logRequestError(
  request: NextRequest,
  error: Error,
  duration: number,
  context: MonitoringContext
): Promise<void> {
  const route = getRoutePath(request);
  
  structuredLogger.error(`API Request Error: ${request.method} ${route}`, {
    service: 'api',
    component: 'request-handler',
    operation: 'request-error',
    duration,
    error,
  }, {
    requestId: context.requestId,
    organizationId: context.organizationId,
    userId: context.userId,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
    traceId: context.traceId,
    spanId: context.spanId,
    route,
    method: request.method,
  });
}

/**
 * Track request performance metrics
 */
async function trackRequestMetrics(
  request: NextRequest,
  response: NextResponse,
  duration: number,
  context: MonitoringContext
): Promise<void> {
  const route = getRoutePath(request);
  
  performanceMonitor.trackHttpRequest({
    requestId: context.requestId,
    method: request.method,
    route,
    statusCode: response.status,
    duration,
    organizationId: context.organizationId,
    userId: context.userId,
    timestamp: new Date(context.startTime),
  });
}

/**
 * Track error metrics
 */
async function trackErrorMetrics(
  request: NextRequest,
  error: Error,
  duration: number,
  context: MonitoringContext
): Promise<void> {
  const route = getRoutePath(request);
  
  performanceMonitor.trackHttpRequest({
    requestId: context.requestId,
    method: request.method,
    route,
    statusCode: 500, // Assume 500 for unhandled errors
    duration,
    organizationId: context.organizationId,
    userId: context.userId,
    timestamp: new Date(context.startTime),
    additionalData: {
      error: error.message,
      stack: error.stack,
    },
  });
}

/**
 * Track usage for analytics and billing
 */
async function trackUsage(
  request: NextRequest,
  response: NextResponse,
  context: MonitoringContext
): Promise<void> {
  if (!context.organizationId || !context.userId) {
    return; // Skip tracking if no user context
  }

  const route = getRoutePath(request);
  const userTier = request.headers.get('x-user-tier') || 'free';
  
  // Track API usage
  await usageTracker.trackApiUsage({
    endpoint: route,
    method: request.method,
    organizationId: context.organizationId,
    userId: context.userId,
    userTier,
    statusCode: response.status,
    responseTime: Date.now() - context.startTime,
    requestSize: parseInt(request.headers.get('content-length') || '0'),
    responseSize: parseInt(response.headers.get('content-length') || '0'),
    timestamp: new Date(context.startTime),
  });

  // Track specific features based on route
  const feature = mapRouteToFeature(route, request.method);
  if (feature) {
    await usageTracker.trackFeatureUsage({
      feature,
      userId: context.userId,
      organizationId: context.organizationId,
      result: response.status < 400 ? 'success' : 'error',
      metadata: {
        duration: Date.now() - context.startTime,
      },
      timestamp: new Date(context.startTime),
    });
  }
}

/**
 * Get route path from request
 */
function getRoutePath(request: NextRequest): string {
  const url = new URL(request.url);
  let pathname = url.pathname;
  
  // Normalize API routes
  if (pathname.startsWith('/api/')) {
    // Replace dynamic segments with placeholders
    pathname = pathname
      .replace(/\/api\/v\d+\//, '/api/v1/') // Normalize version
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[^\/]+\.(jpg|png|gif|svg|webp|ico)$/i, '/:image'); // Images
  }
  
  return pathname;
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    request.headers.get('x-client-ip') ||
    'unknown'
  );
}

/**
 * Map route to feature type for usage tracking
 */
function mapRouteToFeature(route: string, method: string): import('../libs/monitoring/usage-tracker').FeatureType | null {
  // Document routes
  if (route.includes('/documents')) {
    if (method === 'POST') return 'document_upload';
    if (method === 'GET' && route.includes('/search')) return 'document_search';
    if (method === 'DELETE') return 'document_upload'; // Reuse for simplicity
  }
  
  // Chat routes
  if (route.includes('/chat') || route.includes('/rag/query')) {
    return 'chat_query';
  }
  
  // Template routes
  if (route.includes('/templates')) {
    return 'template_generation';
  }
  
  // Analytics routes
  if (route.includes('/analytics')) {
    return 'analytics_view';
  }
  
  // Bulk operations
  if (route.includes('/bulk')) {
    return 'bulk_processing';
  }
  
  // Export operations
  if (method === 'GET' && (route.includes('/export') || route.includes('/download'))) {
    return 'export_data';
  }
  
  // User management
  if (route.includes('/users') || route.includes('/organization')) {
    return 'user_management';
  }
  
  return null;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Wrapper for easy integration with Next.js middleware chain
 */
export function createMonitoringMiddleware() {
  return async (request: NextRequest, next: () => Promise<NextResponse>) => {
    return monitoringMiddleware(request, next);
  };
}

export default monitoringMiddleware;