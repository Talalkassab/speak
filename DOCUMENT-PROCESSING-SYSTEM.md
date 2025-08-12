# Document Processing System for HR RAG Platform

A comprehensive document processing pipeline designed specifically for Arabic and English HR documents in Saudi organizations. This system provides intelligent text extraction, chunking, embedding generation, and semantic search capabilities.

## 🎯 Overview

This document processing system enables organizations to:
- Upload and process HR documents (PDFs, DOCX, TXT, Images)
- Extract text with OCR support for Arabic and English
- Chunk documents intelligently for optimal RAG performance
- Generate embeddings for semantic search
- Ensure security and compliance with Saudi data regulations
- Maintain organization-level data isolation

## 🏗️ Architecture

### Core Components

#### 1. **Document Upload API** (`/api/documents/upload`)
- Multi-tenant file validation with organization isolation
- File size and type restrictions based on subscription tier
- Progress tracking for large file uploads
- Automatic metadata extraction and storage path generation

#### 2. **Text Extraction Service**
- **PDF Processing**: Direct extraction + OCR fallback for scanned documents
- **DOCX Support**: Full Microsoft Word document parsing
- **Image OCR**: Tesseract.js with Arabic (`ara`) and English (`eng`) language packs
- **Text Files**: Multi-encoding support (UTF-8, Windows-1256 for Arabic)
- **Arabic Language Processing**: Text normalization, diacritics handling, RTL support

#### 3. **Document Chunking Service**
- **Language-Aware Chunking**:
  - Arabic: 800 chars max, 80 char overlap
  - English: 1000 chars max, 100 char overlap  
  - Mixed: 900 chars max, 90 char overlap
- **Intelligent Segmentation**: Respects sentence boundaries, paragraphs, headings
- **Context Preservation**: Maintains document structure and metadata

#### 4. **Security Validation Service**
- **Malware Detection**: Binary signature scanning
- **Content Analysis**: Suspicious pattern detection
- **File Type Validation**: MIME type verification and extension checking
- **Organizational Policies**: Custom security rules per organization
- **Rate Limiting**: Abuse prevention and quota management

#### 5. **Processing Orchestration**
- **Queue Management**: Retry logic with exponential backoff
- **Status Tracking**: Real-time processing progress
- **Error Handling**: Comprehensive error classification and recovery
- **Performance Monitoring**: Processing time and success rate tracking

## 🚀 Quick Start

### Prerequisites

```bash
npm install tesseract.js pdf2pic sharp jszip formidable
```

### Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI for Embeddings
OPENAI_API_KEY=your_openai_key

# Optional: Custom OCR Configuration
TESSERACT_CACHE_PATH=/tmp/tesseract
```

### Database Setup

1. **Apply Migrations**:
```bash
npm run migration:up
```

2. **Enable Required Extensions**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Usage Examples

#### Upload Documents
```typescript
const formData = new FormData();
formData.append('files', file);
formData.append('category_id', 'hr-policies');
formData.append('language', 'ar');
formData.append('tags', JSON.stringify(['سياسات', 'موارد بشرية']));

const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData
});
```

#### Search Documents
```typescript
// Text search
const searchResults = await fetch(`/api/documents/search?q=عقد العمل&language=ar`);

// Semantic search
const semanticResults = await fetch('/api/documents/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'ما هي سياسة الإجازات؟',
    similarity_threshold: 0.78,
    max_results: 10,
    language: 'ar'
  })
});
```

## 📁 File Structure

```
src/
├── app/api/documents/
│   ├── upload/route.ts              # File upload API
│   ├── [id]/route.ts               # Document CRUD operations
│   ├── [id]/reprocess/route.ts     # Reprocessing failed documents
│   ├── search/route.ts             # Document search (text + semantic)
│   ├── bulk-process/route.ts       # Bulk operations
│   └── health/route.ts             # System health checks
│
├── libs/document-processing/
│   ├── DocumentProcessorService.ts  # Main orchestration service
│   ├── TextExtractionService.ts    # Text extraction with OCR
│   ├── DocumentChunkingService.ts  # Intelligent chunking
│   └── SecurityValidationService.ts # Security and validation
│
├── services/rag/
│   ├── EmbeddingGenerationService.ts # OpenAI embeddings
│   └── RetrievalService.ts          # Vector search
│
├── types/
│   └── documents.ts                # TypeScript interfaces
│
└── scripts/
    └── document-processing-cli.ts   # Administrative CLI tool
