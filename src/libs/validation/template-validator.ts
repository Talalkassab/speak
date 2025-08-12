import { z } from 'zod';
import { OpenRouterClient } from '@/libs/services/openrouter-client';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  complianceScore: number;
  metadata: {
    validatedAt: string;
    validationDuration: number;
    rulesApplied: string[];
  };
}

export interface ValidationError {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'compliance' | 'field_validation' | 'content' | 'structure';
  message: string;
  messageAr?: string;
  field?: string;
  location?: {
    line?: number;
    column?: number;
    section?: string;
  };
  suggestion?: string;
  suggestionAr?: string;
  laborLawReference?: string;
  canAutoFix?: boolean;
  autoFixAction?: string;
}

export interface ValidationWarning {
  id: string;
  category: 'best_practice' | 'optimization' | 'accessibility' | 'localization';
  message: string;
  messageAr?: string;
  importance: 'low' | 'medium' | 'high';
  suggestion?: string;
  suggestionAr?: string;
}

export interface FieldValidationRule {
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'select' | 'textarea' | 'boolean';
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
    customValidator?: (value: any) => boolean;
  };
  complianceRules?: string[];
}

export interface ComplianceRule {
  ruleId: string;
  category: 'saudi_labor_law' | 'gdpr' | 'data_protection' | 'financial' | 'hr_best_practices';
  description: string;
  descriptionAr?: string;
  severity: 'error' | 'warning' | 'info';
  laborLawReference?: string;
  checkFunction: (content: string, fields: any[], parameters?: any) => boolean;
  autoFixFunction?: (content: string) => string;
}

export class TemplateValidator {
  private openRouter: OpenRouterClient;
  private complianceRules: Map<string, ComplianceRule> = new Map();
  
  constructor() {
    this.openRouter = new OpenRouterClient();
    this.initializeComplianceRules();
  }
  
  // Main validation function
  async validateTemplate(
    templateContent: string,
    requiredFields: FieldValidationRule[],
    category: string,
    language: 'ar' | 'en' = 'ar',
    parameters?: Record<string, any>
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    const rulesApplied: string[] = [];
    
    try {
      // 1. Syntax validation
      const syntaxValidation = this.validateSyntax(templateContent, requiredFields);
      errors.push(...syntaxValidation.errors);
      warnings.push(...syntaxValidation.warnings);
      rulesApplied.push('syntax_validation');
      
      // 2. Field validation
      const fieldValidation = this.validateFields(templateContent, requiredFields);
      errors.push(...fieldValidation.errors);
      warnings.push(...fieldValidation.warnings);
      rulesApplied.push('field_validation');
      
      // 3. Content structure validation
      const structureValidation = this.validateStructure(templateContent, category, language);
      errors.push(...structureValidation.errors);
      warnings.push(...structureValidation.warnings);
      rulesApplied.push('structure_validation');
      
      // 4. Saudi Labor Law compliance validation
      const complianceValidation = await this.validateCompliance(templateContent, category, requiredFields, language);
      errors.push(...complianceValidation.errors);
      warnings.push(...complianceValidation.warnings);
      suggestions.push(...complianceValidation.suggestions);
      rulesApplied.push('compliance_validation');
      
      // 5. Parameter validation (if provided)
      if (parameters) {
        const parameterValidation = this.validateParameters(parameters, requiredFields);
        errors.push(...parameterValidation.errors);
        warnings.push(...parameterValidation.warnings);
        rulesApplied.push('parameter_validation');
      }
      
      // 6. AI-powered validation for additional insights
      try {
        const aiValidation = await this.performAIValidation(templateContent, category, language);
        suggestions.push(...aiValidation.suggestions);
        warnings.push(...aiValidation.warnings);
        rulesApplied.push('ai_validation');
      } catch (aiError) {
        console.warn('AI validation failed:', aiError);
      }
      
      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(errors, warnings, suggestions.length);
      
      const validationDuration = Date.now() - startTime;
      
      return {
        valid: errors.filter(e => e.severity === 'error').length === 0,
        errors,
        warnings,
        suggestions,
        complianceScore,
        metadata: {
          validatedAt: new Date().toISOString(),
          validationDuration,
          rulesApplied
        }
      };
      
    } catch (error) {
      console.error('Template validation error:', error);
      
      return {
        valid: false,
        errors: [{
          id: 'validation_system_error',
          severity: 'error',
          category: 'syntax',
          message: 'Template validation system error',
          messageAr: 'خطأ في نظام التحقق من صحة القالب'
        }],
        warnings: [],
        suggestions: [],
        complianceScore: 0,
        metadata: {
          validatedAt: new Date().toISOString(),
          validationDuration: Date.now() - startTime,
          rulesApplied
        }
      };
    }
  }
  
