/**
 * Template Management Service Unit Tests
 * Tests for CRUD operations and template generation with Arabic content
 */

import { TemplateManagementService } from '@/libs/services/template-management-service';
import { TemplateService } from '@/libs/services/template-service';
import { createServerSupabaseClient } from '@/libs/supabase/supabase-server-client';

// Mock dependencies
jest.mock('@/libs/supabase/supabase-server-client');
jest.mock('@/libs/logging/structured-logger');
jest.mock('@/libs/validation/template-validator');

// Mock data
const mockArabicTemplates = {
  employmentContract: {
    id: 'template-001',
    name: 'قالب عقد العمل الأساسي',
    nameEn: 'Basic Employment Contract Template',
    description: 'قالب أساسي لعقود العمل يشمل جميع البنود القانونية المطلوبة',
    category: 'contracts',
    categoryEn: 'employment_contracts',
    language: 'ar',
    version: '1.0.0',
    status: 'active',
    isPublic: true,
    organizationId: 'org-123',
    createdBy: 'user-123',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    content: `
      <div dir="rtl" class="contract-template">
        <h1>عقد عمل</h1>
        
        <section class="parties">
          <h2>أطراف العقد</h2>
          <div class="party">
            <h3>الطرف الأول (صاحب العمل):</h3>
            <p>{{company_name}}</p>
            <p>رقم السجل التجاري: {{commercial_registration}}</p>
            <p>العنوان: {{company_address}}</p>
          </div>
          
          <div class="party">
            <h3>الطرف الثاني (العامل):</h3>
            <p>الاسم: {{employee_name}}</p>
            <p>رقم الهوية: {{employee_id}}</p>
            <p>الجنسية: {{nationality}}</p>
            <p>العنوان: {{employee_address}}</p>
          </div>
        </section>
        
        <section class="terms">
          <h2>شروط العمل</h2>
          
          <div class="term">
            <h3>المادة الأولى: طبيعة العمل</h3>
            <p>يتعهد الطرف الثاني بالعمل لدى الطرف الأول في منصب {{position}} 
               في قسم {{department}} وفقاً للوصف الوظيفي المرفق.</p>
          </div>
          
          <div class="term">
            <h3>المادة الثانية: مدة العقد</h3>
            <p>يبدأ هذا العقد من تاريخ {{start_date}} {{#if end_date}}ولمدة {{contract_duration}}{{/if}}.</p>
          </div>
          
          <div class="term">
            <h3>المادة الثالثة: الراتب والمزايا</h3>
            <ul>
              <li>الراتب الأساسي: {{base_salary}} ريال سعودي شهرياً</li>
              {{#if housing_allowance}}<li>بدل السكن: {{housing_allowance}} ريال شهرياً</li>{{/if}}
              {{#if transport_allowance}}<li>بدل المواصلات: {{transport_allowance}} ريال شهرياً</li>{{/if}}
              {{#if other_allowances}}<li>بدلات أخرى: {{other_allowances}}</li>{{/if}}
            </ul>
          </div>
          
          <div class="term">
            <h3>المادة الرابعة: ساعات العمل</h3>
            <p>ساعات العمل الأسبوعية: {{weekly_hours}} ساعة، موزعة على {{work_days}} أيام في الأسبوع.</p>
            <p>أوقات العمل: من {{start_time}} إلى {{end_time}}.</p>
          </div>
          
          <div class="term">
            <h3>المادة الخامسة: الإجازات</h3>
            <ul>
              <li>الإجازة السنوية: {{annual_leave}} يوماً مدفوعة الأجر</li>
              <li>الإجازة المرضية: حسب نظام العمل السعودي</li>
              {{#if additional_leaves}}<li>إجازات إضافية: {{additional_leaves}}</li>{{/if}}
            </ul>
          </div>
        </section>
        
        <section class="signatures">
          <h2>التوقيعات</h2>
          <div class="signature-row">
            <div class="signature">
              <p>الطرف الأول (صاحب العمل)</p>
              <p>التوقيع: ________________</p>
              <p>التاريخ: {{signature_date}}</p>
            </div>
            
            <div class="signature">
              <p>الطرف الثاني (العامل)</p>
              <p>التوقيع: ________________</p>
              <p>التاريخ: {{signature_date}}</p>
            </div>
          </div>
        </section>
      </div>
    `,
    fields: [
      {
        name: 'company_name',
        label: 'اسم الشركة',
        labelEn: 'Company Name',
        type: 'text',
        required: true,
        validation: { minLength: 2, maxLength: 100 },
        placeholder: 'أدخل اسم الشركة',
      },
      {
        name: 'commercial_registration',
        label: 'رقم السجل التجاري',
        labelEn: 'Commercial Registration',
        type: 'text',
        required: true,
        validation: { pattern: '^[0-9]{10}$' },
        placeholder: '1234567890',
      },
      {
        name: 'employee_name',
        label: 'اسم الموظف',
        labelEn: 'Employee Name',
        type: 'text',
        required: true,
        validation: { minLength: 2, maxLength: 50 },
        placeholder: 'أدخل الاسم الكامل',
      },
      {
        name: 'employee_id',
        label: 'رقم الهوية',
        labelEn: 'ID Number',
        type: 'text',
        required: true,
        validation: { pattern: '^[0-9]{10}$' },
        placeholder: '1234567890',
      },
      {
        name: 'position',
        label: 'المنصب',
        labelEn: 'Position',
        type: 'text',
        required: true,
        placeholder: 'مطور برمجيات',
      },
      {
        name: 'department',
        label: 'القسم',
        labelEn: 'Department',
        type: 'select',
        required: true,
        options: [
          { value: 'it', label: 'تقنية المعلومات' },
          { value: 'hr', label: 'الموارد البشرية' },
          { value: 'finance', label: 'المالية' },
          { value: 'marketing', label: 'التسويق' },
        ],
      },
      {
        name: 'base_salary',
        label: 'الراتب الأساسي',
        labelEn: 'Base Salary',
        type: 'number',
        required: true,
        validation: { min: 3000, max: 50000 },
        placeholder: '10000',
      },
      {
        name: 'start_date',
        label: 'تاريخ بداية العمل',
        labelEn: 'Start Date',
        type: 'date',
        required: true,
      },
      {
        name: 'contract_duration',
        label: 'مدة العقد',
        labelEn: 'Contract Duration',
        type: 'text',
        required: false,
        placeholder: 'سنة واحدة',
      },
      {
        name: 'weekly_hours',
        label: 'ساعات العمل الأسبوعية',
        labelEn: 'Weekly Hours',
        type: 'number',
        required: true,
        validation: { min: 20, max: 48 },
        defaultValue: 40,
      },
      {
        name: 'annual_leave',
        label: 'أيام الإجازة السنوية',
        labelEn: 'Annual Leave Days',
        type: 'number',
        required: true,
        validation: { min: 21, max: 30 },
        defaultValue: 21,
      },
    ],
    metadata: {
      legalCompliance: ['saudi_labor_law', 'ministry_of_hr'],
      documentType: 'legal_contract',
      language: 'ar',
      region: 'saudi_arabia',
      industry: 'general',
      lastReviewed: '2024-01-15',
      approvedBy: 'legal-team',
    },
  },

  payrollSlip: {
    id: 'template-002',
    name: 'قالب كشف الراتب',
    nameEn: 'Payroll Slip Template',
    description: 'قالب لإصدار كشوف المرتبات الشهرية',
    category: 'payroll',
    language: 'ar',
    version: '1.0.0',
    status: 'active',
    content: `
      <div dir="rtl" class="payroll-slip">
        <header class="company-header">
          <div class="company-logo">
            {{#if company_logo}}<img src="{{company_logo}}" alt="شعار الشركة">{{/if}}
          </div>
          <div class="company-info">
            <h1>{{company_name}}</h1>
            <p>{{company_address}}</p>
          </div>
        </header>
        
        <section class="slip-header">
          <h2>كشف راتب شهر {{month_year}}</h2>
          <div class="slip-info">
            <p>رقم الكشف: {{slip_number}}</p>
            <p>تاريخ الإصدار: {{issue_date}}</p>
          </div>
        </section>
        
        <section class="employee-info">
          <h3>معلومات الموظف</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>اسم الموظف:</label>
              <span>{{employee_name}}</span>
            </div>
            <div class="info-item">
              <label>الرقم الوظيفي:</label>
              <span>{{employee_number}}</span>
            </div>
            <div class="info-item">
              <label>القسم:</label>
              <span>{{department}}</span>
            </div>
            <div class="info-item">
              <label>المنصب:</label>
              <span>{{position}}</span>
            </div>
            <div class="info-item">
              <label>تاريخ الالتحاق:</label>
              <span>{{joining_date}}</span>
            </div>
            <div class="info-item">
              <label>رقم الحساب البنكي:</label>
              <span>{{bank_account}}</span>
            </div>
          </div>
        </section>
        
        <section class="salary-details">
          <h3>تفاصيل الراتب</h3>
          
          <div class="earnings">
            <h4>المستحقات</h4>
            <table>
              <thead>
                <tr>
                  <th>البيان</th>
                  <th>المبلغ (ريال)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>الراتب الأساسي</td>
                  <td class="amount">{{base_salary}}</td>
                </tr>
                {{#if housing_allowance}}
                <tr>
                  <td>بدل السكن</td>
                  <td class="amount">{{housing_allowance}}</td>
                </tr>
                {{/if}}
                {{#if transport_allowance}}
                <tr>
                  <td>بدل المواصلات</td>
                  <td class="amount">{{transport_allowance}}</td>
                </tr>
                {{/if}}
                {{#if overtime_pay}}
                <tr>
                  <td>أجر العمل الإضافي</td>
                  <td class="amount">{{overtime_pay}}</td>
                </tr>
                {{/if}}
                {{#each additional_earnings}}
                <tr>
                  <td>{{this.description}}</td>
                  <td class="amount">{{this.amount}}</td>
                </tr>
                {{/each}}
                <tr class="total-row">
                  <td><strong>إجمالي المستحقات</strong></td>
                  <td class="amount"><strong>{{total_earnings}}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="deductions">
            <h4>الاستقطاعات</h4>
            <table>
              <thead>
                <tr>
                  <th>البيان</th>
                  <th>المبلغ (ريال)</th>
                </tr>
              </thead>
              <tbody>
                {{#if social_insurance}}
                <tr>
                  <td>التأمينات الاجتماعية</td>
                  <td class="amount">{{social_insurance}}</td>
                </tr>
                {{/if}}
                {{#if income_tax}}
                <tr>
                  <td>ضريبة الدخل</td>
                  <td class="amount">{{income_tax}}</td>
                </tr>
                {{/if}}
                {{#if medical_insurance}}
                <tr>
                  <td>التأمين الطبي</td>
                  <td class="amount">{{medical_insurance}}</td>
                </tr>
                {{/if}}
                {{#each additional_deductions}}
                <tr>
                  <td>{{this.description}}</td>
                  <td class="amount">{{this.amount}}</td>
                </tr>
                {{/each}}
                <tr class="total-row">
                  <td><strong>إجمالي الاستقطاعات</strong></td>
                  <td class="amount"><strong>{{total_deductions}}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="net-salary">
            <h3>صافي الراتب: <span class="net-amount">{{net_salary}} ريال</span></h3>
          </div>
        </section>
        
        <footer class="slip-footer">
          <p>هذا الكشف صادر آلياً ولا يحتاج إلى توقيع</p>
          <p>تاريخ الطباعة: {{print_date}}</p>
        </footer>
      </div>
    `,
    fields: [
      {
        name: 'employee_name',
        label: 'اسم الموظف',
        type: 'text',
        required: true,
      },
      {
        name: 'employee_number',
        label: 'الرقم الوظيفي',
        type: 'text',
        required: true,
      },
      {
        name: 'month_year',
        label: 'الشهر والسنة',
        type: 'text',
        required: true,
        placeholder: 'يناير 2024',
      },
      {
        name: 'base_salary',
        label: 'الراتب الأساسي',
        type: 'number',
        required: true,
      },
      {
        name: 'net_salary',
        label: 'صافي الراتب',
        type: 'number',
        required: true,
        calculated: true,
      },
    ],
  },
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  data: null,
  error: null,
};

