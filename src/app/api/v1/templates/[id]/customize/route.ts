import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import TemplateManagementService from '@/libs/services/template-management-service';
import { OpenRouterClient } from '@/libs/services/openrouter-client';

// Schema for template customization requests
const customizeTemplateSchema = z.object({
  customizations: z.object({
    companyInfo: z.object({
      name: z.string().optional(),
      logo: z.string().url().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      website: z.string().url().optional(),
      commercialRegistration: z.string().optional()
    }).optional(),
    styling: z.object({
      primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      fontFamily: z.enum(['Arial', 'Times New Roman', 'Calibri', 'Amiri', 'Tajawal']).optional(),
      fontSize: z.number().min(8).max(24).optional(),
      headerStyle: z.enum(['minimal', 'standard', 'detailed']).optional(),
      footerIncluded: z.boolean().optional()
    }).optional(),
    content: z.object({
      additionalClauses: z.array(z.object({
        title: z.string(),
        titleAr: z.string().optional(),
        content: z.string(),
        contentAr: z.string().optional(),
        position: z.enum(['before', 'after']),
        anchor: z.string()
      })).optional(),
      removedSections: z.array(z.string()).optional(),
      customVariables: z.record(z.string()).optional()
    }).optional(),
    compliance: z.object({
      enableStrictMode: z.boolean().default(false),
      customRules: z.array(z.object({
        ruleId: z.string(),
        description: z.string(),
        descriptionAr: z.string().optional(),
        severity: z.enum(['warning', 'error', 'info']),
        checkFunction: z.string().optional()
      })).optional()
    }).optional()
  }),
  saveAsNew: z.boolean().default(false),
  newTemplateName: z.string().optional(),
  language: z.enum(['ar', 'en']).default('ar')
});

