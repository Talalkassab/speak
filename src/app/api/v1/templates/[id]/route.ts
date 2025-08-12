import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import TemplateManagementService from '@/libs/services/template-management-service';

// Schema for template updates
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['employment', 'hr_policies', 'compliance', 'forms', 'letters']).optional(),
  language: z.enum(['ar', 'en']).optional(),
  templateContent: z.string().min(1).optional(),
  requiredFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'email', 'select', 'textarea', 'boolean']),
    required: z.boolean().default(true),
    label: z.string(),
    labelAr: z.string().optional(),
    placeholder: z.string().optional(),
    placeholderAr: z.string().optional(),
    options: z.array(z.string()).optional(),
    validation: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional()
    }).optional()
  })).optional(),
  complianceRules: z.array(z.object({
    ruleId: z.string(),
    description: z.string(),
    descriptionAr: z.string().optional(),
    severity: z.enum(['warning', 'error', 'info']),
    laborLawReference: z.string().optional()
  })).optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
  approvalWorkflow: z.record(z.any()).optional()
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

// GET /api/v1/templates/[id] - Get specific template
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
    const template = await templateService.getTemplateById(templateId, userContext.organizationId);

    if (!template) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // Get template versions for additional context
    const versions = await templateService.getTemplateVersions(templateId);

    // Log activity
    await logUserActivity(
      userContext,
      'template_viewed',
      'template',
      templateId,
      { templateName: template.name },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse({
      ...template,
      versions: versions.slice(0, 5) // Return latest 5 versions
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error getting template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// PUT /api/v1/templates/[id] - Update specific template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for template management
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager', 'hr_staff'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to update templates',
        403
      );
    }

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

    // Parse and validate request body
    const body = await request.json();
    const updateData = updateTemplateSchema.parse(body);

    const templateService = new TemplateManagementService();
    
    // Check if template exists and user has permission
    const existingTemplate = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!existingTemplate) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // System templates cannot be modified by organization users
    if (!existingTemplate.organizationId && userContext.role !== 'system_admin') {
      return createErrorResponse(
        'CANNOT_MODIFY_SYSTEM_TEMPLATE',
        'System templates cannot be modified',
        403
      );
    }

    const updatedTemplate = await templateService.updateTemplate(
      templateId,
      updateData,
      userContext.organizationId,
      userContext.userId
    );

    // Log activity
    await logUserActivity(
      userContext,
      'template_updated',
      'template',
      templateId,
      { 
        templateName: updatedTemplate.name,
        updates: Object.keys(updateData)
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(updatedTemplate);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error updating template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// DELETE /api/v1/templates/[id] - Delete specific template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for template deletion
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to delete templates',
        403
      );
    }

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
    
    // Check if template exists and get details for logging
    const existingTemplate = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!existingTemplate) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // System templates cannot be deleted by organization users
    if (!existingTemplate.organizationId && userContext.role !== 'system_admin') {
      return createErrorResponse(
        'CANNOT_DELETE_SYSTEM_TEMPLATE',
        'System templates cannot be deleted',
        403
      );
    }

    // Check if template is in use (has recent generations)
    // This could be enhanced to check for active usage
    if (existingTemplate.usageCount > 0) {
      // Soft delete by deactivating instead of hard delete
      await templateService.updateTemplate(
        templateId,
        { isActive: false },
        userContext.organizationId,
        userContext.userId
      );

      // Log activity
      await logUserActivity(
        userContext,
        'template_deactivated',
        'template',
        templateId,
        { 
          templateName: existingTemplate.name,
          reason: 'template_in_use'
        },
        request
      );

      return createSuccessResponse({
        message: 'Template has been deactivated due to existing usage',
        messageAr: 'تم إلغاء تفعيل القالب بسبب الاستخدام الموجود',
        deactivated: true
      });
    }

    // Hard delete template
    const deleted = await templateService.deleteTemplate(templateId, userContext.organizationId);

    if (!deleted) {
      return createErrorResponse('DELETE_FAILED', 'Failed to delete template', 500);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'template_deleted',
      'template',
      templateId,
      { templateName: existingTemplate.name },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse({
      message: 'Template deleted successfully',
      messageAr: 'تم حذف القالب بنجاح',
      deleted: true
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error deleting template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}