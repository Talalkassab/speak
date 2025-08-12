import { GET, POST } from '@/app/api/v1/chat/conversations/route';
import { createMockSupabaseClient } from '../../utils/supabase-mock';
import { createMockRequest, createMockJSONRequest } from '../../utils/request-mock';
import { mockConversationData } from '../../../mocks/data/conversations';

// Mock Supabase client
jest.mock('@/libs/supabase/supabase-server-client', () => ({
  createServerClient: () => createMockSupabaseClient(),
}));

// Mock conversation service
const mockConversationService = {
  createConversation: jest.fn(),
  getConversations: jest.fn(),
  getConversation: jest.fn(),
  updateConversation: jest.fn(),
  deleteConversation: jest.fn(),
};

jest.mock('@/libs/services/conversation-service', () => ({
  ConversationService: jest.fn().mockImplementation(() => mockConversationService),
}));

describe('/api/v1/chat/conversations', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { organization_id: 'org-456' },
    },
    access_token: 'mock-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns list of conversations for authenticated user', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockConversationService.getConversations.mockResolvedValue({
        conversations: mockConversationData.conversations,
        total: mockConversationData.conversations.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        data: {
          conversations: mockConversationData.conversations,
          total: 3,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(mockConversationService.getConversations).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-456',
        page: 1,
        limit: 10,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
    });

    it('supports pagination parameters', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const paginatedConversations = mockConversationData.conversations.slice(0, 2);
      mockConversationService.getConversations.mockResolvedValue({
        conversations: paginatedConversations,
        total: mockConversationData.conversations.length,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations', {
        searchParams: new URLSearchParams({
          page: '1',
          limit: '2',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.conversations).toHaveLength(2);
      expect(data.data.page).toBe(1);
      expect(data.data.limit).toBe(2);
      expect(data.data.totalPages).toBe(2);

      expect(mockConversationService.getConversations).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-456',
        page: 1,
        limit: 2,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
    });

    it('supports filtering by status', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const activeConversations = mockConversationData.conversations.filter(
        conv => conv.status === 'completed'
      );

      mockConversationService.getConversations.mockResolvedValue({
        conversations: activeConversations,
        total: activeConversations.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations', {
        searchParams: new URLSearchParams({
          status: 'completed',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      expect(mockConversationService.getConversations).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-456',
        page: 1,
        limit: 10,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        status: 'completed',
      });
    });

    it('supports search functionality', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const searchResults = [mockConversationData.conversations[0]];
      mockConversationService.getConversations.mockResolvedValue({
        conversations: searchResults,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations', {
        searchParams: new URLSearchParams({
          search: 'إجازات',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.conversations).toHaveLength(1);
      expect(data.data.conversations[0].title).toContain('إجازات');

      expect(mockConversationService.getConversations).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-456',
        page: 1,
        limit: 10,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        search: 'إجازات',
      });
    });

    it('returns 401 for unauthenticated requests', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations');
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    });

    it('validates pagination parameters', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/chat/conversations', {
        searchParams: new URLSearchParams({
          page: 'invalid',
          limit: '101', // Exceeds max limit
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Bad Request');
    });
  });

  describe('POST', () => {
    it('creates a new conversation successfully', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const newConversation = {
        id: 'new-conv-123',
        title: 'استفسار جديد عن العقود',
        created_at: '2025-08-11T15:00:00Z',
        updated_at: '2025-08-11T15:00:00Z',
        message_count: 0,
        status: 'active',
        user_id: 'user-123',
        organization_id: 'org-456',
        tags: [],
      };

      mockConversationService.createConversation.mockResolvedValue(newConversation);

      const requestData = {
        title: 'استفسار جديد عن العقود',
        initialMessage: 'ما هي متطلبات العقد الجديد؟',
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        data: newConversation,
        message: 'Conversation created successfully',
      });

      expect(mockConversationService.createConversation).toHaveBeenCalledWith({
        title: requestData.title,
        initialMessage: requestData.initialMessage,
        userId: 'user-123',
        organizationId: 'org-456',
      });
    });

    it('auto-generates title if not provided', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const newConversation = {
        id: 'new-conv-456',
        title: 'محادثة جديدة',
        created_at: '2025-08-11T15:00:00Z',
        updated_at: '2025-08-11T15:00:00Z',
        message_count: 0,
        status: 'active',
        user_id: 'user-123',
        organization_id: 'org-456',
        tags: [],
      };

      mockConversationService.createConversation.mockResolvedValue(newConversation);

      const requestData = {
        initialMessage: 'مرحباً، أريد معرفة المزيد عن نظام العمل',
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(201);

      expect(mockConversationService.createConversation).toHaveBeenCalledWith({
        title: undefined, // Service should generate title
        initialMessage: requestData.initialMessage,
        userId: 'user-123',
        organizationId: 'org-456',
      });
    });

    it('validates required fields', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const requestData = {
        title: 'عنوان فقط بدون رسالة',
        // Missing initialMessage
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('initialMessage');
    });

    it('validates title length', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const requestData = {
        title: 'x'.repeat(256), // Too long
        initialMessage: 'رسالة صحيحة',
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('title');
      expect(data.message).toContain('255');
    });

    it('validates message length', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const requestData = {
        title: 'عنوان صحيح',
        initialMessage: 'x'.repeat(5001), // Too long
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('initialMessage');
      expect(data.message).toContain('5000');
    });

    it('returns 401 for unauthenticated requests', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const requestData = {
        title: 'محادثة جديدة',
        initialMessage: 'مرحباً',
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('handles service errors gracefully', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockConversationService.createConversation.mockRejectedValue(
        new Error('Database connection failed')
      );

      const requestData = {
        title: 'محادثة جديدة',
        initialMessage: 'مرحباً',
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal Server Error');
    });

    it('supports conversation metadata and tags', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const newConversation = {
        id: 'new-conv-789',
        title: 'استفسار قانوني',
        created_at: '2025-08-11T15:00:00Z',
        updated_at: '2025-08-11T15:00:00Z',
        message_count: 0,
        status: 'active',
        user_id: 'user-123',
        organization_id: 'org-456',
        tags: ['قانوني', 'عقود'],
        metadata: {
          priority: 'high',
          category: 'legal',
        },
      };

      mockConversationService.createConversation.mockResolvedValue(newConversation);

      const requestData = {
        title: 'استفسار قانوني',
        initialMessage: 'أحتاج مساعدة في موضوع قانوني',
        tags: ['قانوني', 'عقود'],
        metadata: {
          priority: 'high',
          category: 'legal',
        },
      };

      const request = createMockJSONRequest(
        'POST',
        '/api/v1/chat/conversations',
        requestData
      );

      const response = await POST(request);

      expect(response.status).toBe(201);

      expect(mockConversationService.createConversation).toHaveBeenCalledWith({
        title: requestData.title,
        initialMessage: requestData.initialMessage,
        userId: 'user-123',
        organizationId: 'org-456',
        tags: requestData.tags,
        metadata: requestData.metadata,
      });
    });
  });
});