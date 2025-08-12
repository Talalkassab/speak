-- Insert comprehensive Saudi HR templates

-- Delete existing sample templates to avoid conflicts
DELETE FROM hr_templates WHERE organization_id IS NULL;

-- Employment Contract Templates
INSERT INTO hr_templates (id, name, description, category, language, template_content, required_fields, compliance_rules, created_by) VALUES

-- Arabic Employment Contract
(
  gen_random_uuid(),
  'عقد عمل غير محدد المدة',
  'عقد عمل غير محدد المدة متوافق مع نظام العمل السعودي',
  'employment',
  'ar',
  'بسم الله الرحمن الرحيم

الشركة: {{organization_name}}
سجل تجاري رقم: {{commercial_registration}}
العنوان: {{organization_address}}

عقد عمل غير محدد المدة

الطرف الأول (صاحب العمل):
{{organization_name}}

الطرف الثاني (العامل):
الاسم: {{employee_name}}
الجنسية: {{nationality}}
رقم الهوية/الإقامة: {{id_number}}
العنوان: {{employee_address}}
رقم الهاتف: {{phone_number}}

تفاصيل العقد:
المسمى الوظيفي: {{job_title}}
القسم: {{department}}
مكان العمل: {{work_location}}
تاريخ بدء العمل: {{start_date}}
فترة التجربة: {{probation_period}} يوماً (لا تتجاوز 90 يوماً)

الراتب والمزايا:
- الراتب الأساسي: {{basic_salary}} ريال سعودي شهرياً
- بدل السكن: {{housing_allowance}} ريال سعودي شهرياً
- بدل المواصلات: {{transport_allowance}} ريال سعودي شهرياً
- المزايا الأخرى: {{other_benefits}}

ساعات العمل:
- ساعات العمل اليومية: {{daily_hours}} ساعات (لا تتجاوز 8 ساعات)
- أيام العمل: {{working_days}} في الأسبوع
- يوم الراحة الأسبوعية: {{weekly_rest_day}}

الإجازات:
- الإجازة السنوية: {{annual_leave}} يوماً مدفوعة الأجر
- الإجازات المرضية: حسب نظام العمل السعودي
- إجازة الأمومة: 10 أسابيع مدفوعة الأجر

الالتزامات والواجبات:
1. الالتزام بأنظمة وقوانين الشركة
2. المحافظة على أسرار العمل
3. الحضور والانصراف في المواعيد المحددة
4. أداء العمل بإخلاص وأمانة

إنهاء العقد:
- يحق لأي من الطرفين إنهاء العقد بإشعار مسبق {{notice_period}} يوماً
- مكافأة نهاية الخدمة تحسب وفقاً لنظام العمل السعودي
- في حالة الإنهاء التعسفي، يستحق العامل تعويضاً وفقاً للنظام

تم توقيع هذا العقد في مدينة {{city}} بتاريخ {{contract_date}}

إمضاء الطرف الأول (صاحب العمل): ________________
إمضاء الطرف الثاني (العامل): ________________

ختم الشركة: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "nationality", "type": "text", "required": true, "label": "الجنسية", "labelAr": "الجنسية"},
    {"name": "id_number", "type": "text", "required": true, "label": "رقم الهوية/الإقامة", "labelAr": "رقم الهوية/الإقامة"},
    {"name": "employee_address", "type": "textarea", "required": true, "label": "عنوان الموظف", "labelAr": "عنوان الموظف"},
    {"name": "phone_number", "type": "text", "required": true, "label": "رقم الهاتف", "labelAr": "رقم الهاتف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "department", "type": "text", "required": true, "label": "القسم", "labelAr": "القسم"},
    {"name": "work_location", "type": "text", "required": true, "label": "مكان العمل", "labelAr": "مكان العمل"},
    {"name": "start_date", "type": "date", "required": true, "label": "تاريخ بدء العمل", "labelAr": "تاريخ بدء العمل"},
    {"name": "probation_period", "type": "number", "required": true, "label": "فترة التجربة (أيام)", "labelAr": "فترة التجربة (أيام)", "validation": {"min": 0, "max": 90}},
    {"name": "basic_salary", "type": "number", "required": true, "label": "الراتب الأساسي", "labelAr": "الراتب الأساسي", "validation": {"min": 0}},
    {"name": "housing_allowance", "type": "number", "required": false, "label": "بدل السكن", "labelAr": "بدل السكن", "validation": {"min": 0}},
    {"name": "transport_allowance", "type": "number", "required": false, "label": "بدل المواصلات", "labelAr": "بدل المواصلات", "validation": {"min": 0}},
    {"name": "other_benefits", "type": "textarea", "required": false, "label": "المزايا الأخرى", "labelAr": "المزايا الأخرى"},
    {"name": "daily_hours", "type": "number", "required": true, "label": "ساعات العمل اليومية", "labelAr": "ساعات العمل اليومية", "validation": {"min": 1, "max": 8}},
    {"name": "working_days", "type": "select", "required": true, "label": "أيام العمل", "labelAr": "أيام العمل", "options": ["5", "6"]},
    {"name": "weekly_rest_day", "type": "select", "required": true, "label": "يوم الراحة", "labelAr": "يوم الراحة", "options": ["الجمعة", "السبت", "الأحد"]},
    {"name": "annual_leave", "type": "number", "required": true, "label": "الإجازة السنوية (أيام)", "labelAr": "الإجازة السنوية (أيام)", "validation": {"min": 21}},
    {"name": "notice_period", "type": "number", "required": true, "label": "مدة الإشعار (أيام)", "labelAr": "مدة الإشعار (أيام)", "validation": {"min": 30, "max": 90}},
    {"name": "city", "type": "text", "required": true, "label": "المدينة", "labelAr": "المدينة"},
    {"name": "contract_date", "type": "date", "required": true, "label": "تاريخ العقد", "labelAr": "تاريخ العقد"},
    {"name": "commercial_registration", "type": "text", "required": false, "label": "رقم السجل التجاري", "labelAr": "رقم السجل التجاري"},
    {"name": "organization_address", "type": "textarea", "required": false, "label": "عنوان الشركة", "labelAr": "عنوان الشركة"}
  ]',
  '[
    {"ruleId": "probation_limit", "description": "فترة التجربة لا تتجاوز 90 يوماً", "severity": "error", "laborLawReference": "المادة 53 - نظام العمل السعودي"},
    {"ruleId": "working_hours_limit", "description": "ساعات العمل اليومية لا تتجاوز 8 ساعات", "severity": "error", "laborLawReference": "المادة 98 - نظام العمل السعودي"},
    {"ruleId": "annual_leave_minimum", "description": "الإجازة السنوية لا تقل عن 21 يوماً", "severity": "error", "laborLawReference": "المادة 109 - نظام العمل السعودي"},
    {"ruleId": "notice_period_range", "description": "مدة الإشعار بين 30-90 يوماً", "severity": "warning", "laborLawReference": "المادة 75 - نظام العمل السعودي"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),

