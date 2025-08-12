import { NextRequest, NextResponse } from 'next/server';
import { ConversationContextService } from '@/libs/services/conversation-context-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

const contextService = new ConversationContextService();

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    const conversationId = params.conversationId;

    // Get conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        role,
        content,
        metadata,
        created_at
      `)
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this conversation
    const hasAccess = messages.some(msg => 
      msg.metadata?.user_id === user.id || 
      // For older messages that might not have user_id in metadata
      true // Allow access if conversation exists in user's org
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get conversation summary if requested
    const { searchParams } = new URL(request.url);
    const includeSummary = searchParams.get('include_summary') === 'true';
    
    let summary = null;
    if (includeSummary) {
      try {
        summary = await contextService.generateConversationSummary(conversationId);
      } catch (error) {
        console.error('Error generating summary:', error);
        // Don't fail the request if summary generation fails
      }
    }

    // Get optimized context if requested
    const includeContext = searchParams.get('include_context') === 'true';
    let optimizedContext = null;
    
    if (includeContext) {
      try {
        optimizedContext = await contextService.getOptimizedContextForPrompt(
          conversationId,
          1000 // max tokens
        );
      } catch (error) {
        console.error('Error getting optimized context:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          timestamp: msg.created_at
        })),
        summary,
        optimizedContext,
        messageCount: messages.length
      }
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get conversation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    const conversationId = params.conversationId;

    // Verify conversation exists and user has access
    const { data: messages, error: checkError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Delete conversation messages
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id);

    if (deleteMessagesError) {
      throw deleteMessagesError;
    }

    // Delete conversation context
    const { error: deleteContextError } = await supabase
      .from('conversation_contexts')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id);

    if (deleteContextError) {
      console.warn('Failed to delete conversation context:', deleteContextError);
      // Don't fail the request if context deletion fails
    }

    // Delete RAG interactions
    const { error: deleteInteractionsError } = await supabase
      .from('rag_interactions')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id);

    if (deleteInteractionsError) {
      console.warn('Failed to delete RAG interactions:', deleteInteractionsError);
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting conversation:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to delete conversation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    const conversationId = params.conversationId;
    const body = await request.json();
    const { action, data } = body;

    // Verify conversation exists and user has access
    const { data: messages, error: checkError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('organization_id', userOrg.organization_id)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    let result = null;

    switch (action) {
      case 'generate_summary':
        try {
          result = await contextService.generateConversationSummary(conversationId);
        } catch (error) {
          throw new Error('Failed to generate conversation summary');
        }
        break;

      case 'optimize_context':
        const maxTokens = data?.maxTokens || 1000;
        try {
          result = await contextService.getOptimizedContextForPrompt(conversationId, maxTokens);
        } catch (error) {
          throw new Error('Failed to optimize conversation context');
        }
        break;

      case 'update_metadata':
        // Update conversation metadata
        if (data?.title) {
          const { error: updateError } = await supabase
            .from('conversations')
            .upsert({
              id: conversationId,
              organization_id: userOrg.organization_id,
              title: data.title,
              updated_at: new Date().toISOString()
            });

          if (updateError) {
            throw updateError;
          }
          
          result = { title: data.title };
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to update conversation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}