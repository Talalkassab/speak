import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { OpenRouterClient } from '@/libs/services/openrouter-client';

export interface TemplateCategory {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  iconName?: string;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'select' | 'textarea' | 'boolean';
  required: boolean;
  label: string;
  labelAr?: string;
  placeholder?: string;
  placeholderAr?: string;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface ComplianceRule {
  ruleId: string;
  description: string;
  descriptionAr?: string;
  severity: 'warning' | 'error' | 'info';
  laborLawReference?: string;
  checkFunction?: string;
}

export interface Template {
  id: string;
  organizationId?: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  category: string;
  categoryId?: string;
  language: 'ar' | 'en';
  templateContent: string;
  requiredFields: TemplateField[];
  complianceRules: ComplianceRule[];
  complianceStatus: 'compliant' | 'warning' | 'non_compliant';
  metadata: Record<string, any>;
  isActive: boolean;
  tags: string[];
  usageCount: number;
  requiresApproval: boolean;
  approvalWorkflow: Record<string, any>;
  currentVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  templateContent: string;
  requiredFields: TemplateField[];
  complianceRules: ComplianceRule[];
  changeSummary?: string;
  changeSummaryAr?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  rejectionReasonAr?: string;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateUsage {
  id: string;
  templateId: string;
  templateVersionId?: string;
  organizationId: string;
  usedBy: string;
  parametersUsed: Record<string, any>;
  generationSuccessful: boolean;
  errorMessage?: string;
  processingTimeMs?: number;
  fileFormat: 'pdf' | 'docx' | 'html';
  fileSizeBytes?: number;
  downloadCount: number;
  lastDownloadedAt?: string;
  createdAt: string;
}

export interface GenerateDocumentRequest {
  templateId: string;
  parameters: Record<string, any>;
  language?: 'ar' | 'en';
  format?: 'pdf' | 'docx' | 'html';
  organizationContext?: Record<string, any>;
}

export interface GenerateDocumentResponse {
  id: string;
  templateId: string;
  title: string;
  content: string;
  format: string;
  downloadUrl?: string;
  previewUrl?: string;
  complianceCheck: {
    status: 'compliant' | 'warning' | 'non_compliant';
    score: number;
    issues: ComplianceIssue[];
    recommendations: string[];
  };
  processingTimeMs: number;
  createdAt: string;
}

export interface ComplianceIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'wage' | 'termination' | 'working_hours' | 'leave' | 'safety' | 'general';
  message: string;
  messageAr: string;
  article?: string;
  suggestion?: string;
  suggestionAr?: string;
  ruleId?: string;
}

export class TemplateManagementService {
  private openrouter: OpenRouterClient;

  constructor() {
    this.openrouter = new OpenRouterClient();
  }

  // Template CRUD Operations
  async getTemplates(filters: {
    organizationId: string;
    category?: string;
    language?: 'ar' | 'en';
    search?: string;
    isActive?: boolean;
    includeSystemTemplates?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ templates: Template[]; total: number; categories: TemplateCategory[] }> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { 
        organizationId, 
        category, 
        language, 
        search, 
        isActive = true,
        includeSystemTemplates = true,
        page = 1, 
        limit = 20 
      } = filters;

      let query = supabase
        .from('hr_templates')
        .select(`
          *,
          template_categories(*),
          template_versions!current_version_id(
            id, version_number, approval_status, is_active
          ),
          creator:auth.users!created_by(email, raw_user_meta_data)
        `, { count: 'exact' });

      // Filter by organization or system templates
      if (includeSystemTemplates) {
        query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        query = query.eq('organization_id', organizationId);
      }

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

      // Apply pagination
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data: templates, error, count } = await query;

      if (error) {
        console.error('Error fetching templates:', error);
        throw new Error('Failed to fetch templates');
      }

