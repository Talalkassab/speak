import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { IntelligentSuggestionService } from '@/libs/services/suggestion-service';
import { AutocompleteRequest } from '@/types/suggestions';
import { z } from 'zod';

// Request validation schema
const AutocompleteRequestSchema = z.object({
  query: z.string().min(1).max(500),
  language: z.enum(['ar', 'en', 'both']).default('both'),
  maxSuggestions: z.number().min(1).max(20).default(8),
  includePopular: z.boolean().default(true),
  includePersonalized: z.boolean().default(true),
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
      suggestionTypes: z.array(z.string()).default(['autocomplete', 'popular', 'contextual']),
      maxSuggestions: z.number().default(8),
      includeArabic: z.boolean().default(true),
      personalizationLevel: z.enum(['none', 'basic', 'advanced']).default('basic'),
      categories: z.array(z.string()).default([])
    }).default({})
  }).default({})
});

export async function POST(request: NextRequest) {
  try {
    // Get user and organization from authentication
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

    // Get user's organization
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

    // Parse and validate request body
    const rawBody = await request.json();
    const validatedRequest = AutocompleteRequestSchema.parse(rawBody);

    // Create the full autocomplete request
    const autocompleteRequest: AutocompleteRequest = {
      ...validatedRequest,
      userId: user.id,
      organizationId: profile.organization_id,
      context: {
        ...validatedRequest.context,
        userRole: profile.role,
        department: profile.department || '',
        userPreferences: {
          preferredLanguage: validatedRequest.language,
          suggestionTypes: ['autocomplete', 'popular', 'contextual'],
          maxSuggestions: validatedRequest.maxSuggestions,
          includeArabic: true,
          personalizationLevel: 'basic',
          categories: [],
          ...validatedRequest.context.userPreferences
        }
      }
    };

    // Initialize suggestion service and get autocomplete suggestions
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getAutocompleteSuggestions(autocompleteRequest);

    // Log the request for analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'autocomplete',
      query: validatedRequest.query,
      language: validatedRequest.language,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.suggestions.length,
      created_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Autocomplete API error:', error);

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
          message: 'Internal server error',
          messageArabic: 'خطأ داخلي في الخادم'
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const language = searchParams.get('language') || 'both';
    const maxSuggestions = parseInt(searchParams.get('maxSuggestions') || '8');

    if (!query) {
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

    // Get user authentication
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

    // Create autocomplete request from GET parameters
    const autocompleteRequest: AutocompleteRequest = {
      query,
      language: language as 'ar' | 'en' | 'both',
      maxSuggestions,
      userId: user.id,
      organizationId: profile.organization_id,
      includePopular: searchParams.get('includePopular') !== 'false',
      includePersonalized: searchParams.get('includePersonalized') !== 'false',
      context: {
        userRole: profile.role,
        department: profile.department || '',
        previousQueries: [],
        recentDocuments: [],
        activeFilters: {},
        sessionDuration: 0,
        userPreferences: {
          preferredLanguage: language as 'ar' | 'en' | 'both',
          suggestionTypes: ['autocomplete', 'popular', 'contextual'],
          maxSuggestions,
          includeArabic: true,
          personalizationLevel: 'basic',
          categories: []
        }
      }
    };

    // Get suggestions
    const suggestionService = new IntelligentSuggestionService();
    const result = await suggestionService.getAutocompleteSuggestions(autocompleteRequest);

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'autocomplete',
      query,
      language,
      response_time: result.metadata.processingTime,
      cache_hit: result.metadata.cacheHit,
      suggestions_count: result.data.suggestions.length,
      method: 'GET',
      created_at: new Date().toISOString()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Autocomplete GET API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          messageArabic: 'خطأ داخلي في الخادم'
        }
      },
      { status: 500 }
    );
  }
}