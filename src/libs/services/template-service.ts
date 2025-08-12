import { OpenAI } from 'openai';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export interface TemplateType {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: 'contract' | 'policy' | 'letter' | 'form' | 'notice';
  requiredFields: TemplateField[];
  saudiLawCompliance: boolean;
}

export interface TemplateField {
  key: string;
  name: string;
  nameAr: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  required: boolean;
  options?: { value: string; label: string; labelAr: string }[];
  placeholder?: string;
  placeholderAr?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface GeneratedDocument {
  id: string;
  templateType: string;
  title: string;
  content: string;
  language: 'ar' | 'en';
  data: Record<string, any>;
  complianceChecked: boolean;
  complianceStatus: 'compliant' | 'non_compliant' | 'warning';
  complianceIssues: ComplianceIssue[];
  generatedBy: string;
  organizationId: string;
  downloadUrl?: string;
  createdAt: Date;
}

export interface ComplianceResult {
  status: 'compliant' | 'non_compliant' | 'warning';
  score: number; // 0-100
  issues: ComplianceIssue[];
  recommendations: string[];
  saudiLawArticles: Array<{
    articleNumber: string;
    title: string;
    relevance: 'high' | 'medium' | 'low';
    compliance: 'compliant' | 'violation' | 'unclear';
  }>;
}

export interface ComplianceIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'wage' | 'termination' | 'working_hours' | 'leave' | 'safety' | 'general';
  message: string;
  messageAr: string;
  article?: string;
  suggestion?: string;
  suggestionAr?: string;
}

export interface ContractData {
  // Employee Information
  employeeName: string;
  employeeNameAr: string;
  nationality: string;
  passportNumber?: string;
  nationalId?: string;
  position: string;
  positionAr: string;
  department: string;
  departmentAr: string;
  
  // Contract Details
  contractType: 'permanent' | 'temporary' | 'probation';
  startDate: string;
  endDate?: string;
  probationPeriod?: number; // months
  
  // Compensation
  basicSalary: number;
  currency: string;
  allowances?: Array<{
    type: string;
    amount: number;
    description?: string;
  }>;
  
  // Work Details
  workingHours: number; // hours per week
  workLocation: string;
  workLocationAr: string;
  
  // Company Information
  companyName: string;
  companyNameAr: string;
  companyAddress: string;
  companyAddressAr: string;
  companyLicense: string;
}

export interface TerminationData {
  employeeName: string;
  employeeNameAr: string;
  position: string;
  positionAr: string;
  terminationDate: string;
  terminationType: 'resignation' | 'dismissal' | 'contract_end' | 'mutual_agreement';
  reason?: string;
  reasonAr?: string;
  noticePeriod: number; // days
  endOfServiceGratuity: number;
  finalSettlement: number;
  currency: string;
}

export interface PolicyData {
  policyName: string;
  policyNameAr: string;
  policyType: 'leave' | 'attendance' | 'conduct' | 'safety' | 'benefits';
  effectiveDate: string;
  lastReviewDate?: string;
  nextReviewDate: string;
  applicableRoles: string[];
  policyContent: Array<{
    section: string;
    sectionAr: string;
    content: string;
    contentAr: string;
  }>;
}