-- Termination Letter Template
(
  gen_random_uuid(),
  'خطاب إنهاء خدمة',
  'خطاب رسمي لإنهاء خدمة الموظف مع حساب المستحقات',
  'letters',
  'ar',
  'بسم الله الرحمن الرحيم

{{organization_name}}
{{organization_address}}
هاتف: {{organization_phone}}
البريد الإلكتروني: {{organization_email}}

التاريخ: {{termination_date}}

السيد/السيدة: {{employee_name}}
المسمى الوظيفي: {{job_title}}
رقم الموظف: {{employee_id}}

الموضوع: إنهاء خدمة

تحية طيبة وبعد،

نشير إلى عقد العمل المبرم بينكم وبين الشركة بتاريخ {{employment_start_date}}، ونفيدكم بأنه تقرر إنهاء خدمتكم لدى الشركة اعتباراً من تاريخ {{last_working_day}}.

سبب إنهاء الخدمة: {{termination_reason}}

المستحقات المالية:
- الراتب عن الفترة من {{salary_period_start}} إلى {{salary_period_end}}: {{salary_amount}} ريال
- مكافأة نهاية الخدمة: {{end_of_service_gratuity}} ريال
- رصيد الإجازات المستحقة: {{vacation_balance}} ريال
- بدلات أخرى: {{other_allowances}} ريال
- المجموع الإجمالي: {{total_amount}} ريال

الاستقطاعات:
- سلف أو قروض: {{deductions}} ريال
- أخرى: {{other_deductions}} ريال

صافي المبلغ المستحق: {{net_amount}} ريال

يرجى تسليم جميع ممتلكات الشركة في أو قبل آخر يوم عمل، ويشمل ذلك:
- بطاقة الهوية
- الحاسوب المحمول أو المكتبي
- الهاتف المحمول
- مفاتيح المكتب
- أي مواد أو وثائق تخص الشركة

سيتم صرف مستحقاتكم خلال {{payment_period}} يوم عمل من تاريخ انتهاء الخدمة.

نشكركم على خدمتكم للشركة ونتمنى لكم التوفيق في مساعيكم المستقبلية.

وتقبلوا فائق الاحترام والتقدير.

{{hr_manager_name}}
مدير الموارد البشرية
{{hr_manager_signature}}

ختم الشركة: ________________

إقرار استلام الموظف:
أقر أنا الموظف المذكور أعلاه بأنني استلمت نسخة من هذا الخطاب وأفهم محتوياته.

توقيع الموظف: ________________
التاريخ: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "employee_id", "type": "text", "required": true, "label": "رقم الموظف", "labelAr": "رقم الموظف"},
    {"name": "employment_start_date", "type": "date", "required": true, "label": "تاريخ بدء العمل", "labelAr": "تاريخ بدء العمل"},
    {"name": "termination_date", "type": "date", "required": true, "label": "تاريخ إنهاء الخدمة", "labelAr": "تاريخ إنهاء الخدمة"},
    {"name": "last_working_day", "type": "date", "required": true, "label": "آخر يوم عمل", "labelAr": "آخر يوم عمل"},
    {"name": "termination_reason", "type": "select", "required": true, "label": "سبب إنهاء الخدمة", "labelAr": "سبب إنهاء الخدمة", "options": ["استقالة", "انتهاء مدة العقد", "إنهاء من قبل الشركة", "تقاعد", "أسباب صحية"]},
    {"name": "salary_period_start", "type": "date", "required": true, "label": "بداية فترة الراتب", "labelAr": "بداية فترة الراتب"},
    {"name": "salary_period_end", "type": "date", "required": true, "label": "نهاية فترة الراتب", "labelAr": "نهاية فترة الراتب"},
    {"name": "salary_amount", "type": "number", "required": true, "label": "مبلغ الراتب", "labelAr": "مبلغ الراتب", "validation": {"min": 0}},
    {"name": "end_of_service_gratuity", "type": "number", "required": true, "label": "مكافأة نهاية الخدمة", "labelAr": "مكافأة نهاية الخدمة", "validation": {"min": 0}},
    {"name": "vacation_balance", "type": "number", "required": false, "label": "رصيد الإجازات", "labelAr": "رصيد الإجازات", "validation": {"min": 0}},
    {"name": "other_allowances", "type": "number", "required": false, "label": "بدلات أخرى", "labelAr": "بدلات أخرى", "validation": {"min": 0}},
    {"name": "deductions", "type": "number", "required": false, "label": "الاستقطاعات", "labelAr": "الاستقطاعات", "validation": {"min": 0}},
    {"name": "other_deductions", "type": "number", "required": false, "label": "استقطاعات أخرى", "labelAr": "استقطاعات أخرى", "validation": {"min": 0}},
    {"name": "total_amount", "type": "number", "required": true, "label": "المجموع الإجمالي", "labelAr": "المجموع الإجمالي", "validation": {"min": 0}},
    {"name": "net_amount", "type": "number", "required": true, "label": "صافي المبلغ", "labelAr": "صافي المبلغ", "validation": {"min": 0}},
    {"name": "payment_period", "type": "number", "required": true, "label": "مدة الدفع (أيام)", "labelAr": "مدة الدفع (أيام)", "validation": {"min": 1, "max": 30}},
    {"name": "hr_manager_name", "type": "text", "required": true, "label": "اسم مدير الموارد البشرية", "labelAr": "اسم مدير الموارد البشرية"},
    {"name": "hr_manager_signature", "type": "text", "required": false, "label": "توقيع مدير الموارد البشرية", "labelAr": "توقيع مدير الموارد البشرية"}
  ]',
  '[
    {"ruleId": "gratuity_calculation", "description": "مكافأة نهاية الخدمة تحسب وفقاً لنظام العمل", "severity": "warning", "laborLawReference": "المادة 84 - نظام العمل السعودي"},
    {"ruleId": "payment_timeline", "description": "دفع المستحقات خلال مدة لا تتجاوز أسبوعين", "severity": "error", "laborLawReference": "المادة 88 - نظام العمل السعودي"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),

