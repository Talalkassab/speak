import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Template schemas
const listTemplatesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.enum(['employment', 'hr_policies', 'compliance', 'forms', 'letters']).optional(),
  language: z.enum(['ar', 'en']).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  category: z.enum(['employment', 'hr_policies', 'compliance', 'forms', 'letters']),
  language: z.enum(['ar', 'en']).default('ar'),
  templateContent: z.string().min(1),
  requiredFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'email', 'select', 'textarea']),
    required: z.boolean().default(true),
    label: z.string(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(), // For select fields
    validation: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional()
    }).optional()
  })),
  complianceRules: z.array(z.object({
    ruleId: z.string(),
    description: z.string(),
    severity: z.enum(['warning', 'error']),
    laborLawReference: z.string().optional()
  })).default([]),
  metadata: z.record(z.any()).default({}),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).default([])
});

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  template_content: string;
  required_fields: any[];
  compliance_rules: any[];
  metadata: Record<string, any>;
  is_active: boolean;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
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

// GET /api/v1/templates - List available templates
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
      category: searchParams.get('category'),
      language: searchParams.get('language'),
      search: searchParams.get('search'),
      isActive: searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined
    };
    
    const { page, limit, category, language, search, isActive } = listTemplatesSchema.parse(queryParams);

    const supabase = await createSupabaseServerClient();
    
    // Build query - include both organization templates and system templates
    let query = supabase
      .from('hr_templates')
      .select(`
        *,
        creator:auth.users!created_by(email, raw_user_meta_data),
        template_usage:template_generations(count)
      `, { count: 'exact' })
      .or(`organization_id.eq.${userContext.organizationId},organization_id.is.null`); // Organization or system templates

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (language) {
      query = query.eq('language', language);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
    }
    
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    // Apply sorting and pagination
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: templates, error, count } = await query;

    if (error) {
      console.error('Database error fetching templates:', error);
      return createErrorResponse('DB_ERROR', 'Failed to fetch templates', 500);
    }

    // Format response
    const formattedTemplates: Template[] = templates?.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category,
      language: template.language,
      template_content: template.template_content,
      required_fields: template.required_fields || [],
      compliance_rules: template.compliance_rules || [],
      metadata: template.metadata || {},
      is_active: template.is_active,
      tags: template.tags || [],
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at,
      usage_count: template.template_usage?.[0]?.count || 0
    })) || [];

    const totalPages = Math.ceil((count || 0) / limit);
    
    const paginationMetadata = {
      page,
      limit,
      totalCount: count || 0,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };

    // Get category statistics
    const { data: categoryStats } = await supabase
      .from('hr_templates')
      .select('category')
      .or(`organization_id.eq.${userContext.organizationId},organization_id.is.null`)
      .eq('is_active', true);

    const categoryFacets = categoryStats?.reduce((acc: Record<string, number>, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {}) || {};

    // Log activity
    await logUserActivity(
      userContext,
      'templates_listed',
      'template',
      undefined,
      { 
        filters: { category, language, search },
        resultCount: formattedTemplates.length 
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(
      formattedTemplates,
      200,
      {
        pagination: paginationMetadata,
        facets: {
          categories: Object.entries(categoryFacets).map(([name, count]) => ({ name, count }))
        }
      }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error listing templates:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// POST /api/v1/templates - Create custom template
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for template creation
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to create templates',
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

    // Parse and validate request body
    const body = await request.json();
    const templateData = createTemplateSchema.parse(body);

    const supabase = await createSupabaseServerClient();

    // Validate template content (basic check for required placeholders)
    const contentValidation = validateTemplateContent(
      templateData.templateContent, 
      templateData.requiredFields
    );
    
    if (!contentValidation.valid) {
      return createErrorResponse(
        'INVALID_TEMPLATE_CONTENT',
        'Template content validation failed',
        400,
        { issues: contentValidation.issues }
      );
    }

    // Check Saudi labor law compliance
    const complianceCheck = await validateSaudiLaborCompliance(
      templateData.templateContent,
      templateData.category,
      templateData.language
    );

    // Create template
    const { data: template, error } = await supabase
      .from('hr_templates')
      .insert({
        organization_id: userContext.organizationId,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        language: templateData.language,
        template_content: templateData.templateContent,
        required_fields: templateData.requiredFields,
        compliance_rules: [...templateData.complianceRules, ...complianceCheck.rules],
        compliance_status: complianceCheck.status,
        metadata: templateData.metadata,
        is_active: templateData.isActive,
        tags: templateData.tags,
        created_by: userContext.userId
      })
      .select()
      .single();

    if (error) {
      console.error('Database error creating template:', error);
      return createErrorResponse('DB_ERROR', 'Failed to create template', 500);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'template_created',
      'template',
      template.id,
      { 
        name: templateData.name,
        category: templateData.category,
        language: templateData.language,
        complianceStatus: complianceCheck.status
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse({
      ...template,
      compliance_check: complianceCheck
    }, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    console.error('Unexpected error creating template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to validate template content
function validateTemplateContent(
  content: string, 
  requiredFields: any[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if all required fields have placeholders in content
  requiredFields.forEach(field => {
    const placeholder = `{{${field.name}}}`;
    if (!content.includes(placeholder)) {
      issues.push(`Missing placeholder for required field: ${field.name}`);
    }
  });

  // Check for unmatched placeholders
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const placeholders = [...content.matchAll(placeholderRegex)].map(match => match[1]);
  const fieldNames = requiredFields.map(field => field.name);
  
  placeholders.forEach(placeholder => {
    if (!fieldNames.includes(placeholder)) {
      issues.push(`Unmatched placeholder found: {{${placeholder}}}`);
    }
  });

  return {
    valid: issues.length === 0,
    issues
  };
}

// Helper function to validate Saudi labor law compliance
async function validateSaudiLaborCompliance(
  content: string,
  category: string,
  language: string
): Promise<{
  status: 'compliant' | 'warning' | 'non_compliant';
  rules: any[];
  suggestions: string[];
}> {
  // This would integrate with the Saudi labor law knowledge base
  // For now, providing basic compliance rules
  
  const complianceRules: any[] = [];
  const suggestions: string[] = [];
  let status: 'compliant' | 'warning' | 'non_compliant' = 'compliant';

  // Employment contract specific rules
  if (category === 'employment') {
    // Check for mandatory clauses in employment contracts
    const mandatoryClauses = [
      'probation period',
      'working hours',
      'salary',
      'job description',
      'termination conditions'
    ];

    const arabicMandatoryClauses = [
      'فترة التجربة',
      'ساعات العمل',
      'الراتب',
      'الوصف الوظيفي',
      'شروط الإنهاء'
    ];

    const clausesToCheck = language === 'ar' ? arabicMandatoryClauses : mandatoryClauses;
    
    clausesToCheck.forEach(clause => {
      if (!content.toLowerCase().includes(clause.toLowerCase())) {
        complianceRules.push({
          ruleId: `mandatory_clause_${clause.replace(/\s+/g, '_')}`,
          description: `Missing mandatory clause: ${clause}`,
          severity: 'warning',
          laborLawReference: 'Article 50 - Saudi Labor Law'
        });
        status = 'warning';
      }
    });

    // Check for probation period limits
    if (content.includes('probation') || content.includes('تجربة')) {
      suggestions.push(
        language === 'ar' 
          ? 'تأكد من أن فترة التجربة لا تتجاوز 90 يوماً وفقاً لنظام العمل السعودي'
          : 'Ensure probation period does not exceed 90 days as per Saudi Labor Law'
      );
    }
  }

  return {
    status,
    rules: complianceRules,
    suggestions
  };
}