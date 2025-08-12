import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import { RAGQueryService, QueryContext, SourceAttribution } from '@/libs/services/rag-query-service';

// Request schema for streaming
const streamRequestSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  language: z.enum(['ar', 'en']).default('ar'),
  includeCompanyDocs: z.boolean().default(true),
  includeLaborLaw: z.boolean().default(true),
  maxSources: z.number().min(1).max(20).default(10)
});

interface StreamMessage {
  type: 'start' | 'content' | 'sources' | 'complete' | 'error';
  data?: string | SourceAttribution[] | { confidence: number; tokensUsed: number };
  error?: string;
  messageId?: string;
}

// Helper function to create SSE data
function createSSEData(message: StreamMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

// POST /api/v1/chat/stream - Stream AI responses in real-time
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits for queries
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'query');
    if (!usageCheck.allowed) {
      return new Response(
        createSSEData({
          type: 'error',
          error: `Query limit exceeded (${usageCheck.current}/${usageCheck.limit})`
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { 
      conversationId, 
      content, 
      language, 
      includeCompanyDocs, 
      includeLaborLaw, 
      maxSources 
    } = streamRequestSchema.parse(body);

    // Create readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send start event
          controller.enqueue(
            new TextEncoder().encode(
              createSSEData({ type: 'start', data: 'Processing your query...' })
            )
          );

          // Initialize RAG service
          const ragService = new RAGQueryService();
          const queryContext: QueryContext = {
            organizationId: userContext.organizationId,
            userId: userContext.userId,
            conversationId,
            language,
            includeCompanyDocs,
            includeLaborLaw,
            maxSources
          };

          // Process the query with streaming simulation
          // In a real implementation, you'd want the RAG service to support streaming
          const ragResponse = await ragService.processConversationalQuery(content, queryContext);

          // Stream the response in chunks
          const responseChunks = ragResponse.answer.match(/.{1,100}/g) || [ragResponse.answer];
          
          for (let i = 0; i < responseChunks.length; i++) {
            controller.enqueue(
              new TextEncoder().encode(
                createSSEData({ 
                  type: 'content', 
                  data: responseChunks[i] 
                })
              )
            );
            
            // Add small delay to simulate real streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send sources
          controller.enqueue(
            new TextEncoder().encode(
              createSSEData({ 
                type: 'sources', 
                data: ragResponse.sources 
              })
            )
          );

          // Send completion data
          controller.enqueue(
            new TextEncoder().encode(
              createSSEData({ 
                type: 'complete', 
                data: {
                  confidence: ragResponse.confidence,
                  tokensUsed: ragResponse.tokensUsed
                }
              })
            )
          );

          // Store messages in database
          const { createSupabaseServerClient } = await import('@/libs/supabase/supabase-server-client');
          const supabase = await createSupabaseServerClient();

          // Store user message
          const { data: userMessage } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              organization_id: userContext.organizationId,
              user_id: userContext.userId,
              role: 'user',
              content,
              language,
              metadata: { includeCompanyDocs, includeLaborLaw, streamed: true }
            })
            .select()
            .single();

          // Store AI response
          const { data: aiMessage } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              organization_id: userContext.organizationId,
              role: 'assistant',
              content: ragResponse.answer,
              language,
              sources: ragResponse.sources,
              metadata: {
                confidence: ragResponse.confidence,
                tokensUsed: ragResponse.tokensUsed,
                responseTimeMs: ragResponse.responseTimeMs,
                searchResults: ragResponse.searchResults,
                streamed: true
              }
            })
            .select()
            .single();

          // Update conversation
          await supabase
            .from('conversations')
            .update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);

          // Log activity
          await logUserActivity(
            userContext,
            'message_streamed',
            'message',
            userMessage?.id,
            { 
              conversationId, 
              messageLength: content.length,
              language,
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

          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          
          controller.enqueue(
            new TextEncoder().encode(
              createSSEData({
                type: 'error',
                error: 'An error occurred while processing your request'
              })
            )
          );
          
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Stream setup error:', error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof AuthError) {
      errorMessage = error.message;
      statusCode = error.statusCode;
    } else if (error instanceof z.ZodError) {
      errorMessage = 'Invalid request data';
      statusCode = 400;
    }

    return new Response(
      createSSEData({
        type: 'error',
        error: errorMessage
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}

// GET /api/v1/chat/stream - Health check for streaming endpoint
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'chat-stream',
      timestamp: new Date().toISOString(),
      capabilities: ['real-time-responses', 'source-attribution', 'multi-language']
    }),
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}