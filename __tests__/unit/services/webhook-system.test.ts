/**
 * Webhook System Unit Tests
 * Tests for webhook delivery, retry logic, and monitoring with Arabic content support
 */

import { WebhookService } from '@/libs/services/webhook-service';
import { WebhookDeliveryService } from '@/libs/services/webhook-delivery-service';
import { WebhookMonitoringService } from '@/libs/services/webhook-monitoring-service';

// Mock dependencies
jest.mock('@/libs/supabase/supabase-server-client');
jest.mock('@/libs/logging/structured-logger');
jest.mock('node-cron');

// Mock data for webhook testing
const webhookTestData = {
  webhooks: [
    {
      id: 'webhook-001',
      organizationId: 'org-123',
      name: 'تقرير الاستخدام اليومي',
      url: 'https://example.com/api/webhooks/usage-report',
      events: ['daily_usage_report', 'query_completed'],
      isActive: true,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
      },
      headers: {
        'Authorization': 'Bearer webhook-token-123',
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'hr-platform',
      },
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'webhook-002',
      organizationId: 'org-123',
      name: 'تنبيهات الأمان',
      url: 'https://security.example.com/webhooks/alerts',
      events: ['security_alert', 'suspicious_activity'],
      isActive: true,
      retryConfig: {
        maxRetries: 5,
        retryDelay: 500,
        backoffMultiplier: 1.5,
      },
    },
  ],

  events: [
    {
      id: 'event-001',
      type: 'query_completed',
      payload: {
        queryId: 'query-123',
        query: 'ما هي أحكام الإجازة السنوية؟',
        response: 'وفقاً لقانون العمل السعودي، يحق للعامل...',
        userId: 'user-123',
        organizationId: 'org-123',
        language: 'ar',
        processingTime: 1250,
        sources: [
          {
            title: 'قانون العمل السعودي - المادة 109',
            url: 'https://mol.gov.sa/labor-law/article-109',
          },
        ],
        metadata: {
          category: 'legal_query',
          satisfaction: 4.5,
          responseTime: 1.25,
        },
        timestamp: '2024-01-15T10:30:00Z',
      },
    },
    {
      id: 'event-002', 
      type: 'daily_usage_report',
      payload: {
        date: '2024-01-15',
        organizationId: 'org-123',
        metrics: {
          totalQueries: 89,
          uniqueUsers: 23,
          averageResponseTime: 1.34,
          topQueries: [
            'أحكام الإجازة السنوية',
            'حساب مكافأة نهاية الخدمة',
            'حقوق العامل عند الإنهاء',
          ],
          languageBreakdown: {
            ar: 72,
            en: 17,
          },
        },
        timestamp: '2024-01-16T00:00:00Z',
      },
    },
    {
      id: 'event-003',
      type: 'security_alert',
      payload: {
        alertType: 'unusual_activity',
        severity: 'medium',
        description: 'استعلامات متعددة من نفس IP في فترة قصيرة',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        queriesCount: 45,
        timeWindow: '10 minutes',
        organizationId: 'org-123',
        timestamp: '2024-01-15T14:25:00Z',
      },
    },
  ],

  deliveryAttempts: [
    {
      id: 'attempt-001',
      webhookId: 'webhook-001',
      eventId: 'event-001',
      url: 'https://example.com/api/webhooks/usage-report',
      status: 'success',
      statusCode: 200,
      responseTime: 245,
      attempt: 1,
      timestamp: '2024-01-15T10:30:05Z',
      response: {
        body: '{"status": "received", "id": "rcv-123"}',
        headers: {
          'content-type': 'application/json',
          'x-response-id': 'rcv-123',
        },
      },
    },
    {
      id: 'attempt-002',
      webhookId: 'webhook-002',
      eventId: 'event-003',
      url: 'https://security.example.com/webhooks/alerts',
      status: 'failed',
      statusCode: 503,
      responseTime: 5000,
      attempt: 1,
      timestamp: '2024-01-15T14:25:05Z',
      error: 'Service Unavailable',
      response: {
        body: '{"error": "Service temporarily unavailable"}',
        headers: {
          'content-type': 'application/json',
        },
      },
    },
  ],
};

