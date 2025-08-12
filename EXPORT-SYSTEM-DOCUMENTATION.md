# HR Intelligence Platform - Comprehensive Export System

## Overview

This document provides complete technical documentation for the comprehensive conversation export system implemented in the HR Intelligence Platform. The system supports multiple export formats, advanced features, and automated workflows for exporting conversation data with full compliance and security controls.

## 🚀 Features

### Export Formats
- **PDF Export**: Professional formatting with company branding and Arabic RTL support
- **Word Export**: Editable DOCX format with proper styling and templates
- **HTML Export**: Interactive web-friendly format with search functionality
- **Email Export**: Direct delivery via email with download links

### Advanced Features
- **Custom Templates**: Organization-specific export templates
- **Redaction Options**: Automatic removal of sensitive information
- **Watermarks**: Security watermarks and metadata
- **Digital Signatures**: Preparation for signature workflows
- **Compression**: ZIP archives for bulk exports
- **Bilingual Support**: Full Arabic/English RTL support

### Export Content
- Complete conversation history with timestamps
- Source documents referenced in responses
- Compliance analysis and scoring
- Cost breakdown per conversation
- User feedback and ratings
- Performance metrics

### Automated Features
- **Scheduled Exports**: Automated weekly/monthly reports
- **Background Processing**: Queue-based generation for large files
- **Progress Tracking**: Real-time status updates
- **Email Notifications**: Completion and failure alerts

## 📚 API Documentation

### Base URL
```
/api/v1/export
```

### Authentication
All endpoints require authentication via Supabase Auth. Users must be members of an active organization.

---

## 🔗 API Endpoints

### 1. List Available Conversations for Export

```http
GET /api/v1/export/conversations
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `category` (optional): Filter by conversation category
- `dateFrom` (optional): Start date filter (ISO 8601)
- `dateTo` (optional): End date filter (ISO 8601)
- `search` (optional): Search in conversation titles

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "title": "Employee Benefits Inquiry",
      "category": "benefits",
      "language": "ar",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T11:15:00Z",
      "message_count": 8,
      "users": {
        "full_name": "أحمد محمد",
        "email": "ahmed@company.sa"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "exportOptions": {
    "availableFormats": ["pdf", "docx", "html", "email"],
    "availableLanguages": ["ar", "en"],
    "availableTemplates": [
      {
        "id": "default",
        "name": "Default",
        "description": "Standard export template"
      }
    ],
    "exportLimits": {
      "maxConversations": 200,
      "role": "hr_manager"
    }
  }
}
```

### 2. Export Multiple Conversations

```http
POST /api/v1/export/conversations
```

**Request Body:**
```json
{
  "conversationIds": ["uuid1", "uuid2"],
  "format": "pdf",
  "options": {
    "includeMetadata": true,
    "includeSources": true,
    "includeUserFeedback": true,
    "includeComplianceAnalysis": false,
    "includeCostBreakdown": false,
    "language": "ar",
    "template": "default",
    "watermark": "سري",
    "organizationBranding": true,
    "redactSensitive": false,
    "emailRecipients": ["manager@company.sa"],
    "compressionFormat": "none"
  },
  "filters": {
    "dateFrom": "2025-01-01T00:00:00Z",
    "dateTo": "2025-01-31T23:59:59Z",
    "category": "benefits"
  }
}
```

**Response (Direct Download):**
```json
{
  "success": true,
  "downloadUrl": "https://storage.url/exports/file.pdf",
  "filename": "conversations-export-2025-01-15.pdf",
  "exportedAt": "2025-01-15T12:00:00Z"
}
```

**Response (Background Job):**
```json
{
  "success": true,
  "jobId": "uuid",
  "message": "Export job started. Use the job ID to check status.",
  "estimatedCompletion": "2025-01-15T12:05:00Z"
}
```

### 3. Export Single Conversation

```http
GET /api/v1/export/conversations/{id}
```

