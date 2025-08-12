import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Template generation schemas
const generateTemplateSchema = z.object({
  templateId: z.string().uuid(),
  parameters: z.record(z.any()),
  language: z.enum(['ar', 'en']).optional(),
  format: z.enum(['pdf', 'docx', 'html']).default('pdf'),
  options: z.object({
    includeHeader: z.boolean().default(true),
    includeFooter: z.boolean().default(true),
    fontSize: z.number().min(8).max(24).default(12),
    fontFamily: z.enum(['Arial', 'Times New Roman', 'Calibri']).default('Arial'),
    margins: z.object({
      top: z.number().default(20),
      bottom: z.number().default(20),
      left: z.number().default(20),
      right: z.number().default(20)
    }).default({})
  }).default({})
});

const validateTemplateSchema = z.object({
  templateId: z.string().uuid(),
  parameters: z.record(z.any()),
  language: z.enum(['ar', 'en']).optional()
});

interface GeneratedTemplate {
  id: string;
  template_id: string;
  generated_content: string;
  download_url: string;
  preview_url: string;
  format: string;
  file_size_bytes: number;
  compliance_status: {
    valid: boolean;
    issues?: string[];
    suggestions?: string[];
    labor_law_violations?: string[];
  };
  parameters_used: Record<string, any>;
  generated_at: string;
  expires_at: string;
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

// POST /api/v1/templates/generate - Generate document from template
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits for template generation
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'generate');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `Template generation limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { templateId, parameters, language, format, options } = generateTemplateSchema.parse(body);

    const supabase = await createSupabaseServerClient();

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('hr_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .or(`organization_id.eq.${userContext.organizationId},organization_id.is.null`)
      .single();

    if (templateError || !template) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found or inactive', 404);
    }

    // Validate required parameters
    const validation = validateRequiredParameters(template.required_fields, parameters);
    if (!validation.valid) {
      return createErrorResponse(
        'MISSING_PARAMETERS',
        'Required parameters are missing',
        400,
        { missingParameters: validation.missing }
      );
    }

    // Generate content by replacing placeholders
    const generatedContent = await generateContentFromTemplate(
      template.template_content,
      parameters,
      language || template.language,
      userContext.organizationId
    );

    // Validate compliance
    const complianceCheck = await validateGeneratedCompliance(
      generatedContent,
      template.category,
      template.compliance_rules,
      parameters
    );

    // Generate file based on format
    const fileGeneration = await generateFile(
      generatedContent,
      format,
      options,
      language || template.language
    );

    // Store generated template record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    const { data: generatedTemplate, error: insertError } = await supabase
      .from('template_generations')
      .insert({
        organization_id: userContext.organizationId,
        template_id: templateId,
        generated_by: userContext.userId,
        parameters_used: parameters,
        generated_content: generatedContent,
        file_format: format,
        file_size_bytes: fileGeneration.fileSize,
        download_url: fileGeneration.downloadUrl,
        preview_url: fileGeneration.previewUrl,
        compliance_status: complianceCheck,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing generated template:', insertError);
      return createErrorResponse('DB_ERROR', 'Failed to store generated template', 500);
    }

    // Update template usage count
    await supabase.rpc('increment_template_usage', { template_id: templateId });

    // Log activity
    await logUserActivity(
      userContext,
      'template_generated',
      'template',
      templateId,
      { 
        generationId: generatedTemplate.id,
        templateName: template.name,
        format,
        complianceStatus: complianceCheck.valid ? 'compliant' : 'issues_found'
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      api_calls: 1,
      documents_count: 1 // Count generated templates as documents
    });

    const response: GeneratedTemplate = {
      id: generatedTemplate.id,
      template_id: templateId,
      generated_content: generatedContent,
      download_url: fileGeneration.downloadUrl,
      preview_url: fileGeneration.previewUrl,
      format,
      file_size_bytes: fileGeneration.fileSize,
      compliance_status: complianceCheck,
      parameters_used: parameters,
      generated_at: generatedTemplate.created_at,
      expires_at: generatedTemplate.expires_at
    };

    return createSuccessResponse(response, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error generating template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// POST /api/v1/templates/validate - Validate template parameters before generation
export async function PUT(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Parse and validate request body
    const body = await request.json();
    const { templateId, parameters, language } = validateTemplateSchema.parse(body);

    const supabase = await createSupabaseServerClient();

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('hr_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .or(`organization_id.eq.${userContext.organizationId},organization_id.is.null`)
      .single();

    if (templateError || !template) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found or inactive', 404);
    }

    // Validate required parameters
    const parameterValidation = validateRequiredParameters(template.required_fields, parameters);
    
    // Validate field types and constraints
    const fieldValidation = validateFieldConstraints(template.required_fields, parameters);
    
    // Generate preview content
    let previewContent = '';
    if (parameterValidation.valid && fieldValidation.valid) {
      previewContent = await generateContentFromTemplate(
        template.template_content.substring(0, 500) + '...', // Preview only
        parameters,
        language || template.language,
        userContext.organizationId
      );
    }

    // Check compliance preview
    const compliancePreview = parameterValidation.valid && fieldValidation.valid ? 
      await validateGeneratedCompliance(
        previewContent,
        template.category,
        template.compliance_rules,
        parameters
      ) : { valid: false, issues: [], suggestions: [] };

    const validationResult = {
      template_id: templateId,
      template_name: template.name,
      parameter_validation: {
        valid: parameterValidation.valid,
        missing_parameters: parameterValidation.missing,
        field_validation_errors: fieldValidation.errors
      },
      compliance_preview: compliancePreview,
      preview_content: previewContent,
      ready_for_generation: parameterValidation.valid && fieldValidation.valid
    };

    // Log activity
    await logUserActivity(
      userContext,
      'template_validated',
      'template',
      templateId,
      { 
        validationPassed: validationResult.ready_for_generation,
        parameterCount: Object.keys(parameters).length
      },
      request
    );

    return createSuccessResponse(validationResult);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error validating template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper functions
function validateRequiredParameters(
  requiredFields: any[],
  parameters: Record<string, any>
): { valid: boolean; missing: string[] } {
  const missing = requiredFields
    .filter(field => field.required && (!(field.name in parameters) || parameters[field.name] === '' || parameters[field.name] == null))
    .map(field => field.name);

  return {
    valid: missing.length === 0,
    missing
  };
}

function validateFieldConstraints(
  requiredFields: any[],
  parameters: Record<string, any>
): { valid: boolean; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];

  requiredFields.forEach(field => {
    const value = parameters[field.name];
    
    if (value == null || value === '') return; // Skip empty values (handled by required validation)

    // Type validation
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push({ field: field.name, message: 'Must be a valid number' });
          return;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({ field: field.name, message: 'Must be a valid email address' });
          return;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push({ field: field.name, message: 'Must be a valid date' });
          return;
        }
        break;
    }

    // Constraint validation
    const validation = field.validation;
    if (validation) {
      if (validation.minLength && value.toString().length < validation.minLength) {
        errors.push({ 
          field: field.name, 
          message: `Must be at least ${validation.minLength} characters long` 
        });
      }
      
      if (validation.maxLength && value.toString().length > validation.maxLength) {
        errors.push({ 
          field: field.name, 
          message: `Must not exceed ${validation.maxLength} characters` 
        });
      }
      
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        errors.push({ 
          field: field.name, 
          message: 'Does not match required format' 
        });
      }
      
      if (validation.min && Number(value) < validation.min) {
        errors.push({ 
          field: field.name, 
          message: `Must be at least ${validation.min}` 
        });
      }
      
      if (validation.max && Number(value) > validation.max) {
        errors.push({ 
          field: field.name, 
          message: `Must not exceed ${validation.max}` 
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

async function generateContentFromTemplate(
  templateContent: string,
  parameters: Record<string, any>,
  language: string,
  organizationId: string
): Promise<string> {
  let content = templateContent;

  // Replace parameter placeholders
  Object.entries(parameters).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(placeholder, String(value || ''));
  });

  // Add organization-specific information
  try {
    const { createSupabaseServerClient } = await import('@/libs/supabase/supabase-server-client');
    const supabase = await createSupabaseServerClient();
    
    const { data: org } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', organizationId)
      .single();

    if (org) {
      content = content.replace(/{{organization_name}}/g, org.name || '');
      content = content.replace(/{{organization_domain}}/g, org.domain || '');
    }
  } catch (error) {
    console.error('Error fetching organization data for template:', error);
  }

  // Add current date
  const currentDate = new Date();
  const formattedDate = language === 'ar' 
    ? currentDate.toLocaleDateString('ar-SA', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : currentDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
  
  content = content.replace(/{{current_date}}/g, formattedDate);

  return content;
}

async function validateGeneratedCompliance(
  content: string,
  category: string,
  complianceRules: any[],
  parameters: Record<string, any>
): Promise<{
  valid: boolean;
  issues: string[];
  suggestions: string[];
  labor_law_violations: string[];
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const laborLawViolations: string[] = [];

  // Apply existing compliance rules
  complianceRules.forEach(rule => {
    // Simple rule checking (in production, this would be more sophisticated)
    if (rule.severity === 'error' && !content.includes(rule.description)) {
      laborLawViolations.push(rule.description);
    }
  });

  // Category-specific validation
  if (category === 'employment') {
    // Check probation period
    const probationPeriod = parameters.probation_period;
    if (probationPeriod && parseInt(probationPeriod) > 90) {
      laborLawViolations.push('Probation period exceeds 90 days maximum allowed by Saudi Labor Law');
    }

    // Check working hours
    const workingHours = parameters.working_hours_per_week;
    if (workingHours && parseInt(workingHours) > 48) {
      laborLawViolations.push('Weekly working hours exceed 48 hours maximum allowed by Saudi Labor Law');
    }
  }

  return {
    valid: laborLawViolations.length === 0,
    issues,
    suggestions,
    labor_law_violations: laborLawViolations
  };
}

async function generateFile(
  content: string,
  format: string,
  options: any,
  language: string
): Promise<{
  downloadUrl: string;
  previewUrl: string;
  fileSize: number;
}> {
  // This is a simplified implementation
  // In production, you would use proper document generation libraries
  
  const fileName = `template_${Date.now()}.${format}`;
  const fileSize = Buffer.byteLength(content, 'utf8');
  
  // Mock URLs - in production, these would be actual file storage URLs
  const downloadUrl = `/api/v1/templates/download/${fileName}`;
  const previewUrl = `/api/v1/templates/preview/${fileName}`;

  // Here you would:
  // 1. Generate PDF using puppeteer or similar
  // 2. Generate DOCX using docx library
  // 3. Store in cloud storage (S3, etc.)
  // 4. Return actual URLs

  return {
    downloadUrl,
    previewUrl,
    fileSize
  };
}