describe('Webhook Service', () => {
  let webhookService: WebhookService;
  let mockSupabaseClient: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
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

    webhookService = new WebhookService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Registration and Management', () => {
    it('should register a new webhook with Arabic metadata', async () => {
      mockSupabaseClient.data = webhookTestData.webhooks[0];

      const webhookConfig = {
        name: 'تقرير الاستخدام اليومي',
        url: 'https://example.com/api/webhooks/usage-report',
        events: ['daily_usage_report', 'query_completed'],
        organizationId: 'org-123',
        description: 'يرسل تقرير يومي عن استخدام النظام',
        headers: {
          'Authorization': 'Bearer webhook-token-123',
        },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
        },
      };

      const result = await webhookService.registerWebhook(webhookConfig);

      expect(result.success).toBe(true);
      expect(result.webhook.id).toBe('webhook-001');
      expect(result.webhook.name).toBe('تقرير الاستخدام اليومي');
      expect(result.webhook.events).toContain('daily_usage_report');

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'تقرير الاستخدام اليومي',
        url: 'https://example.com/api/webhooks/usage-report',
        events: ['daily_usage_report', 'query_completed'],
        organization_id: 'org-123',
        description: 'يرسل تقرير يومي عن استخدام النظام',
        headers: expect.any(Object),
        retry_config: expect.any(Object),
        is_active: true,
      });
    });

    it('should validate webhook URL and configuration', async () => {
      const invalidConfig = {
        name: '',
        url: 'invalid-url',
        events: [],
        organizationId: 'org-123',
      };

      const result = await webhookService.registerWebhook(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Webhook name is required',
      });
      expect(result.errors).toContainEqual({
        field: 'url',
        message: 'Invalid webhook URL format',
      });
      expect(result.errors).toContainEqual({
        field: 'events',
        message: 'At least one event type must be specified',
      });
    });

    it('should update webhook configuration', async () => {
      const updatedWebhook = {
        ...webhookTestData.webhooks[0],
        name: 'تقرير الاستخدام المحدث',
        events: [...webhookTestData.webhooks[0].events, 'user_feedback'],
        updatedAt: new Date().toISOString(),
      };

      mockSupabaseClient.data = updatedWebhook;

      const result = await webhookService.updateWebhook('webhook-001', {
        name: 'تقرير الاستخدام المحدث',
        events: ['daily_usage_report', 'query_completed', 'user_feedback'],
      });

      expect(result.success).toBe(true);
      expect(result.webhook.name).toBe('تقرير الاستخدام المحدث');
      expect(result.webhook.events).toContain('user_feedback');

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'تقرير الاستخدام المحدث',
        events: ['daily_usage_report', 'query_completed', 'user_feedback'],
        updated_at: expect.any(String),
      });
    });

    it('should test webhook endpoint connectivity', async () => {
      // Mock fetch for webhook testing
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/json',
        }),
        json: () => Promise.resolve({ status: 'ok' }),
      });

      const result = await webhookService.testWebhook('webhook-001', {
        testPayload: {
          type: 'webhook_test',
          message: 'اختبار الاتصال',
          timestamp: new Date().toISOString(),
        },
      });

      expect(result.success).toBe(true);
      expect(result.response.status).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/webhooks/usage-report',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('اختبار الاتصال'),
        })
      );
    });
  });

  describe('Event Triggering and Processing', () => {
    it('should trigger webhooks for matching events', async () => {
      mockSupabaseClient.data = webhookTestData.webhooks.filter(w => 
        w.events.includes('query_completed')
      );

      const event = webhookTestData.events[0]; // query_completed event

      const result = await webhookService.triggerEvent(event.type, event.payload);

      expect(result.success).toBe(true);
      expect(result.triggeredWebhooks).toHaveLength(1);
      expect(result.triggeredWebhooks[0]).toBe('webhook-001');

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook event triggered',
        expect.objectContaining({
          eventType: 'query_completed',
          webhookCount: 1,
        })
      );
    });

    it('should handle Arabic content in event payloads', async () => {
      mockSupabaseClient.data = [webhookTestData.webhooks[0]];

      const arabicEvent = {
        type: 'query_completed',
        payload: {
          query: 'ما هي أحكام الإجازة السنوية؟',
          response: 'وفقاً لقانون العمل السعودي، يحق للعامل الحصول على إجازة سنوية...',
          language: 'ar',
          metadata: {
            category: 'استفسار قانوني',
            responseQuality: 'ممتاز',
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ received: true }),
      });

      const result = await webhookService.triggerEvent(arabicEvent.type, arabicEvent.payload);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('ما هي أحكام الإجازة السنوية'),
        })
      );
    });

    it('should batch multiple events for efficiency', async () => {
      const events = webhookTestData.events.slice(0, 2);
      mockSupabaseClient.data = [webhookTestData.webhooks[0]];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ received: true }),
      });

      const result = await webhookService.batchTriggerEvents(events, {
        batchSize: 10,
        delayBetweenBatches: 100,
      });

      expect(result.success).toBe(true);
      expect(result.processedEvents).toBe(2);
      expect(result.successfulDeliveries).toBeGreaterThan(0);
    });
  });
});

