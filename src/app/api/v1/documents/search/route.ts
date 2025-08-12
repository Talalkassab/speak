import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import { VectorSearchService, SearchOptions } from '@/libs/services/vector-search-service';

// Search request schema
const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  language: z.enum(['ar', 'en']).default('ar'),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  limit: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.75),
  includeContent: z.boolean().default(false),
  sortBy: z.enum(['relevance', 'date', 'title']).default('relevance')
});

// Search response interfaces
interface SearchResult {
  id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  content_preview: string;
  relevance_score: number;
  document_metadata: {
    category: string;
    language: string;
    tags: string[];
    uploaded_by: string;
    created_at: string;
  };
  highlight?: {
    content: string;
    positions: Array<{ start: number; end: number }>;
  };
}

interface SearchResponse {
  results: SearchResult[];
  total_count: number;
  query_metadata: {
    query: string;
    language: string;
    processing_time_ms: number;
    filters_applied: {
      categories?: string[];
      tags?: string[];
      documentIds?: string[];
    };
  };
  suggestions?: string[];
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

// POST /api/v1/documents/search - Advanced document search
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'query');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `Query limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const {
      query,
      language,
      categories,
      tags,
      documentIds,
      limit,
      threshold,
      includeContent,
      sortBy
    } = searchRequestSchema.parse(body);

    // Initialize vector search service
    const vectorSearch = new VectorSearchService();
    
    // Build search options
    const searchOptions: SearchOptions = {
      query,
      organizationId: userContext.organizationId,
      language,
      categories,
      tags,
      documentIds,
      limit,
      threshold,
      includeLabourLaw: false // Document search only
    };

    // Perform vector search
    const searchResults = await vectorSearch.hybridSearch(searchOptions);
    
    // Format results with highlighting
    const formattedResults: SearchResult[] = searchResults.documentResults.map(result => {
      const contentPreview = result.chunkText.length > 200 
        ? result.chunkText.substring(0, 200) + '...'
        : result.chunkText;
      
      // Simple text highlighting (in production, use more sophisticated highlighting)
      const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      const highlightedContent = highlightText(result.chunkText, queryTerms);

      return {
        id: result.id,
        document_id: result.documentId,
        document_name: result.documentTitle,
        chunk_index: result.chunkIndex,
        content: includeContent ? result.chunkText : '',
        content_preview: contentPreview,
        relevance_score: result.relevanceScore,
        document_metadata: {
          category: result.category,
          language: result.language,
          tags: result.tags || [],
          uploaded_by: result.uploadedBy,
          created_at: result.createdAt
        },
        highlight: highlightedContent
      };
    });

    // Sort results if needed
    if (sortBy === 'date') {
      formattedResults.sort((a, b) => 
        new Date(b.document_metadata.created_at).getTime() - 
        new Date(a.document_metadata.created_at).getTime()
      );
    } else if (sortBy === 'title') {
      formattedResults.sort((a, b) => 
        a.document_name.localeCompare(b.document_name)
      );
    }
    // 'relevance' is already sorted by vector search

    const processingTime = Date.now() - startTime;

    // Generate search suggestions (simple implementation)
    const suggestions = await generateSearchSuggestions(
      query, 
      userContext.organizationId, 
      language
    );

    const response: SearchResponse = {
      results: formattedResults,
      total_count: formattedResults.length,
      query_metadata: {
        query,
        language,
        processing_time_ms: processingTime,
        filters_applied: {
          categories,
          tags,
          documentIds
        }
      },
      suggestions
    };

    // Log search activity
    await logUserActivity(
      userContext,
      'documents_searched',
      'search',
      undefined,
      { 
        query,
        language,
        filters: { categories, tags, documentIds },
        resultCount: formattedResults.length,
        processingTimeMs: processingTime
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      messages_count: 1, // Count as query
      api_calls: 1 
    });

    return createSuccessResponse(response);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid search parameters', 400, error.errors);
    }

    console.error('Unexpected error in document search:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// GET /api/v1/documents/search/suggestions - Get search suggestions
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const language = (searchParams.get('language') as 'ar' | 'en') || 'ar';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return createSuccessResponse([]);
    }

    const suggestions = await generateSearchSuggestions(
      query, 
      userContext.organizationId, 
      language,
      limit
    );

    // Log activity
    await logUserActivity(
      userContext,
      'search_suggestions_requested',
      'search',
      undefined,
      { query, language, suggestionCount: suggestions.length },
      request
    );

    return createSuccessResponse(suggestions);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error getting search suggestions:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to highlight text
function highlightText(text: string, terms: string[]): {
  content: string;
  positions: Array<{ start: number; end: number }>;
} {
  const positions: Array<{ start: number; end: number }> = [];
  let highlightedContent = text;
  
  terms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }
  });
  
  // Sort positions by start index
  positions.sort((a, b) => a.start - b.start);
  
  // Merge overlapping positions
  const mergedPositions: Array<{ start: number; end: number }> = [];
  positions.forEach(pos => {
    if (mergedPositions.length === 0 || 
        pos.start > mergedPositions[mergedPositions.length - 1].end) {
      mergedPositions.push(pos);
    } else {
      mergedPositions[mergedPositions.length - 1].end = Math.max(
        mergedPositions[mergedPositions.length - 1].end,
        pos.end
      );
    }
  });

  return {
    content: highlightedContent,
    positions: mergedPositions
  };
}

// Helper function to generate search suggestions
async function generateSearchSuggestions(
  query: string, 
  organizationId: string, 
  language: 'ar' | 'en',
  limit: number = 10
): Promise<string[]> {
  try {
    const { createSupabaseServerClient } = await import('@/libs/supabase/supabase-server-client');
    const supabase = await createSupabaseServerClient();

    // Get recent popular queries
    const { data: recentQueries } = await supabase
      .from('rag_queries')
      .select('query')
      .eq('organization_id', organizationId)
      .eq('language', language)
      .ilike('query', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    const suggestions = recentQueries?.map(q => q.query) || [];
    
    // Add some predefined suggestions based on language
    const predefinedSuggestions = {
      ar: [
        'ما هي سياسة الإجازات؟',
        'كيف يتم احتساب مكافأة نهاية الخدمة؟',
        'إجراءات إنهاء عقد العمل',
        'ساعات العمل المسموحة',
        'حقوق الموظف في فترة التجربة'
      ],
      en: [
        'What is the leave policy?',
        'How is end of service gratuity calculated?',
        'Employment termination procedures',
        'Allowed working hours',
        'Employee rights during probation'
      ]
    };

    // Filter predefined suggestions that match the query
    const matchingPredefined = predefinedSuggestions[language].filter(
      suggestion => suggestion.toLowerCase().includes(query.toLowerCase())
    );

    // Combine and deduplicate
    const combinedSuggestions = [...new Set([...suggestions, ...matchingPredefined])];
    
    return combinedSuggestions.slice(0, limit);

  } catch (error) {
    console.error('Error generating search suggestions:', error);
    return [];
  }
}