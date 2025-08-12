# HR Business Consultant RAG System - API Documentation

## Overview

The HR Business Consultant RAG (Retrieval-Augmented Generation) system provides comprehensive APIs for AI-powered HR consultation with Saudi labor law expertise and organizational document management.

## Base URL

```
https://your-domain.com/api/v1
```

## Authentication

All API endpoints require authentication via Bearer token (JWT from Supabase Auth).

```bash
Authorization: Bearer <your-jwt-token>
```

## Rate Limits

Rate limits vary by subscription tier:

- **Basic**: 100 queries/hour, 500 API calls/hour
- **Professional**: 1000 queries/hour, 2000 API calls/hour  
- **Enterprise**: 10000 queries/hour, 10000 API calls/hour

## Error Handling

All API responses follow a standardized error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}, 
    "timestamp": "2025-01-12T10:30:00Z"
  }
}
```

### Common Error Codes

- `AUTH_001`: Invalid authentication token
- `AUTH_002`: Missing authentication token
- `AUTH_003`: No active organization membership
- `RBAC_001`: Missing role information
- `RBAC_002`: Insufficient permissions
- `RATE_LIMIT_001`: Rate limit exceeded
- `HR_001`: Document not found
- `HR_002`: Processing failed
- `HR_003`: Quota exceeded
- `VAL_001`: Validation error
- `INT_001`: Internal server error

## API Endpoints

---

# Chat & Query APIs

## 1. Conversations

### Create Conversation

Create a new conversation for AI chat.

```http
POST /api/v1/chat/conversations
```

**Request Body:**
```json
{
  "title": "استفسار حول الإجازات", // optional
  "language": "ar", // "ar" | "en"
  "metadata": {} // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "استفسار حول الإجازات",
    "language": "ar",
    "message_count": 0,
    "last_message_at": null,
    "created_at": "2025-01-12T10:30:00Z",
    "updated_at": "2025-01-12T10:30:00Z",
    "metadata": {}
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### List Conversations

Get paginated list of conversations.

```http
GET /api/v1/chat/conversations?page=1&limit=20&search=query&language=ar
```

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 20, max: 100): Items per page
- `search` (string, optional): Search in conversation titles
- `language` ("ar" | "en", optional): Filter by language

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "استفسار حول الإجازات",
      "language": "ar",
      "message_count": 5,
      "last_message_at": "2025-01-12T10:30:00Z",
      "created_at": "2025-01-12T10:30:00Z",
      "updated_at": "2025-01-12T10:30:00Z",
      "metadata": {},
      "recent_messages": [
        {
          "id": "uuid",
          "role": "user",
          "content": "ما هي سياسة الإجازات؟",
          "created_at": "2025-01-12T10:30:00Z"
        }
      ]
    }
  ],
  "metadata": {
    "page": 1,
    "limit": 20,
    "totalCount": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 2. Messages

### Send Message

Send a message in a conversation and get AI response.

```http
POST /api/v1/chat/conversations/{id}/messages
```

**Request Body:**
```json
{
  "content": "ما هي سياسة الإجازات في الشركة؟",
  "language": "ar", // optional, defaults to conversation language
  "includeCompanyDocs": true, // optional, default: true
  "includeLaborLaw": true, // optional, default: true
  "maxSources": 10, // optional, default: 10, max: 20
  "context": [] // optional, additional context strings
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": "uuid",
      "role": "user",
      "content": "ما هي سياسة الإجازات في الشركة؟",
      "language": "ar",
      "created_at": "2025-01-12T10:30:00Z"
    },
    "aiMessage": {
      "id": "uuid",
      "role": "assistant",
      "content": "بناءً على سياسات شركتكم ونظام العمل السعودي...",
      "language": "ar",
      "sources": [
        {
          "id": "uuid",
          "type": "document",
          "title": "سياسة الإجازات",
          "excerpt": "نص مقتطف من المستند...",
          "relevanceScore": 0.95,
          "category": "policies"
        },
        {
          "id": "uuid",
          "type": "labor_law",
          "title": "الإجازات السنوية",
          "excerpt": "نص من نظام العمل السعودي...",
          "relevanceScore": 0.88,
          "articleNumber": "109"
        }
      ],
      "confidence": 0.92,
      "responseTimeMs": 1250,
      "created_at": "2025-01-12T10:30:00Z"
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Get Messages

Retrieve messages from a conversation.

```http
GET /api/v1/chat/conversations/{id}/messages?page=1&limit=50&role=user
```

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 50, max: 100): Items per page
- `role` ("user" | "assistant", optional): Filter by message role

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "role": "user",
      "content": "ما هي سياسة الإجازات؟",
      "language": "ar",
      "sources": [],
      "metadata": {},
      "created_at": "2025-01-12T10:30:00Z"
    }
  ],
  "metadata": {
    "page": 1,
    "limit": 50,
    "totalCount": 12,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 3. Streaming Chat

### Stream AI Response

Get real-time streaming AI responses using Server-Sent Events.

```http
POST /api/v1/chat/stream
```

**Request Body:**
```json
{
  "conversationId": "uuid",
  "content": "ما هي سياسة الإجازات؟",
  "language": "ar",
  "includeCompanyDocs": true,
  "includeLaborLaw": true,
  "maxSources": 10
}
```

**Response (Server-Sent Events):**
```
data: {"type": "start", "data": "Processing your query..."}

data: {"type": "content", "data": "بناءً على"}

data: {"type": "content", "data": " سياسات شركتكم"}

data: {"type": "sources", "data": [{"id": "uuid", "type": "document", "title": "سياسة الإجازات"}]}

data: {"type": "complete", "data": {"confidence": 0.92, "tokensUsed": 150}}
```

### Health Check

Check streaming endpoint health.

```http
GET /api/v1/chat/stream
```

---

# Document Management APIs

## 4. Documents

### Upload Document

Upload a new document for processing.

```http
POST /api/v1/documents
```

**Request Body:**
```json
{
  "name": "سياسة الموارد البشرية",
  "category": "policies", // "policies" | "contracts" | "handbooks" | "procedures" | "forms" | "compliance" | "other"
  "language": "ar", // "ar" | "en" | "mixed"
  "tags": ["hr", "policies"],
  "metadata": {},
  "isPublic": false,
  "file": {
    "name": "hr_policy.pdf",
    "type": "application/pdf",
    "size": 1024000,
    "base64Data": "base64-encoded-file-content"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "سياسة الموارد البشرية",
    "original_filename": "hr_policy.pdf",
    "category": "policies",
    "language": "ar",
    "file_size_bytes": 1024000,
    "status": "processing",
    "tags": ["hr", "policies"],
    "metadata": {},
    "is_public": false,
    "uploaded_by": "user-uuid",
    "created_at": "2025-01-12T10:30:00Z",
    "updated_at": "2025-01-12T10:30:00Z"
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### List Documents

Get paginated list of documents with filtering.

```http
GET /api/v1/documents?page=1&limit=20&category=policies&language=ar&search=query&status=completed
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search in document names and content
- `category` (array): Filter by categories
- `tags` (array): Filter by tags
- `language` ("ar" | "en" | "mixed"): Filter by language
- `status` ("uploaded" | "processing" | "completed" | "failed"): Filter by processing status
- `uploadedBy` (string): Filter by uploader user ID
- `dateFrom` (string): Start date filter (ISO format)
- `dateTo` (string): End date filter (ISO format)
- `sortBy` ("name" | "created_at" | "updated_at" | "file_size_bytes"): Sort field
- `sortOrder` ("asc" | "desc"): Sort direction

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "سياسة الموارد البشرية",
      "original_filename": "hr_policy.pdf",
      "category": "policies",
      "language": "ar",
      "file_size_bytes": 1024000,
      "status": "completed",
      "tags": ["hr", "policies"],
      "metadata": {},
      "is_public": false,
      "uploaded_by": "user-uuid",
      "processed_at": "2025-01-12T10:35:00Z",
      "created_at": "2025-01-12T10:30:00Z",
      "updated_at": "2025-01-12T10:35:00Z",
      "chunk_count": 15
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalCount": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "facets": {
      "categories": [
        {"name": "policies", "count": 12},
        {"name": "contracts", "count": 8}
      ],
      "languages": [
        {"code": "ar", "count": 25},
        {"code": "en", "count": 20}
      ],
      "statuses": [
        {"status": "completed", "count": 40},
        {"status": "processing", "count": 5}
      ],
      "tags": [
        {"name": "hr", "count": 15},
        {"name": "policies", "count": 12}
      ]
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Get Document

Get detailed information about a specific document.

```http
GET /api/v1/documents/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "سياسة الموارد البشرية",
    "original_filename": "hr_policy.pdf",
    "category": "policies",
    "language": "ar",
    "file_size_bytes": 1024000,
    "status": "completed",
    "tags": ["hr", "policies"],
    "metadata": {},
    "is_public": false,
    "uploaded_by": "user-uuid",
    "uploader": {
      "email": "user@company.com",
      "name": "احمد محمد"
    },
    "storage_path": "documents/org-uuid/file.pdf",
    "content_extracted": "extracted text content...",
    "processed_at": "2025-01-12T10:35:00Z",
    "created_at": "2025-01-12T10:30:00Z",
    "updated_at": "2025-01-12T10:35:00Z",
    "version_number": 1,
    "chunks": [
      {
        "id": "uuid",
        "chunk_index": 0,
        "content_preview": "نص المقطع الأول...",
        "content_length": 500,
        "metadata": {},
        "created_at": "2025-01-12T10:35:00Z"
      }
    ],
    "processing_history": [],
    "analytics": {
      "total_queries": 25,
      "recent_queries": []
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Update Document

Update document metadata and settings.

```http
PUT /api/v1/documents/{id}
```

**Request Body:**
```json
{
  "name": "سياسة الموارد البشرية المحدثة",
  "category": "policies",
  "tags": ["hr", "policies", "updated"],
  "metadata": {"version": "2.0"},
  "is_public": true
}
```

### Delete Document

Delete a document and all associated data.

```http
DELETE /api/v1/documents/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deleted": true,
    "message": "Document deleted successfully"
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 5. Document Search

### Advanced Search

Perform advanced semantic search across documents.

```http
POST /api/v1/documents/search
```

**Request Body:**
```json
{
  "query": "سياسة الإجازات المرضية",
  "language": "ar",
  "categories": ["policies", "handbooks"],
  "tags": ["hr"],
  "documentIds": ["uuid1", "uuid2"],
  "limit": 10,
  "threshold": 0.75,
  "includeContent": false,
  "sortBy": "relevance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "document_id": "uuid",
        "document_name": "دليل الموظف",
        "chunk_index": 5,
        "content": "",
        "content_preview": "سياسة الإجازات المرضية تنص على...",
        "relevance_score": 0.95,
        "document_metadata": {
          "category": "handbooks",
          "language": "ar",
          "tags": ["hr", "employee"],
          "uploaded_by": "user-uuid",
          "created_at": "2025-01-12T10:30:00Z"
        },
        "highlight": {
          "content": "سياسة <mark>الإجازات المرضية</mark> تنص على",
          "positions": [{"start": 7, "end": 21}]
        }
      }
    ],
    "total_count": 8,
    "query_metadata": {
      "query": "سياسة الإجازات المرضية",
      "language": "ar",
      "processing_time_ms": 150,
      "filters_applied": {
        "categories": ["policies", "handbooks"],
        "tags": ["hr"]
      }
    },
    "suggestions": [
      "سياسة الإجازات السنوية",
      "إجراءات طلب الإجازة المرضية"
    ]
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Search Suggestions

Get search suggestions based on query.

```http
GET /api/v1/documents/search/suggestions?query=إجازة&language=ar&limit=5
```

**Response:**
```json
{
  "success": true,
  "data": [
    "سياسة الإجازات المرضية",
    "إجراءات طلب الإجازة السنوية",
    "حقوق الموظف في الإجازة",
    "إجازة الأمومة والأبوة",
    "إجازة بدون راتب"
  ],
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 6. Document Reprocessing

### Request Reprocessing

Request reprocessing of a document.

```http
POST /api/v1/documents/{id}/reprocess
```

**Request Body:**
```json
{
  "forceReprocess": false,
  "updateEmbeddings": true,
  "priority": "normal" // "low" | "normal" | "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "document_id": "uuid",
    "status": "pending",
    "priority": "normal",
    "estimated_completion": "2025-01-12T10:35:00Z",
    "options": {
      "force_reprocess": false,
      "update_embeddings": true,
      "priority": "normal"
    },
    "created_at": "2025-01-12T10:30:00Z"
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Get Processing Status

Check document processing status.

```http
GET /api/v1/documents/{id}/reprocess
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document_id": "uuid",
    "current_job": {
      "job_id": "uuid",
      "status": "processing",
      "priority": 5,
      "retry_count": 0,
      "max_retries": 3,
      "error_message": null,
      "started_at": "2025-01-12T10:31:00Z",
      "estimated_completion": "2025-01-12T10:35:00Z",
      "created_at": "2025-01-12T10:30:00Z",
      "metadata": {}
    },
    "processing_history": []
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

---

# Template Management APIs

## 7. Templates

### List Templates

Get available HR templates.

```http
GET /api/v1/templates?category=employment&language=ar&page=1&limit=20
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `category` ("employment" | "hr_policies" | "compliance" | "forms" | "letters"): Filter by category
- `language` ("ar" | "en"): Filter by language
- `search` (string): Search in template names and descriptions
- `isActive` (boolean): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "عقد عمل محدد المدة",
      "description": "نموذج عقد عمل محدد المدة متوافق مع نظام العمل السعودي",
      "category": "employment",
      "language": "ar",
      "template_content": "بسم الله الرحمن الرحيم...",
      "required_fields": [
        {
          "name": "employee_name",
          "type": "text",
          "required": true,
          "label": "اسم الموظف",
          "placeholder": "أدخل اسم الموظف",
          "validation": {
            "minLength": 2,
            "maxLength": 100
          }
        }
      ],
      "compliance_rules": [
        {
          "ruleId": "probation_limit",
          "description": "فترة التجربة لا تتجاوز 90 يوماً",
          "severity": "error",
          "laborLawReference": "المادة 53 - نظام العمل السعودي"
        }
      ],
      "metadata": {},
      "is_active": true,
      "tags": ["contract", "employment"],
      "created_by": "system",
      "created_at": "2025-01-12T10:30:00Z",
      "updated_at": "2025-01-12T10:30:00Z",
      "usage_count": 45
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalCount": 12,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "facets": {
      "categories": [
        {"name": "employment", "count": 5},
        {"name": "hr_policies", "count": 3}
      ]
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Create Template

Create a custom template (requires HR Manager role).

```http
POST /api/v1/templates
```

**Request Body:**
```json
{
  "name": "نموذج شكوى موظف",
  "description": "نموذج لتقديم الشكاوى من قبل الموظفين",
  "category": "forms",
  "language": "ar",
  "templateContent": "بسم الله الرحمن الرحيم\n\nنموذج شكوى موظف\n\nاسم الموظف: {{employee_name}}\nالقسم: {{department}}\nتاريخ الشكوى: {{complaint_date}}\n\nتفاصيل الشكوى:\n{{complaint_details}}",
  "requiredFields": [
    {
      "name": "employee_name",
      "type": "text",
      "required": true,
      "label": "اسم الموظف"
    },
    {
      "name": "department",
      "type": "text",
      "required": true,
      "label": "القسم"
    },
    {
      "name": "complaint_date",
      "type": "date",
      "required": true,
      "label": "تاريخ الشكوى"
    },
    {
      "name": "complaint_details",
      "type": "textarea",
      "required": true,
      "label": "تفاصيل الشكوى",
      "validation": {
        "minLength": 10,
        "maxLength": 1000
      }
    }
  ],
  "complianceRules": [],
  "metadata": {},
  "isActive": true,
  "tags": ["complaint", "form"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "نموذج شكوى موظف",
    "description": "نموذج لتقديم الشكاوى من قبل الموظفين",
    "category": "forms",
    "language": "ar",
    "template_content": "بسم الله الرحمن الرحيم...",
    "required_fields": [...],
    "compliance_rules": [],
    "compliance_status": "compliant",
    "metadata": {},
    "is_active": true,
    "tags": ["complaint", "form"],
    "created_by": "user-uuid",
    "created_at": "2025-01-12T10:30:00Z",
    "updated_at": "2025-01-12T10:30:00Z",
    "compliance_check": {
      "status": "compliant",
      "rules": [],
      "suggestions": []
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 8. Template Generation

### Generate Document

Generate a document from a template.

```http
POST /api/v1/templates/generate
```

**Request Body:**
```json
{
  "templateId": "uuid",
  "parameters": {
    "employee_name": "احمد محمد علي",
    "job_title": "محاسب",
    "department": "المالية",
    "contract_duration": 12,
    "start_date": "2025-02-01",
    "probation_period": 90,
    "basic_salary": 8000,
    "housing_allowance": 2000,
    "transport_allowance": 500,
    "daily_hours": 8,
    "working_days": 5
  },
  "language": "ar",
  "format": "pdf",
  "options": {
    "includeHeader": true,
    "includeFooter": true,
    "fontSize": 12,
    "fontFamily": "Arial",
    "margins": {
      "top": 20,
      "bottom": 20,
      "left": 20,
      "right": 20
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "template_id": "uuid",
    "generated_content": "بسم الله الرحمن الرحيم\n\nعقد عمل محدد المدة\n\nبين:\nالطرف الأول: شركة النماء للتطوير\nوالطرف الثاني: احمد محمد علي...",
    "download_url": "/api/v1/templates/download/generated_1705054200.pdf",
    "preview_url": "/api/v1/templates/preview/generated_1705054200.pdf",
    "format": "pdf",
    "file_size_bytes": 45680,
    "compliance_status": {
      "valid": true,
      "issues": [],
      "suggestions": [
        "تأكد من أن فترة التجربة لا تتجاوز 90 يوماً وفقاً لنظام العمل السعودي"
      ],
      "labor_law_violations": []
    },
    "parameters_used": {
      "employee_name": "احمد محمد علي",
      "job_title": "محاسب"
    },
    "generated_at": "2025-01-12T10:30:00Z",
    "expires_at": "2025-02-11T10:30:00Z"
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Validate Template Parameters

Validate template parameters before generation.

```http
PUT /api/v1/templates/validate
```

**Request Body:**
```json
{
  "templateId": "uuid",
  "parameters": {
    "employee_name": "احمد محمد علي",
    "probation_period": 120
  },
  "language": "ar"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template_id": "uuid",
    "template_name": "عقد عمل محدد المدة",
    "parameter_validation": {
      "valid": false,
      "missing_parameters": ["job_title", "department", "start_date"],
      "field_validation_errors": [
        {
          "field": "probation_period",
          "message": "Must not exceed 90"
        }
      ]
    },
    "compliance_preview": {
      "valid": false,
      "issues": [],
      "suggestions": [],
      "labor_law_violations": [
        "Probation period exceeds 90 days maximum allowed by Saudi Labor Law"
      ]
    },
    "preview_content": "",
    "ready_for_generation": false
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

---

# Analytics APIs

## 9. Usage Analytics

### Get Usage Metrics

Get comprehensive usage analytics.

```http
GET /api/v1/analytics/usage?period=month&metrics=queries,documents,users&breakdown=document_category,language
```

**Query Parameters:**
- `period` ("day" | "week" | "month" | "quarter" | "year"): Time period
- `startDate` (string, optional): Custom start date (ISO format)
- `endDate` (string, optional): Custom end date (ISO format)
- `granularity` ("hour" | "day" | "week" | "month"): Data granularity
- `metrics` (array): Metrics to include
- `breakdown` (array): Breakdown dimensions

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-12-12T00:00:00Z",
      "end": "2025-01-12T23:59:59Z",
      "duration": "month"
    },
    "metrics": {
      "totalQueries": 1250,
      "uniqueUsers": 45,
      "documentsProcessed": 28,
      "templatesGenerated": 85,
      "averageResponseTime": 1200,
      "totalApiCalls": 3580,
      "tokensUsed": 125000,
      "errorRate": 0.02
    },
    "trends": {
      "queries": [
        {
          "timestamp": "2025-01-01",
          "value": 45
        },
        {
          "timestamp": "2025-01-02",
          "value": 52
        }
      ],
      "users": [
        {
          "timestamp": "2025-01-01",
          "value": 12
        }
      ],
      "documents": [
        {
          "timestamp": "2025-01-01",
          "value": 3
        }
      ]
    },
    "breakdowns": {
      "document_category": [
        {
          "category": "policies",
          "count": 12,
          "percentage": 43
        },
        {
          "category": "contracts",
          "count": 8,
          "percentage": 29
        }
      ],
      "language": [
        {
          "category": "ar",
          "count": 890,
          "percentage": 71
        },
        {
          "category": "en",
          "count": 360,
          "percentage": 29
        }
      ]
    },
    "comparisons": {
      "previous_period": {
        "metrics": {
          "totalQueries": 1100,
          "uniqueUsers": 38,
          "documentsProcessed": 22
        },
        "change_percentage": {
          "queries": 14,
          "users": 18,
          "documents": 27
        }
      }
    }
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 10. Compliance Analytics

### Get Compliance Report

Generate comprehensive compliance report.

```http
GET /api/v1/analytics/compliance?categories=employment,wages&severity=all&includeResolved=false&language=ar
```

**Query Parameters:**
- `categories` (array): Compliance categories to analyze
- `severity` ("all" | "high" | "medium" | "low"): Filter by issue severity
- `includeResolved` (boolean): Include resolved issues
- `language` ("ar" | "en"): Report language

**Response:**
```json
{
  "success": true,
  "data": {
    "organization_id": "uuid",
    "assessment_date": "2025-01-12T10:30:00Z",
    "compliance_score": {
      "overall_score": 78,
      "category_scores": {
        "employment": {
          "score": 85,
          "issues_count": 3,
          "resolved_count": 1,
          "pending_count": 2
        },
        "wages": {
          "score": 72,
          "issues_count": 5,
          "resolved_count": 2,
          "pending_count": 3
        }
      },
      "trend": {
        "current_period": 78,
        "previous_period": 75,
        "change_percentage": 4
      }
    },
    "issues": [
      {
        "id": "employment_probation_1",
        "category": "employment",
        "severity": "high",
        "title": "فترة التجربة تتجاوز الحد المسموح",
        "description": "فترة التجربة يجب ألا تتجاوز 90 يوماً",
        "labor_law_reference": "المادة 53 - نظام العمل السعودي",
        "recommendation": "يُنصح بـ: فترة التجربة يجب ألا تتجاوز 90 يوماً. راجع المادة 53 - نظام العمل السعودي لمزيد من التفاصيل.",
        "affected_documents": [],
        "status": "open",
        "created_at": "2025-01-12T10:30:00Z"
      }
    ],
    "recommendations": [
      "مراجعة جميع عقود العمل للتأكد من مطابقتها لنظام العمل السعودي",
      "تحديث نماذج عقود العمل لتشمل جميع البنود المطلوبة"
    ],
    "risk_level": "medium",
    "action_items": [
      {
        "priority": "high",
        "category": "employment",
        "action": "معالجة مشكلة: فترة التجربة تتجاوز الحد المسموح",
        "due_date": "2025-01-19T10:30:00Z",
        "responsible_role": "hr_manager"
      }
    ],
    "labor_law_updates": [
      {
        "article_number": "53",
        "title": "فترة التجربة",
        "change_type": "modified",
        "effective_date": "2025-01-01T00:00:00Z",
        "impact_assessment": "قد يتطلب مراجعة السياسات الحالية"
      }
    ]
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

### Perform Compliance Scan

Initiate a new compliance scan.

```http
POST /api/v1/analytics/compliance/scan
```

**Request Body:**
```json
{
  "categories": ["employment", "wages", "termination", "leave"],
  "language": "ar"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_id": "uuid",
    "overall_score": 78,
    "risk_level": "medium",
    "issues": [...],
    "documents_analyzed": 25,
    "templates_analyzed": 8,
    "processing_time_ms": 2500
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## 11. System Health

### Health Check

Check system health status.

```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-12T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "up",
    "vectordb": "up",
    "storage": "up",
    "ai": "up"
  },
  "performance": {
    "database_latency_ms": 45,
    "api_response_time_ms": 120
  },
  "system_info": {
    "uptime_seconds": 86400,
    "memory_usage": {
      "used_mb": 512,
      "total_mb": 1024,
      "percentage": 50
    }
  }
}
```

### Detailed Health Check

Get detailed health metrics.

```http
POST /api/v1/health
```

---

## Rate Limiting Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705054800
```

## Webhooks

The system supports webhooks for real-time notifications:

### Document Processing Events
- `document.processing.started`
- `document.processing.completed`  
- `document.processing.failed`

### Template Generation Events
- `template.generated`
- `template.compliance.warning`

### Compliance Events
- `compliance.scan.completed`
- `compliance.issue.detected`

## SDKs and Client Libraries

Official client libraries are available for:

- **JavaScript/TypeScript**: `@hr-consultant/api-client`
- **Python**: `hr-consultant-client` 
- **PHP**: `hr-consultant/api-client`

## Support

For API support and questions:

- **Documentation**: [https://docs.hr-consultant.com](https://docs.hr-consultant.com)
- **Support Email**: api-support@hr-consultant.com
- **Developer Portal**: [https://developers.hr-consultant.com](https://developers.hr-consultant.com)

---

*Last Updated: January 12, 2025*
*API Version: 1.0.0*