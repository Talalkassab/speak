# Multi-Tenant HR RAG System Database Design

## Overview

This document describes the comprehensive database architecture for the multi-tenant HR RAG (Retrieval Augmented Generation) system designed for Saudi companies. The system ensures complete data isolation between organizations while providing powerful AI-driven HR consultation capabilities.

## Architecture Principles

### 1. Multi-Tenancy Model
- **Organization-Level Isolation**: Each organization (tenant) has complete data separation
- **Row-Level Security (RLS)**: PostgreSQL RLS policies ensure data cannot leak between tenants
- **Shared Knowledge Base**: Saudi Labor Law articles are shared across all tenants for consistency
- **Scalable Design**: Supports 1000+ organizations with efficient querying

### 2. Security Model
- **Zero Cross-Tenant Access**: Users can only see data from their organization
- **Role-Based Permissions**: Owner → Admin → HR Manager → HR Staff → Viewer hierarchy
- **Audit Logging**: Complete audit trail for all data access and modifications
- **Compliance Ready**: Designed for data protection and regulatory compliance

### 3. Performance Optimization
- **Vector Search**: Optimized pgvector indexes for semantic search
- **Query Performance**: Composite indexes for common multi-tenant query patterns
- **Connection Efficiency**: Designed for connection pooling and high concurrency
- **Storage Optimization**: Efficient storage of documents and embeddings

## Database Schema

### Core Tenant Management

#### Organizations Table
```sql
organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    settings JSONB,
    subscription_tier TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```
- **Primary tenant entity**
- **Subscription management integration**
- **Domain-based tenant identification support**
- **Hierarchical settings storage**

#### Organization Members
```sql
organization_members (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    user_id UUID REFERENCES auth.users,
    role TEXT CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'viewer')),
    is_active BOOLEAN,
    permissions JSONB,
    created_at TIMESTAMPTZ
)
```
- **Role-based access control**
- **User-organization relationship management**
- **Granular permissions support**
- **Activity tracking**

### Document Management System

#### Document Categories
```sql
document_categories (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN,
    created_by UUID REFERENCES auth.users
)
```

#### Documents with Versioning
```sql
documents (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    category_id UUID REFERENCES document_categories,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT,
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents,
    status TEXT CHECK (status IN ('processing', 'completed', 'failed', 'archived')),
    tags TEXT[],
    is_public BOOLEAN,
    uploaded_by UUID REFERENCES auth.users
)
```

#### Document Chunks for RAG
```sql
document_chunks (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    document_id UUID REFERENCES documents,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding VECTOR(1536),
    language TEXT DEFAULT 'ar',
    created_at TIMESTAMPTZ
)
```

### Conversation and RAG System

#### Conversations
```sql
conversations (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    user_id UUID REFERENCES auth.users,
    title TEXT NOT NULL,
    category TEXT,
    language TEXT DEFAULT 'ar',
    is_archived BOOLEAN DEFAULT false
)
```

#### Messages with AI Integration
```sql
messages (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations,
    conversation_id UUID REFERENCES conversations,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model_used TEXT,
    response_time_ms INTEGER,
    sources_used JSONB,
    confidence_score FLOAT,
    user_rating INTEGER
)
```

### Saudi Labor Law Knowledge Base (Shared)

#### Labor Law Categories
```sql
labor_law_categories (
    id UUID PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    code TEXT UNIQUE,
    parent_id UUID REFERENCES labor_law_categories,
    is_active BOOLEAN
)
```

#### Labor Law Articles
```sql
labor_law_articles (
    id UUID PRIMARY KEY,
    category_id UUID REFERENCES labor_law_categories,
    article_number TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    content_ar TEXT NOT NULL,
    content_en TEXT NOT NULL,
    keywords_ar TEXT[],
    keywords_en TEXT[],
    effective_date DATE
)
```

#### Labor Law Embeddings
```sql
labor_law_embeddings (
    id UUID PRIMARY KEY,
    article_id UUID REFERENCES labor_law_articles,
    text_content TEXT NOT NULL,
    language TEXT CHECK (language IN ('ar', 'en')),
    embedding VECTOR(1536)
)
```

## Row Level Security Policies

### Organization Isolation
```sql
-- Users can only see organizations they belong to
CREATE POLICY "org_member_access" ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);
```

### Document Access Control
```sql
-- Role-based document access with organization isolation
CREATE POLICY "document_access" ON documents FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
        is_public = true
        OR uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = auth.uid()
            AND organization_id = documents.organization_id
            AND role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
        )
    )
);
```

### Conversation Privacy
```sql
-- Users can only see their own conversations, HR managers can see all
CREATE POLICY "conversation_access" ON conversations FOR SELECT
USING (
    user_id = auth.uid()
    OR organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager')
        AND is_active = true
    )
);
```

## Performance Optimizations