```

## 🔧 Configuration

### Chunking Configurations

```typescript
// Language-specific configurations
const CHUNKING_CONFIGS = {
  ar: {
    maxChunkSize: 800,
    chunkOverlap: 80,
    separators: ['\n\n', '\n', '؟', '؛', '،', '.', '!', '?']
  },
  en: {
    maxChunkSize: 1000,
    chunkOverlap: 100,
    separators: ['\n\n', '\n', '.', '!', '?', ';', ',']
  }
};
```

### Security Settings

```typescript
const SECURITY_CONFIG = {
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
  ],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  scanForMalware: true,
  requireApproval: false
};
```

### Organization Limits

```typescript
const ORG_LIMITS = {
  basic: {
    maxDocuments: 100,
    maxStorageGB: 10,
    processingPriority: 5
  },
  professional: {
    maxDocuments: 1000,
    maxStorageGB: 100,
    processingPriority: 3
  },
  enterprise: {
    maxDocuments: -1, // unlimited
    maxStorageGB: -1,
    processingPriority: 1
  }
};
```

## 🔍 API Reference

### Upload Documents

**POST** `/api/documents/upload`

```javascript
// Request (multipart/form-data)
{
  files: File[],
  category_id?: string,
  language: 'ar' | 'en' | 'mixed',
  tags?: string[],
  is_public?: boolean,
  description?: string
}

// Response
{
  success: boolean,
  results: Array<{
    filename: string,
    success: boolean,
    document_id?: string,
    error?: string
  }>,
  summary: {
    total: number,
    successful: number,
    failed: number
  }
}
```

### Search Documents

**GET** `/api/documents/search`

```javascript
// Query Parameters
?q=search query
&category_id=uuid
&language=ar|en|mixed
&status=completed|processing|failed
&limit=20
&offset=0

// Response
{
  success: true,
  documents: {
    data: Document[],
    count: number,
    has_more: boolean
  },
  chunks: {
    data: DocumentChunk[],
    count: number
  }
}
```

**POST** `/api/documents/search` (Semantic Search)

```javascript
// Request Body
{
  query: string,
  similarity_threshold?: number, // default: 0.78
  max_results?: number,         // default: 10
  category_id?: string,
  language?: 'ar' | 'en' | 'mixed'
}

// Response
{
  success: true,
  results: {
    documents: Array<{
      document_id: string,
      document_name: string,
      max_similarity: number,
      chunk_count: number
    }>,
    chunks: Array<{
      id: string,
      content: string,
      similarity: number,
      document_name: string
    }>
  }
}
```

### Document Management

**GET** `/api/documents/[id]` - Get document details
**PUT** `/api/documents/[id]` - Update document metadata  
**DELETE** `/api/documents/[id]` - Delete document

**POST** `/api/documents/[id]/reprocess` - Retry failed processing

## 🛠️ CLI Tools

The system includes a comprehensive CLI tool for administration:

```bash
# Health check
npx ts-node src/scripts/document-processing-cli.ts health --detailed

# Clean up failed documents
npx ts-node src/scripts/document-processing-cli.ts cleanup --older-than 24

# Manage processing queue
npx ts-node src/scripts/document-processing-cli.ts queue --retry-failed

# Performance analysis
npx ts-node src/scripts/document-processing-cli.ts analyze --days 7

# Run system tests
npx ts-node src/scripts/document-processing-cli.ts test --security --ocr
```

### CLI Commands

#### Health Check
```bash
document-processing-cli health [options]
  --detailed     Show detailed diagnostics
  --json         Output in JSON format
```

#### Cleanup
```bash
document-processing-cli cleanup [options]
  --dry-run                Show what would be cleaned
  --older-than <hours>     Only clean items older than X hours
  --include-completed      Also clean old completed documents
```

#### Queue Management
```bash
document-processing-cli queue [options]
  --status <status>        Filter by status
  --retry-failed          Retry all failed jobs
  --cancel-stuck          Cancel jobs stuck > 1 hour
  --limit <number>        Limit items to process
```

## 🔒 Security Features

### File Validation
- **MIME Type Verification**: Ensures uploaded files match declared types
- **Extension Blocking**: Prevents upload of executable files
- **Malware Scanning**: Basic signature-based detection
- **Content Analysis**: Scans for suspicious patterns and scripts

### Access Control
- **Organization Isolation**: RLS policies ensure data separation
- **Role-Based Permissions**: Different access levels (viewer, hr_staff, hr_manager, admin)
- **File-Level Security**: Individual document permissions

### Privacy Protection
- **PII Detection**: Identifies potential personal information
- **Data Retention**: Configurable retention policies
- **Audit Logging**: Comprehensive activity tracking
- **Encryption**: Files encrypted at rest in Supabase Storage

## 🌍 Arabic Language Support

### Text Processing
- **RTL Support**: Proper handling of right-to-left text
- **Diacritics Handling**: Normalization for better search
- **Character Normalization**: Alef variants, Taa Marbouta, etc.
- **Mixed Content**: Intelligent detection of Arabic/English mixed text

### OCR Configuration
```javascript
// Tesseract.js Arabic setup
await createWorker('ara+eng', 1, {
  logger: m => console.log('OCR:', m)
});

