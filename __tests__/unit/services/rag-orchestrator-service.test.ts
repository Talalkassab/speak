import { RAGOrchestratorService } from '@/libs/services/rag-orchestrator-service';
import { EnhancedRetrievalService } from '@/libs/services/enhanced-retrieval-service';
import { ResponseGenerationService } from '@/libs/services/response-generation-service';
import { ConversationContextService } from '@/libs/services/conversation-context-service';

// Mock the services
jest.mock('@/libs/services/enhanced-retrieval-service');
jest.mock('@/libs/services/response-generation-service');
jest.mock('@/libs/services/conversation-context-service');

const MockedEnhancedRetrievalService = EnhancedRetrievalService as jest.MockedClass<typeof EnhancedRetrievalService>;
const MockedResponseGenerationService = ResponseGenerationService as jest.MockedClass<typeof ResponseGenerationService>;
const MockedConversationContextService = ConversationContextService as jest.MockedClass<typeof ConversationContextService>;

describe('RAGOrchestratorService', () => {
  let orchestrator: RAGOrchestratorService;
  let mockRetrievalService: jest.Mocked<EnhancedRetrievalService>;
  let mockResponseService: jest.Mocked<ResponseGenerationService>;
  let mockContextService: jest.Mocked<ConversationContextService>;

  const mockContext = {
    conversationId: 'conv-123',
    organizationId: 'org-456',
    userId: 'user-789',
    language: 'ar-SA' as const,
    previousMessages: [
      {
        role: 'user' as const,
        content: 'ما هي أنواع الإجازات؟',
        timestamp: new Date('2025-08-11T10:00:00Z'),
      },
    ],
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockRetrievalService = {
      searchRelevantContent: jest.fn(),
      getDocumentChunks: jest.fn(),
      rankResults: jest.fn(),
      filterByRelevance: jest.fn(),
    } as any;

    mockResponseService = {
      generateResponse: jest.fn(),
      generateStreamingResponse: jest.fn(),
      enhanceWithContext: jest.fn(),
      validateResponse: jest.fn(),
    } as any;

    mockContextService = {
      buildContext: jest.fn(),
      updateContext: jest.fn(),
      getRecentContext: jest.fn(),
      summarizeContext: jest.fn(),
    } as any;

    // Mock constructors
    MockedEnhancedRetrievalService.mockImplementation(() => mockRetrievalService);
    MockedResponseGenerationService.mockImplementation(() => mockResponseService);
    MockedConversationContextService.mockImplementation(() => mockContextService);

    orchestrator = new RAGOrchestratorService();
  });

  describe('processQuery', () => {
    it('successfully processes a query with all steps', async () => {
      const query = 'ما هي متطلبات عقد العمل في السعودية؟';
      
      // Mock search results
      const mockSearchResults = [
        {
          document_id: 'doc-1',
          title: 'نظام العمل السعودي',
          content: 'متطلبات عقد العمل تشمل...',
          relevance_score: 0.92,
          metadata: {
            page_number: 45,
            section: 'العقود',
          },
        },
        {
          document_id: 'doc-2',
          title: 'دليل الموارد البشرية',
          content: 'عقد العمل يجب أن يحتوي على...',
          relevance_score: 0.87,
          metadata: {
            page_number: 12,
            section: 'التوظيف',
          },
        },
      ];

      const mockResponse = {
        content: 'وفقاً لنظام العمل السعودي، متطلبات عقد العمل تشمل: 1. اسم صاحب العمل...',
        sources: mockSearchResults,
        confidence: 0.95,
        processingTime: 1200,
      };

      // Set up mocks
      mockRetrievalService.searchRelevantContent.mockResolvedValue(mockSearchResults);
      mockContextService.buildContext.mockResolvedValue({
        ...mockContext,
        relevantHistory: [],
      });
      mockResponseService.generateResponse.mockResolvedValue(mockResponse);

      const result = await orchestrator.processQuery(query, mockContext);

      expect(result).toEqual({
        query,
        response: mockResponse.content,
        sources: mockSearchResults,
        confidence: 0.95,
        processingTime: expect.any(Number),
        metadata: {
          retrievalCount: 2,
          contextTokens: expect.any(Number),
          language: 'ar-SA',
        },
      });

      // Verify all services were called correctly
      expect(mockRetrievalService.searchRelevantContent).toHaveBeenCalledWith(
        query,
        mockContext.organizationId,
        { language: 'ar-SA', maxResults: 10 }
      );
      expect(mockContextService.buildContext).toHaveBeenCalledWith(mockContext);
      expect(mockResponseService.generateResponse).toHaveBeenCalledWith(
        query,
        mockSearchResults,
        expect.any(Object)
      );
    });

    it('handles empty search results gracefully', async () => {
      const query = 'غير موجود في الوثائق';

      mockRetrievalService.searchRelevantContent.mockResolvedValue([]);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateResponse.mockResolvedValue({
        content: 'عذراً، لم أجد معلومات محددة حول هذا الموضوع في الوثائق المتاحة.',
        sources: [],
        confidence: 0.3,
        processingTime: 800,
      });

      const result = await orchestrator.processQuery(query, mockContext);

      expect(result.sources).toHaveLength(0);
      expect(result.confidence).toBe(0.3);
      expect(result.response).toContain('لم أجد معلومات');
    });

    it('handles retrieval service errors', async () => {
      const query = 'اختبار خطأ';

      mockRetrievalService.searchRelevantContent.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(orchestrator.processQuery(query, mockContext)).rejects.toThrow(
        'Failed to process query: Database connection failed'
      );
    });

    it('handles response generation errors', async () => {
      const query = 'اختبار خطأ في التوليد';

      mockRetrievalService.searchRelevantContent.mockResolvedValue([
        {
          document_id: 'doc-1',
          title: 'Test Doc',
          content: 'Test content',
          relevance_score: 0.8,
        },
      ]);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateResponse.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(orchestrator.processQuery(query, mockContext)).rejects.toThrow(
        'Failed to process query: OpenAI API error'
      );
    });

    it('filters results by relevance threshold', async () => {
      const query = 'اختبار التصفية';
      
      const mockSearchResults = [
        {
          document_id: 'doc-1',
          title: 'Relevant Doc',
          content: 'High relevance content',
          relevance_score: 0.95,
        },
        {
          document_id: 'doc-2',
          title: 'Less Relevant Doc',
          content: 'Lower relevance content',
          relevance_score: 0.45, // Below threshold
        },
      ];

      mockRetrievalService.searchRelevantContent.mockResolvedValue(mockSearchResults);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateResponse.mockResolvedValue({
        content: 'Response based on filtered results',
        sources: [mockSearchResults[0]], // Only high-relevance result
        confidence: 0.92,
        processingTime: 1100,
      });

      const result = await orchestrator.processQuery(query, mockContext, {
        relevanceThreshold: 0.7,
      });

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].relevance_score).toBeGreaterThan(0.7);
    });

    it('limits number of retrieved documents', async () => {
      const query = 'اختبار التحديد';
      
      const mockSearchResults = Array.from({ length: 15 }, (_, i) => ({
        document_id: `doc-${i + 1}`,
        title: `Document ${i + 1}`,
        content: `Content ${i + 1}`,
        relevance_score: 0.9 - i * 0.05,
      }));

      mockRetrievalService.searchRelevantContent.mockResolvedValue(mockSearchResults);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateResponse.mockResolvedValue({
        content: 'Response based on limited results',
        sources: mockSearchResults.slice(0, 5),
        confidence: 0.88,
        processingTime: 1300,
      });

      const result = await orchestrator.processQuery(query, mockContext, {
        maxResults: 5,
      });

      expect(result.sources).toHaveLength(5);
      expect(mockRetrievalService.searchRelevantContent).toHaveBeenCalledWith(
        query,
        mockContext.organizationId,
        { language: 'ar-SA', maxResults: 5 }
      );
    });
  });

  describe('processStreamingQuery', () => {
    it('processes streaming query with callback', async () => {
      const query = 'اختبار البث المباشر';
      const mockCallback = jest.fn();

      const mockSearchResults = [
        {
          document_id: 'doc-1',
          title: 'Test Doc',
          content: 'Test content for streaming',
          relevance_score: 0.9,
        },
      ];

      mockRetrievalService.searchRelevantContent.mockResolvedValue(mockSearchResults);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      
      // Mock streaming response
      mockResponseService.generateStreamingResponse.mockImplementation(
        async (query, sources, context, callback) => {
          // Simulate streaming chunks
          const chunks = ['هذا', ' اختبار', ' للبث', ' المباشر'];
          for (const chunk of chunks) {
            await callback({ content: chunk, isComplete: false });
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          await callback({ content: '', isComplete: true });
          
          return {
            content: 'هذا اختبار للبث المباشر',
            sources: mockSearchResults,
            confidence: 0.9,
            processingTime: 1500,
          };
        }
      );

      await orchestrator.processStreamingQuery(query, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(5); // 4 chunks + completion
      expect(mockCallback).toHaveBeenCalledWith({ content: 'هذا', isComplete: false });
      expect(mockCallback).toHaveBeenCalledWith({ content: '', isComplete: true });
    });

    it('handles streaming errors gracefully', async () => {
      const query = 'خطأ في البث';
      const mockCallback = jest.fn();

      mockRetrievalService.searchRelevantContent.mockResolvedValue([]);
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateStreamingResponse.mockRejectedValue(
        new Error('Streaming failed')
      );

      await expect(
        orchestrator.processStreamingQuery(query, mockContext, mockCallback)
      ).rejects.toThrow('Failed to process streaming query: Streaming failed');

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('getQuerySuggestions', () => {
    it('generates relevant query suggestions', async () => {
      const partialQuery = 'ما هي';
      
      const mockSuggestions = [
        'ما هي أنواع الإجازات المتاحة؟',
        'ما هي متطلبات عقد العمل؟',
        'ما هي حقوق الموظف؟',
      ];

      // Mock retrieval service to return popular queries
      mockRetrievalService.searchRelevantContent.mockResolvedValue([]);
      
      // We need to mock the suggestions method if it exists
      if (mockRetrievalService.getQuerySuggestions) {
        mockRetrievalService.getQuerySuggestions.mockResolvedValue(mockSuggestions);
      }

      const result = await orchestrator.getQuerySuggestions(partialQuery, mockContext);

      expect(result).toEqual(mockSuggestions);
      expect(result).toHaveLength(3);
      expect(result.every(s => s.startsWith('ما هي'))).toBe(true);
    });
  });

  describe('validateQuery', () => {
    it('validates Arabic queries correctly', () => {
      const validQueries = [
        'ما هي أنواع الإجازات؟',
        'كيف يتم حساب مكافأة نهاية الخدمة؟',
        'متطلبات عقد العمل',
      ];

      validQueries.forEach(query => {
        expect(() => orchestrator.validateQuery(query)).not.toThrow();
      });
    });

    it('validates English queries correctly', () => {
      const validQueries = [
        'What are the types of leave available?',
        'How is end of service calculated?',
        'Employment contract requirements',
      ];

      validQueries.forEach(query => {
        expect(() => orchestrator.validateQuery(query)).not.toThrow();
      });
    });

    it('rejects invalid queries', () => {
      const invalidQueries = [
        '', // Empty
        '   ', // Only whitespace
        'a', // Too short
        'x'.repeat(2001), // Too long
        '<?php echo "test"; ?>', // Suspicious content
      ];

      invalidQueries.forEach(query => {
        expect(() => orchestrator.validateQuery(query)).toThrow();
      });
    });
  });

  describe('performance and monitoring', () => {
    it('tracks processing time accurately', async () => {
      const query = 'اختبار الأداء';
      const startTime = Date.now();

      mockRetrievalService.searchRelevantContent.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      });
      
      mockContextService.buildContext.mockResolvedValue(mockContext);
      mockResponseService.generateResponse.mockResolvedValue({
        content: 'Test response',
        sources: [],
        confidence: 0.8,
        processingTime: 100,
      });

      const result = await orchestrator.processQuery(query, mockContext);
      const endTime = Date.now();

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(endTime - startTime + 100);
    });

    it('includes metadata in response', async () => {
      const query = 'اختبار البيانات الوصفية';
      
      mockRetrievalService.searchRelevantContent.mockResolvedValue([
        { document_id: 'doc-1', title: 'Doc 1', content: 'Content', relevance_score: 0.9 },
        { document_id: 'doc-2', title: 'Doc 2', content: 'Content', relevance_score: 0.8 },
      ]);
      
      mockContextService.buildContext.mockResolvedValue({
        ...mockContext,
        relevantHistory: [mockContext.previousMessages[0]],
      });
      
      mockResponseService.generateResponse.mockResolvedValue({
        content: 'Test response',
        sources: [],
        confidence: 0.85,
        processingTime: 1000,
      });

      const result = await orchestrator.processQuery(query, mockContext);

      expect(result.metadata).toEqual({
        retrievalCount: 2,
        contextTokens: expect.any(Number),
        language: 'ar-SA',
      });
    });
  });
});