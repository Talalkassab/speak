/**
 * Export System Unit Tests
 * Tests for PDF, DOCX, and HTML export functionality with Arabic content support
 */

import { ExportService } from '@/libs/services/export-service';
import { PDFGenerator } from '@/libs/export/pdf-generator';
import { DOCXGenerator } from '@/libs/export/docx-generator';
import { HTMLGenerator } from '@/libs/export/html-generator';

// Mock dependencies
jest.mock('@/libs/export/pdf-generator');
jest.mock('@/libs/export/docx-generator');
jest.mock('@/libs/export/html-generator');
jest.mock('@/libs/logging/structured-logger');

// Mock data for testing
const arabicExportTestData = {
  conversations: [
    {
      id: 'conv-001',
      title: 'استفسار عن قانون العمل',
      messages: [
        {
          id: 'msg-001',
          content: 'ما هي أحكام الإجازة السنوية في قانون العمل السعودي؟',
          role: 'user',
          timestamp: '2024-01-15T10:00:00Z',
          language: 'ar',
        },
        {
          id: 'msg-002',
          content: 'وفقاً لقانون العمل السعودي، يحق للعامل الحصول على إجازة سنوية مدفوعة الأجر لا تقل عن 21 يوماً للعاملين الذين أمضوا سنة كاملة في الخدمة. كما يمكن زيادة هذه المدة حسب عقد العمل أو سياسة الشركة.',
          role: 'assistant',
          timestamp: '2024-01-15T10:00:30Z',
          language: 'ar',
          sources: [
            {
              title: 'قانون العمل السعودي - المادة 109',
              url: 'https://www.mol.gov.sa/labor-law/article-109',
              relevance: 0.95,
            },
          ],
        },
        {
          id: 'msg-003',
          content: 'هل يمكن تجميع الإجازة السنوية لأكثر من سنة؟',
          role: 'user',
          timestamp: '2024-01-15T10:01:00Z',
          language: 'ar',
        },
        {
          id: 'msg-004',
          content: 'نعم، يمكن تجميع الإجازة السنوية ولكن بشروط معينة. يحق للعامل تأجيل إجازته السنوية أو جزء منها إلى السنة التالية بموافقة صاحب العمل، بشرط ألا تتجاوز المدة المجمعة 45 يوماً.',
          role: 'assistant',
          timestamp: '2024-01-15T10:01:45Z',
          language: 'ar',
          sources: [
            {
              title: 'قانون العمل السعودي - المادة 110',
              url: 'https://www.mol.gov.sa/labor-law/article-110',
              relevance: 0.88,
            },
          ],
        },
      ],
      metadata: {
        userId: 'user-123',
        organizationId: 'org-123',
        category: 'legal_inquiry',
        tags: ['إجازة', 'قانون العمل', 'موارد بشرية'],
        startedAt: '2024-01-15T10:00:00Z',
        endedAt: '2024-01-15T10:02:00Z',
        duration: 120000, // 2 minutes
        messageCount: 4,
        language: 'ar',
      },
    },
  ],
  
  documents: [
    {
      id: 'doc-001',
      title: 'عقد عمل - أحمد محمد السالم',
      content: `
        <div dir="rtl" class="employment-contract">
          <h1>عقد عمل</h1>
          <h2>بين الطرفين</h2>
          
          <div class="parties">
            <div class="employer">
              <h3>الطرف الأول (صاحب العمل):</h3>
              <p>شركة التقنية المتقدمة المحدودة</p>
              <p>رقم السجل التجاري: 1010123456</p>
            </div>
            
            <div class="employee">
              <h3>الطرف الثاني (العامل):</h3>
              <p>الاسم: أحمد محمد عبدالله السالم</p>
              <p>رقم الهوية: 1234567890</p>
              <p>الجنسية: سعودي</p>
            </div>
          </div>
          
          <div class="terms">
            <h3>شروط العمل</h3>
            <ul>
              <li>المنصب: مطور برمجيات أول</li>
              <li>القسم: تقنية المعلومات</li>
              <li>الراتب الأساسي: 15,000 ريال سعودي</li>
              <li>بدل السكن: 3,000 ريال</li>
              <li>بدل المواصلات: 1,000 ريال</li>
              <li>إجمالي الراتب: 19,000 ريال سعودي</li>
            </ul>
          </div>
          
          <div class="signatures">
            <div class="employer-signature">
              <p>الطرف الأول</p>
              <p>التوقيع: ________________</p>
              <p>التاريخ: 2024/02/01</p>
            </div>
            
            <div class="employee-signature">
              <p>الطرف الثاني</p>
              <p>التوقيع: ________________</p>
              <p>التاريخ: 2024/02/01</p>
            </div>
          </div>
        </div>
      `,
      type: 'employment_contract',
      language: 'ar',
      metadata: {
        employeeId: 'EMP001',
        department: 'IT',
        createdAt: '2024-02-01T09:00:00Z',
        createdBy: 'user-123',
      },
    },
  ],
  
  analyticsReports: [
    {
      id: 'report-001',
      title: 'تقرير الاستخدام الشهري - يناير 2024',
      type: 'usage_report',
      period: '2024-01',
      data: {
        totalQueries: 1543,
        uniqueUsers: 89,
        topQueries: [
          { query: 'أحكام الإجازة السنوية', count: 156 },
          { query: 'حساب مكافأة نهاية الخدمة', count: 142 },
          { query: 'حقوق العامل عند الإنهاء', count: 128 },
        ],
        departmentUsage: [
          { department: 'الموارد البشرية', queries: 654 },
          { department: 'الشؤون القانونية', queries: 423 },
          { department: 'الإدارة العامة', queries: 466 },
        ],
        languageBreakdown: {
          ar: 1234,
          en: 309,
        },
      },
      generatedAt: '2024-02-01T08:00:00Z',
      language: 'ar',
    },
  ],
};