describe('Template Management Service', () => {
  let templateService: TemplateManagementService;
  let mockLogger: any;

  beforeEach(() => {
    // Mock Supabase client
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Mock logger
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    templateService = new TemplateManagementService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Template CRUD Operations', () => {
    it('should create a new Arabic template', async () => {
      mockSupabaseClient.data = mockArabicTemplates.employmentContract;
      mockSupabaseClient.error = null;

      const templateData = {
        name: 'قالب عقد العمل الأساسي',
        description: 'قالب أساسي لعقود العمل',
        category: 'contracts',
        language: 'ar',
        content: mockArabicTemplates.employmentContract.content,
        fields: mockArabicTemplates.employmentContract.fields,
        organizationId: 'org-123',
        createdBy: 'user-123',
      };

      const result = await templateService.createTemplate(templateData);

      expect(result.success).toBe(true);
      expect(result.template.id).toBe('template-001');
      expect(result.template.name).toBe('قالب عقد العمل الأساسي');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'قالب عقد العمل الأساسي',
          language: 'ar',
          organization_id: 'org-123',
        })
      );
    });

    it('should retrieve templates by category', async () => {
      mockSupabaseClient.data = [
        mockArabicTemplates.employmentContract,
        mockArabicTemplates.payrollSlip,
      ];

      const result = await templateService.getTemplatesByCategory('contracts', {
        organizationId: 'org-123',
        language: 'ar',
      });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].category).toBe('contracts');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('category', 'contracts');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('language', 'ar');
    });

    it('should update template content', async () => {
      const updatedTemplate = {
        ...mockArabicTemplates.employmentContract,
        version: '1.1.0',
        updatedAt: new Date().toISOString(),
      };

      mockSupabaseClient.data = updatedTemplate;

      const result = await templateService.updateTemplate('template-001', {
        content: 'Updated content',
        version: '1.1.0',
        updatedBy: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.template.version).toBe('1.1.0');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Updated content',
          version: '1.1.0',
          updated_by: 'user-123',
        })
      );
    });

    it('should delete template with validation', async () => {
      mockSupabaseClient.data = { id: 'template-001' };

      const result = await templateService.deleteTemplate('template-001', {
        userId: 'user-123',
        organizationId: 'org-123',
        force: false,
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'deleted',
        deleted_at: expect.any(String),
        deleted_by: 'user-123',
      });
    });

    it('should clone template for customization', async () => {
      const clonedTemplate = {
        ...mockArabicTemplates.employmentContract,
        id: 'template-002',
        name: 'قالب عقد العمل - نسخة معدلة',
        version: '1.0.0-clone',
        clonedFrom: 'template-001',
      };

      mockSupabaseClient.data = clonedTemplate;

      const result = await templateService.cloneTemplate('template-001', {
        name: 'قالب عقد العمل - نسخة معدلة',
        organizationId: 'org-123',
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.template.name).toBe('قالب عقد العمل - نسخة معدلة');
      expect(result.template.clonedFrom).toBe('template-001');
    });
  });

  describe('Template Generation', () => {
    it('should generate document from Arabic template', async () => {
      const templateData = mockArabicTemplates.employmentContract;
      const formData = {
        company_name: 'شركة التقنية المتقدمة المحدودة',
        commercial_registration: '1234567890',
        employee_name: 'أحمد محمد السالم',
        employee_id: '9876543210',
        position: 'مطور برمجيات',
        department: 'it',
        base_salary: 12000,
        start_date: '2024-02-01',
        weekly_hours: 40,
        annual_leave: 21,
        signature_date: '2024-01-15',
      };

      mockSupabaseClient.data = templateData;

      const result = await templateService.generateDocument('template-001', formData, {
        format: 'html',
        language: 'ar',
      });

      expect(result.success).toBe(true);
      expect(result.document.content).toContain('شركة التقنية المتقدمة المحدودة');
      expect(result.document.content).toContain('أحمد محمد السالم');
      expect(result.document.content).toContain('مطور برمجيات');
      expect(result.document.format).toBe('html');
      expect(result.document.language).toBe('ar');
    });

    it('should validate form data against template fields', async () => {
      const templateData = mockArabicTemplates.employmentContract;
      const invalidFormData = {
        company_name: '', // Required field missing
        employee_id: '123', // Invalid format
        base_salary: 1000, // Below minimum
      };

      mockSupabaseClient.data = templateData;

      const result = await templateService.generateDocument('template-001', invalidFormData);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContainEqual({
        field: 'company_name',
        message: 'اسم الشركة مطلوب',
        code: 'REQUIRED_FIELD',
      });
      expect(result.errors).toContainEqual({
        field: 'employee_id',
        message: 'رقم الهوية يجب أن يكون 10 أرقام',
        code: 'INVALID_FORMAT',
      });
    });

    it('should handle conditional fields in template', async () => {
      const templateData = mockArabicTemplates.employmentContract;
      const formDataWithOptionals = {
        company_name: 'شركة التقنية المتقدمة',
        employee_name: 'أحمد محمد',
        employee_id: '1234567890',
        position: 'مطور',
        department: 'it',
        base_salary: 15000,
        housing_allowance: 2000,
        transport_allowance: 800,
        start_date: '2024-02-01',
        weekly_hours: 40,
        annual_leave: 25,
      };

      mockSupabaseClient.data = templateData;

      const result = await templateService.generateDocument('template-001', formDataWithOptionals);

      expect(result.success).toBe(true);
      expect(result.document.content).toContain('بدل السكن: 2000 ريال شهرياً');
      expect(result.document.content).toContain('بدل المواصلات: 800 ريال شهرياً');
    });

    it('should generate template in multiple formats', async () => {
      const templateData = mockArabicTemplates.employmentContract;
      const formData = {
        company_name: 'شركة التقنية',
        employee_name: 'أحمد محمد',
        employee_id: '1234567890',
        position: 'مطور',
        department: 'it',
        base_salary: 12000,
        start_date: '2024-02-01',
        weekly_hours: 40,
        annual_leave: 21,
      };

      mockSupabaseClient.data = templateData;

      // Test HTML generation
      const htmlResult = await templateService.generateDocument('template-001', formData, {
        format: 'html',
      });
      expect(htmlResult.success).toBe(true);
      expect(htmlResult.document.format).toBe('html');

      // Test PDF generation
      const pdfResult = await templateService.generateDocument('template-001', formData, {
        format: 'pdf',
        pdfOptions: {
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
          format: 'A4',
          orientation: 'portrait',
        },
      });
      expect(pdfResult.success).toBe(true);
      expect(pdfResult.document.format).toBe('pdf');

      // Test DOCX generation
      const docxResult = await templateService.generateDocument('template-001', formData, {
        format: 'docx',
        docxOptions: {
          pageSize: 'A4',
          margins: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      });
      expect(docxResult.success).toBe(true);
      expect(docxResult.document.format).toBe('docx');
    });

    it('should handle Arabic number formatting in templates', async () => {
      const templateData = mockArabicTemplates.payrollSlip;
      const formData = {
        employee_name: 'فاطمة أحمد',
        employee_number: 'EMP001',
        month_year: 'يناير ٢٠٢٤',
        base_salary: 15000,
        housing_allowance: 2500,
        total_earnings: 17500,
        social_insurance: 1312.5,
        total_deductions: 1312.5,
        net_salary: 16187.5,
      };

      mockSupabaseClient.data = templateData;

      const result = await templateService.generateDocument('template-002', formData, {
        format: 'html',
        numberFormat: 'arabic',
      });

      expect(result.success).toBe(true);
      expect(result.document.content).toContain('١٥,٠٠٠'); // Arabic numerals
      expect(result.document.content).toContain('يناير ٢٠٢٤');
    });
  });

  describe('Template Validation', () => {
    it('should validate template structure', async () => {
      const invalidTemplate = {
        name: '', // Missing required field
        content: 'Invalid {{field}} template', // Invalid syntax
        fields: [
          {
            name: 'field1',
            // Missing required 'type' field
            required: true,
          },
        ],
      };

      const { TemplateValidator } = require('@/libs/validation/template-validator');
      TemplateValidator.validate = jest.fn().mockReturnValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Template name is required' },
          { field: 'content', message: 'Invalid template syntax at {{field}}' },
          { field: 'fields[0].type', message: 'Field type is required' },
        ],
      });

      const result = await templateService.validateTemplate(invalidTemplate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should validate Arabic template content', async () => {
      const arabicTemplate = {
        name: 'قالب اختبار',
        content: `
          <div dir="rtl">
            <h1>{{title}}</h1>
            <p>{{description}}</p>
            {{#if optional_field}}<p>{{optional_field}}</p>{{/if}}
          </div>
        `,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'textarea', required: true },
          { name: 'optional_field', type: 'text', required: false },
        ],
        language: 'ar',
      };

      const { TemplateValidator } = require('@/libs/validation/template-validator');
      TemplateValidator.validate = jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Template includes RTL directive'],
      });

      const result = await templateService.validateTemplate(arabicTemplate);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Template includes RTL directive');
    });

    it('should check for security vulnerabilities in templates', async () => {
      const maliciousTemplate = {
        name: 'Malicious Template',
        content: `
          <div>
            <script>alert('xss')</script>
            {{user_input}}
            <iframe src="javascript:alert('xss')"></iframe>
          </div>
        `,
        fields: [
          { name: 'user_input', type: 'text', required: true },
        ],
      };

      const { TemplateValidator } = require('@/libs/validation/template-validator');
      TemplateValidator.validate = jest.fn().mockReturnValue({
        isValid: false,
        errors: [
          { field: 'content', message: 'Script tags are not allowed', severity: 'high' },
          { field: 'content', message: 'JavaScript URLs are not allowed', severity: 'high' },
        ],
        securityIssues: ['XSS_SCRIPT_TAG', 'JAVASCRIPT_URL'],
      });

      const result = await templateService.validateTemplate(maliciousTemplate);

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toContain('XSS_SCRIPT_TAG');
      expect(result.securityIssues).toContain('JAVASCRIPT_URL');
    });
  });

  describe('Template Categories and Organization', () => {
    it('should get available template categories', async () => {
      const mockCategories = [
        { id: 'contracts', name: 'العقود', nameEn: 'Contracts', count: 5 },
        { id: 'payroll', name: 'المرتبات', nameEn: 'Payroll', count: 3 },
        { id: 'hr_forms', name: 'نماذج الموارد البشرية', nameEn: 'HR Forms', count: 8 },
        { id: 'reports', name: 'التقارير', nameEn: 'Reports', count: 4 },
      ];

      mockSupabaseClient.data = mockCategories;

      const result = await templateService.getTemplateCategories({
        organizationId: 'org-123',
        language: 'ar',
      });

      expect(result.success).toBe(true);
      expect(result.categories).toHaveLength(4);
      expect(result.categories[0].name).toBe('العقود');
    });

    it('should search templates by keyword', async () => {
      const searchResults = [mockArabicTemplates.employmentContract];
      mockSupabaseClient.data = searchResults;

      const result = await templateService.searchTemplates('عقد عمل', {
        organizationId: 'org-123',
        language: 'ar',
        categories: ['contracts'],
      });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toContain('عقد العمل');
    });

    it('should get template usage statistics', async () => {
      const usageStats = {
        totalGenerations: 150,
        popularTemplates: [
          { templateId: 'template-001', name: 'قالب عقد العمل', usage: 89 },
          { templateId: 'template-002', name: 'قالب كشف الراتب', usage: 61 },
        ],
        usageByMonth: [
          { month: '2024-01', generations: 150 },
          { month: '2023-12', generations: 132 },
        ],
      };

      mockSupabaseClient.data = usageStats;

      const result = await templateService.getTemplateUsageStats({
        organizationId: 'org-123',
        period: 'last6months',
      });

      expect(result.success).toBe(true);
      expect(result.stats.totalGenerations).toBe(150);
      expect(result.stats.popularTemplates).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabaseClient.error = new Error('Database connection failed');
      mockSupabaseClient.data = null;

      const result = await templateService.getTemplatesByCategory('contracts');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch templates', expect.any(Error));
    });

    it('should handle template not found errors', async () => {
      mockSupabaseClient.data = null;
      mockSupabaseClient.error = null;

      const result = await templateService.getTemplateById('non-existent-template');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('should handle insufficient permissions', async () => {
      mockSupabaseClient.error = new Error('Insufficient permissions');

      const result = await templateService.deleteTemplate('template-001', {
        userId: 'user-456',
        organizationId: 'org-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });
  });
});