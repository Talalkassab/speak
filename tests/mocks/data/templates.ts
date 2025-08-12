export const mockTemplateData = {
  templates: [
    {
      id: 'template-1',
      name: 'عقد عمل محدد المدة',
      name_en: 'Fixed-Term Employment Contract',
      description: 'قالب عقد العمل للموظفين محددي المدة وفقاً لنظام العمل السعودي',
      description_en: 'Fixed-term employment contract template according to Saudi Labor Law',
      category: 'contracts',
      language: 'ar',
      content: `# عقد عمل محدد المدة

## بيانات صاحب العمل:
- الاسم: {{company_name}}
- رقم السجل التجاري: {{commercial_register}}
- العنوان: {{company_address}}

## بيانات الموظف:
- الاسم: {{employee_name}}
- رقم الهوية: {{employee_id}}
- الجنسية: {{employee_nationality}}
- العنوان: {{employee_address}}

## تفاصيل العمل:
- المسمى الوظيفي: {{job_title}}
- الراتب الأساسي: {{basic_salary}} ريال سعودي
- تاريخ البدء: {{start_date}}
- تاريخ الانتهاء: {{end_date}}
- مكان العمل: {{work_location}}

## الشروط والأحكام:
1. ساعات العمل: {{working_hours}} ساعة أسبوعياً
2. الإجازة السنوية: {{annual_leave}} يوماً
3. فترة التجربة: {{probation_period}} شهر

التوقيع:
صاحب العمل: ________________
الموظف: ________________
التاريخ: ________________`,
      variables: [
        { name: 'company_name', label: 'اسم الشركة', type: 'text', required: true },
        { name: 'commercial_register', label: 'رقم السجل التجاري', type: 'text', required: true },
        { name: 'company_address', label: 'عنوان الشركة', type: 'textarea', required: true },
        { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
        { name: 'employee_id', label: 'رقم الهوية', type: 'text', required: true },
        { name: 'employee_nationality', label: 'الجنسية', type: 'text', required: true },
        { name: 'employee_address', label: 'عنوان الموظف', type: 'textarea', required: true },
        { name: 'job_title', label: 'المسمى الوظيفي', type: 'text', required: true },
        { name: 'basic_salary', label: 'الراتب الأساسي', type: 'number', required: true },
        { name: 'start_date', label: 'تاريخ البدء', type: 'date', required: true },
        { name: 'end_date', label: 'تاريخ الانتهاء', type: 'date', required: true },
        { name: 'work_location', label: 'مكان العمل', type: 'text', required: true },
        { name: 'working_hours', label: 'ساعات العمل الأسبوعية', type: 'number', required: true },
        { name: 'annual_leave', label: 'الإجازة السنوية بالأيام', type: 'number', required: false },
        { name: 'probation_period', label: 'فترة التجربة بالشهور', type: 'number', required: false },
      ],
      created_at: '2025-08-01T10:00:00Z',
      updated_at: '2025-08-05T14:30:00Z',
      created_by: 'user-123',
      organization_id: 'org-1',
      usage_count: 45,
      is_active: true,
      compliance_checked: true,
      compliance_score: 0.96,
    },
    {
      id: 'template-2',
      name: 'تقرير تقييم الأداء السنوي',
      name_en: 'Annual Performance Evaluation Report',
      description: 'قالب تقرير تقييم أداء الموظفين السنوي',
      description_en: 'Annual employee performance evaluation report template',
      category: 'evaluations',
      language: 'ar',
      content: `# تقرير تقييم الأداء السنوي

## معلومات الموظف:
- الاسم: {{employee_name}}
- المسمى الوظيفي: {{job_title}}
- القسم: {{department}}
- المدير المباشر: {{supervisor_name}}
- فترة التقييم: من {{evaluation_start_date}} إلى {{evaluation_end_date}}

## تقييم الأداء:

### الأهداف المحققة:
{{achieved_goals}}

### نقاط القوة:
{{strengths}}

### مجالات التحسين:
{{improvement_areas}}

### التقييم الإجمالي:
- الدرجة: {{overall_rating}}/10
- التوصية: {{recommendation}}

### خطة التطوير المقترحة:
{{development_plan}}

---
تاريخ التقييم: {{evaluation_date}}
توقيع المدير: ________________
توقيع الموظف: ________________`,
      variables: [
        { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
        { name: 'job_title', label: 'المسمى الوظيفي', type: 'text', required: true },
        { name: 'department', label: 'القسم', type: 'text', required: true },
        { name: 'supervisor_name', label: 'اسم المدير المباشر', type: 'text', required: true },
        { name: 'evaluation_start_date', label: 'تاريخ بداية فترة التقييم', type: 'date', required: true },
        { name: 'evaluation_end_date', label: 'تاريخ نهاية فترة التقييم', type: 'date', required: true },
        { name: 'achieved_goals', label: 'الأهداف المحققة', type: 'textarea', required: true },
        { name: 'strengths', label: 'نقاط القوة', type: 'textarea', required: true },
        { name: 'improvement_areas', label: 'مجالات التحسين', type: 'textarea', required: true },
        { name: 'overall_rating', label: 'التقييم الإجمالي', type: 'number', required: true },
        { name: 'recommendation', label: 'التوصية', type: 'text', required: true },
        { name: 'development_plan', label: 'خطة التطوير المقترحة', type: 'textarea', required: true },
        { name: 'evaluation_date', label: 'تاريخ التقييم', type: 'date', required: true },
      ],
      created_at: '2025-08-02T11:00:00Z',
      updated_at: '2025-08-08T16:20:00Z',
      created_by: 'user-456',
      organization_id: 'org-1',
      usage_count: 28,
      is_active: true,
      compliance_checked: true,
      compliance_score: 0.89,
    },
    {
      id: 'template-3',
      name: 'إنذار كتابي للموظف',
      name_en: 'Employee Written Warning',
      description: 'قالب الإنذار الكتابي للموظفين',
      description_en: 'Employee written warning template',
      category: 'disciplinary',
      language: 'ar',
      content: `# إنذار كتابي

## بيانات الموظف:
- الاسم: {{employee_name}}
- رقم الموظف: {{employee_number}}
- المسمى الوظيفي: {{job_title}}
- القسم: {{department}}

## تفاصيل المخالفة:
- تاريخ المخالفة: {{violation_date}}
- نوع المخالفة: {{violation_type}}
- وصف المخالفة: {{violation_description}}

## الإجراء المتخذ:
{{disciplinary_action}}

## التحذير:
في حالة تكرار هذه المخالفة أو أي مخالفة أخرى، ستتعرض للإجراءات التأديبية الأشد وقد تصل إلى إنهاء الخدمة.

## المطلوب:
{{required_action}}

---
تاريخ الإنذار: {{warning_date}}
اسم المدير: {{manager_name}}
توقيع المدير: ________________

**إقرار الموظف:**
أقر بأنني استلمت هذا الإنذار وأتفهم محتواه.

توقيع الموظف: ________________
التاريخ: ________________`,
      variables: [
        { name: 'employee_name', label: 'اسم الموظف', type: 'text', required: true },
        { name: 'employee_number', label: 'رقم الموظف', type: 'text', required: true },
        { name: 'job_title', label: 'المسمى الوظيفي', type: 'text', required: true },
        { name: 'department', label: 'القسم', type: 'text', required: true },
        { name: 'violation_date', label: 'تاريخ المخالفة', type: 'date', required: true },
        { name: 'violation_type', label: 'نوع المخالفة', type: 'text', required: true },
        { name: 'violation_description', label: 'وصف المخالفة', type: 'textarea', required: true },
        { name: 'disciplinary_action', label: 'الإجراء التأديبي', type: 'textarea', required: true },
        { name: 'required_action', label: 'الإجراء المطلوب من الموظف', type: 'textarea', required: true },
        { name: 'warning_date', label: 'تاريخ الإنذار', type: 'date', required: true },
        { name: 'manager_name', label: 'اسم المدير', type: 'text', required: true },
      ],
      created_at: '2025-08-03T09:30:00Z',
      updated_at: '2025-08-03T09:30:00Z',
      created_by: 'user-789',
      organization_id: 'org-1',
      usage_count: 12,
      is_active: true,
      compliance_checked: true,
      compliance_score: 0.94,
    },
  ],

  categories: [
    {
      id: 'contracts',
      name: 'العقود',
      name_en: 'Contracts',
      description: 'قوالب عقود العمل المختلفة',
      description_en: 'Various employment contract templates',
      count: 8,
      icon: 'contract',
    },
    {
      id: 'evaluations',
      name: 'التقييمات',
      name_en: 'Evaluations',
      description: 'قوالب تقييم الأداء والتقييمات',
      description_en: 'Performance evaluation and assessment templates',
      count: 5,
      icon: 'evaluation',
    },
    {
      id: 'disciplinary',
      name: 'التأديبية',
      name_en: 'Disciplinary',
      description: 'قوالب الإجراءات التأديبية',
      description_en: 'Disciplinary action templates',
      count: 4,
      icon: 'warning',
    },
    {
      id: 'policies',
      name: 'السياسات',
      name_en: 'Policies',
      description: 'قوالب السياسات والإجراءات',
      description_en: 'Policy and procedure templates',
      count: 12,
      icon: 'policy',
    },
    {
      id: 'reports',
      name: 'التقارير',
      name_en: 'Reports',
      description: 'قوالب التقارير المختلفة',
      description_en: 'Various report templates',
      count: 7,
      icon: 'report',
    },
  ],

  generated_documents: [
    {
      id: 'gen-doc-1',
      template_id: 'template-1',
      template_name: 'عقد عمل محدد المدة',
      generated_at: '2025-08-11T10:30:00Z',
      variables_used: {
        company_name: 'شركة التقنية المتقدمة',
        employee_name: 'أحمد محمد علي',
        job_title: 'مطور برمجيات',
        basic_salary: '15000',
        start_date: '2025-09-01',
        end_date: '2026-08-31',
      },
      format: 'pdf',
      file_size: 156789,
      status: 'completed',
      download_url: '/downloads/contract-ahmed-2025.pdf',
    },
    {
      id: 'gen-doc-2',
      template_id: 'template-2',
      template_name: 'تقرير تقييم الأداء السنوي',
      generated_at: '2025-08-10T14:15:00Z',
      variables_used: {
        employee_name: 'فاطمة سالم الأحمد',
        job_title: 'مدير الموارد البشرية',
        department: 'الموارد البشرية',
        overall_rating: '8',
        recommendation: 'ترقية للدرجة التالية',
      },
      format: 'docx',
      file_size: 98432,
      status: 'completed',
      download_url: '/downloads/evaluation-fatima-2025.docx',
    },
  ],

  ai_suggestions: [
    {
      template_id: 'template-1',
      suggestion_type: 'improvement',
      suggestion: 'يُنصح بإضافة بند حول العمل عن بُعد وفقاً للممارسات الحديثة',
      suggestion_en: 'Recommend adding a remote work clause according to modern practices',
      priority: 'medium',
      compliance_related: false,
    },
    {
      template_id: 'template-3',
      suggestion_type: 'compliance',
      suggestion: 'يجب إضافة المادة القانونية المرجعية من نظام العمل السعودي',
      suggestion_en: 'Must add the legal reference article from Saudi Labor Law',
      priority: 'high',
      compliance_related: true,
    },
  ],
};