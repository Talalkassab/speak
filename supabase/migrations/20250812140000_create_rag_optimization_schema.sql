-- RAG Optimization Schema Migration
-- This migration creates tables and functions to support the enhanced RAG system

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL,
  cache_stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG interactions tracking
CREATE TABLE IF NOT EXISTS rag_interactions (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0,
  processing_time INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  quality_score FLOAT NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'mixed')),
  sources_count INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  model TEXT NOT NULL DEFAULT 'gpt-4-turbo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_rag_interactions_org_id (organization_id),
  INDEX idx_rag_interactions_user_id (user_id),
  INDEX idx_rag_interactions_conversation_id (conversation_id),
  INDEX idx_rag_interactions_created_at (created_at)
);

-- Conversation contexts table
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_conversation_contexts_org_id (organization_id),
  INDEX idx_conversation_contexts_user_id (user_id),
  INDEX idx_conversation_contexts_last_updated (last_updated)
);

-- Document entities table for extracted entities
CREATE TABLE IF NOT EXISTS document_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT,
  entity_text TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'location', 'date', 'money', 'law', 'document')),
  position_start INTEGER,
  position_end INTEGER,
  confidence FLOAT NOT NULL DEFAULT 0,
  normalized_text TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_document_entities_document_id (document_id),
  INDEX idx_document_entities_type (entity_type),
  INDEX idx_document_entities_confidence (confidence)
);

-- User profiles table for enhanced personalization
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT,
  department TEXT,
  experience_level TEXT CHECK (experience_level IN ('junior', 'senior', 'expert')) DEFAULT 'junior',
  access_level TEXT CHECK (access_level IN ('basic', 'advanced', 'admin')) DEFAULT 'basic',
  preferred_language TEXT CHECK (preferred_language IN ('ar', 'en')) DEFAULT 'ar',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_user_profiles_org_id (organization_id),
  INDEX idx_user_profiles_role (role),
  INDEX idx_user_profiles_access_level (access_level)
);

-- Conversations table for conversation management
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT CHECK (language IN ('ar', 'en', 'mixed')) DEFAULT 'ar',
  status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_conversations_org_id (organization_id),
  INDEX idx_conversations_status (status),
  INDEX idx_conversations_created_at (created_at)
);

-- Enhanced messages table with better structure
-- First, check if messages table exists and has the required structure
DO $$
BEGIN
  -- Add columns to messages table if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'organization_id') THEN
    ALTER TABLE messages ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'user_id') THEN
    ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'metadata') THEN
    ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END$$;

-- Update document_chunks table to include quality metrics
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS quality_score FLOAT,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER DEFAULT 0;

