# TASK-029: Design Multi-Tenant Database Schema

**Priority**: P0 (Critical)  
**Phase**: Backend Architecture - Day 8  
**Assigned Agent**: `backend-architect.md`  
**Estimated Time**: 6 hours  
**Dependencies**: None (Backend foundation task)  

## Objective
Design and implement a comprehensive multi-tenant database schema for the HR RAG system that ensures complete data isolation between organizations while supporting efficient queries and scalable architecture.

## Acceptance Criteria
- [ ] Complete data isolation between organizations
- [ ] Row Level Security (RLS) policies implemented
- [ ] Scalable schema supporting 1000+ organizations
- [ ] Efficient indexing strategy
- [ ] Audit logging capabilities
- [ ] Migration scripts for schema deployment
- [ ] Performance testing completed

## Database Schema Design

### Core Tables

#### 1. Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::JSONB,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  storage_limit_gb INTEGER DEFAULT 5,
  user_limit INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_status ON organizations(status);
```

#### 2. Organization Members Table
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr_manager', 'hr_staff', 'viewer')),
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user can only be in org once
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
```

#### 3. Documents Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  category TEXT CHECK (category IN ('policy', 'contract', 'procedure', 'handbook', 'form', 'other')),
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'mixed')),
  status TEXT DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  content_extracted TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_org_id ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_category ON documents(organization_id, category);
CREATE INDEX idx_documents_language ON documents(organization_id, language);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
```

#### 4. Document Versions Table
```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  content_extracted TEXT,
  changes_summary TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, version_number)
);
```

#### 5. Conversations Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_org_user ON conversations(organization_id, user_id);
CREATE INDEX idx_conversations_last_message ON conversations(organization_id, last_message_at DESC);
```

#### 6. Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language TEXT CHECK (language IN ('ar', 'en')),
  sources JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  tokens_used INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_org_id ON messages(organization_id);
CREATE INDEX idx_messages_rating ON messages(organization_id, rating) WHERE rating IS NOT NULL;
```

#### 7. Document Embeddings Table
```sql
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

-- Vector similarity index
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_document_embeddings_org ON document_embeddings(organization_id);
```

#### 8. Saudi Law Knowledge Base
```sql
CREATE TABLE saudi_law_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  content_en TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  law_source TEXT NOT NULL, -- Labor Law, Executive Regulations, etc.
  effective_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'amended', 'repealed')),
  embedding_ar VECTOR(1536),
  embedding_en VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saudi_law_category ON saudi_law_articles(category, subcategory);
CREATE INDEX idx_saudi_law_status ON saudi_law_articles(status);
CREATE INDEX idx_saudi_law_embedding_ar ON saudi_law_articles 
  USING ivfflat (embedding_ar vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_saudi_law_embedding_en ON saudi_law_articles 
  USING ivfflat (embedding_en vector_cosine_ops) WITH (lists = 100);
```

#### 9. Audit Log Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_org_time ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

## Row Level Security (RLS) Policies

### Organizations Table
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organizations
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only admins can update organization settings
CREATE POLICY "Admins can update organizations" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );
```

### Documents Table
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can only see documents from their organization
CREATE POLICY "Users can view org documents" ON documents
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- HR Managers and above can upload documents
CREATE POLICY "HR staff can insert documents" ON documents
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_manager', 'hr_staff')
      AND status = 'active'
    )
  );
```

### Messages Table
```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages from their organization
CREATE POLICY "Users can view org messages" ON messages
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

## Migration Scripts

### Initial Migration
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create all tables in order
-- (Tables creation SQL from above)

-- Create RLS policies
-- (RLS policies from above)

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Performance Optimization

### Partitioning Strategy
```sql
-- Partition messages table by organization_id for better performance
CREATE TABLE messages_partitioned (
  LIKE messages INCLUDING ALL
) PARTITION BY HASH (organization_id);

-- Create initial partitions
CREATE TABLE messages_part_0 PARTITION OF messages_partitioned
  FOR VALUES WITH (modulus 16, remainder 0);
-- ... create 16 partitions total
```

### Connection Pooling
- Configure Supabase connection pooling for high concurrency
- Set up read replicas for analytics queries
- Implement connection limits per organization

## Data Retention Policies

### Automated Cleanup
```sql
-- Function to archive old conversations
CREATE OR REPLACE FUNCTION archive_old_conversations()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE conversations 
  SET status = 'archived'
  WHERE last_message_at < NOW() - INTERVAL '1 year'
    AND status = 'active';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (if available)
SELECT cron.schedule('archive-conversations', '0 2 * * *', 'SELECT archive_old_conversations();');
```

## Testing & Validation

### Data Isolation Tests
```sql
-- Test query to ensure no cross-tenant data access
WITH org_test AS (
  SELECT DISTINCT organization_id FROM organization_members WHERE user_id = auth.uid()
)
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT organization_id) as unique_orgs,
  bool_and(organization_id IN (SELECT organization_id FROM org_test)) as all_same_org
FROM documents;
```

## Deliverables
1. Complete database schema SQL file
2. RLS policies implementation
3. Migration scripts (up and down)
4. Performance optimization configurations
5. Data seeding scripts for testing
6. Schema documentation with ER diagrams
7. Performance testing results
8. Security audit checklist

## Related Tasks
- Blocks: TASK-030 (RLS policies implementation)
- Blocks: TASK-033 (Document upload API)
- Blocks: TASK-042 (Chat/query endpoints)
- Related: TASK-005 (Multi-tenant auth UI)