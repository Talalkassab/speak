import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Request/Response schemas
const createConversationSchema = z.object({
  title: z.string().optional(),
  language: z.enum(['ar', 'en']).default('ar'),
  metadata: z.record(z.any()).optional().default({})
});

const listConversationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  language: z.enum(['ar', 'en']).optional()
});

interface Conversation {
  id: string;
  title: string;
  language: 'ar' | 'en';
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

interface ConversationWithMessages extends Conversation {
  recent_messages?: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }[];
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

// POST /api/v1/chat/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
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

    // Parse and validate request body
    const body = await request.json();
    const { title, language, metadata } = createConversationSchema.parse(body);

    // Create conversation in database
    const supabase = await createSupabaseServerClient();
    
    const conversationData = {
      organization_id: userContext.organizationId,
      user_id: userContext.userId,
      title: title || (language === 'ar' ? 'محادثة جديدة' : 'New Conversation'),
      language,
      metadata,
      status: 'active'
    };

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error('Database error creating conversation:', error);
      return createErrorResponse('DB_ERROR', 'Failed to create conversation', 500);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'conversation_created',
      'conversation',
      conversation.id,
      { language, title },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(conversation, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error creating conversation:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// GET /api/v1/chat/conversations - List conversations
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
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
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      language: searchParams.get('language')
    };
    
    const { page, limit, search, language } = listConversationsSchema.parse(queryParams);

    const supabase = await createSupabaseServerClient();
    
    // Build query
    let query = supabase
      .from('conversations')
      .select(`
        id,
        title,
        language,
        message_count,
        last_message_at,
        created_at,
        updated_at,
        metadata,
        messages:messages(
          id,
          role,
          content,
          created_at
        )
      `)
      .eq('organization_id', userContext.organizationId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    
    if (language) {
      query = query.eq('language', language);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: conversations, error, count } = await query;

    if (error) {
      console.error('Database error fetching conversations:', error);
      return createErrorResponse('DB_ERROR', 'Failed to fetch conversations', 500);
    }

    // Format response with recent messages
    const formattedConversations: ConversationWithMessages[] = conversations?.map(conv => ({
      id: conv.id,
      title: conv.title,
      language: conv.language,
      message_count: conv.message_count || 0,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      metadata: conv.metadata || {},
      recent_messages: conv.messages?.slice(-2).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
        created_at: msg.created_at
      }))
    })) || [];

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userContext.organizationId)
      .eq('status', 'active');

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    const paginationMetadata = {
      page,
      limit,
      totalCount: totalCount || 0,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };

    // Log activity
    await logUserActivity(
      userContext,
      'conversations_listed',
      'conversation',
      undefined,
      { search, language, count: formattedConversations.length },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(
      formattedConversations,
      200,
      paginationMetadata
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error listing conversations:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}