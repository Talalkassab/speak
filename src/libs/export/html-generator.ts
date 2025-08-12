/**
 * HTML Generator Service
 * Generates interactive HTML documents from conversations with search functionality
 * Supports Arabic RTL, responsive design, and interactive features
 */

import { ConversationExportData, ExportOptions, BulkExportOptions } from '@/libs/services/export-service'

interface HTMLGenerationResult {
  buffer: Buffer
  filename: string
  mimeType: string
  htmlContent?: string
}

interface CompanyBranding {
  logo?: string
  name: string
  address?: string
  phone?: string
  email?: string
  website?: string
  colors?: {
    primary: string
    secondary: string
    accent: string
  }
}

class HTMLGenerator {
  private defaultBranding: CompanyBranding = {
    name: 'HR Business Consultant',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966-XX-XXX-XXXX',
    email: 'info@hr-consultant.sa',
    website: 'www.hr-consultant.sa',
    colors: {
      primary: '#1f2937',
      secondary: '#3b82f6',
      accent: '#10b981'
    }
  }

  /**
   * Generate HTML for a single conversation
   */
  async generateConversationHTML(
    conversation: ConversationExportData,
    options: ExportOptions
  ): Promise<HTMLGenerationResult> {
    try {
      const html = this.generateInteractiveHTML(conversation, options)
      const buffer = Buffer.from(html, 'utf-8')
      
      const filename = this.generateFilename('conversation', conversation.title, 'html')
      
      return {
        buffer,
        filename,
        mimeType: 'text/html',
        htmlContent: html
      }
    } catch (error) {
      console.error('HTML generation error:', error)
      throw new Error(`HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate HTML for bulk conversations
   */
  async generateBulkHTML(
    conversations: ConversationExportData[],
    options: BulkExportOptions
  ): Promise<HTMLGenerationResult> {
    try {
      const html = this.generateBulkInteractiveHTML(conversations, options)
      const buffer = Buffer.from(html, 'utf-8')
      
      const filename = this.generateFilename('bulk-conversations', `${conversations.length}-conversations`, 'html')
      
      return {
        buffer,
        filename,
        mimeType: 'text/html',
        htmlContent: html
      }
    } catch (error) {
      console.error('Bulk HTML generation error:', error)
      throw new Error(`Bulk HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate interactive HTML with search and navigation
   */
  private generateInteractiveHTML(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const direction = isArabic ? 'rtl' : 'ltr'
    const theme = options.theme || 'light'
    
    return `
<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}" data-theme="${theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(conversation.title)} - HR Export</title>
    ${this.getInteractiveStyles(isArabic, theme, options)}
    ${options.customCSS ? `<style>${options.customCSS}</style>` : ''}
</head>
<body>
    ${this.generateHeader(options)}
    
    <div class="container">
        ${options.includeSearch ? this.generateSearchPanel(isArabic) : ''}
        ${options.includeTableOfContents ? this.generateTableOfContents(conversation, isArabic) : ''}
        
        <main class="main-content">
            ${this.generateConversationContent(conversation, options)}
        </main>
        
        ${this.generateSidebar(conversation, options)}
    </div>
    
    ${this.generateFooter(options)}
    ${options.interactiveFeatures ? this.generateJavaScript(isArabic) : ''}
</body>
</html>`
  }

  /**
   * Generate bulk interactive HTML
   */
  private generateBulkInteractiveHTML(conversations: ConversationExportData[], options: BulkExportOptions): string {
    const isArabic = options.language === 'ar'
    const direction = isArabic ? 'rtl' : 'ltr'
    const theme = options.theme || 'light'
    
    const conversationSections = conversations.map((conversation, index) => `
      <section class="conversation-section" id="conversation-${index}" data-conversation-id="${conversation.id}">
        <div class="conversation-header">
          <h2 class="conversation-title">${this.escapeHtml(conversation.title)}</h2>
          <div class="conversation-meta">
            <span class="conversation-date">${this.formatDate(conversation.created_at, isArabic)}</span>
            <span class="conversation-category">${this.translateCategory(conversation.category, isArabic)}</span>
            <span class="message-count">${conversation.messages.length} ${isArabic ? 'رسالة' : 'messages'}</span>
          </div>
        </div>
        ${this.generateConversationMessages(conversation, options)}
      </section>
    `).join('')

    return `
<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}" data-theme="${theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export'} - HR Export</title>
    ${this.getInteractiveStyles(isArabic, theme, options)}
    ${options.customCSS ? `<style>${options.customCSS}</style>` : ''}
</head>
<body>
    ${this.generateHeader(options)}
    
    <div class="container">
        ${this.generateBulkSearchPanel(conversations, isArabic)}
        ${this.generateBulkTableOfContents(conversations, isArabic)}
        
        <main class="main-content">
          <div class="bulk-header">
            <h1>${isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export'}</h1>
            <div class="bulk-stats">
              <span>${isArabic ? `إجمالي المحادثات: ${conversations.length}` : `Total Conversations: ${conversations.length}`}</span>
              <span>${isArabic ? `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}` : `Export Date: ${new Date().toLocaleDateString()}`}</span>
            </div>
          </div>
          
          ${conversationSections}
        </main>
    </div>
    
    ${this.generateFooter(options)}
    ${this.generateBulkJavaScript(isArabic)}
</body>
</html>`
  }

  /**
   * Generate search panel
   */
  private generateSearchPanel(isArabic: boolean): string {
    return `
    <div class="search-panel">
      <div class="search-container">
        <input 
          type="text" 
          id="searchInput" 
          placeholder="${isArabic ? 'البحث في المحادثة...' : 'Search conversation...'}"
          class="search-input"
        >
        <button id="searchButton" class="search-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
        <button id="clearSearch" class="clear-button" style="display: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="search-filters">
        <select id="searchType" class="search-filter">
          <option value="all">${isArabic ? 'جميع الرسائل' : 'All Messages'}</option>
          <option value="user">${isArabic ? 'رسائل المستخدم' : 'User Messages'}</option>
          <option value="assistant">${isArabic ? 'رسائل المساعد' : 'Assistant Messages'}</option>
          <option value="sources">${isArabic ? 'المصادر' : 'Sources'}</option>
        </select>
        <label class="search-option">
          <input type="checkbox" id="caseSensitive">
          <span>${isArabic ? 'حساسية الأحرف' : 'Case Sensitive'}</span>
        </label>
        <label class="search-option">
          <input type="checkbox" id="wholeWords">
          <span>${isArabic ? 'كلمات كاملة' : 'Whole Words'}</span>
        </label>
      </div>
      <div id="searchResults" class="search-results" style="display: none;"></div>
    </div>`
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(conversation: ConversationExportData, isArabic: boolean): string {
    const messages = conversation.messages.filter(msg => msg.role === 'user' || msg.role === 'assistant')
    
    const tocItems = messages.map((message, index) => {
      const preview = message.content.slice(0, 80) + (message.content.length > 80 ? '...' : '')
      const roleLabel = this.translateRole(message.role, isArabic)
      
      return `
        <div class="toc-item" data-message-index="${index}">
          <div class="toc-role">${roleLabel}</div>
          <div class="toc-preview">${this.escapeHtml(preview)}</div>
          <div class="toc-time">${this.formatTime(message.created_at, isArabic)}</div>
        </div>
      `
    }).join('')

    return `
    <nav class="table-of-contents">
      <h3>${isArabic ? 'جدول المحتويات' : 'Table of Contents'}</h3>
      <div class="toc-items">
        ${tocItems}
      </div>
    </nav>`
  }

  /**
   * Generate conversation content with enhanced formatting
   */
  private generateConversationContent(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    
    return `
    <article class="conversation-article">
      <header class="conversation-header">
        <h1 class="conversation-title">${this.escapeHtml(conversation.title)}</h1>
        <div class="conversation-metadata">
          ${this.generateMetadataSection(conversation, options)}
        </div>
      </header>
      
      <div class="conversation-messages" id="messagesContainer">
        ${this.generateConversationMessages(conversation, options)}
      </div>
      
      ${options.includeComplianceAnalysis ? this.generateComplianceSection(conversation, isArabic) : ''}
      ${options.includeCostBreakdown ? this.generateCostSection(conversation, isArabic) : ''}
    </article>`
  }

  /**
   * Generate conversation messages with interactive features
   */
  private generateConversationMessages(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    
    return conversation.messages.map((message, index) => {
      const messageClass = `message message-${message.role}`
      const roleLabel = this.translateRole(message.role, isArabic)
      
      return `
      <div class="${messageClass}" id="message-${index}" data-message-id="${message.id}">
        <div class="message-header">
          <div class="message-role-info">
            <span class="message-role">${roleLabel}</span>
            <span class="message-time">${this.formatDateTime(message.created_at, isArabic)}</span>
          </div>
          <div class="message-actions">
            <button class="copy-button" title="${isArabic ? 'نسخ الرسالة' : 'Copy Message'}" data-copy-target="message-content-${index}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            ${options.interactiveFeatures ? `
            <button class="share-button" title="${isArabic ? 'مشاركة الرسالة' : 'Share Message'}" data-message-index="${index}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16,6 12,2 8,6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
            </button>
            ` : ''}
          </div>
        </div>
        
        <div class="message-content" id="message-content-${index}">
          ${this.formatMessageContent(message.content, message.content_type)}
        </div>
        
        ${message.sources.length > 0 && options.includeSources ? `
        <div class="message-sources">
          <h4>${isArabic ? 'المصادر:' : 'Sources:'}</h4>
          ${this.generateInteractiveSourcesHTML(message.sources, isArabic)}
        </div>
        ` : ''}
        
        ${message.user_rating && options.includeUserFeedback ? `
        <div class="message-feedback">
          <div class="rating">
            <span class="rating-label">${isArabic ? 'التقييم:' : 'Rating:'}</span>
            <div class="rating-stars">${this.generateInteractiveStars(message.user_rating)}</div>
          </div>
          ${message.user_feedback ? `
          <div class="feedback-text">
            <span class="feedback-label">${isArabic ? 'التعليق:' : 'Feedback:'}</span>
            <span class="feedback-value">${this.escapeHtml(message.user_feedback)}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}
        
        ${options.includeMetadata ? this.generateMessageMetadata(message, isArabic) : ''}
      </div>`
    }).join('')
  }

  /**
   * Generate interactive styles
   */
  private getInteractiveStyles(isArabic: boolean, theme: string, options: ExportOptions): string {
    const fontFamily = isArabic ? '"Noto Sans Arabic", "Segoe UI", Arial, sans-serif' : '"Segoe UI", system-ui, Arial, sans-serif'
    const direction = isArabic ? 'rtl' : 'ltr'
    
    const themeColors = this.getThemeColors(theme)
    
    return `
    <style>
      :root {
        --primary-color: ${themeColors.primary};
        --secondary-color: ${themeColors.secondary};
        --accent-color: ${themeColors.accent};
        --background-color: ${themeColors.background};
        --surface-color: ${themeColors.surface};
        --text-color: ${themeColors.text};
        --text-secondary: ${themeColors.textSecondary};
        --border-color: ${themeColors.border};
        --hover-color: ${themeColors.hover};
        --success-color: #10b981;
        --warning-color: #f59e0b;
        --error-color: #ef4444;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: ${fontFamily};
        font-size: 16px;
        line-height: 1.6;
        color: var(--text-color);
        background-color: var(--background-color);
        direction: ${direction};
        transition: background-color 0.3s, color 0.3s;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr 3fr;
        gap: 20px;
      }
      
      @media (max-width: 768px) {
        .container {
          grid-template-columns: 1fr;
          padding: 10px;
        }
      }
      
      /* Header Styles */
      .document-header {
        background: var(--surface-color);
        border-bottom: 2px solid var(--border-color);
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .header-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .company-name {
        font-size: 24px;
        font-weight: bold;
        color: var(--primary-color);
      }
      
      /* Search Panel Styles */
      .search-panel {
        background: var(--surface-color);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        border: 1px solid var(--border-color);
        position: sticky;
        top: 20px;
      }
      
      .search-container {
        position: relative;
        display: flex;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .search-input {
        flex: 1;
        padding: 12px 45px 12px 16px;
        border: 2px solid var(--border-color);
        border-radius: 6px;
        font-size: 14px;
        background: var(--background-color);
        color: var(--text-color);
        transition: border-color 0.3s;
      }
      
      .search-input:focus {
        outline: none;
        border-color: var(--accent-color);
      }
      
      .search-button, .clear-button {
        position: absolute;
        ${isArabic ? 'left' : 'right'}: 8px;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.3s;
      }
      
      .search-button:hover, .clear-button:hover {
        background-color: var(--hover-color);
      }
      
      .search-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      
      .search-filter {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--background-color);
        color: var(--text-color);
        font-size: 14px;
      }
      
      .search-option {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        cursor: pointer;
      }
      
      .search-results {
        margin-top: 15px;
        padding: 15px;
        background: var(--background-color);
        border-radius: 6px;
        border: 1px solid var(--border-color);
        max-height: 300px;
        overflow-y: auto;
      }
      
      /* Table of Contents Styles */
      .table-of-contents {
        background: var(--surface-color);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        border: 1px solid var(--border-color);
        position: sticky;
        top: 20px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .table-of-contents h3 {
        margin-bottom: 15px;
        color: var(--primary-color);
        font-size: 18px;
      }
      
      .toc-item {
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background-color 0.3s;
        border: 1px solid transparent;
      }
      
      .toc-item:hover {
        background-color: var(--hover-color);
        border-color: var(--border-color);
      }
      
      .toc-role {
        font-weight: bold;
        font-size: 12px;
        color: var(--accent-color);
        margin-bottom: 4px;
      }
      
      .toc-preview {
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 4px;
      }
      
      .toc-time {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      /* Main Content Styles */
      .main-content {
        background: var(--surface-color);
        border-radius: 8px;
        padding: 30px;
        border: 1px solid var(--border-color);
      }
      
      .conversation-title {
        font-size: 28px;
        font-weight: bold;
        color: var(--primary-color);
        margin-bottom: 20px;
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 15px;
      }
      
      /* Message Styles */
      .message {
        margin-bottom: 25px;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      }
      
      .message:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .message-user {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-${isArabic ? 'right' : 'left'}: 4px solid var(--secondary-color);
      }
      
      .message-assistant {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-${isArabic ? 'right' : 'left'}: 4px solid var(--success-color);
      }
      
      .message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .message-role-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .message-role {
        font-weight: bold;
        color: var(--primary-color);
        font-size: 16px;
      }
      
      .message-time {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      .message-actions {
        display: flex;
        gap: 8px;
      }
      
      .copy-button, .share-button {
        background: var(--background-color);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.3s;
      }
      
      .copy-button:hover, .share-button:hover {
        background: var(--hover-color);
        color: var(--text-color);
      }
      
      .message-content {
        font-size: 16px;
        line-height: 1.7;
        color: var(--text-color);
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      /* Search highlight */
      .search-highlight {
        background-color: #fef3c7;
        color: #92400e;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: bold;
      }
      
      [data-theme="dark"] .search-highlight {
        background-color: #451a03;
        color: #fbbf24;
      }
      
      /* Sources Styles */
      .message-sources {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid var(--border-color);
      }
      
      .message-sources h4 {
        margin-bottom: 12px;
        color: var(--primary-color);
        font-size: 16px;
      }
      
      .source-item {
        background: var(--background-color);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        border: 1px solid var(--border-color);
        transition: background-color 0.3s;
      }
      
      .source-item:hover {
        background: var(--hover-color);
      }
      
      /* Rating Styles */
      .rating-stars {
        display: inline-flex;
        gap: 2px;
      }
      
      .star {
        font-size: 18px;
        color: #fbbf24;
        transition: transform 0.2s;
      }
      
      .star:hover {
        transform: scale(1.2);
      }
      
      /* Theme Toggle */
      .theme-toggle {
        position: fixed;
        top: 20px;
        ${isArabic ? 'left' : 'right'}: 20px;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1000;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .theme-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      
      /* Print Styles */
      @media print {
        .search-panel,
        .table-of-contents,
        .message-actions,
        .theme-toggle {
          display: none !important;
        }
        
        .container {
          grid-template-columns: 1fr;
          max-width: none;
        }
        
        .message {
          page-break-inside: avoid;
          box-shadow: none;
          border: 1px solid #ccc;
        }
      }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        .search-filters {
          flex-direction: column;
          align-items: stretch;
        }
        
        .search-filter,
        .search-option {
          width: 100%;
        }
        
        .message-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        
        .main-content {
          padding: 20px;
        }
      }
    </style>`
  }

  /**
   * Generate JavaScript for interactive features
   */
  private generateJavaScript(isArabic: boolean): string {
    return `
    <script>
      // Search functionality
      const searchInput = document.getElementById('searchInput');
      const searchButton = document.getElementById('searchButton');
      const clearButton = document.getElementById('clearSearch');
      const searchResults = document.getElementById('searchResults');
      const messagesContainer = document.getElementById('messagesContainer');
      
      let searchHighlights = [];
      
      function performSearch() {
        const query = searchInput.value.trim();
        const searchType = document.getElementById('searchType').value;
        const caseSensitive = document.getElementById('caseSensitive').checked;
        const wholeWords = document.getElementById('wholeWords').checked;
        
        // Clear previous highlights
        clearHighlights();
        
        if (!query) {
          searchResults.style.display = 'none';
          clearButton.style.display = 'none';
          return;
        }
        
        clearButton.style.display = 'block';
        
        // Build search regex
        let flags = caseSensitive ? 'g' : 'gi';
        let pattern = wholeWords ? \`\\\\b\${escapeRegex(query)}\\\\b\` : escapeRegex(query);
        let regex = new RegExp(pattern, flags);
        
        // Find matches
        let matches = [];
        const messages = document.querySelectorAll('.message');
        
        messages.forEach((message, index) => {
          const messageRole = message.classList.contains('message-user') ? 'user' : 'assistant';
          
          if (searchType !== 'all' && searchType !== messageRole) {
            return;
          }
          
          const contentElement = message.querySelector('.message-content');
          const sourcesElements = message.querySelectorAll('.source-item');
          
          // Search in message content
          if (searchType !== 'sources') {
            const content = contentElement.textContent;
            const contentMatches = [...content.matchAll(regex)];
            
            contentMatches.forEach(match => {
              matches.push({
                element: message,
                type: 'message',
                role: messageRole,
                index: match.index,
                text: match[0],
                context: getContext(content, match.index, 50)
              });
            });
            
            // Highlight matches in content
            if (contentMatches.length > 0) {
              highlightInElement(contentElement, regex);
            }
          }
          
          // Search in sources
          if (searchType === 'all' || searchType === 'sources') {
            sourcesElements.forEach(sourceElement => {
              const sourceText = sourceElement.textContent;
              const sourceMatches = [...sourceText.matchAll(regex)];
              
              sourceMatches.forEach(match => {
                matches.push({
                  element: message,
                  type: 'source',
                  role: messageRole,
                  index: match.index,
                  text: match[0],
                  context: getContext(sourceText, match.index, 30)
                });
              });
              
              if (sourceMatches.length > 0) {
                highlightInElement(sourceElement, regex);
              }
            });
          }
        });
        
        // Display results
        displaySearchResults(matches, query);
      }
      
      function clearHighlights() {
        searchHighlights.forEach(element => {
          const parent = element.parentNode;
          parent.replaceChild(document.createTextNode(element.textContent), element);
          parent.normalize();
        });
        searchHighlights = [];
      }
      
      function highlightInElement(element, regex) {
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        textNodes.forEach(textNode => {
          const matches = [...textNode.textContent.matchAll(regex)];
          if (matches.length > 0) {
            highlightTextNode(textNode, matches);
          }
        });
      }
      
      function highlightTextNode(textNode, matches) {
        const text = textNode.textContent;
        const parent = textNode.parentNode;
        let lastIndex = 0;
        
        matches.forEach(match => {
          // Add text before match
          if (match.index > lastIndex) {
            parent.insertBefore(
              document.createTextNode(text.slice(lastIndex, match.index)),
              textNode
            );
          }
          
          // Add highlighted match
          const highlight = document.createElement('span');
          highlight.className = 'search-highlight';
          highlight.textContent = match[0];
          parent.insertBefore(highlight, textNode);
          searchHighlights.push(highlight);
          
          lastIndex = match.index + match[0].length;
        });
        
        // Add remaining text
        if (lastIndex < text.length) {
          parent.insertBefore(
            document.createTextNode(text.slice(lastIndex)),
            textNode
          );
        }
        
        parent.removeChild(textNode);
      }
      
      function displaySearchResults(matches, query) {
        const isArabic = ${isArabic};
        
        if (matches.length === 0) {
          searchResults.innerHTML = \`
            <div class="no-results">
              \${isArabic ? 'لا توجد نتائج لـ' : 'No results for'} "\${escapeHtml(query)}"
            </div>
          \`;
        } else {
          const resultItems = matches.slice(0, 20).map((match, index) => \`
            <div class="search-result-item" onclick="scrollToMatch(\${match.element.id})">
              <div class="result-type">\${isArabic ? (match.type === 'message' ? 'رسالة' : 'مصدر') : (match.type === 'message' ? 'Message' : 'Source')} - \${match.role}</div>
              <div class="result-context">...\${escapeHtml(match.context)}...</div>
            </div>
          \`).join('');
          
          searchResults.innerHTML = \`
            <div class="search-summary">
              \${isArabic ? \`تم العثور على \${matches.length} نتيجة لـ\` : \`Found \${matches.length} results for\`} "\${escapeHtml(query)}"
            </div>
            \${resultItems}
          \`;
        }
        
        searchResults.style.display = 'block';
      }
      
      function scrollToMatch(messageId) {
        const element = document.getElementById(messageId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.backgroundColor = 'var(--hover-color)';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
      }
      
      function getContext(text, index, length) {
        const start = Math.max(0, index - length);
        const end = Math.min(text.length, index + length);
        return text.slice(start, end);
      }
      
      function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      // Event listeners
      searchInput.addEventListener('input', debounce(performSearch, 300));
      searchButton.addEventListener('click', performSearch);
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        clearHighlights();
        searchResults.style.display = 'none';
        clearButton.style.display = 'none';
      });
      
      document.getElementById('searchType').addEventListener('change', performSearch);
      document.getElementById('caseSensitive').addEventListener('change', performSearch);
      document.getElementById('wholeWords').addEventListener('change', performSearch);
      
      // Copy functionality
      document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', async (e) => {
          const targetId = e.target.closest('button').dataset.copyTarget;
          const targetElement = document.getElementById(targetId);
          
          if (targetElement) {
            try {
              await navigator.clipboard.writeText(targetElement.textContent);
              
              // Visual feedback
              const originalText = button.innerHTML;
              button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"></polyline></svg>';
              button.style.color = 'var(--success-color)';
              
              setTimeout(() => {
                button.innerHTML = originalText;
                button.style.color = '';
              }, 2000);
            } catch (err) {
              console.error('Failed to copy text: ', err);
            }
          }
        });
      });
      
      // Table of contents navigation
      document.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', () => {
          const messageIndex = item.dataset.messageIndex;
          const messageElement = document.getElementById(\`message-\${messageIndex}\`);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });
      
      // Theme toggle
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          const html = document.documentElement;
          const currentTheme = html.dataset.theme;
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          html.dataset.theme = newTheme;
          localStorage.setItem('exportTheme', newTheme);
        });
      }
      
      // Load saved theme
      const savedTheme = localStorage.getItem('exportTheme');
      if (savedTheme) {
        document.documentElement.dataset.theme = savedTheme;
      }
      
      // Utility function
      function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
          const later = () => {
            clearTimeout(timeout);
            func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      }
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'f':
              e.preventDefault();
              searchInput.focus();
              break;
            case 'p':
              e.preventDefault();
              window.print();
              break;
          }
        }
      });
      
      console.log('HR Export Interactive Features Loaded');
    </script>`
  }

  /**
   * Generate theme colors
   */
  private getThemeColors(theme: string): Record<string, string> {
    if (theme === 'dark') {
      return {
        primary: '#f3f4f6',
        secondary: '#60a5fa',
        accent: '#34d399',
        background: '#111827',
        surface: '#1f2937',
        text: '#f9fafb',
        textSecondary: '#d1d5db',
        border: '#374151',
        hover: '#374151'
      }
    } else {
      return {
        primary: '#1f2937',
        secondary: '#3b82f6',
        accent: '#10b981',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#111827',
        textSecondary: '#6b7280',
        border: '#e5e7eb',
        hover: '#f3f4f6'
      }
    }
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

  private formatTime(dateString: string, isArabic: boolean): string {
    const date = new Date(dateString)
    return date.toLocaleTimeString(isArabic ? 'ar-SA' : 'en-US', {
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
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
    }
    return this.escapeHtml(content).replace(/\n/g, '<br>')
  }

  private generateInteractiveStars(rating: number): string {
    return Array.from({ length: 5 }, (_, i) => 
      `<span class="star ${i < rating ? 'filled' : 'empty'}">${i < rating ? '★' : '☆'}</span>`
    ).join('')
  }

  private generateFilename(type: string, title: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('T')[0]
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').slice(0, 50)
    return `${type}-${sanitizedTitle}-${timestamp}.${extension}`
  }

  // Additional helper methods for bulk exports, compliance sections, etc.
  private generateBulkSearchPanel(conversations: ConversationExportData[], isArabic: boolean): string {
    return `
    <div class="search-panel bulk-search">
      <div class="search-container">
        <input 
          type="text" 
          id="bulkSearchInput" 
          placeholder="${isArabic ? 'البحث في جميع المحادثات...' : 'Search all conversations...'}"
          class="search-input"
        >
        <button id="bulkSearchButton" class="search-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      </div>
      <div class="bulk-filters">
        <select id="conversationFilter" class="search-filter">
          <option value="all">${isArabic ? 'جميع المحادثات' : 'All Conversations'}</option>
          ${conversations.map(conv => `
            <option value="${conv.id}">${this.escapeHtml(conv.title)}</option>
          `).join('')}
        </select>
      </div>
    </div>`
  }

  private generateBulkTableOfContents(conversations: ConversationExportData[], isArabic: boolean): string {
    const tocItems = conversations.map((conversation, index) => `
      <div class="toc-conversation" data-conversation-index="${index}">
        <div class="toc-conversation-title">${this.escapeHtml(conversation.title)}</div>
        <div class="toc-conversation-info">
          <span>${conversation.messages.length} ${isArabic ? 'رسالة' : 'messages'}</span>
          <span>${this.formatDate(conversation.created_at, isArabic)}</span>
        </div>
      </div>
    `).join('')

    return `
    <nav class="bulk-table-of-contents">
      <h3>${isArabic ? 'فهرس المحادثات' : 'Conversations Index'}</h3>
      <div class="bulk-toc-items">
        ${tocItems}
      </div>
    </nav>`
  }

  private generateBulkJavaScript(isArabic: boolean): string {
    return `
    <script>
      // Enhanced bulk search functionality
      // Similar to single conversation but with conversation filtering
      ${this.generateJavaScript(isArabic)}
      
      // Additional bulk-specific features
      console.log('Bulk Export Interactive Features Loaded');
    </script>`
  }

  private generateMetadataSection(conversation: ConversationExportData, options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    
    return `
    <div class="metadata-section">
      <div class="metadata-grid">
        <div class="meta-item">
          <span class="meta-label">${isArabic ? 'الفئة:' : 'Category:'}</span>
          <span class="meta-value">${this.translateCategory(conversation.category, isArabic)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">${isArabic ? 'اللغة:' : 'Language:'}</span>
          <span class="meta-value">${conversation.language === 'ar' ? 'العربية' : 'English'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">${isArabic ? 'المستخدم:' : 'User:'}</span>
          <span class="meta-value">${this.escapeHtml(conversation.user.full_name || conversation.user.email || 'Unknown')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">${isArabic ? 'عدد الرسائل:' : 'Messages:'}</span>
          <span class="meta-value">${conversation.messages.length}</span>
        </div>
      </div>
    </div>`
  }

  private generateInteractiveSourcesHTML(sources: any[], isArabic: boolean): string {
    return sources.map((source, index) => `
    <div class="source-item interactive-source" data-source-index="${index}">
      <div class="source-header">
        <span class="source-document">${this.escapeHtml(source.document_name)}</span>
        <span class="source-relevance">${Math.round(source.relevance_score * 100)}%</span>
      </div>
      ${source.page_number ? `<div class="source-page">${isArabic ? 'الصفحة:' : 'Page:'} ${source.page_number}</div>` : ''}
      ${source.citation_text ? `<div class="source-citation">"${this.escapeHtml(source.citation_text)}"</div>` : ''}
      <button class="source-expand" onclick="toggleSourceContent(${index})">
        ${isArabic ? 'عرض المزيد' : 'Show More'}
      </button>
      <div class="source-full-content" id="source-content-${index}" style="display: none;">
        ${this.escapeHtml(source.chunk_content)}
      </div>
    </div>
    `).join('')
  }

  private generateMessageMetadata(message: any, isArabic: boolean): string {
    return `
    <div class="message-metadata">
      ${message.model_used ? `<span class="meta-badge">${isArabic ? 'النموذج:' : 'Model:'} ${message.model_used}</span>` : ''}
      ${message.tokens_used ? `<span class="meta-badge">${isArabic ? 'الرموز:' : 'Tokens:'} ${message.tokens_used}</span>` : ''}
      ${message.response_time_ms ? `<span class="meta-badge">${isArabic ? 'وقت الاستجابة:' : 'Response Time:'} ${message.response_time_ms}ms</span>` : ''}
      ${message.confidence_score ? `<span class="meta-badge">${isArabic ? 'درجة الثقة:' : 'Confidence:'} ${Math.round(message.confidence_score * 100)}%</span>` : ''}
    </div>`
  }

  private generateComplianceSection(conversation: any, isArabic: boolean): string {
    if (!conversation.compliance) return ''
    
    return `
    <section class="compliance-section">
      <h3>${isArabic ? 'تحليل الامتثال' : 'Compliance Analysis'}</h3>
      <div class="compliance-grid">
        <div class="compliance-score">
          <span class="score-label">${isArabic ? 'النتيجة الإجمالية:' : 'Overall Score:'}</span>
          <span class="score-value">${Math.round(conversation.compliance.overall_score * 100)}%</span>
        </div>
        <div class="compliance-details">
          ${conversation.compliance.recommendations ? `
          <div class="recommendations">
            <h4>${isArabic ? 'التوصيات:' : 'Recommendations:'}</h4>
            <ul>
              ${conversation.compliance.recommendations.map((rec: string) => `<li>${this.escapeHtml(rec)}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
    </section>`
  }

  private generateCostSection(conversation: any, isArabic: boolean): string {
    if (!conversation.costBreakdown) return ''
    
    return `
    <section class="cost-section">
      <h3>${isArabic ? 'تفاصيل التكلفة' : 'Cost Breakdown'}</h3>
      <div class="cost-grid">
        <div class="cost-item">
          <span class="cost-label">${isArabic ? 'التكلفة الإجمالية:' : 'Total Cost:'}</span>
          <span class="cost-value">$${conversation.costBreakdown.total_cost.toFixed(4)}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">${isArabic ? 'رموز الإدخال:' : 'Input Tokens:'}</span>
          <span class="cost-value">${conversation.costBreakdown.input_tokens}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">${isArabic ? 'رموز الإخراج:' : 'Output Tokens:'}</span>
          <span class="cost-value">${conversation.costBreakdown.output_tokens}</span>
        </div>
      </div>
    </section>`
  }

  private generateHeader(options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const branding = this.defaultBranding
    
    if (!options.organizationBranding) return ''
    
    return `
    <header class="document-header">
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
        ${options.interactiveFeatures ? `
        <button class="theme-toggle" title="${isArabic ? 'تبديل المظهر' : 'Toggle Theme'}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
          </svg>
        </button>
        ` : ''}
      </div>
    </header>`
  }

  private generateSidebar(conversation: ConversationExportData, options: ExportOptions): string {
    return `
    <aside class="sidebar">
      ${options.includeSearch ? this.generateSearchPanel(options.language === 'ar') : ''}
      ${options.includeTableOfContents ? this.generateTableOfContents(conversation, options.language === 'ar') : ''}
    </aside>`
  }

  private generateFooter(options: ExportOptions): string {
    const isArabic = options.language === 'ar'
    const currentDate = new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')
    
    return `
    <footer class="document-footer">
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
    </footer>`
  }
}

export { HTMLGenerator }