const aiCustomizeSchema = z.object({
  prompt: z.string().min(10).max(1000),
  language: z.enum(['ar', 'en']).default('ar'),
  focusAreas: z.array(z.enum([
    'compliance', 'styling', 'content', 'fields', 'structure'
  ])).optional(),
  preserveOriginal: z.boolean().default(true)
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

// POST /api/v1/templates/[id]/customize - Customize existing template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for template customization
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager', 'hr_staff'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to customize templates',
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
    const customizationRequest = customizeTemplateSchema.parse(body);

    const templateService = new TemplateManagementService();
    
    // Get original template
    const originalTemplate = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!originalTemplate) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // Apply customizations
    const customizedTemplate = await applyTemplateCustomizations(
      originalTemplate,
      customizationRequest.customizations,
      userContext.organizationId
    );

    let result;
    
    if (customizationRequest.saveAsNew) {
      // Create new customized template
      const newTemplateName = customizationRequest.newTemplateName || 
        `${originalTemplate.name} - Customized`;
      
      result = await templateService.createTemplate({
        ...customizedTemplate,
        name: newTemplateName,
        nameAr: customizationRequest.language === 'ar' ? newTemplateName : originalTemplate.nameAr,
        description: `Customized version of ${originalTemplate.name}`,
        descriptionAr: `نسخة مخصصة من ${originalTemplate.name}`,
        organizationId: userContext.organizationId,
        createdBy: userContext.userId,
        tags: [...(originalTemplate.tags || []), 'customized'],
        metadata: {
          ...originalTemplate.metadata,
          customizationSource: templateId,
          customizations: customizationRequest.customizations,
          customizedAt: new Date().toISOString(),
          customizedBy: userContext.userId
        }
      });

      await logUserActivity(
        userContext,
        'template_customized_new',
        'template',
        result.id,
        { 
          originalTemplateId: templateId,
          newTemplateName,
          customizations: Object.keys(customizationRequest.customizations)
        },
        request
      );
    } else {
      // Update existing template
      result = await templateService.updateTemplate(
        templateId,
        customizedTemplate,
        userContext.organizationId,
        userContext.userId
      );

      await logUserActivity(
        userContext,
        'template_customized',
        'template',
        templateId,
        { 
          templateName: originalTemplate.name,
          customizations: Object.keys(customizationRequest.customizations)
        },
        request
      );
    }

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      api_calls: 1,
      templates_customized: 1
    });

    return createSuccessResponse({
      template: result,
      customizations: customizationRequest.customizations,
      isNewTemplate: customizationRequest.saveAsNew
    }, customizationRequest.saveAsNew ? 201 : 200);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid customization data', 400, error.errors);
    }

    console.error('Unexpected error customizing template:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// PUT /api/v1/templates/[id]/customize - AI-powered template customization
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager', 'hr_staff'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to use AI customization',
        403
      );
    }

    // Check usage limits for AI operations
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'ai_requests');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `AI request limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
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
    const aiRequest = aiCustomizeSchema.parse(body);

    const templateService = new TemplateManagementService();
    const openRouter = new OpenRouterClient();
    
    // Get original template
    const originalTemplate = await templateService.getTemplateById(templateId, userContext.organizationId);
    if (!originalTemplate) {
      return createErrorResponse('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }

    // Generate AI customizations
    const aiCustomizations = await generateAICustomizations(
      originalTemplate,
      aiRequest,
      openRouter,
      userContext.organizationId
    );

    // Apply AI-generated customizations
    const customizedTemplate = await applyTemplateCustomizations(
      originalTemplate,
      aiCustomizations,
      userContext.organizationId
    );

    // Create preview version
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log activity
    await logUserActivity(
      userContext,
      'template_ai_customized',
      'template',
      templateId,
      { 
        templateName: originalTemplate.name,
        prompt: aiRequest.prompt,
        language: aiRequest.language,
        focusAreas: aiRequest.focusAreas
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      api_calls: 1,
      ai_requests: 1,
      templates_ai_customized: 1
    });

    return createSuccessResponse({
      previewId,
      originalTemplate: aiRequest.preserveOriginal ? originalTemplate : undefined,
      customizedTemplate,
      aiCustomizations,
      recommendations: aiCustomizations.aiRecommendations || [],
      complianceImpact: aiCustomizations.complianceImpact || {},
      canApply: true,
      metadata: {
        prompt: aiRequest.prompt,
        language: aiRequest.language,
        focusAreas: aiRequest.focusAreas,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid AI customization request', 400, error.errors);
    }

    console.error('Unexpected error in AI template customization:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to apply template customizations
async function applyTemplateCustomizations(
  originalTemplate: any,
  customizations: any,
  organizationId: string
): Promise<any> {
  let customizedContent = originalTemplate.templateContent;
  let customizedFields = [...(originalTemplate.requiredFields || [])];
  let customizedRules = [...(originalTemplate.complianceRules || [])];
  let customizedMetadata = { ...originalTemplate.metadata };

  // Apply company information
  if (customizations.companyInfo) {
    const companyInfo = customizations.companyInfo;
    
    // Replace company placeholders
    if (companyInfo.name) {
      customizedContent = customizedContent.replace(/{{organization_name}}/g, companyInfo.name);
      customizedContent = customizedContent.replace(/{{company_name}}/g, companyInfo.name);
    }
    if (companyInfo.address) {
      customizedContent = customizedContent.replace(/{{organization_address}}/g, companyInfo.address);
    }
    if (companyInfo.phone) {
      customizedContent = customizedContent.replace(/{{organization_phone}}/g, companyInfo.phone);
    }
    if (companyInfo.email) {
      customizedContent = customizedContent.replace(/{{organization_email}}/g, companyInfo.email);
    }
    if (companyInfo.commercialRegistration) {
      customizedContent = customizedContent.replace(/{{commercial_registration}}/g, companyInfo.commercialRegistration);
    }

    customizedMetadata.companyInfo = companyInfo;
  }

  // Apply content customizations
  if (customizations.content) {
    const content = customizations.content;
    
    // Add additional clauses
    if (content.additionalClauses) {
      content.additionalClauses.forEach((clause: any) => {
        const anchorPattern = new RegExp(clause.anchor, 'i');
        const clauseContent = `\n\n${clause.title}:\n${clause.content}`;
        
        if (clause.position === 'before') {
          customizedContent = customizedContent.replace(anchorPattern, `${clauseContent}\n$&`);
        } else {
          customizedContent = customizedContent.replace(anchorPattern, `$&\n${clauseContent}`);
        }
      });
    }

    // Remove sections
    if (content.removedSections) {
      content.removedSections.forEach((section: string) => {
        const sectionPattern = new RegExp(`${section}:.*?(?=\n\n|$)`, 'gis');
        customizedContent = customizedContent.replace(sectionPattern, '');
      });
    }

    // Add custom variables
    if (content.customVariables) {
      Object.entries(content.customVariables).forEach(([key, value]) => {
        customizedContent = customizedContent.replace(
          new RegExp(`{{${key}}}`, 'g'),
          String(value)
        );
        
        // Add field if it doesn't exist
        const existingField = customizedFields.find(field => field.name === key);
        if (!existingField) {
          customizedFields.push({
            name: key,
            type: 'text',
            required: false,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            labelAr: key.replace(/_/g, ' ')
          });
        }
      });
    }
  }

  // Apply compliance customizations
  if (customizations.compliance) {
    if (customizations.compliance.customRules) {
      customizedRules = [...customizedRules, ...customizations.compliance.customRules];
    }
    
    customizedMetadata.complianceMode = customizations.compliance.enableStrictMode ? 'strict' : 'standard';
  }

  // Apply styling metadata
  if (customizations.styling) {
    customizedMetadata.styling = customizations.styling;
  }

  return {
    templateContent: customizedContent,
    requiredFields: customizedFields,
    complianceRules: customizedRules,
    metadata: customizedMetadata
  };
}

// Helper function to generate AI customizations
async function generateAICustomizations(
  template: any,
  aiRequest: any,
  openRouter: OpenRouterClient,
  organizationId: string
): Promise<any> {
  const prompt = buildAICustomizationPrompt(template, aiRequest);
  
  try {
    const response = await openRouter.createChatCompletion({
      messages: [
        {
          role: 'system',
          content: aiRequest.language === 'ar' 
            ? 'أنت خبير في تخصيص وثائق الموارد البشرية المتوافقة مع نظام العمل السعودي. قم بتحليل القالب واقتراح تحسينات.'
            : 'You are an expert in customizing HR documents compliant with Saudi Labor Law. Analyze the template and suggest improvements.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'openai/gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.2
    });

    const aiResponseContent = response.choices[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error('No response from AI service');
    }

    // Parse AI response into customization structure
    return parseAICustomizationResponse(aiResponseContent, template, aiRequest);
    
  } catch (error) {
    console.error('Error generating AI customizations:', error);
    throw new Error('AI customization service unavailable');
  }
}

function buildAICustomizationPrompt(template: any, aiRequest: any): string {
  const language = aiRequest.language;
  const focusAreas = aiRequest.focusAreas || ['compliance', 'content'];
  
  const basePrompt = language === 'ar' ?
    `احلل القالب التالي واقترح تحسينات بناءً على الطلب:

