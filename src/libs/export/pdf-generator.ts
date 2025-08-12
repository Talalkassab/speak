/**
 * PDF Generator Service
 * Generates PDF documents from conversations with Arabic RTL support
 * Uses React-PDF or Puppeteer for PDF generation
 */

import { ConversationExportData, ExportOptions, BulkExportOptions } from '@/libs/services/export-service'

interface PDFGenerationResult {
  buffer: Buffer
  filename: string
  mimeType: string
}

interface CompanyBranding {
  logo?: string
  name: string
  address?: string
  phone?: string
  email?: string
  website?: string
}

class PDFGenerator {
  private defaultBranding: CompanyBranding = {
    name: 'HR Business Consultant',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966-XX-XXX-XXXX',
    email: 'info@hr-consultant.sa',
    website: 'www.hr-consultant.sa'
  }

  /**
   * Generate PDF for a single conversation
   */
  async generateConversationPDF(
    conversation: ConversationExportData,
    options: ExportOptions
  ): Promise<PDFGenerationResult> {
    try {
      const html = this.generateConversationHTML(conversation, options)
      const buffer = await this.convertHTMLToPDF(html, options)
      
      const filename = this.generateFilename('conversation', conversation.title, options.format)
      
      return {
        buffer,
        filename,
        mimeType: 'application/pdf'
      }
    } catch (error) {
      console.error('PDF generation error:', error)
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate PDF for bulk conversations
   */
  async generateBulkPDF(
    conversations: ConversationExportData[],
    options: BulkExportOptions
  ): Promise<PDFGenerationResult> {
    try {
      const html = this.generateBulkHTML(conversations, options)
      const buffer = await this.convertHTMLToPDF(html, options)
      
      const filename = this.generateFilename('bulk-conversations', `${conversations.length}-conversations`, options.format)
      
      return {
        buffer,
        filename,
        mimeType: 'application/pdf'
      }
    } catch (error) {
      console.error('Bulk PDF generation error:', error)
      throw new Error(`Bulk PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate HTML for single conversation
   */
  private generateConversationHTML(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const direction = isArabic ? 'rtl' : 'ltr'
    const fontFamily = isArabic ? '"Noto Sans Arabic", Arial, sans-serif' : 'Arial, sans-serif'
    
    return `
<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(conversation.title)}</title>
    <style>
        ${this.getBaseStyles(isArabic, fontFamily)}
        ${this.getConversationStyles()}
    </style>
</head>
<body>
    ${this.generateHeader(options)}
    
    <div class="conversation-container">
        ${this.generateConversationHeader(conversation, options)}
        ${this.generateConversationContent(conversation, options)}
    </div>
    
    ${this.generateFooter(options)}
</body>
</html>`
  }

  /**
   * Generate HTML for bulk conversations
   */
  private generateBulkHTML(conversations: ConversationExportData[], options: BulkExportOptions): string {
    const isArabic = options.language === 'ar'
    const direction = isArabic ? 'rtl' : 'ltr'
    const fontFamily = isArabic ? '"Noto Sans Arabic", Arial, sans-serif' : 'Arial, sans-serif'
    
    const conversationContent = conversations.map((conversation, index) => `
      <div class="conversation-section ${index > 0 ? 'page-break' : ''}">
        ${this.generateConversationHeader(conversation, options)}
        ${this.generateConversationContent(conversation, options)}
      </div>
    `).join('')

    return `
<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export'}</title>
    <style>
        ${this.getBaseStyles(isArabic, fontFamily)}
        ${this.getBulkStyles()}
    </style>
</head>
<body>
    ${this.generateHeader(options)}
    
    <div class="bulk-container">
        <div class="bulk-header">
            <h1>${isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export'}</h1>
            <p>${isArabic ? `عدد المحادثات: ${conversations.length}` : `Total Conversations: ${conversations.length}`}</p>
            <p>${isArabic ? `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}` : `Export Date: ${new Date().toLocaleDateString()}`}</p>
        </div>
        
        ${conversationContent}
    </div>
    
    ${this.generateFooter(options)}
</body>
</html>`
  }

  /**
   * Generate conversation header
   */
  private generateConversationHeader(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    
    return `
    <div class="conversation-header">
        <h2 class="conversation-title">${this.escapeHtml(conversation.title)}</h2>
        <div class="conversation-meta">
            <div class="meta-row">
                <span class="meta-label">${isArabic ? 'الفئة:' : 'Category:'}</span>
                <span class="meta-value">${this.translateCategory(conversation.category, isArabic)}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">${isArabic ? 'المستخدم:' : 'User:'}</span>
                <span class="meta-value">${this.escapeHtml(conversation.user.full_name || conversation.user.email || 'Unknown')}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">${isArabic ? 'تاريخ البدء:' : 'Started:'}</span>
                <span class="meta-value">${this.formatDate(conversation.created_at, isArabic)}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">${isArabic ? 'آخر تحديث:' : 'Last Updated:'}</span>
                <span class="meta-value">${this.formatDate(conversation.updated_at, isArabic)}</span>
            </div>
        </div>
    </div>`
  }

  /**
   * Generate conversation content (messages)
   */
  private generateConversationContent(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    
    const messagesHTML = conversation.messages.map((message, index) => {
      const messageClass = message.role === 'user' ? 'user-message' : 'assistant-message'
      const roleLabel = this.translateRole(message.role, isArabic)
      
      return `
      <div class="message ${messageClass}">
        <div class="message-header">
          <span class="message-role">${roleLabel}</span>
          <span class="message-time">${this.formatDateTime(message.created_at, isArabic)}</span>
        </div>
        <div class="message-content">
          ${this.formatMessageContent(message.content, message.content_type)}
        </div>
        
        ${message.sources.length > 0 && options.includeSources ? `
        <div class="message-sources">
          <h4>${isArabic ? 'المصادر:' : 'Sources:'}</h4>
          ${this.generateSourcesHTML(message.sources, isArabic)}
        </div>
        ` : ''}
        
        ${message.user_rating && options.includeUserFeedback ? `
        <div class="message-feedback">
          <div class="rating">
            <span class="rating-label">${isArabic ? 'التقييم:' : 'Rating:'}</span>
            <span class="rating-value">${this.generateStars(message.user_rating)}</span>
          </div>
          ${message.user_feedback ? `
          <div class="feedback-text">
            <span class="feedback-label">${isArabic ? 'التعليق:' : 'Feedback:'}</span>
            <span class="feedback-value">${this.escapeHtml(message.user_feedback)}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        ${options.includeMetadata ? `
        <div class="message-metadata">
          ${message.model_used ? `<span class="meta-item">${isArabic ? 'النموذج:' : 'Model:'} ${message.model_used}</span>` : ''}
          ${message.tokens_used ? `<span class="meta-item">${isArabic ? 'الرموز:' : 'Tokens:'} ${message.tokens_used}</span>` : ''}
          ${message.response_time_ms ? `<span class="meta-item">${isArabic ? 'وقت الاستجابة:' : 'Response Time:'} ${message.response_time_ms}ms</span>` : ''}
          ${message.confidence_score ? `<span class="meta-item">${isArabic ? 'درجة الثقة:' : 'Confidence:'} ${Math.round(message.confidence_score * 100)}%</span>` : ''}
        </div>
        ` : ''}
      </div>`
    }).join('')

    return `
    <div class="conversation-messages">
      <h3>${isArabic ? 'سجل المحادثة' : 'Conversation History'}</h3>
      ${messagesHTML}
    </div>`
  }

  /**
   * Generate sources HTML
   */
  private generateSourcesHTML(sources: any[], isArabic: boolean): string {
    return sources.map(source => `
    <div class="source-item">
      <div class="source-header">
        <span class="source-document">${this.escapeHtml(source.document_name)}</span>
        <span class="source-relevance">${Math.round(source.relevance_score * 100)}%</span>
      </div>
      ${source.page_number ? `<div class="source-page">${isArabic ? 'الصفحة:' : 'Page:'} ${source.page_number}</div>` : ''}
      ${source.citation_text ? `<div class="source-citation">"${this.escapeHtml(source.citation_text)}"</div>` : ''}
    </div>
    `).join('')
  }

  /**
   * Generate header with branding
   */
  private generateHeader(options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const branding = this.defaultBranding
    
    if (!options.organizationBranding) return ''
    
    return `
    <div class="document-header">
      <div class="header-content">
        <div class="company-info">
          <h1 class="company-name">${branding.name}</h1>
          ${branding.address ? `<p class="company-address">${branding.address}</p>` : ''}
          <div class="company-contact">
            ${branding.phone ? `<span>${branding.phone}</span>` : ''}
            ${branding.email ? `<span>${branding.email}</span>` : ''}
            ${branding.website ? `<span>${branding.website}</span>` : ''}
          </div>
        </div>
        ${options.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
      </div>
    </div>`
  }

  /**
   * Generate footer
   */
  private generateFooter(options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const currentDate = new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')
    
    return `
    <div class="document-footer">
      <div class="footer-content">
        <div class="export-info">
          <span>${isArabic ? 'تم التصدير في:' : 'Exported on:'} ${currentDate}</span>
          <span>${isArabic ? 'نظام إدارة الموارد البشرية' : 'HR Management System'}</span>
        </div>
        <div class="disclaimer">
          <p>${isArabic ? 
            'هذا المستند تم إنشاؤه تلقائياً من نظام إدارة الموارد البشرية. المعلومات الواردة هنا سرية ومخصصة للاستخدام الداخلي فقط.' : 
            'This document was automatically generated from the HR Management System. The information contained herein is confidential and intended for internal use only.'
          }</p>
        </div>
      </div>
    </div>`
  }

  /**
   * Convert HTML to PDF using Puppeteer (fallback implementation)
   */
  private async convertHTMLToPDF(html: string, options: ExportOptions): Promise<Buffer> {
    try {
      // Try to use Puppeteer if available
      const puppeteer = require('puppeteer')
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      
      const page = await browser.newPage()
      
      // Set content and wait for any async content to load
      await page.setContent(html, { waitUntil: 'networkidle0' })
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      })
      
      await browser.close()
      
      return Buffer.from(pdfBuffer)
      
    } catch (error) {
      // Fallback to a simple HTML-based approach (would need a different library)
      console.error('Puppeteer not available, using fallback:', error)
      throw new Error('PDF generation requires Puppeteer to be installed')
    }
  }

  /**
   * Base CSS styles with Arabic RTL support
   */
  private getBaseStyles(isArabic: boolean, fontFamily: string): string {
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      direction: ${isArabic ? 'rtl' : 'ltr'};
      text-align: ${isArabic ? 'right' : 'left'};
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .document-header {
      border-bottom: 2px solid #1f2937;
      margin-bottom: 20px;
      padding-bottom: 15px;
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 5px;
    }
    
    .company-address {
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .company-contact {
      display: flex;
      gap: 15px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .watermark {
      opacity: 0.3;
      transform: rotate(-45deg);
      font-size: 48px;
      font-weight: bold;
      color: #e5e7eb;
      position: absolute;
      top: 50%;
      left: 50%;
      transform-origin: center;
      z-index: -1;
    }
    
    .document-footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .export-info {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .disclaimer {
      max-width: 60%;
      text-align: justify;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-bottom: 10px;
      font-weight: bold;
    }
    
    .meta-row {
      display: flex;
      margin-bottom: 5px;
      gap: 10px;
    }
    
    .meta-label {
      font-weight: bold;
      min-width: 100px;
      color: #374151;
    }
    
    .meta-value {
      flex: 1;
      color: #6b7280;
    }
    `
  }

  /**
   * Conversation-specific styles
   */
  private getConversationStyles(): string {
    return `
    .conversation-container {
      margin: 20px 0;
    }
    
    .conversation-header {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .conversation-title {
      font-size: 20px;
      color: #1f2937;
      margin-bottom: 15px;
    }
    
    .conversation-meta {
      display: grid;
      gap: 8px;
    }
    
    .conversation-messages {
      margin-top: 20px;
    }
    
    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #e5e7eb;
    }
    
    .user-message {
      background: #eff6ff;
      border-left-color: #3b82f6;
    }
    
    .assistant-message {
      background: #f0fdf4;
      border-left-color: #10b981;
    }
    
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .message-role {
      font-weight: bold;
      color: #374151;
    }
    
    .message-time {
      font-size: 12px;
      color: #6b7280;
    }
    
    .message-content {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
    
    .message-sources {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    
    .message-sources h4 {
      font-size: 14px;
      margin-bottom: 10px;
      color: #374151;
    }
    
    .source-item {
      background: #f8fafc;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      border: 1px solid #e2e8f0;
    }
    
    .source-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 5px;
    }
    
    .source-document {
      color: #1e40af;
    }
    
    .source-relevance {
      color: #059669;
      font-size: 11px;
    }
    
    .source-page, .source-citation {
      font-size: 11px;
      color: #6b7280;
      margin: 2px 0;
    }
    
    .source-citation {
      font-style: italic;
    }
    
    .message-feedback {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
    }
    
    .rating {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 5px;
    }
    
    .rating-label, .feedback-label {
      font-weight: bold;
      color: #374151;
    }
    
    .rating-value {
      color: #f59e0b;
    }
    
    .feedback-text {
      display: flex;
      gap: 10px;
    }
    
    .message-metadata {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 15px;
      font-size: 11px;
      color: #6b7280;
    }
    
    .meta-item {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
    }
    `
  }

  /**
   * Bulk export specific styles
   */
  private getBulkStyles(): string {
    return `
    .bulk-container {
      margin: 20px 0;
    }
    
    .bulk-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .bulk-header h1 {
      font-size: 28px;
      color: #1f2937;
      margin-bottom: 15px;
    }
    
    .bulk-header p {
      color: #6b7280;
      margin: 5px 0;
    }
    
    .conversation-section {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid #e5e7eb;
    }
    `
  }

  /**
   * Utility functions
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
  }

  private formatDate(dateString: string, isArabic: boolean): string {
    const date = new Date(dateString)
    return date.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  private formatDateTime(dateString: string, isArabic: boolean): string {
    const date = new Date(dateString)
    return date.toLocaleString(isArabic ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  private translateRole(role: string, isArabic: boolean): string {
    const translations: Record<string, Record<string, string>> = {
      user: { ar: 'المستخدم', en: 'User' },
      assistant: { ar: 'المساعد', en: 'Assistant' },
      system: { ar: 'النظام', en: 'System' }
    }
    return translations[role]?.[isArabic ? 'ar' : 'en'] || role
  }

  private translateCategory(category: string, isArabic: boolean): string {
    const translations: Record<string, Record<string, string>> = {
      general: { ar: 'عام', en: 'General' },
      policy: { ar: 'السياسات', en: 'Policy' },
      labor_law: { ar: 'قانون العمل', en: 'Labor Law' },
      benefits: { ar: 'المزايا', en: 'Benefits' },
      procedures: { ar: 'الإجراءات', en: 'Procedures' }
    }
    return translations[category]?.[isArabic ? 'ar' : 'en'] || category
  }

  private formatMessageContent(content: string, contentType: string): string {
    if (contentType === 'markdown') {
      // Basic markdown to HTML conversion
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
    }
    return this.escapeHtml(content).replace(/\n/g, '<br>')
  }

  private generateStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  private generateFilename(type: string, title: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('T')[0]
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').slice(0, 50)
    return `${type}-${sanitizedTitle}-${timestamp}.${format}`
  }
}

export { PDFGenerator }