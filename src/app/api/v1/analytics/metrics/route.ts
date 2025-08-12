import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { AnalyticsMetrics, AnalyticsResponse, AnalyticsFilter } from '@/types/analytics';
import { startOfDay, endOfDay, subDays, subMonths, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getUserSession } from '@/features/account/controllers/get-session';

export async function GET(request: NextRequest) {
  try {
    // Get user session and check authentication
    const session = await getUserSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const url = new URL(request.url);
    
    // Parse query parameters
    const startDate = url.searchParams.get('start') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = url.searchParams.get('end') || format(new Date(), 'yyyy-MM-dd');
    const departments = url.searchParams.get('departments')?.split(',') || [];
    const users = url.searchParams.get('users')?.split(',') || [];
    const period = url.searchParams.get('period') || 'day';

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to view analytics
    if (!['owner', 'admin', 'hr_manager'].includes(orgMember.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const orgId = orgMember.organization_id;

    // Get usage metrics
    const usageMetrics = await getUsageMetrics(supabase, orgId, startDate, endDate, period);
    
    // Get cost metrics (mock data for now - would integrate with OpenRouter billing)
    const costMetrics = await getCostMetrics(supabase, orgId, startDate, endDate);
    
    // Get performance metrics
    const performanceMetrics = await getPerformanceMetrics(supabase, orgId, startDate, endDate);
    
    // Get compliance metrics
    const complianceMetrics = await getComplianceMetrics(supabase, orgId);
    
    // Get activity metrics
    const activityMetrics = await getActivityMetrics(supabase, orgId, startDate, endDate);

    const analyticsData: AnalyticsMetrics = {
      usage: usageMetrics,
      cost: costMetrics,
      performance: performanceMetrics,
      compliance: complianceMetrics,
      activity: activityMetrics,
    };

    const response: AnalyticsResponse<AnalyticsMetrics> = {
      data: analyticsData,
      meta: {
        organizationId: orgId,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        timezone: 'Asia/Riyadh',
        generatedAt: new Date().toISOString(),
      },
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getUsageMetrics(supabase: any, orgId: string, startDate: string, endDate: string, period: string) {
  // Get basic usage statistics
  const { data: totalMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: totalDocuments } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: totalTemplates } = await supabase
    .from('template_generations')
    .select('id', { count: 'exact' })
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get daily usage breakdown
  const { data: dailyUsageData } = await supabase
    .rpc('get_daily_usage_stats', {
      org_id: orgId,
      start_date: startDate,
      end_date: endDate
    });

  // Get user activity distribution
  const { data: userActivity } = await supabase
    .rpc('get_user_activity_summary', {
      org_id: orgId,
      start_date: startDate,
      end_date: endDate
    });

  // Get peak usage hours
  const { data: peakUsage } = await supabase
    .rpc('get_peak_usage_hours', {
      org_id: orgId,
      start_date: startDate,
      end_date: endDate
    });

  return {
    totalMessages: totalMessages?.length || 0,
    totalDocuments: totalDocuments?.length || 0,
    totalTemplatesGenerated: totalTemplates?.length || 0,
    totalApiCalls: (totalMessages?.length || 0) + (totalDocuments?.length || 0) + (totalTemplates?.length || 0),
    dailyUsage: dailyUsageData || [],
    weeklyUsage: [], // TODO: Calculate weekly aggregates
    monthlyUsage: [], // TODO: Calculate monthly aggregates
    userActivityDistribution: userActivity || [],
    peakUsageHours: peakUsage || [],
  };
}

async function getCostMetrics(supabase: any, orgId: string, startDate: string, endDate: string) {
  // Get organization usage data
  const { data: usageData } = await supabase
    .from('organization_usage')
    .select('*')
    .eq('organization_id', orgId)
    .gte('period_start', startDate)
    .lte('period_end', endDate)
    .order('period_start', { ascending: true });

  // Calculate cost estimates based on token usage
  // These would be actual costs from OpenRouter API in production
  const totalTokens = usageData?.reduce((sum: number, record: any) => sum + (record.tokens_used || 0), 0) || 0;
  const estimatedCostPerToken = 0.000002; // $0.000002 per token (example rate)
  const totalCost = totalTokens * estimatedCostPerToken;

  // Mock model breakdown data
  const modelBreakdown = [
    {
      modelName: 'gpt-4-turbo-preview',
      provider: 'openai',
      tokensUsed: Math.floor(totalTokens * 0.6),
      cost: totalCost * 0.7,
      percentage: 70,
      averageResponseTime: 2.3,
    },
    {
      modelName: 'claude-3-sonnet-20240229',
      provider: 'anthropic',
      tokensUsed: Math.floor(totalTokens * 0.3),
      cost: totalCost * 0.25,
      percentage: 25,
      averageResponseTime: 1.8,
    },
    {
      modelName: 'gemini-pro',
      provider: 'google',
      tokensUsed: Math.floor(totalTokens * 0.1),
      cost: totalCost * 0.05,
      percentage: 5,
      averageResponseTime: 1.5,
    },
  ];

  const dailyCost = usageData?.map((record: any) => ({
    date: record.period_start,
    cost: (record.tokens_used || 0) * estimatedCostPerToken,
    tokensUsed: record.tokens_used || 0,
    messagesProcessed: record.messages_count || 0,
  })) || [];

  return {
    totalCost,
    monthlyCost: totalCost,
    dailyCost,
    modelBreakdown,
    costPerUser: totalCost / Math.max(1, 10), // Mock user count
    costPerMessage: totalCost / Math.max(1, usageData?.reduce((sum: number, record: any) => sum + (record.messages_count || 0), 0) || 1),
    costTrend: [], // TODO: Calculate cost trends
    budgetUtilization: {
      monthlyBudget: 1000,
      currentSpend: totalCost,
      utilizationPercentage: (totalCost / 1000) * 100,
      remainingBudget: Math.max(0, 1000 - totalCost),
      daysRemaining: Math.ceil((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
      projectedOverage: Math.max(0, totalCost - 1000),
    },
    projectedMonthlyCost: totalCost * 1.2, // 20% buffer for projection
  };
}

async function getPerformanceMetrics(supabase: any, orgId: string, startDate: string, endDate: string) {
  // Get performance data from user_activity_logs
  const { data: activityLogs } = await supabase
    .from('user_activity_logs')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Mock performance data - in production this would come from monitoring systems
  return {
    averageResponseTime: 1.2,
    p95ResponseTime: 2.8,
    p99ResponseTime: 4.2,
    errorRate: 0.02,
    uptime: 99.9,
    throughput: 150,
    responseTimeDistribution: [
      { range: '0-500ms', count: 1250, percentage: 62.5 },
      { range: '500-1000ms', count: 450, percentage: 22.5 },
      { range: '1000-2000ms', count: 200, percentage: 10 },
      { range: '2000-5000ms', count: 80, percentage: 4 },
      { range: '5000ms+', count: 20, percentage: 1 },
    ],
    errorBreakdown: [
      { errorType: 'Rate Limit', count: 15, percentage: 50, lastOccurrence: new Date().toISOString() },
      { errorType: 'Timeout', count: 10, percentage: 33.3, lastOccurrence: new Date().toISOString() },
      { errorType: 'API Error', count: 5, percentage: 16.7, lastOccurrence: new Date().toISOString() },
    ],
    systemHealth: {
      status: 'healthy' as const,
      cpuUsage: 45,
      memoryUsage: 62,
      diskUsage: 28,
      activeConnections: 125,
      queueDepth: 3,
    },
  };
}

async function getComplianceMetrics(supabase: any, orgId: string) {
  // Get latest compliance scan
  const { data: latestScan } = await supabase
    .from('compliance_scans')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get compliance issues
  const { data: complianceIssues } = await supabase
    .rpc('get_compliance_issues', { org_id: orgId });

  return {
    overallScore: latestScan?.overall_score || 85,
    categoryScores: [
      {
        category: 'employment',
        categoryArabic: 'عقود العمل',
        score: 90,
        maxScore: 100,
        percentage: 90,
        status: 'compliant' as const,
        issuesCount: 1,
      },
      {
        category: 'hr_policies',
        categoryArabic: 'سياسات الموارد البشرية',
        score: 80,
        maxScore: 100,
        percentage: 80,
        status: 'warning' as const,
        issuesCount: 3,
      },
      {
        category: 'compliance',
        categoryArabic: 'الامتثال القانوني',
        score: 85,
        maxScore: 100,
        percentage: 85,
        status: 'compliant' as const,
        issuesCount: 2,
      },
    ],
    riskLevel: latestScan?.risk_level || 'medium' as const,
    issuesFound: complianceIssues || [],
    complianceTrend: [], // TODO: Get historical compliance data
    auditTrail: [], // TODO: Get audit entries
    lastScanDate: latestScan?.created_at || new Date().toISOString(),
    nextScheduledScan: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function getActivityMetrics(supabase: any, orgId: string, startDate: string, endDate: string) {
  // Get organization members
  const { data: totalUsers } = await supabase
    .from('organization_members')
    .select('user_id', { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('is_active', true);

  // Get active users in date range
  const { data: activeUsers } = await supabase
    .from('user_activity_logs')
    .select('user_id')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id) || []).size;

  // Get department activity
  const { data: departmentActivity } = await supabase
    .rpc('get_department_activity', {
      org_id: orgId,
      start_date: startDate,
      end_date: endDate
    });

  return {
    totalUsers: totalUsers?.length || 0,
    activeUsers: uniqueActiveUsers,
    newUsers: 0, // TODO: Calculate new users in period
    userEngagement: {
      dailyActiveUsers: Math.floor(uniqueActiveUsers * 0.7),
      weeklyActiveUsers: Math.floor(uniqueActiveUsers * 0.9),
      monthlyActiveUsers: uniqueActiveUsers,
      averageSessionDuration: 25.5,
      averageActionsPerSession: 8.2,
      retentionRate: 78.5,
    },
    departmentActivity: departmentActivity || [],
    timelineActivity: [], // TODO: Get timeline data
    topFeatures: [
      {
        featureName: 'Chat Interface',
        featureNameArabic: 'واجهة المحادثة',
        usageCount: 1250,
        uniqueUsers: uniqueActiveUsers,
        adoptionRate: 95,
        trend: 'up' as const,
      },
      {
        featureName: 'Document Processing',
        featureNameArabic: 'معالجة المستندات',
        usageCount: 890,
        uniqueUsers: Math.floor(uniqueActiveUsers * 0.8),
        adoptionRate: 80,
        trend: 'up' as const,
      },
      {
        featureName: 'Template Generation',
        featureNameArabic: 'إنتاج القوالب',
        usageCount: 450,
        uniqueUsers: Math.floor(uniqueActiveUsers * 0.6),
        adoptionRate: 60,
        trend: 'stable' as const,
      },
    ],
  };
}