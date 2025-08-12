/**
 * Query Suggestion System Unit Tests
 * Tests for AI-powered query suggestions, autocomplete, and query refinement with Arabic support
 */

import { SuggestionService } from '@/libs/services/suggestion-service';

// Mock dependencies
jest.mock('@/libs/services/openrouter-client');
jest.mock('@/libs/supabase/supabase-server-client');
jest.mock('@/libs/logging/structured-logger');

// Mock data for Arabic query suggestions
const arabicSuggestionTestData = {
  // User query patterns
  userQueries: [
    'ما هي أحكام الإجازة السنوية؟',
    'كيف يتم حساب مكافأة نهاية الخدمة؟',
    'ما هي حقوق العامل عند إنهاء الخدمة؟',
    'أحكام العمل الإضافي في قانون العمل',
    'شروط الحصول على إجازة مرضية',
    'كيفية تقديم شكوى ضد صاحب العمل',
    'حقوق المرأة العاملة في القطاع الخاص',
    'أحكام التأمينات الاجتماعية للعمال',
  ],

  // Popular query suggestions
  popularSuggestions: [
    {
      query: 'أحكام الإجازة السنوية',
      category: 'leaves',
      frequency: 245,
      successRate: 96.8,
      averageRating: 4.7,
      language: 'ar',
      keywords: ['إجازة', 'سنوية', 'قانون العمل'],
    },
    {
      query: 'حساب مكافأة نهاية الخدمة',
      category: 'end_of_service',
      frequency: 198,
      successRate: 94.2,
      averageRating: 4.5,
      language: 'ar',
      keywords: ['مكافأة', 'نهاية الخدمة', 'حساب'],
    },
    {
      query: 'حقوق العامل عند الإنهاء',
      category: 'termination',
      frequency: 156,
      successRate: 92.4,
      averageRating: 4.3,
      language: 'ar',
      keywords: ['حقوق', 'إنهاء', 'عامل'],
    },
  ],

  // Autocomplete suggestions
  autocompleteSuggestions: [
    {
      partial: 'ما هي',
      suggestions: [
        'ما هي أحكام الإجازة السنوية؟',
        'ما هي حقوق العامل؟',
        'ما هي شروط العمل الإضافي؟',
        'ما هي أحكام التأمينات الاجتماعية؟',
      ],
    },
    {
      partial: 'كيف يتم',
      suggestions: [
        'كيف يتم حساب مكافأة نهاية الخدمة؟',
        'كيف يتم تقديم الاستقالة؟',
        'كيف يتم احتساب الإجازة المرضية؟',
        'كيف يتم التعامل مع النزاعات العمالية؟',
      ],
    },
    {
      partial: 'حقوق',
      suggestions: [
        'حقوق العامل في القطاع الخاص',
        'حقوق المرأة العاملة',
        'حقوق العامل عند الإنهاء',
        'حقوق العامل الأجنبي',
      ],
    },
  ],

  // Related questions
  relatedQuestions: [
    {
      originalQuery: 'أحكام الإجازة السنوية',
      related: [
        'كم يوم إجازة سنوية للموظف؟',
        'هل يمكن تجميع الإجازة السنوية؟',
        'متى يستحق الموظف الإجازة السنوية؟',
        'هل الإجازة السنوية مدفوعة الأجر؟',
        'ماذا يحدث للإجازة عند ترك العمل؟',
      ],
    },
    {
      originalQuery: 'مكافأة نهاية الخدمة',
      related: [
        'كيف تحسب مكافأة نهاية الخدمة؟',
        'متى تستحق مكافأة نهاية الخدمة؟',
        'هل تدفع المكافأة في حالة الاستقالة؟',
        'ما هي شروط استحقاق المكافأة؟',
        'كيف تحسب المكافأة للعقود محددة المدة؟',
      ],
    },
  ],

  // Query refinement suggestions
  refinementSuggestions: [
    {
      originalQuery: 'الإجازة',
      refinements: [
        'الإجازة السنوية',
        'الإجازة المرضية',
        'إجازة الأمومة',
        'إجازة الحج',
        'الإجازة الاضطرارية',
      ],
      reason: 'استعلام عام جداً - يحتاج تحديد نوع الإجازة',
    },
    {
      originalQuery: 'حقوق العامل',
      refinements: [
        'حقوق العامل في القطاع الخاص',
        'حقوق العامل عند إنهاء الخدمة',
        'حقوق العامل المرضية',
        'حقوق العامل في الأجور',
      ],
      reason: 'استعلام واسع - يحتاج تحديد نوع الحقوق',
    },
  ],

  // AI-powered query expansions
  queryExpansions: [
    {
      original: 'الراتب',
      expanded: [
        'الراتب الأساسي',
        'الراتب والبدلات',
        'زيادة الراتب',
        'تأخير صرف الراتب',
        'خصم من الراتب',
      ],
    },
    {
      original: 'العمل',
      expanded: [
        'ساعات العمل',
        'مكان العمل',
        'عقد العمل',
        'إنهاء العمل',
        'بيئة العمل',
      ],
    },
  ],
};

