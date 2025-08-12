import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

interface PDFGenerationOptions {
  format: 'A4' | 'A3' | 'Letter';
  language: 'ar' | 'en';
  styling: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    headerStyle?: 'minimal' | 'standard' | 'detailed';
    footerIncluded?: boolean;
    margins?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  watermark?: {
    text: string;
    opacity: number;
    position: 'center' | 'diagonal';
  };
  includeMetadata?: boolean;
}

interface GeneratedPDFResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
  previewUrl: string;
}

export class PDFGenerationService {
  private getArabicFontCSS(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
      
      .arabic-text {
        font-family: 'Amiri', 'Tajawal', serif;
        direction: rtl;
        text-align: right;
        line-height: 1.8;
      }
      
      .english-text {
        font-family: 'Arial', sans-serif;
        direction: ltr;
        text-align: left;
        line-height: 1.6;
      }
    `;
  }

  private generateCSS(options: PDFGenerationOptions): string {
    const { styling, language } = options;
    const isArabic = language === 'ar';
    
    return `
      <style>
        ${this.getArabicFontCSS()}
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: ${isArabic ? "'Amiri', 'Tajawal', serif" : "'Arial', sans-serif"};
          font-size: ${styling.fontSize || 12}px;
          line-height: ${isArabic ? '1.8' : '1.6'};
          color: #333;
          direction: ${isArabic ? 'rtl' : 'ltr'};
          text-align: ${isArabic ? 'right' : 'left'};
          margin: ${styling.margins?.top || 20}px ${styling.margins?.right || 20}px ${styling.margins?.bottom || 20}px ${styling.margins?.left || 20}px;
        }
        