-- Enhanced semantic search function with quality scoring
CREATE OR REPLACE FUNCTION enhanced_semantic_search(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10,
  p_organization_id uuid DEFAULT NULL,
  p_language text DEFAULT 'ar',
  p_categories text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  document_title text,
  filename text,
  category_name text,
  page_number integer,
  section_title text,
  similarity float,
  quality_score float,
  language text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id as chunk_id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    d.title as document_title,
    d.filename,
    cat.name as category_name,
    dc.page_number,
    dc.section_title,
    1 - (dc.embedding <=> query_embedding) as similarity,
    COALESCE(dc.quality_score, 0.8) as quality_score,
    dc.language,
    dc.created_at
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  LEFT JOIN document_categories cat ON d.category_id = cat.id
  WHERE 
    dc.organization_id = p_organization_id
    AND dc.language = p_language
    AND d.status = 'completed'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (p_categories IS NULL OR cat.name = ANY(p_categories))
    AND (p_date_from IS NULL OR d.created_at >= p_date_from)
    AND (p_date_to IS NULL OR d.created_at <= p_date_to)
  ORDER BY 
    (1 - (dc.embedding <=> query_embedding)) * COALESCE(dc.quality_score, 0.8) DESC,
    dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get conversation analytics
CREATE OR REPLACE FUNCTION get_conversation_analytics(
  p_organization_id uuid,
  p_date_from timestamptz DEFAULT NOW() - INTERVAL '30 days',
  p_date_to timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  total_conversations bigint,
  total_messages bigint,
  avg_messages_per_conversation numeric,
  avg_confidence numeric,
  avg_processing_time numeric,
  total_cost numeric,
  language_distribution jsonb,
  top_topics jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ri.conversation_id) as total_conversations,
    COUNT(ri.id) as total_messages,
    ROUND(COUNT(ri.id)::numeric / NULLIF(COUNT(DISTINCT ri.conversation_id), 0), 2) as avg_messages_per_conversation,
    ROUND(AVG(ri.confidence), 3) as avg_confidence,
    ROUND(AVG(ri.processing_time), 0) as avg_processing_time,
    ROUND(SUM(ri.cost), 4) as total_cost,
    jsonb_build_object(
      'ar', COUNT(CASE WHEN ri.language = 'ar' THEN 1 END),
      'en', COUNT(CASE WHEN ri.language = 'en' THEN 1 END),
      'mixed', COUNT(CASE WHEN ri.language = 'mixed' THEN 1 END)
    ) as language_distribution,
    '{}'::jsonb as top_topics -- Placeholder for topic analysis
  FROM rag_interactions ri
  WHERE ri.organization_id = p_organization_id
    AND ri.created_at >= p_date_from
    AND ri.created_at <= p_date_to;
END;
$$;

-- Function to clean up old performance metrics
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM performance_metrics
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Function to get document processing statistics
CREATE OR REPLACE FUNCTION get_document_processing_stats(
  p_organization_id uuid,
  p_date_from timestamptz DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE (
  total_documents bigint,
  documents_with_embeddings bigint,
  total_chunks bigint,
  avg_chunks_per_document numeric,
  avg_quality_score numeric,
  processing_success_rate numeric,
  language_distribution jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN d.processing_metadata->>'embeddings_generated' = 'true' THEN 1 END) as documents_with_embeddings,
    COUNT(dc.id) as total_chunks,
    ROUND(COUNT(dc.id)::numeric / NULLIF(COUNT(DISTINCT d.id), 0), 2) as avg_chunks_per_document,
    ROUND(AVG(COALESCE(dc.quality_score, 0.8)), 3) as avg_quality_score,
    ROUND(
      COUNT(CASE WHEN d.status = 'completed' THEN 1 END)::numeric / 
      NULLIF(COUNT(d.id), 0) * 100, 2
    ) as processing_success_rate,
    jsonb_build_object(
      'ar', COUNT(CASE WHEN d.content_language = 'ar' THEN 1 END),
      'en', COUNT(CASE WHEN d.content_language = 'en' THEN 1 END),
      'mixed', COUNT(CASE WHEN d.content_language = 'mixed' THEN 1 END)
    ) as language_distribution
  FROM documents d
  LEFT JOIN document_chunks dc ON d.id = dc.document_id
  WHERE d.organization_id = p_organization_id
    AND d.created_at >= p_date_from;
END;
$$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_document_chunks_quality_score ON document_chunks(quality_score);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_quality ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_documents_content_language ON documents(content_language);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(status, processing_metadata);

-- Enable RLS policies for new tables
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance_metrics (admin only)
CREATE POLICY "Admin can view performance metrics" ON performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.access_level = 'admin'
    )
  );

-- RLS policies for rag_interactions
CREATE POLICY "Users can view their organization's RAG interactions" ON rag_interactions
  FOR SELECT USING (
    organization_id IN (
      SELECT up.organization_id FROM user_profiles up
      WHERE up.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert RAG interactions for their organization" ON rag_interactions
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT up.organization_id FROM user_profiles up
      WHERE up.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- RLS policies for conversation_contexts
CREATE POLICY "Users can access their conversation contexts" ON conversation_contexts
  FOR ALL USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT up.organization_id FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.access_level IN ('admin', 'advanced')
    )
  );

-- RLS policies for document_entities
CREATE POLICY "Users can view entities from their organization's documents" ON document_entities
  FOR SELECT USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN user_profiles up ON d.organization_id = up.organization_id
      WHERE up.user_id = auth.uid()
    )
  );

-- RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles in their organization" ON user_profiles
  FOR ALL USING (
    organization_id IN (
      SELECT up.organization_id FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.access_level = 'admin'
    )
  );

-- RLS policies for conversations
CREATE POLICY "Users can access conversations in their organization" ON conversations
  FOR ALL USING (
    organization_id IN (
      SELECT up.organization_id FROM user_profiles up
      WHERE up.user_id = auth.uid()
    )
  );

-- Create function to initialize user profile
CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function should be called when a user is first added to an organization
  -- The actual organization assignment should be handled separately
  RETURN NEW;
END;
$$;

-- Create function to update document search vectors when content changes
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the full-text search vector when document content changes
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.search_vector = to_tsvector(
      CASE 
        WHEN NEW.content_language = 'ar' THEN 'arabic'
        ELSE 'english'
      END,
      COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add search vector column to documents if it doesn't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger for updating search vector
DROP TRIGGER IF EXISTS update_documents_search_vector ON documents;
CREATE TRIGGER update_documents_search_vector
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING gin(search_vector);

-- Insert default user profile for existing users (run once)
INSERT INTO user_profiles (user_id, organization_id, access_level)
SELECT 
  u.id,
  o.id,
  'basic'
FROM auth.users u
CROSS JOIN organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up 
  WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to get user's organization efficiently
CREATE OR REPLACE FUNCTION get_user_organization(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM user_profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;