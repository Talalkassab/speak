import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { analytics } from '@/middleware/analytics';
import type { 
  UsageMetrics as AnalyticsUsageMetrics, 
  AnalyticsResponse, 
  DailyUsage, 
  WeeklyUsage, 
  MonthlyUsage,
  UserActivity,
  PeakUsage
} from '@/types/analytics';

// Analytics request schemas
const usageAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum([
    'queries', 'documents', 'users', 'templates', 'tokens', 'response_time', 'api_calls'
  ])).default(['queries', 'documents', 'users']),
  breakdown: z.array(z.enum([
    'user', 'document_category', 'language', 'template_category', 'day_of_week'
  ])).optional()
});

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface UsageMetrics {
  totalQueries: number;
  uniqueUsers: number;
  documentsProcessed: number;
  templatesGenerated: number;
  averageResponseTime: number;
  totalApiCalls: number;
  tokensUsed: number;
  errorRate: number;
}

interface UsageAnalyticsResponse {
  period: {
    start: string;
    end: string;
    duration: string;
  };
  metrics: UsageMetrics;
  trends: {
    queries: TimeSeriesPoint[];
    users: TimeSeriesPoint[];
    documents: TimeSeriesPoint[];
    templates?: TimeSeriesPoint[];
    response_times?: TimeSeriesPoint[];
  };
  breakdowns?: {
    [key: string]: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
  };
  comparisons?: {
    previous_period: {
      metrics: UsageMetrics;
      change_percentage: {
        queries: number;
        users: number;
        documents: number;
      };
    };
  };
}

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
  
  console.error('API Error:', error);
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

