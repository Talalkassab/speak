import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { z } from 'zod';

// Request validation schema
const AnalyticsRequestSchema = z.object({
  timeRange: z.enum(['day', 'week', 'month', 'quarter']).default('week'),
  language: z.enum(['ar', 'en', 'both']).default('both'),
  organizationId: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required',
            messageArabic: 'مطلوب المصادقة' 
          } 
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'PROFILE_NOT_FOUND', 
            message: 'User profile not found',
            messageArabic: 'لم يتم العثور على الملف الشخصي للمستخدم' 
          } 
        },
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      timeRange: (searchParams.get('timeRange') || 'week') as 'day' | 'week' | 'month' | 'quarter',
      language: (searchParams.get('language') || 'both') as 'ar' | 'en' | 'both',
      organizationId: searchParams.get('organizationId') || profile.organization_id
    };

    const validatedParams = AnalyticsRequestSchema.parse(queryParams);

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;

    switch (validatedParams.timeRange) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    // Fetch analytics data from database
    const [
      overviewData,
      categoryPerformance,
      userEngagement,
      popularSuggestions,
      qualityMetrics,
      timeDistribution
    ] = await Promise.all([
      // Overview metrics
      supabase
        .from('suggestion_analytics')
        .select('*')
        .eq('organization_id', validatedParams.organizationId)
        .gte('created_at', startDate.toISOString()),

      // Category performance
      supabase
        .from('suggestion_analytics')
        .select('category, suggestion_type, response_time, cache_hit')
        .eq('organization_id', validatedParams.organizationId)
        .gte('created_at', startDate.toISOString())
        .not('category', 'is', null),

      // User engagement over time
      supabase
        .rpc('get_daily_suggestion_metrics', {
          org_id: validatedParams.organizationId,
          start_date: startDate.toISOString(),
          end_date: now.toISOString()
        }),

      // Popular suggestions
      supabase
        .from('popular_queries')
        .select('*')
        .eq('organization_id', validatedParams.organizationId)
        .order('frequency', { ascending: false })
        .limit(20),

      // Quality metrics
      supabase
        .from('query_quality_analytics')
        .select('*')
        .eq('organization_id', validatedParams.organizationId)
        .gte('created_at', startDate.toISOString()),

      // Time distribution
      supabase
        .rpc('get_hourly_suggestion_distribution', {
          org_id: validatedParams.organizationId,
          start_date: startDate.toISOString(),
          end_date: now.toISOString()
        })
    ]);

    // Process overview data
    const totalSuggestions = overviewData.data?.length || 0;
    const totalResponseTime = overviewData.data?.reduce((sum, item) => sum + (item.response_time || 0), 0) || 0;
    const averageResponseTime = totalSuggestions > 0 ? totalResponseTime / totalSuggestions : 0;
    const cacheHits = overviewData.data?.filter(item => item.cache_hit).length || 0;
    const cacheHitRate = totalSuggestions > 0 ? (cacheHits / totalSuggestions) * 100 : 0;

    // Process category performance
    const categoryStats = categoryPerformance.data?.reduce((acc, item) => {
      if (!item.category) return acc;
      
      if (!acc[item.category]) {
        acc[item.category] = {
          category: item.category,
          categoryArabic: getCategoryArabic(item.category),
          suggestionsCount: 0,
          totalResponseTime: 0,
          acceptanceRate: 0,
          averageRating: 0
        };
      }
      
      acc[item.category].suggestionsCount++;
      acc[item.category].totalResponseTime += item.response_time || 0;
      
      return acc;
    }, {} as any) || {};

    const categoryPerformanceArray = Object.values(categoryStats).map((cat: any) => ({
      ...cat,
      responseTime: cat.suggestionsCount > 0 ? cat.totalResponseTime / cat.suggestionsCount : 0,
      acceptanceRate: Math.random() * 30 + 70, // Mock data for demo
      averageRating: Math.random() * 2 + 3 // Mock data for demo
    }));

    // Mock user engagement data (in production, this would come from actual queries)
    const engagementData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      return {
        date: date.toISOString().split('T')[0],
        totalQueries: Math.floor(Math.random() * 100) + 50,
        refinedQueries: Math.floor(Math.random() * 30) + 10,
        templatesUsed: Math.floor(Math.random() * 20) + 5,
        relatedQuestionsClicked: Math.floor(Math.random() * 40) + 15
      };
    }).reverse();

    // Process popular suggestions
    const popularSuggestionsData = (popularSuggestions.data || []).map(item => ({
      text: item.text,
      textArabic: item.text_arabic || item.text,
      frequency: item.frequency,
      category: item.category,
      successRate: item.success_rate
    }));

    // Process quality metrics
    const qualityData = qualityMetrics.data || [];
    const avgClarity = qualityData.reduce((sum, item) => sum + item.clarity_score, 0) / qualityData.length || 0;
    const avgSpecificity = qualityData.reduce((sum, item) => sum + item.specificity_score, 0) / qualityData.length || 0;
    const avgCompleteness = qualityData.reduce((sum, item) => sum + item.completeness_score, 0) / qualityData.length || 0;

    const qualityMetricsData = [
      {
        metric: 'Query Clarity',
        metricArabic: 'وضوح الاستعلام',
        current: avgClarity,
        previous: avgClarity * 0.9,
        trend: avgClarity > avgClarity * 0.9 ? 'up' as const : 'down' as const
      },
      {
        metric: 'Specificity',
        metricArabic: 'التخصص',
        current: avgSpecificity,
        previous: avgSpecificity * 0.95,
        trend: avgSpecificity > avgSpecificity * 0.95 ? 'up' as const : 'stable' as const
      },
      {
        metric: 'Completeness',
        metricArabic: 'الاكتمال',
        current: avgCompleteness,
        previous: avgCompleteness * 1.1,
        trend: avgCompleteness < avgCompleteness * 1.1 ? 'down' as const : 'up' as const
      }
    ];

    // Generate mock time distribution
    const timeDistributionData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      queries: Math.floor(Math.random() * 50) + 10,
      success: Math.floor(Math.random() * 40) + 8
    }));

    const analyticsData = {
      overview: {
        totalSuggestions,
        acceptanceRate: 85.7, // Mock data
        averageResponseTime,
        userSatisfaction: 92.3, // Mock data
        topPerformingCategory: 'labor_law',
        improvementTrend: 12.5 // Mock data
      },
      categoryPerformance: categoryPerformanceArray,
      userEngagement: engagementData,
      popularSuggestions: popularSuggestionsData,
      qualityMetrics: qualityMetricsData,
      timeDistribution: timeDistributionData
    };

    return NextResponse.json({
      success: true,
      data: analyticsData,
      metadata: {
        timeRange: validatedParams.timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        organizationId: validatedParams.organizationId
      }
    });

  } catch (error) {
    console.error('Suggestion analytics API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            messageArabic: 'معاملات الطلب غير صالحة',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch suggestion analytics',
          messageArabic: 'فشل في جلب تحليلات الاقتراحات'
        }
      },
      { status: 500 }
    );
  }
}

function getCategoryArabic(category: string): string {
  const categoryLabels: Record<string, string> = {
    labor_law: 'قانون العمل',
    employment: 'التوظيف',
    compensation: 'التعويضات',
    benefits: 'المزايا',
    disciplinary: 'التأديب',
    termination: 'إنهاء الخدمة',
    compliance: 'الامتثال',
    contracts: 'العقود',
    policies: 'السياسات',
    training: 'التدريب',
    performance: 'الأداء',
    leaves: 'الإجازات',
    recruitment: 'التوظيف',
    general: 'عام'
  };

  return categoryLabels[category] || category;
}