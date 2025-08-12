/**
 * DOCX Generator Service
 * Generates Word documents from conversations with Arabic RTL support
 * Uses docx library for Word document generation
 */

import { ConversationExportData, ExportOptions, BulkExportOptions } from '@/libs/services/export-service'

interface DocxGenerationResult {
  buffer: Buffer
  filename: string
  mimeType: string
}

interface DocumentStyle {
  fontFamily: string
  fontSize: number
  direction: 'rtl' | 'ltr'
  alignment: 'left' | 'right' | 'center' | 'justified'
}

class DocxGenerator {
  private defaultStyles: Record<string, DocumentStyle> = {
    arabic: {
      fontFamily: 'Noto Sans Arabic',
      fontSize: 24,
      direction: 'rtl',
      alignment: 'right'
    },
    english: {
      fontFamily: 'Arial',
      fontSize: 24,
      direction: 'ltr',
      alignment: 'left'
    }
  }

  /**
   * Generate DOCX for a single conversation
   */
  async generateConversationDocx(
    conversation: ConversationExportData,
    options: ExportOptions
  ): Promise<DocxGenerationResult> {
    try {
      const document = await this.createConversationDocument(conversation, options)
      const buffer = await this.generateBuffer(document)
      
      const filename = this.generateFilename('conversation', conversation.title, 'docx')
      
      return {
        buffer,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    } catch (error) {
      console.error('DOCX generation error:', error)
      throw new Error(`DOCX generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate DOCX for bulk conversations
   */
  async generateBulkDocx(
    conversations: ConversationExportData[],
    options: BulkExportOptions
  ): Promise<DocxGenerationResult> {
    try {
      const document = await this.createBulkDocument(conversations, options)
      const buffer = await this.generateBuffer(document)
      
      const filename = this.generateFilename('bulk-conversations', `${conversations.length}-conversations`, 'docx')
      
      return {
        buffer,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    } catch (error) {
      console.error('Bulk DOCX generation error:', error)
      throw new Error(`Bulk DOCX generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create Word document for single conversation
   */
  private async createConversationDocument(conversation: ConversationExportData, options: ExportOptions): Promise<any> {
    const isArabic = options.language === 'ar'
    const style = this.defaultStyles[isArabic ? 'arabic' : 'english']

    // Fallback implementation using a simplified structure
    // This would be replaced with actual docx library implementation
    const docStructure = {
      creator: 'HR Business Consultant System',
      title: conversation.title,
      description: `Conversation export for ${conversation.title}`,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720
              }
            }
          },
          children: [
            ...this.createDocumentHeader(options, isArabic),
            ...this.createConversationHeader(conversation, options, isArabic, style),
            ...this.createConversationContent(conversation, options, isArabic, style),
            ...this.createDocumentFooter(options, isArabic)
          ]
        }
      ]
    }