await worker.setParameters({
  tessedit_pageseg_mode: '1',
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '1'
});
```

### Search Optimization
- **Arabic Stemming**: Root-based search capabilities
- **Fuzzy Matching**: Handles spelling variations
- **Phonetic Search**: Arabic pronunciation-based matching

## 📊 Monitoring & Analytics

### Performance Metrics
- Processing time per document type
- Success/failure rates by organization
- Queue depth and processing throughput
- Storage utilization tracking

### Health Monitoring
```javascript
// Health check endpoint returns:
{
  timestamp: "2025-01-11T10:30:00Z",
  status: "healthy" | "degraded" | "unhealthy",
  services: {
    database: { status: "healthy", details: "..." },
    storage: { status: "healthy", details: "..." },
    ocr: { status: "healthy", languages: ["ara", "eng"] },
    embeddings: { status: "healthy", model: "text-embedding-ada-002" }
  },
  processing_queue: {
    pending: 5,
    processing: 2,
    failed: 0,
    completed_last_hour: 23
  }
}
```

## 🚨 Error Handling

### Processing States
- **pending**: Queued for processing
- **processing**: Currently being processed
- **completed**: Successfully processed
- **failed**: Processing failed (with retry capability)

### Retry Logic
- Exponential backoff: 1min, 5min, 15min, 60min
- Maximum 3 retry attempts per document
- Different retry strategies based on error type
- Manual retry capability for HR administrators

### Error Classification
```typescript
interface ProcessingError {
  type: 'extraction_failed' | 'chunking_failed' | 'embedding_failed' | 'storage_failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  retry_recommended: boolean;
}
```

## 📈 Performance Optimization

### Chunking Optimization
- Language-specific chunk sizes for optimal embedding quality
- Overlap strategy to preserve context across chunks
- Section-aware chunking (headings, paragraphs, lists)
- Minimum viable chunk size to avoid noise

### Embedding Efficiency
- Batch processing for multiple documents
- Embedding caching to avoid regeneration
- Progressive embedding (prioritize recent documents)
- Rate limiting to stay within OpenAI quotas

### Storage Optimization
- File compression for text-heavy documents
- CDN integration for fast file access
- Automatic cleanup of orphaned files
- Storage usage monitoring and alerting

## 🔧 Troubleshooting

### Common Issues

**1. OCR Not Working**
```bash
# Check OCR health
npm run document-cli health --detailed

# Test OCR specifically
npm run document-cli test --ocr
```

**2. High Processing Failures**
```bash
# Check recent failures
npm run document-cli queue --status failed

# Retry failed jobs
npm run document-cli queue --retry-failed
```

**3. Storage Issues**
```bash
# Check storage usage
npm run document-cli analyze --days 30

# Clean up old files
npm run document-cli cleanup --older-than 48
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=document-processing:* npm run dev

# Check specific component
DEBUG=document-processing:ocr,document-processing:chunking npm run dev
```

## 🚀 Deployment

### Production Checklist
- [ ] Database migrations applied
- [ ] Storage buckets configured with proper RLS
- [ ] OpenAI API key configured
- [ ] Tesseract.js language packs downloaded
- [ ] Rate limiting configured
- [ ] Monitoring and alerting setup
- [ ] Backup and recovery procedures tested

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key

# Processing configuration
PROCESSING_CONCURRENCY=5
MAX_FILE_SIZE=52428800
OCR_TIMEOUT=300000
EMBEDDING_BATCH_SIZE=10
```

### Scaling Considerations
- **Horizontal Scaling**: Multiple processing workers
- **Queue Management**: Redis for production queue management
- **CDN Integration**: Cloudflare for global file distribution
- **Database Optimization**: Connection pooling and read replicas
- **Monitoring**: Application performance monitoring (APM) integration

## 📚 API Documentation

Complete API documentation is available at `/api/docs` when running in development mode. The documentation includes:

- Interactive API explorer
- Request/response schemas
- Authentication examples
- Error code references
- Rate limiting information

## 🤝 Contributing

### Development Setup
1. Clone repository and install dependencies
2. Set up local Supabase instance
3. Configure environment variables
4. Run database migrations
5. Start development server

### Code Standards
- TypeScript for all new code
- ESLint and Prettier for formatting
- Jest for unit tests
- Comprehensive error handling
- Documentation for public APIs

### Testing
```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security

# Test specific components
npm run test -- --testNamePattern="TextExtraction"
```

## 📄 License

This document processing system is part of the HR RAG Platform and follows the same licensing terms as the main project.

---

For technical support or questions, please refer to the main project documentation or create an issue in the project repository.