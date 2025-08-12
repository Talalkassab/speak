/**
 * Analytics API Unit Tests
 * Tests for analytics endpoints with Arabic data support
 */

import { createMocks } from 'node-mocks-http';
import { NextRequest, NextResponse } from 'next/server';
import { POST as analyticsMetrics } from '@/app/api/v1/analytics/metrics/route';
import { GET as analyticsUsage } from '@/app/api/v1/analytics/usage/route';
import { GET as analyticsCosts } from '@/app/api/v1/analytics/costs/route';
import { POST as analyticsExport } from '@/app/api/v1/analytics/export/route';
import { GET as analyticsRealtime } from '@/app/api/v1/analytics/realtime/route';

// Mock external dependencies
jest.mock('@/libs/supabase/supabase-server-client', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/libs/services/analytics-aggregation-service', () => ({
  AnalyticsAggregationService: {
    getInstance: jest.fn(() => ({
      getOverviewMetrics: jest.fn(),
      getUsageData: jest.fn(),
      getCostBreakdown: jest.fn(),
      getPopularQueries: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      exportReport: jest.fn(),
      getRealtimeMetrics: jest.fn(),
    })),
  },
}));

jest.mock('@/libs/auth/auth-middleware', () => ({
  validateAuth: jest.fn(),
}));

// Mock data
const mockAuthUser = {
  id: 'user-123',
  email: 'test@example.com',
  organizationId: 'org-123',
  role: 'admin',
};

const mockAnalyticsData = {
  overview: {
    totalQueries: 1543,
    uniqueUsers: 89,
    averageResponseTime: 1.2,
    successRate: 98.5,
    totalCost: 127.50,
    costTrend: 5.2,
    period: 'last30days',
  },
  usage: {
    daily: [
      { date: '2024-01-01', queries: 45, users: 12, arabicQueries: 38 },
      { date: '2024-01-02', queries: 67, users: 18, arabicQueries: 59 },
      { date: '2024-01-03', queries: 89, users: 23, arabicQueries: 76 },
    ],
    hourly: [
      { hour: 9, queries: 12, avgResponseTime: 0.8 },
      { hour: 10, queries: 23, avgResponseTime: 1.1 },
      { hour: 11, queries: 34, avgResponseTime: 1.3 },
    ],
    languages: {
      ar: 1234, // Arabic queries
      en: 309,  // English queries
    },
  },
  costs: {
    breakdown: [
      { service: 'OpenRouter API', cost: 89.50, percentage: 70.2 },
      { service: 'Vector Storage', cost: 23.75, percentage: 18.6 },
      { service: 'OCR Processing', cost: 14.25, percentage: 11.2 },
    ],
    trend: [
      { month: '2023-10', cost: 98.20 },
      { month: '2023-11', cost: 112.45 },
      { month: '2023-12', cost: 105.30 },
      { month: '2024-01', cost: 127.50 },
    ],
  },
  popularQueries: [
    {
      query: 'ما هي أحكام الإجازة السنوية؟',
      count: 89,
      successRate: 96.6,
      avgResponseTime: 1.1,
      language: 'ar',
    },
    {
      query: 'كيف يتم حساب مكافأة نهاية الخدمة؟',
      count: 76,
      successRate: 98.7,
      avgResponseTime: 1.3,
      language: 'ar',
    },
    {
      query: 'What are the leave policies?',
      count: 54,
      successRate: 94.4,
      avgResponseTime: 0.9,
      language: 'en',
    },
  ],
  performance: {
    responseTime: {
      p50: 0.8,
      p95: 2.1,
      p99: 3.4,
    },
    errorRate: 1.5,
    availability: 99.8,
    cacheHitRate: 78.3,
    arabicProcessingTime: 1.4,
    englishProcessingTime: 0.9,
  },
};