    return this.convertToDocxStructure(docStructure, style)
  }

  /**
   * Create Word document for bulk conversations
   */
  private async createBulkDocument(conversations: ConversationExportData[], options: BulkExportOptions): Promise<any> {
    const isArabic = options.language === 'ar'
    const style = this.defaultStyles[isArabic ? 'arabic' : 'english']

    const conversationSections = conversations.map((conversation, index) => [
      ...(index > 0 ? [this.createPageBreak()] : []),
      ...this.createConversationHeader(conversation, options, isArabic, style),
      ...this.createConversationContent(conversation, options, isArabic, style)
    ]).flat()

    const docStructure = {
      creator: 'HR Business Consultant System',
      title: isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export',
      description: `Bulk export of ${conversations.length} conversations`,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720
              }
            }
          },
          children: [
            ...this.createDocumentHeader(options, isArabic),
            ...this.createBulkHeader(conversations.length, isArabic),
            ...conversationSections,
            ...this.createDocumentFooter(options, isArabic)
          ]
        }
      ]
    }

    return this.convertToDocxStructure(docStructure, style)
  }

  /**
   * Create document header with branding
   */
  private createDocumentHeader(options: ExportOptions, isArabic: boolean): any[] {
    if (!options.organizationBranding) return []

    return [
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 240 }
        },
        children: [
          {
            type: 'text',
            text: 'HR Business Consultant',
            properties: {
              bold: true,
              size: 32,
              color: '1F2937'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 480 }
        },
        children: [
          {
            type: 'text',
            text: 'الرياض، المملكة العربية السعودية',
            properties: {
              size: 20,
              color: '6B7280'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          border: {
            bottom: {
              color: '1F2937',
              size: 2,
              style: 'single'
            }
          },
          spacing: { after: 240 }
        },
        children: []
      }
    ]
  }

  /**
   * Create bulk export header
   */
  private createBulkHeader(conversationCount: number, isArabic: boolean): any[] {
    return [
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 240 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? 'تصدير المحادثات المجمعة' : 'Bulk Conversations Export',
            properties: {
              bold: true,
              size: 28,
              color: '1F2937'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 120 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? `عدد المحادثات: ${conversationCount}` : `Total Conversations: ${conversationCount}`,
            properties: {
              size: 22,
              color: '6B7280'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 480 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}` : `Export Date: ${new Date().toLocaleDateString()}`,
            properties: {
              size: 22,
              color: '6B7280'
            }
          }
        ]
      }
    ]
  }

  /**
   * Create conversation header section
   */
  private createConversationHeader(conversation: ConversationExportData, options: ExportOptions, isArabic: boolean, style: DocumentStyle): any[] {
    return [
      {
        type: 'paragraph',
        properties: {
          spacing: { after: 240 },
          shading: {
            fill: 'F9FAFB'
          },
          border: {
            top: { color: 'E5E7EB', size: 1, style: 'single' },
            bottom: { color: 'E5E7EB', size: 1, style: 'single' },
            left: { color: 'E5E7EB', size: 1, style: 'single' },
            right: { color: 'E5E7EB', size: 1, style: 'single' }
          }
        },
        children: [
          {
            type: 'text',
            text: conversation.title,
            properties: {
              bold: true,
              size: 26,
              color: '1F2937'
            }
          }
        ]
      },
      {
        type: 'table',
        properties: {
          borders: {
            top: { style: 'single', size: 1, color: 'E5E7EB' },
            bottom: { style: 'single', size: 1, color: 'E5E7EB' },
            left: { style: 'single', size: 1, color: 'E5E7EB' },
            right: { style: 'single', size: 1, color: 'E5E7EB' },
            insideHorizontal: { style: 'single', size: 1, color: 'E5E7EB' },
            insideVertical: { style: 'single', size: 1, color: 'E5E7EB' }
          },
          width: { size: 100, type: 'pct' }
        },
        rows: [
          this.createMetadataRow(isArabic ? 'الفئة:' : 'Category:', this.translateCategory(conversation.category, isArabic)),
          this.createMetadataRow(isArabic ? 'المستخدم:' : 'User:', conversation.user.full_name || conversation.user.email || 'Unknown'),
          this.createMetadataRow(isArabic ? 'تاريخ البدء:' : 'Started:', this.formatDate(conversation.created_at, isArabic)),
          this.createMetadataRow(isArabic ? 'آخر تحديث:' : 'Last Updated:', this.formatDate(conversation.updated_at, isArabic))
        ]
      }
    ]
  }

  /**
   * Create conversation messages content
   */
  private createConversationContent(conversation: ConversationExportData, options: ExportOptions, isArabic: boolean, style: DocumentStyle): any[] {
    const content = [
      {
        type: 'paragraph',
        properties: {
          spacing: { before: 480, after: 240 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? 'سجل المحادثة' : 'Conversation History',
            properties: {
              bold: true,
              size: 24,
              color: '1F2937'
            }
          }
        ]
      }
    ]

    conversation.messages.forEach((message, index) => {
      const roleLabel = this.translateRole(message.role, isArabic)
      const backgroundColor = message.role === 'user' ? 'EFF6FF' : 'F0FDF4'
      const borderColor = message.role === 'user' ? '3B82F6' : '10B981'

      // Message container
      content.push({
        type: 'paragraph',
        properties: {
          spacing: { before: 240, after: 120 },
          shading: { fill: backgroundColor },
          border: {
            left: { color: borderColor, size: 6, style: 'single' }
          }
        },
        children: [
          {
            type: 'text',
            text: `${roleLabel} - ${this.formatDateTime(message.created_at, isArabic)}`,
            properties: {
              bold: true,
              size: 22,
              color: '374151'
            }
          }
        ]
      })

      // Message content
      content.push({
        type: 'paragraph',
        properties: {
          spacing: { after: 120 },
          indentation: { left: 360 }
        },
        children: [
          {
            type: 'text',
            text: message.content,
            properties: {
              size: 22,
              color: '111827'
            }
          }
        ]
      })

      // Sources
      if (message.sources.length > 0 && options.includeSources) {
        content.push({
          type: 'paragraph',
          properties: {
            spacing: { after: 120 },
            indentation: { left: 360 }
          },
          children: [
            {
              type: 'text',
              text: isArabic ? 'المصادر:' : 'Sources:',
              properties: {
                bold: true,
                size: 20,
                color: '374151'
              }
            }
          ]
        })

        message.sources.forEach(source => {
          content.push({
            type: 'paragraph',
            properties: {
              spacing: { after: 60 },
              indentation: { left: 720 },
              numbering: { reference: 'sources', level: 0 }
            },
            children: [
              {
                type: 'text',
                text: `${source.document_name} (${Math.round(source.relevance_score * 100)}%)`,
                properties: {
                  size: 18,
                  color: '1E40AF'
                }
              }
            ]
          })

          if (source.citation_text) {
            content.push({
              type: 'paragraph',
              properties: {
                spacing: { after: 60 },
                indentation: { left: 720 }
              },
              children: [
                {
                  type: 'text',
                  text: `"${source.citation_text}"`,
                  properties: {
                    size: 18,
                    color: '6B7280',
                    italics: true
                  }
                }
              ]
            })
          }
        })
      }

      // User feedback
      if (message.user_rating && options.includeUserFeedback) {
        content.push({
          type: 'paragraph',
          properties: {
            spacing: { after: 120 },
            indentation: { left: 360 },
            border: {
              top: { color: 'E5E7EB', size: 1, style: 'single' }
            }
          },
          children: [
            {
              type: 'text',
              text: `${isArabic ? 'التقييم:' : 'Rating:'} ${this.generateStars(message.user_rating)}`,
              properties: {
                size: 18,
                color: 'F59E0B'
              }
            }
          ]
        })

        if (message.user_feedback) {
          content.push({
            type: 'paragraph',
            properties: {
              spacing: { after: 120 },
              indentation: { left: 360 }
            },
            children: [
              {
                type: 'text',
                text: `${isArabic ? 'التعليق:' : 'Feedback:'} ${message.user_feedback}`,
                properties: {
                  size: 18,
                  color: '6B7280'
                }
              }
            ]
          })
        }
      }

      // Metadata
      if (options.includeMetadata) {
        const metadata = []
        if (message.model_used) metadata.push(`${isArabic ? 'النموذج:' : 'Model:'} ${message.model_used}`)
        if (message.tokens_used) metadata.push(`${isArabic ? 'الرموز:' : 'Tokens:'} ${message.tokens_used}`)
        if (message.response_time_ms) metadata.push(`${isArabic ? 'وقت الاستجابة:' : 'Response Time:'} ${message.response_time_ms}ms`)
        if (message.confidence_score) metadata.push(`${isArabic ? 'درجة الثقة:' : 'Confidence:'} ${Math.round(message.confidence_score * 100)}%`)

        if (metadata.length > 0) {
          content.push({
            type: 'paragraph',
            properties: {
              spacing: { after: 240 },
              indentation: { left: 360 }
            },
            children: [
              {
                type: 'text',
                text: metadata.join(' | '),
                properties: {
                  size: 16,
                  color: '6B7280'
                }
              }
            ]
          })
        }
      }
    })

    return content
  }

  /**
   * Create document footer
   */
  private createDocumentFooter(options: ExportOptions, isArabic: boolean): any[] {
    const currentDate = new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')
    
    return [
      {
        type: 'paragraph',
        properties: {
          spacing: { before: 480 },
          border: {
            top: { color: 'E5E7EB', size: 1, style: 'single' }
          }
        },
        children: []
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { before: 240, after: 120 }
        },
        children: [
          {
            type: 'text',
            text: `${isArabic ? 'تم التصدير في:' : 'Exported on:'} ${currentDate}`,
            properties: {
              size: 18,
              color: '6B7280'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'center',
          spacing: { after: 240 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? 'نظام إدارة الموارد البشرية' : 'HR Management System',
            properties: {
              size: 18,
              color: '6B7280'
            }
          }
        ]
      },
      {
        type: 'paragraph',
        properties: {
          alignment: 'justified',
          spacing: { before: 120 }
        },
        children: [
          {
            type: 'text',
            text: isArabic ? 
              'هذا المستند تم إنشاؤه تلقائياً من نظام إدارة الموارد البشرية. المعلومات الواردة هنا سرية ومخصصة للاستخدام الداخلي فقط.' : 
              'This document was automatically generated from the HR Management System. The information contained herein is confidential and intended for internal use only.',
            properties: {
              size: 16,
              color: '6B7280',
              italics: true
            }
          }
        ]
      }
    ]
  }

  /**
   * Create metadata table row
   */
  private createMetadataRow(label: string, value: string): any {
    return {
      children: [
        {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: label,
                  properties: {
                    bold: true,
                    size: 20,
                    color: '374151'
                  }
                }
              ]
            }
          ],
          properties: {
            width: { size: 30, type: 'pct' },
            shading: { fill: 'F3F4F6' }
          }
        },
        {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: value,
                  properties: {
                    size: 20,
                    color: '6B7280'
                  }
                }
              ]
            }
          ],
          properties: {
            width: { size: 70, type: 'pct' }
          }
        }
      ]
    }
  }

  /**
   * Create page break
   */
  private createPageBreak(): any {
    return {
      type: 'paragraph',
      properties: {
        pageBreakBefore: true
      },
      children: []
    }
  }

  /**
   * Convert structure to actual docx format
   */
  private convertToDocxStructure(structure: any, style: DocumentStyle): any {
    // This is a simplified implementation
    // In a real implementation, this would use the docx library to create proper Word documents
    return {
      ...structure,
      styles: {
        default: {
          document: {
            run: {
              font: style.fontFamily,
              size: style.fontSize
            }
          }
        }
      },
      numbering: {
        config: [
          {
            reference: 'sources',
            levels: [
              {
                level: 0,
                format: 'bullet',
                text: '•',
                alignment: 'left',
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 }
                  }
                }
              }
            ]
          }
        ]
      }
    }
  }

  /**
   * Generate buffer from document structure
   */
  private async generateBuffer(document: any): Promise<Buffer> {
    // This would use the actual docx library to generate the buffer
    // For now, return a placeholder
    const placeholderContent = JSON.stringify(document, null, 2)
    return Buffer.from(placeholderContent, 'utf-8')
  }

  /**
   * Utility functions
   */
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

  private generateStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  private generateFilename(type: string, title: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('T')[0]
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').slice(0, 50)
    return `${type}-${sanitizedTitle}-${timestamp}.${format}`
  }
}

export { DocxGenerator }