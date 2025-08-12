import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { IntelligentSuggestionService } from '@/libs/services/suggestion-service';
import { PopularQueriesRequest, SuggestionCategory } from '@/types/suggestions';
import { z } from 'zod';

// Request validation schema
const PopularQueriesRequestSchema = z.object({
  department: z.string().optional(),
  timeframe: z.enum(['day', 'week', 'month', 'quarter']).default('week'),
  category: z.enum([
    'labor_law', 'employment', 'compensation', 'benefits', 'disciplinary',
    'termination', 'compliance', 'contracts', 'policies', 'training',
    'performance', 'leaves', 'recruitment', 'general'
  ]).optional(),
  language: z.enum(['ar', 'en', 'both']).default('both'),
  maxResults: z.number().min(1).max(50).default(20)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
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
      .select('organization_id, role, department')
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

    // Parse and validate request parameters
    const requestParams = {
      department: searchParams.get('department') || undefined,
      timeframe: (searchParams.get('timeframe') || 'week') as 'day' | 'week' | 'month' | 'quarter',
      category: searchParams.get('category') as SuggestionCategory | undefined,
      language: (searchParams.get('language') || 'both') as 'ar' | 'en' | 'both',
      maxResults: parseInt(searchParams.get('maxResults') || '20')
    };

    const validatedRequest = PopularQueriesRequestSchema.parse(requestParams);

    // Create popular queries request
    const popularQueriesRequest: PopularQueriesRequest = {
      ...validatedRequest,
      organizationId: profile.organization_id
    };

    // Get popular queries
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getPopularQueries(popularQueriesRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'popular',
      query: 'popular_queries_request',
      language: validatedRequest.language,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.queries.length,
      timeframe: validatedRequest.timeframe,
      department: validatedRequest.department,
      category: validatedRequest.category,
      method: 'GET',
      created_at: new Date().toISOString()
    });

    // Track usage for personalization
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      preference_type: 'popular_queries',
      preferences: {
        timeframe: validatedRequest.timeframe,
        category: validatedRequest.category,
        language: validatedRequest.language,
        department: validatedRequest.department
      },
      updated_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Popular queries API error:', error);

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
          message: 'Failed to fetch popular queries',
          messageArabic: 'فشل في جلب الاستعلامات الشائعة'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
      .select('organization_id, role, department')
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

    // Parse and validate request
    const rawBody = await request.json();
    const validatedRequest = PopularQueriesRequestSchema.parse(rawBody);

    // Create popular queries request
    const popularQueriesRequest: PopularQueriesRequest = {
      ...validatedRequest,
      organizationId: profile.organization_id
    };

    // Get popular queries with detailed analysis
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getPopularQueries(popularQueriesRequest);

    // Enhanced analytics for POST requests
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'popular',
      query: 'popular_queries_detailed_request',
      language: validatedRequest.language,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.queries.length,
      timeframe: validatedRequest.timeframe,
      department: validatedRequest.department,
      category: validatedRequest.category,
      trends_included: result.data.trends.length > 0,
      insights_included: Object.keys(result.data.insights).length > 0,
      method: 'POST',
      created_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Popular queries POST API error:', error);

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
          message: 'Failed to fetch popular queries',
          messageArabic: 'فشل في جلب الاستعلامات الشائعة'
        }
      },
      { status: 500 }
    );
  }
}

// PUT endpoint for updating query popularity (when users interact with suggestions)
export async function PUT(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { query, action, category, department } = body;

    if (!query || !action) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Query and action are required',
            messageArabic: 'الاستعلام والإجراء مطلوبان'
          }
        },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
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

    // Update query popularity based on action
    const popularityChange = action === 'selected' ? 1 : action === 'dismissed' ? -0.1 : 0;
    
    // Upsert popular query record
    const { error: upsertError } = await supabase
      .from('popular_queries')
      .upsert({
        organization_id: profile.organization_id,
        text: query,
        category: category || 'general',
        department: department || null,
        frequency: 1,
        unique_users: 1,
        last_used: new Date().toISOString(),
        trending: true,
        trend_direction: 'up',
        success_rate: action === 'selected' ? 100 : 50
      }, {
        onConflict: 'organization_id,text',
        update: {
          frequency: `frequency + ${action === 'selected' ? 1 : 0}`,
          last_used: new Date().toISOString(),
          success_rate: action === 'selected' 
            ? `LEAST(100, success_rate + 10)` 
            : `GREATEST(0, success_rate - 5)`
        }
      });

    if (upsertError) {
      console.error('Error updating popular query:', upsertError);
    }

    // Record user interaction
    await supabase.from('user_query_interactions').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      query,
      action,
      category: category || 'general',
      department: department || null,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Query popularity updated successfully',
      messageArabic: 'تم تحديث شعبية الاستعلام بنجاح'
    });

  } catch (error) {
    console.error('Popular queries update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update query popularity',
          messageArabic: 'فشل في تحديث شعبية الاستعلام'
        }
      },
      { status: 500 }
    );
  }
}