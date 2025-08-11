# TASK-037: Set Up Vector Database for RAG System

**Priority**: P0 (Critical)  
**Phase**: Backend Architecture - Day 10  
**Assigned Agent**: `ai-engineer.md`  
**Estimated Time**: 8 hours  
**Dependencies**: TASK-029 (Multi-tenant DB schema)  

## Objective
Configure and implement a vector database solution for the RAG system that supports multi-tenant document embeddings, efficient similarity search, and integration with both Saudi labor law knowledge and company-specific documents.

## Acceptance Criteria
- [ ] Vector database configured and accessible
- [ ] Multi-tenant embedding storage implemented
- [ ] Similarity search functions operational
- [ ] Saudi labor law embeddings loaded
- [ ] Document chunking strategy implemented
- [ ] Performance benchmarks met (<500ms search)
- [ ] Backup and recovery procedures established

## Vector Database Options Analysis

### Option 1: Supabase pgvector (Recommended)
**Pros:**
- Native integration with existing Supabase setup
- Automatic multi-tenant isolation via RLS
- No additional infrastructure required
- Direct SQL queries possible

**Cons:**
- Performance limitations at scale
- Limited advanced vector operations

### Option 2: Pinecone
**Pros:**
- Purpose-built for vector search
- Excellent performance and scalability
- Advanced filtering capabilities

**Cons:**
- Additional cost and complexity
- External service dependency
- Multi-tenant isolation requires careful namespace management

### Option 3: Weaviate
**Pros:**
- Open source with commercial support
- Advanced semantic search capabilities
- Good multi-tenancy support

**Cons:**
- Additional infrastructure to manage
- Learning curve for team

**Decision: Start with Supabase pgvector for MVP, plan migration to Pinecone for scale**

## Implementation Plan

### Phase 1: Supabase pgvector Setup

#### 1. Enable Vector Extension
```sql
-- Already enabled in TASK-029, but verify
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is working
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

#### 2. Vector Tables (from TASK-029)
```sql
-- Document embeddings table
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI ada-002 dimension
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Saudi law embeddings table
CREATE TABLE saudi_law_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  content_en TEXT NOT NULL,
  category TEXT NOT NULL,
  embedding_ar VECTOR(1536),
  embedding_en VECTOR(1536),
  -- ... other fields from TASK-029
);
```

#### 3. Vector Indexes
```sql
-- Create IVFFlat indexes for similarity search
CREATE INDEX idx_document_embeddings_vector 
ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX idx_saudi_law_embedding_ar 
ON saudi_law_articles 
USING ivfflat (embedding_ar vector_cosine_ops) 
WITH (lists = 50);

CREATE INDEX idx_saudi_law_embedding_en 
ON saudi_law_articles 
USING ivfflat (embedding_en vector_cosine_ops) 
WITH (lists = 50);
```

### Phase 2: Document Chunking Strategy

#### Chunking Configuration
```typescript
interface ChunkingConfig {
  chunkSize: number; // 500-1000 tokens
  chunkOverlap: number; // 50-100 tokens
  separators: string[]; // ['\n\n', '\n', '.', '!', '?']
  minChunkSize: number; // 100 tokens
  maxChunkSize: number; // 1500 tokens
}

const arabicChunkingConfig: ChunkingConfig = {
  chunkSize: 800,
  chunkOverlap: 80,
  separators: ['\n\n', '\n', '。', '!', '؟', '.'],
  minChunkSize: 150,
  maxChunkSize: 1200
};

const englishChunkingConfig: ChunkingConfig = {
  chunkSize: 1000,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '.', '!', '?'],
  minChunkSize: 200,
  maxChunkSize: 1500
};
```

#### Document Processing Pipeline
```typescript
class DocumentProcessor {
  async processDocument(document: Document): Promise<DocumentChunk[]> {
    // 1. Extract text content
    const textContent = await this.extractText(document);
    
    // 2. Detect language
    const language = await this.detectLanguage(textContent);
    
    // 3. Apply language-specific chunking
    const config = language === 'ar' ? arabicChunkingConfig : englishChunkingConfig;
    const chunks = await this.chunkText(textContent, config);
    
    // 4. Generate embeddings for each chunk
    const embeddings = await this.generateEmbeddings(chunks, language);
    
    // 5. Store in vector database
    return await this.storeEmbeddings(document.id, chunks, embeddings);
  }
  
