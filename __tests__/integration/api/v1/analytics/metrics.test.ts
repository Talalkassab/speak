import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/analytics/metrics/route';
import { createMockSupabaseClient } from '../../../utils/supabase-mock';
import { createMockRequest } from '../../../utils/request-mock';

// Mock Supabase client
jest.mock('@/libs/supabase/supabase-server-client', () => ({
  createServerClient: () => createMockSupabaseClient(),
}));

// Mock analytics aggregation service
const mockAnalyticsService = {
  getOverviewMetrics: jest.fn(),
  getUserActivityMetrics: jest.fn(),
  getSystemPerformanceMetrics: jest.fn(),
};

jest.mock('@/libs/services/analytics-aggregation-service', () => ({
  AnalyticsAggregationService: jest.fn().mockImplementation(() => mockAnalyticsService),
}));

describe('/api/v1/analytics/metrics', () => {
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
    it('returns analytics metrics for authenticated user', async () => {
      const mockMetrics = {
        total_queries: 15420,
        total_users: 342,
        avg_response_time: 1.24,
        success_rate: 98.7,
        daily_active_users: 89,
        monthly_active_users: 342,
        storage_used: 2.4,
        bandwidth_used: 15.8,
        error_rate: 1.3,
        uptime: 99.8,
      };

      // Mock authenticated session
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        data: mockMetrics,
        timestamp: expect.any(String),
      });

      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith(
        'org-456',
        expect.any(Object)
      );
    });

    it('returns metrics filtered by date range', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const filteredMetrics = {
        total_queries: 2400,
        total_users: 45,
        avg_response_time: 1.1,
        success_rate: 99.2,
      };

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(filteredMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          startDate: '2025-08-01',
          endDate: '2025-08-07',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toEqual(filteredMetrics);

      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith(
        'org-456',
        {
          startDate: new Date('2025-08-01'),
          endDate: new Date('2025-08-07'),
        }
      );
    });

    it('returns metrics filtered by specific metric types', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const performanceMetrics = {
        avg_response_time: 1.24,
        success_rate: 98.7,
        error_rate: 1.3,
        uptime: 99.8,
      };

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(performanceMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          metrics: 'performance',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toEqual(performanceMetrics);

      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith(
        'org-456',
        {
          metrics: ['performance'],
        }
      );
    });

    it('handles multiple metric type filters', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const combinedMetrics = {
        total_queries: 15420,
        total_users: 342,
        avg_response_time: 1.24,
        success_rate: 98.7,
        storage_used: 2.4,
        bandwidth_used: 15.8,
      };

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(combinedMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          metrics: 'usage,performance,storage',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      
      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith(
        'org-456',
        {
          metrics: ['usage', 'performance', 'storage'],
        }
      );
    });

    it('returns 401 for unauthenticated requests', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });

      expect(mockAnalyticsService.getOverviewMetrics).not.toHaveBeenCalled();
    });

    it('returns 403 for users without analytics access', async () => {
      const limitedSession = {
        user: {
          id: 'user-limited',
          email: 'limited@example.com',
          user_metadata: { 
            organization_id: 'org-456',
            role: 'viewer', // Limited role
          },
        },
        access_token: 'mock-token',
      };

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: limitedSession },
        error: null,
      });

      // Mock role check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { role: 'viewer', permissions: ['read'] },
          error: null,
        }),
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions to access analytics',
      });
    });

    it('handles analytics service errors gracefully', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockAnalyticsService.getOverviewMetrics.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve analytics metrics',
      });
    });

    it('validates date range parameters', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          startDate: 'invalid-date',
          endDate: '2025-08-07',
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Bad Request',
        message: 'Invalid date format for startDate parameter',
      });
    });

    it('validates that endDate is after startDate', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          startDate: '2025-08-07',
          endDate: '2025-08-01', // Earlier than start date
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Bad Request',
        message: 'endDate must be after startDate',
      });
    });

    it('limits date range to maximum allowed period', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        searchParams: new URLSearchParams({
          startDate: '2024-01-01',
          endDate: '2025-12-31', // More than 1 year range
        }),
      });

      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Bad Request',
        message: 'Date range cannot exceed 365 days',
      });
    });

    it('handles organization-specific metrics correctly', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const orgSpecificMetrics = {
        total_queries: 5000,
        total_users: 25,
        organization_specific_data: {
          department_usage: {
            hr: 60,
            legal: 30,
            management: 10,
          },
        },
      };

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(orgSpecificMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toEqual(orgSpecificMetrics);
      expect(data.data.organization_specific_data).toBeDefined();
    });

    it('includes rate limiting headers in response', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue({
        total_queries: 1000,
      });

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('caches metrics data appropriately', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockMetrics = { total_queries: 1500 };
      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300'); // 5 minutes cache
      expect(response.headers.get('ETag')).toBeTruthy();
    });

    it('respects Arabic locale for number formatting in response', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockMetrics = {
        total_queries: 15420,
        success_rate: 98.7,
      };

      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockMetrics);

      const request = createMockRequest('GET', '/api/v1/analytics/metrics', {
        headers: { 'Accept-Language': 'ar-SA' },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toEqual(mockMetrics);
      expect(response.headers.get('Content-Language')).toBe('ar-SA');
    });
  });
});