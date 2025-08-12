export const mockConversationData = {
  conversations: [
    {
      id: 'conv-1',
      title: 'استفسار عن نظام الإجازات',
      created_at: '2025-08-11T10:00:00Z',
      updated_at: '2025-08-11T10:15:00Z',
      message_count: 8,
      status: 'completed',
      user_id: 'user-123',
      organization_id: 'org-1',
      tags: ['إجازات', 'نظام العمل'],
    },
    {
      id: 'conv-2', 
      title: 'حساب مكافأة نهاية الخدمة',
      created_at: '2025-08-11T09:30:00Z',
      updated_at: '2025-08-11T09:45:00Z',
      message_count: 12,
      status: 'completed',
      user_id: 'user-456',
      organization_id: 'org-1',
      tags: ['مكافآت', 'نهاية الخدمة'],
    },
    {
      id: 'conv-3',
      title: 'متطلبات عقد العمل',
      created_at: '2025-08-11T08:20:00Z',
      updated_at: '2025-08-11T08:35:00Z',
      message_count: 6,
      status: 'completed',
      user_id: 'user-789',
      organization_id: 'org-1',
      tags: ['عقود', 'توظيف'],
    },
  ],

  messages: {
    'conv-1': [
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        content: 'ما هي أنواع الإجازات المتاحة للموظفين في السعودية؟',
        role: 'user',
        created_at: '2025-08-11T10:00:00Z',
        metadata: {
          language: 'ar',
          intent: 'question',
        },
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        content: 'وفقاً لنظام العمل السعودي، هناك عدة أنواع من الإجازات المتاحة للموظفين:\n\n1. **الإجازة السنوية**: 30 يوماً في السنة للموظفين الذين أمضوا أكثر من سنة في الخدمة\n2. **إجازة العيد**: 4 أيام لعيد الفطر و4 أيام لعيد الأضحى\n3. **الإجازة المرضية**: حتى 120 يوماً في السنة براتب كامل\n4. **إجازة الوضع**: 10 أسابيع للموظفات\n5. **إجازة الحج**: مرة واحدة خلال فترة الخدمة',
        role: 'assistant',
        created_at: '2025-08-11T10:01:30Z',
        metadata: {
          sources: [
            {
              document_id: 'doc-labor-law-1',
              title: 'نظام العمل السعودي - الإجازات',
              relevance_score: 0.95,
            },
          ],
          processing_time: 1.3,
        },
      },
      {
        id: 'msg-3',
        conversation_id: 'conv-1',
        content: 'كيف يتم احتساب الإجازة السنوية؟',
        role: 'user',
        created_at: '2025-08-11T10:02:00Z',
        metadata: {
          language: 'ar',
          intent: 'follow_up',
        },
      },
      {
        id: 'msg-4',
        conversation_id: 'conv-1',
        content: 'يتم احتساب الإجازة السنوية كالتالي:\n\n- **السنة الأولى**: لا يحق للموظف إجازة سنوية\n- **بعد السنة الأولى**: 30 يوماً في السنة\n- **للموظفين الذين يعملون أكثر من 5 سنوات**: قد تزيد إلى 45 يوماً حسب سياسة الشركة\n\nيمكن للموظف تجميع إجازته السنوية لمدة سنتين كحد أقصى، ولا يجوز للعامل التنازل عن إجازته مقابل أجر إضافي.',
        role: 'assistant',
        created_at: '2025-08-11T10:03:45Z',
        metadata: {
          sources: [
            {
              document_id: 'doc-labor-law-2',
              title: 'نظام العمل السعودي - احتساب الإجازات',
              relevance_score: 0.91,
            },
          ],
          processing_time: 1.8,
        },
      },
    ],

    'conv-2': [
      {
        id: 'msg-5',
        conversation_id: 'conv-2',
        content: 'كيف يتم حساب مكافأة نهاية الخدمة؟',
        role: 'user',
        created_at: '2025-08-11T09:30:00Z',
        metadata: {
          language: 'ar',
          intent: 'question',
        },
      },
      {
        id: 'msg-6',
        conversation_id: 'conv-2',
        content: 'مكافأة نهاية الخدمة تحسب وفقاً لنظام العمل السعودي كالتالي:\n\n**للسنوات الخمس الأولى:**\n- نصف راتب شهر عن كل سنة من سنوات الخدمة\n\n**بعد السنة الخامسة:**\n- راتب شهر كامل عن كل سنة من سنوات الخدمة\n\n**مثال:**\n- موظف عمل 8 سنوات براتب 10,000 ريال\n- السنوات الخمس الأولى: 5 × 5,000 = 25,000 ريال\n- السنوات الثلاث الأخيرة: 3 × 10,000 = 30,000 ريال\n- **المجموع: 55,000 ريال**',
        role: 'assistant',
        created_at: '2025-08-11T09:31:20Z',
        metadata: {
          sources: [
            {
              document_id: 'doc-labor-law-3',
              title: 'نظام العمل السعودي - مكافأة نهاية الخدمة',
              relevance_score: 0.98,
            },
          ],
          processing_time: 0.9,
        },
      },
    ],

    'conv-3': [
      {
        id: 'msg-7',
        conversation_id: 'conv-3',
        content: 'ما هي المتطلبات الأساسية لعقد العمل في السعودية؟',
        role: 'user',
        created_at: '2025-08-11T08:20:00Z',
        metadata: {
          language: 'ar',
          intent: 'question',
        },
      },
      {
        id: 'msg-8',
        conversation_id: 'conv-3',
        content: 'المتطلبات الأساسية لعقد العمل في السعودية تشمل:\n\n**المعلومات الإلزامية:**\n1. اسم صاحب العمل ومكان العمل\n2. اسم العامل ومؤهلاته وجنسيته وعنوانه\n3. طبيعة العمل ونوعه ومكان أدائه\n4. تاريخ بدء العمل ومدته (إن كان محدد المدة)\n5. الأجر المتفق عليه وطريقة أدائه ومواعيده\n6. ساعات العمل\n7. الإجازات والمزايا\n\n**الشروط القانونية:**\n- يجب أن يكون العقد مكتوباً\n- نسخة للعامل ونسخة لصاحب العمل\n- باللغة العربية (مع ترجمة للعمالة الأجنبية)',
        role: 'assistant',
        created_at: '2025-08-11T08:21:15Z',
        metadata: {
          sources: [
            {
              document_id: 'doc-labor-law-4',
              title: 'نظام العمل السعودي - عقود العمل',
              relevance_score: 0.96,
            },
          ],
          processing_time: 1.1,
        },
      },
    ],
  },
};