        .document-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          min-height: 100vh;
        }
        
        .header {
          ${styling.headerStyle === 'minimal' ? 'display: none;' : ''}
          border-bottom: 2px solid ${styling.primaryColor || '#3B82F6'};
          padding: 20px 0;
          margin-bottom: 30px;
          text-align: center;
        }
        
        .header.detailed {
          background: linear-gradient(135deg, ${styling.primaryColor || '#3B82F6'} 0%, ${styling.secondaryColor || '#1E40AF'} 100%);
          color: white;
          padding: 30px;
          border-radius: 8px;
        }
        
        .company-logo {
          max-height: 80px;
          margin-bottom: 15px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: ${styling.primaryColor || '#3B82F6'};
          margin-bottom: 8px;
        }
        
        .company-info {
          font-size: 14px;
          color: #666;
          ${isArabic ? 'text-align: right;' : 'text-align: left;'}
        }
        
        .document-title {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          margin: 30px 0;
          color: ${styling.primaryColor || '#3B82F6'};
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 10px;
        }
        
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: ${styling.primaryColor || '#3B82F6'};
          margin-bottom: 10px;
          padding: 8px 15px;
          background-color: #F3F4F6;
          border-${isArabic ? 'right' : 'left'}: 4px solid ${styling.primaryColor || '#3B82F6'};
        }
        
        .field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dotted #D1D5DB;
          ${isArabic ? 'flex-direction: row-reverse;' : ''}
        }
        
        .field-label {
          font-weight: 600;
          color: #374151;
          min-width: 40%;
        }
        
        .field-value {
          flex: 1;
          ${isArabic ? 'text-align: right; margin-right: 20px;' : 'text-align: left; margin-left: 20px;'}
          color: #111827;
        }
        
        .signature-section {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          ${isArabic ? 'flex-direction: row-reverse;' : ''}
        }
        
        .signature-block {
          width: 45%;
          text-align: center;
          padding: 20px 0;
        }
        
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 40px;
          padding-top: 8px;
          font-size: 12px;
          color: #666;
        }
        
        .footer {
          ${!styling.footerIncluded ? 'display: none;' : ''}
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          font-size: 10px;
          color: #6B7280;
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) ${options.watermark?.position === 'diagonal' ? 'rotate(-45deg)' : 'rotate(0deg)'};
          font-size: 72px;
          color: rgba(0, 0, 0, ${options.watermark?.opacity || 0.1});
          z-index: -1;
          font-weight: bold;
          pointer-events: none;
        }
        
        .page-break {
          page-break-after: always;
        }
        
        @media print {
          body { margin: 0; }
          .document-container { margin: 0; max-width: none; }
        }
        
        /* Arabic-specific adjustments */
        ${isArabic ? `
          .arabic-number {
            font-family: 'Arial', sans-serif;
            direction: ltr;
            display: inline-block;
          }
          
          .arabic-date {
            direction: ltr;
            text-align: right;
          }
        ` : ''}
      </style>
    `;
  }

  private generateHeader(companyInfo: any, styling: any): string {
    if (styling.headerStyle === 'minimal') return '';
    
    const headerClass = styling.headerStyle === 'detailed' ? 'header detailed' : 'header';
    
    return `
      <div class="${headerClass}">
        ${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="Company Logo" class="company-logo" />` : ''}
        <div class="company-name">${companyInfo.name || 'Company Name'}</div>
        <div class="company-info">
          ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
          ${companyInfo.phone ? `<div>Tel: ${companyInfo.phone}</div>` : ''}
          ${companyInfo.email ? `<div>Email: ${companyInfo.email}</div>` : ''}
          ${companyInfo.website ? `<div>Website: ${companyInfo.website}</div>` : ''}
          ${companyInfo.commercialRegistration ? `<div>C.R. No: ${companyInfo.commercialRegistration}</div>` : ''}
        </div>
      </div>
    `;
  }

  private generateFooter(options: PDFGenerationOptions): string {
    if (!options.styling.footerIncluded) return '';
    
    const currentDate = new Date().toLocaleDateString(
      options.language === 'ar' ? 'ar-SA' : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    );
    
    return `
      <div class="footer">
        <div>Generated on ${currentDate}</div>
        <div>This document is electronically generated and does not require a signature for validity.</div>
        ${options.language === 'ar' ? '<div style="margin-top: 5px;">هذه الوثيقة مُولدة إلكترونياً ولا تحتاج لتوقيع للمصادقة</div>' : ''}
      </div>
    `;
  }

  private parseContentSections(content: string, language: 'ar' | 'en'): any[] {
    const sections: any[] = [];
    const lines = content.split('\n');
    let currentSection: any = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if line is a section header (ends with colon)
      if (trimmedLine.endsWith(':') && trimmedLine.length < 100) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmedLine.replace(':', ''),
          content: []
        };
      } else if (currentSection) {
        // Check if line contains field-value pair (contains colon)
        if (trimmedLine.includes(':') && trimmedLine.split(':').length === 2) {
          const [label, value] = trimmedLine.split(':');
          currentSection.content.push({
            type: 'field',
            label: label.trim(),
            value: value.trim()
          });
        } else {
          // Regular paragraph text
          currentSection.content.push({
            type: 'text',
            content: trimmedLine
          });
        }
      } else {
        // Content before any section headers
        if (!sections.find(s => s.title === 'Introduction')) {
          sections.unshift({
            title: language === 'ar' ? 'المقدمة' : 'Introduction',
            content: []
          });
        }
        sections[0].content.push({
          type: 'text',
          content: trimmedLine
        });
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  private generateContentHTML(sections: any[], language: 'ar' | 'en'): string {
    return sections.map(section => {
      const sectionContent = section.content.map((item: any) => {
        if (item.type === 'field') {
          return `
            <div class="field-row">
              <div class="field-label">${item.label}:</div>
              <div class="field-value">${item.value}</div>
            </div>
          `;
        } else {
          return `<p>${item.content}</p>`;
        }
      }).join('\n');
      
      return `
        <div class="section">
          <div class="section-title">${section.title}</div>
          <div class="section-content">
            ${sectionContent}
          </div>
        </div>
      `;
    }).join('\n');
  }

  private generateSignatureSection(language: 'ar' | 'en'): string {
    const labels = language === 'ar' ? {
      employer: 'صاحب العمل',
      employee: 'الموظف',
      signature: 'التوقيع',
      date: 'التاريخ',
      seal: 'ختم الشركة'
    } : {
      employer: 'Employer',
      employee: 'Employee',
      signature: 'Signature',
      date: 'Date',
      seal: 'Company Seal'
    };
    
    return `
      <div class="signature-section">
        <div class="signature-block">
          <div><strong>${labels.employer}</strong></div>
          <div class="signature-line">${labels.signature}: ________________</div>
          <div class="signature-line">${labels.date}: ________________</div>
        </div>
        <div class="signature-block">
          <div><strong>${labels.employee}</strong></div>
          <div class="signature-line">${labels.signature}: ________________</div>
          <div class="signature-line">${labels.date}: ________________</div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <div style="border: 1px dashed #ccc; padding: 20px; width: 200px; margin: 0 auto;">
          ${labels.seal}
        </div>
      </div>
    `;
  }

  async generatePDF(
    content: string,
    title: string,
    options: PDFGenerationOptions,
    companyInfo: any = {}
  ): Promise<GeneratedPDFResult> {
    try {
      // Parse content into sections
      const sections = this.parseContentSections(content, options.language);
      
      // Generate HTML
      const css = this.generateCSS(options);
      const header = this.generateHeader(companyInfo, options.styling);
      const contentHTML = this.generateContentHTML(sections, options.language);
      const signatureSection = this.generateSignatureSection(options.language);
      const footer = this.generateFooter(options);
      const watermark = options.watermark ? 
        `<div class="watermark">${options.watermark.text}</div>` : '';
      
      const fullHTML = `
        <!DOCTYPE html>
        <html lang="${options.language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          ${css}
        </head>
        <body class="${options.language === 'ar' ? 'arabic-text' : 'english-text'}">
          ${watermark}
          <div class="document-container">
            ${header}
            <div class="document-title">${title}</div>
            ${contentHTML}
            ${signatureSection}
            ${footer}
          </div>
        </body>
        </html>
      `;
      
      // Generate PDF using puppeteer (in a real implementation)
      const pdfBuffer = await this.htmlToPDF(fullHTML, options);
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`;
      
      // Store file (in production, you'd use cloud storage)
      const downloadUrl = await this.storeFile(pdfBuffer, fileName, 'application/pdf');
      const previewUrl = downloadUrl; // Same URL for preview
      
      return {
        buffer: pdfBuffer,
        fileName,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        downloadUrl,
        previewUrl
      };
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF document');
    }
  }

  async generateDocxBuffer(
    content: string,
    title: string,
    options: PDFGenerationOptions,
    companyInfo: any = {}
  ): Promise<Buffer> {
    // This would use a library like docx to generate Word documents
    // For now, return a simple text buffer as placeholder
    const docContent = `${title}\n\n${content}`;
    return Buffer.from(docContent, 'utf-8');
  }

  private async htmlToPDF(html: string, options: PDFGenerationOptions): Promise<Buffer> {
    // In production, this would use puppeteer or similar:
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.setContent(html);
    // const pdf = await page.pdf({ format: options.format, printBackground: true });
    // await browser.close();
    // return pdf;
    
    // For now, return mock PDF buffer
    const mockPDF = `%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF`;
    return Buffer.from(mockPDF);
  }

  private async storeFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    // In production, upload to S3, Google Cloud Storage, etc.
    // For now, return a mock URL
    return `/api/files/download/${fileName}`;
  }

  async generateTemplatePreview(
    templateContent: string,
    parameters: Record<string, any>,
    language: 'ar' | 'en' = 'ar'
  ): Promise<string> {
    // Generate HTML preview without full PDF
    let previewContent = templateContent;
    
    // Replace parameters
    Object.entries(parameters).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      previewContent = previewContent.replace(regex, String(value || '[Missing]'));
    });
    
    // Add basic styling
    const css = this.generateCSS({
      format: 'A4',
      language,
      styling: {
        primaryColor: '#3B82F6',
        fontSize: 12,
        headerStyle: 'standard',
        footerIncluded: true,
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      }
    });
    
    return `
      ${css}
      <div class="document-container ${language === 'ar' ? 'arabic-text' : 'english-text'}">
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #3B82F6; margin-bottom: 10px;">
            ${language === 'ar' ? 'معاينة القالب' : 'Template Preview'}
          </h3>
          <p style="font-size: 14px; color: #6b7280;">
            ${language === 'ar' ? 'هذه معاينة مبدئية للقالب مع المعاملات المدخلة' : 'This is a preview of the template with the provided parameters'}
          </p>
        </div>
        <div style="white-space: pre-line; line-height: 1.8;">
          ${previewContent}
        </div>
      </div>
    `;
  }
}

export default PDFGenerationService;