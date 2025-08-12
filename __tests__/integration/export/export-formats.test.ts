/**
 * Export Formats Integration Tests
 * Tests the complete export workflow for PDF, DOCX, and HTML formats
 */

import request from 'supertest';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Import API routes
import { GET as getExportStatus } from '@/app/api/v1/export/status/[jobId]/route';
import { POST as exportConversation } from '@/app/api/v1/export/conversations/[id]/route';
import { POST as exportAnalytics } from '@/app/api/v1/export/analytics/report/route';
import { POST as bulkExport } from '@/app/api/v1/export/conversations/bulk/route';

// Mock dependencies
jest.mock('@/libs/supabase/supabase-server-client');
jest.mock('@/libs/auth/auth-middleware');
jest.mock('@/libs/services/export-service');
jest.mock('@/libs/export/pdf-generator');
jest.mock('@/libs/export/docx-generator');
jest.mock('@/libs/export/html-generator');

// Test data
const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  organizationId: 'org-123',
  role: 'admin',
};

const arabicConversationData = {
  id: 'conv-001',
  title: 'استفسار عن قانون العمل السعودي',
  userId: 'user-123',
  organizationId: 'org-123',
  messages: [
    {
      id: 'msg-001',
      content: 'ما هي الأحكام المتعلقة بساعات العمل في قانون العمل السعودي؟',
      role: 'user',
      timestamp: '2024-01-15T10:00:00Z',
      language: 'ar',
    },
    {
      id: 'msg-002',
      content: 'وفقاً لقانون العمل السعودي، فإن ساعات العمل الفعلية لا تزيد عن ثمان ساعات في اليوم أو ثمان وأربعين ساعة في الأسبوع. كما يجب ألا تزيد ساعات العمل الفعلية في شهر رمضان عن ست ساعات في اليوم أو ست وثلاثين ساعة في الأسبوع للمسلمين.',
      role: 'assistant',
      timestamp: '2024-01-15T10:00:45Z',
      language: 'ar',
      sources: [
        {
          title: 'قانون العمل السعودي - المادة 98',
          url: 'https://www.mol.gov.sa/labor-law/article-98',
          relevance: 0.95,
        },
        {
          title: 'قانون العمل السعودي - المادة 99',
          url: 'https://www.mol.gov.sa/labor-law/article-99', 
          relevance: 0.88,
        },
      ],
    },
    {
      id: 'msg-003',
      content: 'هل هناك استثناءات لهذه القاعدة؟',
      role: 'user',
      timestamp: '2024-01-15T10:01:30Z',
      language: 'ar',
    },
    {
      id: 'msg-004',
      content: 'نعم، هناك عدة استثناءات:\n\n1. **الأعمال التحضيرية والختامية**: يمكن أن تزيد ساعات العمل للأعمال التحضيرية والختامية\n2. **الحراسة والصيانة**: للعمال في أعمال الحراسة والصيانة\n3. **الخدمات الأساسية**: في الفنادق والمطاعم والمستشفيات\n4. **حالات الطوارئ**: في حالات الطوارئ والظروف الاستثنائية\n\nويجب في جميع الحالات ألا تتجاوز ساعات العمل الإضافية ثلاث ساعات في اليوم.',
      role: 'assistant',
      timestamp: '2024-01-15T10:02:15Z',
      language: 'ar',
      sources: [
        {
          title: 'قانون العمل السعودي - المادة 100',
          url: 'https://www.mol.gov.sa/labor-law/article-100',
          relevance: 0.92,
        },
      ],
    },
  ],
  metadata: {
    startedAt: '2024-01-15T10:00:00Z',
    endedAt: '2024-01-15T10:02:30Z',
    duration: 150000, // 2.5 minutes
    messageCount: 4,
    category: 'legal_consultation',
    tags: ['ساعات العمل', 'قانون العمل', 'استثناءات'],
    language: 'ar',
  },
};

