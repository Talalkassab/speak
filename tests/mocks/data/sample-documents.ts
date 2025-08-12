/**
 * Sample documents for testing OCR and document processing features
 */

export const sampleDocuments = {
  // Arabic HR documents
  arabicDocuments: {
    employmentContract: {
      id: 'contract-001',
      title: 'عقد عمل - أحمد محمد',
      type: 'employment_contract',
      language: 'ar',
      content: `
        عقد عمل
        
        الطرف الأول: شركة التقنية المتقدمة المحدودة
        الطرف الثاني: أحمد محمد السالم
        رقم الهوية: ١٠٢٣٤٥٦٧٨٩
        
        المادة الأولى: طبيعة العمل
        يتعهد الطرف الثاني بالعمل كمطور برمجيات في قسم تقنية المعلومات
        
        المادة الثانية: الراتب والمزايا
        الراتب الأساسي: ١٢,٠٠٠ ريال سعودي
        بدل السكن: ٢,٠٠٠ ريال سعودي
        بدل المواصلات: ٨٠٠ ريال سعودي
      `,
      metadata: {
        employee_id: 'EMP001',
        department: 'IT',
        position: 'Software Developer',
        start_date: '2024-01-01',
        salary: 12000,
      },
    },
    
    payrollSlip: {
      id: 'payroll-001',
      title: 'كشف راتب - يناير ٢٠٢٤',
      type: 'payroll_slip',
      language: 'ar',
      content: `
        شركة التقنية المتقدمة المحدودة
        كشف راتب شهر يناير ٢٠٢٤
        
        اسم الموظف: أحمد محمد السالم
        الرقم الوظيفي: EMP001
        القسم: تقنية المعلومات
        
        الراتب الأساسي: ١٢,٠٠٠.٠٠ ريال
        بدل السكن: ٢,٠٠٠.٠٠ ريال
        بدل المواصلات: ٨٠٠.٠٠ ريال
        إجمالي المستحقات: ١٤,٨٠٠.٠٠ ريال
        
        الاستقطاعات:
        التأمينات الاجتماعية: ١,١١٠.٠٠ ريال
        ضريبة الدخل: ٠.٠٠ ريال
        إجمالي الاستقطاعات: ١,١١٠.٠٠ ريال
        
        صافي الراتب: ١٣,٦٩٠.٠٠ ريال
      `,
      metadata: {
        employee_id: 'EMP001',
        month: '2024-01',
        gross_salary: 14800,
        deductions: 1110,
        net_salary: 13690,
      },
    },
    
    leaveRequest: {
      id: 'leave-001',
      title: 'طلب إجازة اعتيادية',
      type: 'leave_request',
      language: 'ar',
      content: `
        طلب إجازة
        
        اسم الموظف: فاطمة أحمد الزهراني
        الرقم الوظيفي: EMP002
        القسم: الموارد البشرية
        
        نوع الإجازة: إجازة اعتيادية
        تاريخ بداية الإجازة: ١٥/٠٢/٢٠٢٤
        تاريخ نهاية الإجازة: ٢٢/٠٢/٢٠٢٤
        عدد الأيام: ٦ أيام
        
        سبب الإجازة: قضاء إجازة مع العائلة
        
        التوقيع: فاطمة أحمد الزهراني
        التاريخ: ١٠/٠٢/٢٠٢٤
      `,
      metadata: {
        employee_id: 'EMP002',
        leave_type: 'annual',
        start_date: '2024-02-15',
        end_date: '2024-02-22',
        days_count: 6,
        status: 'pending',
      },
    },
  },

  // English HR documents for comparison
  englishDocuments: {
    employmentContract: {
      id: 'contract-en-001',
      title: 'Employment Contract - John Smith',
      type: 'employment_contract',
      language: 'en',
      content: `
        EMPLOYMENT AGREEMENT
        
        This Employment Agreement is entered into between:
        Employer: Advanced Technology Company Ltd.
        Employee: John Smith
        ID Number: 1023456789
        
        Article 1: Nature of Work
        The Employee agrees to work as a Software Developer in the IT Department
        
        Article 2: Compensation and Benefits
        Base Salary: SAR 12,000 per month
        Housing Allowance: SAR 2,000 per month
        Transportation Allowance: SAR 800 per month
      `,
      metadata: {
        employee_id: 'EMP003',
        department: 'IT',
        position: 'Software Developer',
        start_date: '2024-01-01',
        salary: 12000,
      },
    },
  },

  // Mixed language documents
  mixedLanguageDocuments: {
    bilingualContract: {
      id: 'contract-mixed-001',
      title: 'عقد عمل ثنائي اللغة - Bilingual Contract',
      type: 'employment_contract',
      language: 'mixed',
      content: `
        عقد عمل - Employment Contract
        
        الطرف الأول - First Party: شركة التقنية المتقدمة - Advanced Technology Co.
        الطرف الثاني - Second Party: سارة محمد أحمد - Sarah Mohammed Ahmed
        
        المادة الأولى - Article 1: طبيعة العمل - Nature of Work
        تعمل الموظفة كمحاسبة - The employee works as an Accountant
        
        الراتب - Salary: ١٠,٠٠٠ ريال سعودي - SAR 10,000
      `,
      metadata: {
        employee_id: 'EMP004',
        languages: ['ar', 'en'],
        position: 'Accountant',
      },
    },
  },

  // Scanned document simulation data
  scannedDocuments: {
    lowQuality: {
      id: 'scan-low-001',
      quality: 'low',
      dpi: 150,
      rotation: 2, // degrees
      noise_level: 'high',
      content: 'شهادة خ#رة م$شوشة', // Simulated OCR errors
      original_content: 'شهادة خبرة مشوشة',
    },
    
    highQuality: {
      id: 'scan-high-001',
      quality: 'high',
      dpi: 600,
      rotation: 0,
      noise_level: 'low',
      content: 'شهادة خبرة واضحة',
      original_content: 'شهادة خبرة واضحة',
    },
  },

  // File upload test data
  fileTestData: {
    validFiles: [
      {
        name: 'contract.pdf',
        type: 'application/pdf',
        size: 1024 * 1024, // 1MB
        content: 'PDF content simulation',
      },
      {
        name: 'document.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 512 * 1024, // 512KB
        content: 'DOCX content simulation',
      },
      {
        name: 'image.png',
        type: 'image/png',
        size: 256 * 1024, // 256KB
        content: 'PNG image simulation',
      },
    ],
    
    invalidFiles: [
      {
        name: 'malicious.exe',
        type: 'application/x-msdownload',
        size: 1024,
        content: 'Malicious content',
      },
      {
        name: 'huge_file.pdf',
        type: 'application/pdf',
        size: 100 * 1024 * 1024, // 100MB (too large)
        content: 'Huge file content',
      },
    ],
  },

  // Template documents for generation testing
  templates: {
    employmentContractTemplate: {
      id: 'template-contract-001',
      name: 'قالب عقد العمل الأساسي',
      category: 'contracts',
      language: 'ar',
      fields: [
        { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
        { name: 'position', label: 'المنصب', type: 'text', required: true },
        { name: 'department', label: 'القسم', type: 'text', required: true },
        { name: 'salary', label: 'الراتب', type: 'number', required: true },
        { name: 'start_date', label: 'تاريخ البداية', type: 'date', required: true },
      ],
      template: `
        عقد عمل
        
        اسم الموظف: {{employee_name}}
        المنصب: {{position}}
        القسم: {{department}}
        الراتب: {{salary}} ريال سعودي
        تاريخ البداية: {{start_date}}
      `,
    },
    
    leaveRequestTemplate: {
      id: 'template-leave-001',
      name: 'قالب طلب الإجازة',
      category: 'leaves',
      language: 'ar',
      fields: [
        { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
        { name: 'leave_type', label: 'نوع الإجازة', type: 'select', required: true },
        { name: 'start_date', label: 'تاريخ البداية', type: 'date', required: true },
        { name: 'end_date', label: 'تاريخ النهاية', type: 'date', required: true },
        { name: 'reason', label: 'السبب', type: 'textarea', required: false },
      ],
      template: `
        طلب إجازة
        
        اسم الموظف: {{employee_name}}
        نوع الإجازة: {{leave_type}}
        من: {{start_date}} إلى: {{end_date}}
        السبب: {{reason}}
      `,
    },
  },
};

// Document processing test utilities
export const documentTestUtils = {
  // Generate test file blob
  createTestFile: (name: string, content: string, type: string): File => {
    const blob = new Blob([content], { type });
    return new File([blob], name, { type });
  },

  // Simulate OCR processing
  simulateOCR: (content: string, quality: 'low' | 'medium' | 'high') => {
    const errorRates = { low: 0.15, medium: 0.05, high: 0.01 };
    const errorRate = errorRates[quality];
    
    return content
      .split('')
      .map(char => Math.random() < errorRate ? '#' : char)
      .join('');
  },

  // Validate document structure
  validateDocumentStructure: (doc: any) => {
    const requiredFields = ['id', 'title', 'type', 'language', 'content'];
    return requiredFields.every(field => field in doc);
  },

  // Extract metadata from content
  extractMetadata: (content: string, language: 'ar' | 'en') => {
    const patterns = {
      ar: {
        employeeId: /الرقم الوظيفي:\s*(\w+)/,
        salary: /الراتب[^:]*:\s*([\d,]+)/,
        date: /(\d{2}\/\d{2}\/\d{4})/,
      },
      en: {
        employeeId: /Employee ID:\s*(\w+)/,
        salary: /Salary[^:]*:\s*SAR\s*([\d,]+)/,
        date: /(\d{2}\/\d{2}\/\d{4})/,
      },
    };

    const langPatterns = patterns[language];
    const metadata: any = {};

    for (const [key, pattern] of Object.entries(langPatterns)) {
      const match = content.match(pattern);
      if (match) {
        metadata[key] = match[1];
      }
    }

    return metadata;
  },
};

export default sampleDocuments;