  private async chunkText(text: string, config: ChunkingConfig): Promise<string[]> {
    // Implement recursive character text splitting
    // Handle Arabic text directionality
    // Preserve sentence boundaries
  }
}
```

### Phase 3: Similarity Search Implementation

#### Search Functions
```sql
-- Function for hybrid search (keyword + semantic)
CREATE OR REPLACE FUNCTION search_documents(
  org_id UUID,
  query_embedding VECTOR(1536),
  search_query TEXT,
  result_limit INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
  document_id UUID,
  chunk_content TEXT,
  similarity_score FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.document_id,
    de.content,
    1 - (de.embedding <=> query_embedding) as similarity,
    de.metadata
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE de.organization_id = org_id
    AND d.status = 'ready'
    AND (1 - (de.embedding <=> query_embedding)) > similarity_threshold
    AND (search_query = '' OR de.content ILIKE '%' || search_query || '%')
  ORDER BY de.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search Saudi labor law
CREATE OR REPLACE FUNCTION search_saudi_law(
  query_embedding VECTOR(1536),
  language TEXT DEFAULT 'ar',
  result_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  article_id UUID,
  article_number TEXT,
  title TEXT,
  content TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  IF language = 'ar' THEN
    RETURN QUERY
    SELECT 
      sla.id,
      sla.article_number,
      sla.title_ar,
      sla.content_ar,
      1 - (sla.embedding_ar <=> query_embedding) as similarity
    FROM saudi_law_articles sla
    WHERE sla.status = 'active'
    ORDER BY sla.embedding_ar <=> query_embedding
    LIMIT result_limit;
  ELSE
    RETURN QUERY
    SELECT 
      sla.id,
      sla.article_number,
      sla.title_en,
      sla.content_en,
      1 - (sla.embedding_en <=> query_embedding) as similarity
    FROM saudi_law_articles sla
    WHERE sla.status = 'active'
    ORDER BY sla.embedding_en <=> query_embedding
    LIMIT result_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

#### TypeScript Search Service
```typescript
export class VectorSearchService {
  async searchRelevantContent(
    organizationId: string,
    query: string,
    language: 'ar' | 'en' = 'ar'
  ): Promise<SearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query, language);
    
    // 2. Search company documents
    const companyResults = await this.searchCompanyDocuments(
      organizationId, 
      queryEmbedding, 
      query
    );
    
    // 3. Search Saudi labor law
    const lawResults = await this.searchSaudiLaw(queryEmbedding, language);
    
    // 4. Combine and rank results
    return this.combineAndRankResults(companyResults, lawResults);
  }
  
  private async generateQueryEmbedding(
    query: string, 
    language: 'ar' | 'en'
  ): Promise<number[]> {
    // Use OpenAI embeddings API
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    
    return response.data[0].embedding;
  }
}
```

### Phase 4: Saudi Labor Law Data Loading

#### Data Structure
```typescript
interface SaudiLawArticle {
  articleNumber: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  category: string;
  subcategory?: string;
  lawSource: string;
  effectiveDate?: Date;
}
```

#### Data Loading Script
```typescript
class SaudiLawLoader {
  async loadSaudiLaborLaw(): Promise<void> {
    // 1. Parse Saudi labor law documents
    const articles = await this.parseLaborLawDocuments();
    
    // 2. Generate embeddings for each article
    for (const article of articles) {
      const embeddingAr = await this.generateEmbedding(
        `${article.titleAr}\n${article.contentAr}`,
        'ar'
      );
      
      const embeddingEn = await this.generateEmbedding(
        `${article.titleEn}\n${article.contentEn}`,
        'en'
      );
      
      // 3. Store in database
      await this.storeLawArticle(article, embeddingAr, embeddingEn);
    }
  }
  
  private async parseLaborLawDocuments(): Promise<SaudiLawArticle[]> {
    // Parse official Saudi labor law documents
    // Convert PDF/Word documents to structured data
    // Validate article numbers and content
  }
}
```

### Phase 5: Performance Optimization

#### Query Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM search_documents(
  'org-uuid-here'::UUID,
  '[0.1,0.2,...]'::VECTOR(1536),
  'employment contract',
  10,
  0.7
);

-- Optimize index parameters
ALTER INDEX idx_document_embeddings_vector 
SET (lists = 200); -- Adjust based on data size

-- Create composite indexes for common queries
CREATE INDEX idx_document_embeddings_org_status 
ON document_embeddings(organization_id) 
WHERE EXISTS (
  SELECT 1 FROM documents d 
  WHERE d.id = document_embeddings.document_id 
  AND d.status = 'ready'
);
```

#### Connection Pooling
```typescript
// Configure Supabase client for vector operations
const vectorClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-my-custom-header': 'vector-search' },
    },
  }
);
```

### Phase 6: Monitoring and Backup

#### Performance Monitoring
```sql
-- Monitor vector index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%vector%';

-- Monitor query performance
CREATE TABLE vector_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  query_text TEXT,
  result_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Backup Strategy
```bash
# Backup vector embeddings separately
pg_dump -h localhost -p 5432 -U postgres -d hr_rag \
  --data-only \
  --table=document_embeddings \
  --table=saudi_law_articles \
  --compress=9 \
  --file=vector_embeddings_backup.sql.gz
```

## Deliverables
1. Vector database configuration and setup scripts
2. Document chunking and processing pipeline
3. Similarity search functions and APIs
4. Saudi labor law data loading scripts
5. Performance optimization configurations
6. Monitoring and alerting setup
7. Backup and recovery procedures
8. Load testing results and benchmarks
9. API documentation for vector search endpoints

## Testing Criteria
- [ ] Vector similarity search returns relevant results
- [ ] Multi-tenant isolation verified (no cross-org results)
- [ ] Search response time under 500ms for 90% of queries
- [ ] Arabic and English content searches work correctly
- [ ] Saudi law articles are properly embedded and searchable
- [ ] Document chunking preserves context and meaning
- [ ] Error handling for failed embeddings
- [ ] Backup and restore procedures verified

## Performance Benchmarks
- **Search Latency**: <500ms for 95% of queries
- **Throughput**: 100 concurrent searches per second
- **Accuracy**: >85% relevance for domain-specific queries
- **Storage**: <2GB per 1000 documents with embeddings

## Security Considerations
- Embed generation API key protection
- RLS policies on vector tables
- Audit logging for search queries
- Rate limiting on embedding generation

## Related Tasks
- Depends on: TASK-029 (Multi-tenant DB schema)
- Blocks: TASK-038 (Document embedding pipeline)
- Blocks: TASK-039 (Retrieval system)
- Related: TASK-050 (Saudi labor law dataset)
- Related: TASK-054 (RAG optimization)