### Indexes for Multi-Tenant Queries
```sql
-- Organization-scoped indexes
CREATE INDEX idx_documents_organization_status ON documents(organization_id, status);
CREATE INDEX idx_conversations_org_user ON conversations(organization_id, user_id);
CREATE INDEX idx_org_members_org_role ON organization_members(organization_id, role);

-- Vector search indexes
CREATE INDEX idx_doc_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_labor_law_embeddings ON labor_law_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### Query Performance Considerations
1. **Organization-First Filtering**: All tenant queries start with organization_id filter
2. **Composite Indexes**: Multi-column indexes for common query patterns
3. **Vector Index Tuning**: Optimized for embedding similarity searches
4. **Connection Pooling**: Designed for pgbouncer/connection pooling

## Security Testing Framework

### Automated Security Tests
The system includes comprehensive security tests to verify:

1. **Cross-Tenant Isolation**
   - Users cannot access other organizations' data
   - Document chunks respect organization boundaries
   - Conversations are properly isolated

2. **Role-Based Access Control**
   - Viewers can only read permitted documents
   - HR staff can create documents
   - Admins can manage organization settings

3. **Data Integrity**
   - All foreign key constraints are enforced
   - RLS policies prevent unauthorized access
   - Audit logs capture all security events

### Running Security Tests
```sql
-- Run comprehensive security test suite
SELECT * FROM run_security_test_suite();

-- Analyze test results
SELECT * FROM analyze_test_results();

-- Verify RLS is enabled on all tables
SELECT * FROM verify_rls_enabled();
```

## API Integration Patterns

### Organization Context
All API operations must include organization context:

```typescript
// Example: Get documents for current user's organization
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('status', 'completed');
  // RLS automatically filters by organization
```

### Vector Search Integration
```sql
-- Semantic search within organization
SELECT * FROM match_documents(
  query_embedding := embedding_vector,
  match_threshold := 0.78,
  match_count := 10,
  p_user_id := auth.uid()
);
```

## Deployment and Migration Strategy

### Migration Files
1. `20250811120000_multi_tenant_hr_rag_schema.sql` - Core schema
2. `20250811120001_multi_tenant_rls_policies.sql` - Security policies
3. `20250811120002_security_test_suite.sql` - Testing framework
4. `20250811120003_sample_data_and_functions.sql` - Utilities and sample data

### Deployment Checklist
- [ ] Run migrations in order
- [ ] Execute security test suite
- [ ] Verify all tests pass (100% pass rate required)
- [ ] Initialize Saudi labor law data
- [ ] Configure vector indexes
- [ ] Set up monitoring and alerts

## Maintenance and Monitoring

### Regular Maintenance Tasks
```sql
-- Cleanup expired invitations (run daily)
SELECT cleanup_expired_invitations();

-- Update usage statistics (run monthly)
SELECT update_organization_usage_stats();

-- Archive old conversations (run quarterly)
SELECT archive_old_conversations(12);

-- Cleanup old activity logs (run monthly)
SELECT cleanup_old_activity_logs(90);
```

### Health Monitoring
```sql
-- Generate organization health report
SELECT * FROM generate_org_health_report(organization_id);

-- Monitor query performance
SELECT * FROM test_query_performance();
```

## Compliance and Audit

### Audit Trail
- **User Activity Logs**: All user actions are logged with timestamps
- **Data Access Logs**: Document and conversation access tracking
- **Security Audit Logs**: Authentication and authorization events
- **API Usage Logs**: Complete API request/response logging

### Data Protection
- **Encryption at Rest**: All sensitive data encrypted in database
- **Encryption in Transit**: TLS for all connections
- **Access Controls**: Granular permissions and role-based access
- **Data Retention**: Configurable retention policies per organization

### Saudi Compliance
- **Labor Law Integration**: Current Saudi labor law articles included
- **Arabic Language Support**: Full RTL and Arabic text handling
- **Local Data Residency**: Designed for Saudi data center deployment
- **Regulatory Reporting**: Built-in compliance reporting capabilities

## Scaling Considerations

### Horizontal Scaling
- **Database Sharding**: Ready for organization-based sharding
- **Read Replicas**: RLS policies work with read replicas
- **Connection Pooling**: Optimized for high-concurrency scenarios
- **Caching Layers**: Designed for Redis/Memcached integration

### Performance Monitoring
- **Query Analysis**: Built-in performance testing functions
- **Index Usage**: Monitoring for index effectiveness
- **RLS Overhead**: Performance impact measurement
- **Vector Search Performance**: Embedding search optimization

## Development Workflow

### Local Development
1. Run Supabase locally with migrations
2. Create sample organization using utility functions
3. Use security test suite for validation
4. Test with multiple user roles

### Production Deployment
1. Run migrations in staging environment
2. Execute full security test suite
3. Performance testing under load
4. Deploy to production with monitoring

This database design provides a robust, secure, and scalable foundation for the multi-tenant HR RAG system, ensuring complete data isolation while enabling powerful AI-driven HR consultation capabilities for Saudi companies.