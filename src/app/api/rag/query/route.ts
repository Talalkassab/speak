import { NextRequest, NextResponse } from 'next/server';
import { RAGOrchestratorService, RAGQueryRequest } from '@/libs/services/rag-orchestrator-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

const ragService = new RAGOrchestratorService();

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { query, conversationId, language, preferences, context } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Build RAG request
    const ragRequest: RAGQueryRequest = {
      query: query.trim(),
      organizationId: userOrg.organization_id,
      userId: user.id,
      conversationId,
      language: language || undefined,
      preferences: {
        responseStyle: preferences?.responseStyle || 'balanced',
        includeCompanyDocs: preferences?.includeCompanyDocs ?? true,
        includeLaborLaw: preferences?.includeLaborLaw ?? true,
        maxSources: Math.min(preferences?.maxSources || 10, 20),
        confidenceThreshold: Math.max(Math.min(preferences?.confidenceThreshold || 0.75, 1.0), 0.1),
        cacheResults: preferences?.cacheResults ?? true,
        optimizeForSpeed: preferences?.optimizeForSpeed ?? false
      },
      context: {
        userRole: context?.userRole,
        department: context?.department,
        accessLevel: context?.accessLevel || 'basic',
        sessionMetadata: context?.sessionMetadata,
        previousQueries: context?.previousQueries
      }
    };

    // Process RAG query
    const response = await ragService.processRAGQuery(ragRequest);

    // Store message in database
    await supabase.from('messages').insert([
      {
        id: crypto.randomUUID(),
        conversation_id: response.conversationId,
        organization_id: userOrg.organization_id,
        user_id: user.id,
        role: 'user',
        content: query,
        created_at: new Date().toISOString()
      },
      {
        id: response.messageId,
        conversation_id: response.conversationId,
        organization_id: userOrg.organization_id,
        user_id: user.id,
        role: 'assistant',
        content: response.answer,
        metadata: {
          confidence: response.confidence,
          sources: response.sources,
          processingTime: response.processingTime,
          tokensUsed: response.tokensUsed,
          cost: response.cost,
          qualityScore: response.qualityScore,
          cached: response.cached,
          model: response.model
        },
        created_at: response.timestamp
      }
    ]);

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('RAG query error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check endpoint
    const ragService = new RAGOrchestratorService();
    const health = await ragService.getSystemHealth();
    
    return NextResponse.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}