describe('Export Service', () => {
  let exportService: ExportService;
  let mockPDFGenerator: jest.Mocked<typeof PDFGenerator>;
  let mockDOCXGenerator: jest.Mocked<typeof DOCXGenerator>;
  let mockHTMLGenerator: jest.Mocked<typeof HTMLGenerator>;
  let mockLogger: any;

  beforeEach(() => {
    // Mock generators
    mockPDFGenerator = PDFGenerator as jest.Mocked<typeof PDFGenerator>;
    mockDOCXGenerator = DOCXGenerator as jest.Mocked<typeof DOCXGenerator>;
    mockHTMLGenerator = HTMLGenerator as jest.Mocked<typeof HTMLGenerator>;

    // Mock logger
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    exportService = new ExportService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PDF Export', () => {
    it('should export Arabic conversation to PDF', async () => {
      const mockPDFBuffer = Buffer.from('PDF content with Arabic text');
      
      mockPDFGenerator.generateConversationPDF.mockResolvedValue({
        buffer: mockPDFBuffer,
        filename: 'محادثة-استفسار-عن-قانون-العمل.pdf',
        metadata: {
          pageCount: 2,
          fileSize: mockPDFBuffer.length,
          fonts: ['NotoSansArabic-Regular', 'NotoSansArabic-Bold'],
          language: 'ar',
        },
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'pdf',
          options: {
            includeMetadata: true,
            includeSources: true,
            arabicFont: 'NotoSansArabic-Regular',
            pageSize: 'A4',
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('محادثة-استفسار-عن-قانون-العمل.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.buffer).toEqual(mockPDFBuffer);
      expect(result.metadata.fonts).toContain('NotoSansArabic-Regular');

      expect(mockPDFGenerator.generateConversationPDF).toHaveBeenCalledWith(
        arabicExportTestData.conversations[0],
        expect.objectContaining({
          arabicFont: 'NotoSansArabic-Regular',
          pageSize: 'A4',
        })
      );
    });

    it('should export Arabic document to PDF with RTL support', async () => {
      const mockPDFBuffer = Buffer.from('PDF document with RTL layout');
      
      mockPDFGenerator.generateDocumentPDF.mockResolvedValue({
        buffer: mockPDFBuffer,
        filename: 'عقد-عمل-أحمد-محمد-السالم.pdf',
        metadata: {
          pageCount: 3,
          fileSize: mockPDFBuffer.length,
          textDirection: 'rtl',
          language: 'ar',
        },
      });

      const result = await exportService.exportDocument(
        arabicExportTestData.documents[0],
        {
          format: 'pdf',
          options: {
            textDirection: 'rtl',
            arabicFont: 'TraditionalArabic',
            includeWatermark: false,
            pageNumbering: 'arabic',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('عقد-عمل-أحمد-محمد-السالم.pdf');
      expect(result.metadata.textDirection).toBe('rtl');
      expect(mockPDFGenerator.generateDocumentPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('عقد عمل'),
        }),
        expect.objectContaining({
          textDirection: 'rtl',
          arabicFont: 'TraditionalArabic',
        })
      );
    });

    it('should export analytics report to PDF with Arabic charts', async () => {
      const mockPDFBuffer = Buffer.from('Analytics report PDF with charts');
      
      mockPDFGenerator.generateReportPDF.mockResolvedValue({
        buffer: mockPDFBuffer,
        filename: 'تقرير-الاستخدام-الشهري-يناير-2024.pdf',
        metadata: {
          pageCount: 5,
          fileSize: mockPDFBuffer.length,
          chartCount: 4,
          language: 'ar',
        },
      });

      const result = await exportService.exportAnalyticsReport(
        arabicExportTestData.analyticsReports[0],
        {
          format: 'pdf',
          options: {
            includeCharts: true,
            chartType: 'bar',
            arabicLabels: true,
            colorScheme: 'blue',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('تقرير-الاستخدام-الشهري-يناير-2024.pdf');
      expect(result.metadata.chartCount).toBe(4);
      expect(mockPDFGenerator.generateReportPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تقرير الاستخدام الشهري - يناير 2024',
        }),
        expect.objectContaining({
          includeCharts: true,
          arabicLabels: true,
        })
      );
    });

    it('should handle PDF generation errors gracefully', async () => {
      mockPDFGenerator.generateConversationPDF.mockRejectedValue(
        new Error('Arabic font not found')
      );

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        { format: 'pdf' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Arabic font not found');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PDF export failed',
        expect.any(Error)
      );
    });
  });

  describe('DOCX Export', () => {
    it('should export Arabic conversation to DOCX with RTL formatting', async () => {
      const mockDOCXBuffer = Buffer.from('DOCX content with Arabic RTL');
      
      mockDOCXGenerator.generateConversationDOCX.mockResolvedValue({
        buffer: mockDOCXBuffer,
        filename: 'محادثة-استفسار-عن-قانون-العمل.docx',
        metadata: {
          wordCount: 245,
          pageCount: 2,
          fileSize: mockDOCXBuffer.length,
          language: 'ar',
          textDirection: 'rtl',
        },
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'docx',
          options: {
            textDirection: 'rtl',
            arabicFont: 'Traditional Arabic',
            fontSize: 12,
            includeTimestamps: true,
            includeSources: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('محادثة-استفسار-عن-قانون-العمل.docx');
      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result.buffer).toEqual(mockDOCXBuffer);
      expect(result.metadata.textDirection).toBe('rtl');

      expect(mockDOCXGenerator.generateConversationDOCX).toHaveBeenCalledWith(
        arabicExportTestData.conversations[0],
        expect.objectContaining({
          textDirection: 'rtl',
          arabicFont: 'Traditional Arabic',
          includeTimestamps: true,
        })
      );
    });

    it('should export Arabic document to DOCX with proper styling', async () => {
      const mockDOCXBuffer = Buffer.from('DOCX document with Arabic styling');
      
      mockDOCXGenerator.generateDocumentDOCX.mockResolvedValue({
        buffer: mockDOCXBuffer,
        filename: 'عقد-عمل-أحمد-محمد-السالم.docx',
        metadata: {
          wordCount: 850,
          pageCount: 4,
          fileSize: mockDOCXBuffer.length,
          styleCount: 8,
          language: 'ar',
        },
      });

      const result = await exportService.exportDocument(
        arabicExportTestData.documents[0],
        {
          format: 'docx',
          options: {
            templateStyle: 'formal',
            includeHeaderFooter: true,
            pageNumbers: true,
            arabicPageNumbers: true,
            margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('عقد-عمل-أحمد-محمد-السالم.docx');
      expect(result.metadata.wordCount).toBe(850);
      expect(mockDOCXGenerator.generateDocumentDOCX).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'عقد عمل - أحمد محمد السالم',
        }),
        expect.objectContaining({
          templateStyle: 'formal',
          arabicPageNumbers: true,
        })
      );
    });

    it('should handle table formatting in Arabic DOCX exports', async () => {
      const documentWithTables = {
        ...arabicExportTestData.documents[0],
        content: `
          <div dir="rtl">
            <h1>كشف راتب</h1>
            <table>
              <thead>
                <tr>
                  <th>البيان</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>الراتب الأساسي</td>
                  <td>15,000 ريال</td>
                </tr>
                <tr>
                  <td>بدل السكن</td>
                  <td>3,000 ريال</td>
                </tr>
              </tbody>
            </table>
          </div>
        `,
      };

      const mockDOCXBuffer = Buffer.from('DOCX with Arabic tables');
      
      mockDOCXGenerator.generateDocumentDOCX.mockResolvedValue({
        buffer: mockDOCXBuffer,
        filename: 'كشف-راتب.docx',
        metadata: {
          tableCount: 1,
          rowCount: 3,
          language: 'ar',
        },
      });

      const result = await exportService.exportDocument(documentWithTables, {
        format: 'docx',
        options: {
          tableStyle: 'arabic-grid',
          tableBorders: true,
          alternateRowColors: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata.tableCount).toBe(1);
      expect(mockDOCXGenerator.generateDocumentDOCX).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<table>'),
        }),
        expect.objectContaining({
          tableStyle: 'arabic-grid',
        })
      );
    });
  });

  describe('HTML Export', () => {
    it('should export Arabic conversation to HTML with RTL CSS', async () => {
      const mockHTMLContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>محادثة - استفسار عن قانون العمل</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
            .conversation { max-width: 800px; margin: 0 auto; }
            .message { margin: 10px 0; padding: 10px; border-radius: 8px; }
            .user { background: #f0f0f0; text-align: right; }
            .assistant { background: #e3f2fd; text-align: right; }
          </style>
        </head>
        <body>
          <div class="conversation">
            <h1>استفسار عن قانون العمل</h1>
            <!-- Messages content -->
          </div>
        </body>
        </html>
      `;
      
      mockHTMLGenerator.generateConversationHTML.mockResolvedValue({
        html: mockHTMLContent,
        filename: 'محادثة-استفسار-عن-قانون-العمل.html',
        metadata: {
          fileSize: mockHTMLContent.length,
          messageCount: 4,
          language: 'ar',
          cssFramework: 'custom',
        },
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'html',
          options: {
            includeCSS: true,
            rtlSupport: true,
            responsive: true,
            theme: 'light',
            includeMetadata: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('محادثة-استفسار-عن-قانون-العمل.html');
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.content).toContain('dir="rtl"');
      expect(result.content).toContain('lang="ar"');
      expect(result.metadata.language).toBe('ar');

      expect(mockHTMLGenerator.generateConversationHTML).toHaveBeenCalledWith(
        arabicExportTestData.conversations[0],
        expect.objectContaining({
          rtlSupport: true,
          theme: 'light',
        })
      );
    });

    it('should export Arabic document to HTML with print styles', async () => {
      const mockHTMLContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>عقد عمل - أحمد محمد السالم</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
            .contract { font-family: 'Traditional Arabic', serif; }
          </style>
        </head>
        <body>
          <div class="contract">
            <!-- Contract content -->
          </div>
        </body>
        </html>
      `;
      
      mockHTMLGenerator.generateDocumentHTML.mockResolvedValue({
        html: mockHTMLContent,
        filename: 'عقد-عمل-أحمد-محمد-السالم.html',
        metadata: {
          fileSize: mockHTMLContent.length,
          printOptimized: true,
          language: 'ar',
        },
      });

      const result = await exportService.exportDocument(
        arabicExportTestData.documents[0],
        {
          format: 'html',
          options: {
            printOptimized: true,
            includeSignatureFields: true,
            arabicFont: 'Traditional Arabic',
            pageBreaks: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('عقد-عمل-أحمد-محمد-السالم.html');
      expect(result.content).toContain('@media print');
      expect(result.content).toContain('Traditional Arabic');
      expect(result.metadata.printOptimized).toBe(true);
    });

    it('should export analytics report to HTML with interactive charts', async () => {
      const mockHTMLContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الاستخدام الشهري</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
          <div class="report">
            <h1>تقرير الاستخدام الشهري - يناير 2024</h1>
            <canvas id="usageChart"></canvas>
            <script>
              // Chart.js configuration for Arabic RTL charts
            </script>
          </div>
        </body>
        </html>
      `;
      
      mockHTMLGenerator.generateReportHTML.mockResolvedValue({
        html: mockHTMLContent,
        filename: 'تقرير-الاستخدام-الشهري-يناير-2024.html',
        metadata: {
          fileSize: mockHTMLContent.length,
          chartCount: 3,
          interactive: true,
          language: 'ar',
        },
      });

      const result = await exportService.exportAnalyticsReport(
        arabicExportTestData.analyticsReports[0],
        {
          format: 'html',
          options: {
            interactive: true,
            includeCharts: true,
            chartLibrary: 'chartjs',
            arabicLabels: true,
            responsive: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('تقرير-الاستخدام-الشهري-يناير-2024.html');
      expect(result.content).toContain('chart.js');
      expect(result.metadata.interactive).toBe(true);
      expect(result.metadata.chartCount).toBe(3);
    });
  });

  describe('Batch Export', () => {
    it('should export multiple conversations in bulk', async () => {
      const mockZipBuffer = Buffer.from('ZIP archive with multiple conversations');
      
      exportService.createArchive = jest.fn().mockResolvedValue({
        buffer: mockZipBuffer,
        filename: 'محادثات-متعددة-يناير-2024.zip',
        metadata: {
          fileCount: 5,
          totalSize: mockZipBuffer.length,
          format: 'zip',
        },
      });

      const conversations = Array(5).fill(arabicExportTestData.conversations[0]);
      
      const result = await exportService.exportMultipleConversations(conversations, {
        format: 'pdf',
        archiveFormat: 'zip',
        options: {
          includeMetadata: true,
          arabicFont: 'NotoSansArabic-Regular',
        },
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('محادثات-متعددة-يناير-2024.zip');
      expect(result.metadata.fileCount).toBe(5);
    });

    it('should handle mixed language exports', async () => {
      const mixedConversations = [
        arabicExportTestData.conversations[0],
        {
          ...arabicExportTestData.conversations[0],
          id: 'conv-002',
          title: 'Employment Law Inquiry',
          metadata: { ...arabicExportTestData.conversations[0].metadata, language: 'en' },
        },
      ];

      exportService.createArchive = jest.fn().mockResolvedValue({
        buffer: Buffer.from('Mixed language archive'),
        filename: 'mixed-conversations-export.zip',
        metadata: {
          fileCount: 2,
          languages: ['ar', 'en'],
          format: 'zip',
        },
      });

      const result = await exportService.exportMultipleConversations(mixedConversations, {
        format: 'html',
        archiveFormat: 'zip',
        options: {
          preserveLanguages: true,
          autoDetectRTL: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata.languages).toEqual(['ar', 'en']);
    });
  });

  describe('Export Templates and Customization', () => {
    it('should use custom export templates', async () => {
      const customTemplate = {
        id: 'template-custom-001',
        name: 'قالب التصدير المخصص',
        type: 'conversation',
        format: 'pdf',
        options: {
          header: 'شركة التقنية المتقدمة',
          footer: 'سري ومحدود التداول',
          arabicFont: 'Amiri',
          logoUrl: 'https://example.com/logo.png',
        },
      };

      mockPDFGenerator.generateConversationPDF.mockResolvedValue({
        buffer: Buffer.from('Custom template PDF'),
        filename: 'محادثة-قالب-مخصص.pdf',
        metadata: {
          template: customTemplate.id,
          customizations: ['header', 'footer', 'logo'],
        },
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'pdf',
          template: customTemplate,
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata.template).toBe('template-custom-001');
      expect(result.metadata.customizations).toContain('header');
    });

    it('should apply organizational branding to exports', async () => {
      const brandingOptions = {
        organizationName: 'شركة التقنية المتقدمة المحدودة',
        logo: 'https://example.com/org-logo.png',
        primaryColor: '#1976d2',
        secondaryColor: '#424242',
        arabicFont: 'Amiri',
        englishFont: 'Roboto',
        watermark: 'سري ومحدود التداول',
      };

      mockPDFGenerator.generateConversationPDF.mockResolvedValue({
        buffer: Buffer.from('Branded PDF'),
        filename: 'محادثة-مع-هوية-الشركة.pdf',
        metadata: {
          branding: true,
          watermark: true,
          logo: true,
        },
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'pdf',
          branding: brandingOptions,
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata.branding).toBe(true);
    });
  });

  describe('Export Performance and Optimization', () => {
    it('should handle large conversation exports efficiently', async () => {
      const largeConversation = {
        ...arabicExportTestData.conversations[0],
        messages: Array(1000).fill(arabicExportTestData.conversations[0].messages[0]),
      };

      mockPDFGenerator.generateConversationPDF.mockResolvedValue({
        buffer: Buffer.from('Large conversation PDF'),
        filename: 'محادثة-كبيرة.pdf',
        metadata: {
          messageCount: 1000,
          pageCount: 50,
          processingTime: 15000, // 15 seconds
          optimized: true,
        },
      });

      const startTime = Date.now();
      const result = await exportService.exportConversation(largeConversation, {
        format: 'pdf',
        options: {
          optimization: 'memory',
          chunkSize: 100,
          progressCallback: jest.fn(),
        },
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metadata.optimized).toBe(true);
      expect(endTime - startTime).toBeLessThan(20000); // Should complete within 20 seconds
    });

    it('should provide export progress callbacks', async () => {
      const progressCallback = jest.fn();
      
      mockPDFGenerator.generateConversationPDF.mockImplementation(async (conversation, options) => {
        // Simulate progress updates
        options.onProgress?.(25);
        await new Promise(resolve => setTimeout(resolve, 100));
        options.onProgress?.(50);
        await new Promise(resolve => setTimeout(resolve, 100));
        options.onProgress?.(75);
        await new Promise(resolve => setTimeout(resolve, 100));
        options.onProgress?.(100);
        
        return {
          buffer: Buffer.from('Progress tracked PDF'),
          filename: 'محادثة-مع-تتبع-التقدم.pdf',
          metadata: { progressTracked: true },
        };
      });

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'pdf',
          options: {
            onProgress: progressCallback,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(progressCallback).toHaveBeenCalledWith(25);
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(75);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted Arabic text gracefully', async () => {
      const corruptedConversation = {
        ...arabicExportTestData.conversations[0],
        messages: [
          {
            ...arabicExportTestData.conversations[0].messages[0],
            content: 'Corrupted Arabic: \uFFFD\uFFFD\uFFFD', // Unicode replacement characters
          },
        ],
      };

      mockPDFGenerator.generateConversationPDF.mockRejectedValue(
        new Error('Text encoding error: Invalid Arabic characters detected')
      );

      const result = await exportService.exportConversation(corruptedConversation, {
        format: 'pdf',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text encoding error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Export failed due to text encoding error',
        expect.any(Error)
      );
    });

    it('should handle export timeout for large files', async () => {
      mockPDFGenerator.generateConversationPDF.mockImplementation(
        () => new Promise((resolve) => {
          // Simulate a timeout scenario
          setTimeout(() => resolve({
            buffer: Buffer.from('Delayed PDF'),
            filename: 'delayed.pdf',
            metadata: {},
          }), 35000); // 35 seconds
        })
      );

      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'pdf',
          timeout: 30000, // 30 second timeout
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export timeout exceeded');
    });

    it('should handle unsupported format errors', async () => {
      const result = await exportService.exportConversation(
        arabicExportTestData.conversations[0],
        {
          format: 'unsupported' as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported export format: unsupported');
    });

    it('should validate export permissions', async () => {
      const restrictedConversation = {
        ...arabicExportTestData.conversations[0],
        metadata: {
          ...arabicExportTestData.conversations[0].metadata,
          restricted: true,
          exportPermission: false,
        },
      };

      const result = await exportService.exportConversation(restrictedConversation, {
        format: 'pdf',
        userId: 'unauthorized-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions to export this conversation');
    });
  });
});