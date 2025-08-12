export const mockAnalyticsData = {
  metrics: {
    total_queries: 15420,
    total_users: 342,
    avg_response_time: 1.24,
    success_rate: 98.7,
    daily_active_users: 89,
    monthly_active_users: 342,
    storage_used: 2.4, // GB
    bandwidth_used: 15.8, // GB
    error_rate: 1.3,
    uptime: 99.8,
  },

  usage: {
    queries_by_day: [
      { date: '2025-08-05', count: 420 },
      { date: '2025-08-06', count: 380 },
      { date: '2025-08-07', count: 450 },
      { date: '2025-08-08', count: 520 },
      { date: '2025-08-09', count: 480 },
      { date: '2025-08-10', count: 390 },
      { date: '2025-08-11', count: 440 },
    ],
    top_queries: [
      { query: 'ما هي أنواع الإجازات المتاحة؟', count: 145, avg_response_time: 1.1 },
      { query: 'كيف يتم حساب مكافأة نهاية الخدمة؟', count: 132, avg_response_time: 1.3 },
      { query: 'ما هي متطلبات عقد العمل؟', count: 98, avg_response_time: 0.9 },
      { query: 'كيفية التعامل مع شكاوى الموظفين', count: 87, avg_response_time: 1.5 },
      { query: 'قوانين ساعات العمل في السعودية', count: 76, avg_response_time: 1.2 },
    ],
    usage_by_feature: [
      { feature: 'RAG Query', usage_count: 8420, percentage: 54.6 },
      { feature: 'Document Processing', usage_count: 3210, percentage: 20.8 },
      { feature: 'Template Generation', usage_count: 2140, percentage: 13.9 },
      { feature: 'Voice Commands', usage_count: 1650, percentage: 10.7 },
    ],
  },

  performance: {
    response_times: [
      { timestamp: '2025-08-11T10:00:00Z', avg_response_time: 1.2, p95_response_time: 2.1, p99_response_time: 3.5 },
      { timestamp: '2025-08-11T11:00:00Z', avg_response_time: 1.1, p95_response_time: 2.0, p99_response_time: 3.2 },
      { timestamp: '2025-08-11T12:00:00Z', avg_response_time: 1.3, p95_response_time: 2.3, p99_response_time: 3.8 },
      { timestamp: '2025-08-11T13:00:00Z', avg_response_time: 1.0, p95_response_time: 1.9, p99_response_time: 3.1 },
    ],
    error_rates: [
      { timestamp: '2025-08-11T10:00:00Z', error_rate: 1.2, error_count: 5 },
      { timestamp: '2025-08-11T11:00:00Z', error_rate: 0.8, error_count: 3 },
      { timestamp: '2025-08-11T12:00:00Z', error_rate: 1.5, error_count: 7 },
      { timestamp: '2025-08-11T13:00:00Z', error_rate: 0.9, error_count: 4 },
    ],
    system_load: {
      cpu_usage: 45.2,
      memory_usage: 62.8,
      disk_usage: 34.5,
      network_io: 12.3,
    },
  },

  costs: {
    monthly_breakdown: {
      openai_api: 245.30,
      pinecone: 89.50,
      supabase: 125.00,
      vercel: 200.00,
      total: 659.80,
    },
    daily_costs: [
      { date: '2025-08-05', cost: 21.45 },
      { date: '2025-08-06', cost: 19.80 },
      { date: '2025-08-07', cost: 23.10 },
      { date: '2025-08-08', cost: 25.60 },
      { date: '2025-08-09', cost: 22.30 },
      { date: '2025-08-10', cost: 18.90 },
      { date: '2025-08-11', cost: 24.20 },
    ],
    cost_per_query: 0.042,
    projected_monthly: 689.45,
  },

  compliance: {
    overall_score: 94.2,
    categories: [
      { category: 'نظام العمل السعودي', score: 96.5, issues: 2 },
      { category: 'حماية البيانات', score: 92.0, issues: 4 },
      { category: 'السلامة المهنية', score: 94.8, issues: 3 },
      { category: 'المساواة وعدم التمييز', score: 93.2, issues: 3 },
    ],
    recent_violations: [
      {
        id: 'v1',
        description: 'عدم توثيق إجراءات السلامة في قسم الإنتاج',
        severity: 'medium',
        date: '2025-08-10',
        status: 'resolved',
      },
      {
        id: 'v2',
        description: 'تأخير في تحديث بيانات الموظفين',
        severity: 'low',
        date: '2025-08-09',
        status: 'pending',
      },
    ],
  },

  realtime: {
    active_users: 23,
    queries_per_minute: 8.5,
    system_status: 'healthy',
    alerts: [
      {
        id: 'alert-1',
        type: 'performance',
        message: 'استجابة بطيئة في خدمة البحث',
        severity: 'warning',
        timestamp: '2025-08-11T14:30:00Z',
      },
    ],
    recent_activity: [
      {
        id: 'activity-1',
        user_id: 'user-123',
        action: 'query',
        query: 'ما هي إجراءات إنهاء الخدمة؟',
        timestamp: '2025-08-11T14:35:00Z',
        response_time: 1.2,
      },
      {
        id: 'activity-2',
        user_id: 'user-456',
        action: 'document_upload',
        filename: 'عقد-عمل-جديد.pdf',
        timestamp: '2025-08-11T14:33:00Z',
        status: 'processed',
      },
    ],
  },
};