-- Leave Request Form
(
  gen_random_uuid(),
  'نموذج طلب إجازة',
  'نموذج لطلب الإجازات المختلفة',
  'forms',
  'ar',
  '{{organization_name}}
قسم الموارد البشرية

نموذج طلب إجازة

بيانات الموظف:
الاسم: {{employee_name}}
رقم الموظف: {{employee_id}}
القسم: {{department}}
المسمى الوظيفي: {{job_title}}
تاريخ التعيين: {{employment_date}}
رقم الهاتف: {{phone_number}}
البريد الإلكتروني: {{email}}

تفاصيل الإجازة المطلوبة:
نوع الإجازة: {{leave_type}}
من تاريخ: {{start_date}}
إلى تاريخ: {{end_date}}
عدد الأيام: {{duration_days}} يوم
تاريخ العودة للعمل: {{return_date}}

سبب الإجازة: {{reason}}

الرصيد المتبقي من الإجازات:
- الإجازة السنوية: {{annual_leave_balance}} يوم
- الإجازة المرضية: {{sick_leave_balance}} يوم
- إجازات أخرى: {{other_leave_balance}} يوم

في حالة الإجازة الطارئة:
سبب الطوارئ: {{emergency_reason}}
شخص للاتصال به: {{emergency_contact}}
رقم الهاتف: {{emergency_phone}}

تسليم المهام:
سيتم تسليم المهام إلى: {{tasks_handover_to}}
الملاحظات الإضافية: {{additional_notes}}

إقرار الموظف:
أقر بأن المعلومات المذكورة أعلاه صحيحة وأتعهد بالعودة للعمل في التاريخ المحدد.
في حالة عدم العودة في الموعد المحدد، أتفهم أن هذا قد يؤثر على وضعي الوظيفي.

توقيع الموظف: ________________
التاريخ: {{request_date}}

موافقة المدير المباشر:
□ موافق
□ غير موافق

السبب في حالة عدم الموافقة: ________________

اسم المدير: {{direct_manager}}
التوقيع: ________________
التاريخ: ________________

موافقة الموارد البشرية:
□ موافق
□ غير موافق

ملاحظات الموارد البشرية: ________________

مسؤول الموارد البشرية: {{hr_officer}}
التوقيع: ________________
التاريخ: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "employee_id", "type": "text", "required": true, "label": "رقم الموظف", "labelAr": "رقم الموظف"},
    {"name": "department", "type": "text", "required": true, "label": "القسم", "labelAr": "القسم"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "employment_date", "type": "date", "required": true, "label": "تاريخ التعيين", "labelAr": "تاريخ التعيين"},
    {"name": "phone_number", "type": "text", "required": true, "label": "رقم الهاتف", "labelAr": "رقم الهاتف"},
    {"name": "email", "type": "email", "required": true, "label": "البريد الإلكتروني", "labelAr": "البريد الإلكتروني"},
    {"name": "leave_type", "type": "select", "required": true, "label": "نوع الإجازة", "labelAr": "نوع الإجازة", "options": ["إجازة سنوية", "إجازة مرضية", "إجازة طارئة", "إجازة أمومة", "إجازة بدون راتب", "إجازة حج", "إجازة زواج"]},
    {"name": "start_date", "type": "date", "required": true, "label": "تاريخ البداية", "labelAr": "تاريخ البداية"},
    {"name": "end_date", "type": "date", "required": true, "label": "تاريخ النهاية", "labelAr": "تاريخ النهاية"},
    {"name": "duration_days", "type": "number", "required": true, "label": "عدد الأيام", "labelAr": "عدد الأيام", "validation": {"min": 1}},
    {"name": "return_date", "type": "date", "required": true, "label": "تاريخ العودة", "labelAr": "تاريخ العودة"},
    {"name": "reason", "type": "textarea", "required": true, "label": "سبب الإجازة", "labelAr": "سبب الإجازة"},
    {"name": "annual_leave_balance", "type": "number", "required": false, "label": "رصيد الإجازة السنوية", "labelAr": "رصيد الإجازة السنوية"},
    {"name": "sick_leave_balance", "type": "number", "required": false, "label": "رصيد الإجازة المرضية", "labelAr": "رصيد الإجازة المرضية"},
    {"name": "other_leave_balance", "type": "number", "required": false, "label": "رصيد الإجازات الأخرى", "labelAr": "رصيد الإجازات الأخرى"},
    {"name": "tasks_handover_to", "type": "text", "required": false, "label": "تسليم المهام إلى", "labelAr": "تسليم المهام إلى"},
    {"name": "additional_notes", "type": "textarea", "required": false, "label": "ملاحظات إضافية", "labelAr": "ملاحظات إضافية"},
    {"name": "request_date", "type": "date", "required": true, "label": "تاريخ الطلب", "labelAr": "تاريخ الطلب"},
    {"name": "direct_manager", "type": "text", "required": false, "label": "المدير المباشر", "labelAr": "المدير المباشر"},
    {"name": "hr_officer", "type": "text", "required": false, "label": "مسؤول الموارد البشرية", "labelAr": "مسؤول الموارد البشرية"}
  ]',
  '[
    {"ruleId": "annual_leave_entitlement", "description": "الإجازة السنوية 21 يوماً كحد أدنى", "severity": "info", "laborLawReference": "المادة 109 - نظام العمل السعودي"},
    {"ruleId": "sick_leave_entitlement", "description": "الإجازة المرضية مدفوعة لمدة 120 يوماً في السنة", "severity": "info", "laborLawReference": "المادة 117 - نظام العمل السعودي"},
    {"ruleId": "maternity_leave", "description": "إجازة الأمومة 10 أسابيع مدفوعة الأجر", "severity": "info", "laborLawReference": "المادة 151 - نظام العمل السعودي"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),

