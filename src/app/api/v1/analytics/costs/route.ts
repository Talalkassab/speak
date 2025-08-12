import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { analytics } from '@/middleware/analytics';
import type { 
  CostMetrics, 
  AnalyticsResponse, 
  DailyCost,
  ModelCostBreakdown,
  CostTrend,
  BudgetUtilization
} from '@/types/analytics';

// Cost analytics request schema
const costAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  currency: z.enum(['USD', 'SAR']).default('USD'),
  breakdown: z.array(z.enum([
    'model', 'service', 'user', 'department', 'provider'
  ])).default(['model', 'service']),
  includeProjections: z.boolean().default(true),
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
  
  console.error('Cost Analytics API Error:', error);
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

// GET /api/v1/analytics/costs - Get cost analytics
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for cost analytics (admin/owner only)
    if (!hasRole(userContext, ['owner', 'admin'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to view cost analytics. Admin access required.',
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
      currency: searchParams.get('currency'),
      breakdown: searchParams.getAll('breakdown'),
      includeProjections: searchParams.get('includeProjections') === 'true',
      timezone: searchParams.get('timezone')
    };
    
    const validatedParams = costAnalyticsSchema.parse(queryParams);

    // Calculate date range
    const dateRange = calculateDateRange(validatedParams.period, validatedParams.startDate, validatedParams.endDate);
    const previousDateRange = calculatePreviousDateRange(dateRange);

    const supabase = await createSupabaseServerClient();

    // Get cost metrics for current period
    const currentCostMetrics = await getCostMetrics(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.currency
    );

    // Get previous period metrics for comparison
    const previousCostMetrics = await getCostMetrics(
      supabase,
      userContext.organizationId,
      previousDateRange.start,
      previousDateRange.end,
      validatedParams.currency
    );

    // Get daily cost breakdown
    const dailyCostBreakdown = await getDailyCostBreakdown(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.granularity,
      validatedParams.currency
    );

    // Get model cost breakdown
    const modelBreakdown = await getModelCostBreakdown(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.currency
    );

    // Get cost trends
    const costTrends = await getCostTrends(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.granularity,
      validatedParams.currency
    );

    // Get budget utilization
    const budgetUtilization = await getBudgetUtilization(
      supabase,
      userContext.organizationId,
      validatedParams.currency,
      validatedParams.includeProjections
    );

    // Calculate projections if requested
    let projectedMonthlyCost = 0;
    if (validatedParams.includeProjections) {
      projectedMonthlyCost = calculateProjectedMonthlyCost(dailyCostBreakdown);
    }

    const costMetrics: CostMetrics = {
      totalCost: currentCostMetrics.totalCost,
      monthlyCost: currentCostMetrics.monthlyCost,
      dailyCost: dailyCostBreakdown,
      modelBreakdown: modelBreakdown,
      costPerUser: currentCostMetrics.costPerUser,
      costPerMessage: currentCostMetrics.costPerMessage,
      costTrend: costTrends,
      budgetUtilization: budgetUtilization,
      projectedMonthlyCost: projectedMonthlyCost
    };

    const response: AnalyticsResponse<CostMetrics> = {
      data: costMetrics,
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
      eventName: 'cost_analytics_viewed',
      eventCategory: 'analytics',
      eventAction: 'view',
      eventLabel: validatedParams.period,
      properties: {
        dateRange: { start: dateRange.start, end: dateRange.end },
        period: validatedParams.period,
        currency: validatedParams.currency,
        breakdown: validatedParams.breakdown
      }
    });

    // Log activity
    await logUserActivity(
      userContext,
      'cost_analytics_viewed',
      'analytics',
      undefined,
      { 
        period: validatedParams.period,
        currency: validatedParams.currency,
        breakdown: validatedParams.breakdown
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

    console.error('Unexpected error getting cost analytics:', error);
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

async function getCostMetrics(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  currency: string
): Promise<{
  totalCost: number;
  monthlyCost: number;
  costPerUser: number;
  costPerMessage: number;
}> {
  // Get cost data from cost_tracking table
  const { data: costData } = await supabase
    .from('cost_tracking')
    .select('total_cost_usd, user_id, service_type')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get message count for cost per message calculation
  const { data: messageData } = await supabase
    .from('chat_interactions')
    .select('id, user_id')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const totalCost = costData?.reduce((sum, cost) => sum + (cost.total_cost_usd || 0), 0) || 0;
  const uniqueUsers = new Set(costData?.map(c => c.user_id).filter(Boolean)).size;
  const totalMessages = messageData?.length || 0;

  // Calculate monthly cost (extrapolate from current period)
  const periodDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
  const monthlyCost = periodDays > 0 ? (totalCost / periodDays) * 30 : totalCost;

  // Convert to requested currency (simplified - in production use real exchange rates)
  const conversionRate = currency === 'SAR' ? 3.75 : 1; // 1 USD ≈ 3.75 SAR
  
  return {
    totalCost: totalCost * conversionRate,
    monthlyCost: monthlyCost * conversionRate,
    costPerUser: uniqueUsers > 0 ? (totalCost * conversionRate) / uniqueUsers : 0,
    costPerMessage: totalMessages > 0 ? (totalCost * conversionRate) / totalMessages : 0
  };
}

async function getDailyCostBreakdown(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  granularity: string,
  currency: string
): Promise<DailyCost[]> {
  const { data: costData } = await supabase
    .from('cost_tracking')
    .select('created_at, total_cost_usd, tokens_input, tokens_output')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  const { data: messageData } = await supabase
    .from('chat_interactions')
    .select('created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  const dailyMap = new Map<string, DailyCost>();
  const conversionRate = currency === 'SAR' ? 3.75 : 1;

  // Initialize all dates in range
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);
  while (currentDate <= endDateTime) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dateKey, {
      date: dateKey,
      cost: 0,
      tokensUsed: 0,
      messagesProcessed: 0
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate cost data
  costData?.forEach(row => {
    const date = new Date(row.created_at).toISOString().split('T')[0];
    const daily = dailyMap.get(date);
    if (daily) {
      daily.cost += (row.total_cost_usd || 0) * conversionRate;
      daily.tokensUsed += (row.tokens_input || 0) + (row.tokens_output || 0);
    }
  });

  // Aggregate message data
  messageData?.forEach(row => {
    const date = new Date(row.created_at).toISOString().split('T')[0];
    const daily = dailyMap.get(date);
    if (daily) {
      daily.messagesProcessed++;
    }
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function getModelCostBreakdown(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  currency: string
): Promise<ModelCostBreakdown[]> {
  const { data: costData } = await supabase
    .from('cost_tracking')
    .select('model_name, provider, total_cost_usd, tokens_input, tokens_output')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: responseTimeData } = await supabase
    .from('chat_interactions')
    .select('model_name, response_time_ms')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const modelMap = new Map<string, any>();
  const conversionRate = currency === 'SAR' ? 3.75 : 1;

  // Aggregate cost data by model
  costData?.forEach(row => {
    const key = `${row.provider}:${row.model_name}`;
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        modelName: row.model_name,
        provider: row.provider,
        tokensUsed: 0,
        cost: 0,
        averageResponseTime: 0,
        responseCount: 0
      });
    }
    
    const model = modelMap.get(key);
    model.tokensUsed += (row.tokens_input || 0) + (row.tokens_output || 0);
    model.cost += (row.total_cost_usd || 0) * conversionRate;
  });

  // Add response time data
  responseTimeData?.forEach(row => {
    const key = `openrouter:${row.model_name}`; // Default provider
    const model = modelMap.get(key);
    if (model && row.response_time_ms) {
      model.averageResponseTime = (model.averageResponseTime * model.responseCount + row.response_time_ms) / (model.responseCount + 1);
      model.responseCount++;
    }
  });

  const totalCost = Array.from(modelMap.values()).reduce((sum, model) => sum + model.cost, 0);

  return Array.from(modelMap.values())
    .map(model => ({
      modelName: model.modelName,
      provider: model.provider,
      tokensUsed: model.tokensUsed,
      cost: model.cost,
      percentage: totalCost > 0 ? Math.round((model.cost / totalCost) * 100) : 0,
      averageResponseTime: Math.round(model.averageResponseTime)
    }))
    .sort((a, b) => b.cost - a.cost);
}

async function getCostTrends(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  granularity: string,
  currency: string
): Promise<CostTrend[]> {
  // For now, return simplified trend data
  const dailyCosts = await getDailyCostBreakdown(supabase, organizationId, startDate, endDate, granularity, currency);
  
  return dailyCosts.map((daily, index) => ({
    period: daily.date,
    cost: daily.cost,
    changePercentage: index > 0 ? 
      Math.round(((daily.cost - dailyCosts[index - 1].cost) / Math.max(dailyCosts[index - 1].cost, 0.01)) * 100) : 0,
    tokensUsed: daily.tokensUsed
  }));
}

async function getBudgetUtilization(
  supabase: any,
  organizationId: string,
  currency: string,
  includeProjections: boolean
): Promise<BudgetUtilization> {
  // Get organization's monthly budget (you'd need to add this to organization table)
  // For now, use a default budget
  const monthlyBudget = currency === 'SAR' ? 3750 : 1000; // Default monthly budget

  // Get current month's spending
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: monthlySpendData } = await supabase
    .from('cost_tracking')
    .select('total_cost_usd')
    .eq('organization_id', organizationId)
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString());

  const conversionRate = currency === 'SAR' ? 3.75 : 1;
  const currentSpend = (monthlySpendData?.reduce((sum, cost) => sum + (cost.total_cost_usd || 0), 0) || 0) * conversionRate;
  const utilizationPercentage = Math.round((currentSpend / monthlyBudget) * 100);
  const remainingBudget = Math.max(0, monthlyBudget - currentSpend);
  
  const daysInMonth = monthEnd.getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;
  
  // Project overage if spending continues at current rate
  const dailySpend = currentSpend / currentDay;
  const projectedMonthlySpend = dailySpend * daysInMonth;
  const projectedOverage = Math.max(0, projectedMonthlySpend - monthlyBudget);

  return {
    monthlyBudget,
    currentSpend,
    utilizationPercentage,
    remainingBudget,
    daysRemaining,
    projectedOverage
  };
}

function calculateProjectedMonthlyCost(dailyCosts: DailyCost[]): number {
  if (dailyCosts.length === 0) return 0;
  
  // Calculate average daily cost from recent data (last 7 days)
  const recentCosts = dailyCosts.slice(-7);
  const averageDailyCost = recentCosts.reduce((sum, day) => sum + day.cost, 0) / recentCosts.length;
  
  // Project for 30 days
  return averageDailyCost * 30;
}