// Mock OpenRouter responses
const mockOpenRouterResponses = {
  generateSuggestions: {
    model: 'meta-llama/llama-3.1-8b-instruct',
    choices: [
      {
        message: {
          content: JSON.stringify({
            suggestions: [
              'ما هي أحكام الإجازة السنوية في قانون العمل السعودي؟',
              'كيف يتم حساب أيام الإجازة السنوية للموظف؟',
              'هل يمكن تأجيل الإجازة السنوية للسنة التالية؟',
              'ما هي حقوق الموظف في الإجازة السنوية؟',
            ],
            confidence: 0.92,
            reasoning: 'تم إنشاء الاقتراحات بناءً على الاستعلامات الشائعة حول الإجازة السنوية',
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 150,
      completion_tokens: 85,
      total_tokens: 235,
    },
  },

  refineQuery: {
    model: 'meta-llama/llama-3.1-8b-instruct',
    choices: [
      {
        message: {
          content: JSON.stringify({
            refinedQuery: 'ما هي أحكام الإجازة السنوية وشروط استحقاقها في قانون العمل السعودي؟',
            refinements: [
              'إضافة "شروط استحقاقها" لتحديد المعلومات المطلوبة',
              'إضافة "في قانون العمل السعودي" للسياق القانوني',
            ],
            improvementScore: 8.5,
            originalClarity: 6.0,
            refinedClarity: 8.5,
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 120,
      completion_tokens: 75,
      total_tokens: 195,
    },
  },

  generateRelated: {
    model: 'meta-llama/llama-3.1-8b-instruct',
    choices: [
      {
        message: {
          content: JSON.stringify({
            relatedQuestions: [
              'كم عدد أيام الإجازة السنوية المستحقة للموظف؟',
              'متى يستحق الموظف الإجازة السنوية؟',
              'هل الإجازة السنوية مدفوعة الأجر؟',
              'يمكن للموظف تقسيم الإجازة السنوية؟',
              'ماذا يحدث للإجازة السنوية عند ترك العمل؟',
            ],
            semanticSimilarity: [0.85, 0.82, 0.79, 0.76, 0.73],
            topicRelevance: [0.95, 0.92, 0.88, 0.85, 0.82],
          }),
        },
      },
    ],
  },
};

describe('Suggestion Service', () => {
  let suggestionService: SuggestionService;
  let mockOpenRouterClient: any;
  let mockSupabaseClient: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock OpenRouter client
    const { OpenRouterClient } = require('@/libs/services/openrouter-client');
    mockOpenRouterClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    OpenRouterClient.getInstance = jest.fn(() => mockOpenRouterClient);

    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    };

    const { createServerSupabaseClient } = require('@/libs/supabase/supabase-server-client');
    createServerSupabaseClient.mockResolvedValue(mockSupabaseClient);

    // Mock logger
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    suggestionService = new SuggestionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Autocomplete Suggestions', () => {
    it('should generate Arabic autocomplete suggestions', async () => {
      mockSupabaseClient.data = arabicSuggestionTestData.autocompleteSuggestions[0];
      
      mockOpenRouterClient.chat.completions.create.mockResolvedValue(
        mockOpenRouterResponses.generateSuggestions
      );

      const result = await suggestionService.getAutocompleteSuggestions('ما هي', {
        language: 'ar',
        maxSuggestions: 5,
        includePopular: true,
        userId: 'user-123',
        organizationId: 'org-123',
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(4);
      expect(result.suggestions[0]).toContain('ما هي أحكام الإجازة السنوية');
      expect(result.language).toBe('ar');
      expect(result.confidence).toBeGreaterThan(0.9);

      expect(mockOpenRouterClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('اقتراحات الإكمال التلقائي باللغة العربية'),
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('ما هي'),
          }),
        ]),
        temperature: 0.3,
        max_tokens: 200,
      });
    });

    it('should prioritize popular and successful queries', async () => {
      const popularQueries = arabicSuggestionTestData.popularSuggestions;
      mockSupabaseClient.data = popularQueries;

      const result = await suggestionService.getAutocompleteSuggestions('أحكام', {
        language: 'ar',
        prioritizePopular: true,
        minSuccessRate: 90.0,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toContain('أحكام الإجازة السنوية');
      expect(result.metadata.prioritizedPopular).toBe(true);
      expect(result.metadata.minSuccessRate).toBe(90.0);
    });

    it('should handle typos and spelling variations in Arabic', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        ...mockOpenRouterResponses.generateSuggestions,
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  'ما هي أحكام الإجازة السنوية؟', // Corrected from "اجازة"
                  'ما هي أحكام الإجازة المرضية؟',
                ],
                typoCorrections: [
                  { original: 'اجازة', corrected: 'الإجازة' },
                ],
                confidence: 0.88,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.getAutocompleteSuggestions('ما هي اجازة', {
        language: 'ar',
        correctTypos: true,
      });

      expect(result.success).toBe(true);
      expect(result.typoCorrections).toHaveLength(1);
      expect(result.typoCorrections[0].corrected).toBe('الإجازة');
      expect(result.suggestions[0]).toContain('الإجازة السنوية');
    });

    it('should provide context-aware suggestions', async () => {
      const userContext = {
        recentQueries: ['قانون العمل', 'حقوق العامل'],
        department: 'hr',
        role: 'hr_specialist',
        interests: ['employee_rights', 'labor_law'],
      };

      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        ...mockOpenRouterResponses.generateSuggestions,
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  'ما هي حقوق العامل في قانون العمل السعودي؟',
                  'ما هي أحكام الإجازة السنوية للعاملين؟',
                ],
                contextInfluence: 'اقتراحات مخصصة بناءً على اهتمامات المستخدم في قانون العمل',
                confidence: 0.91,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.getAutocompleteSuggestions('ما هي', {
        language: 'ar',
        userContext,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions[0]).toContain('حقوق العامل');
      expect(result.contextInfluence).toBeTruthy();
    });
  });

  describe('Query Refinement', () => {
    it('should refine vague Arabic queries', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue(
        mockOpenRouterResponses.refineQuery
      );

      const result = await suggestionService.refineQuery('الإجازة', {
        language: 'ar',
        organizationId: 'org-123',
        includeExplanation: true,
      });

      expect(result.success).toBe(true);
      expect(result.refinedQuery).toContain('أحكام الإجازة السنوية');
      expect(result.refinedQuery).toContain('قانون العمل السعودي');
      expect(result.improvementScore).toBeGreaterThan(8.0);
      expect(result.refinements).toHaveLength(2);

      expect(mockOpenRouterClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('تحسين الاستعلامات العربية'),
          }),
        ]),
        temperature: 0.4,
        max_tokens: 300,
      });
    });

    it('should suggest specific refinements for broad queries', async () => {
      const broadQuery = 'العمل';
      const refinementData = arabicSuggestionTestData.refinementSuggestions.find(
        r => r.originalQuery === 'العمل'
      );

      mockSupabaseClient.data = refinementData;

      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                refinedQuery: 'ما هي أحكام ساعات العمل في قانون العمل السعودي؟',
                refinements: [
                  'تحديد جانب معين من العمل (ساعات، عقد، إنهاء)',
                  'إضافة السياق القانوني',
                  'تحويل إلى سؤال محدد',
                ],
                alternativeRefinements: [
                  'ما هي أحكام عقد العمل؟',
                  'كيف يتم إنهاء العمل قانونياً؟',
                  'ما هي حقوق العامل في مكان العمل؟',
                ],
                broadnessScore: 9.0,
                refinedScore: 3.0,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.refineQuery(broadQuery, {
        language: 'ar',
        includeAlternatives: true,
      });

      expect(result.success).toBe(true);
      expect(result.broadnessScore).toBe(9.0);
      expect(result.refinedScore).toBe(3.0);
      expect(result.alternativeRefinements).toHaveLength(3);
    });

    it('should preserve intent while adding specificity', async () => {
      const query = 'حقوق الموظف';

      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                refinedQuery: 'ما هي حقوق الموظف في القطاع الخاص وفقاً لقانون العمل السعودي؟',
                intentPreservation: 95,
                addedSpecificity: [
                  'القطاع (خاص)',
                  'المرجع القانوني (قانون العمل السعودي)',
                  'صيغة السؤال الواضحة',
                ],
                confidence: 0.94,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.refineQuery(query, {
        language: 'ar',
        preserveIntent: true,
      });

      expect(result.success).toBe(true);
      expect(result.intentPreservation).toBe(95);
      expect(result.addedSpecificity).toHaveLength(3);
      expect(result.refinedQuery).toContain('حقوق الموظف');
      expect(result.refinedQuery).toContain('القطاع الخاص');
    });
  });

  describe('Related Questions Generation', () => {
    it('should generate semantically related questions in Arabic', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue(
        mockOpenRouterResponses.generateRelated
      );

      const result = await suggestionService.getRelatedQuestions(
        'أحكام الإجازة السنوية',
        {
          language: 'ar',
          maxQuestions: 5,
          organizationId: 'org-123',
        }
      );

      expect(result.success).toBe(true);
      expect(result.relatedQuestions).toHaveLength(5);
      expect(result.relatedQuestions[0]).toContain('أيام الإجازة السنوية');
      expect(result.semanticSimilarity).toHaveLength(5);
      expect(result.topicRelevance).toHaveLength(5);
      expect(result.semanticSimilarity[0]).toBeGreaterThan(0.8);

      expect(mockOpenRouterClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('أسئلة ذات صلة باللغة العربية'),
          }),
        ]),
        temperature: 0.6,
        max_tokens: 400,
      });
    });

    it('should diversify related questions by category', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                relatedQuestions: [
                  'كم عدد أيام الإجازة السنوية؟', // Duration category
                  'متى يستحق الموظف الإجازة؟', // Eligibility category  
                  'هل الإجازة مدفوعة الأجر؟', // Compensation category
                  'كيف يتم تقديم طلب الإجازة؟', // Process category
                  'ماذا يحدث عند عدم أخذ الإجازة؟', // Consequences category
                ],
                categories: [
                  'duration', 'eligibility', 'compensation', 'process', 'consequences'
                ],
                diversityScore: 0.89,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.getRelatedQuestions(
        'أحكام الإجازة السنوية',
        {
          language: 'ar',
          diversifyByCategory: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.categories).toHaveLength(5);
      expect(result.diversityScore).toBeGreaterThan(0.8);
      expect(new Set(result.categories)).toHaveProperty('size', 5); // All unique categories
    });

    it('should rank related questions by relevance and popularity', async () => {
      const relatedData = arabicSuggestionTestData.relatedQuestions[0];
      mockSupabaseClient.data = relatedData.related.map((q, i) => ({
        question: q,
        popularity: 100 - i * 10,
        successRate: 95 - i * 2,
        relevanceScore: 0.9 - i * 0.05,
      }));

      const result = await suggestionService.getRelatedQuestions(
        'أحكام الإجازة السنوية',
        {
          language: 'ar',
          rankBy: 'combined', // popularity + relevance + success rate
          includeMetrics: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.relatedQuestions[0]).toContain('كم يوم إجازة سنوية');
      expect(result.rankings).toBeDefined();
      expect(result.rankings[0].score).toBeGreaterThan(result.rankings[1].score);
    });
  });

  describe('Popular Queries and Trending', () => {
    it('should retrieve popular queries by category', async () => {
      mockSupabaseClient.data = arabicSuggestionTestData.popularSuggestions;

      const result = await suggestionService.getPopularQueries({
        category: 'leaves',
        language: 'ar',
        organizationId: 'org-123',
        timeframe: 'last30days',
        minFrequency: 50,
      });

      expect(result.success).toBe(true);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0].query).toBe('أحكام الإجازة السنوية');
      expect(result.queries[0].frequency).toBe(245);
      expect(result.queries[0].category).toBe('leaves');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('popular_queries');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('category', 'leaves');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('language', 'ar');
    });

    it('should identify trending queries', async () => {
      const trendingData = [
        {
          query: 'قانون العمل الجديد 2024',
          currentFrequency: 156,
          previousFrequency: 23,
          trendScore: 6.78,
          category: 'legal_updates',
        },
        {
          query: 'العمل عن بُعد في السعودية',
          currentFrequency: 98,
          previousFrequency: 12,
          trendScore: 8.17,
          category: 'remote_work',
        },
      ];

      mockSupabaseClient.data = trendingData;

      const result = await suggestionService.getTrendingQueries({
        language: 'ar',
        organizationId: 'org-123',
        timeframe: 'last7days',
        minTrendScore: 5.0,
      });

      expect(result.success).toBe(true);
      expect(result.trending).toHaveLength(2);
      expect(result.trending[0].trendScore).toBeGreaterThan(5.0);
      expect(result.trending[0].query).toContain('العمل عن بُعد');
    });

    it('should suggest queries based on user behavior patterns', async () => {
      const userPattern = {
        userId: 'user-123',
        recentQueries: [
          'أحكام الإجازة السنوية',
          'حساب مكافأة نهاية الخدمة',
        ],
        queryCategories: ['leaves', 'end_of_service'],
        timeOfDay: 'morning',
        dayOfWeek: 'tuesday',
      };

      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                personalizedSuggestions: [
                  'أحكام الإجازة المرضية وشروطها',
                  'كيفية احتساب العلاوة السنوية',
                  'حقوق الموظف في نقل الخدمة',
                ],
                reasoning: 'اقتراحات مبنية على اهتمام المستخدم بالإجازات والمزايا المالية',
                confidence: 0.87,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.getPersonalizedSuggestions(userPattern, {
        language: 'ar',
        maxSuggestions: 3,
      });

      expect(result.success).toBe(true);
      expect(result.personalizedSuggestions).toHaveLength(3);
      expect(result.reasoning).toContain('الإجازات والمزايا');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Query Expansion and Semantic Enhancement', () => {
    it('should expand query with synonyms and related terms', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                expandedQuery: 'الراتب الأساسي والبدلات والمزايا المالية',
                synonyms: ['الأجر', 'المرتب', 'الدخل', 'التعويض'],
                relatedTerms: ['البدلات', 'المزايا', 'الحوافز', 'المكافآت'],
                semanticExpansion: [
                  'الراتب الشهري',
                  'المرتب السنوي',
                  'الدخل الإجمالي',
                ],
                confidence: 0.91,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.expandQuery('الراتب', {
        language: 'ar',
        includeSynonyms: true,
        includeRelatedTerms: true,
        maxExpansions: 10,
      });

      expect(result.success).toBe(true);
      expect(result.expandedQuery).toContain('البدلات والمزايا');
      expect(result.synonyms).toContain('الأجر');
      expect(result.relatedTerms).toContain('المكافآت');
      expect(result.semanticExpansion).toHaveLength(3);
    });

    it('should handle domain-specific terminology expansion', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                expandedQuery: 'التأمينات الاجتماعية والضمان الاجتماعي والحماية الاجتماعية',
                domainTerms: [
                  'نظام التأمينات الاجتماعية',
                  'المؤسسة العامة للتأمينات الاجتماعية',
                  'اشتراكات التأمين',
                  'المعاش التقاعدي',
                ],
                legalReferences: [
                  'نظام التأمينات الاجتماعية السعودي',
                  'لائحة تطبيق نظام التأمينات',
                ],
                confidence: 0.94,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.expandQuery('التأمينات', {
        language: 'ar',
        domain: 'saudi_labor_law',
        includeLegalReferences: true,
      });

      expect(result.success).toBe(true);
      expect(result.domainTerms).toContain('المؤسسة العامة للتأمينات الاجتماعية');
      expect(result.legalReferences).toHaveLength(2);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Suggestion Analytics and Learning', () => {
    it('should track suggestion performance and user interactions', async () => {
      const interactionData = {
        suggestionId: 'suggestion-001',
        query: 'أحكام الإجازة السنوية',
        suggestion: 'ما هي أحكام الإجازة السنوية في قانون العمل السعودي؟',
        userAction: 'selected',
        resultSatisfaction: 4.5,
        userId: 'user-123',
        timestamp: new Date().toISOString(),
      };

      mockSupabaseClient.data = { id: 'tracking-001' };

      const result = await suggestionService.trackSuggestionInteraction(interactionData);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        suggestion_id: 'suggestion-001',
        user_id: 'user-123',
        action: 'selected',
        satisfaction_score: 4.5,
        created_at: expect.any(String),
      });
    });

    it('should analyze suggestion effectiveness', async () => {
      const analyticsData = {
        totalSuggestions: 1250,
        acceptedSuggestions: 856,
        acceptanceRate: 68.5,
        averageSatisfaction: 4.2,
        topPerformingSuggestions: [
          {
            suggestion: 'أحكام الإجازة السنوية',
            acceptanceRate: 89.3,
            satisfaction: 4.8,
          },
          {
            suggestion: 'حساب مكافأة نهاية الخدمة',
            acceptanceRate: 85.1,
            satisfaction: 4.6,
          },
        ],
        improvementAreas: [
          'تحسين اقتراحات الاستعلامات التقنية',
          'زيادة التنوع في الاقتراحات المتعلقة بالمرتبات',
        ],
      };

      mockSupabaseClient.data = analyticsData;

      const result = await suggestionService.getSuggestionAnalytics({
        organizationId: 'org-123',
        timeframe: 'last30days',
        language: 'ar',
      });

      expect(result.success).toBe(true);
      expect(result.analytics.acceptanceRate).toBe(68.5);
      expect(result.analytics.topPerformingSuggestions).toHaveLength(2);
      expect(result.analytics.improvementAreas).toHaveLength(2);
    });

    it('should provide machine learning insights for suggestion improvement', async () => {
      mockOpenRouterClient.chat.completions.create.mockResolvedValue({
        model: 'meta-llama/llama-3.1-8b-instruct',
        choices: [
          {
            message: {
              content: JSON.stringify({
                insights: [
                  'المستخدمون يفضلون الاقتراحات المحددة والواضحة',
                  'الاستعلامات المتعلقة بالإجازات لها معدل قبول عالي',
                  'يجب تحسين اقتراحات الاستعلامات التقنية المعقدة',
                ],
                recommendations: [
                  'زيادة التخصص في اقتراحات كل فئة',
                  'استخدام أمثلة عملية في الاقتراحات',
                  'تحسين الترجمة والصياغة للمصطلحات التقنية',
                ],
                confidenceLevel: 0.88,
              }),
            },
          },
        ],
      });

      const result = await suggestionService.generateImprovementInsights({
        organizationId: 'org-123',
        language: 'ar',
        analysisDepth: 'comprehensive',
      });

      expect(result.success).toBe(true);
      expect(result.insights).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);
      expect(result.confidenceLevel).toBeGreaterThan(0.8);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle OpenRouter API failures gracefully', async () => {
      mockOpenRouterClient.chat.completions.create.mockRejectedValue(
        new Error('OpenRouter API unavailable')
      );

      const result = await suggestionService.getAutocompleteSuggestions('ما هي', {
        language: 'ar',
        fallbackToCache: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenRouter API unavailable');
      expect(result.fallbackUsed).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI suggestion generation failed',
        expect.any(Error)
      );
    });

    it('should handle malformed or empty queries', async () => {
      const emptyQuery = '';
      const result = await suggestionService.refineQuery(emptyQuery, {
        language: 'ar',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query cannot be empty');

      const malformedQuery = '   $$%^&*()   ';
      const result2 = await suggestionService.refineQuery(malformedQuery, {
        language: 'ar',
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Invalid query format');
    });

    it('should handle rate limiting and quota exhaustion', async () => {
      mockOpenRouterClient.chat.completions.create.mockRejectedValue({
        error: {
          type: 'rate_limit_exceeded',
          message: 'Rate limit exceeded',
        },
      });

      const result = await suggestionService.getRelatedQuestions(
        'أحكام الإجازة السنوية',
        {
          language: 'ar',
          retryOnRateLimit: true,
          maxRetries: 3,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.retryAttempts).toBe(3);
    });

    it('should validate Arabic text encoding and character support', async () => {
      const corruptedQuery = 'استعلام مع نص \uFFFD\uFFFD فاسد';

      const result = await suggestionService.getAutocompleteSuggestions(corruptedQuery, {
        language: 'ar',
        validateEncoding: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Arabic text encoding');
      expect(result.encodingIssues).toContain('replacement_characters_detected');
    });
  });
});