describe('Webhook Delivery Service', () => {
  let deliveryService: WebhookDeliveryService;
  let mockLogger: any;

  beforeEach(() => {
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    deliveryService = new WebhookDeliveryService();
  });

  describe('Delivery Attempts and Retry Logic', () => {
    it('should deliver webhook successfully on first attempt', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'received' }),
      });

      const webhook = webhookTestData.webhooks[0];
      const event = webhookTestData.events[0];

      const result = await deliveryService.deliverWebhook(webhook, event);

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(1);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);

      expect(global.fetch).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer webhook-token-123',
          }),
        })
      );
    });

    it('should retry failed deliveries with exponential backoff', async () => {
      // Mock failed attempts followed by success
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ status: 'received' }),
        });

      const webhook = webhookTestData.webhooks[0];
      const event = webhookTestData.events[0];

      const result = await deliveryService.deliverWebhookWithRetry(webhook, event);

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
      expect(result.finalStatusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify exponential backoff delays were applied
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Webhook delivery failed, retrying',
        expect.objectContaining({
          attempt: 1,
          nextRetryIn: 1000,
        })
      );
    });

    it('should handle permanent failures after max retries', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const webhook = webhookTestData.webhooks[0];
      const event = webhookTestData.events[0];

      const result = await deliveryService.deliverWebhookWithRetry(webhook, event);

      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(webhook.retryConfig.maxRetries + 1);
      expect(result.finalStatusCode).toBe(404);
      expect(result.permanentFailure).toBe(true);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery permanently failed',
        expect.objectContaining({
          webhookId: webhook.id,
          maxRetriesExceeded: true,
        })
      );
    });

    it('should handle timeout and network errors', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'received' }),
        });

      const webhook = webhookTestData.webhooks[0];
      const event = webhookTestData.events[0];

      const result = await deliveryService.deliverWebhookWithRetry(webhook, event, {
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
      expect(result.networkErrors).toBe(2);
    });

    it('should validate webhook signatures', async () => {
      const webhook = {
        ...webhookTestData.webhooks[0],
        secret: 'webhook-secret-key',
        signatureHeader: 'X-Webhook-Signature',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'received' }),
      });

      const event = webhookTestData.events[0];

      const result = await deliveryService.deliverWebhook(webhook, event, {
        includeSignature: true,
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^sha256=/),
          }),
        })
      );
    });
  });

  describe('Delivery Queue Management', () => {
    it('should queue failed deliveries for retry', async () => {
      const failedDelivery = {
        webhookId: 'webhook-001',
        eventId: 'event-001',
        attempt: 1,
        nextRetryAt: new Date(Date.now() + 5000).toISOString(),
        status: 'queued_for_retry',
      };

      const result = await deliveryService.queueForRetry(failedDelivery);

      expect(result.success).toBe(true);
      expect(result.queuePosition).toBeGreaterThan(0);
      expect(result.estimatedRetryTime).toBeTruthy();
    });

    it('should process retry queue in order', async () => {
      const queuedDeliveries = [
        {
          id: 'retry-001',
          webhookId: 'webhook-001',
          eventId: 'event-001',
          nextRetryAt: new Date(Date.now() - 1000).toISOString(),
        },
        {
          id: 'retry-002',
          webhookId: 'webhook-002',
          eventId: 'event-002',
          nextRetryAt: new Date(Date.now() - 500).toISOString(),
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'received' }),
      });

      const result = await deliveryService.processRetryQueue(queuedDeliveries);

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should prioritize high-priority webhooks', async () => {
      const webhooks = [
        {
          ...webhookTestData.webhooks[0],
          priority: 'low',
        },
        {
          ...webhookTestData.webhooks[1],
          priority: 'high',
        },
      ];

      const event = webhookTestData.events[2]; // security_alert

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'received' }),
      });

      const result = await deliveryService.deliverToMultipleWebhooks(webhooks, event);

      expect(result.deliveryOrder[0].priority).toBe('high');
      expect(result.deliveryOrder[1].priority).toBe('low');
    });
  });
});