` :
    `Analyze the following template and suggest improvements based on the request:\n\n`;

  const templateInfo = `
Template: ${template.name}
Category: ${template.category}
Language: ${template.language}
Current Content Length: ${template.templateContent.length} characters
Required Fields: ${template.requiredFields?.map((f: any) => f.name).join(', ')}
`;

  const focusPrompt = language === 'ar' ?
    `\nركز على المجالات التالية: ${focusAreas.join(', ')}
` :
    `\nFocus on these areas: ${focusAreas.join(', ')}\n`;

  const userPrompt = language === 'ar' ?
    `\nطلب المستخدم: ${aiRequest.prompt}\n` :
    `\nUser Request: ${aiRequest.prompt}\n`;

  const outputFormat = language === 'ar' ?
    `\nقدم الاقتراحات في تنسيق JSON مع الحقول التالية:
- companyInfo: معلومات الشركة
- styling: التنسيق والألوان
- content: المحتوى والبنود الإضافية
- compliance: قواعد الامتثال
- aiRecommendations: توصيات إضافية
- complianceImpact: تأثير على الامتثال` :
    `\nProvide suggestions in JSON format with these fields:
- companyInfo: company information
- styling: formatting and colors
- content: content and additional clauses
- compliance: compliance rules
- aiRecommendations: additional recommendations
- complianceImpact: compliance impact`;

  return basePrompt + templateInfo + focusPrompt + userPrompt + outputFormat;
}

function parseAICustomizationResponse(aiResponse: string, template: any, aiRequest: any): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
    
    // Fallback: create basic customizations from text response
    return {
      content: {
        additionalClauses: [{
          title: aiRequest.language === 'ar' ? 'بند إضافي' : 'Additional Clause',
          content: aiResponse.substring(0, 200),
          position: 'after',
          anchor: template.category === 'employment' ? 'الالتزامات والواجبات' : 'المتطلبات'
        }]
      },
      aiRecommendations: [aiResponse],
      complianceImpact: {
        score: 85,
        changes: []
      }
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      aiRecommendations: [aiResponse],
      complianceImpact: { score: 50, changes: [] }
    };
  }
}