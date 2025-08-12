# HR Business Consultant RAG System

## Overview

This document describes the comprehensive RAG (Retrieval-Augmented Generation) system built for the HR Business Consultant platform, specifically optimized for Saudi companies and Arabic language support.

## Architecture

### Core Components

1. **Embedding Service** (`embedding-service.ts`)
   - Optimized embedding pipeline with Arabic language support
   - Batch processing for efficiency
   - Quality validation and caching
   - Multiple model selection based on content type

2. **Enhanced Retrieval Service** (`enhanced-retrieval-service.ts`)
   - Intelligent hybrid search (semantic + keyword)
   - Multi-language query understanding
   - Advanced ranking algorithms with diversity
   - Context-aware result scoring

3. **Response Generation Service** (`response-generation-service.ts`)
   - Context-aware prompt engineering
   - Saudi labor law expertise integration
   - Multi-language response generation
   - Fact verification and quality validation

4. **Conversation Context Service** (`conversation-context-service.ts`)
   - Multi-turn conversation support
   - Context window optimization
   - Memory management with decay
   - Topic tracking and entity extraction

5. **Performance Optimization Service** (`performance-optimization-service.ts`)
   - Redis-based caching system
   - Performance metrics tracking
   - Cost optimization
   - Health monitoring

6. **Arabic Text Processing Service** (`arabic-text-processing-service.ts`)
   - Arabic text normalization and analysis
   - Intelligent chunking strategies
   - Entity extraction for Arabic content
   - Dialect detection and processing

7. **RAG Orchestrator Service** (`rag-orchestrator-service.ts`)
   - Main coordination service
   - API integration
   - Error handling and fallbacks
   - Analytics and monitoring

## Key Features

### 🌍 Multi-Language Support
- **Arabic Language Optimization**: Proper handling of RTL text, diacritics, and Arabic-specific linguistic features
- **Dialect Detection**: Identifies and handles different Arabic dialects (Gulf, Levantine, Egyptian, Maghrebi)
- **Mixed Language Content**: Seamlessly processes documents with both Arabic and English content

### 🧠 Intelligent Retrieval
- **Hybrid Search**: Combines semantic similarity with keyword matching
- **Query Expansion**: Automatically expands queries with synonyms and related terms
- **Context-Aware Ranking**: Scores results based on relevance, recency, authority, and user context
- **Diversity Optimization**: Ensures diverse sources in search results using MMR algorithm

### 📊 Performance Optimization
- **Multi-Level Caching**: Redis-based caching for embeddings, responses, and search results
- **Batch Processing**: Efficient processing of multiple documents with rate limiting
- **Cost Optimization**: Smart model selection and token usage tracking
- **Quality Validation**: Automatic quality scoring and validation of embeddings and responses

### 🔒 Enterprise Security
- **Multi-Tenant Architecture**: Complete isolation between organizations
- **Row-Level Security**: Database-level access control
- **Role-Based Access**: Different permission levels (basic, advanced, admin)
- **Audit Trail**: Complete logging of all interactions and changes

## API Endpoints

### Query Processing
```http
POST /api/rag/query
Content-Type: application/json

{
  "query": "ما هي سياسة الإجازات في الشركة؟",
  "conversationId": "uuid",
  "language": "ar",
  "preferences": {
    "responseStyle": "detailed",
    "includeCompanyDocs": true,
    "includeLaborLaw": true,
    "maxSources": 10,
    "confidenceThreshold": 0.75
  }
}
```

### Document Processing
```http
POST /api/rag/documents/process
Content-Type: application/json

{
  "documentId": "uuid",
  "content": "Document content...",
  "filename": "hr-policy.pdf",
  "language": "ar",
  "processingOptions": {
    "generateEmbeddings": true,
    "extractEntities": true,
    "chunkingStrategy": "semantic",
    "maxChunkSize": 1000
  }
}
```

### Conversation Management
```http
GET /api/rag/conversations/{conversationId}?include_summary=true&include_context=true

DELETE /api/rag/conversations/{conversationId}

PATCH /api/rag/conversations/{conversationId}
{
  "action": "generate_summary",
  "data": { "maxTokens": 1000 }
}
```

## Database Schema

### Core Tables

**documents**
- Multi-language document storage
- Processing metadata and status
- Quality scores and metrics

**document_chunks**
- Intelligent text chunking
- Vector embeddings storage
- Quality and relevance scoring

**document_entities**
- Extracted named entities
- Arabic and English entity types
- Confidence scoring

**messages**
- Conversation messages
- Metadata and context
- Multi-language support

**conversation_contexts**
- Context state management
- Memory and topic tracking
- User preferences

**rag_interactions**
- Analytics and monitoring
- Performance metrics
- Cost tracking

**user_profiles**
- Role-based access control
- User preferences
- Organization membership

## Usage Examples

### Basic Query
```typescript
import { RAGOrchestratorService } from '@/libs/services/rag-orchestrator-service';

const ragService = new RAGOrchestratorService();

const response = await ragService.processRAGQuery({
  query: "كم مدة الإجازة السنوية للموظف؟",
  organizationId: "org-uuid",
  userId: "user-uuid",
  language: "ar",
  preferences: {
    responseStyle: "balanced",
    includeCompanyDocs: true,
    includeLaborLaw: true,
    maxSources: 8
  }
});

console.log(response.answer);
console.log(response.sources);
console.log(response.confidence);
```

### Document Processing
```typescript
const result = await ragService.processDocument({
  documentId: "doc-uuid",
  organizationId: "org-uuid",
  content: "محتوى الوثيقة...",
  filename: "سياسة-الموارد-البشرية.pdf",
  language: "ar",
  processingOptions: {
    generateEmbeddings: true,
    extractEntities: true,
    performQualityCheck: true,
    chunkingStrategy: "semantic",
    maxChunkSize: 800
  }
});
```