// GET /api/v1/analytics/usage - Get usage analytics
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for analytics
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to view analytics',
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
      metrics: searchParams.getAll('metrics'),
      breakdown: searchParams.getAll('breakdown')
    };
    
    const { period, startDate, endDate, granularity, metrics, breakdown } = usageAnalyticsSchema.parse(queryParams);

    // Calculate date range
    const dateRange = calculateDateRange(period, startDate, endDate);
    const previousDateRange = calculatePreviousDateRange(dateRange);

    const supabase = await createSupabaseServerClient();

    // Get current period metrics
    const currentMetrics = await getUsageMetrics(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end
    );

    // Get previous period metrics for comparison
    const previousMetrics = await getUsageMetrics(
      supabase,
      userContext.organizationId,
      previousDateRange.start,
      previousDateRange.end
    );

    // Get time series data
    const timeSeriesData = await getTimeSeriesData(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      granularity,
      metrics
    );

    // Get breakdown data if requested
    let breakdownData: any = undefined;
    if (breakdown && breakdown.length > 0) {
      breakdownData = await getBreakdownData(
        supabase,
        userContext.organizationId,
        dateRange.start,
        dateRange.end,
        breakdown
      );
    }

    // Calculate change percentages
    const changePercentages = {
      queries: calculatePercentageChange(previousMetrics.totalQueries, currentMetrics.totalQueries),
      users: calculatePercentageChange(previousMetrics.uniqueUsers, currentMetrics.uniqueUsers),
      documents: calculatePercentageChange(previousMetrics.documentsProcessed, currentMetrics.documentsProcessed)
    };

    const response: UsageAnalyticsResponse = {
      period: {
        start: dateRange.start,
        end: dateRange.end,
        duration: period
      },
      metrics: currentMetrics,
      trends: timeSeriesData,
      breakdowns: breakdownData,
      comparisons: {
        previous_period: {
          metrics: previousMetrics,
          change_percentage: changePercentages
        }
      }
    };

    // Log activity
    await logUserActivity(
      userContext,
      'usage_analytics_viewed',
      'analytics',
      undefined,
      { 
        period,
        metricsRequested: metrics,
        breakdownRequested: breakdown
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

    console.error('Unexpected error getting usage analytics:', error);
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
        start.setMonth(now.getMonth() - 1);
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function calculatePreviousDateRange(
  currentRange: { start: string; end: string }
): { start: string; end: string } {
  const currentStart = new Date(currentRange.start);
  const currentEnd = new Date(currentRange.end);
  const duration = currentEnd.getTime() - currentStart.getTime();
  
  const previousEnd = new Date(currentStart);
  const previousStart = new Date(currentStart.getTime() - duration);
  
  return {
    start: previousStart.toISOString(),
    end: previousEnd.toISOString()
  };
}

function calculatePercentageChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function getUsageMetrics(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<UsageMetrics> {
  // Get chat interaction metrics (replaces rag_queries)
  const { data: chatData } = await supabase
    .from('chat_interactions')
    .select('id, tokens_input, tokens_output, response_time_ms, created_at, user_id, success')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get document processing metrics
  const { data: documentsData } = await supabase
    .from('document_processing')
    .select('id, user_id, success')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get template generation metrics
  const { data: templatesData } = await supabase
    .from('template_generation')
    .select('id, user_id, success')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get API usage metrics
  const { data: apiCallsData } = await supabase
    .from('api_usage')
    .select('id, response_time_ms, status_code')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Calculate unique users across all activities
  const allUserIds = new Set([
    ...(chatData?.map(c => c.user_id).filter(Boolean) || []),
    ...(documentsData?.map(d => d.user_id).filter(Boolean) || []),
    ...(templatesData?.map(t => t.user_id).filter(Boolean) || [])
  ]);

  // Calculate metrics
  const totalQueries = chatData?.length || 0;
  const totalTokens = chatData?.reduce((sum, c) => sum + (c.tokens_input || 0) + (c.tokens_output || 0), 0) || 0;
  const totalResponseTime = chatData?.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) || 0;
  const averageResponseTime = totalQueries > 0 ? totalResponseTime / totalQueries : 0;
  const totalApiCalls = apiCallsData?.length || 0;

  // Calculate error rate
  const totalOperations = totalQueries + (documentsData?.length || 0) + (templatesData?.length || 0);
  const errorCount = [
    ...(chatData?.filter(c => !c.success) || []),
    ...(documentsData?.filter(d => !d.success) || []),
    ...(templatesData?.filter(t => !t.success) || []),
    ...(apiCallsData?.filter(a => a.status_code >= 400) || [])
  ].length;
  const errorRate = totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;

  return {
    totalQueries,
    uniqueUsers: allUserIds.size,
    documentsProcessed: documentsData?.length || 0,
    templatesGenerated: templatesData?.length || 0,
    averageResponseTime,
    totalApiCalls,
    tokensUsed: totalTokens,
    errorRate
  };
}

async function getTimeSeriesData(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  granularity: string,
  metrics: string[]
): Promise<{
  queries: TimeSeriesPoint[];
  users: TimeSeriesPoint[];
  documents: TimeSeriesPoint[];
  templates?: TimeSeriesPoint[];
  response_times?: TimeSeriesPoint[];
}> {
  const timeFormat = getTimeFormat(granularity);
  
  // Get chat interactions time series (replaces rag_queries)
  const { data: queriesTS } = await supabase
    .from('chat_interactions')
    .select(`created_at, tokens_input, tokens_output, response_time_ms, user_id`)
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Get document processing time series
  const { data: documentsTS } = await supabase
    .from('document_processing')
    .select('created_at, user_id')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Get template generation time series
  const { data: templatesTS } = await supabase
    .from('template_generation')
    .select('created_at, user_id')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  // Process time series data
  const queries = processTimeSeriesData(queriesTS || [], 'count', granularity);
  const users = processTimeSeriesData([
    ...(queriesTS || []),
    ...(documentsTS || []),
    ...(templatesTS || [])
  ], 'unique_users', granularity);
  const documents = processTimeSeriesData(documentsTS || [], 'count', granularity);
  const templates = processTimeSeriesData(templatesTS || [], 'count', granularity);
  const response_times = processTimeSeriesData(queriesTS || [], 'avg_response_time', granularity);

  return {
    queries,
    users,
    documents,
    ...(metrics.includes('templates') && { templates }),
    ...(metrics.includes('response_time') && { response_times })
  };
}

async function getBreakdownData(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  breakdowns: string[]
): Promise<Record<string, Array<{ category: string; count: number; percentage: number }>>> {
  const result: Record<string, any> = {};

  for (const breakdown of breakdowns) {
    switch (breakdown) {
      case 'document_category':
        const { data: docCategories } = await supabase
          .from('document_processing')
          .select('document_type')
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        result.document_category = processBreakdownData(
          docCategories?.map(d => ({ category: d.document_type })) || [], 
          'category'
        );
        break;

      case 'language':
        // For now, we'll get language from metadata or assume Arabic/English
        const { data: chatLanguages } = await supabase
          .from('chat_interactions')
          .select('metadata')
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        const languageData = chatLanguages?.map(c => ({
          language: c.metadata?.language || 'ar' // Default to Arabic for Saudi HR
        })) || [];

        result.language = processBreakdownData(languageData, 'language');
        break;

      case 'template_category':
        const { data: templateCategories } = await supabase
          .from('template_generation')
          .select('template_category')
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        result.template_category = processBreakdownData(
          templateCategories?.map(t => ({ category: t.template_category })) || [], 
          'category'
        );
        break;

      case 'day_of_week':
        const { data: dayOfWeekData } = await supabase
          .from('chat_interactions')
          .select('created_at')
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        const dayOfWeekBreakdown = dayOfWeekData?.map(item => ({
          day: new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'long' })
        })) || [];

        result.day_of_week = processBreakdownData(dayOfWeekBreakdown, 'day');
        break;

      case 'user':
        // Get user breakdown with profile information
        const { data: userBreakdown } = await supabase
          .from('chat_interactions')
          .select(`
            user_id,
            user_profiles!inner(full_name, department)
          `)
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        const userData = userBreakdown?.map(u => ({
          category: u.user_profiles?.full_name || 'Unknown User'
        })) || [];

        result.user = processBreakdownData(userData, 'category');
        break;
    }
  }

  return result;
}

