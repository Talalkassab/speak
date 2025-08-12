import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { analytics } from '@/middleware/analytics';
import type { 
  PerformanceMetrics, 
  AnalyticsResponse, 
  ResponseTimeDistribution,
  ErrorBreakdown,
  SystemHealth
} from '@/types/analytics';

// Performance analytics request schema
const performanceAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('day'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),
  services: z.array(z.enum(['api', 'chat', 'documents', 'templates', 'compliance'])).default(['api']),
  metrics: z.array(z.enum([
    'response_time', 'error_rate', 'throughput', 'uptime', 'success_rate'
  ])).default(['response_time', 'error_rate']),
  percentiles: z.array(z.enum(['p50', 'p90', 'p95', 'p99'])).default(['p95', 'p99']),
  timezone: z.string().default('Asia/Riyadh')
});

interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

function createErrorResponse(code: string, message: string, status: number = 400, details?: any): NextResponse {
  const error: APIError = {
    code,
    message,
    details,
    timestamp: new Date()
  };
  
  console.error('Performance Analytics API Error:', error);
  return NextResponse.json({ error }, { status });
}

function createSuccessResponse<T>(data: T, status: number = 200, metadata?: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    metadata,
    timestamp: new Date()
  }, { status });
}

// GET /api/v1/analytics/performance - Get performance analytics
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for performance analytics
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to view performance analytics',
        403
      );
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'api_call');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `API call limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      period: searchParams.get('period'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      granularity: searchParams.get('granularity'),
      services: searchParams.getAll('services'),
      metrics: searchParams.getAll('metrics'),
      percentiles: searchParams.getAll('percentiles'),
      timezone: searchParams.get('timezone')
    };
    
    const validatedParams = performanceAnalyticsSchema.parse(queryParams);

    // Calculate date range
    const dateRange = calculateDateRange(validatedParams.period, validatedParams.startDate, validatedParams.endDate);

    const supabase = await createSupabaseServerClient();

    // Get performance metrics
    const performanceData = await getPerformanceMetrics(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.services,
      validatedParams.metrics,
      validatedParams.percentiles
    );

    // Get response time distribution
    const responseTimeDistribution = await getResponseTimeDistribution(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end
    );

    // Get error breakdown
    const errorBreakdown = await getErrorBreakdown(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end
    );

    // Get system health
    const systemHealth = await getSystemHealth(
      supabase,
      userContext.organizationId
    );

    const performanceMetrics: PerformanceMetrics = {
      averageResponseTime: performanceData.averageResponseTime,
      p95ResponseTime: performanceData.p95ResponseTime,
      p99ResponseTime: performanceData.p99ResponseTime,
      errorRate: performanceData.errorRate,
      uptime: performanceData.uptime,
      throughput: performanceData.throughput,
      responseTimeDistribution,
      errorBreakdown,
      systemHealth
    };

    const response: AnalyticsResponse<PerformanceMetrics> = {
      data: performanceMetrics,
      meta: {
        organizationId: userContext.organizationId,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        timezone: validatedParams.timezone,
        generatedAt: new Date().toISOString()
      },
      success: true
    };

    // Track analytics event
    await analytics.trackAnalyticsEvent({
      userId: userContext.userId,
      organizationId: userContext.organizationId,
      eventName: 'performance_analytics_viewed',
      eventCategory: 'analytics',
      eventAction: 'view',
      eventLabel: validatedParams.period,
      properties: {
        dateRange: { start: dateRange.start, end: dateRange.end },
        period: validatedParams.period,
        services: validatedParams.services,
        metrics: validatedParams.metrics
      }
    });

    // Log activity
    await logUserActivity(
      userContext,
      'performance_analytics_viewed',
      'analytics',
      undefined,
      { 
        period: validatedParams.period,
        services: validatedParams.services,
        metrics: validatedParams.metrics
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(response);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error getting performance analytics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper functions
function calculateDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 1);
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function getPerformanceMetrics(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  services: string[],
  metrics: string[],
  percentiles: string[]
): Promise<{
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  uptime: number;
  throughput: number;
}> {
  // Get API usage data for response times
  const { data: apiData } = await supabase
    .from('api_usage')
    .select('response_time_ms, status_code, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('response_time_ms');

  // Get chat interaction response times
  const { data: chatData } = await supabase
    .from('chat_interactions')
    .select('response_time_ms, success, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('response_time_ms');

  // Get document processing times
  const { data: docData } = await supabase
    .from('document_processing')
    .select('processing_time_ms, success, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get template generation times
  const { data: templateData } = await supabase
    .from('template_generation')
    .select('generation_time_ms, success, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Combine all response times
  const allResponseTimes = [
    ...(apiData?.map(d => d.response_time_ms).filter(rt => rt && rt > 0) || []),
    ...(chatData?.map(d => d.response_time_ms).filter(rt => rt && rt > 0) || []),
    ...(docData?.map(d => d.processing_time_ms).filter(rt => rt && rt > 0) || []),
    ...(templateData?.map(d => d.generation_time_ms).filter(rt => rt && rt > 0) || [])
  ].sort((a, b) => a - b);

  // Calculate percentiles
  const averageResponseTime = allResponseTimes.length > 0 ? 
    allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length : 0;

  const p95Index = Math.ceil(allResponseTimes.length * 0.95) - 1;
  const p99Index = Math.ceil(allResponseTimes.length * 0.99) - 1;
  const p95ResponseTime = allResponseTimes.length > 0 ? allResponseTimes[Math.max(0, p95Index)] : 0;
  const p99ResponseTime = allResponseTimes.length > 0 ? allResponseTimes[Math.max(0, p99Index)] : 0;

  // Calculate error rate
  const totalOperations = [
    ...(apiData || []),
    ...(chatData || []),
    ...(docData || []),
    ...(templateData || [])
  ];

  const errorCount = [
    ...(apiData?.filter(d => d.status_code >= 400) || []),
    ...(chatData?.filter(d => !d.success) || []),
    ...(docData?.filter(d => !d.success) || []),
    ...(templateData?.filter(d => !d.success) || [])
  ].length;

  const errorRate = totalOperations.length > 0 ? (errorCount / totalOperations.length) * 100 : 0;

  // Calculate throughput (requests per minute)
  const periodMinutes = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60);
  const throughput = periodMinutes > 0 ? totalOperations.length / periodMinutes : 0;

  // Calculate uptime (simplified - assuming 99.9% if no major outages)
  const uptime = errorRate < 10 ? 99.9 : Math.max(90, 100 - errorRate);

  return {
    averageResponseTime: Math.round(averageResponseTime),
    p95ResponseTime: Math.round(p95ResponseTime),
    p99ResponseTime: Math.round(p99ResponseTime),
    errorRate: Math.round(errorRate * 100) / 100,
    uptime: Math.round(uptime * 100) / 100,
    throughput: Math.round(throughput * 100) / 100
  };
}

async function getResponseTimeDistribution(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ResponseTimeDistribution[]> {
  // Get all response times
  const { data: apiData } = await supabase
    .from('api_usage')
    .select('response_time_ms')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: chatData } = await supabase
    .from('chat_interactions')
    .select('response_time_ms')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const allResponseTimes = [
    ...(apiData?.map(d => d.response_time_ms).filter(rt => rt && rt > 0) || []),
    ...(chatData?.map(d => d.response_time_ms).filter(rt => rt && rt > 0) || [])
  ];

  // Create distribution buckets
  const buckets = [
    { range: '0-100ms', min: 0, max: 100 },
    { range: '100-500ms', min: 100, max: 500 },
    { range: '500ms-1s', min: 500, max: 1000 },
    { range: '1-3s', min: 1000, max: 3000 },
    { range: '3-10s', min: 3000, max: 10000 },
    { range: '10s+', min: 10000, max: Infinity }
  ];

  const total = allResponseTimes.length;

  return buckets.map(bucket => {
    const count = allResponseTimes.filter(rt => rt >= bucket.min && rt < bucket.max).length;
    return {
      range: bucket.range,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    };
  });
}

async function getErrorBreakdown(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ErrorBreakdown[]> {
  // Get API errors
  const { data: apiErrors } = await supabase
    .from('api_usage')
    .select('status_code, created_at, error_message')
    .eq('organization_id', organizationId)
    .gte('status_code', 400)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get chat errors
  const { data: chatErrors } = await supabase
    .from('chat_interactions')
    .select('error_message, created_at')
    .eq('organization_id', organizationId)
    .eq('success', false)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get document processing errors
  const { data: docErrors } = await supabase
    .from('document_processing')
    .select('error_message, created_at')
    .eq('organization_id', organizationId)
    .eq('success', false)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const errorMap = new Map<string, { count: number; lastOccurrence: string }>();

  // Process API errors
  apiErrors?.forEach(error => {
    const errorType = `HTTP ${error.status_code}`;
    const existing = errorMap.get(errorType) || { count: 0, lastOccurrence: error.created_at };
    errorMap.set(errorType, {
      count: existing.count + 1,
      lastOccurrence: new Date(error.created_at) > new Date(existing.lastOccurrence) 
        ? error.created_at 
        : existing.lastOccurrence
    });
  });

  // Process chat errors
  chatErrors?.forEach(error => {
    const errorType = 'Chat Processing Error';
    const existing = errorMap.get(errorType) || { count: 0, lastOccurrence: error.created_at };
    errorMap.set(errorType, {
      count: existing.count + 1,
      lastOccurrence: new Date(error.created_at) > new Date(existing.lastOccurrence) 
        ? error.created_at 
        : existing.lastOccurrence
    });
  });

  // Process document errors
  docErrors?.forEach(error => {
    const errorType = 'Document Processing Error';
    const existing = errorMap.get(errorType) || { count: 0, lastOccurrence: error.created_at };
    errorMap.set(errorType, {
      count: existing.count + 1,
      lastOccurrence: new Date(error.created_at) > new Date(existing.lastOccurrence) 
        ? error.created_at 
        : existing.lastOccurrence
    });
  });

  const totalErrors = Array.from(errorMap.values()).reduce((sum, error) => sum + error.count, 0);

  return Array.from(errorMap.entries())
    .map(([errorType, data]) => ({
      errorType,
      count: data.count,
      percentage: totalErrors > 0 ? Math.round((data.count / totalErrors) * 100) : 0,
      lastOccurrence: data.lastOccurrence
    }))
    .sort((a, b) => b.count - a.count);
}

async function getSystemHealth(
  supabase: any,
  organizationId: string
): Promise<SystemHealth> {
  // Get recent performance metrics
  const recentTime = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes

  const { data: recentMetrics } = await supabase
    .from('performance_metrics')
    .select('metric_type, metric_value')
    .eq('organization_id', organizationId)
    .gte('recorded_at', recentTime.toISOString())
    .order('recorded_at', { ascending: false });

  // Calculate system health indicators
  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  
  // Get recent error rate
  const { data: recentErrors } = await supabase
    .from('api_usage')
    .select('status_code')
    .eq('organization_id', organizationId)
    .gte('created_at', recentTime.toISOString());

  const totalRecentRequests = recentErrors?.length || 0;
  const recentErrorCount = recentErrors?.filter(r => r.status_code >= 400).length || 0;
  const recentErrorRate = totalRecentRequests > 0 ? (recentErrorCount / totalRecentRequests) * 100 : 0;

  if (recentErrorRate > 50) {
    status = 'down';
  } else if (recentErrorRate > 10) {
    status = 'degraded';
  }

  return {
    status,
    cpuUsage: 45, // Placeholder - would integrate with actual system metrics
    memoryUsage: 62, // Placeholder
    diskUsage: 35, // Placeholder
    activeConnections: totalRecentRequests,
    queueDepth: 0 // Placeholder - would track actual queue depth
  };
}