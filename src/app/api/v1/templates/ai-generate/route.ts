import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import TemplateManagementService from '@/libs/services/template-management-service';
import { OpenRouterClient } from '@/libs/services/openrouter-client';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Schema for AI template generation
const aiGenerateTemplateSchema = z.object({
  templateType: z.enum([
    'employment_contract',
    'termination_letter', 
    'leave_policy',
    'performance_review',
    'warning_letter',
    'salary_certificate',
    'job_description',
    'company_policy',
    'custom'
  ]),
  jobRole: z.string().min(1).max(200).optional(),
  industry: z.string().min(1).max(100).optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  language: z.enum(['ar', 'en']).default('ar'),
  requirements: z.object({
    mustInclude: z.array(z.string()).default([]),
    mustAvoid: z.array(z.string()).default([]),
    specialClauses: z.array(z.string()).default([]),
    complianceLevel: z.enum(['basic', 'standard', 'strict']).default('standard')
  }).default({}),
  customPrompt: z.string().max(1000).optional(),
  baseTemplateId: z.string().uuid().optional(), // For customizing existing templates
  generateVariations: z.boolean().default(false),
  includeFieldSuggestions: z.boolean().default(true)
});

const smartFieldsSchema = z.object({
  templateContent: z.string().min(50),
  language: z.enum(['ar', 'en']).default('ar'),
  category: z.string().optional()
});

interface GeneratedTemplate {
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  category: string;
  language: 'ar' | 'en';
  templateContent: string;
  requiredFields: any[];
  complianceRules: any[];
  metadata: {
    aiGenerated: boolean;
    generationPrompt: string;
    baseTemplate?: string;
    confidence: number;
    suggestions?: string[];
    variationOf?: string;
  };
  tags: string[];
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

// POST /api/v1/templates/ai-generate - Generate template using AI
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for AI template generation
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions for AI template generation',
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

    // Parse and validate request body
    const body = await request.json();
    const generationRequest = aiGenerateTemplateSchema.parse(body);

    const openRouter = new OpenRouterClient();
    const templateService = new TemplateManagementService();
    
    let baseTemplate = null;
    if (generationRequest.baseTemplateId) {
      baseTemplate = await templateService.getTemplateById(
        generationRequest.baseTemplateId, 
        userContext.organizationId
      );
      if (!baseTemplate) {
        return createErrorResponse('BASE_TEMPLATE_NOT_FOUND', 'Base template not found', 404);
      }
    }

    // Generate AI template
    const generatedTemplates = await generateAITemplate(
      generationRequest,
      baseTemplate,
      openRouter,
      userContext.organizationId
    );

    // Create templates in database if requested
    const createdTemplates = [];
    
    for (const template of generatedTemplates) {
      try {
        const created = await templateService.createTemplate({
          ...template,
          organizationId: userContext.organizationId,
          createdBy: userContext.userId,
          isActive: false, // Start as draft
          complianceStatus: 'warning' // Will be updated by compliance check
        });
        createdTemplates.push(created);
      } catch (error) {
        console.error('Error creating AI-generated template:', error);
        // Continue with other templates
      }
    }

    // Log activity
    await logUserActivity(
      userContext,
      'ai_template_generated',
      'template',
      undefined,
      { 
        templateType: generationRequest.templateType,
        language: generationRequest.language,
        templatesCreated: createdTemplates.length,
        jobRole: generationRequest.jobRole,
        industry: generationRequest.industry
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      api_calls: 1,
      ai_requests: 1,
      templates_generated: createdTemplates.length
    });

    return createSuccessResponse({
      generatedTemplates: createdTemplates,
      totalGenerated: generatedTemplates.length,
      metadata: {
        templateType: generationRequest.templateType,
        language: generationRequest.language,
        basedOn: baseTemplate?.name,
        aiModel: 'gpt-4o-mini',
        generationTime: Date.now()
      }
    }, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid generation request', 400, error.errors);
    }