      // Get categories
      const { data: categories } = await supabase
        .from('template_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      return {
        templates: templates || [],
        total: count || 0,
        categories: categories || []
      };
    } catch (error) {
      console.error('Error in getTemplates:', error);
      throw error;
    }
  }

  async getTemplateById(templateId: string, organizationId: string): Promise<Template | null> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .from('hr_templates')
        .select(`
          *,
          template_categories(*),
          template_versions!current_version_id(
            id, version_number, template_content, required_fields,
            compliance_rules, approval_status, is_active
          ),
          creator:auth.users!created_by(email, raw_user_meta_data)
        `)
        .eq('id', templateId)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .single();

      if (error || !data) {
        return null;
      }

      return data as Template;
    } catch (error) {
      console.error('Error fetching template by ID:', error);
      return null;
    }
  }

  async createTemplate(
    templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'currentVersionId'> & { 
      organizationId: string;
      createdBy: string;
    }
  ): Promise<Template> {
    const supabase = await createSupabaseServerClient();
    
    try {
      // Validate template content
      const validation = await this.validateTemplateContent(
        templateData.templateContent, 
        templateData.requiredFields
      );
      
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.issues.join(', ')}`);
      }

      // Check Saudi labor law compliance
      const complianceCheck = await this.checkSaudiLaborCompliance(
        templateData.templateContent,
        templateData.category,
        templateData.language
      );

      // Create template
      const { data: template, error } = await supabase
        .from('hr_templates')
        .insert({
          organization_id: templateData.organizationId,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          category_id: templateData.categoryId,
          language: templateData.language,
          template_content: templateData.templateContent,
          required_fields: templateData.requiredFields,
          compliance_rules: [...(templateData.complianceRules || []), ...complianceCheck.rules],
          compliance_status: complianceCheck.status,
          metadata: templateData.metadata || {},
          is_active: templateData.isActive,
          tags: templateData.tags || [],
          requires_approval: templateData.requiresApproval || false,
          approval_workflow: templateData.approvalWorkflow || {},
          created_by: templateData.createdBy
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating template:', error);
        throw new Error('Failed to create template');
      }

      // Create initial version
      const versionId = await this.createTemplateVersion(
        template.id,
        templateData.templateContent,
        templateData.requiredFields,
        [...(templateData.complianceRules || []), ...complianceCheck.rules],
        'Initial version',
        'النسخة الأولى',
        templateData.createdBy
      );

      // Update template with current version ID
      await supabase
        .from('hr_templates')
        .update({ current_version_id: versionId })
        .eq('id', template.id);

      return { ...template, currentVersionId: versionId } as Template;
    } catch (error) {
      console.error('Error in createTemplate:', error);
      throw error;
    }
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<Template>,
    organizationId: string,
    userId: string
  ): Promise<Template> {
    const supabase = await createSupabaseServerClient();
    
    try {
      // Check if template exists and user has permission
      const existing = await this.getTemplateById(templateId, organizationId);
      if (!existing) {
        throw new Error('Template not found');
      }

      const { data: template, error } = await supabase
        .from('hr_templates')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          category_id: updates.categoryId,
          language: updates.language,
          metadata: updates.metadata,
          is_active: updates.isActive,
          tags: updates.tags,
          requires_approval: updates.requiresApproval,
          approval_workflow: updates.approvalWorkflow,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating template:', error);
        throw new Error('Failed to update template');
      }

      // If template content changed, create new version
      if (updates.templateContent && updates.templateContent !== existing.templateContent) {
        const validation = await this.validateTemplateContent(
          updates.templateContent, 
          updates.requiredFields || existing.requiredFields
        );
        
        if (!validation.valid) {
          throw new Error(`Template validation failed: ${validation.issues.join(', ')}`);
        }

        await this.createTemplateVersion(
          templateId,
          updates.templateContent,
          updates.requiredFields || existing.requiredFields,
          updates.complianceRules || existing.complianceRules,
          'Template updated',
          'تم تحديث القالب',
          userId
        );
      }

      return template as Template;
    } catch (error) {
      console.error('Error in updateTemplate:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId: string, organizationId: string): Promise<boolean> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { error } = await supabase
        .from('hr_templates')
        .delete()
        .eq('id', templateId)
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error deleting template:', error);
        throw new Error('Failed to delete template');
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTemplate:', error);
      throw error;
    }
  }

  // Template Version Management
  async createTemplateVersion(
    templateId: string,
    content: string,
    requiredFields: TemplateField[],
    complianceRules: ComplianceRule[],
    changeSummary?: string,
    changeSummaryAr?: string,
    createdBy?: string
  ): Promise<string> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .rpc('create_template_version', {
          p_template_id: templateId,
          p_template_content: content,
          p_required_fields: JSON.stringify(requiredFields),
          p_compliance_rules: JSON.stringify(complianceRules),
          p_change_summary: changeSummary,
          p_change_summary_ar: changeSummaryAr,
          p_created_by: createdBy
        });

      if (error) {
        console.error('Error creating template version:', error);
        throw new Error('Failed to create template version');
      }

      return data;
    } catch (error) {
      console.error('Error in createTemplateVersion:', error);
      throw error;
    }
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .from('template_versions')
        .select(`
          *,
          creator:auth.users!created_by(email, raw_user_meta_data),
          approver:auth.users!approved_by(email, raw_user_meta_data)
        `)
        .eq('template_id', templateId)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('Error fetching template versions:', error);
        throw new Error('Failed to fetch template versions');
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTemplateVersions:', error);
      throw error;
    }
  }

  async approveTemplateVersion(versionId: string, approvedBy: string): Promise<boolean> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .rpc('approve_template_version', {
          p_version_id: versionId,
          p_approved_by: approvedBy
        });

      if (error) {
        console.error('Error approving template version:', error);
        throw new Error('Failed to approve template version');
      }

      return data;
    } catch (error) {
      console.error('Error in approveTemplateVersion:', error);
      throw error;
    }
  }

  // Template Categories
  async getTemplateCategories(language: 'ar' | 'en' = 'ar'): Promise<TemplateCategory[]> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .from('template_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Error fetching template categories:', error);
        throw new Error('Failed to fetch template categories');
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTemplateCategories:', error);
      throw error;
    }
  }

  // Document Generation
  async generateDocument(request: GenerateDocumentRequest, organizationId: string, userId: string): Promise<GenerateDocumentResponse> {
    const startTime = Date.now();
    
    try {
      // Get template
      const template = await this.getTemplateById(request.templateId, organizationId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Validate parameters
      const validation = await this.validateParameters(template.requiredFields, request.parameters);
      if (!validation.valid) {
        throw new Error(`Parameter validation failed: ${validation.issues.join(', ')}`);
      }

      // Get organization context
      const orgContext = request.organizationContext || await this.getOrganizationContext(organizationId);

      // Generate content
      const content = await this.generateDocumentContent(
        template, 
        request.parameters, 
        orgContext, 
        request.language || template.language
      );

      // Check compliance
      const complianceCheck = await this.checkSaudiLaborCompliance(
        content,
        template.category,
        request.language || template.language
      );

      const processingTime = Date.now() - startTime;

      // Track usage
      await this.trackTemplateUsage(
        request.templateId,
        request.parameters,
        request.format || 'pdf',
        Buffer.byteLength(content, 'utf8'),
        true,
        null,
        processingTime,
        organizationId,
        userId
      );

      const result: GenerateDocumentResponse = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId: request.templateId,
        title: this.generateDocumentTitle(template, request.parameters, request.language || template.language),
        content,
        format: request.format || 'pdf',
        complianceCheck: {
          status: complianceCheck.status,
          score: complianceCheck.score,
          issues: complianceCheck.issues,
          recommendations: complianceCheck.recommendations
        },
        processingTimeMs: processingTime,
        createdAt: new Date().toISOString()
      };

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackTemplateUsage(
        request.templateId,
        request.parameters,
        request.format || 'pdf',
        0,
        false,
        error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        organizationId,
        userId
      );

      console.error('Error in generateDocument:', error);
      throw error;
    }
  }

  // Variable Substitution
  async substituteVariables(
    content: string, 
    parameters: Record<string, any>, 
    language: 'ar' | 'en' = 'ar'
  ): Promise<string> {
    let substitutedContent = content;
    
    // Basic variable substitution
    for (const [key, value] of Object.entries(parameters)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      substitutedContent = substitutedContent.replace(regex, String(value || ''));
    }

    // Add system variables
    const systemVars = {
      current_date: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US'),
      current_date_hijri: this.getHijriDate(),
      current_time: new Date().toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US'),
      organization_name: parameters.organization_name || 'شركة',
      year: new Date().getFullYear().toString(),
      month: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' })
    };

    for (const [key, value] of Object.entries(systemVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      substitutedContent = substitutedContent.replace(regex, value);
    }

    return substitutedContent;
  }

  // Helper Methods
  private async validateTemplateContent(content: string, requiredFields: TemplateField[]): Promise<{ valid: boolean; issues: string[] }> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .rpc('validate_template_content', {
          p_content: content,
          p_required_fields: JSON.stringify(requiredFields)
        });

      if (error) {
        console.error('Error validating template content:', error);
        return { valid: false, issues: ['Validation service unavailable'] };
      }

      return data[0] || { valid: false, issues: ['Unknown validation error'] };
    } catch (error) {
      console.error('Error in validateTemplateContent:', error);
      return { valid: false, issues: ['Validation service error'] };
    }
  }

  private async validateParameters(requiredFields: TemplateField[], parameters: Record<string, any>): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    for (const field of requiredFields) {
      if (field.required && (!parameters[field.name] || parameters[field.name] === '')) {
        issues.push(`Missing required field: ${field.label || field.name}`);
        continue;
      }

      const value = parameters[field.name];
      if (value && field.validation) {
        const validation = field.validation;
        
        if (field.type === 'text' || field.type === 'textarea') {
          if (validation.minLength && value.length < validation.minLength) {
            issues.push(`${field.name} must be at least ${validation.minLength} characters`);
          }
          if (validation.maxLength && value.length > validation.maxLength) {
            issues.push(`${field.name} must be at most ${validation.maxLength} characters`);
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            issues.push(`${field.name} format is invalid`);
          }
        }

        if (field.type === 'number') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            issues.push(`${field.name} must be a number`);
          } else {
            if (validation.min !== undefined && numValue < validation.min) {
              issues.push(`${field.name} must be at least ${validation.min}`);
            }
            if (validation.max !== undefined && numValue > validation.max) {
              issues.push(`${field.name} must be at most ${validation.max}`);
            }
          }
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private async generateDocumentContent(
    template: Template,
    parameters: Record<string, any>,
    orgContext: any,
    language: 'ar' | 'en'
  ): Promise<string> {
    try {
      // First substitute variables
      let content = await this.substituteVariables(template.templateContent, parameters, language);

      // Use AI to improve the content
      const prompt = language === 'ar' 
        ? `راجع وحسّن المستند التالي للموارد البشرية باللغة العربية. تأكد من أنه مهني ومتوافق مع نظام العمل السعودي ومنسق بشكل صحيح:\n\n${content}`
        : `Review and improve the following HR document in English. Ensure it is professional, compliant with Saudi Labor Law, and properly formatted:\n\n${content}`;

      const response = await this.openrouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: language === 'ar' 
              ? 'أنت خبير في إعداد الوثائق القانونية للموارد البشرية المتوافقة مع نظام العمل السعودي.'
              : 'You are an expert in preparing HR legal documents compliant with Saudi Labor Law.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'openai/gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      console.error('Error generating document content:', error);
      // Return substituted content as fallback
      return this.substituteVariables(template.templateContent, parameters, language);
    }
  }

  private async checkSaudiLaborCompliance(
    content: string,
    category: string,
    language: 'ar' | 'en'
  ): Promise<{
    status: 'compliant' | 'warning' | 'non_compliant';
    score: number;
    issues: ComplianceIssue[];
    recommendations: string[];
    rules: ComplianceRule[];
  }> {
    try {
      // Build compliance check prompt
      const prompt = `Analyze the following ${language} HR document for Saudi Labor Law compliance:

Document Category: ${category}
Content:
${content}

Provide compliance analysis in JSON format:
{
  "status": "compliant|warning|non_compliant",
  "score": 85,
  "issues": [
    {
      "severity": "error|warning|info",
      "category": "wage|termination|working_hours|leave|safety|general",
      "message": "Issue description",
      "messageAr": "وصف المشكلة",
      "suggestion": "How to fix",
      "suggestionAr": "كيفية الإصلاح",
      "ruleId": "rule_identifier"
    }
  ],
  "recommendations": ["Recommendation 1"],
  "rules": [
    {
      "ruleId": "rule_1",
      "description": "Rule description",
      "severity": "error|warning",
      "laborLawReference": "Article reference"
    }
  ]
}`;

      const response = await this.openrouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a Saudi Labor Law compliance expert. Analyze documents and return JSON compliance reports.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'openai/gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.1
      });

      try {
        const analysisContent = response.choices[0]?.message?.content || '{}';
        const analysis = JSON.parse(analysisContent);
        
        return {
          status: analysis.status || 'warning',
          score: analysis.score || 50,
          issues: analysis.issues || [],
          recommendations: analysis.recommendations || [],
          rules: analysis.rules || []
        };
      } catch (parseError) {
        console.error('Error parsing compliance response:', parseError);
        return this.getDefaultComplianceResult();
      }
    } catch (error) {
      console.error('Error checking Saudi labor compliance:', error);
      return this.getDefaultComplianceResult();
    }
  }

  private getDefaultComplianceResult() {
    return {
      status: 'warning' as const,
      score: 50,
      issues: [{
        severity: 'warning' as const,
        category: 'general' as const,
        message: 'Could not complete automated compliance check',
        messageAr: 'لا يمكن إكمال فحص الامتثال التلقائي',
        ruleId: 'compliance_check_failed'
      }],
      recommendations: ['Please review document manually for Saudi Labor Law compliance'],
      rules: []
    };
  }

  private async trackTemplateUsage(
    templateId: string,
    parameters: Record<string, any>,
    format: string,
    fileSize: number,
    success: boolean,
    errorMessage: string | null,
    processingTime: number,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();
    
    try {
      await supabase.rpc('track_template_usage', {
        p_template_id: templateId,
        p_parameters: JSON.stringify(parameters),
        p_format: format,
        p_file_size: fileSize,
        p_success: success,
        p_error_message: errorMessage,
        p_processing_time: processingTime
      });
    } catch (error) {
      console.error('Error tracking template usage:', error);
      // Don't throw error as this is non-critical
    }
  }

  private generateDocumentTitle(template: Template, parameters: Record<string, any>, language: 'ar' | 'en'): string {
    const baseName = template.name;
    
    // Add contextual information if available
    if (parameters.employee_name || parameters.employeeName) {
      const employeeName = parameters.employee_name || parameters.employeeName;
      return `${baseName} - ${employeeName}`;
    }
    
    if (parameters.policy_name || parameters.policyName) {
      const policyName = parameters.policy_name || parameters.policyName;
      return `${baseName} - ${policyName}`;
    }

    return `${baseName} - ${new Date().toLocaleDateString()}`;
  }

  private async getOrganizationContext(organizationId: string): Promise<any> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('name, country_code, timezone, language_code, metadata')
        .eq('id', organizationId)
        .single();

      return data || {};
    } catch (error) {
      console.error('Error getting organization context:', error);
      return {};
    }
  }

  private getHijriDate(): string {
    // Simple Hijri date approximation - in production use proper library
    const gregorianDate = new Date();
    const hijriYear = gregorianDate.getFullYear() - 579;
    const hijriMonth = gregorianDate.getMonth() + 1;
    const hijriDay = gregorianDate.getDate();
    
    return `${hijriDay}/${hijriMonth}/${hijriYear} هـ`;
  }
}

export default TemplateManagementService;