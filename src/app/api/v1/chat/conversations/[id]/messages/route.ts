import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { RAGQueryService, QueryContext } from '@/libs/services/rag-query-service';

// Request schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  language: z.enum(['ar', 'en']).optional(),
  includeCompanyDocs: z.boolean().default(true),
  includeLaborLaw: z.boolean().default(true),
  maxSources: z.number().min(1).max(20).default(10),
  context: z.array(z.string()).optional().default([])
});

const getMessagesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  role: z.enum(['user', 'assistant']).optional()
});

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  language: 'ar' | 'en';
  sources?: any[];
  metadata?: Record<string, any>;
  created_at: string;
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

// Verify conversation access
async function verifyConversationAccess(
  conversationId: string, 
  organizationId: string, 
  userId: string
): Promise<{ exists: boolean; conversation?: any }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .single();

  if (error || !conversation) {
    return { exists: false };
  }

  return { exists: true, conversation };
}

// POST /api/v1/chat/conversations/[id]/messages - Send message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits for queries
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'query');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `Query limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Verify conversation access
    const { exists, conversation } = await verifyConversationAccess(
      conversationId, 
      userContext.organizationId, 
      userContext.userId
    );
    
    if (!exists || !conversation) {
      return createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Parse and validate request body
    const body = await request.json();
    const { 
      content, 
      language, 
      includeCompanyDocs, 
      includeLaborLaw, 
      maxSources,
      context 
    } = sendMessageSchema.parse(body);

    const messageLanguage = language || conversation.language;
    const supabase = await createSupabaseServerClient();

    // Store user message
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: userContext.organizationId,
        user_id: userContext.userId,
        role: 'user',
        content,
        language: messageLanguage,
        metadata: { context, includeCompanyDocs, includeLaborLaw }
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('Error storing user message:', userMessageError);
      return createErrorResponse('DB_ERROR', 'Failed to store message', 500);
    }

    // Process RAG query
    const ragService = new RAGQueryService();
    const queryContext: QueryContext = {
      organizationId: userContext.organizationId,
      userId: userContext.userId,
      conversationId,
      language: messageLanguage,
      includeCompanyDocs,
      includeLaborLaw,
      maxSources
    };

    const ragResponse = await ragService.processConversationalQuery(content, queryContext);

    // Store AI response
    const { data: aiMessage, error: aiMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        organization_id: userContext.organizationId,
        role: 'assistant',
        content: ragResponse.answer,
        language: messageLanguage,
        sources: ragResponse.sources,
        metadata: {
          confidence: ragResponse.confidence,
          tokensUsed: ragResponse.tokensUsed,
          responseTimeMs: ragResponse.responseTimeMs,
          searchResults: ragResponse.searchResults
        }
      })
      .select()
      .single();

    if (aiMessageError) {
      console.error('Error storing AI message:', aiMessageError);
      return createErrorResponse('DB_ERROR', 'Failed to store AI response', 500);
    }

    // Update conversation metadata
    await supabase
      .from('conversations')
      .update({
        message_count: conversation.message_count + 2,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    // Log activity
    await logUserActivity(
      userContext,
      'message_sent',
      'message',
      userMessage.id,
      { 
        conversationId, 
        messageLength: content.length,
        language: messageLanguage,
        ragMetrics: {
          confidence: ragResponse.confidence,
          tokensUsed: ragResponse.tokensUsed,
          responseTimeMs: ragResponse.responseTimeMs,
          sourcesFound: ragResponse.sources.length
        }
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      messages_count: 2, 
      tokens_used: ragResponse.tokensUsed,
      api_calls: 1 
    });

    // Return both messages
    const response = {
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        language: userMessage.language,
        created_at: userMessage.created_at
      },
      aiMessage: {
        id: aiMessage.id,
        role: aiMessage.role,
        content: aiMessage.content,
        language: aiMessage.language,
        sources: ragResponse.sources,
        confidence: ragResponse.confidence,
        responseTimeMs: ragResponse.responseTimeMs,
        created_at: aiMessage.created_at
      }
    };

    return createSuccessResponse(response, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error sending message:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// GET /api/v1/chat/conversations/[id]/messages - Get conversation messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    
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

    // Verify conversation access
    const { exists } = await verifyConversationAccess(
      conversationId, 
      userContext.organizationId, 
      userContext.userId
    );
    
    if (!exists) {
      return createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      role: searchParams.get('role')
    };
    
    const { page, limit, role } = getMessagesSchema.parse(queryParams);

    const supabase = await createSupabaseServerClient();
    
    // Build query
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('organization_id', userContext.organizationId)
      .order('created_at', { ascending: true });

    // Apply role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: messages, error } = await query;

    if (error) {
      console.error('Database error fetching messages:', error);
      return createErrorResponse('DB_ERROR', 'Failed to fetch messages', 500);
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('organization_id', userContext.organizationId);

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    const paginationMetadata = {
      page,
      limit,
      totalCount: totalCount || 0,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };

    // Format messages
    const formattedMessages: Message[] = messages?.map(msg => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      language: msg.language,
      sources: msg.sources || [],
      metadata: msg.metadata || {},
      created_at: msg.created_at
    })) || [];

    // Log activity
    await logUserActivity(
      userContext,
      'messages_retrieved',
      'message',
      conversationId,
      { count: formattedMessages.length, role },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(
      formattedMessages,
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

    console.error('Unexpected error retrieving messages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}