-- Salary Certificate
(
  gen_random_uuid(),
  'شهادة الراتب',
  'شهادة رسمية بالراتب والمزايا الوظيفية',
  'letters',
  'ar',
  'بسم الله الرحمن الرحيم

{{organization_name}}
{{organization_address}}
هاتف: {{organization_phone}}
فاكس: {{organization_fax}}
البريد الإلكتروني: {{organization_email}}
السجل التجاري: {{commercial_registration}}

التاريخ: {{certificate_date}}

إلى من يهمه الأمر،

شهادة راتب

نشهد نحن {{organization_name}} بأن:

الاسم: {{employee_name}}
الجنسية: {{nationality}}
رقم الهوية/الإقامة: {{id_number}}
رقم الموظف: {{employee_id}}

يعمل لدى شركتنا في المنصب التالي:
المسمى الوظيفي: {{job_title}}
القسم: {{department}}
تاريخ التعيين: {{employment_start_date}}
نوع العقد: {{contract_type}}

تفاصيل الراتب الشهري:
- الراتب الأساسي: {{basic_salary}} ريال سعودي
- بدل السكن: {{housing_allowance}} ريال سعودي
- بدل المواصلات: {{transport_allowance}} ريال سعودي
- بدلات أخرى: {{other_allowances}} ريال سعودي
- إجمالي الراتب الشهري: {{total_monthly_salary}} ريال سعودي
- الراتب السنوي: {{annual_salary}} ريال سعودي

الاستقطاعات الشهرية:
- التأمينات الاجتماعية (حصة الموظف): {{gosi_employee}} ريال سعودي
- استقطاعات أخرى: {{other_deductions}} ريال سعودي
- صافي الراتب الشهري: {{net_monthly_salary}} ريال سعودي

معلومات إضافية:
- المؤهل العلمي: {{qualification}}
- سنوات الخبرة في الشركة: {{years_of_service}} سنة
- حالة العمل: {{employment_status}}

هذه الشهادة صادرة بناءً على طلب المعني وصحيحة كما في تاريخه.
الشهادة صالحة لمدة {{validity_period}} من تاريخ الإصدار.

الغرض من الشهادة: {{purpose}}

{{hr_manager_name}}
مدير الموارد البشرية
التوقيع: ________________

ختم الشركة: ________________

ملاحظة: هذه الشهادة لا تشكل التزاماً على الشركة تجاه الغير.',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "nationality", "type": "text", "required": true, "label": "الجنسية", "labelAr": "الجنسية"},
    {"name": "id_number", "type": "text", "required": true, "label": "رقم الهوية/الإقامة", "labelAr": "رقم الهوية/الإقامة"},
    {"name": "employee_id", "type": "text", "required": true, "label": "رقم الموظف", "labelAr": "رقم الموظف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "department", "type": "text", "required": true, "label": "القسم", "labelAr": "القسم"},
    {"name": "employment_start_date", "type": "date", "required": true, "label": "تاريخ التعيين", "labelAr": "تاريخ التعيين"},
    {"name": "contract_type", "type": "select", "required": true, "label": "نوع العقد", "labelAr": "نوع العقد", "options": ["دائم", "مؤقت", "بدوام جزئي"]},
    {"name": "basic_salary", "type": "number", "required": true, "label": "الراتب الأساسي", "labelAr": "الراتب الأساسي", "validation": {"min": 0}},
    {"name": "housing_allowance", "type": "number", "required": false, "label": "بدل السكن", "labelAr": "بدل السكن", "validation": {"min": 0}},
    {"name": "transport_allowance", "type": "number", "required": false, "label": "بدل المواصلات", "labelAr": "بدل المواصلات", "validation": {"min": 0}},
    {"name": "other_allowances", "type": "number", "required": false, "label": "بدلات أخرى", "labelAr": "بدلات أخرى", "validation": {"min": 0}},
    {"name": "total_monthly_salary", "type": "number", "required": true, "label": "إجمالي الراتب الشهري", "labelAr": "إجمالي الراتب الشهري", "validation": {"min": 0}},
    {"name": "annual_salary", "type": "number", "required": true, "label": "الراتب السنوي", "labelAr": "الراتب السنوي", "validation": {"min": 0}},
    {"name": "gosi_employee", "type": "number", "required": false, "label": "حصة الموظف من التأمينات", "labelAr": "حصة الموظف من التأمينات", "validation": {"min": 0}},
    {"name": "other_deductions", "type": "number", "required": false, "label": "استقطاعات أخرى", "labelAr": "استقطاعات أخرى", "validation": {"min": 0}},
    {"name": "net_monthly_salary", "type": "number", "required": true, "label": "صافي الراتب الشهري", "labelAr": "صافي الراتب الشهري", "validation": {"min": 0}},
    {"name": "qualification", "type": "select", "required": false, "label": "المؤهل العلمي", "labelAr": "المؤهل العلمي", "options": ["ثانوية عامة", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"]},
    {"name": "years_of_service", "type": "number", "required": true, "label": "سنوات الخبرة", "labelAr": "سنوات الخبرة", "validation": {"min": 0}},
    {"name": "employment_status", "type": "select", "required": true, "label": "حالة العمل", "labelAr": "حالة العمل", "options": ["يعمل حالياً", "في إجازة", "منتدب"]},
    {"name": "validity_period", "type": "select", "required": true, "label": "مدة صلاحية الشهادة", "labelAr": "مدة صلاحية الشهادة", "options": ["3 أشهر", "6 أشهر", "سنة واحدة"]},
    {"name": "purpose", "type": "textarea", "required": true, "label": "الغرض من الشهادة", "labelAr": "الغرض من الشهادة"},
    {"name": "certificate_date", "type": "date", "required": true, "label": "تاريخ الشهادة", "labelAr": "تاريخ الشهادة"},
    {"name": "hr_manager_name", "type": "text", "required": true, "label": "اسم مدير الموارد البشرية", "labelAr": "اسم مدير الموارد البشرية"}
  ]',
  '[
    {"ruleId": "minimum_wage", "description": "التأكد من الحد الأدنى للأجور", "severity": "warning", "laborLawReference": "قرار وزير الموارد البشرية والتنمية الاجتماعية"},
    {"ruleId": "gosi_compliance", "description": "التأمينات الاجتماعية إجبارية", "severity": "error", "laborLawReference": "نظام التأمينات الاجتماعية"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),

-- Warning Letter
(
  gen_random_uuid(),
  'خطاب تحذير',
  'خطاب تحذير رسمي للموظف',
  'letters',
  'ar',
  'بسم الله الرحمن الرحيم

{{organization_name}}
قسم الموارد البشرية
{{organization_address}}
هاتف: {{organization_phone}}

التاريخ: {{warning_date}}

السيد/السيدة: {{employee_name}}
رقم الموظف: {{employee_id}}
المسمى الوظيفي: {{job_title}}
القسم: {{department}}

الموضوع: خطاب تحذير رقم {{warning_number}}

تحية طيبة وبعد،

نتيجة للمخالفة المرتكبة من قبلكم والمتمثلة في:

نوع المخالفة: {{violation_type}}
تاريخ المخالفة: {{violation_date}}
وقت المخالفة: {{violation_time}}
مكان المخالفة: {{violation_location}}

تفاصيل المخالفة:
{{violation_details}}

الشهود (إن وجدوا):
{{witnesses}}

وحيث أن هذه المخالفة تتعارض مع:
□ لوائح الشركة الداخلية
□ نظام العمل السعودي
□ عقد العمل المبرم بينكم وبين الشركة
□ أخرى: {{other_regulations}}

المادة المخالفة: {{violated_article}}

درجة التحذير:
□ تحذير شفهي
□ تحذير كتابي أول
□ تحذير كتابي ثاني  
□ تحذير كتابي أخير

العواقب المترتبة:
{{consequences}}

الإجراءات المطلوبة منكم:
{{required_actions}}

المهلة الزمنية للتحسن: {{improvement_period}}

نحيطكم علماً بأنه في حالة تكرار هذه المخالفة أو أي مخالفة أخرى، سيتم اتخاذ إجراءات تأديبية أكثر صرامة قد تصل إلى إنهاء عقد العمل وفقاً لأحكام نظام العمل السعودي.

حقوقكم:
- لكم الحق في الرد على هذا التحذير خلال {{response_period}} أيام من تاريخ استلامكم لهذا الخطاب
- لكم الحق في طلب مراجعة القرار من الإدارة العليا
- لكم الحق في الاستعانة بممثل من زملائكم أثناء جلسة الاستماع

المرفقات:
- نسخة من اللائحة المخالفة
- {{attachments}}

نأمل منكم أخذ هذا التحذير بعين الاعتبار والعمل على تجنب تكرار مثل هذه المخالفات مستقبلاً.

{{hr_manager_name}}
مدير الموارد البشرية
التوقيع: ________________

{{direct_manager_name}}
المدير المباشر
التوقيع: ________________

ختم الشركة: ________________

إقرار استلام الموظف:
أقر أنا الموظف المذكور أعلاه بأنني:
□ استلمت نسخة من هذا الخطاب
□ أفهم محتويات هذا التحذير
□ أرغب في تقديم رد كتابي
□ لا أرغب في تقديم رد كتابي

ردكم على التحذير (اختياري):
{{employee_response}}

توقيع الموظف: ________________
التاريخ: {{acknowledgment_date}}

في حالة رفض الموظف التوقيع:
شاهد 1: ________________ التوقيع: ________________
شاهد 2: ________________ التوقيع: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "employee_id", "type": "text", "required": true, "label": "رقم الموظف", "labelAr": "رقم الموظف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "department", "type": "text", "required": true, "label": "القسم", "labelAr": "القسم"},
    {"name": "warning_number", "type": "text", "required": true, "label": "رقم التحذير", "labelAr": "رقم التحذير"},
    {"name": "warning_date", "type": "date", "required": true, "label": "تاريخ التحذير", "labelAr": "تاريخ التحذير"},
    {"name": "violation_type", "type": "select", "required": true, "label": "نوع المخالفة", "labelAr": "نوع المخالفة", "options": ["تأخير متكرر", "غياب بدون عذر", "عدم أداء الواجبات", "سوء سلوك", "مخالفة السلامة", "استخدام الهاتف", "أخرى"]},
    {"name": "violation_date", "type": "date", "required": true, "label": "تاريخ المخالفة", "labelAr": "تاريخ المخالفة"},
    {"name": "violation_time", "type": "text", "required": false, "label": "وقت المخالفة", "labelAr": "وقت المخالفة"},
    {"name": "violation_location", "type": "text", "required": false, "label": "مكان المخالفة", "labelAr": "مكان المخالفة"},
    {"name": "violation_details", "type": "textarea", "required": true, "label": "تفاصيل المخالفة", "labelAr": "تفاصيل المخالفة"},
    {"name": "witnesses", "type": "textarea", "required": false, "label": "الشهود", "labelAr": "الشهود"},
    {"name": "other_regulations", "type": "text", "required": false, "label": "أنظمة أخرى", "labelAr": "أنظمة أخرى"},
    {"name": "violated_article", "type": "text", "required": false, "label": "المادة المخالفة", "labelAr": "المادة المخالفة"},
    {"name": "consequences", "type": "textarea", "required": true, "label": "العواقب المترتبة", "labelAr": "العواقب المترتبة"},
    {"name": "required_actions", "type": "textarea", "required": true, "label": "الإجراءات المطلوبة", "labelAr": "الإجراءات المطلوبة"},
    {"name": "improvement_period", "type": "text", "required": true, "label": "مهلة التحسن", "labelAr": "مهلة التحسن"},
    {"name": "response_period", "type": "number", "required": true, "label": "مدة الرد (أيام)", "labelAr": "مدة الرد (أيام)", "validation": {"min": 3, "max": 15}},
    {"name": "attachments", "type": "text", "required": false, "label": "المرفقات", "labelAr": "المرفقات"},
    {"name": "hr_manager_name", "type": "text", "required": true, "label": "اسم مدير الموارد البشرية", "labelAr": "اسم مدير الموارد البشرية"},
    {"name": "direct_manager_name", "type": "text", "required": true, "label": "اسم المدير المباشر", "labelAr": "اسم المدير المباشر"},
    {"name": "acknowledgment_date", "type": "date", "required": false, "label": "تاريخ الإقرار", "labelAr": "تاريخ الإقرار"},
    {"name": "employee_response", "type": "textarea", "required": false, "label": "رد الموظف", "labelAr": "رد الموظف"}
  ]',
  '[
    {"ruleId": "due_process", "description": "حق الموظف في الرد والدفاع", "severity": "error", "laborLawReference": "المادة 66 - نظام العمل السعودي"},
    {"ruleId": "progressive_discipline", "description": "التدرج في العقوبات التأديبية", "severity": "warning", "laborLawReference": "المادة 67 - نظام العمل السعودي"},
    {"ruleId": "documentation", "description": "توثيق جميع إجراءات التأديب", "severity": "info", "laborLawReference": "أفضل الممارسات في الموارد البشرية"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),

-- Performance Review Template
(
  gen_random_uuid(),
  'تقييم الأداء السنوي',
  'نموذج تقييم الأداء السنوي للموظفين',
  'forms',
  'ar',
  '{{organization_name}}
إدارة الموارد البشرية

نموذج تقييم الأداء السنوي

فترة التقييم: من {{evaluation_period_start}} إلى {{evaluation_period_end}}

بيانات الموظف:
الاسم: {{employee_name}}
رقم الموظف: {{employee_id}}
المسمى الوظيفي: {{job_title}}
القسم: {{department}}
المدير المباشر: {{direct_manager}}
تاريخ التعيين: {{employment_date}}
مدة الخدمة: {{service_duration}} سنة

أهداف الفترة السابقة:
الهدف الأول: {{objective_1}}
مدى التحقيق: {{achievement_1}}% 

الهدف الثاني: {{objective_2}}
مدى التحقيق: {{achievement_2}}%

الهدف الثالث: {{objective_3}}
مدى التحقيق: {{achievement_3}}%

تقييم المعايير الأساسية:
(التقييم من 1-5: 1=ضعيف جداً، 2=ضعيف، 3=مقبول، 4=جيد، 5=ممتاز)

1. جودة العمل: {{quality_score}}/5
التعليق: {{quality_comment}}

2. الكمية والإنتاجية: {{productivity_score}}/5
التعليق: {{productivity_comment}}

3. المعرفة المهنية: {{knowledge_score}}/5
التعليق: {{knowledge_comment}}

4. الالتزام بالمواعيد: {{punctuality_score}}/5
التعليق: {{punctuality_comment}}

5. روح الفريق والتعاون: {{teamwork_score}}/5
التعليق: {{teamwork_comment}}

6. المبادرة والإبداع: {{initiative_score}}/5
التعليق: {{initiative_comment}}

7. التواصل: {{communication_score}}/5
التعليق: {{communication_comment}}

8. القيادة (إن أمكن): {{leadership_score}}/5
التعليق: {{leadership_comment}}

التقييم الإجمالي:
مجموع النقاط: {{total_score}}/40
النسبة المئوية: {{percentage_score}}%

تصنيف الأداء:
□ ممتاز (90-100%)
□ جيد جداً (80-89%)
□ جيد (70-79%)
□ مقبول (60-69%)
□ يحتاج تحسين (أقل من 60%)

نقاط القوة:
{{strengths}}

المجالات التي تحتاج تحسين:
{{improvement_areas}}

الإنجازات المميزة:
{{achievements}}

التحديات التي واجهها الموظف:
{{challenges}}

أهداف الفترة القادمة:
الهدف الأول: {{next_objective_1}}
المهلة الزمنية: {{deadline_1}}

الهدف الثاني: {{next_objective_2}}
المهلة الزمنية: {{deadline_2}}

الهدف الثالث: {{next_objective_3}}
المهلة الزمنية: {{deadline_3}}

خطة التطوير والتدريب:
الدورات المطلوبة: {{training_needs}}
المهارات المراد تطويرها: {{skill_development}}
الإرشاد المطلوب: {{mentoring_needs}}

التوصيات:
□ استمرار في نفس المنصب
□ ترقية
□ نقل لقسم آخر
□ تدريب إضافي
□ تحسين الأداء مطلوب

تعليقات المدير المباشر:
{{manager_comments}}

تعليقات الموظف:
{{employee_comments}}

خطة المتابعة:
اجتماع المتابعة الأول: {{followup_date_1}}
اجتماع المتابعة الثاني: {{followup_date_2}}
التقييم المؤقت: {{interim_review_date}}

التوقيعات:
المدير المباشر: {{manager_name}}
التوقيع: ________________
التاريخ: {{manager_signature_date}}

الموظف: {{employee_name}}
التوقيع: ________________
التاريخ: {{employee_signature_date}}

مدير الموارد البشرية: {{hr_manager}}
التوقيع: ________________
التاريخ: {{hr_signature_date}}',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف", "labelAr": "اسم الموظف"},
    {"name": "employee_id", "type": "text", "required": true, "label": "رقم الموظف", "labelAr": "رقم الموظف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي", "labelAr": "المسمى الوظيفي"},
    {"name": "department", "type": "text", "required": true, "label": "القسم", "labelAr": "القسم"},
    {"name": "direct_manager", "type": "text", "required": true, "label": "المدير المباشر", "labelAr": "المدير المباشر"},
    {"name": "employment_date", "type": "date", "required": true, "label": "تاريخ التعيين", "labelAr": "تاريخ التعيين"},
    {"name": "service_duration", "type": "number", "required": true, "label": "مدة الخدمة (سنوات)", "labelAr": "مدة الخدمة (سنوات)", "validation": {"min": 0}},
    {"name": "evaluation_period_start", "type": "date", "required": true, "label": "بداية فترة التقييم", "labelAr": "بداية فترة التقييم"},
    {"name": "evaluation_period_end", "type": "date", "required": true, "label": "نهاية فترة التقييم", "labelAr": "نهاية فترة التقييم"},
    {"name": "objective_1", "type": "textarea", "required": true, "label": "الهدف الأول", "labelAr": "الهدف الأول"},
    {"name": "achievement_1", "type": "number", "required": true, "label": "نسبة تحقيق الهدف الأول", "labelAr": "نسبة تحقيق الهدف الأول", "validation": {"min": 0, "max": 100}},
    {"name": "objective_2", "type": "textarea", "required": false, "label": "الهدف الثاني", "labelAr": "الهدف الثاني"},
    {"name": "achievement_2", "type": "number", "required": false, "label": "نسبة تحقيق الهدف الثاني", "labelAr": "نسبة تحقيق الهدف الثاني", "validation": {"min": 0, "max": 100}},
    {"name": "objective_3", "type": "textarea", "required": false, "label": "الهدف الثالث", "labelAr": "الهدف الثالث"},
    {"name": "achievement_3", "type": "number", "required": false, "label": "نسبة تحقيق الهدف الثالث", "labelAr": "نسبة تحقيق الهدف الثالث", "validation": {"min": 0, "max": 100}},
    {"name": "quality_score", "type": "number", "required": true, "label": "درجة جودة العمل", "labelAr": "درجة جودة العمل", "validation": {"min": 1, "max": 5}},
    {"name": "quality_comment", "type": "textarea", "required": false, "label": "تعليق على جودة العمل", "labelAr": "تعليق على جودة العمل"},
    {"name": "productivity_score", "type": "number", "required": true, "label": "درجة الإنتاجية", "labelAr": "درجة الإنتاجية", "validation": {"min": 1, "max": 5}},
    {"name": "productivity_comment", "type": "textarea", "required": false, "label": "تعليق على الإنتاجية", "labelAr": "تعليق على الإنتاجية"},
    {"name": "knowledge_score", "type": "number", "required": true, "label": "درجة المعرفة المهنية", "labelAr": "درجة المعرفة المهنية", "validation": {"min": 1, "max": 5}},
    {"name": "knowledge_comment", "type": "textarea", "required": false, "label": "تعليق على المعرفة المهنية", "labelAr": "تعليق على المعرفة المهنية"},
    {"name": "punctuality_score", "type": "number", "required": true, "label": "درجة الالتزام بالمواعيد", "labelAr": "درجة الالتزام بالمواعيد", "validation": {"min": 1, "max": 5}},
    {"name": "teamwork_score", "type": "number", "required": true, "label": "درجة روح الفريق", "labelAr": "درجة روح الفريق", "validation": {"min": 1, "max": 5}},
    {"name": "strengths", "type": "textarea", "required": true, "label": "نقاط القوة", "labelAr": "نقاط القوة"},
    {"name": "improvement_areas", "type": "textarea", "required": true, "label": "مجالات التحسين", "labelAr": "مجالات التحسين"},
    {"name": "manager_comments", "type": "textarea", "required": true, "label": "تعليقات المدير", "labelAr": "تعليقات المدير"},
    {"name": "employee_comments", "type": "textarea", "required": false, "label": "تعليقات الموظف", "labelAr": "تعليقات الموظف"}
  ]',
  '[
    {"ruleId": "annual_review", "description": "تقييم الأداء السنوي إلزامي", "severity": "info", "laborLawReference": "أفضل الممارسات في إدارة الأداء"},
    {"ruleId": "objective_setting", "description": "وضع أهداف واضحة وقابلة للقياس", "severity": "info", "laborLawReference": "منهجية SMART للأهداف"},
    {"ruleId": "documentation", "description": "توثيق جميع جوانب تقييم الأداء", "severity": "warning", "laborLawReference": "متطلبات الموارد البشرية"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Update organization_name placeholder in all templates
UPDATE hr_templates 
SET template_content = REPLACE(template_content, '{{organization_name}}', '{{organization_name}}')
WHERE organization_id IS NULL;