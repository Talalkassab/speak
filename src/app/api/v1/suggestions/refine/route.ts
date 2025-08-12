import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { IntelligentSuggestionService } from '@/libs/services/suggestion-service';
import { QueryRefinementRequest } from '@/types/suggestions';
import { z } from 'zod';

// Request validation schema
const QueryRefinementRequestSchema = z.object({
  originalQuery: z.string().min(1).max(1000),
  includeTranslation: z.boolean().default(true),
  context: z.object({
    currentPage: z.string().optional(),
    conversationId: z.string().optional(),
    previousQueries: z.array(z.string()).default([]),
    userRole: z.string().default('user'),
    department: z.string().default(''),
    recentDocuments: z.array(z.string()).default([]),
    activeFilters: z.record(z.any()).default({}),
    sessionDuration: z.number().default(0),
    userPreferences: z.object({
      preferredLanguage: z.enum(['ar', 'en', 'both']).default('both'),
      suggestionTypes: z.array(z.string()).default([]),
      maxSuggestions: z.number().default(5),
      includeArabic: z.boolean().default(true),
      personalizationLevel: z.enum(['none', 'basic', 'advanced']).default('basic'),
      categories: z.array(z.string()).default([])
    }).default({})
  }).default({})
});

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
    const validatedRequest = QueryRefinementRequestSchema.parse(rawBody);

    // Create refinement request
    const refinementRequest: QueryRefinementRequest = {
      ...validatedRequest,
      userId: user.id,
      organizationId: profile.organization_id,
      context: {
        ...validatedRequest.context,
        userRole: profile.role,
        department: profile.department || validatedRequest.context.department
      }
    };

    // Get query refinements
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.refineQuery(refinementRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'refinement',
      query: validatedRequest.originalQuery,
      language: validatedRequest.context.userPreferences?.preferredLanguage || 'both',
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.refinements.length,
      original_query_quality: result.data.originalAnalysis.clarity,
      created_at: new Date().toISOString()
    });

    // Track refinement patterns for improvement
    if (result.success && result.data.originalAnalysis) {
      const analysis = result.data.originalAnalysis;
      await supabase.from('query_quality_analytics').insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        original_query: validatedRequest.originalQuery,
        clarity_score: analysis.clarity,
        specificity_score: analysis.specificity,
        completeness_score: analysis.completeness,
        grammar_score: analysis.grammarScore,
        terminology_accuracy: analysis.terminologyAccuracy,
        detected_language: analysis.detectedLanguage,
        complexity: analysis.complexity,
        issues_found: analysis.issues.length,
        refinements_generated: result.data.refinements.length,
        created_at: new Date().toISOString()
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Query refinement API error:', error);

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
          message: 'Failed to refine query',
          messageArabic: 'فشل في تحسين الاستعلام'
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const originalQuery = searchParams.get('query');
    const includeTranslation = searchParams.get('includeTranslation') !== 'false';

    if (!originalQuery) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUERY',
            message: 'Query parameter is required',
            messageArabic: 'معامل الاستعلام مطلوب'
          }
        },
        { status: 400 }
      );
    }

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, department')
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

    // Create refinement request from GET parameters
    const refinementRequest: QueryRefinementRequest = {
      originalQuery,
      includeTranslation,
      userId: user.id,
      organizationId: profile.organization_id,
      context: {
        userRole: profile.role,
        department: profile.department || '',
        previousQueries: [],
        recentDocuments: [],
        activeFilters: {},
        sessionDuration: 0,
        userPreferences: {
          preferredLanguage: 'both',
          suggestionTypes: ['refinement'],
          maxSuggestions: 5,
          includeArabic: true,
          personalizationLevel: 'basic',
          categories: []
        }
      }
    };

    // Get refinements
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.refineQuery(refinementRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'refinement',
      query: originalQuery,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.success ? result.data.refinements.length : 0,
      method: 'GET',
      created_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Query refinement GET API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to refine query',
          messageArabic: 'فشل في تحسين الاستعلام'
        }
      },
      { status: 500 }
    );
  }
}

// PUT endpoint for feedback on refinement suggestions
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
    const { 
      originalQuery, 
      selectedRefinement, 
      feedback, 
      improvementType,
      helpfulness,
      appliedRefinement 
    } = body;

    if (!originalQuery) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Original query is required',
            messageArabic: 'الاستعلام الأصلي مطلوب'
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

    // Record refinement feedback
    const feedbackData = {
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'refinement',
      original_query: originalQuery,
      selected_refinement: selectedRefinement,
      feedback_type: feedback,
      improvement_type: improvementType,
      helpfulness_rating: helpfulness,
      applied_refinement: appliedRefinement || false,
      created_at: new Date().toISOString()
    };

    await supabase.from('suggestion_feedback').insert(feedbackData);

    // Update refinement analytics
    if (selectedRefinement) {
      await supabase.from('refinement_performance').upsert({
        original_query: originalQuery,
        refined_query: selectedRefinement,
        improvement_type: improvementType || 'general',
        selection_count: 1,
        average_helpfulness: helpfulness || 0,
        last_selected: new Date().toISOString()
      }, {
        onConflict: 'original_query,refined_query',
        update: {
          selection_count: 'selection_count + 1',
          average_helpfulness: helpfulness 
            ? `(average_helpfulness + ${helpfulness}) / 2` 
            : 'average_helpfulness',
          last_selected: new Date().toISOString()
        }
      });
    }

    // Track learning patterns for AI improvement
    await supabase.from('ai_learning_feedback').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      feature_type: 'query_refinement',
      input_data: { originalQuery },
      output_data: { selectedRefinement, improvementType },
      user_satisfaction: helpfulness,
      applied_suggestion: appliedRefinement,
      feedback_text: feedback,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Refinement feedback recorded successfully',
      messageArabic: 'تم تسجيل تعليقات التحسين بنجاح'
    });

  } catch (error) {
    console.error('Refinement feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record refinement feedback',
          messageArabic: 'فشل في تسجيل تعليقات التحسين'
        }
      },
      { status: 500 }
    );
  }
}