### Arabic Text Processing
```typescript
import { ArabicTextProcessingService } from '@/libs/services/arabic-text-processing-service';

const arabicService = new ArabicTextProcessingService();

// Text analysis
const analysis = arabicService.analyzeArabicText("النص العربي...");
console.log(analysis.language);
console.log(analysis.dialectInfo);
console.log(analysis.entities);

// Intelligent chunking
const chunks = arabicService.chunkArabicText(content, {
  maxChunkSize: 1000,
  chunkingStrategy: "semantic",
  preserveStructure: true,
  respectWordBoundaries: true
});

// Query optimization
const optimization = arabicService.optimizeArabicSearchQuery("البحث عن الراتب");
console.log(optimization.expandedQuery);
console.log(optimization.synonyms);
```

## Configuration

### Environment Variables
```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# RAG System Configuration
RAG_DEFAULT_MODEL=gpt-4-turbo
RAG_MAX_CONTEXT_TOKENS=4000
RAG_CACHE_TTL=3600
RAG_BATCH_SIZE=50
```

### System Configuration
```typescript
// Embedding model preferences
const EMBEDDING_MODELS = {
  'text-embedding-ada-002': { // Multilingual, cost-effective
    dimensions: 1536,
    maxTokens: 8191,
    language: 'multilingual',
    costPerToken: 0.0001 / 1000
  },
  'text-embedding-3-large': { // High quality for legal content
    dimensions: 3072,
    maxTokens: 8191,
    language: 'multilingual',
    costPerToken: 0.00013 / 1000
  }
};

// Chunking strategies
const CHUNKING_OPTIONS = {
  semantic: { // Best for mixed content
    preserveStructure: true,
    useSemanticBoundaries: true,
    respectWordBoundaries: true
  },
  sentence: { // Good for formal documents
    separators: ['\n\n', '\n', '。', '!', '؟', '.'],
    overlapRatio: 0.1
  }
};
```

## Performance Optimization

### Caching Strategy
- **Embeddings**: 24-hour TTL with LFU eviction
- **Responses**: 1-hour TTL with LRU eviction  
- **Search Results**: 30-minute TTL with TTL eviction
- **Conversations**: 2-hour TTL with LRU eviction

### Cost Optimization
- Smart model selection based on content complexity
- Batch processing for multiple documents
- Aggressive caching to reduce API calls
- Token usage monitoring and alerts

### Quality Assurance
- Automatic quality scoring for all embeddings
- Fact-checking against source documents
- Bias detection in generated responses
- Compliance checking for Saudi regulations

## Monitoring and Analytics

### Performance Metrics
- Cache hit ratios
- Average response times
- Token usage and costs
- Quality scores
- Error rates

### Business Metrics
- User satisfaction scores
- Conversation completion rates
- Document processing success rates
- Most common query patterns

### Health Monitoring
```typescript
const health = await ragService.getSystemHealth();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.components); // Individual component status
console.log(health.recommendations); // Performance improvement suggestions
```

## Deployment

### Database Setup
1. Run the RAG system migration:
```bash
npx supabase migration up --file 20250812140000_create_rag_optimization_schema.sql
```

2. Generate new types:
```bash
npm run generate-types
```

### Redis Setup (Optional)
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or use a managed service like Redis Cloud
```

### Environment Setup
1. Copy environment variables
2. Configure OpenAI API access
3. Set up Redis (optional but recommended)
4. Configure Supabase connection

### Initial Data Setup
```typescript
// Load Saudi Labor Law data
npm run saudi-law:load

// Process existing documents
npm run documents:reprocess
```

## Best Practices

### For Developers

1. **Error Handling**: Always implement fallback responses
2. **Caching**: Use caching strategically to reduce costs
3. **Quality Validation**: Validate all generated content
4. **Security**: Never expose user data in logs or errors

### For Content

1. **Arabic Text**: Ensure proper normalization before processing
2. **Document Structure**: Use clear headers and sections
3. **Metadata**: Include relevant categorization and tagging
4. **Quality**: Perform regular quality audits

### For Performance

1. **Batch Operations**: Process multiple documents together
2. **Model Selection**: Use appropriate models for each task
3. **Context Management**: Optimize conversation context size
4. **Monitoring**: Set up alerts for performance degradation

## Troubleshooting

### Common Issues

**High Response Times**
- Check Redis connectivity
- Verify database indexes
- Monitor OpenAI API latency
- Review cache hit ratios

**Low Quality Responses**
- Check embedding quality scores
- Verify document processing completion
- Review source relevance scores
- Update prompt templates

**High Costs**
- Monitor token usage patterns
- Optimize model selection
- Increase cache hit ratios
- Implement query optimization

**Arabic Processing Issues**
- Verify Unicode normalization
- Check dialect detection accuracy
- Validate entity extraction results
- Review chunking boundaries

### Debug Commands
```bash
# Health check
curl -X GET /api/rag/query

# Processing status
curl -X GET /api/rag/documents/process

# System metrics
curl -X GET /api/admin/rag/metrics
```

## Future Enhancements

### Planned Features
- Advanced analytics dashboard
- Custom model fine-tuning
- Multi-modal document processing
- Voice query support
- Integration with external systems

### Performance Improvements
- Vector database optimization
- Advanced caching strategies
- Model quantization
- Edge deployment options

## Support

For technical support or questions about the RAG system:

1. Check the troubleshooting guide above
2. Review system health metrics
3. Contact the development team
4. Submit issues through the project repository

---

**Version**: 2.0  
**Last Updated**: January 2025  
**Maintained by**: HR Tech Team