**Query Parameters:**
- `format` (required): Export format (pdf, docx, html, email)
- `includeMetadata` (optional): Include metadata (default: true)
- `includeSources` (optional): Include sources (default: true)
- `language` (optional): Export language (default: ar)
- `template` (optional): Template to use (default: default)

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "title": "Employee Benefits Inquiry",
    "category": "benefits",
    "language": "ar",
    "message_count": 8,
    "user": {
      "full_name": "أحمد محمد",
      "email": "ahmed@company.sa"
    }
  },
  "analytics": {
    "compliance": {
      "overall_score": 0.95,
      "risk_level": "low"
    },
    "cost": {
      "total_cost": 0.0234,
      "input_tokens": 1250,
      "output_tokens": 890
    }
  },
  "exportOptions": {
    "availableFormats": ["pdf", "docx", "html", "email"],
    "features": {
      "watermarks": true,
      "digitalSignatures": true,
      "sensitiveDataRedaction": true
    }
  }
}
```

### 4. Export Single Conversation (POST)

```http
POST /api/v1/export/conversations/{id}
```

**Request Body:**
```json
{
  "format": "html",
  "options": {
    "includeMetadata": true,
    "includeSources": true,
    "includeSearch": true,
    "language": "ar",
    "template": "interactive",
    "theme": "light",
    "interactiveFeatures": true
  }
}
```

### 5. HTML Export with Interactive Features

```http
GET /api/v1/export/conversations/{id}/html
```

**Query Parameters:**
- `language` (optional): ar | en (default: ar)
- `template` (optional): Template name (default: default)
- `includeSearch` (optional): Include search functionality (default: true)
- `download` (optional): Force download vs preview (default: false)

**Response:** HTML content or download

### 6. Check Export Job Status

```http
GET /api/v1/export/status/{jobId}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "processing",
    "progress": 75,
    "totalItems": 10,
    "processedItems": 7,
    "downloadUrl": null,
    "createdAt": "2025-01-15T12:00:00Z",
    "estimatedCompletion": "2025-01-15T12:05:00Z"
  },
  "metrics": {
    "elapsedTimeMs": 180000,
    "estimatedTimeRemainingMs": 60000,
    "processingRate": 0.04,
    "canCancel": true,
    "canRetry": false
  }
}
```

### 7. Cancel Export Job

```http
DELETE /api/v1/export/status/{jobId}
```

**Response:**
```json
{
  "success": true,
  "message": "Export job cancelled successfully",
  "jobId": "uuid",
  "cancelledAt": "2025-01-15T12:03:00Z"
}
```

### 8. Retry/Update Export Job

```http
PATCH /api/v1/export/status/{jobId}
```

**Request Body:**
```json
{
  "action": "retry"  // or "archive", "priority"
}
```

---

## 📅 Scheduled Exports

### 1. List Scheduled Exports

```http
GET /api/v1/export/scheduled
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `active`: Filter by active status
- `scheduleType`: Filter by schedule type

**Response:**
```json
{
  "success": true,
  "scheduledExports": [
    {
      "id": "uuid",
      "name": "Weekly HR Report",
      "description": "Automated weekly conversation summary",
      "schedule": {
        "type": "weekly",
        "dayOfWeek": 1,
        "hour": 9,
        "timezone": "Asia/Riyadh"
      },
      "isActive": true,
      "nextExecution": "2025-01-20T09:00:00Z",
      "lastExecution": "2025-01-13T09:00:00Z"
    }
  ],
  "statistics": {
    "totalScheduledExports": 5,
    "activeExports": 4,
    "successRate": 0.95
  }
}
```

### 2. Create Scheduled Export

```http
POST /api/v1/export/scheduled
```

**Request Body:**
```json
{
  "name": "Monthly Compliance Report",
  "description": "Monthly report for compliance review",
  "schedule": {
    "type": "monthly",
    "dayOfMonth": 1,
    "hour": 8,
    "timezone": "Asia/Riyadh"
  },
  "filters": {
    "dateRange": "last_month",
    "categories": ["policy", "compliance"],
    "complianceScoreMin": 0.8
  },
  "export": {
    "format": "pdf",
    "template": "compliance",
    "language": "ar",
    "includeComplianceAnalysis": true,
    "organizationBranding": true
  },
  "delivery": {
    "method": "email",
    "emailRecipients": ["compliance@company.sa"],
    "notifyOnCompletion": true,
    "notifyOnFailure": true
  },
  "isActive": true
}
```

---

## 🎨 Template Management

### 1. List Export Templates

```http
GET /api/v1/export/templates
```

**Query Parameters:**
- `type`: Filter by template type
- `active`: Filter by active status
- `includeSystem`: Include system templates

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid",
      "name": "Legal Document",
      "description": "Legal-formatted PDF with compliance details",
      "templateType": "pdf",
      "isActive": true,
      "isDefault": false,
      "isSystem": false,
      "version": 2,
      "usageStats": {
        "totalUsage": 45,
        "lastUsed": "2025-01-15T10:30:00Z",
        "popularityScore": 8.5
      }
    }
  ],
  "summary": {
    "total": 8,
    "byType": {
      "pdf": 3,
      "docx": 2,
      "html": 2,
      "email": 1
    }
  }
}
```

### 2. Create Export Template

```http
POST /api/v1/export/templates
```

**Request Body:**
```json
{
  "name": "Executive Summary",
  "description": "High-level summary for executives",
  "templateType": "pdf",
  "templateData": {
    "layout": "executive",
    "font_size": 12,
    "include_summary": true,
    "include_metrics": true,
    "company_colors": true
  },
  "isDefault": false
}
```

### 3. Update Export Template

```http
PUT /api/v1/export/templates/{id}
```

### 4. Delete Export Template

```http
DELETE /api/v1/export/templates/{id}
```

---

## 📊 Export Types & Features

### PDF Export Features
- Professional formatting with company branding
- Arabic RTL text support
- Compliance scoring and analysis
- Source document citations
- User feedback integration
- Digital signature preparation
- Custom watermarks

### Word Export Features
- Editable DOCX format
- Proper styling and formatting
- Table of contents
- Comments and track changes support
- Custom headers and footers

### HTML Export Features
- Interactive search functionality
- Responsive design
- Theme switching (light/dark)
- Print-friendly styles
- Keyboard shortcuts
- Table of contents navigation
- Copy-to-clipboard functionality

### Email Export Features
- Professional email templates
- Bilingual support (Arabic/English)
- Attachment management
- Delivery tracking
- Expiration notices
- Security disclaimers

## 🔒 Security Features

### Data Protection
- Multi-tenant data isolation
- Row-level security (RLS)
- Sensitive data redaction
- Encrypted file storage
- Access control validation

### Audit Logging
- Complete export activity tracking
- User action logging
- Security event monitoring
- Compliance audit trails
- Performance metrics

### Access Control
- Role-based permissions
- Organization-level isolation
- Export limits by role
- Template management permissions
- Scheduled export restrictions

## 🏗️ Technical Architecture

### Database Schema
```sql
-- Export Jobs
export_jobs (id, organization_id, user_id, type, format, status, progress, options)