const analyticsReportData = {
  id: 'report-001',
  title: 'تقرير الاستخدام الشهري - يناير 2024',
  organizationId: 'org-123',
  period: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-31T23:59:59Z',
    type: 'monthly',
  },
  data: {
    overview: {
      totalQueries: 2156,
      uniqueUsers: 127,
      averageResponseTime: 1.34,
      successRate: 97.8,
      topicCategories: [
        { name: 'قانون العمل', count: 856, percentage: 39.7 },
        { name: 'الموارد البشرية', count: 643, percentage: 29.8 },
        { name: 'المرتبات والأجور', count: 425, percentage: 19.7 },
        { name: 'الإجازات والغياب', count: 232, percentage: 10.8 },
      ],
    },
    usage: {
      daily: Array.from({ length: 31 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        queries: Math.floor(Math.random() * 100) + 50,
        users: Math.floor(Math.random() * 20) + 10,
      })),
      hourly: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        queries: Math.floor(Math.random() * 50) + 10,
        avgResponseTime: Math.random() * 2 + 0.5,
      })),
      departments: [
        { name: 'الموارد البشرية', queries: 987, users: 45 },
        { name: 'الشؤون القانونية', queries: 654, users: 23 },
        { name: 'الإدارة العامة', queries: 515, users: 59 },
      ],
    },
    performance: {
      responseTimeP95: 2.1,
      responseTimeP99: 3.8,
      errorRate: 2.2,
      cacheHitRate: 76.5,
      topSlowQueries: [
        { query: 'حساب مكافأة نهاية الخدمة للعقود محددة المدة', avgTime: 4.2 },
        { query: 'الإجراءات القانونية لإنهاء عقد العمل', avgTime: 3.9 },
      ],
    },
    costs: {
      total: 2847.50,
      breakdown: [
        { service: 'OpenRouter API', cost: 1823.25, percentage: 64.0 },
        { service: 'Vector Storage', cost: 512.75, percentage: 18.0 },
        { service: 'OCR Processing', cost: 341.50, percentage: 12.0 },
        { service: 'Export Services', cost: 170.00, percentage: 6.0 },
      ],
      trend: [
        { month: '2023-10', cost: 2156.80 },
        { month: '2023-11', cost: 2398.40 },
        { month: '2023-12', cost: 2687.90 },
        { month: '2024-01', cost: 2847.50 },
      ],
    },
    popularQueries: [
      { query: 'ما هي أحكام الإجازة السنوية؟', count: 234, successRate: 98.3 },
      { query: 'كيفية حساب مكافأة نهاية الخدمة', count: 198, successRate: 96.5 },
      { query: 'حقوق العامل عند إنهاء الخدمة', count: 176, successRate: 94.9 },
      { query: 'أحكام العمل الإضافي والأجر الإضافي', count: 154, successRate: 97.4 },
    ],
    languageBreakdown: {
      ar: { queries: 1724, percentage: 80.0 },
      en: { queries: 432, percentage: 20.0 },
    },
  },
  generatedAt: '2024-02-01T08:00:00Z',
  generatedBy: 'user-123',
};

