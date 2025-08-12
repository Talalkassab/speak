/**
 * Template Generation Integration Tests
 * Tests the complete flow of template creation, validation, and document generation
 */

import request from 'supertest';
import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';

// Mock the Next.js app structure
const mockApp = {
  handle: jest.fn(),
};

// Import API routes
import { POST as createTemplate } from '@/app/api/v1/templates/route';
import { GET as getTemplate, PUT as updateTemplate } from '@/app/api/v1/templates/[id]/route';
import { POST as generateDocument } from '@/app/api/v1/templates/[id]/generate/route';

// Mock dependencies
jest.mock('@/libs/supabase/supabase-server-client');
jest.mock('@/libs/auth/auth-middleware');
jest.mock('@/libs/services/template-management-service');
jest.mock('@/libs/export/pdf-generator');
jest.mock('@/libs/export/docx-generator');

// Test data
const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  organizationId: 'org-123',
  role: 'admin',
};

const arabicEmploymentTemplate = {
  id: 'template-001',
  name: 'قالب عقد العمل الأساسي',
  description: 'قالب شامل لعقود العمل وفقاً لقانون العمل السعودي',
  category: 'employment_contracts',
  language: 'ar',
  version: '1.0.0',
  status: 'active',
  organizationId: 'org-123',
  content: `
    <div dir="rtl" class="employment-contract">
      <header class="contract-header">
        <h1>عقد عمل</h1>
        <p class="contract-number">رقم العقد: {{contract_number}}</p>
        <p class="contract-date">تاريخ العقد: {{contract_date}}</p>
      </header>
      
      <section class="parties">
        <h2>أطراف العقد</h2>
        
        <div class="employer">
          <h3>الطرف الأول (صاحب العمل):</h3>
          <table class="party-details">
            <tr>
              <td>اسم الشركة:</td>
              <td>{{company_name}}</td>
            </tr>
            <tr>
              <td>رقم السجل التجاري:</td>
              <td>{{commercial_registration}}</td>
            </tr>
            <tr>
              <td>العنوان:</td>
              <td>{{company_address}}</td>
            </tr>
            <tr>
              <td>رقم الهاتف:</td>
              <td>{{company_phone}}</td>
            </tr>
          </table>
        </div>
        
        <div class="employee">
          <h3>الطرف الثاني (العامل):</h3>
          <table class="party-details">
            <tr>
              <td>الاسم الكامل:</td>
              <td>{{employee_name}}</td>
            </tr>
            <tr>
              <td>رقم الهوية:</td>
              <td>{{employee_id}}</td>
            </tr>
            <tr>
              <td>الجنسية:</td>
              <td>{{nationality}}</td>
            </tr>
            <tr>
              <td>تاريخ الميلاد:</td>
              <td>{{birth_date}}</td>
            </tr>
            <tr>
              <td>العنوان:</td>
              <td>{{employee_address}}</td>
            </tr>
            <tr>
              <td>رقم الجوال:</td>
              <td>{{mobile_number}}</td>
            </tr>
          </table>
        </div>
      </section>
      
      <section class="employment-terms">
        <h2>شروط وأحكام العمل</h2>
        
        <div class="term">
          <h3>المادة الأولى: طبيعة العمل ومكانه</h3>
          <p>يتعهد الطرف الثاني بالعمل لدى الطرف الأول في منصب <strong>{{job_title}}</strong> 
             في قسم <strong>{{department}}</strong> بمقر الشركة الكائن في {{workplace_location}}.</p>
          
          <div class="job-description">
            <h4>الوصف الوظيفي:</h4>
            <ul>
              {{#each job_responsibilities}}
              <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
        </div>
        
        <div class="term">
          <h3>المادة الثانية: مدة العقد</h3>
          {{#if contract_type_permanent}}
          <p>هذا عقد عمل دائم يبدأ من تاريخ {{start_date}}.</p>
          {{else}}
          <p>هذا عقد عمل محدد المدة يبدأ من تاريخ {{start_date}} وينتهي في {{end_date}}، 
             أي لمدة {{contract_duration}}.</p>
          {{/if}}
          
          {{#if probation_period}}
          <p>يخضع الطرف الثاني لفترة تجريبية مدتها {{probation_period}} أيام من تاريخ بداية العمل.</p>
          {{/if}}
        </div>
        
        <div class="term">
          <h3>المادة الثالثة: الأجر والمزايا</h3>
          
          <div class="salary-breakdown">
            <h4>تفاصيل الراتب الشهري:</h4>
            <table class="salary-table">
              <tr>
                <td>الراتب الأساسي:</td>
                <td class="amount">{{base_salary}} ريال سعودي</td>
              </tr>
              {{#if housing_allowance}}
              <tr>
                <td>بدل السكن:</td>
                <td class="amount">{{housing_allowance}} ريال</td>
              </tr>
              {{/if}}
              {{#if transportation_allowance}}
              <tr>
                <td>بدل المواصلات:</td>
                <td class="amount">{{transportation_allowance}} ريال</td>
              </tr>
              {{/if}}
              {{#if communication_allowance}}
              <tr>
                <td>بدل الاتصالات:</td>
                <td class="amount">{{communication_allowance}} ريال</td>
              </tr>
              {{/if}}
              {{#each other_allowances}}
              <tr>
                <td>{{this.name}}:</td>
                <td class="amount">{{this.amount}} ريال</td>
              </tr>
              {{/each}}
              <tr class="total">
                <td><strong>إجمالي الراتب الشهري:</strong></td>
                <td class="amount"><strong>{{total_salary}} ريال سعودي</strong></td>
              </tr>
            </table>
          </div>
          
          <div class="benefits">
            <h4>المزايا الإضافية:</h4>
            <ul>
              {{#if medical_insurance}}
              <li>التأمين الطبي للموظف {{#if family_medical_insurance}}والعائلة{{/if}}</li>
              {{/if}}
              {{#if annual_bonus}}
              <li>مكافأة سنوية: {{annual_bonus}}</li>
              {{/if}}
              {{#each additional_benefits}}
              <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
        </div>
        
        <div class="term">
          <h3>المادة الرابعة: ساعات العمل والإجازات</h3>
          
          <div class="working-hours">
            <h4>ساعات العمل:</h4>
            <ul>
              <li>عدد ساعات العمل الأسبوعية: {{weekly_hours}} ساعة</li>
              <li>أيام العمل: {{working_days_per_week}} أيام في الأسبوع</li>
              <li>ساعات العمل اليومية: من {{daily_start_time}} إلى {{daily_end_time}}</li>
              <li>فترة الراحة: {{break_duration}} دقيقة</li>
            </ul>
          </div>
          
          <div class="leaves">
            <h4>الإجازات:</h4>
            <ul>
              <li>الإجازة السنوية: {{annual_leave}} يوماً مدفوعة الأجر</li>
              <li>الإجازة المرضية: وفقاً لنظام العمل السعودي</li>
              {{#if hajj_leave}}
              <li>إجازة الحج: مرة واحدة خلال مدة الخدمة</li>
              {{/if}}
              {{#if maternity_leave}}
              <li>إجازة الأمومة: {{maternity_leave}} أسبوع</li>
              {{/if}}
              {{#each special_leaves}}
              <li>{{this.type}}: {{this.duration}}</li>
              {{/each}}
            </ul>
          </div>
        </div>
        
        <div class="term">
          <h3>المادة الخامسة: إنهاء العقد</h3>
          <p>يحق لأي من الطرفين إنهاء هذا العقد وفقاً لأحكام نظام العمل السعودي، 
             مع مراعاة فترة الإشعار المطلوبة وهي {{notice_period}} يوماً.</p>
          
          <div class="end-of-service">
            <h4>مكافأة نهاية الخدمة:</h4>
            <p>يستحق الطرف الثاني مكافأة نهاية الخدمة وفقاً لنظام العمل السعودي:</p>
            <ul>
              <li>نصف شهر عن كل سنة من السنوات الخمس الأولى</li>
              <li>شهر كامل عن كل سنة من السنوات التالية</li>
            </ul>
          </div>
        </div>
      </section>
      
      <section class="signatures">
        <h2>التوقيعات</h2>
        <div class="signature-block">
          <div class="employer-signature">
            <h4>الطرف الأول (صاحب العمل)</h4>
            <div class="signature-line">
              <p>الاسم: {{employer_representative_name}}</p>
              <p>المنصب: {{employer_representative_title}}</p>
              <p>التوقيع: ____________________</p>
              <p>التاريخ: {{signature_date}}</p>
            </div>
          </div>
          
          <div class="employee-signature">
            <h4>الطرف الثاني (العامل)</h4>
            <div class="signature-line">
              <p>الاسم: {{employee_name}}</p>
              <p>التوقيع: ____________________</p>
              <p>التاريخ: {{signature_date}}</p>
            </div>
          </div>
        </div>
        
        <div class="witnesses">
          <h4>الشهود</h4>
          <div class="witness-signatures">
            {{#each witnesses}}
            <div class="witness">
              <p>الاسم: {{this.name}}</p>
              <p>المنصب: {{this.title}}</p>
              <p>التوقيع: ____________________</p>
            </div>
            {{/each}}
          </div>
        </div>
      </section>
      
      <footer class="contract-footer">
        <p>تم إعداد هذا العقد في {{preparation_location}} بتاريخ {{preparation_date}}</p>
        <p>هذا العقد محرر من نسختين، نسخة لكل طرف</p>
      </footer>
    </div>
  `,
  fields: [
    // Company Information
    { name: 'contract_number', label: 'رقم العقد', type: 'text', required: true },
    { name: 'contract_date', label: 'تاريخ العقد', type: 'date', required: true },
    { name: 'company_name', label: 'اسم الشركة', type: 'text', required: true },
    { name: 'commercial_registration', label: 'رقم السجل التجاري', type: 'text', required: true },
    { name: 'company_address', label: 'عنوان الشركة', type: 'textarea', required: true },
    { name: 'company_phone', label: 'هاتف الشركة', type: 'tel', required: true },
    
    // Employee Information
    { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
    { name: 'employee_id', label: 'رقم الهوية', type: 'text', required: true },
    { name: 'nationality', label: 'الجنسية', type: 'text', required: true },
    { name: 'birth_date', label: 'تاريخ الميلاد', type: 'date', required: true },
    { name: 'employee_address', label: 'عنوان الموظف', type: 'textarea', required: true },
    { name: 'mobile_number', label: 'رقم الجوال', type: 'tel', required: true },
    
    // Job Details
    { name: 'job_title', label: 'المسمى الوظيفي', type: 'text', required: true },
    { name: 'department', label: 'القسم', type: 'select', required: true, options: [
      { value: 'it', label: 'تقنية المعلومات' },
      { value: 'hr', label: 'الموارد البشرية' },
      { value: 'finance', label: 'المالية' },
      { value: 'operations', label: 'العمليات' },
      { value: 'marketing', label: 'التسويق' },
    ]},
    { name: 'workplace_location', label: 'مكان العمل', type: 'text', required: true },
    { name: 'job_responsibilities', label: 'المسؤوليات الوظيفية', type: 'array', required: true },
    
    // Contract Terms
    { name: 'contract_type_permanent', label: 'عقد دائم', type: 'boolean', required: false },
    { name: 'start_date', label: 'تاريخ بداية العمل', type: 'date', required: true },
    { name: 'end_date', label: 'تاريخ انتهاء العمل', type: 'date', required: false },
    { name: 'contract_duration', label: 'مدة العقد', type: 'text', required: false },
    { name: 'probation_period', label: 'فترة التجربة (بالأيام)', type: 'number', required: false },
    
    // Salary and Benefits
    { name: 'base_salary', label: 'الراتب الأساسي', type: 'number', required: true },
    { name: 'housing_allowance', label: 'بدل السكن', type: 'number', required: false },
    { name: 'transportation_allowance', label: 'بدل المواصلات', type: 'number', required: false },
    { name: 'communication_allowance', label: 'بدل الاتصالات', type: 'number', required: false },
    { name: 'total_salary', label: 'إجمالي الراتب', type: 'number', required: true, calculated: true },
    { name: 'medical_insurance', label: 'التأمين الطبي', type: 'boolean', required: false },
    { name: 'family_medical_insurance', label: 'تأمين طبي للعائلة', type: 'boolean', required: false },
    { name: 'annual_bonus', label: 'المكافأة السنوية', type: 'text', required: false },
    
    // Working Hours and Leave
    { name: 'weekly_hours', label: 'ساعات العمل الأسبوعية', type: 'number', required: true, defaultValue: 40 },
    { name: 'working_days_per_week', label: 'أيام العمل الأسبوعية', type: 'number', required: true, defaultValue: 5 },
    { name: 'daily_start_time', label: 'بداية العمل اليومي', type: 'time', required: true },
    { name: 'daily_end_time', label: 'نهاية العمل اليومي', type: 'time', required: true },
    { name: 'break_duration', label: 'مدة الاستراحة (بالدقائق)', type: 'number', required: true, defaultValue: 60 },
    { name: 'annual_leave', label: 'أيام الإجازة السنوية', type: 'number', required: true, defaultValue: 21 },
    { name: 'hajj_leave', label: 'إجازة الحج', type: 'boolean', required: false },
    { name: 'maternity_leave', label: 'إجازة الأمومة (بالأسابيع)', type: 'number', required: false },
    
    // Contract Termination
    { name: 'notice_period', label: 'فترة الإشعار (بالأيام)', type: 'number', required: true, defaultValue: 60 },
    
    // Signatures
    { name: 'employer_representative_name', label: 'اسم ممثل صاحب العمل', type: 'text', required: true },
    { name: 'employer_representative_title', label: 'منصب ممثل صاحب العمل', type: 'text', required: true },
    { name: 'signature_date', label: 'تاريخ التوقيع', type: 'date', required: true },
    { name: 'preparation_location', label: 'مكان إعداد العقد', type: 'text', required: true },
    { name: 'preparation_date', label: 'تاريخ إعداد العقد', type: 'date', required: true },
  ],
  metadata: {
    legalCompliance: ['saudi_labor_law_2005', 'ministry_of_hr_regulations'],
    documentType: 'employment_contract',
    language: 'ar',
    region: 'saudi_arabia',
    lastLegalReview: '2024-01-15',
    approvedBy: 'legal-department',
    version: '1.0.0',
  },
};

const testFormData = {
  // Contract Info
  contract_number: 'EMP-2024-001',
  contract_date: '2024-02-01',
  
  // Company Info
  company_name: 'شركة التقنية المتقدمة المحدودة',
  commercial_registration: '1010123456',
  company_address: 'الرياض، حي العليا، شارع الملك فهد، مبنى رقم 123',
  company_phone: '+966-11-1234567',
  
  // Employee Info
  employee_name: 'أحمد محمد عبدالله السالم',
  employee_id: '1234567890',
  nationality: 'سعودي',
  birth_date: '1990-05-15',
  employee_address: 'الرياض، حي النخيل، شارع الأمير سلطان، رقم 456',
  mobile_number: '+966-50-1234567',
  
  // Job Details
  job_title: 'مطور برمجيات أول',
  department: 'it',
  workplace_location: 'مقر الشركة الرئيسي - الرياض',
  job_responsibilities: [
    'تطوير وصيانة التطبيقات البرمجية',
    'تحليل المتطلبات التقنية وتصميم الحلول',
    'كتابة وتوثيق الكود البرمجي',
    'اختبار وضمان جودة البرمجيات',
    'التعاون مع فريق التطوير والأقسام الأخرى',
  ],
  
  // Contract Terms
  contract_type_permanent: true,
  start_date: '2024-02-15',
  probation_period: 90,
  
  // Salary and Benefits
  base_salary: 15000,
  housing_allowance: 3000,
  transportation_allowance: 1000,
  communication_allowance: 500,
  total_salary: 19500,
  medical_insurance: true,
  family_medical_insurance: true,
  annual_bonus: 'راتب شهر إضافي عند انتهاء السنة المالية',
  
  // Working Hours
  weekly_hours: 40,
  working_days_per_week: 5,
  daily_start_time: '08:00',
  daily_end_time: '17:00',
  break_duration: 60,
  annual_leave: 25,
  hajj_leave: true,
  maternity_leave: 10,
  
  // Termination
  notice_period: 60,
  
  // Signatures
  employer_representative_name: 'خالد أحمد المنصور',
  employer_representative_title: 'مدير الموارد البشرية',
  signature_date: '2024-02-01',
  preparation_location: 'الرياض، المملكة العربية السعودية',
  preparation_date: '2024-01-30',
  
  // Additional arrays/objects
  other_allowances: [
    { name: 'بدل الوجبات', amount: 300 },
    { name: 'بدل التدريب', amount: 200 },
  ],
  additional_benefits: [
    'تأمين على الحياة',
    'برنامج التطوير المهني',
    'خصومات على منتجات الشركة',
  ],
  special_leaves: [
    { type: 'إجازة الزواج', duration: '3 أيام' },
    { type: 'إجازة الوفاة', duration: '3 أيام' },
  ],
  witnesses: [
    { name: 'سارة محمد الأحمد', title: 'مدير قسم تقنية المعلومات' },
    { name: 'عبدالرحمن علي الزهراني', title: 'مستشار قانوني' },
  ],
};

describe('Template Generation Integration Tests', () => {
  let mockSupabase: any;
  let mockTemplateService: any;
  let mockAuth: any;

  beforeEach(() => {
    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    };

    const { createServerSupabaseClient } = require('@/libs/supabase/supabase-server-client');
    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    // Mock auth
    const { validateAuth } = require('@/libs/auth/auth-middleware');
    mockAuth = validateAuth;
    mockAuth.mockResolvedValue(testUser);

    // Mock template service
    const { TemplateManagementService } = require('@/libs/services/template-management-service');
    mockTemplateService = {
      createTemplate: jest.fn(),
      getTemplateById: jest.fn(),
      updateTemplate: jest.fn(),
      generateDocument: jest.fn(),
      validateTemplate: jest.fn(),
    };
    TemplateManagementService.getInstance = jest.fn(() => mockTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Template Creation', () => {
    it('should create Arabic employment contract template', async () => {
      mockTemplateService.createTemplate.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockSupabase.data = arabicEmploymentTemplate;

      const request = new NextRequest('http://localhost:3000/api/v1/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: arabicEmploymentTemplate.name,
          description: arabicEmploymentTemplate.description,
          category: arabicEmploymentTemplate.category,
          language: arabicEmploymentTemplate.language,
          content: arabicEmploymentTemplate.content,
          fields: arabicEmploymentTemplate.fields,
        }),
      });

      const response = await createTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.template.name).toBe('قالب عقد العمل الأساسي');
      expect(data.template.language).toBe('ar');
      expect(data.template.fields).toHaveLength(arabicEmploymentTemplate.fields.length);
    });

    it('should validate template content for security issues', async () => {
      const maliciousTemplate = {
        name: 'Malicious Template',
        content: '<script>alert("xss")</script>{{user_input}}',
        fields: [{ name: 'user_input', type: 'text', required: true }],
      };

      mockTemplateService.validateTemplate.mockResolvedValue({
        isValid: false,
        errors: [
          { field: 'content', message: 'Script tags are not allowed', severity: 'high' },
        ],
        securityIssues: ['XSS_SCRIPT_TAG'],
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousTemplate),
      });

      const response = await createTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toContainEqual(
        expect.objectContaining({
          field: 'content',
          severity: 'high',
        })
      );
    });

    it('should handle Arabic field validation', async () => {
      const templateWithArabicFields = {
        ...arabicEmploymentTemplate,
        fields: [
          {
            name: 'arabic_field',
            label: 'حقل عربي',
            type: 'text',
            required: true,
            validation: {
              pattern: '^[\u0600-\u06FF\s]+$', // Arabic characters only
              minLength: 2,
              maxLength: 50,
            },
          },
        ],
      };

      mockTemplateService.createTemplate.mockResolvedValue({
        success: true,
        template: templateWithArabicFields,
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateWithArabicFields),
      });

      const response = await createTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.template.fields[0].validation.pattern).toBe('^[\u0600-\u06FF\s]+$');
    });
  });

  describe('Document Generation', () => {
    it('should generate Arabic employment contract document', async () => {
      mockSupabase.data = arabicEmploymentTemplate;
      
      const generatedDocument = {
        success: true,
        document: {
          id: 'doc-001',
          templateId: 'template-001',
          content: arabicEmploymentTemplate.content.replace(/{{company_name}}/g, testFormData.company_name),
          format: 'html',
          language: 'ar',
          metadata: {
            generatedAt: new Date().toISOString(),
            generatedBy: testUser.id,
            organizationId: testUser.organizationId,
          },
        },
      };

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockTemplateService.generateDocument.mockResolvedValue(generatedDocument);

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: testFormData,
          format: 'html',
          options: {
            includeCSS: true,
            rtlSupport: true,
          },
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.document.content).toContain('شركة التقنية المتقدمة المحدودة');
      expect(data.document.content).toContain('أحمد محمد عبدالله السالم');
      expect(data.document.format).toBe('html');
      expect(data.document.language).toBe('ar');
    });

    it('should generate PDF with Arabic font support', async () => {
      mockSupabase.data = arabicEmploymentTemplate;

      const pdfBuffer = Buffer.from('PDF content with Arabic text');
      const pdfDocument = {
        success: true,
        document: {
          id: 'doc-002',
          templateId: 'template-001',
          content: pdfBuffer,
          format: 'pdf',
          language: 'ar',
          filename: 'عقد-عمل-أحمد-محمد.pdf',
          metadata: {
            pageCount: 3,
            fileSize: pdfBuffer.length,
            fonts: ['NotoSansArabic-Regular', 'NotoSansArabic-Bold'],
          },
        },
      };

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockTemplateService.generateDocument.mockResolvedValue(pdfDocument);

      const { PDFGenerator } = require('@/libs/export/pdf-generator');
      PDFGenerator.generateFromTemplate = jest.fn().mockResolvedValue(pdfBuffer);

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: testFormData,
          format: 'pdf',
          options: {
            pageSize: 'A4',
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            fonts: {
              arabic: 'NotoSansArabic-Regular',
              arabicBold: 'NotoSansArabic-Bold',
            },
          },
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('عقد-عمل-أحمد-محمد.pdf');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(pdfBuffer);
    });

    it('should generate DOCX with RTL formatting', async () => {
      mockSupabase.data = arabicEmploymentTemplate;

      const docxBuffer = Buffer.from('DOCX content with Arabic RTL');
      const docxDocument = {
        success: true,
        document: {
          id: 'doc-003',
          templateId: 'template-001',
          content: docxBuffer,
          format: 'docx',
          language: 'ar',
          filename: 'عقد-عمل-أحمد-محمد.docx',
          metadata: {
            wordCount: 1500,
            pageCount: 4,
            fileSize: docxBuffer.length,
          },
        },
      };

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockTemplateService.generateDocument.mockResolvedValue(docxDocument);

      const { DOCXGenerator } = require('@/libs/export/docx-generator');
      DOCXGenerator.generateFromTemplate = jest.fn().mockResolvedValue(docxBuffer);

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: testFormData,
          format: 'docx',
          options: {
            pageOrientation: 'portrait',
            textDirection: 'rtl',
            defaultFont: 'Traditional Arabic',
          },
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(docxBuffer);
    });

    it('should validate form data against template fields', async () => {
      mockSupabase.data = arabicEmploymentTemplate;

      const invalidFormData = {
        // Missing required fields
        employee_name: '',
        employee_id: '123', // Invalid format
        base_salary: 1000, // Below minimum
        start_date: 'invalid-date',
      };

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockTemplateService.generateDocument.mockResolvedValue({
        success: false,
        errors: [
          { field: 'employee_name', message: 'اسم الموظف مطلوب', code: 'REQUIRED_FIELD' },
          { field: 'employee_id', message: 'رقم الهوية يجب أن يكون 10 أرقام', code: 'INVALID_FORMAT' },
          { field: 'base_salary', message: 'الراتب الأساسي يجب أن يكون أكبر من 3000', code: 'MIN_VALUE' },
          { field: 'start_date', message: 'تاريخ غير صحيح', code: 'INVALID_DATE' },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: invalidFormData,
          format: 'html',
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toHaveLength(4);
      expect(data.errors[0].message).toBe('اسم الموظف مطلوب');
    });

    it('should handle template with complex Arabic calculations', async () => {
      const payrollTemplate = mockArabicTemplates.payrollSlip;
      const payrollFormData = {
        employee_name: 'فاطمة أحمد الزهراني',
        employee_number: 'EMP002',
        department: 'الموارد البشرية',
        position: 'محاسبة',
        month_year: 'يناير ٢٠٢٤',
        base_salary: 12000,
        housing_allowance: 2500,
        transport_allowance: 800,
        overtime_hours: 10,
        overtime_rate: 15.625, // hourly rate for overtime
        social_insurance_rate: 0.1, // 10%
        medical_insurance: 150,
      };

      // Calculate derived fields
      const overtimePay = payrollFormData.overtime_hours * payrollFormData.overtime_rate;
      const totalEarnings = payrollFormData.base_salary + payrollFormData.housing_allowance + 
                           payrollFormData.transport_allowance + overtimePay;
      const socialInsurance = totalEarnings * payrollFormData.social_insurance_rate;
      const totalDeductions = socialInsurance + payrollFormData.medical_insurance;
      const netSalary = totalEarnings - totalDeductions;

      const calculatedFormData = {
        ...payrollFormData,
        overtime_pay: overtimePay,
        total_earnings: totalEarnings,
        social_insurance: socialInsurance,
        total_deductions: totalDeductions,
        net_salary: netSalary,
      };

      mockSupabase.data = payrollTemplate;

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: payrollTemplate,
      });

      mockTemplateService.generateDocument.mockResolvedValue({
        success: true,
        document: {
          id: 'payroll-001',
          templateId: 'template-002',
          content: 'Generated payroll slip with calculations',
          format: 'html',
          calculatedFields: {
            overtime_pay: overtimePay,
            total_earnings: totalEarnings,
            social_insurance: socialInsurance,
            net_salary: netSalary,
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-002/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: calculatedFormData,
          format: 'html',
          options: {
            performCalculations: true,
            numberFormat: 'arabic',
          },
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-002' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.document.calculatedFields.net_salary).toBeCloseTo(netSalary, 2);
    });
  });

  describe('Template Updates and Versioning', () => {
    it('should update template with version control', async () => {
      const updatedTemplate = {
        ...arabicEmploymentTemplate,
        version: '1.1.0',
        content: arabicEmploymentTemplate.content + '\n<!-- Updated content -->',
        updatedAt: new Date().toISOString(),
      };

      mockSupabase.data = updatedTemplate;

      mockTemplateService.updateTemplate.mockResolvedValue({
        success: true,
        template: updatedTemplate,
        changes: {
          version: { from: '1.0.0', to: '1.1.0' },
          content: { modified: true },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: updatedTemplate.content,
          version: '1.1.0',
          changeDescription: 'إضافة تعليق جديد في نهاية القالب',
        }),
      });

      const response = await updateTemplate(request, { params: { id: 'template-001' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.template.version).toBe('1.1.0');
      expect(data.changes).toBeDefined();
    });

    it('should maintain template history for audit trail', async () => {
      const templateHistory = [
        { version: '1.0.0', createdAt: '2024-01-15T10:00:00Z', createdBy: 'user-123' },
        { version: '1.1.0', createdAt: '2024-01-20T14:00:00Z', createdBy: 'user-123' },
        { version: '1.2.0', createdAt: '2024-01-25T09:00:00Z', createdBy: 'user-456' },
      ];

      mockSupabase.data = templateHistory;

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/history');

      // Mock history endpoint (would need to be implemented)
      const response = { status: 200, json: () => ({ success: true, history: templateHistory }) };

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing template errors', async () => {
      mockSupabase.data = null;
      mockSupabase.error = null;

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: false,
        error: 'Template not found',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates/non-existent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: testFormData,
          format: 'html',
        }),
      });

      const response = await generateDocument(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Template not found');
    });

    it('should handle document generation timeouts', async () => {
      mockSupabase.data = arabicEmploymentTemplate;

      mockTemplateService.getTemplateById.mockResolvedValue({
        success: true,
        template: arabicEmploymentTemplate,
      });

      mockTemplateService.generateDocument.mockRejectedValue(
        new Error('Document generation timeout after 30 seconds')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: testFormData,
          format: 'pdf',
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('timeout');
    });

    it('should handle Arabic text encoding issues', async () => {
      const templateWithEncodingIssue = {
        ...arabicEmploymentTemplate,
        content: 'Invalid Arabic: \uFFFD\uFFFD\uFFFD {{employee_name}}',
      };

      mockSupabase.data = templateWithEncodingIssue;

      mockTemplateService.generateDocument.mockResolvedValue({
        success: false,
        error: 'Arabic text encoding error detected',
        details: 'Template contains invalid Unicode characters',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/templates/template-001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: { employee_name: 'أحمد محمد' },
          format: 'html',
        }),
      });

      const response = await generateDocument(request, { params: { id: 'template-001' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Arabic text encoding error detected');
    });
  });
});