function getTimeFormat(granularity: string): string {
  switch (granularity) {
    case 'hour': return 'YYYY-MM-DD HH24:00:00';
    case 'day': return 'YYYY-MM-DD';
    case 'week': return 'YYYY-"W"WW';
    case 'month': return 'YYYY-MM';
    default: return 'YYYY-MM-DD';
  }
}

function processTimeSeriesData(
  data: any[],
  metric: 'count' | 'unique_users' | 'avg_response_time',
  granularity: string
): TimeSeriesPoint[] {
  const grouped = new Map<string, any[]>();

  data.forEach(item => {
    const date = new Date(item.created_at);
    let key: string;

    switch (granularity) {
      case 'hour':
        key = date.toISOString().substring(0, 13) + ':00:00.000Z';
        break;
      case 'day':
        key = date.toISOString().substring(0, 10);
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().substring(0, 10);
        break;
      case 'month':
        key = date.toISOString().substring(0, 7) + '-01';
        break;
      default:
        key = date.toISOString().substring(0, 10);
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  const result: TimeSeriesPoint[] = [];

  grouped.forEach((items, timestamp) => {
    let value: number;

    switch (metric) {
      case 'count':
        value = items.length;
        break;
      case 'unique_users':
        const uniqueUsers = new Set(items.map(i => i.user_id));
        value = uniqueUsers.size;
        break;
      case 'avg_response_time':
        const totalTime = items.reduce((sum, i) => sum + (i.response_time_ms || 0), 0);
        value = items.length > 0 ? totalTime / items.length : 0;
        break;
      default:
        value = items.length;
    }

    result.push({
      timestamp,
      value
    });
  });

  return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function processBreakdownData(
  data: any[],
  field: string
): Array<{ category: string; count: number; percentage: number }> {
  const counts = new Map<string, number>();
  const total = data.length;

  data.forEach(item => {
    const value = item[field] || 'Unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
}