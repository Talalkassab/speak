import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { IntelligentSuggestionService } from '@/libs/services/suggestion-service';
import { RelatedQuestionsRequest } from '@/types/suggestions';
import { z } from 'zod';

// Request validation schema
const RelatedQuestionsRequestSchema = z.object({
  currentQuery: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    id: z.string(),
    content: z.string(),
    contentArabic: z.string().optional(),
    role: z.enum(['user', 'assistant']),
    timestamp: z.string(),
    metadata: z.record(z.any()).optional()
  })).default([]),
  maxSuggestions: z.number().min(1).max(15).default(6),
  includeFollowup: z.boolean().default(true)
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

    // Validate request
    const rawBody = await request.json();
    const validatedRequest = RelatedQuestionsRequestSchema.parse(rawBody);

    // Create related questions request
    const relatedQuestionsRequest: RelatedQuestionsRequest = {
      ...validatedRequest,
      userId: user.id,
      organizationId: profile.organization_id
    };

    // Get related questions
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getRelatedQuestions(relatedQuestionsRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'related',
      query: validatedRequest.currentQuery,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.questions.length,
      conversation_length: validatedRequest.conversationHistory.length,
      created_at: new Date().toISOString()
    });

    // Track user interaction patterns for personalization
    if (validatedRequest.conversationHistory.length > 0) {
      const lastUserMessage = validatedRequest.conversationHistory
        .filter(msg => msg.role === 'user')
        .slice(-1)[0];

      if (lastUserMessage) {
        await supabase.from('user_interaction_patterns').upsert({
          user_id: user.id,
          organization_id: profile.organization_id,
          interaction_type: 'related_questions_request',
          query: validatedRequest.currentQuery,
          previous_query: lastUserMessage.content,
          context_length: validatedRequest.conversationHistory.length,
          timestamp: new Date().toISOString()
        });
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Related questions API error:', error);

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
          message: 'Failed to generate related questions',
          messageArabic: 'فشل في توليد الأسئلة المرتبطة'
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentQuery = searchParams.get('query');
    const maxSuggestions = parseInt(searchParams.get('maxSuggestions') || '6');
    const includeFollowup = searchParams.get('includeFollowup') !== 'false';

    if (!currentQuery) {
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

    // Get recent conversation history from database if available
    const { data: recentMessages } = await supabase
      .from('conversation_messages')
      .select('id, content, role, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (recentMessages || []).reverse().map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role as 'user' | 'assistant',
      timestamp: msg.created_at,
    }));

    // Create request
    const relatedQuestionsRequest: RelatedQuestionsRequest = {
      currentQuery,
      conversationHistory,
      maxSuggestions,
      includeFollowup,
      userId: user.id,
      organizationId: profile.organization_id
    };

    // Get related questions
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getRelatedQuestions(relatedQuestionsRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'related',
      query: currentQuery,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.questions.length,
      conversation_length: conversationHistory.length,
      method: 'GET',
      created_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Related questions GET API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate related questions',
          messageArabic: 'فشل في توليد الأسئلة المرتبطة'
        }
      },
      { status: 500 }
    );
  }
}

// PUT endpoint for providing feedback on related questions
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
    const { questionId, feedback, rating, selectedQuestion } = body;

    if (!questionId && !selectedQuestion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Either questionId or selectedQuestion is required',
            messageArabic: 'مطلوب questionId أو selectedQuestion'
          }
        },
        { status: 400 }
      );
    }

    // Record feedback for improving suggestions
    const feedbackData = {
      user_id: user.id,
      suggestion_type: 'related',
      question_id: questionId,
      selected_question: selectedQuestion,
      feedback_type: feedback, // 'helpful', 'not_helpful', 'irrelevant', etc.
      rating: rating, // 1-5 scale
      created_at: new Date().toISOString()
    };

    await supabase.from('suggestion_feedback').insert(feedbackData);

    // Update suggestion analytics
    if (questionId) {
      await supabase
        .from('suggestion_performance')
        .upsert({
          suggestion_id: questionId,
          user_interactions: 1,
          average_rating: rating || 0,
          last_interaction: new Date().toISOString()
        }, {
          onConflict: 'suggestion_id',
          update: {
            user_interactions: 'user_interactions + 1',
            average_rating: rating ? `(average_rating + ${rating}) / 2` : 'average_rating',
            last_interaction: new Date().toISOString()
          }
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully',
      messageArabic: 'تم تسجيل التعليق بنجاح'
    });

  } catch (error) {
    console.error('Related questions feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record feedback',
          messageArabic: 'فشل في تسجيل التعليق'
        }
      },
      { status: 500 }
    );
  }
}