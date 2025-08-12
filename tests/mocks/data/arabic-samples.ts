/**
 * Arabic language test data and samples
 * Used for testing RTL support, Arabic text processing, and language features
 */

export const arabicSamples = {
  // Basic Arabic text samples
  text: {
    simple: 'مرحباً بكم في نظام الموارد البشرية',
    complex: 'يهدف نظام إدارة الموارد البشرية إلى تحسين كفاءة العمليات الإدارية وضمان الامتثال للقوانين واللوائح المحلية والدولية.',
    numbers: 'الرقم التسلسلي: ١٢٣٤٥٦٧٨٩٠',
    mixed: 'Welcome مرحباً to our HR نظام الموارد البشرية system',
    longText: `
      قانون العمل السعودي هو القانون الذي ينظم العلاقة بين العامل وصاحب العمل في المملكة العربية السعودية.
      يتضمن هذا القانون العديد من الأحكام المتعلقة بحقوق العمال وواجباتهم، بالإضافة إلى التزامات أصحاب العمل.
      من أهم المواضيع التي يغطيها القانون: ساعات العمل، الإجازات، الأجور، إنهاء الخدمة، والسلامة المهنية.
      كما يتناول القانون أحكام خاصة بالعمال السعوديين وغير السعوديين، والتأمينات الاجتماعية.
    `,
  },

  // HR-specific terminology
  hrTerms: {
    'employee': 'موظف',
    'contract': 'عقد عمل',
    'salary': 'راتب',
    'leave': 'إجازة',
    'overtime': 'عمل إضافي',
    'resignation': 'استقالة',
    'termination': 'إنهاء خدمة',
    'performance': 'أداء',
    'department': 'قسم',
    'position': 'منصب',
    'promotion': 'ترقية',
    'training': 'تدريب',
    'benefits': 'مزايا',
    'insurance': 'تأمين',
    'retirement': 'تقاعد',
  },

  // Legal document templates in Arabic
  legalTemplates: {
    employmentContract: `
      عقد عمل
      
      بين الطرفين:
      الطرف الأول: [اسم الشركة]
      الطرف الثاني: [اسم الموظف]
      
      بناءً على ما تقدم، فقد اتفق الطرفان على ما يلي:
      
      المادة الأولى: طبيعة العمل
      يتعهد الطرف الثاني بالعمل لدى الطرف الأول في منصب [المنصب] وفقاً للوصف الوظيفي المرفق.
      
      المادة الثانية: مدة العقد
      يبدأ هذا العقد من تاريخ [تاريخ البداية] ولمدة [مدة العقد].
      
      المادة الثالثة: الراتب والمزايا
      يتقاضى الطرف الثاني راتباً شهرياً قدره [المبلغ] ريال سعودي.
    `,
    
    resignationLetter: `
      خطاب استقالة
      
      إلى: [اسم المدير]
      من: [اسم الموظف]
      التاريخ: [التاريخ]
      
      الموضوع: طلب استقالة
      
      تحية طيبة وبعد،
      
      أرغب في تقديم استقالتي من منصب [المنصب] اعتباراً من تاريخ [تاريخ الاستقالة].
      أشكركم على الفرصة التي أتحتموها لي للعمل في هذه المؤسسة المحترمة.
      
      وتفضلوا بقبول فائق الاحترام والتقدير.
      
      [التوقيع]
      [اسم الموظف]
    `,
  },

  // Voice transcription samples
  voiceSamples: {
    queries: [
      'ما هي أحكام الإجازة السنوية حسب قانون العمل السعودي؟',
      'كيف يتم حساب مكافأة نهاية الخدمة؟',
      'ما هي حقوق العامل في حالة إنهاء الخدمة؟',
      'ما هو الحد الأدنى للأجور في المملكة؟',
      'كيف يتم التعامل مع العمل الإضافي؟',
    ],
    commands: [
      'ابحث عن قانون العمل',
      'أنشئ عقد عمل جديد',
      'احفظ هذا المستند',
      'ارسل تقرير إلى المدير',
      'اطبع شهادة الراتب',
    ],
  },

  // OCR test content
  ocrContent: {
    simpleDocument: `
      شهادة راتب
      
      اسم الموظف: أحمد محمد السالم
      الرقم الوظيفي: ١٢٣٤٥
      القسم: الموارد البشرية
      الراتب الأساسي: ١٥,٠٠٠ ريال
      البدلات: ٢,٠٠٠ ريال
      الاستقطاعات: ٥٠٠ ريال
      صافي الراتب: ١٦,٥٠٠ ريال
    `,
    
    complexDocument: `
      المملكة العربية السعودية
      وزارة الموارد البشرية والتنمية الاجتماعية
      
      شهادة خبرة
      
      نشهد نحن الموقعون أدناه بأن السيد/ة [اسم الموظف] قد عمل/ت لدينا
      في منصب [المنصب] خلال الفترة من [تاريخ البداية] إلى [تاريخ النهاية].
      
      وقد أظهر/ت خلال فترة عمله/ها التزاماً عالياً ومهارات متميزة في:
      • إدارة الفرق
      • التخطيط الاستراتيجي  
      • حل المشكلات
      • التواصل الفعال
      
      نتمنى له/ها التوفيق في مسيرته/ها المهنية.
    `,
  },

  // Test data for RTL layout
  rtlTestData: {
    forms: {
      labels: [
        'الاسم الأول',
        'اسم العائلة',
        'رقم الهوية',
        'تاريخ الميلاد',
        'العنوان',
        'رقم الجوال',
        'البريد الإلكتروني',
      ],
      placeholders: [
        'أدخل الاسم الأول',
        'أدخل اسم العائلة',
        'أدخل رقم الهوية',
        'اختر تاريخ الميلاد',
        'أدخل العنوان الكامل',
        'أدخل رقم الجوال',
        'أدخل البريد الإلكتروني',
      ],
    },
    navigation: [
      'الرئيسية',
      'الموظفون',
      'المرتبات',
      'الإجازات',
      'التقارير',
      'الإعدادات',
    ],
  },

  // Performance test data
  performanceTestData: {
    largeArabicText: Array(1000).fill('نص عربي طويل لاختبار الأداء مع النصوص الكبيرة ').join(''),
    complexQueries: [
      'ما هي الإجراءات المطلوبة لتقديم طلب إجازة اعتيادية للموظف الذي يعمل في نظام الورديات؟',
      'كيف يتم حساب التعويض في حالة إنهاء عقد العمل بسبب إعادة الهيكلة التنظيمية؟',
      'ما هي الشروط والأحكام للحصول على إجازة الأمومة وما هي المدة القانونية المسموحة؟',
    ],
  },
};

// Arabic text processing utilities for tests
export const arabicTestUtils = {
  // Check if text contains Arabic characters
  isArabic: (text: string): boolean => {
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
  },

  // Normalize Arabic text for comparison
  normalizeArabic: (text: string): string => {
    return text
      .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
      .replace(/آ|أ|إ/g, 'ا') // Normalize alef
      .replace(/ة/g, 'ه') // Normalize ta marboota
      .trim();
  },

  // Generate RTL test cases
  generateRTLTestCases: () => ({
    textAlign: 'right',
    direction: 'rtl',
    unicodeBidi: 'bidi-override',
    writingMode: 'horizontal-tb',
  }),

  // Validate Arabic form input
  validateArabicInput: (input: string, type: 'name' | 'address' | 'general'): boolean => {
    const patterns = {
      name: /^[\u0600-\u06FF\s]+$/,
      address: /^[\u0600-\u06FF\s\d\-,]+$/,
      general: /^[\u0600-\u06FF\s\d\-.,!?]+$/,
    };
    return patterns[type].test(input);
  },
};

export default arabicSamples;