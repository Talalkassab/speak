import { NextRequest, NextResponse } from 'next/server';
import { RAGOrchestratorService, DocumentProcessingRequest } from '@/libs/services/rag-orchestrator-service';
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
      .select('organization_id, access_level')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    // Check permissions for document processing
    if (!['admin', 'advanced'].includes(userOrg.access_level)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for document processing' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      documentId, 
      content, 
      filename, 
      language, 
      category, 
      processingOptions 
    } = body;

    // Validate required fields
    if (!documentId || !content || !filename) {
      return NextResponse.json(
        { error: 'Document ID, content, and filename are required' },
        { status: 400 }
      );
    }

    // Validate document exists and belongs to organization
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, organization_id, status')
      .eq('id', documentId)
      .eq('organization_id', userOrg.organization_id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Check if document is already being processed
    if (document.status === 'processing') {
      return NextResponse.json(
        { error: 'Document is already being processed' },
        { status: 409 }
      );
    }

    // Build processing request
    const processingRequest: DocumentProcessingRequest = {
      documentId,
      organizationId: userOrg.organization_id,
      content,
      filename,
      language: language || 'mixed',
      category,
      processingOptions: {
        generateEmbeddings: processingOptions?.generateEmbeddings ?? true,
        extractEntities: processingOptions?.extractEntities ?? true,
        performQualityCheck: processingOptions?.performQualityCheck ?? true,
        optimizeForSearch: processingOptions?.optimizeForSearch ?? true,
        chunkingStrategy: processingOptions?.chunkingStrategy || 'semantic',
        maxChunkSize: Math.min(processingOptions?.maxChunkSize || 1000, 2000)
      }
    };

    // Update document status to processing
    await supabase
      .from('documents')
      .update({
        status: 'processing',
        processing_metadata: {
          started_at: new Date().toISOString(),
          processed_by: user.id
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Process document (async operation)
    const result = await ragService.processDocument(processingRequest);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Document processing error:', error);
    
    return NextResponse.json(
      {
        error: 'Document processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get processing status for documents
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

    // Get processing statistics
    const { data: processingStats, error: statsError } = await supabase
      .from('documents')
      .select('status, processing_metadata')
      .eq('organization_id', userOrg.organization_id);

    if (statsError) {
      throw statsError;
    }

    const stats = {
      total: processingStats.length,
      processing: processingStats.filter(d => d.status === 'processing').length,
      completed: processingStats.filter(d => d.status === 'completed').length,
      failed: processingStats.filter(d => d.status === 'failed').length,
      archived: processingStats.filter(d => d.status === 'archived').length
    };

    // Get recent processing activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('documents')
      .select('id, title, filename, status, processing_metadata, updated_at')
      .eq('organization_id', userOrg.organization_id)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (activityError) {
      throw activityError;
    }

    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        recentActivity: recentActivity || []
      }
    });

  } catch (error) {
    console.error('Error getting processing status:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get processing status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}