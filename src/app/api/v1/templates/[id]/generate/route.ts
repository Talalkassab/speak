import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import TemplateManagementService from '@/libs/services/template-management-service';

// Schema for document generation request
const generateDocumentSchema = z.object({
  parameters: z.record(z.any()),
  language: z.enum(['ar', 'en']).optional(),
  format: z.enum(['pdf', 'docx', 'html']).default('pdf'),
  organizationContext: z.record(z.any()).optional(),
  includePreviews: z.boolean().default(false),
  customizations: z.object({
    fontSize: z.number().min(8).max(24).optional(),
    fontFamily: z.string().optional(),
    margins: z.object({
      top: z.number().optional(),
      bottom: z.number().optional(),
      left: z.number().optional(),
      right: z.number().optional()
    }).optional(),
    headerFooter: z.object({
      includeHeader: z.boolean().default(true),
      includeFooter: z.boolean().default(true),
      headerText: z.string().optional(),
      footerText: z.string().optional()
    }).optional(),
    watermark: z.object({
      enabled: z.boolean().default(false),
      text: z.string().optional(),
      opacity: z.number().min(0).max(1).optional()
    }).optional()
  }).optional()
});

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

// POST /api/v1/templates/[id]/generate - Generate document from template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits for document generation (higher quota consumption)
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'document_generation');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `Document generation limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    const templateId = params.id;
    if (!templateId || templateId === '[id]') {
      return createErrorResponse('INVALID_TEMPLATE_ID', 'Template ID is required', 400);
    }

    // Parse and validate request body
    const body = await request.json();
    const generateRequest = generateDocumentSchema.parse(body);

    const templateService = new TemplateManagementService();

    // Verify template exists and is accessible
    const template = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!template) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    if (!template.isActive) {
      return createErrorResponse('TEMPLATE_INACTIVE', 'Template is not active', 400);
    }

    // Get organization context if not provided
    let orgContext = generateRequest.organizationContext;
    if (!orgContext) {
      // This would typically fetch from the database
      orgContext = {
        organization_name: 'المؤسسة', // Default organization name
        organization_name_ar: 'المؤسسة',
        organization_name_en: 'Organization'
      };
    }

    // Generate the document
    const generationRequest = {
      templateId,
      parameters: generateRequest.parameters,
      language: generateRequest.language || template.language,
      format: generateRequest.format,
      organizationContext: orgContext
    };

    const generatedDocument = await templateService.generateDocument(
      generationRequest,
      userContext.organizationId,
      userContext.userId
    );

    // Enhanced response with additional metadata
    const response = {
      ...generatedDocument,
      template: {
        id: template.id,
        name: template.name,
        nameAr: template.nameAr,
        category: template.category,
        language: template.language
      },
      generation: {
        requestedFormat: generateRequest.format,
        processingTimeMs: generatedDocument.processingTimeMs,
        parametersCount: Object.keys(generateRequest.parameters).length,
        contentLength: generatedDocument.content.length
      },
      compliance: generatedDocument.complianceCheck,
      metadata: {
        generatedBy: userContext.userId,
        organizationId: userContext.organizationId,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    };

    // Log successful generation activity
    await logUserActivity(
      userContext,
      'document_generated',
      'template',
      templateId,
      {
        templateName: template.name,
        format: generateRequest.format,
        language: generationRequest.language,
        parametersCount: Object.keys(generateRequest.parameters).length,
        complianceStatus: generatedDocument.complianceCheck.status,
        processingTimeMs: generatedDocument.processingTimeMs
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, {
      api_calls: 1,
      documents_count: 1,
      templates_generated: 1,
      // Estimate tokens used (rough calculation)
      tokens_used: Math.ceil(generatedDocument.content.length / 4)
    });

    const processingTime = Date.now() - startTime;
    
    return createSuccessResponse(response, 200, {
      processingTime: processingTime,
      quotaRemaining: {
        documents: usageCheck.limit - usageCheck.current - 1,
        apiCalls: 'unlimited' // This would come from actual quota check
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log failed generation attempt
    try {
      const userContext = await getUserContext(request);
      await logUserActivity(
        userContext,
        'document_generation_failed',
        'template',
        params.id,
        {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: processingTime
        },
        request
      );
    } catch (loggingError) {
      console.error('Error logging failed generation:', loggingError);
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, {
        validationErrors: error.errors,
        requiredFields: [
          'parameters - object containing template field values',
          'language - ar or en (optional)',
          'format - pdf, docx, or html (optional, defaults to pdf)'
        ]
      });
    }

    if (error instanceof Error) {
      // Handle specific template generation errors
      if (error.message.includes('Missing required field')) {
        return createErrorResponse('MISSING_REQUIRED_FIELDS', error.message, 400);
      }
      
      if (error.message.includes('validation failed')) {
        return createErrorResponse('PARAMETER_VALIDATION_ERROR', error.message, 400);
      }
      
      if (error.message.includes('Template not found')) {
        return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
      }
    }

    console.error('Unexpected error generating document:', error);
    return createErrorResponse('GENERATION_ERROR', 'Failed to generate document', 500, {
      processingTimeMs: processingTime
    });
  }
}

// GET /api/v1/templates/[id]/generate - Get template generation preview/info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const templateId = params.id;
    if (!templateId || templateId === '[id]') {
      return createErrorResponse('INVALID_TEMPLATE_ID', 'Template ID is required', 400);
    }

    const templateService = new TemplateManagementService();

    // Get template details
    const template = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!template) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // Get template categories for context
    const categories = await templateService.getTemplateCategories(template.language);
    const templateCategory = categories.find(cat => cat.code === template.category);

    // Get recent usage statistics
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === 'true';
    const includePreview = searchParams.get('includePreview') === 'true';

    const response = {
      template: {
        id: template.id,
        name: template.name,
        nameAr: template.nameAr,
        description: template.description,
        descriptionAr: template.descriptionAr,
        category: template.category,
        categoryInfo: templateCategory,
        language: template.language,
        isActive: template.isActive,
        requiresApproval: template.requiresApproval,
        tags: template.tags
      },
      requiredFields: template.requiredFields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        label: field.label,
        labelAr: field.labelAr,
        placeholder: field.placeholder,
        placeholderAr: field.placeholderAr,
        options: field.options,
        validation: field.validation
      })),
      complianceRules: template.complianceRules.map(rule => ({
        ruleId: rule.ruleId,
        description: rule.description,
        descriptionAr: rule.descriptionAr,
        severity: rule.severity,
        laborLawReference: rule.laborLawReference
      })),
      supportedFormats: ['pdf', 'docx', 'html'],
      supportedLanguages: ['ar', 'en'],
      estimatedProcessingTime: '2-5 seconds',
      usageCount: template.usageCount,
      ...(includePreview && { 
        contentPreview: template.templateContent.substring(0, 500) + '...' 
      })
    };

    // Add statistics if requested
    if (includeStats && template.usageCount > 0) {
      // This would typically come from template_usage_history table
      response.statistics = {
        totalGenerations: template.usageCount,
        averageProcessingTime: '3.2 seconds',
        mostUsedFormat: 'pdf',
        complianceScore: '92%',
        lastUsed: template.updatedAt
      };
    }

    // Log activity
    await logUserActivity(
      userContext,
      'template_generation_info_viewed',
      'template',
      templateId,
      { templateName: template.name },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(response);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error getting template generation info:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}