describe('Webhook Monitoring Service', () => {
  let monitoringService: WebhookMonitoringService;
  let mockSupabaseClient: any;
  let mockLogger: any;
  let mockCron: any;

  beforeEach(() => {
    // Mock Supabase
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
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
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    // Mock cron
    const cron = require('node-cron');
    mockCron = {
      schedule: jest.fn(),
      destroy: jest.fn(),
    };
    cron.schedule = mockCron.schedule;

    monitoringService = new WebhookMonitoringService();
  });

  describe('Performance Monitoring', () => {
    it('should track webhook delivery metrics', async () => {
      const deliveryMetrics = {
        webhookId: 'webhook-001',
        period: 'last24hours',
        totalDeliveries: 156,
        successfulDeliveries: 148,
        failedDeliveries: 8,
        averageResponseTime: 245,
        successRate: 94.9,
        errorBreakdown: {
          '500': 3,
          '503': 2,
          'timeout': 2,
          'network_error': 1,
        },
      };

      mockSupabaseClient.data = deliveryMetrics;

      const result = await monitoringService.getWebhookMetrics('webhook-001', {
        period: 'last24hours',
        includeErrorBreakdown: true,
      });

      expect(result.success).toBe(true);
      expect(result.metrics.successRate).toBe(94.9);
      expect(result.metrics.errorBreakdown['500']).toBe(3);
    });

    it('should detect performance degradation', async () => {
      const performanceData = [
        { timestamp: '2024-01-15T10:00:00Z', responseTime: 250, successRate: 98.5 },
        { timestamp: '2024-01-15T11:00:00Z', responseTime: 280, successRate: 96.2 },
        { timestamp: '2024-01-15T12:00:00Z', responseTime: 450, successRate: 87.1 },
        { timestamp: '2024-01-15T13:00:00Z', responseTime: 850, successRate: 72.3 },
      ];

      mockSupabaseClient.data = performanceData;

      const result = await monitoringService.analyzePerformanceTrend('webhook-001', {
        period: 'last4hours',
        alertThresholds: {
          responseTime: 500,
          successRate: 90.0,
        },
      });

      expect(result.degradationDetected).toBe(true);
      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'response_time_high',
          threshold: 500,
          currentValue: 850,
        })
      );
      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'success_rate_low',
          threshold: 90.0,
          currentValue: 72.3,
        })
      );
    });

    it('should monitor Arabic content delivery', async () => {
      const arabicDeliveryStats = {
        totalArabicEvents: 89,
        successfulArabicDeliveries: 84,
        arabicContentErrors: [
          {
            error: 'encoding_issue',
            count: 3,
            description: 'مشاكل في تشفير النص العربي',
          },
          {
            error: 'rtl_formatting',
            count: 2,
            description: 'مشاكل في تنسيق النص من اليمين لليسار',
          },
        ],
        averageArabicContentSize: 1250,
      };

      mockSupabaseClient.data = arabicDeliveryStats;

      const result = await monitoringService.getArabicContentMetrics('webhook-001', {
        period: 'last7days',
      });

      expect(result.success).toBe(true);
      expect(result.arabicContentErrors).toHaveLength(2);
      expect(result.arabicContentErrors[0].description).toContain('تشفير النص العربي');
    });
  });

  describe('Health Monitoring and Alerts', () => {
    it('should check webhook endpoint health', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const result = await monitoringService.checkWebhookHealth('webhook-001');

      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Webhook-Health-Check'),
          }),
        })
      );
    });

    it('should generate health reports with Arabic descriptions', async () => {
      const healthData = {
        webhookId: 'webhook-001',
        name: 'تقرير الاستخدام اليومي',
        status: 'degraded',
        issues: [
          {
            severity: 'warning',
            description: 'زمن الاستجابة أعلى من المعتاد',
            metric: 'response_time',
            currentValue: 850,
            threshold: 500,
          },
          {
            severity: 'info',
            description: 'انخفاض طفيف في معدل النجاح',
            metric: 'success_rate',
            currentValue: 92.1,
            threshold: 95.0,
          },
        ],
        lastHealthyAt: '2024-01-15T08:30:00Z',
        recommendations: [
          'فحص أداء الخادم المستقبل',
          'مراجعة حجم البيانات المرسلة',
          'التحقق من اتصال الشبكة',
        ],
      };

      mockSupabaseClient.data = healthData;

      const result = await monitoringService.generateHealthReport('webhook-001');

      expect(result.success).toBe(true);
      expect(result.report.status).toBe('degraded');
      expect(result.report.issues).toHaveLength(2);
      expect(result.report.recommendations).toContain('فحص أداء الخادم المستقبل');
    });

    it('should schedule periodic health checks', async () => {
      const webhooks = webhookTestData.webhooks;
      mockSupabaseClient.data = webhooks;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await monitoringService.scheduleHealthChecks({
        interval: '*/5 * * * *', // Every 5 minutes
        webhookIds: ['webhook-001', 'webhook-002'],
      });

      expect(mockCron.schedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: true,
        })
      );
    });

    it('should send alerts for critical failures', async () => {
      const criticalFailure = {
        webhookId: 'webhook-002',
        name: 'تنبيهات الأمان',
        alertType: 'critical_failure',
        consecutiveFailures: 5,
        lastSuccessAt: '2024-01-15T10:00:00Z',
        errorDetails: {
          statusCode: 500,
          error: 'Internal Server Error',
          responseTime: null,
        },
        impactAssessment: {
          affectedEvents: ['security_alert', 'suspicious_activity'],
          potentialDataLoss: false,
          businessImpact: 'high',
        },
      };

      const result = await monitoringService.handleCriticalFailure(criticalFailure);

      expect(result.alertSent).toBe(true);
      expect(result.escalationLevel).toBe('immediate');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical webhook failure detected',
        expect.objectContaining({
          webhookId: 'webhook-002',
          consecutiveFailures: 5,
          businessImpact: 'high',
        })
      );
    });
  });

  describe('Analytics and Reporting', () => {
    it('should generate comprehensive webhook analytics', async () => {
      const analyticsData = {
        organizationId: 'org-123',
        period: 'last30days',
        totalWebhooks: 5,
        activeWebhooks: 4,
        totalEvents: 2847,
        totalDeliveries: 2834,
        overallSuccessRate: 96.2,
        averageResponseTime: 285,
        topPerformingWebhooks: [
          {
            id: 'webhook-001',
            name: 'تقرير الاستخدام اليومي',
            successRate: 98.5,
            avgResponseTime: 210,
          },
        ],
        eventTypeBreakdown: {
          'query_completed': 1256,
          'daily_usage_report': 30,
          'security_alert': 12,
        },
        errorAnalysis: {
          most_common_errors: [
            { error: '503 Service Unavailable', count: 45 },
            { error: 'timeout', count: 23 },
          ],
          error_trends: 'decreasing',
        },
      };

      mockSupabaseClient.data = analyticsData;

      const result = await monitoringService.generateAnalyticsReport('org-123', {
        period: 'last30days',
        includeErrorAnalysis: true,
        includePerformanceMetrics: true,
      });

      expect(result.success).toBe(true);
      expect(result.analytics.overallSuccessRate).toBe(96.2);
      expect(result.analytics.topPerformingWebhooks).toHaveLength(1);
      expect(result.analytics.errorAnalysis.error_trends).toBe('decreasing');
    });

    it('should track delivery patterns and optimization suggestions', async () => {
      const deliveryPatterns = {
        peakHours: [9, 10, 14, 15], // Hours with highest delivery volume
        averageDeliveryVolume: {
          hourly: 45,
          daily: 1080,
          weekly: 7560,
        },
        retryPatterns: {
          averageRetriesPerFailure: 2.3,
          mostRetryProneTimes: ['08:00-09:00', '17:00-18:00'],
          retrySuccessRate: 67.8,
        },
        optimizationSuggestions: [
          'تقليل تكرار الإرسال خلال ساعات الذروة',
          'زيادة المهلة الزمنية للطلبات المعقدة',
          'تجميع الأحداث المتعددة في طلب واحد',
        ],
      };

      mockSupabaseClient.data = deliveryPatterns;

      const result = await monitoringService.analyzeDeliveryPatterns('org-123', {
        period: 'last30days',
        includeOptimizationSuggestions: true,
      });

      expect(result.success).toBe(true);
      expect(result.patterns.peakHours).toContain(9);
      expect(result.patterns.optimizationSuggestions).toHaveLength(3);
      expect(result.patterns.optimizationSuggestions[0]).toContain('ساعات الذروة');
    });
  });
});