describe('Analytics API Endpoints', () => {
  let mockSupabaseClient: any;
  let mockAnalyticsService: any;
  let mockValidateAuth: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      data: [],
      error: null,
    };

    const { createServerSupabaseClient } = require('@/libs/supabase/supabase-server-client');
    createServerSupabaseClient.mockResolvedValue(mockSupabaseClient);

    // Mock analytics service
    const { AnalyticsAggregationService } = require('@/libs/services/analytics-aggregation-service');
    mockAnalyticsService = AnalyticsAggregationService.getInstance();
    
    // Mock auth validation
    const { validateAuth } = require('@/libs/auth/auth-middleware');
    mockValidateAuth = validateAuth;
    mockValidateAuth.mockResolvedValue(mockAuthUser);
  });

  describe('Analytics Metrics Endpoint', () => {
    it('should return overview metrics successfully', async () => {
      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockAnalyticsData.overview);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'last30days',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockAnalyticsData.overview);
      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith({
        organizationId: 'org-123',
        dateRange: 'last30days',
        userId: 'user-123',
      });
    });

    it('should handle Arabic date range parameters', async () => {
      mockAnalyticsService.getOverviewMetrics.mockResolvedValue(mockAnalyticsData.overview);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'آخر 30 يوم', // Arabic date range
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAnalyticsService.getOverviewMetrics).toHaveBeenCalledWith({
        organizationId: 'org-123',
        dateRange: 'last30days', // Should be normalized
        userId: 'user-123',
      });
    });

    it('should require authentication', async () => {
      mockValidateAuth.mockRejectedValue(new Error('Unauthorized'));

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'last30days',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate input parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'invalid-range',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid date range');
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.getOverviewMetrics.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'last30days',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Analytics Usage Endpoint', () => {
    it('should return usage data with Arabic language breakdown', async () => {
      mockAnalyticsService.getUsageData.mockResolvedValue(mockAnalyticsData.usage);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/usage?period=daily&organizationId=org-123');

      const response = await analyticsUsage(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.languages.ar).toBe(1234);
      expect(data.data.languages.en).toBe(309);
      expect(data.data.daily).toHaveLength(3);
      
      // Check Arabic query tracking
      expect(data.data.daily[0].arabicQueries).toBe(38);
    });

    it('should filter usage data by language', async () => {
      const arabicOnlyData = {
        ...mockAnalyticsData.usage,
        daily: mockAnalyticsData.usage.daily.map(day => ({
          ...day,
          queries: day.arabicQueries,
        })),
      };

      mockAnalyticsService.getUsageData.mockResolvedValue(arabicOnlyData);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/usage?period=daily&language=ar&organizationId=org-123');

      const response = await analyticsUsage(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAnalyticsService.getUsageData).toHaveBeenCalledWith({
        organizationId: 'org-123',
        period: 'daily',
        language: 'ar',
        userId: 'user-123',
      });
    });

    it('should handle hourly vs daily period correctly', async () => {
      mockAnalyticsService.getUsageData.mockResolvedValue(mockAnalyticsData.usage);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/usage?period=hourly&organizationId=org-123');

      const response = await analyticsUsage(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hourly).toHaveLength(3);
    });
  });

  describe('Analytics Costs Endpoint', () => {
    it('should return cost breakdown and trends', async () => {
      mockAnalyticsService.getCostBreakdown.mockResolvedValue(mockAnalyticsData.costs);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/costs?organizationId=org-123');

      const response = await analyticsCosts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.breakdown).toHaveLength(3);
      expect(data.data.breakdown[0].service).toBe('OpenRouter API');
      expect(data.data.breakdown[0].cost).toBe(89.50);
      expect(data.data.trend).toHaveLength(4);
    });

    it('should calculate cost per language', async () => {
      const costsWithLanguageBreakdown = {
        ...mockAnalyticsData.costs,
        byLanguage: {
          ar: { cost: 89.20, queries: 1234 },
          en: { cost: 38.30, queries: 309 },
        },
      };

      mockAnalyticsService.getCostBreakdown.mockResolvedValue(costsWithLanguageBreakdown);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/costs?includeLanguageBreakdown=true&organizationId=org-123');

      const response = await analyticsCosts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.byLanguage.ar.cost).toBe(89.20);
      expect(data.data.byLanguage.en.cost).toBe(38.30);
    });
  });

  describe('Analytics Export Endpoint', () => {
    it('should export analytics data as CSV', async () => {
      const csvData = 'Date,Queries,Users\n2024-01-01,45,12\n2024-01-02,67,18';
      mockAnalyticsService.exportReport.mockResolvedValue({
        data: csvData,
        filename: 'analytics-report-2024-01.csv',
        contentType: 'text/csv',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'csv',
          dateRange: 'last30days',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsExport(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('analytics-report-2024-01.csv');
      
      const responseText = await response.text();
      expect(responseText).toBe(csvData);
    });

    it('should export analytics data as PDF with Arabic support', async () => {
      const pdfBuffer = Buffer.from('PDF content with Arabic text');
      mockAnalyticsService.exportReport.mockResolvedValue({
        data: pdfBuffer,
        filename: 'تقرير-التحليلات-2024-01.pdf',
        contentType: 'application/pdf',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'pdf',
          dateRange: 'last30days',
          language: 'ar',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsExport(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('تقرير-التحليلات-2024-01.pdf');
    });

    it('should include Arabic queries in Excel export', async () => {
      const excelBuffer = Buffer.from('Excel content');
      mockAnalyticsService.exportReport.mockResolvedValue({
        data: excelBuffer,
        filename: 'analytics-report-2024-01.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/export', {
        method: 'POST',
        body: JSON.stringify({
          format: 'excel',
          dateRange: 'last30days',
          includeArabicQueries: true,
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsExport(request);

      expect(response.status).toBe(200);
      expect(mockAnalyticsService.exportReport).toHaveBeenCalledWith({
        format: 'excel',
        dateRange: 'last30days',
        includeArabicQueries: true,
        organizationId: 'org-123',
        userId: 'user-123',
      });
    });
  });

  describe('Analytics Realtime Endpoint', () => {
    it('should return real-time metrics', async () => {
      const realtimeData = {
        activeUsers: 23,
        queriesPerMinute: 5.2,
        averageResponseTime: 1.1,
        errorRate: 0.8,
        currentLoad: 67.5,
        arabicQueriesPercentage: 78.3,
        lastUpdated: new Date().toISOString(),
      };

      mockAnalyticsService.getRealtimeMetrics.mockResolvedValue(realtimeData);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/realtime?organizationId=org-123');

      const response = await analyticsRealtime(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activeUsers).toBe(23);
      expect(data.data.arabicQueriesPercentage).toBe(78.3);
      expect(data.data.lastUpdated).toBeTruthy();
    });

    it('should include cache headers for real-time data', async () => {
      const realtimeData = {
        activeUsers: 23,
        queriesPerMinute: 5.2,
        lastUpdated: new Date().toISOString(),
      };

      mockAnalyticsService.getRealtimeMetrics.mockResolvedValue(realtimeData);

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/realtime?organizationId=org-123');

      const response = await analyticsRealtime(request);

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing organization ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'last30days',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Organization ID is required');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: 'invalid json{',
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      // Simulate too many requests
      mockValidateAuth.mockRejectedValue(new Error('Rate limit exceeded'));

      const request = new NextRequest('http://localhost:3000/api/v1/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: 'last30days',
          organizationId: 'org-123',
        }),
      });

      const response = await analyticsMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should sanitize Arabic text in query parameters', async () => {
      const maliciousQuery = 'ما هي أحكام <script>alert("xss")</script> الإجازة؟';
      const sanitizedQuery = 'ما هي أحكام  الإجازة؟';

      mockAnalyticsService.getPopularQueries.mockResolvedValue([
        { query: sanitizedQuery, count: 5 }
      ]);

      const request = new NextRequest(`http://localhost:3000/api/v1/analytics/popular-queries?q=${encodeURIComponent(maliciousQuery)}&organizationId=org-123`);

      const response = await response;
      
      expect(mockAnalyticsService.getPopularQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: sanitizedQuery,
        })
      );
    });
  });
});