export class TemplateService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Get all available template types
   */
  async getAvailableTemplates(language: 'ar' | 'en' = 'ar'): Promise<TemplateType[]> {
    return [
      {
        id: 'employment_contract',
        name: 'Employment Contract',
        nameAr: 'عقد عمل',
        description: 'Standard employment contract compliant with Saudi Labor Law',
        descriptionAr: 'عقد عمل معياري متوافق مع نظام العمل السعودي',
        category: 'contract',
        saudiLawCompliance: true,
        requiredFields: this.getEmploymentContractFields()
      },
      {
        id: 'termination_letter',
        name: 'Employment Termination Letter',
        nameAr: 'خطاب إنهاء خدمة',
        description: 'Official termination letter with end-of-service calculations',
        descriptionAr: 'خطاب إنهاء خدمة رسمي مع حساب مكافأة نهاية الخدمة',
        category: 'letter',
        saudiLawCompliance: true,
        requiredFields: this.getTerminationLetterFields()
      },
      {
        id: 'leave_policy',
        name: 'Leave Policy',
        nameAr: 'سياسة الإجازات',
        description: 'Comprehensive leave policy aligned with Saudi regulations',
        descriptionAr: 'سياسة إجازات شاملة متوافقة مع الأنظمة السعودية',
        category: 'policy',
        saudiLawCompliance: true,
        requiredFields: this.getLeavePolicyFields()
      },
      {
        id: 'wage_certificate',
        name: 'Salary Certificate',
        nameAr: 'شهادة راتب',
        description: 'Official salary certificate for employees',
        descriptionAr: 'شهادة راتب رسمية للموظفين',
        category: 'letter',
        saudiLawCompliance: true,
        requiredFields: this.getWageCertificateFields()
      },
      {
        id: 'disciplinary_notice',
        name: 'Disciplinary Notice',
        nameAr: 'إنذار تأديبي',
        description: 'Formal disciplinary notice following due process',
        descriptionAr: 'إنذار تأديبي رسمي وفقاً للإجراءات القانونية',
        category: 'notice',
        saudiLawCompliance: true,
        requiredFields: this.getDisciplinaryNoticeFields()
      }
    ];
  }

  /**
   * Get template structure by type
   */
  async getTemplateStructure(templateType: string): Promise<TemplateType | null> {
    const templates = await this.getAvailableTemplates();
    return templates.find(t => t.id === templateType) || null;
  }

  /**
   * Generate document using AI based on template and data
   */
  async generateDocument(
    templateType: string,
    data: Record<string, any>,
    organizationId: string,
    userId: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<GeneratedDocument> {
    try {
      // Get template structure
      const template = await this.getTemplateStructure(templateType);
      if (!template) {
        throw new Error('Template type not found');
      }

      // Validate required fields
      this.validateTemplateData(template, data);

      // Get organization context
      const orgContext = await this.getOrganizationContext(organizationId);

      // Generate document content using AI
      const content = await this.generateDocumentContent(template, data, orgContext, language);

      // Check Saudi law compliance
      const complianceResult = await this.validateCompliance(content, templateType);

      // Save generated document
      const generatedDoc = await this.saveGeneratedDocument({
        templateType,
        title: this.generateDocumentTitle(template, data, language),
        content,
        language,
        data,
        complianceStatus: complianceResult.status,
        complianceIssues: complianceResult.issues,
        generatedBy: userId,
        organizationId
      });

      return generatedDoc;

    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }

  /**
   * Generate employment contract specifically
   */
  async generateEmploymentContract(
    data: ContractData,
    organizationId: string,
    userId: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<GeneratedDocument> {
    return this.generateDocument('employment_contract', data, organizationId, userId, language);
  }

  /**
   * Generate termination letter
   */
  async generateTerminationLetter(
    data: TerminationData,
    organizationId: string,
    userId: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<GeneratedDocument> {
    return this.generateDocument('termination_letter', data, organizationId, userId, language);
  }

  /**
   * Generate leave policy
   */
  async generateLeavePolicy(
    data: PolicyData,
    organizationId: string,
    userId: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<GeneratedDocument> {
    return this.generateDocument('leave_policy', data, organizationId, userId, language);
  }

  /**
   * Validate document compliance with Saudi Labor Law
   */
  async validateCompliance(
    documentContent: string,
    documentType: string
  ): Promise<ComplianceResult> {
    try {
      // Get relevant Saudi law articles for this document type
      const relevantLaws = await this.getRelevantLaborLaws(documentType);

      // Use AI to analyze compliance
      const prompt = this.buildCompliancePrompt(documentContent, relevantLaws, documentType);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in Saudi Labor Law compliance. Analyze the provided document and return a detailed compliance assessment in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const analysisContent = response.choices[0]?.message?.content || '{}';
      
      try {
        const analysis = JSON.parse(analysisContent);
        return this.formatComplianceResult(analysis);
      } catch (parseError) {
        console.error('Error parsing AI compliance response:', parseError);
        return this.getDefaultComplianceResult();
      }

    } catch (error) {
      console.error('Error validating compliance:', error);
      return this.getDefaultComplianceResult();
    }
  }

  /**
   * Fill existing template with provided data
   */
  async fillTemplate(
    templateType: string,
    templateContent: string,
    data: Record<string, any>,
    language: 'ar' | 'en' = 'ar'
  ): Promise<string> {
    let filledContent = templateContent;

    // Replace placeholders with actual data
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      filledContent = filledContent.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Use AI to improve and finalize the content
    const prompt = `
    Please review and improve the following ${language === 'ar' ? 'Arabic' : 'English'} HR document:
    
    ${filledContent}
    
    Ensure it is:
    1. Professionally written
    2. Legally compliant with Saudi Labor Law
    3. Clear and concise
    4. Properly formatted
    
    Return only the improved document content.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2
      });

      return response.choices[0]?.message?.content || filledContent;

    } catch (error) {
      console.error('Error improving filled template:', error);
      return filledContent;
    }
  }

  /**
   * Generate document content using AI
   */
  private async generateDocumentContent(
    template: TemplateType,
    data: Record<string, any>,
    orgContext: any,
    language: 'ar' | 'en'
  ): Promise<string> {
    const prompt = this.buildDocumentPrompt(template, data, orgContext, language);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: language === 'ar' 
              ? 'أنت خبير في إعداد الوثائق القانونية للموارد البشرية المتوافقة مع نظام العمل السعودي. اكتب باللغة العربية الفصحى.'
              : 'You are an expert in preparing HR legal documents compliant with Saudi Labor Law. Write in professional English.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content || '';

    } catch (error) {
      console.error('Error generating document content:', error);
      throw new Error('Failed to generate document content');
    }
  }

  /**
   * Build AI prompt for document generation
   */
  private buildDocumentPrompt(
    template: TemplateType,
    data: Record<string, any>,
    orgContext: any,
    language: 'ar' | 'en'
  ): string {
    const templateName = language === 'ar' ? template.nameAr : template.name;
    const templateDesc = language === 'ar' ? template.descriptionAr : template.description;
    
    let prompt = `Generate a professional ${templateName} (${templateDesc}) with the following details:\n\n`;

    // Add data fields
    prompt += 'Data provided:\n';
    for (const [key, value] of Object.entries(data)) {
      prompt += `- ${key}: ${value}\n`;
    }

    // Add organization context
    if (orgContext) {
      prompt += `\nOrganization: ${orgContext.name}\n`;
      prompt += `Country: ${orgContext.country_code || 'SA'}\n`;
    }

    // Add compliance requirements
    if (template.saudiLawCompliance) {
      prompt += language === 'ar'
        ? '\n\nمتطلبات مهمة:\n- يجب أن تكون الوثيقة متوافقة بالكامل مع نظام العمل السعودي\n- استخدم المصطلحات القانونية الصحيحة\n- اتبع التنسيق المهني للوثائق الرسمية\n'
        : '\n\nImportant requirements:\n- Document must be fully compliant with Saudi Labor Law\n- Use correct legal terminology\n- Follow professional formatting for official documents\n';
    }

    return prompt;
  }

  /**
   * Build compliance analysis prompt
   */
  private buildCompliancePrompt(
    documentContent: string,
    relevantLaws: any[],
    documentType: string
  ): string {
    let prompt = `Analyze the following ${documentType} document for compliance with Saudi Labor Law:\n\n`;
    
    prompt += `Document:\n${documentContent}\n\n`;
    
    if (relevantLaws.length > 0) {
      prompt += 'Relevant Saudi Labor Law Articles:\n';
      relevantLaws.forEach(law => {
        prompt += `- Article ${law.article_number}: ${law.title_en}\n`;
        prompt += `  ${law.content_en}\n\n`;
      });
    }

    prompt += `
    Please provide a compliance analysis in the following JSON format:
    {
      "overall_score": 85,
      "status": "compliant|non_compliant|warning",
      "issues": [
        {
          "severity": "error|warning|info",
          "category": "wage|termination|working_hours|leave|safety|general",
          "message": "Issue description in English",
          "messageAr": "وصف المشكلة بالعربية",
          "article": "Article reference if applicable",
          "suggestion": "How to fix in English",
          "suggestionAr": "كيفية الإصلاح بالعربية"
        }
      ],
      "recommendations": ["Recommendation 1", "Recommendation 2"],
      "articles_checked": [
        {
          "articleNumber": "74",
          "title": "Wage Payment",
          "relevance": "high|medium|low",
          "compliance": "compliant|violation|unclear"
        }
      ]
    }
    `;

    return prompt;
  }

  /**
   * Get relevant labor law articles for document type
   */
  private async getRelevantLaborLaws(documentType: string): Promise<any[]> {
    const supabase = await createSupabaseServerClient();

    try {
      // Map document types to relevant law categories
      const categoryMappings = {
        'employment_contract': ['WAGES', 'HOURS', 'TERMINATION'],
        'termination_letter': ['TERMINATION', 'WAGES'],
        'leave_policy': ['LEAVE', 'HOURS'],
        'wage_certificate': ['WAGES'],
        'disciplinary_notice': ['TERMINATION', 'WAGES']
      };

      const categories = categoryMappings[documentType as keyof typeof categoryMappings] || [];
      
      if (categories.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('labor_law_articles')
        .select(`
          article_number,
          title_ar,
          title_en,
          content_ar,
          content_en,
          labor_law_categories (
            code,
            name_ar,
            name_en
          )
        `)
        .in('labor_law_categories.code', categories)
        .eq('is_active', true)
        .limit(10);

      return data || [];

    } catch (error) {
      console.error('Error getting relevant labor laws:', error);
      return [];
    }
  }

  /**
   * Format compliance result from AI analysis
   */
  private formatComplianceResult(analysis: any): ComplianceResult {
    return {
      status: analysis.status || 'warning',
      score: analysis.overall_score || 50,
      issues: (analysis.issues || []).map((issue: any) => ({
        severity: issue.severity || 'info',
        category: issue.category || 'general',
        message: issue.message || 'Unknown issue',
        messageAr: issue.messageAr || 'مشكلة غير معروفة',
        article: issue.article,
        suggestion: issue.suggestion,
        suggestionAr: issue.suggestionAr
      })),
      recommendations: analysis.recommendations || [],
      saudiLawArticles: (analysis.articles_checked || []).map((article: any) => ({
        articleNumber: article.articleNumber || '',
        title: article.title || '',
        relevance: article.relevance || 'medium',
        compliance: article.compliance || 'unclear'
      }))
    };
  }

  /**
   * Get default compliance result for error cases
   */
  private getDefaultComplianceResult(): ComplianceResult {
    return {
      status: 'warning',
      score: 50,
      issues: [{
        severity: 'warning',
        category: 'general',
        message: 'Could not complete automated compliance check',
        messageAr: 'لا يمكن إكمال فحص الامتثال التلقائي'
      }],
      recommendations: ['Please review document manually for Saudi Labor Law compliance'],
      saudiLawArticles: []
    };
  }

  /**
   * Save generated document to database
   */
  private async saveGeneratedDocument(data: {
    templateType: string;
    title: string;
    content: string;
    language: 'ar' | 'en';
    data: Record<string, any>;
    complianceStatus: string;
    complianceIssues: ComplianceIssue[];
    generatedBy: string;
    organizationId: string;
  }): Promise<GeneratedDocument> {
    // For now, return the document object
    // In production, you might want to save this to a separate table
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateType: data.templateType,
      title: data.title,
      content: data.content,
      language: data.language,
      data: data.data,
      complianceChecked: true,
      complianceStatus: data.complianceStatus as 'compliant' | 'non_compliant' | 'warning',
      complianceIssues: data.complianceIssues,
      generatedBy: data.generatedBy,
      organizationId: data.organizationId,
      createdAt: new Date()
    };
  }

  /**
   * Generate document title based on template and data
   */
  private generateDocumentTitle(
    template: TemplateType,
    data: Record<string, any>,
    language: 'ar' | 'en'
  ): string {
    const baseName = language === 'ar' ? template.nameAr : template.name;
    
    // Add employee name or relevant identifier if available
    if (data.employeeName) {
      return language === 'ar' 
        ? `${baseName} - ${data.employeeNameAr || data.employeeName}`
        : `${baseName} - ${data.employeeName}`;
    }
    
    if (data.policyName) {
      return language === 'ar'
        ? `${baseName} - ${data.policyNameAr || data.policyName}`
        : `${baseName} - ${data.policyName}`;
    }

    return `${baseName} - ${new Date().toLocaleDateString()}`;
  }

  /**
   * Get organization context for document generation
   */
  private async getOrganizationContext(organizationId: string): Promise<any> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('name, country_code, timezone, language_code')
        .eq('id', organizationId)
        .single();

      return data;
    } catch (error) {
      console.error('Error getting organization context:', error);
      return null;
    }
  }

  /**
   * Validate template data against required fields
   */
  private validateTemplateData(template: TemplateType, data: Record<string, any>): void {
    const missingFields = [];
    
    for (const field of template.requiredFields) {
      if (field.required && (!data[field.key] || data[field.key] === '')) {
        missingFields.push(field.name);
      }
    }
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  // Template field definitions
  private getEmploymentContractFields(): TemplateField[] {
    return [
      {
        key: 'employeeName',
        name: 'Employee Name',
        nameAr: 'اسم الموظف',
        type: 'text',
        required: true
      },
      {
        key: 'position',
        name: 'Position',
        nameAr: 'المنصب',
        type: 'text',
        required: true
      },
      {
        key: 'basicSalary',
        name: 'Basic Salary',
        nameAr: 'الراتب الأساسي',
        type: 'number',
        required: true
      },
      {
        key: 'contractType',
        name: 'Contract Type',
        nameAr: 'نوع العقد',
        type: 'select',
        required: true,
        options: [
          { value: 'permanent', label: 'Permanent', labelAr: 'دائم' },
          { value: 'temporary', label: 'Temporary', labelAr: 'مؤقت' },
          { value: 'probation', label: 'Probation', labelAr: 'تجربة' }
        ]
      },
      {
        key: 'startDate',
        name: 'Start Date',
        nameAr: 'تاريخ البداية',
        type: 'date',
        required: true
      }
    ];
  }

  private getTerminationLetterFields(): TemplateField[] {
    return [
      {
        key: 'employeeName',
        name: 'Employee Name',
        nameAr: 'اسم الموظف',
        type: 'text',
        required: true
      },
      {
        key: 'position',
        name: 'Position',
        nameAr: 'المنصب',
        type: 'text',
        required: true
      },
      {
        key: 'terminationDate',
        name: 'Termination Date',
        nameAr: 'تاريخ الإنهاء',
        type: 'date',
        required: true
      },
      {
        key: 'terminationType',
        name: 'Termination Type',
        nameAr: 'نوع الإنهاء',
        type: 'select',
        required: true,
        options: [
          { value: 'resignation', label: 'Resignation', labelAr: 'استقالة' },
          { value: 'dismissal', label: 'Dismissal', labelAr: 'فصل' },
          { value: 'contract_end', label: 'Contract End', labelAr: 'انتهاء العقد' },
          { value: 'mutual_agreement', label: 'Mutual Agreement', labelAr: 'اتفاق متبادل' }
        ]
      },
      {
        key: 'endOfServiceGratuity',
        name: 'End of Service Gratuity',
        nameAr: 'مكافأة نهاية الخدمة',
        type: 'number',
        required: true
      }
    ];
  }

  private getLeavePolicyFields(): TemplateField[] {
    return [
      {
        key: 'policyName',
        name: 'Policy Name',
        nameAr: 'اسم السياسة',
        type: 'text',
        required: true
      },
      {
        key: 'effectiveDate',
        name: 'Effective Date',
        nameAr: 'تاريخ النفاذ',
        type: 'date',
        required: true
      },
      {
        key: 'policyType',
        name: 'Policy Type',
        nameAr: 'نوع السياسة',
        type: 'select',
        required: true,
        options: [
          { value: 'leave', label: 'Leave Policy', labelAr: 'سياسة الإجازات' },
          { value: 'attendance', label: 'Attendance Policy', labelAr: 'سياسة الحضور' },
          { value: 'conduct', label: 'Code of Conduct', labelAr: 'سياسة السلوك' }
        ]
      }
    ];
  }

  private getWageCertificateFields(): TemplateField[] {
    return [
      {
        key: 'employeeName',
        name: 'Employee Name',
        nameAr: 'اسم الموظف',
        type: 'text',
        required: true
      },
      {
        key: 'position',
        name: 'Position',
        nameAr: 'المنصب',
        type: 'text',
        required: true
      },
      {
        key: 'basicSalary',
        name: 'Basic Salary',
        nameAr: 'الراتب الأساسي',
        type: 'number',
        required: true
      },
      {
        key: 'currency',
        name: 'Currency',
        nameAr: 'العملة',
        type: 'select',
        required: true,
        options: [
          { value: 'SAR', label: 'Saudi Riyal', labelAr: 'ريال سعودي' },
          { value: 'USD', label: 'US Dollar', labelAr: 'دولار أمريكي' }
        ]
      }
    ];
  }

  private getDisciplinaryNoticeFields(): TemplateField[] {
    return [
      {
        key: 'employeeName',
        name: 'Employee Name',
        nameAr: 'اسم الموظف',
        type: 'text',
        required: true
      },
      {
        key: 'incidentDate',
        name: 'Incident Date',
        nameAr: 'تاريخ الحادثة',
        type: 'date',
        required: true
      },
      {
        key: 'violationType',
        name: 'Violation Type',
        nameAr: 'نوع المخالفة',
        type: 'select',
        required: true,
        options: [
          { value: 'attendance', label: 'Attendance Issue', labelAr: 'مشكلة حضور' },
          { value: 'performance', label: 'Performance Issue', labelAr: 'مشكلة أداء' },
          { value: 'conduct', label: 'Misconduct', labelAr: 'سوء سلوك' }
        ]
      },
      {
        key: 'description',
        name: 'Incident Description',
        nameAr: 'وصف الحادثة',
        type: 'text',
        required: true
      }
    ];
  }
}