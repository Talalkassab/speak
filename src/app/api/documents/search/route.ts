import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentSearchFilter, createSearchFilter } from '@/types/documents';

// Search documents and chunks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    // Parse search parameters
    const query = searchParams.get('q') || '';
    const category_id = searchParams.get('category_id') || undefined;
    const language = searchParams.get('language') as 'ar' | 'en' | 'mixed' | undefined;
    const status = searchParams.get('status') || undefined;
    const uploaded_by = searchParams.get('uploaded_by') || undefined;
    const date_from = searchParams.get('date_from') || undefined;
    const date_to = searchParams.get('date_to') || undefined;
    const file_types = searchParams.get('file_types')?.split(',') || undefined;
    const tags = searchParams.get('tags')?.split(',') || undefined;
    const sort_by = (searchParams.get('sort_by') as any) || 'updated_at';
    const sort_order = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const include_content = searchParams.get('include_content') === 'true';

    // Create search filter
    const filter = createSearchFilter(query, {
      category_id,
      language,
      status: status as any,
      uploaded_by,
      date_from,
      date_to,
      file_types,
      tags,
      sort_by: sort_by as any,
      sort_order,
      limit,
      offset
    });

    // Build query
    let documentsQuery = supabase
      .from('documents')
      .select(`
        id,
        organization_id,
        category_id,
        name,
        original_filename,
        file_size_bytes,
        file_type,
        mime_type,
        ${include_content ? 'content_extracted,' : ''}
        language,
        version_number,
        status,
        processing_metadata,
        tags,
        is_public,
        uploaded_by,
        processed_at,
        created_at,
        updated_at,
        category:document_categories(id, name, color),
        uploader:uploaded_by(id, email, full_name)
      `)
      .eq('organization_id', orgMember.organization_id);

    // Apply filters
    if (filter.search_query) {
      // Search in document name, filename, content, and tags
      documentsQuery = documentsQuery.or(`
        name.ilike.%${filter.search_query}%,
        original_filename.ilike.%${filter.search_query}%,
        content_extracted.ilike.%${filter.search_query}%,
        tags.cs.{${filter.search_query}}
      `);
    }

    if (filter.category_id) {
      documentsQuery = documentsQuery.eq('category_id', filter.category_id);
    }

    if (filter.language) {
      documentsQuery = documentsQuery.eq('language', filter.language);
    }

    if (filter.status) {
      documentsQuery = documentsQuery.eq('status', filter.status);
    }

    if (filter.uploaded_by) {
      documentsQuery = documentsQuery.eq('uploaded_by', filter.uploaded_by);
    }

    if (filter.date_from) {
      documentsQuery = documentsQuery.gte('created_at', filter.date_from);
    }

    if (filter.date_to) {
      documentsQuery = documentsQuery.lte('created_at', filter.date_to);
    }

    if (filter.file_types && filter.file_types.length > 0) {
      documentsQuery = documentsQuery.in('file_type', filter.file_types);
    }

    if (filter.tags && filter.tags.length > 0) {
      // Search for documents that contain any of the specified tags
      const tagConditions = filter.tags.map(tag => `tags.cs.{${tag}}`).join(',');
      documentsQuery = documentsQuery.or(tagConditions);
    }

    // Apply sorting
    documentsQuery = documentsQuery.order(filter.sort_by!, { ascending: filter.sort_order === 'asc' });

    // Apply pagination
    documentsQuery = documentsQuery.range(filter.offset!, filter.offset! + filter.limit! - 1);

    // Execute query
    const { data: documents, error: searchError, count } = await documentsQuery;

    if (searchError) {
      console.error('Document search error:', searchError);
      return NextResponse.json(
        { error: searchError.message, code: 'SEARCH_FAILED' },
        { status: 400 }
      );
    }

    // Get chunk-level search results if there's a query
    let chunkResults = [];
    if (filter.search_query && filter.search_query.length > 2) {
      const { data: chunks, error: chunkError } = await supabase
        .from('document_chunks')
        .select(`
          id,
          document_id,
          content,
          chunk_index,
          language,
          metadata,
          document:documents!inner(
            id,
            name,
            original_filename,
            organization_id
          )
        `)
        .eq('organization_id', orgMember.organization_id)
        .textSearch('content', filter.search_query, {
          type: 'websearch',
          config: language === 'ar' ? 'arabic' : 'english'
        })
        .limit(10);

      if (!chunkError && chunks) {
        chunkResults = chunks.map(chunk => ({
          id: chunk.id,
          document_id: chunk.document_id,
          document_name: chunk.document.name,
          document_filename: chunk.document.original_filename,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          language: chunk.language,
          metadata: chunk.metadata,
          relevance_score: 1.0 // Would be calculated by vector search
        }));
      }
    }

    return NextResponse.json({
      success: true,
      query: filter.search_query,
      documents: {
        data: documents || [],
        count: count || 0,
        has_more: count ? count > (filter.offset! + filter.limit!) : false
      },
      chunks: {
        data: chunkResults,
        count: chunkResults.length
      },
      pagination: {
        limit: filter.limit,
        offset: filter.offset,
        total_documents: count || 0
      },
      filters: {
        category_id: filter.category_id,
        language: filter.language,
        status: filter.status,
        date_from: filter.date_from,
        date_to: filter.date_to,
        file_types: filter.file_types,
        tags: filter.tags
      },
      sorting: {
        sort_by: filter.sort_by,
        sort_order: filter.sort_order
      }
    });

  } catch (error) {
    console.error('Document search error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Advanced semantic search using vector embeddings
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      query, 
      similarity_threshold = 0.78, 
      max_results = 10, 
      category_id, 
      language,
      include_chunks = true,
      include_summary = false 
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required', code: 'QUERY_REQUIRED' },
        { status: 400 }
      );
    }

    // Generate embedding for the query using the embedding service
    const { EmbeddingGenerationService } = await import('@/services/rag/EmbeddingGenerationService');
    const embeddingService = new EmbeddingGenerationService();
    
    let queryEmbedding;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(query);
    } catch (error) {
      console.error('Failed to generate query embedding:', error);
      return NextResponse.json(
        { error: 'Failed to generate query embedding', code: 'EMBEDDING_FAILED' },
        { status: 500 }
      );
    }

    // Perform vector similarity search
    const { data: searchResults, error: vectorError } = await supabase
      .rpc('match_organization_documents', {
        query_embedding: queryEmbedding,
        p_organization_id: orgMember.organization_id,
        match_threshold: similarity_threshold,
        match_count: max_results,
        p_category: category_id || null,
        p_language: language || null
      });

    if (vectorError) {
      console.error('Vector search error:', vectorError);
      return NextResponse.json(
        { error: vectorError.message, code: 'VECTOR_SEARCH_FAILED' },
        { status: 500 }
      );
    }

    // Group results by document
    const documentMap = new Map();
    const chunks = [];

    for (const result of searchResults || []) {
      if (!documentMap.has(result.document_id)) {
        documentMap.set(result.document_id, {
          document_id: result.document_id,
          document_name: result.document_name,
          category: result.category,
          language: result.language,
          max_similarity: result.similarity,
          chunk_count: 0,
          chunks: []
        });
      }

      const docResult = documentMap.get(result.document_id);
      docResult.max_similarity = Math.max(docResult.max_similarity, result.similarity);
      docResult.chunk_count++;

      if (include_chunks) {
        chunks.push({
          id: result.id,
          document_id: result.document_id,
          document_name: result.document_name,
          content: result.content,
          similarity: result.similarity,
          category: result.category,
          language: result.language
        });

        docResult.chunks.push({
          id: result.id,
          content: result.content,
          similarity: result.similarity
        });
      }
    }

    // Convert to array and sort by max similarity
    const documents = Array.from(documentMap.values())
      .sort((a, b) => b.max_similarity - a.max_similarity);

    return NextResponse.json({
      success: true,
      query,
      results: {
        documents,
        chunks: include_chunks ? chunks : undefined,
        total_documents: documents.length,
        total_chunks: chunks.length
      },
      search_params: {
        similarity_threshold,
        max_results,
        category_id,
        language,
        organization_id: orgMember.organization_id
      }
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}