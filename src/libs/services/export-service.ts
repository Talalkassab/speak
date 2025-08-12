/**
 * Export Service for Conversations
 * Handles exporting conversations to PDF and Word formats
 * Supports Arabic RTL, bulk exports, and source citations
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/libs/supabase/types'

type SupabaseClient = ReturnType<typeof createClientComponentClient<Database>>

export interface ConversationExportData {
  id: string
  title: string
  category: string
  language: string
  created_at: string
  updated_at: string
  organization_id: string
  user: {
    id: string
    full_name: string | null
    email?: string
  }
  messages: MessageExportData[]
  metadata?: Record<string, any>
}

export interface MessageExportData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type: string
  language: string
  tokens_used: number | null
  model_used: string | null
  response_time_ms: number | null
  confidence_score: number | null
  user_rating: number | null
  user_feedback: string | null
  created_at: string
  sources: SourceExportData[]
}

export interface SourceExportData {
  document_id: string
  document_name: string
  chunk_content: string
  relevance_score: number
  citation_text: string | null
  page_number: number | null
}

export interface ExportOptions {
  format: 'pdf' | 'docx' | 'html' | 'email'
  includeMetadata: boolean
  includeSources: boolean
  includeUserFeedback: boolean
  includeComplianceAnalysis?: boolean
  includeCostBreakdown?: boolean
  language: 'ar' | 'en'
  template?: 'default' | 'legal' | 'executive' | 'compliance' | 'custom'
  customTemplateId?: string
  watermark?: string
  organizationBranding?: boolean
  redactSensitive?: boolean
  emailRecipients?: string[]
  compressionFormat?: 'zip' | 'none'
  digitalSignature?: boolean
  includeSearch?: boolean
  includeTableOfContents?: boolean
  customCSS?: string
  theme?: 'light' | 'dark' | 'auto'
  interactiveFeatures?: boolean
}

export interface BulkExportOptions extends ExportOptions {
  conversationIds: string[]
  dateFrom?: string
  dateTo?: string
  category?: string
  userId?: string
  maxConversations?: number
}

export interface ExportJobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalItems: number
  processedItems: number
  downloadUrl?: string
  errorMessage?: string
  created_at: string
  estimated_completion?: string
}

class ExportService {
  private supabase: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClientComponentClient<Database>()
  }

  /**
   * Export a single conversation
   */
  async exportSingleConversation(
    conversationId: string,
    options: ExportOptions,
    organizationId: string
  ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    try {
      // Fetch conversation data
      const conversationData = await this.getConversationExportData(conversationId, organizationId)
      
      if (!conversationData) {
        return { success: false, error: 'Conversation not found' }
      }

      // Generate export based on format
      let exportResult: { buffer: Buffer; filename: string; mimeType: string }
      
      if (options.format === 'pdf') {
        const { PDFGenerator } = await import('@/libs/export/pdf-generator')
        const pdfGenerator = new PDFGenerator()
        exportResult = await pdfGenerator.generateConversationPDF(conversationData, options)
      } else if (options.format === 'docx') {
        const { DocxGenerator } = await import('@/libs/export/docx-generator')
        const docxGenerator = new DocxGenerator()
        exportResult = await docxGenerator.generateConversationDocx(conversationData, options)
      } else if (options.format === 'html') {
        const { HTMLGenerator } = await import('@/libs/export/html-generator')
        const htmlGenerator = new HTMLGenerator()
        exportResult = await htmlGenerator.generateConversationHTML(conversationData, options)
      } else {
        throw new Error(`Unsupported export format: ${options.format}`)
      }

      // Upload to storage and return download URL
      const downloadUrl = await this.uploadExportToStorage(
        exportResult.buffer,
        exportResult.filename,
        exportResult.mimeType,
        organizationId
      )

      // Log export activity
      await this.logExportActivity(organizationId, 'single', options.format, [conversationId])

      return { success: true, downloadUrl }
    } catch (error) {
      console.error('Export single conversation error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' }
    }
  }

  /**
   * Export multiple conversations (bulk export)
   */
  async exportBulkConversations(
    options: BulkExportOptions,
    organizationId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Create export job
      const jobId = await this.createExportJob(organizationId, options)
      
      // Queue for background processing
      await this.queueBulkExport(jobId, options, organizationId)
      
      return { success: true, jobId }
    } catch (error) {
      console.error('Bulk export error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Bulk export failed' }
    }
  }

  /**
   * Get export job status
   */
  async getExportJobStatus(jobId: string, organizationId: string): Promise<ExportJobStatus | null> {
    try {
      const { data, error } = await this.supabase
        .from('export_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('organization_id', organizationId)
        .single()

      if (error) throw error

      return data as ExportJobStatus
    } catch (error) {
      console.error('Get export job status error:', error)
      return null
    }
  }

  /**
   * Get conversation data for export
   */
  private async getConversationExportData(
    conversationId: string, 
    organizationId: string
  ): Promise<ConversationExportData | null> {
    try {
      // Get conversation with user info
      const { data: conversation, error: convError } = await this.supabase
        .from('conversations')
        .select(`
          id,
          title,
          category,
          language,
          created_at,
          updated_at,
          organization_id,
          metadata,
          user_id
        `)
        .eq('id', conversationId)
        .eq('organization_id', organizationId)
        .single()

      if (convError) throw convError

      // Get user info
      const { data: userData } = await this.supabase.auth.getUser()
      const user = {
        id: conversation.user_id,
        full_name: userData.user?.user_metadata?.full_name || null,
        email: userData.user?.email
      }

      // Get messages with sources
      const { data: messages, error: messagesError } = await this.supabase
        .from('messages')
        .select(`
          id,
          role,
          content,
          content_type,
          language,
          tokens_used,
          model_used,
          response_time_ms,
          confidence_score,
          user_rating,
          user_feedback,
          created_at,
          sources_used
        `)
        .eq('conversation_id', conversationId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      // Get message sources
      const messagesWithSources = await Promise.all(
        messages.map(async (message) => {
          const { data: sources } = await this.supabase
            .from('message_sources')
            .select(`
              document_id,
              relevance_score,
              citation_text,
              page_number,
              documents(name),
              document_chunks(content)
            `)
            .eq('message_id', message.id)
            .eq('organization_id', organizationId)

          const sourcesFormatted: SourceExportData[] = (sources || []).map(source => ({
            document_id: source.document_id,
            document_name: (source as any).documents?.name || 'Unknown Document',
            chunk_content: (source as any).document_chunks?.content || '',
            relevance_score: source.relevance_score,
            citation_text: source.citation_text,
            page_number: source.page_number
          }))

          return {
            ...message,
            sources: sourcesFormatted
          } as MessageExportData
        })
      )

      return {
        ...conversation,
        user,
        messages: messagesWithSources
      } as ConversationExportData

    } catch (error) {
      console.error('Get conversation export data error:', error)
      return null
    }
  }

  /**
   * Upload export file to storage
   */
  private async uploadExportToStorage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    organizationId: string
  ): Promise<string> {
    const path = `exports/${organizationId}/${Date.now()}-${filename}`
    
    const { data, error } = await this.supabase.storage
      .from('exports')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false
      })

    if (error) throw error

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('exports')
      .getPublicUrl(path)

    return urlData.publicUrl
  }

  /**
   * Create export job record
   */
  private async createExportJob(organizationId: string, options: BulkExportOptions): Promise<string> {
    const { data, error } = await this.supabase
      .from('export_jobs')
      .insert({
        organization_id: organizationId,
        type: 'bulk',
        format: options.format,
        status: 'pending',
        options: options,
        total_items: options.conversationIds.length,
        processed_items: 0,
        progress: 0
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  /**
   * Queue bulk export for background processing
   */
  private async queueBulkExport(jobId: string, options: BulkExportOptions, organizationId: string): Promise<void> {
    // This would integrate with a queue system like Bull/BullMQ
    // For now, we'll process immediately in a separate thread
    setTimeout(() => {
      this.processBulkExport(jobId, options, organizationId)
    }, 100)
  }

  /**
   * Process bulk export (background job)
   */
  private async processBulkExport(jobId: string, options: BulkExportOptions, organizationId: string): Promise<void> {
    try {
      // Update job status to processing
      await this.updateExportJobStatus(jobId, 'processing', 0)

      const conversations: ConversationExportData[] = []
      
      // Fetch all conversations
      for (let i = 0; i < options.conversationIds.length; i++) {
        const conversationData = await this.getConversationExportData(options.conversationIds[i], organizationId)
        if (conversationData) {
          conversations.push(conversationData)
        }
        
        // Update progress
        const progress = Math.floor((i + 1) / options.conversationIds.length * 100)
        await this.updateExportJobStatus(jobId, 'processing', progress, i + 1)
      }

      // Generate combined export
      let exportResult: { buffer: Buffer; filename: string; mimeType: string }
      
      if (options.format === 'pdf') {
        const { PDFGenerator } = await import('@/libs/export/pdf-generator')
        const pdfGenerator = new PDFGenerator()
        exportResult = await pdfGenerator.generateBulkPDF(conversations, options)
      } else {
        const { DocxGenerator } = await import('@/libs/export/docx-generator')
        const docxGenerator = new DocxGenerator()
        exportResult = await docxGenerator.generateBulkDocx(conversations, options)
      }

      // Upload result
      const downloadUrl = await this.uploadExportToStorage(
        exportResult.buffer,
        exportResult.filename,
        exportResult.mimeType,
        organizationId
      )

      // Update job as completed
      await this.updateExportJobStatus(jobId, 'completed', 100, options.conversationIds.length, downloadUrl)

      // Log export activity
      await this.logExportActivity(organizationId, 'bulk', options.format, options.conversationIds)

    } catch (error) {
      console.error('Process bulk export error:', error)
      await this.updateExportJobStatus(jobId, 'failed', 0, 0, undefined, error instanceof Error ? error.message : 'Processing failed')
    }
  }

  /**
   * Update export job status
   */
  private async updateExportJobStatus(
    jobId: string,
    status: ExportJobStatus['status'],
    progress: number,
    processedItems = 0,
    downloadUrl?: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      progress,
      processed_items: processedItems,
      updated_at: new Date().toISOString()
    }

    if (downloadUrl) updateData.download_url = downloadUrl
    if (errorMessage) updateData.error_message = errorMessage
    if (status === 'completed') updateData.completed_at = new Date().toISOString()

    await this.supabase
      .from('export_jobs')
      .update(updateData)
      .eq('id', jobId)
  }

  /**
   * Log export activity for analytics
   */
  private async logExportActivity(
    organizationId: string,
    exportType: 'single' | 'bulk',
    format: 'pdf' | 'docx',
    conversationIds: string[]
  ): Promise<void> {
    try {
      await this.supabase
        .from('user_activity_logs')
        .insert({
          organization_id: organizationId,
          user_id: (await this.supabase.auth.getUser()).data.user?.id,
          action: `export_${exportType}`,
          resource_type: 'conversation',
          details: {
            format,
            conversation_count: conversationIds.length,
            conversation_ids: conversationIds
          }
        })
    } catch (error) {
      console.error('Log export activity error:', error)
    }
  }

  /**
   * Get export analytics for organization
   */
  async getExportAnalytics(organizationId: string, dateFrom?: string, dateTo?: string) {
    try {
      let query = this.supabase
        .from('user_activity_logs')
        .select('action, details, created_at')
        .eq('organization_id', organizationId)
        .in('action', ['export_single', 'export_bulk'])

      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)

      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error

      // Process analytics data
      const analytics = {
        totalExports: data.length,
        pdfExports: data.filter(log => (log.details as any)?.format === 'pdf').length,
        docxExports: data.filter(log => (log.details as any)?.format === 'docx').length,
        singleExports: data.filter(log => log.action === 'export_single').length,
        bulkExports: data.filter(log => log.action === 'export_bulk').length,
        totalConversationsExported: data.reduce((sum, log) => sum + ((log.details as any)?.conversation_count || 0), 0)
      }

      return { success: true, analytics }
    } catch (error) {
      console.error('Get export analytics error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Analytics fetch failed' }
    }
  }

  /**
   * Export conversations via email
   */
  async exportViaEmail(
    conversationIds: string[],
    options: ExportOptions,
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!options.emailRecipients || options.emailRecipients.length === 0) {
        return { success: false, error: 'No email recipients specified' }
      }

      // Generate the export file first
      let fileResult
      if (conversationIds.length === 1) {
        fileResult = await this.exportSingleConversation(
          conversationIds[0], 
          { ...options, format: 'pdf' }, // Default to PDF for email
          organizationId
        )
      } else {
        fileResult = await this.exportBulkConversations(
          { ...options, conversationIds, format: 'pdf' },
          organizationId
        )
      }

      if (!fileResult.success || !fileResult.downloadUrl) {
        return { success: false, error: 'Failed to generate export file for email' }
      }

      // Send email with attachment (would need EmailService implementation)
      console.log('Email export would be sent to:', options.emailRecipients)
      
      // Log email export
      await this.logExportActivity(organizationId, 'email', 'pdf', conversationIds)

      return { success: true }
    } catch (error) {
      console.error('Email export error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Email export failed' }
    }
  }

  /**
   * Apply sensitive data redaction
   */
  private redactSensitiveData(content: string): string {
    // Redact common sensitive patterns
    const patterns = [
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '****-****-****-****' }, // Credit cards
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '***-**-****' }, // SSN format
      { pattern: /\b\d{10}\b/g, replacement: '**********' }, // Phone numbers
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '***@***.***' }, // Emails
      { pattern: /\b\d{14}\b/g, replacement: '**************' }, // Saudi national IDs
      { pattern: /\bIBAN\s*[A-Z0-9]{15,34}\b/gi, replacement: 'IBAN **************' }, // IBAN numbers
    ]
    
    let redactedContent = content
    patterns.forEach(({ pattern, replacement }) => {
      redactedContent = redactedContent.replace(pattern, replacement)
    })
    
    return redactedContent
  }
}

export default ExportService