    console.error('Unexpected error in AI template generation:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// PUT /api/v1/templates/ai-generate - Smart field suggestions
export async function PUT(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'ai_requests');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `AI request limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { templateContent, language, category } = smartFieldsSchema.parse(body);

    const openRouter = new OpenRouterClient();
    
    // Generate smart field suggestions
    const fieldSuggestions = await generateSmartFields(
      templateContent,
      language,
      category,
      openRouter
    );

    // Log activity
    await logUserActivity(
      userContext,
      'smart_fields_generated',
      'template',
      undefined,
      { 
        contentLength: templateContent.length,
        language,
        category,
        fieldsGenerated: fieldSuggestions.fields.length
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { 
      api_calls: 1,
      ai_requests: 1
    });

    return createSuccessResponse({
      suggestedFields: fieldSuggestions.fields,
      complianceRules: fieldSuggestions.complianceRules,
      recommendations: fieldSuggestions.recommendations,
      confidence: fieldSuggestions.confidence,
      metadata: {
        language,
        category,
        analysisTime: Date.now()
      }
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid smart fields request', 400, error.errors);
    }

    console.error('Unexpected error generating smart fields:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to generate AI templates
async function generateAITemplate(
  request: any,
  baseTemplate: any,
  openRouter: OpenRouterClient,
  organizationId: string
): Promise<GeneratedTemplate[]> {
  const prompt = buildTemplateGenerationPrompt(request, baseTemplate);
  
  try {
    const response = await openRouter.createChatCompletion({
      messages: [
        {
          role: 'system',
          content: request.language === 'ar' 
            ? 'أنت خبير في إعداد وثائق الموارد البشرية المتوافقة مع نظام العمل السعودي. قم بإنشاء قوالب مهنية ومتوافقة.'
            : 'You are an expert in creating HR documents compliant with Saudi Labor Law. Generate professional and compliant templates.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'openai/gpt-4o-mini',
      max_tokens: 3000,
      temperature: 0.3
    });

    const aiResponseContent = response.choices[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error('No response from AI service');
    }

    // Parse AI response into template structure
    return parseAITemplateResponse(aiResponseContent, request);
    
  } catch (error) {
    console.error('Error generating AI template:', error);
    throw new Error('AI template generation service unavailable');
  }
}

function buildTemplateGenerationPrompt(request: any, baseTemplate: any): string {
  const { templateType, jobRole, industry, companySize, language, requirements, customPrompt } = request;
  const isArabic = language === 'ar';
  
  let prompt = isArabic ? 
    `إنشاء قالب موارد بشرية باللغة العربية:\n\n` :
    `Generate an HR template in English:\n\n`;
  
  // Template type
  const templateTypeMap: Record<string, { ar: string; en: string }> = {
    employment_contract: { ar: 'عقد عمل', en: 'Employment Contract' },
    termination_letter: { ar: 'خطاب إنهاء خدمة', en: 'Termination Letter' },
    leave_policy: { ar: 'سياسة الإجازات', en: 'Leave Policy' },
    performance_review: { ar: 'تقييم الأداء', en: 'Performance Review' },
    warning_letter: { ar: 'خطاب تحذير', en: 'Warning Letter' },
    salary_certificate: { ar: 'شهادة راتب', en: 'Salary Certificate' },
    job_description: { ar: 'الوصف الوظيفي', en: 'Job Description' },
    company_policy: { ar: 'سياسة الشركة', en: 'Company Policy' }
  };
  
  const templateTypeName = templateTypeMap[templateType]?.[language] || templateType;
  prompt += isArabic ? 
    `نوع القالب: ${templateTypeName}\n` :
    `Template Type: ${templateTypeName}\n`;
  
  // Job role and context
  if (jobRole) {
    prompt += isArabic ? 
      `الوظيفة: ${jobRole}\n` :
      `Job Role: ${jobRole}\n`;
  }
  
  if (industry) {
    prompt += isArabic ? 
      `القطاع: ${industry}\n` :
      `Industry: ${industry}\n`;
  }
  
  if (companySize) {
    prompt += isArabic ? 
      `حجم الشركة: ${companySize}\n` :
      `Company Size: ${companySize}\n`;
  }
  
  // Requirements
  if (requirements.mustInclude.length > 0) {
    prompt += isArabic ? 
      `\nيجب أن يتضمن: ${requirements.mustInclude.join(', ')}\n` :
      `\nMust Include: ${requirements.mustInclude.join(', ')}\n`;
  }
  
  if (requirements.mustAvoid.length > 0) {
    prompt += isArabic ? 
      `يجب تجنب: ${requirements.mustAvoid.join(', ')}\n` :
      `Must Avoid: ${requirements.mustAvoid.join(', ')}\n`;
  }
  
  if (requirements.specialClauses.length > 0) {
    prompt += isArabic ? 
      `بنود خاصة: ${requirements.specialClauses.join(', ')}\n` :
      `Special Clauses: ${requirements.specialClauses.join(', ')}\n`;
  }
  
  // Compliance level
  prompt += isArabic ? 
    `\nمستوى الامتثال: ${requirements.complianceLevel}\n` :
    `\nCompliance Level: ${requirements.complianceLevel}\n`;
  
  // Custom prompt
  if (customPrompt) {
    prompt += isArabic ? 
      `\nمتطلبات إضافية: ${customPrompt}\n` :
      `\nAdditional Requirements: ${customPrompt}\n`;
  }
  
  // Base template reference
  if (baseTemplate) {
    prompt += isArabic ? 
      `\nقالب مرجعي: ${baseTemplate.name}\nمحتوى القالب المرجعي: ${baseTemplate.templateContent.substring(0, 500)}...\n` :
      `\nBase Template: ${baseTemplate.name}\nBase Content: ${baseTemplate.templateContent.substring(0, 500)}...\n`;
  }
  
  // Output format instructions
  prompt += isArabic ? 
    `\nقم بإنشاء القالب في تنسيق JSON مع الحقول التالية:
{
  "name": "اسم القالب",
  "description": "وصف القالب",
  "category": "فئة القالب",
  "templateContent": "محتوى القالب مع المتغيرات {{variable_name}}",
  "requiredFields": [
    {
      "name": "اسم المتغير",
      "type": "text|number|date|email|select|textarea",
      "required": true,
      "label": "تسمية الحقل",
      "labelAr": "التسمية بالعربية"
    }
  ],
  "complianceRules": [
    {
      "ruleId": "معرف القاعدة",
      "description": "وصف القاعدة",
      "severity": "warning|error|info",
      "laborLawReference": "مرجع نظام العمل"
    }
  ],
  "tags": ["علامات", "القالب"]
}\n\nتأكد من التوافق مع نظام العمل السعودي واستخدام المصطلحات القانونية الصحيحة.` :
    `\nGenerate the template in JSON format with these fields:
{
  "name": "Template Name",
  "description": "Template Description",
  "category": "Template Category",
  "templateContent": "Template content with variables {{variable_name}}",
  "requiredFields": [
    {
      "name": "variable_name",
      "type": "text|number|date|email|select|textarea",
      "required": true,
      "label": "Field Label",
      "labelAr": "Arabic Label"
    }
  ],
  "complianceRules": [
    {
      "ruleId": "rule_id",
      "description": "Rule Description",
      "severity": "warning|error|info",
      "laborLawReference": "Labor Law Reference"
    }
  ],
  "tags": ["template", "tags"]
}\n\nEnsure compliance with Saudi Labor Law and use correct legal terminology.`;
  
  return prompt;
}

function parseAITemplateResponse(aiResponse: string, request: any): GeneratedTemplate[] {
  try {
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const template: GeneratedTemplate = {
      name: parsed.name || `AI Generated ${request.templateType}`,
      nameAr: request.language === 'ar' ? parsed.name : parsed.nameAr,
      description: parsed.description || 'AI generated template',
      descriptionAr: request.language === 'ar' ? parsed.description : parsed.descriptionAr,
      category: mapCategoryToEnum(parsed.category || request.templateType),
      language: request.language,
      templateContent: parsed.templateContent,
      requiredFields: parsed.requiredFields || [],
      complianceRules: parsed.complianceRules || [],
      metadata: {
        aiGenerated: true,
        generationPrompt: request.customPrompt || request.templateType,
        baseTemplate: request.baseTemplateId,
        confidence: 0.85,
        suggestions: parsed.suggestions || []
      },
      tags: [...(parsed.tags || []), 'ai-generated', request.templateType]
    };
    
    const templates = [template];
    
    // Generate variations if requested
    if (request.generateVariations && templates.length === 1) {
      // Create a simplified variation
      const variation: GeneratedTemplate = {
        ...template,
        name: `${template.name} - Simplified`,
        nameAr: template.nameAr ? `${template.nameAr} - مبسط` : undefined,
        description: `Simplified version of ${template.description}`,
        templateContent: simplifyTemplateContent(template.templateContent, request.language),
        metadata: {
          ...template.metadata,
          variationOf: template.name,
          confidence: 0.75
        },
        tags: [...template.tags, 'simplified', 'variation']
      };
      templates.push(variation);
    }
    
    return templates;
    
  } catch (error) {
    console.error('Error parsing AI template response:', error);
    
    // Fallback: create basic template from response text
    return [{
      name: `AI Generated ${request.templateType}`,
      description: 'AI generated template (parsing failed)',
      category: mapCategoryToEnum(request.templateType),
      language: request.language,
      templateContent: aiResponse.substring(0, 1000),
      requiredFields: [],
      complianceRules: [],
      metadata: {
        aiGenerated: true,
        generationPrompt: request.customPrompt || request.templateType,
        confidence: 0.5,
        parsingFailed: true
      },
      tags: ['ai-generated', 'parsing-failed', request.templateType]
    }];
  }
}

function mapCategoryToEnum(category: string): string {
  const mapping: Record<string, string> = {
    employment_contract: 'employment',
    termination_letter: 'letters',
    leave_policy: 'hr_policies',
    performance_review: 'forms',
    warning_letter: 'letters',
    salary_certificate: 'letters',
    job_description: 'forms',
    company_policy: 'hr_policies'
  };
  
  return mapping[category] || 'forms';
}

function simplifyTemplateContent(content: string, language: 'ar' | 'en'): string {
  // Remove complex clauses and simplify language
  let simplified = content;
  
  // Remove sections that are typically complex
  const complexSections = language === 'ar' ? 
    ['التزامات إضافية', 'البنود القانونية المتقدمة', 'الشروط المعقدة'] :
    ['Additional Obligations', 'Advanced Legal Clauses', 'Complex Terms'];
  
  complexSections.forEach(section => {
    const sectionPattern = new RegExp(`${section}:.*?(?=\n\n|$)`, 'gis');
    simplified = simplified.replace(sectionPattern, '');
  });
  
  return simplified.trim();
}

// Helper function to generate smart field suggestions
async function generateSmartFields(
  templateContent: string,
  language: 'ar' | 'en',
  category: string | undefined,
  openRouter: OpenRouterClient
): Promise<any> {
  const prompt = language === 'ar' ?
    `حلل النص التالي واقترح الحقول المطلوبة والقواعد للامتثال:

${templateContent}

قدم النتيجة في تنسيق JSON مع:
- fields: مصفوفة من الحقول المقترحة
- complianceRules: قواعد الامتثال
- recommendations: توصيات للتحسين
- confidence: مستوى الثقة (0-1)` :
    `Analyze the following text and suggest required fields and compliance rules:

${templateContent}

Provide the result in JSON format with:
- fields: array of suggested fields
- complianceRules: compliance rules
- recommendations: improvement recommendations
- confidence: confidence level (0-1)`;
  
  try {
    const response = await openRouter.createChatCompletion({
      messages: [
        {
          role: 'system',
          content: language === 'ar' ? 
            'أنت خبير في تحليل وثائق الموارد البشرية واقتراح الحقول المطلوبة.' :
            'You are an expert in analyzing HR documents and suggesting required fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'openai/gpt-4o-mini',
      max_tokens: 1500,
      temperature: 0.2
    });

    const aiResponseContent = response.choices[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error('No response from AI service');
    }

    // Parse the JSON response
    const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      fields: [],
      complianceRules: [],
      recommendations: [aiResponseContent],
      confidence: 0.5
    };
    
  } catch (error) {
    console.error('Error generating smart fields:', error);
    return {
      fields: [],
      complianceRules: [],
      recommendations: ['Smart field analysis unavailable'],
      confidence: 0
    };
  }
}