  // Syntax validation
  private validateSyntax(content: string, fields: FieldValidationRule[]): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for basic content requirements
    if (!content || content.trim().length === 0) {
      errors.push({
        id: 'empty_template',
        severity: 'error',
        category: 'syntax',
        message: 'Template content cannot be empty',
        messageAr: 'لا يمكن أن يكون محتوى القالب فارغاً'
      });
      return { errors, warnings };
    }
    
    // Check for minimum content length
    if (content.length < 100) {
      warnings.push({
        id: 'short_template',
        category: 'best_practice',
        message: 'Template content is quite short. Consider adding more details.',
        messageAr: 'محتوى القالب قصير جداً. يُنصح بإضافة المزيد من التفاصيل.',
        importance: 'medium'
      });
    }
    
    // Check for placeholder syntax
    const placeholderPattern = /\{\{([^}]+)\}\}/g;
    const placeholders = [...content.matchAll(placeholderPattern)].map(match => match[1]);
    
    // Check for malformed placeholders
    const malformedPattern = /\{[^}]*\}(?!\})|\{\{[^}]*\}(?!\})/g;
    const malformed = content.match(malformedPattern);
    if (malformed) {
      malformed.forEach(placeholder => {
        errors.push({
          id: 'malformed_placeholder',
          severity: 'error',
          category: 'syntax',
          message: `Malformed placeholder found: ${placeholder}`,
          messageAr: `عنصر نائب مشوه: ${placeholder}`,
          suggestion: 'Use {{field_name}} format for placeholders',
          suggestionAr: 'استخدم تنسيق {{field_name}} للعناصر النائبة'
        });
      });
    }
    
    // Check for orphaned placeholders
    const fieldNames = fields.map(f => f.name);
    placeholders.forEach(placeholder => {
      if (!fieldNames.includes(placeholder)) {
        warnings.push({
          id: 'orphaned_placeholder',
          category: 'best_practice',
          message: `Placeholder {{${placeholder}}} has no corresponding field definition`,
          messageAr: `العنصر النائب {{${placeholder}}} ليس له تعريف حقل مقابل`,
          importance: 'medium',
          suggestion: 'Add field definition or remove unused placeholder',
          suggestionAr: 'أضف تعريف الحقل أو احذف العنصر النائب غير المستخدم'
        });
      }
    });
    
    // Check for missing required placeholders
    const requiredFields = fields.filter(f => f.required);
    requiredFields.forEach(field => {
      if (!placeholders.includes(field.name)) {
        errors.push({
          id: 'missing_required_placeholder',
          severity: 'error',
          category: 'field_validation',
          message: `Missing placeholder for required field: ${field.name}`,
          messageAr: `عنصر نائب مفقود للحقل المطلوب: ${field.name}`,
          field: field.name,
          suggestion: `Add {{${field.name}}} placeholder to the template`,
          suggestionAr: `أضف العنصر النائب {{${field.name}}} إلى القالب`
        });
      }
    });
    
    return { errors, warnings };
  }
  
  // Field validation
  private validateFields(content: string, fields: FieldValidationRule[]): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    fields.forEach(field => {
      // Validate field definition
      if (!field.name || field.name.trim().length === 0) {
        errors.push({
          id: 'invalid_field_name',
          severity: 'error',
          category: 'field_validation',
          message: 'Field name cannot be empty',
          messageAr: 'لا يمكن أن يكون اسم الحقل فارغاً',
          field: field.name
        });
      }
      
      // Validate field name format
      if (field.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        errors.push({
          id: 'invalid_field_name_format',
          severity: 'error',
          category: 'field_validation',
          message: `Field name '${field.name}' contains invalid characters. Use only letters, numbers, and underscores.`,
          messageAr: `اسم الحقل '${field.name}' يحتوي على أحرف غير صالحة. استخدم الأحرف والأرقام والشرطات السفلية فقط.`,
          field: field.name
        });
      }
      
      // Validate field type
      const validTypes = ['text', 'number', 'date', 'email', 'select', 'textarea', 'boolean'];
      if (!validTypes.includes(field.type)) {
        errors.push({
          id: 'invalid_field_type',
          severity: 'error',
          category: 'field_validation',
          message: `Invalid field type '${field.type}' for field '${field.name}'`,
          messageAr: `نوع حقل غير صالح '${field.type}' للحقل '${field.name}'`,
          field: field.name,
          suggestion: `Use one of: ${validTypes.join(', ')}`,
          suggestionAr: `استخدم أحد الأنواع التالية: ${validTypes.join(', ')}`
        });
      }
      
      // Validate select field options
      if (field.type === 'select' && (!field.validation?.options || field.validation.options.length === 0)) {
        warnings.push({
          id: 'select_field_no_options',
          category: 'best_practice',
          message: `Select field '${field.name}' has no options defined`,
          messageAr: `الحقل المنسدل '${field.name}' لا يحتوي على خيارات`,
          importance: 'high',
          field: field.name
        });
      }
      
      // Validate validation rules
      if (field.validation) {
        const validation = field.validation;
        
        if (validation.minLength && validation.maxLength && validation.minLength > validation.maxLength) {
          errors.push({
            id: 'invalid_length_validation',
            severity: 'error',
            category: 'field_validation',
            message: `Field '${field.name}' has minLength greater than maxLength`,
            messageAr: `الحقل '${field.name}' له حد أدنى أكبر من الحد الأقصى للطول`,
            field: field.name
          });
        }
        
        if (validation.min && validation.max && validation.min > validation.max) {
          errors.push({
            id: 'invalid_range_validation',
            severity: 'error',
            category: 'field_validation',
            message: `Field '${field.name}' has min value greater than max value`,
            messageAr: `الحقل '${field.name}' له قيمة دنيا أكبر من القيمة العليا`,
            field: field.name
          });
        }
        
        // Validate pattern for text fields
        if (validation.pattern && (field.type === 'text' || field.type === 'textarea')) {
          try {
            new RegExp(validation.pattern);
          } catch {
            errors.push({
              id: 'invalid_pattern',
              severity: 'error',
              category: 'field_validation',
              message: `Field '${field.name}' has invalid regex pattern`,
              messageAr: `الحقل '${field.name}' له نمط تعبير منتظم غير صالح`,
              field: field.name
            });
          }
        }
      }
    });
    
    return { errors, warnings };
  }
  
  // Structure validation
  private validateStructure(content: string, category: string, language: 'ar' | 'en'): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Category-specific structure validation
    switch (category) {
      case 'employment':
        this.validateEmploymentContractStructure(content, language, errors, warnings);
        break;
      case 'letters':
        this.validateLetterStructure(content, language, errors, warnings);
        break;
      case 'forms':
        this.validateFormStructure(content, language, errors, warnings);
        break;
      case 'hr_policies':
        this.validatePolicyStructure(content, language, errors, warnings);
        break;
      default:
        // Generic structure validation
        this.validateGenericStructure(content, language, errors, warnings);
    }
    
    return { errors, warnings };
  }
  
  // Saudi Labor Law compliance validation
  private async validateCompliance(
    content: string, 
    category: string, 
    fields: FieldValidationRule[], 
    language: 'ar' | 'en'
  ): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    // Apply category-specific compliance rules
    const categoryRules = Array.from(this.complianceRules.values())
      .filter(rule => this.isCategoryRelevant(rule.category, category));
    
    for (const rule of categoryRules) {
      try {
        const compliant = rule.checkFunction(content, fields);
        
        if (!compliant) {
          const error: ValidationError = {
            id: rule.ruleId,
            severity: rule.severity,
            category: 'compliance',
            message: rule.description,
            messageAr: rule.descriptionAr,
            laborLawReference: rule.laborLawReference,
            canAutoFix: !!rule.autoFixFunction,
            autoFixAction: rule.autoFixFunction ? 'apply_auto_fix' : undefined
          };
          
          if (rule.severity === 'error') {
            errors.push(error);
          } else {
            warnings.push({
              id: rule.ruleId,
              category: 'best_practice',
              message: rule.description,
              messageAr: rule.descriptionAr,
              importance: rule.severity === 'warning' ? 'high' : 'medium'
            });
          }
        }
      } catch (ruleError) {
        console.warn(`Compliance rule ${rule.ruleId} failed:`, ruleError);
      }
    }
    
    // AI-powered compliance suggestions
    try {
      const aiSuggestions = await this.getAIComplianceSuggestions(content, category, language);
      suggestions.push(...aiSuggestions);
    } catch (aiError) {
      console.warn('AI compliance suggestions failed:', aiError);
    }
    
    return { errors, warnings, suggestions };
  }
  
  // Parameter validation
  private validateParameters(parameters: Record<string, any>, fields: FieldValidationRule[]): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check required parameters
    const requiredFields = fields.filter(f => f.required);
    requiredFields.forEach(field => {
      const value = parameters[field.name];
      
      if (value === undefined || value === null || value === '') {
        errors.push({
          id: 'missing_required_parameter',
          severity: 'error',
          category: 'field_validation',
          message: `Required parameter '${field.name}' is missing`,
          messageAr: `المعامل المطلوب '${field.name}' مفقود`,
          field: field.name
        });
      }
    });
    
    // Validate parameter values
    fields.forEach(field => {
      const value = parameters[field.name];
      if (value === undefined || value === null) return;
      
      const fieldErrors = this.validateParameterValue(field, value);
      errors.push(...fieldErrors);
    });
    
    return { errors, warnings };
  }
  
  // Helper methods
  private validateParameterValue(field: FieldValidationRule, value: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Type validation
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push({
            id: 'invalid_number_parameter',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must be a number`,
            messageAr: `المعامل '${field.name}' يجب أن يكون رقماً`,
            field: field.name
          });
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({
            id: 'invalid_email_parameter',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must be a valid email`,
            messageAr: `المعامل '${field.name}' يجب أن يكون بريداً إلكترونياً صالحاً`,
            field: field.name
          });
        }
        break;
        
      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push({
            id: 'invalid_date_parameter',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must be a valid date`,
            messageAr: `المعامل '${field.name}' يجب أن يكون تاريخاً صالحاً`,
            field: field.name
          });
        }
        break;
        
      case 'select':
        if (field.validation?.options && !field.validation.options.includes(value)) {
          errors.push({
            id: 'invalid_select_parameter',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must be one of: ${field.validation.options.join(', ')}`,
            messageAr: `المعامل '${field.name}' يجب أن يكون أحد: ${field.validation.options.join(', ')}`,
            field: field.name
          });
        }
        break;
    }
    
    // Validation rules
    if (field.validation) {
      const validation = field.validation;
      const stringValue = String(value);
      const numericValue = Number(value);
      
      if (validation.minLength && stringValue.length < validation.minLength) {
        errors.push({
          id: 'parameter_too_short',
          severity: 'error',
          category: 'field_validation',
          message: `Parameter '${field.name}' must be at least ${validation.minLength} characters`,
          messageAr: `المعامل '${field.name}' يجب أن يكون على الأقل ${validation.minLength} أحرف`,
          field: field.name
        });
      }
      
      if (validation.maxLength && stringValue.length > validation.maxLength) {
        errors.push({
          id: 'parameter_too_long',
          severity: 'error',
          category: 'field_validation',
          message: `Parameter '${field.name}' must not exceed ${validation.maxLength} characters`,
          messageAr: `المعامل '${field.name}' يجب ألا يتجاوز ${validation.maxLength} حرف`,
          field: field.name
        });
      }
      
      if (field.type === 'number') {
        if (validation.min !== undefined && numericValue < validation.min) {
          errors.push({
            id: 'parameter_too_small',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must be at least ${validation.min}`,
            messageAr: `المعامل '${field.name}' يجب أن يكون على الأقل ${validation.min}`,
            field: field.name
          });
        }
        
        if (validation.max !== undefined && numericValue > validation.max) {
          errors.push({
            id: 'parameter_too_large',
            severity: 'error',
            category: 'field_validation',
            message: `Parameter '${field.name}' must not exceed ${validation.max}`,
            messageAr: `المعامل '${field.name}' يجب ألا يتجاوز ${validation.max}`,
            field: field.name
          });
        }
      }
      
      if (validation.pattern) {
        try {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(stringValue)) {
            errors.push({
              id: 'parameter_pattern_mismatch',
              severity: 'error',
              category: 'field_validation',
              message: `Parameter '${field.name}' does not match required format`,
              messageAr: `المعامل '${field.name}' لا يطابق التنسيق المطلوب`,
              field: field.name
            });
          }
        } catch {
          // Invalid regex, already handled in field validation
        }
      }
      
      if (validation.customValidator) {
        try {
          if (!validation.customValidator(value)) {
            errors.push({
              id: 'parameter_custom_validation_failed',
              severity: 'error',
              category: 'field_validation',
              message: `Parameter '${field.name}' failed custom validation`,
              messageAr: `المعامل '${field.name}' فشل في التحقق المخصص`,
              field: field.name
            });
          }
        } catch (customError) {
          console.warn(`Custom validator for ${field.name} failed:`, customError);
        }
      }
    }
    
    return errors;
  }
  
  // Initialize compliance rules
  private initializeComplianceRules(): void {
    // Saudi Labor Law compliance rules
    this.complianceRules.set('probation_period_limit', {
      ruleId: 'probation_period_limit',
      category: 'saudi_labor_law',
      description: 'Probation period must not exceed 90 days',
      descriptionAr: 'فترة التجربة يجب ألا تتجاوز 90 يوماً',
      severity: 'error',
      laborLawReference: 'Article 53 - Saudi Labor Law',
      checkFunction: (content, fields) => {
        const probationField = fields.find(f => f.name.includes('probation'));
        if (!probationField) return true;
        
        // Check if content mentions probation period > 90 days
        const probationPatterns = [
          /فترة\s+التجربة.*?(\d+).*?يوم/gi,
          /probation.*?period.*?(\d+).*?day/gi,
          /{{probation_period}}.*?(\d+)/gi
        ];
        
        for (const pattern of probationPatterns) {
          const match = content.match(pattern);
          if (match) {
            const days = parseInt(match[1]);
            if (days > 90) return false;
          }
        }
        
        return true;
      }
    });
    
    this.complianceRules.set('working_hours_limit', {
      ruleId: 'working_hours_limit',
      category: 'saudi_labor_law',
      description: 'Daily working hours must not exceed 8 hours',
      descriptionAr: 'ساعات العمل اليومية يجب ألا تتجاوز 8 ساعات',
      severity: 'error',
      laborLawReference: 'Article 98 - Saudi Labor Law',
      checkFunction: (content, fields) => {
        const hoursPatterns = [
          /ساعات\s+العمل.*?(\d+).*?ساعة/gi,
          /working.*?hours.*?(\d+).*?hour/gi,
          /{{daily_hours}}.*?(\d+)/gi
        ];
        
        for (const pattern of hoursPatterns) {
          const match = content.match(pattern);
          if (match) {
            const hours = parseInt(match[1]);
            if (hours > 8) return false;
          }
        }
        
        return true;
      }
    });
    
    this.complianceRules.set('annual_leave_minimum', {
      ruleId: 'annual_leave_minimum',
      category: 'saudi_labor_law',
      description: 'Annual leave must be at least 21 days',
      descriptionAr: 'الإجازة السنوية يجب أن تكون على الأقل 21 يوماً',
      severity: 'warning',
      laborLawReference: 'Article 109 - Saudi Labor Law',
      checkFunction: (content, fields) => {
        const leavePatterns = [
          /الإجازة\s+السنوية.*?(\d+).*?يوم/gi,
          /annual.*?leave.*?(\d+).*?day/gi,
          /{{annual_leave}}.*?(\d+)/gi
        ];
        
        for (const pattern of leavePatterns) {
          const match = content.match(pattern);
          if (match) {
            const days = parseInt(match[1]);
            if (days < 21) return false;
          }
        }
        
        return true;
      }
    });
    
    // Add more compliance rules as needed
  }
  
  private isCategoryRelevant(ruleCategory: string, templateCategory: string): boolean {
    const categoryMapping: Record<string, string[]> = {
      'saudi_labor_law': ['employment', 'letters', 'hr_policies'],
      'gdpr': ['employment', 'forms'],
      'data_protection': ['employment', 'forms', 'hr_policies'],
      'financial': ['letters', 'forms'],
      'hr_best_practices': ['employment', 'letters', 'forms', 'hr_policies']
    };
    
    return categoryMapping[ruleCategory]?.includes(templateCategory) ?? false;
  }
  
  private calculateComplianceScore(errors: ValidationError[], warnings: ValidationWarning[], suggestionsCount: number): number {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length + warnings.length;
    
    // Start with 100, deduct for issues
    let score = 100;
    score -= errorCount * 15; // Major deduction for errors
    score -= warningCount * 5; // Minor deduction for warnings
    score += Math.min(suggestionsCount * 2, 10); // Small bonus for having suggestions
    
    return Math.max(0, Math.min(100, score));
  }
  
  // Structure validation methods
  private validateEmploymentContractStructure(
    content: string, 
    language: 'ar' | 'en', 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    const requiredSections = language === 'ar' ? 
      ['الطرف الأول', 'الطرف الثاني', 'الراتب', 'ساعات العمل', 'الإجازات'] :
      ['First Party', 'Second Party', 'Salary', 'Working Hours', 'Leave'];
    
    requiredSections.forEach(section => {
      if (!content.toLowerCase().includes(section.toLowerCase())) {
        warnings.push({
          id: 'missing_contract_section',
          category: 'best_practice',
          message: `Employment contract should include ${section} section`,
          messageAr: `عقد العمل يجب أن يتضمن قسم ${section}`,
          importance: 'high'
        });
      }
    });
  }
  
  private validateLetterStructure(
    content: string, 
    language: 'ar' | 'en', 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    const requiredElements = language === 'ar' ? 
      ['التاريخ', 'المرسل إليه', 'الموضوع', 'التوقيع'] :
      ['Date', 'Recipient', 'Subject', 'Signature'];
    
    requiredElements.forEach(element => {
      if (!content.toLowerCase().includes(element.toLowerCase())) {
        warnings.push({
          id: 'missing_letter_element',
          category: 'best_practice',
          message: `Letter should include ${element}`,
          messageAr: `الخطاب يجب أن يتضمن ${element}`,
          importance: 'medium'
        });
      }
    });
  }
  
  private validateFormStructure(
    content: string, 
    language: 'ar' | 'en', 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check for form fields and structure
    if (!content.includes('{{') || !content.includes('}}')) {
      warnings.push({
        id: 'no_form_fields',
        category: 'best_practice',
        message: 'Form should contain fillable fields using {{field_name}} syntax',
        messageAr: 'النموذج يجب أن يحتوي على حقول قابلة للتعبئة باستخدام {{field_name}}',
        importance: 'high'
      });
    }
  }
  
  private validatePolicyStructure(
    content: string, 
    language: 'ar' | 'en', 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    const requiredSections = language === 'ar' ? 
      ['المقدمة', 'النطاق', 'المسؤوليات', 'الإجراءات'] :
      ['Introduction', 'Scope', 'Responsibilities', 'Procedures'];
    
    requiredSections.forEach(section => {
      if (!content.toLowerCase().includes(section.toLowerCase())) {
        warnings.push({
          id: 'missing_policy_section',
          category: 'best_practice',
          message: `Policy should include ${section} section`,
          messageAr: `السياسة يجب أن تتضمن قسم ${section}`,
          importance: 'medium'
        });
      }
    });
  }
  
  private validateGenericStructure(
    content: string, 
    language: 'ar' | 'en', 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Basic structure checks
    if (content.length > 5000) {
      warnings.push({
        id: 'very_long_template',
        category: 'best_practice',
        message: 'Template is very long. Consider breaking it into sections.',
        messageAr: 'القالب طويل جداً. يُنصح بتقسيمه إلى أقسام.',
        importance: 'low'
      });
    }
  }
  
  // AI validation methods
  private async performAIValidation(
    content: string, 
    category: string, 
    language: 'ar' | 'en'
  ): Promise<{
    warnings: ValidationWarning[];
    suggestions: string[];
  }> {
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    
    try {
      const prompt = this.buildAIValidationPrompt(content, category, language);
      
      const response = await this.openRouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: language === 'ar' ? 
              'أنت خبير في مراجعة وثائق الموارد البشرية والامتثال لنظام العمل السعودي.' :
              'You are an expert in reviewing HR documents and Saudi Labor Law compliance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'openai/gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.2
      });
      
      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        // Parse AI response for warnings and suggestions
        const lines = aiResponse.split('\n');
        let currentSection = '';
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.toLowerCase().includes('warning') || trimmed.includes('تحذير')) {
            currentSection = 'warnings';
          } else if (trimmed.toLowerCase().includes('suggestion') || trimmed.includes('اقتراح')) {
            currentSection = 'suggestions';
          } else if (trimmed && trimmed.length > 10) {
            if (currentSection === 'warnings' && warnings.length < 5) {
              warnings.push({
                id: `ai_warning_${warnings.length + 1}`,
                category: 'best_practice',
                message: trimmed,
                importance: 'medium'
              });
            } else if (currentSection === 'suggestions' && suggestions.length < 5) {
              suggestions.push(trimmed);
            }
          }
        });
      }
      
    } catch (error) {
      console.warn('AI validation failed:', error);
    }
    
    return { warnings, suggestions };
  }
  
  private buildAIValidationPrompt(content: string, category: string, language: 'ar' | 'en'): string {
    const basePrompt = language === 'ar' ? 
      `راجع القالب التالي من فئة ${category} وقدم تحذيرات واقتراحات للتحسين:\n\n${content.substring(0, 1000)}\n\nركز على:\n- الامتثال لنظام العمل السعودي\n- وضوح اللغة\n- اكتمال المعلومات\n- أفضل الممارسات` :
      `Review the following ${category} template and provide warnings and suggestions for improvement:\n\n${content.substring(0, 1000)}\n\nFocus on:\n- Saudi Labor Law compliance\n- Language clarity\n- Information completeness\n- Best practices`;
    
    return basePrompt;
  }
  
  private async getAIComplianceSuggestions(
    content: string, 
    category: string, 
    language: 'ar' | 'en'
  ): Promise<string[]> {
    try {
      const prompt = language === 'ar' ? 
        `احلل المحتوى التالي للامتثال لنظام العمل السعودي وقدم اقتراحات محددة:\n\n${content.substring(0, 800)}` :
        `Analyze the following content for Saudi Labor Law compliance and provide specific suggestions:\n\n${content.substring(0, 800)}`;
      
      const response = await this.openRouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: language === 'ar' ? 
              'أنت محامي متخصص في نظام العمل السعودي. قدم اقتراحات قانونية دقيقة.' :
              'You are a lawyer specializing in Saudi Labor Law. Provide accurate legal suggestions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'openai/gpt-4o-mini',
        max_tokens: 800,
        temperature: 0.1
      });
      
      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        // Extract numbered suggestions or bullet points
        const suggestionLines = aiResponse.split('\n')
          .filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 20 && 
                   (trimmed.match(/^\d+\./) || trimmed.match(/^[-•*]/));
          })
          .map(line => line.replace(/^\d+\.\s*|^[-•*]\s*/, '').trim())
          .slice(0, 5);
        
        return suggestionLines;
      }
    } catch (error) {
      console.warn('AI compliance suggestions failed:', error);
    }
    
    return [];
  }
}

export const templateValidator = new TemplateValidator();
export default TemplateValidator;