describe('Export Formats Integration Tests', () => {
  let mockSupabase: any;
  let mockAuth: any;
  let mockExportService: any;

  beforeEach(() => {
    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    };

    const { createServerSupabaseClient } = require('@/libs/supabase/supabase-server-client');
    createServerSupabaseClient.mockResolvedValue(mockSupabase);

    // Mock auth
    const { validateAuth } = require('@/libs/auth/auth-middleware');
    mockAuth = validateAuth;
    mockAuth.mockResolvedValue(testUser);

    // Mock export service
    const { ExportService } = require('@/libs/services/export-service');
    mockExportService = {
      exportConversation: jest.fn(),
      exportAnalyticsReport: jest.fn(),
      exportMultipleConversations: jest.fn(),
      getExportStatus: jest.fn(),
    };
    ExportService.getInstance = jest.fn(() => mockExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PDF Export Integration', () => {
    it('should export Arabic conversation to PDF with proper formatting', async () => {
      const pdfBuffer = Buffer.from('Mock PDF content with Arabic text');
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-001',
        filename: 'استفسار-عن-قانون-العمل-السعودي.pdf',
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        metadata: {
          pageCount: 3,
          fileSize: pdfBuffer.length,
          language: 'ar',
          textDirection: 'rtl',
          fonts: ['NotoSansArabic-Regular', 'NotoSansArabic-Bold'],
          generatedAt: new Date().toISOString(),
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          options: {
            includeMetadata: true,
            includeSources: true,
            arabicFont: 'NotoSansArabic-Regular',
            pageSize: 'A4',
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            header: {
              text: 'تقرير المحادثة',
              includeDate: true,
              includePageNumbers: true,
            },
            footer: {
              text: 'نظام الاستشارات القانونية',
              includeTimestamp: true,
            },
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('استفسار-عن-قانون-العمل-السعودي.pdf');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(pdfBuffer);
    });

    it('should export analytics report to PDF with Arabic charts', async () => {
      const pdfBuffer = Buffer.from('Analytics report PDF with Arabic charts');
      
      mockExportService.exportAnalyticsReport.mockResolvedValue({
        success: true,
        jobId: 'job-002',
        filename: 'تقرير-الاستخدام-الشهري-يناير-2024.pdf',
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        metadata: {
          pageCount: 8,
          fileSize: pdfBuffer.length,
          chartCount: 6,
          language: 'ar',
          reportType: 'monthly_usage',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'report-001',
          format: 'pdf',
          options: {
            includeCharts: true,
            chartType: 'mixed',
            arabicLabels: true,
            colorScheme: 'corporate',
            includeRawData: false,
            orientation: 'portrait',
          },
        }),
      });

      const response = await exportAnalytics(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(pdfBuffer);
    });

    it('should handle PDF export with watermarks and security', async () => {
      const securedPdfBuffer = Buffer.from('Secured PDF with watermark');
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-003',
        filename: 'محادثة-سرية.pdf',
        buffer: securedPdfBuffer,
        contentType: 'application/pdf',
        metadata: {
          pageCount: 3,
          secured: true,
          watermark: true,
          permissions: ['print', 'copy_disabled'],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          options: {
            security: {
              watermark: 'سري ومحدود التداول',
              password: 'secure123',
              permissions: {
                printing: true,
                copying: false,
                editing: false,
                commenting: false,
              },
            },
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(mockExportService.exportConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-001' }),
        expect.objectContaining({
          format: 'pdf',
          options: expect.objectContaining({
            security: expect.objectContaining({
              watermark: 'سري ومحدود التداول',
            }),
          }),
        })
      );
    });
  });

  describe('DOCX Export Integration', () => {
    it('should export Arabic conversation to DOCX with RTL formatting', async () => {
      const docxBuffer = Buffer.from('Mock DOCX content with Arabic RTL formatting');
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-004',
        filename: 'استفسار-عن-قانون-العمل-السعودي.docx',
        buffer: docxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: {
          wordCount: 485,
          pageCount: 3,
          fileSize: docxBuffer.length,
          language: 'ar',
          textDirection: 'rtl',
          stylesUsed: ['Heading1_Arabic', 'Normal_Arabic', 'Quote_Arabic'],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'docx',
          options: {
            textDirection: 'rtl',
            arabicFont: 'Traditional Arabic',
            fontSize: 12,
            lineSpacing: 1.5,
            includeTimestamps: true,
            includeSources: true,
            pageNumbers: true,
            arabicPageNumbers: true,
            header: 'محادثة نظام الاستشارات القانونية',
            footer: 'تم إنشاؤه في {date}',
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(response.headers.get('Content-Disposition')).toContain('استفسار-عن-قانون-العمل-السعودي.docx');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(docxBuffer);
    });

    it('should export analytics report to DOCX with tables and charts', async () => {
      const docxBuffer = Buffer.from('Analytics DOCX with tables and embedded charts');
      
      mockExportService.exportAnalyticsReport.mockResolvedValue({
        success: true,
        jobId: 'job-005',
        filename: 'تقرير-الاستخدام-الشهري-يناير-2024.docx',
        buffer: docxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: {
          wordCount: 1250,
          pageCount: 12,
          tableCount: 8,
          chartCount: 6,
          language: 'ar',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'report-001',
          format: 'docx',
          options: {
            includeCharts: true,
            chartFormat: 'embedded',
            includeRawDataTables: true,
            tableStyle: 'arabic-professional',
            documentStyle: 'corporate-arabic',
          },
        }),
      });

      const response = await exportAnalytics(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should handle DOCX export with custom templates', async () => {
      const customTemplateDocx = Buffer.from('Custom template DOCX');
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-006',
        filename: 'محادثة-قالب-مخصص.docx',
        buffer: customTemplateDocx,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: {
          templateUsed: 'corporate-arabic-v2',
          customizations: ['logo', 'colors', 'fonts'],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'docx',
          template: {
            id: 'corporate-arabic-v2',
            customizations: {
              logo: 'https://example.com/logo.png',
              primaryColor: '#1976d2',
              secondaryColor: '#424242',
              arabicFont: 'Amiri',
            },
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(mockExportService.exportConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-001' }),
        expect.objectContaining({
          template: expect.objectContaining({
            id: 'corporate-arabic-v2',
          }),
        })
      );
    });
  });

  describe('HTML Export Integration', () => {
    it('should export Arabic conversation to HTML with RTL CSS', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>استفسار عن قانون العمل السعودي</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
              direction: rtl; 
              text-align: right;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
            }
            .conversation {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              border-radius: 8px;
              padding: 20px;
            }
            .message {
              margin: 15px 0;
              padding: 15px;
              border-radius: 8px;
              border-right: 4px solid #ddd;
            }
            .user-message {
              background: #f8f9fa;
              border-right-color: #007bff;
            }
            .assistant-message {
              background: #e8f4f8;
              border-right-color: #17a2b8;
            }
            .timestamp {
              font-size: 0.8em;
              color: #666;
              margin-bottom: 5px;
            }
            .sources {
              margin-top: 10px;
              padding: 10px;
              background: #fff3cd;
              border-radius: 4px;
              border-right: 3px solid #ffc107;
            }
            @media print {
              body { background: white; }
              .conversation { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="conversation">
            <h1>استفسار عن قانون العمل السعودي</h1>
            <!-- Conversation messages would be rendered here -->
          </div>
        </body>
        </html>
      `;
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-007',
        filename: 'استفسار-عن-قانون-العمل-السعودي.html',
        content: htmlContent,
        contentType: 'text/html; charset=utf-8',
        metadata: {
          fileSize: htmlContent.length,
          messageCount: 4,
          language: 'ar',
          rtlSupported: true,
          printOptimized: true,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'html',
          options: {
            includeCSS: true,
            rtlSupport: true,
            responsive: true,
            printOptimized: true,
            theme: 'light',
            includeMetadata: true,
            includeSources: true,
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toContain('استفسار-عن-قانون-العمل-السعودي.html');
      
      const responseText = await response.text();
      expect(responseText).toContain('dir="rtl"');
      expect(responseText).toContain('lang="ar"');
      expect(responseText).toContain('direction: rtl');
    });

    it('should export analytics report to HTML with interactive charts', async () => {
      const interactiveHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الاستخدام الشهري - يناير 2024</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; }
            .chart-container { position: relative; height: 400px; margin: 20px 0; }
            .metric-card { 
              background: white; 
              border-radius: 8px; 
              padding: 20px; 
              margin: 10px; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            }
          </style>
        </head>
        <body>
          <div class="report">
            <h1>تقرير الاستخدام الشهري - يناير 2024</h1>
            <div class="chart-container">
              <canvas id="usageChart"></canvas>
            </div>
            <script>
              // Chart.js configuration for RTL Arabic charts
              Chart.defaults.font.family = "'Segoe UI', Arial, sans-serif";
              Chart.defaults.font.size = 12;
              // Chart initialization code would be here
            </script>
          </div>
        </body>
        </html>
      `;
      
      mockExportService.exportAnalyticsReport.mockResolvedValue({
        success: true,
        jobId: 'job-008',
        filename: 'تقرير-الاستخدام-الشهري-يناير-2024.html',
        content: interactiveHtml,
        contentType: 'text/html; charset=utf-8',
        metadata: {
          fileSize: interactiveHtml.length,
          interactive: true,
          chartCount: 5,
          language: 'ar',
          libraries: ['chartjs'],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'report-001',
          format: 'html',
          options: {
            interactive: true,
            includeCharts: true,
            chartLibrary: 'chartjs',
            arabicLabels: true,
            responsive: true,
            includeRawData: false,
          },
        }),
      });

      const response = await exportAnalytics(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      
      const responseText = await response.text();
      expect(responseText).toContain('chart.js');
      expect(responseText).toContain('usageChart');
    });

    it('should export HTML with embedded images and assets', async () => {
      const htmlWithAssets = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير مع الصور والرسوم البيانية</title>
        </head>
        <body>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" alt="Chart">
        </body>
        </html>
      `;
      
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockResolvedValue({
        success: true,
        jobId: 'job-009',
        filename: 'محادثة-مع-الصور.html',
        content: htmlWithAssets,
        contentType: 'text/html; charset=utf-8',
        metadata: {
          embeddedAssets: true,
          assetCount: 3,
          totalSize: htmlWithAssets.length,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'html',
          options: {
            embedAssets: true,
            includeImages: true,
            optimizeSize: false,
          },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });

      expect(response.status).toBe(200);
      expect(mockExportService.exportConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-001' }),
        expect.objectContaining({
          options: expect.objectContaining({
            embedAssets: true,
          }),
        })
      );
    });
  });

  describe('Bulk Export Integration', () => {
    it('should export multiple conversations as ZIP archive', async () => {
      const zipBuffer = Buffer.from('ZIP archive with multiple conversations');
      
      const conversations = [
        arabicConversationData,
        { ...arabicConversationData, id: 'conv-002', title: 'استفسار آخر' },
        { ...arabicConversationData, id: 'conv-003', title: 'سؤال ثالث' },
      ];

      mockSupabase.data = conversations;
      
      mockExportService.exportMultipleConversations.mockResolvedValue({
        success: true,
        jobId: 'job-010',
        filename: 'محادثات-متعددة-يناير-2024.zip',
        buffer: zipBuffer,
        contentType: 'application/zip',
        metadata: {
          fileCount: 3,
          totalSize: zipBuffer.length,
          format: 'pdf',
          archiveFormat: 'zip',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationIds: ['conv-001', 'conv-002', 'conv-003'],
          format: 'pdf',
          archiveFormat: 'zip',
          options: {
            includeMetadata: true,
            arabicFont: 'NotoSansArabic-Regular',
            organizationBranding: true,
          },
        }),
      });

      const response = await bulkExport(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/zip');
      expect(response.headers.get('Content-Disposition')).toContain('محادثات-متعددة-يناير-2024.zip');
      
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(zipBuffer);
    });

    it('should handle mixed format bulk export', async () => {
      const mixedZipBuffer = Buffer.from('Mixed format ZIP archive');
      
      mockExportService.exportMultipleConversations.mockResolvedValue({
        success: true,
        jobId: 'job-011',
        filename: 'تصدير-متنوع-الصيغ.zip',
        buffer: mixedZipBuffer,
        contentType: 'application/zip',
        metadata: {
          fileCount: 6, // 2 conversations × 3 formats each
          formats: ['pdf', 'docx', 'html'],
          totalSize: mixedZipBuffer.length,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationIds: ['conv-001', 'conv-002'],
          formats: ['pdf', 'docx', 'html'],
          archiveFormat: 'zip',
          options: {
            separateByFormat: true,
            includeManifest: true,
          },
        }),
      });

      const response = await bulkExport(request);

      expect(response.status).toBe(200);
      expect(mockExportService.exportMultipleConversations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'conv-001' }),
          expect.objectContaining({ id: 'conv-002' }),
        ]),
        expect.objectContaining({
          formats: ['pdf', 'docx', 'html'],
        })
      );
    });
  });

  describe('Export Status and Job Management', () => {
    it('should track export job status and progress', async () => {
      const jobStatus = {
        id: 'job-012',
        status: 'processing',
        progress: 65,
        startedAt: '2024-01-15T10:00:00Z',
        estimatedCompletion: '2024-01-15T10:02:30Z',
        metadata: {
          conversationId: 'conv-001',
          format: 'pdf',
          fileSize: null,
          error: null,
        },
      };

      mockExportService.getExportStatus.mockResolvedValue({
        success: true,
        job: jobStatus,
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/status/job-012');

      const response = await getExportStatus(request, { params: { jobId: 'job-012' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.job.status).toBe('processing');
      expect(data.job.progress).toBe(65);
    });

    it('should return completed export job with download URL', async () => {
      const completedJob = {
        id: 'job-013',
        status: 'completed',
        progress: 100,
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:02:15Z',
        downloadUrl: '/api/v1/export/download/job-013',
        metadata: {
          conversationId: 'conv-001',
          format: 'pdf',
          filename: 'محادثة-مكتملة.pdf',
          fileSize: 245760,
          error: null,
        },
      };

      mockExportService.getExportStatus.mockResolvedValue({
        success: true,
        job: completedJob,
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/status/job-013');

      const response = await getExportStatus(request, { params: { jobId: 'job-013' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.job.status).toBe('completed');
      expect(data.job.downloadUrl).toBe('/api/v1/export/download/job-013');
      expect(data.job.metadata.filename).toBe('محادثة-مكتملة.pdf');
    });

    it('should handle export job errors', async () => {
      const failedJob = {
        id: 'job-014',
        status: 'failed',
        progress: 45,
        startedAt: '2024-01-15T10:00:00Z',
        failedAt: '2024-01-15T10:01:30Z',
        metadata: {
          conversationId: 'conv-001',
          format: 'pdf',
          error: 'Arabic font loading failed',
          errorCode: 'FONT_LOAD_ERROR',
        },
      };

      mockExportService.getExportStatus.mockResolvedValue({
        success: true,
        job: failedJob,
      });

      const request = new NextRequest('http://localhost:3000/api/v1/export/status/job-014');

      const response = await getExportStatus(request, { params: { jobId: 'job-014' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.job.status).toBe('failed');
      expect(data.job.metadata.error).toBe('Arabic font loading failed');
      expect(data.job.metadata.errorCode).toBe('FONT_LOAD_ERROR');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle conversation not found errors', async () => {
      mockSupabase.data = null;
      mockSupabase.error = null;

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/non-existent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
        }),
      });

      const response = await exportConversation(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Conversation not found');
    });

    it('should handle unsupported export format errors', async () => {
      mockSupabase.data = arabicConversationData;

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'unsupported-format',
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unsupported export format');
    });

    it('should handle export timeout errors', async () => {
      mockSupabase.data = arabicConversationData;
      
      mockExportService.exportConversation.mockRejectedValue(
        new Error('Export timeout exceeded')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          options: { timeout: 30000 },
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Export timeout exceeded');
    });

    it('should handle Arabic text encoding issues', async () => {
      const corruptedConversation = {
        ...arabicConversationData,
        messages: [
          {
            ...arabicConversationData.messages[0],
            content: 'Corrupted Arabic: \uFFFD\uFFFD\uFFFD',
          },
        ],
      };

      mockSupabase.data = corruptedConversation;
      
      mockExportService.exportConversation.mockRejectedValue(
        new Error('Text encoding error: Invalid Arabic characters detected')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/export/conversations/conv-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
        }),
      });

      const response = await exportConversation(request, { params: { id: 'conv-001' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Text encoding error');
    });
  });
});