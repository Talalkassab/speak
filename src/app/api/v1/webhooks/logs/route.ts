/**
 * Webhook Logs API
 * GET /api/v1/webhooks/logs - Get webhook delivery logs across all webhooks
 * Provides system-wide logging and monitoring capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import type { WebhookDeliveryLog } from '@/types/webhooks';
import { WebhookError } from '@/types/webhooks';

interface WebhookLogQuery {
  page?: number;
  limit?: number;
  webhookId?: string;
  deliveryId?: string;
  status?: 'success' | 'failed';
  startDate?: string;
  endDate?: string;
  sortBy?: 'attempted_at' | 'response_time_ms' | 'attempt_number';
  sortOrder?: 'asc' | 'desc';
  errorType?: string;
}

interface WebhookLogResponse {
  logs: Array<WebhookDeliveryLog & {
    webhookName?: string;
    eventType?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalLogs: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    errorBreakdown: Record<string, number>;
  };
  filters: {
    applied: Record<string, any>;
    available: {
      webhooks: Array<{ id: string; name: string }>;
      errorTypes: string[];
      dateRange: { earliest: string; latest: string };
    };
  };
}

// GET /api/v1/webhooks/logs - Get webhook delivery logs
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Parse query parameters
    const query: WebhookLogQuery = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 200),
      webhookId: searchParams.get('webhookId') || undefined,
      deliveryId: searchParams.get('deliveryId') || undefined,
      status: searchParams.get('status') as 'success' | 'failed' || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: (searchParams.get('sortBy') as 'attempted_at' | 'response_time_ms' | 'attempt_number') || 'attempted_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      errorType: searchParams.get('errorType') || undefined
    };

    const offset = (query.page! - 1) * query.limit!;

    // Build the query
    let logsQuery = supabase
      .from('webhook_delivery_logs')
      .select(`
        *,
        webhook_deliveries!inner(
          webhook_id,
          webhooks!inner(
            name,
            user_id
          ),
          webhook_events(
            event_type
          )
        )
      `, { count: 'exact' })
      .eq('webhook_deliveries.webhooks.user_id', user.id)
      .range(offset, offset + query.limit! - 1)
      .order(query.sortBy!, { ascending: query.sortOrder === 'asc' });

    // Apply filters
    if (query.webhookId) {
      logsQuery = logsQuery.eq('webhook_deliveries.webhook_id', query.webhookId);
    }

    if (query.deliveryId) {
      logsQuery = logsQuery.eq('delivery_id', query.deliveryId);
    }

    if (query.status) {
      logsQuery = logsQuery.eq('is_success', query.status === 'success');
    }

    if (query.startDate) {
      logsQuery = logsQuery.gte('attempted_at', query.startDate);
    }

    if (query.endDate) {
      logsQuery = logsQuery.lte('attempted_at', query.endDate);
    }

    if (query.errorType) {
      logsQuery = logsQuery.eq('error_type', query.errorType);
    }

    const { data: logs, error: logsError, count } = await logsQuery;

    if (logsError) {
      throw new WebhookError(`Failed to fetch logs: ${logsError.message}`, 'QUERY_FAILED');
    }

    // Transform the data to include webhook and event information
    const transformedLogs = (logs || []).map((log: any) => ({
      id: log.id,
      deliveryId: log.delivery_id,
      attemptNumber: log.attempt_number,
      attemptedAt: log.attempted_at,
      requestUrl: log.request_url,
      requestMethod: log.request_method,
      requestHeaders: log.request_headers,
      requestBody: log.request_body,
      responseStatusCode: log.response_status_code,
      responseHeaders: log.response_headers,
      responseBody: log.response_body,
      responseTimeMs: log.response_time_ms,
      errorType: log.error_type,
      errorMessage: log.error_message,
      isSuccess: log.is_success,
      webhookName: log.webhook_deliveries?.webhooks?.name,
      eventType: log.webhook_deliveries?.webhook_events?.event_type
    }));

    // Calculate summary statistics
    const summary = await calculateLogsSummary(supabase, user.id, query);

    // Get filter options
    const filterOptions = await getFilterOptions(supabase, user.id);

    const response: WebhookLogResponse = {
      logs: transformedLogs,
      pagination: {
        page: query.page!,
        limit: query.limit!,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / query.limit!)
      },
      summary,
      filters: {
        applied: Object.fromEntries(
          Object.entries(query).filter(([_, value]) => value !== undefined)
        ),
        available: filterOptions
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching webhook logs:', error);

    if (error instanceof WebhookError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function calculateLogsSummary(
  supabase: any,
  userId: string,
  query: WebhookLogQuery
) {
  // Get summary statistics
  const { data: summaryData } = await supabase
    .from('webhook_delivery_logs')
    .select(`
      is_success,
      response_time_ms,
      error_type,
      webhook_deliveries!inner(
        webhook_id,
        webhooks!inner(
          user_id
        )
      )
    `)
    .eq('webhook_deliveries.webhooks.user_id', userId);

  if (!summaryData) {
    return {
      totalLogs: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      errorBreakdown: {}
    };
  }

  const totalLogs = summaryData.length;
  const successfulDeliveries = summaryData.filter((log: any) => log.is_success).length;
  const failedDeliveries = totalLogs - successfulDeliveries;
  
  // Calculate average response time
  const responseTimes = summaryData
    .filter((log: any) => log.response_time_ms && log.response_time_ms > 0)
    .map((log: any) => log.response_time_ms);
  const averageResponseTime = responseTimes.length > 0 
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // Calculate error breakdown
  const errorBreakdown: Record<string, number> = {};
  summaryData
    .filter((log: any) => !log.is_success && log.error_type)
    .forEach((log: any) => {
      errorBreakdown[log.error_type] = (errorBreakdown[log.error_type] || 0) + 1;
    });

  return {
    totalLogs,
    successfulDeliveries,
    failedDeliveries,
    averageResponseTime,
    errorBreakdown
  };
}

async function getFilterOptions(supabase: any, userId: string) {
  // Get available webhooks
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');

  // Get available error types
  const { data: errorTypes } = await supabase
    .from('webhook_delivery_logs')
    .select(`
      error_type,
      webhook_deliveries!inner(
        webhook_id,
        webhooks!inner(
          user_id
        )
      )
    `)
    .eq('webhook_deliveries.webhooks.user_id', userId)
    .not('error_type', 'is', null);

  const uniqueErrorTypes = Array.from(
    new Set((errorTypes || []).map((log: any) => log.error_type))
  ).filter(Boolean).sort();

  // Get date range
  const { data: dateRange } = await supabase
    .from('webhook_delivery_logs')
    .select(`
      attempted_at,
      webhook_deliveries!inner(
        webhook_id,
        webhooks!inner(
          user_id
        )
      )
    `)
    .eq('webhook_deliveries.webhooks.user_id', userId)
    .order('attempted_at', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('webhook_delivery_logs')
    .select(`
      attempted_at,
      webhook_deliveries!inner(
        webhook_id,
        webhooks!inner(
          user_id
        )
      )
    `)
    .eq('webhook_deliveries.webhooks.user_id', userId)
    .order('attempted_at', { ascending: false })
    .limit(1);

  return {
    webhooks: webhooks || [],
    errorTypes: uniqueErrorTypes,
    dateRange: {
      earliest: dateRange?.[0]?.attempted_at || new Date().toISOString(),
      latest: latestDate?.[0]?.attempted_at || new Date().toISOString()
    }
  };
}