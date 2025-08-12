/**
 * Email Service for Export Notifications
 * Handles sending export files via email with professional templates
 * Supports Arabic/English bilingual emails and attachment handling
 */

import { Resend } from 'resend'

interface EmailExportRequest {
  recipients: string[]
  conversationCount: number
  downloadUrl: string
  language: 'ar' | 'en'
  organizationId: string
  exportFormat?: string
  exportSize?: number
  expirationDate?: string
}

interface EmailResult {
  success: boolean
  error?: string
  messageIds?: string[]
}

class EmailService {
  private resend: Resend
  
  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    this.resend = new Resend(apiKey)
  }

  /**
   * Send export email with download link
   */
  async sendExportEmail(request: EmailExportRequest): Promise<EmailResult> {
    try {
      const { recipients, conversationCount, downloadUrl, language, organizationId } = request
      
      // Validate recipients
      if (!recipients || recipients.length === 0) {
        return { success: false, error: 'No recipients specified' }
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = recipients.filter(email => !emailRegex.test(email))
      if (invalidEmails.length > 0) {
        return { success: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` }
      }

      // Generate email content
      const isArabic = language === 'ar'
      const subject = this.generateSubject(conversationCount, isArabic, request.exportFormat)
      const { html, text } = this.generateEmailContent(request)

      // Send emails
      const emailPromises = recipients.map(async (recipient) => {
        try {
          const response = await this.resend.emails.send({
            from: process.env.FROM_EMAIL || 'exports@hr-consultant.sa',
            to: recipient,
            subject,
            html,
            text,
            attachments: [], // Note: For large files, we use download links instead of attachments
            headers: {
              'X-Organization-ID': organizationId,
              'X-Export-Type': 'conversation-export',
              'X-Export-Count': conversationCount.toString()
            }
          })

          return {
            recipient,
            success: true,
            messageId: response.data?.id
          }
        } catch (error) {
          console.error(`Failed to send email to ${recipient}:`, error)
          return {
            recipient,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const results = await Promise.all(emailPromises)
      const successfulSends = results.filter(r => r.success)
      const failedSends = results.filter(r => !r.success)

      if (successfulSends.length === 0) {
        return { 
          success: false, 
          error: `Failed to send to all recipients: ${failedSends.map(f => f.error).join(', ')}` 
        }
      }

      if (failedSends.length > 0) {
        console.warn('Some emails failed to send:', failedSends)
      }

      return {
        success: true,
        messageIds: successfulSends.map(s => s.messageId).filter(Boolean) as string[]
      }

    } catch (error) {
      console.error('Email service error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Email sending failed' 
      }
    }
  }

  /**
   * Send scheduled export notification
   */
  async sendScheduledExportNotification(
    recipients: string[],
    exportName: string,
    downloadUrl: string,
    language: 'ar' | 'en',
    organizationId: string
  ): Promise<EmailResult> {
    try {
      const isArabic = language === 'ar'
      const subject = isArabic 
        ? `تقرير مجدول: ${exportName}`
        : `Scheduled Report: ${exportName}`

      const html = this.generateScheduledExportHTML({
        exportName,
        downloadUrl,
        language,
        isArabic
      })

      const text = this.generateScheduledExportText({
        exportName,
        downloadUrl,
        language,
        isArabic
      })

      const emailPromises = recipients.map(recipient =>
        this.resend.emails.send({
          from: process.env.FROM_EMAIL || 'reports@hr-consultant.sa',
          to: recipient,
          subject,
          html,
          text,
          headers: {
            'X-Organization-ID': organizationId,
            'X-Export-Type': 'scheduled-export'
          }
        })
      )

      const results = await Promise.all(emailPromises)
      const messageIds = results
        .map(r => r.data?.id)
        .filter(Boolean) as string[]

      return { success: true, messageIds }

    } catch (error) {
      console.error('Scheduled export notification error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Notification sending failed' 
      }
    }
  }

  /**
   * Send export completion notification
   */
  async sendExportCompletionNotification(
    recipients: string[],
    exportType: string,
    downloadUrl: string,
    processingTime: number,
    language: 'ar' | 'en',
    organizationId: string
  ): Promise<EmailResult> {
    try {
      const isArabic = language === 'ar'
      const subject = isArabic 
        ? 'اكتمل تصدير البيانات'
        : 'Export Completed'

      const html = this.generateCompletionNotificationHTML({
        exportType,
        downloadUrl,
        processingTime,
        language,
        isArabic
      })

      const emailPromises = recipients.map(recipient =>
        this.resend.emails.send({
          from: process.env.FROM_EMAIL || 'notifications@hr-consultant.sa',
          to: recipient,
          subject,
          html,
          headers: {
            'X-Organization-ID': organizationId,
            'X-Export-Type': 'completion-notification'
          }
        })
      )

      await Promise.all(emailPromises)
      return { success: true }

    } catch (error) {
      console.error('Completion notification error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Notification sending failed' 
      }
    }
  }

  /**
   * Generate email subject
   */
  private generateSubject(conversationCount: number, isArabic: boolean, format = 'PDF'): string {
    if (isArabic) {
      if (conversationCount === 1) {
        return `تصدير محادثة - ${format.toUpperCase()}`
      } else {
        return `تصدير ${conversationCount} محادثة - ${format.toUpperCase()}`
      }
    } else {
      if (conversationCount === 1) {
        return `Conversation Export - ${format.toUpperCase()}`
      } else {
        return `${conversationCount} Conversations Export - ${format.toUpperCase()}`
      }
    }
  }

  /**
   * Generate email content
   */
  private generateEmailContent(request: EmailExportRequest): { html: string; text: string } {
    const { conversationCount, downloadUrl, language, exportFormat = 'PDF' } = request
    const isArabic = language === 'ar'

    const html = `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.generateSubject(conversationCount, isArabic, exportFormat)}</title>
    <style>
        body {
            font-family: ${isArabic ? '"Segoe UI", "Tahoma", Arial' : '"Segoe UI", system-ui, Arial'}, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
            direction: ${isArabic ? 'rtl' : 'ltr'};
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .title {
            font-size: 20px;
            color: #374151;
            margin-bottom: 15px;
        }
        .content {
            margin-bottom: 30px;
        }
        .export-details {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        .detail-label {
            font-weight: bold;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        .download-section {
            text-align: center;
            margin: 30px 0;
        }
        .download-button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16px;
            margin: 10px 0;
            transition: background-color 0.3s;
        }
        .download-button:hover {
            background: #2563eb;
        }
        .expiration-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        .disclaimer {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">${isArabic ? 'مستشار الموارد البشرية' : 'HR Business Consultant'}</div>
            <div class="title">${this.generateSubject(conversationCount, isArabic, exportFormat)}</div>
        </div>
        
        <div class="content">
            <p>${isArabic 
                ? 'تم إنشاء تصدير المحادثات الخاص بك بنجاح وهو جاهز للتنزيل.'
                : 'Your conversation export has been successfully generated and is ready for download.'
            }</p>
            
            <div class="export-details">
                <div class="detail-row">
                    <span class="detail-label">${isArabic ? 'عدد المحادثات:' : 'Number of Conversations:'}</span>
                    <span class="detail-value">${conversationCount}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">${isArabic ? 'تنسيق الملف:' : 'File Format:'}</span>
                    <span class="detail-value">${exportFormat.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">${isArabic ? 'تاريخ الإنشاء:' : 'Generated On:'}</span>
                    <span class="detail-value">${new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}</span>
                </div>
                ${request.exportSize ? `
                <div class="detail-row">
                    <span class="detail-label">${isArabic ? 'حجم الملف:' : 'File Size:'}</span>
                    <span class="detail-value">${this.formatFileSize(request.exportSize)}</span>
                </div>
                ` : ''}
            </div>
            
            ${request.expirationDate ? `
            <div class="expiration-notice">
                <strong>${isArabic ? '⚠️ تنبيه:' : '⚠️ Notice:'}</strong>
                ${isArabic 
                    ? `سينتهي رابط التنزيل في ${new Date(request.expirationDate).toLocaleDateString('ar-SA')}`
                    : `Download link expires on ${new Date(request.expirationDate).toLocaleDateString('en-US')}`
                }
            </div>
            ` : ''}
        </div>
        
        <div class="download-section">
            <a href="${downloadUrl}" class="download-button">
                ${isArabic ? '📥 تنزيل الملف' : '📥 Download File'}
            </a>
            <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">
                ${isArabic 
                    ? 'انقر على الزر أعلاه لتنزيل ملف التصدير'
                    : 'Click the button above to download your export file'
                }
            </p>
        </div>
        
        <div class="footer">
            <p>${isArabic 
                ? 'هذا البريد الإلكتروني تم إرساله تلقائياً من نظام إدارة الموارد البشرية'
                : 'This email was sent automatically from the HR Management System'
            }</p>
            
            <div class="disclaimer">
                ${isArabic 
                    ? 'المعلومات الواردة في هذا البريد الإلكتروني سرية ومخصصة للمستلم المقصود فقط. إذا تلقيت هذا البريد بالخطأ، يرجى حذفه فوراً وإبلاغ المرسل.'
                    : 'The information contained in this email is confidential and intended for the designated recipient only. If you received this email in error, please delete it immediately and notify the sender.'
                }
            </div>
        </div>
    </div>
</body>
</html>`

    const text = isArabic ? `
تصدير المحادثات - ${exportFormat.toUpperCase()}

تم إنشاء تصدير المحادثات الخاص بك بنجاح وهو جاهز للتنزيل.

تفاصيل التصدير:
- عدد المحادثات: ${conversationCount}
- تنسيق الملف: ${exportFormat.toUpperCase()}
- تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA')}
${request.exportSize ? `- حجم الملف: ${this.formatFileSize(request.exportSize)}` : ''}

رابط التنزيل: ${downloadUrl}

${request.expirationDate ? `تنبيه: سينتهي رابط التنزيل في ${new Date(request.expirationDate).toLocaleDateString('ar-SA')}` : ''}

هذا البريد الإلكتروني تم إرساله تلقائياً من نظام إدارة الموارد البشرية.
المعلومات الواردة في هذا البريد الإلكتروني سرية ومخصصة للمستلم المقصود فقط.
    ` : `
Conversation Export - ${exportFormat.toUpperCase()}

Your conversation export has been successfully generated and is ready for download.

Export Details:
- Number of Conversations: ${conversationCount}
- File Format: ${exportFormat.toUpperCase()}
- Generated On: ${new Date().toLocaleDateString('en-US')}
${request.exportSize ? `- File Size: ${this.formatFileSize(request.exportSize)}` : ''}

Download Link: ${downloadUrl}

${request.expirationDate ? `Notice: Download link expires on ${new Date(request.expirationDate).toLocaleDateString('en-US')}` : ''}

This email was sent automatically from the HR Management System.
The information contained in this email is confidential and intended for the designated recipient only.
    `

    return { html, text }
  }

  /**
   * Generate scheduled export email content
   */
  private generateScheduledExportHTML(params: {
    exportName: string
    downloadUrl: string
    language: string
    isArabic: boolean
  }): string {
    const { exportName, downloadUrl, isArabic } = params

    return `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${params.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isArabic ? 'تقرير مجدول' : 'Scheduled Report'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .download-button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isArabic ? 'تقرير مجدول جاهز' : 'Scheduled Report Ready'}</h1>
        </div>
        <p>${isArabic 
            ? `تم إنشاء التقرير المجدول "${exportName}" وهو جاهز للتنزيل.`
            : `Your scheduled report "${exportName}" has been generated and is ready for download.`
        }</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}" class="download-button">
                ${isArabic ? 'تنزيل التقرير' : 'Download Report'}
            </a>
        </div>
    </div>
</body>
</html>`
  }

  /**
   * Generate scheduled export text content
   */
  private generateScheduledExportText(params: {
    exportName: string
    downloadUrl: string
    language: string
    isArabic: boolean
  }): string {
    const { exportName, downloadUrl, isArabic } = params

    return isArabic 
      ? `تقرير مجدول جاهز\n\nتم إنشاء التقرير المجدول "${exportName}" وهو جاهز للتنزيل.\n\nرابط التنزيل: ${downloadUrl}`
      : `Scheduled Report Ready\n\nYour scheduled report "${exportName}" has been generated and is ready for download.\n\nDownload Link: ${downloadUrl}`
  }

  /**
   * Generate completion notification HTML
   */
  private generateCompletionNotificationHTML(params: {
    exportType: string
    downloadUrl: string
    processingTime: number
    language: string
    isArabic: boolean
  }): string {
    const { exportType, downloadUrl, processingTime, isArabic } = params

    return `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${params.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isArabic ? 'اكتمل التصدير' : 'Export Completed'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .download-button { display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1 style="text-align: center;">${isArabic ? 'اكتمل التصدير' : 'Export Completed'}</h1>
        <p>${isArabic 
            ? `تم اكتمال تصدير ${exportType} بنجاح في ${this.formatProcessingTime(processingTime, isArabic)}.`
            : `Your ${exportType} export has been completed successfully in ${this.formatProcessingTime(processingTime, isArabic)}.`
        }</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}" class="download-button">
                ${isArabic ? 'تنزيل الملف' : 'Download File'}
            </a>
        </div>
    </div>
</body>
</html>`
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * Format processing time for display
   */
  private formatProcessingTime(ms: number, isArabic: boolean): string {
    const seconds = Math.round(ms / 1000)
    
    if (seconds < 60) {
      return isArabic ? `${seconds} ثانية` : `${seconds} seconds`
    }
    
    const minutes = Math.round(seconds / 60)
    return isArabic ? `${minutes} دقيقة` : `${minutes} minutes`
  }
}

export { EmailService }