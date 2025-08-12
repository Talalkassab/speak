import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentUploadService } from '@/libs/document-processing/DocumentUploadService';

// Request/Response schemas
const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['policies', 'contracts', 'handbooks', 'procedures', 'forms', 'compliance', 'other']),
  language: z.enum(['ar', 'en', 'mixed']).default('ar'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  isPublic: z.boolean().default(false),
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    base64Data: z.string()
  })
});

const listDocumentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  language: z.enum(['ar', 'en', 'mixed']).optional(),
  status: z.enum(['uploaded', 'processing', 'completed', 'failed']).optional(),
  uploadedBy: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['name', 'created_at', 'updated_at', 'file_size_bytes']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['policies', 'contracts', 'handbooks', 'procedures', 'forms', 'compliance', 'other']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  isPublic: z.boolean().optional()
});

interface Document {
  id: string;
  name: string;
  original_filename: string;
  category: string;
  language: string;
  file_size_bytes: number;
  status: string;
  tags: string[];
  metadata: Record<string, any>;
  is_public: boolean;
  uploaded_by: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentWithStats extends Document {
  chunk_count?: number;
  query_count?: number;
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

// POST /api/v1/documents - Upload new document
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for upload
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager', 'hr_staff'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to upload documents',
        403
      );
    }
    
    // Check usage limits for uploads
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'upload');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `Upload limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const documentData = createDocumentSchema.parse(body);

    // Validate file size (max 50MB)
    const maxSizeBytes = 50 * 1024 * 1024;
    if (documentData.file.size > maxSizeBytes) {
      return createErrorResponse(
        'FILE_TOO_LARGE',
        `File size exceeds maximum limit of ${maxSizeBytes / (1024 * 1024)}MB`,
        400
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(documentData.file.type)) {
      return createErrorResponse(
        'INVALID_FILE_TYPE',
        'File type not supported. Please upload PDF, DOC, DOCX, or TXT files',
        400
      );
    }

    const supabase = await createSupabaseServerClient();

    // Check organization storage limits
    const { data: orgUsage } = await supabase
      .from('organization_usage')
      .select('storage_used_gb')
      .eq('organization_id', userContext.organizationId)
      .single();

    const { data: org } = await supabase
      .from('organizations')
      .select('max_storage_gb')
      .eq('id', userContext.organizationId)
      .single();

    const currentStorageGB = orgUsage?.storage_used_gb || 0;
    const maxStorageGB = org?.max_storage_gb || 10;
    const fileSizeGB = documentData.file.size / (1024 * 1024 * 1024);

    if (currentStorageGB + fileSizeGB > maxStorageGB) {
      return createErrorResponse(
        'STORAGE_QUOTA_EXCEEDED',
        `Storage quota exceeded. Current: ${currentStorageGB.toFixed(2)}GB, Max: ${maxStorageGB}GB`,
        429
      );
    }

    // Initialize document upload service
    const uploadService = new DocumentUploadService();
    
    // Convert base64 to buffer
    const fileBuffer = Buffer.from(documentData.file.base64Data, 'base64');
    
    // Upload file and create document record
    const document = await uploadService.uploadDocument({
      name: documentData.name,
      originalFilename: documentData.file.name,
      fileBuffer,
      contentType: documentData.file.type,
      category: documentData.category,
      language: documentData.language,
      tags: documentData.tags,
      metadata: documentData.metadata,
      isPublic: documentData.isPublic,
      organizationId: userContext.organizationId,
      uploadedBy: userContext.userId
    });

    // Log activity
    await logUserActivity(
      userContext,
      'document_uploaded',
      'document',
      document.id,
      { 
        name: documentData.name,
        category: documentData.category,
        language: documentData.language,
        fileSize: documentData.file.size,
        fileType: documentData.file.type
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      documents_count: 1,
      api_calls: 1
    });

    return createSuccessResponse(document, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error uploading document:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// GET /api/v1/documents - List documents with filtering and pagination
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
      category: searchParams.getAll('category'),
      tags: searchParams.getAll('tags'),
      language: searchParams.get('language'),
      status: searchParams.get('status'),
      uploadedBy: searchParams.get('uploadedBy'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder')
    };
    
    const {
      page,
      limit,
      search,
      category,
      tags,
      language,
      status,
      uploadedBy,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder
    } = listDocumentsSchema.parse(queryParams);

    const supabase = await createSupabaseServerClient();
    
    // Build base query with organization filter
    let query = supabase
      .from('documents')
      .select(`
        *,
        uploader:auth.users!uploaded_by(email, raw_user_meta_data),
        document_chunks(count)
      `, { count: 'exact' })
      .eq('organization_id', userContext.organizationId);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,original_filename.ilike.%${search}%,tags.cs.{${search}}`);
    }

    // Apply category filter
    if (category && category.length > 0) {
      query = query.in('category', category);
    }

    // Apply tags filter
    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    // Apply language filter
    if (language) {
      query = query.eq('language', language);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply uploaded by filter
    if (uploadedBy) {
      query = query.eq('uploaded_by', uploadedBy);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: documents, error, count } = await query;

    if (error) {
      console.error('Database error fetching documents:', error);
      return createErrorResponse('DB_ERROR', 'Failed to fetch documents', 500);
    }

    // Format response with additional stats
    const formattedDocuments: DocumentWithStats[] = documents?.map(doc => ({
      id: doc.id,
      name: doc.name,
      original_filename: doc.original_filename,
      category: doc.category,
      language: doc.language,
      file_size_bytes: doc.file_size_bytes,
      status: doc.status,
      tags: doc.tags || [],
      metadata: doc.metadata || {},
      is_public: doc.is_public,
      uploaded_by: doc.uploaded_by,
      processed_at: doc.processed_at,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      chunk_count: doc.document_chunks?.length || 0
    })) || [];

    // Get faceted search results for filters
    const { data: facets } = await supabase
      .from('documents')
      .select('category, language, status, tags')
      .eq('organization_id', userContext.organizationId);

    const categoryFacets = facets?.reduce((acc: Record<string, number>, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {}) || {};

    const languageFacets = facets?.reduce((acc: Record<string, number>, doc) => {
      acc[doc.language] = (acc[doc.language] || 0) + 1;
      return acc;
    }, {}) || {};

    const statusFacets = facets?.reduce((acc: Record<string, number>, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Extract unique tags
    const allTags = facets?.flatMap(doc => doc.tags || []) || [];
    const tagFacets = allTags.reduce((acc: Record<string, number>, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

    const totalPages = Math.ceil((count || 0) / limit);
    
    const responseMetadata = {
      pagination: {
        page,
        limit,
        totalCount: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      facets: {
        categories: Object.entries(categoryFacets).map(([name, count]) => ({ name, count })),
        languages: Object.entries(languageFacets).map(([code, count]) => ({ code, count })),
        statuses: Object.entries(statusFacets).map(([status, count]) => ({ status, count })),
        tags: Object.entries(tagFacets)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([name, count]) => ({ name, count }))
      }
    };

    // Log activity
    await logUserActivity(
      userContext,
      'documents_listed',
      'document',
      undefined,
      { 
        filters: { search, category, tags, language, status },
        resultCount: formattedDocuments.length 
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(
      formattedDocuments,
      200,
      responseMetadata
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error listing documents:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}