-- Templates
export_templates (id, organization_id, name, template_type, template_data, is_active)

-- Scheduled Exports
scheduled_exports (id, organization_id, name, schedule_config, filter_config)

-- Analytics
export_analytics (id, organization_id, date, export_type, format, metrics)

-- Compliance Analysis
conversation_compliance_analysis (conversation_id, overall_score, risk_level)

-- Cost Tracking
conversation_cost_tracking (conversation_id, total_cost, input_tokens, output_tokens)
```

### File Structure
```
src/
├── app/api/v1/export/
│   ├── conversations/
│   │   ├── route.ts (bulk export)
│   │   ├── [id]/
│   │   │   ├── route.ts (single export)
│   │   │   └── html/route.ts (HTML export)
│   ├── status/[jobId]/route.ts (job status)
│   ├── scheduled/route.ts (scheduled exports)
│   └── templates/
│       ├── route.ts (template list/create)
│       └── [id]/route.ts (template CRUD)
├── libs/
│   ├── services/
│   │   ├── export-service.ts (main export logic)
│   │   └── email-service.ts (email notifications)
│   └── export/
│       ├── pdf-generator.ts (PDF generation)
│       ├── docx-generator.ts (Word generation)
│       └── html-generator.ts (HTML generation)
```

## 🚀 Getting Started

### Prerequisites
- Supabase project with authentication
- Resend account for email functionality
- Node.js dependencies:
  - `puppeteer` for PDF generation
  - `docx` for Word document creation
  - `jszip` for compression
  - `resend` for email delivery

### Environment Variables
```env
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=exports@your-domain.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation
1. Run the database migration:
   ```sql
   -- Apply migration: 20250812220000_comprehensive_export_system.sql
   ```

2. Install dependencies:
   ```bash
   npm install puppeteer docx jszip resend
   ```

3. Configure storage bucket for exports in Supabase

### Usage Examples

#### Basic Export
```javascript
const response = await fetch('/api/v1/export/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationIds: ['uuid1', 'uuid2'],
    format: 'pdf',
    options: {
      language: 'ar',
      includeMetadata: true,
      watermark: 'سري'
    }
  })
})
```

#### Schedule Weekly Report
```javascript
const response = await fetch('/api/v1/export/scheduled', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Weekly Report',
    schedule: {
      type: 'weekly',
      dayOfWeek: 1,
      hour: 9
    },
    export: {
      format: 'pdf',
      language: 'ar'
    },
    delivery: {
      method: 'email',
      emailRecipients: ['manager@company.sa']
    }
  })
})
```

## 📈 Performance Considerations

### Optimization Strategies
- Background processing for large exports
- Caching for frequently accessed data
- Compression for bulk exports
- Progress tracking for user feedback
- Queue management for concurrent exports

### Scaling Guidelines
- Monitor export job queue length
- Set appropriate timeout values
- Implement retry mechanisms
- Use CDN for file delivery
- Monitor storage usage

## 🐛 Troubleshooting

### Common Issues
1. **Export timeout**: Increase timeout values for large conversations
2. **Memory issues**: Implement streaming for large PDF generation
3. **Email delivery**: Check Resend configuration and rate limits
4. **File storage**: Monitor Supabase storage quotas

### Debug Endpoints
- Check job logs: `GET /api/v1/export/status/{jobId}`
- View export analytics: Available in export responses
- Monitor system health: Built-in performance tracking

## 📋 Export Limits by Role

| Role | Max Conversations | Scheduled Exports | Custom Templates |
|------|------------------|-------------------|------------------|
| Owner | 1000 | 50 | ✅ |
| Admin | 500 | 25 | ✅ |
| HR Manager | 200 | 15 | ✅ |
| HR Analyst | 100 | 10 | ✅ |
| HR Specialist | 50 | 5 | ❌ |
| Employee | 10 | 0 | ❌ |

## 🔄 Migration and Updates

The export system is designed to be backwards compatible. When updating:

1. Apply new database migrations
2. Update environment variables if needed
3. Test export functionality
4. Monitor error logs for issues

## 📞 Support

For technical support or feature requests related to the export system, please refer to the main project documentation or contact the development team.

---

*This documentation covers the complete conversation export system. For additional features or customizations, please refer to the individual service documentation files.*