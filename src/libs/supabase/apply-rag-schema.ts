import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ragSchemaSql = `
-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table to store uploaded documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  content TEXT NOT NULL,
  upload_url TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks table for storing text chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge bases table for organizing documents
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  document_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for documents in knowledge bases
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(knowledge_base_id, document_id)
);

-- API keys for users
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('embed', 'query', 'upload')),
  tokens_used INTEGER DEFAULT 0,
  documents_processed INTEGER DEFAULT 0,
  queries_executed INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User quotas and limits
CREATE TABLE IF NOT EXISTS user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'basic' CHECK (plan_type IN ('basic', 'premium')),
  monthly_queries_limit INTEGER NOT NULL DEFAULT 100,
  monthly_documents_limit INTEGER NOT NULL DEFAULT 10,
  monthly_storage_mb_limit INTEGER NOT NULL DEFAULT 100,
  current_month_queries INTEGER DEFAULT 0,
  current_month_documents INTEGER DEFAULT 0,
  current_month_storage_mb INTEGER DEFAULT 0,
  reset_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RAG queries history
CREATE TABLE IF NOT EXISTS rag_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  sources_used JSONB,
  tokens_used INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

const indexesSql = `
-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_queries_user_id ON rag_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_queries_created_at ON rag_queries(created_at);
`

const vectorIndexSql = `
-- Vector similarity index (only if pgvector is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END
$$;
`

const rlsPoliciesSql = `
-- Row Level Security policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_queries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

-- Policies for documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert own document chunks" ON document_chunks;

-- Policies for document_chunks
CREATE POLICY "Users can view own document chunks" ON document_chunks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own document chunks" ON document_chunks
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()
  ));

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can insert own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete own knowledge bases" ON knowledge_bases;

-- Policies for knowledge_bases
CREATE POLICY "Users can view own knowledge bases" ON knowledge_bases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge bases" ON knowledge_bases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge bases" ON knowledge_bases
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge bases" ON knowledge_bases
  FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own knowledge base documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Users can insert own knowledge base documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Users can delete own knowledge base documents" ON knowledge_base_documents;

-- Policies for knowledge_base_documents
CREATE POLICY "Users can view own knowledge base documents" ON knowledge_base_documents
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM knowledge_bases WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id AND knowledge_bases.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own knowledge base documents" ON knowledge_base_documents
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM knowledge_bases WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id AND knowledge_bases.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own knowledge base documents" ON knowledge_base_documents
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM knowledge_bases WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id AND knowledge_bases.user_id = auth.uid()
  ));

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;

-- Policies for api_keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own usage logs" ON usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs" ON usage_logs;

-- Policies for usage_logs
CREATE POLICY "Users can view own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own quotas" ON user_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON user_quotas;

-- Policies for user_quotas
CREATE POLICY "Users can view own quotas" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quotas" ON user_quotas
  FOR UPDATE USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own queries" ON rag_queries;
DROP POLICY IF EXISTS "System can insert queries" ON rag_queries;

-- Policies for rag_queries
CREATE POLICY "Users can view own queries" ON rag_queries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert queries" ON rag_queries
  FOR INSERT WITH CHECK (true);
`

const functionsAndTriggersSql = `
-- Drop existing function if exists
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON user_quotas;

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON user_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop existing function if exists
DROP FUNCTION IF EXISTS handle_new_user_quota() CASCADE;

-- Function to create default quota for new users
CREATE OR REPLACE FUNCTION handle_new_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id, plan_type)
  VALUES (NEW.id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_quota ON auth.users;

CREATE TRIGGER on_auth_user_created_quota
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_quota();

-- Drop existing function if exists
DROP FUNCTION IF EXISTS reset_monthly_quotas();

-- Function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE user_quotas 
  SET 
    current_month_queries = 0,
    current_month_documents = 0,
    current_month_storage_mb = 0,
    reset_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  WHERE reset_date <= CURRENT_DATE;
END;
$$ language plpgsql security definer;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

-- Function to perform vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  filename text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.filename,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    (p_user_id IS NULL OR d.user_id = p_user_id) AND
    1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`

export async function applyRagSchema() {
  try {
    console.log('Applying RAG schema...')
    
    // Apply schema in steps
    console.log('1. Creating tables...')
    const { error: schemaError } = await supabase.rpc('exec', { 
      query: ragSchemaSql 
    })
    if (schemaError) throw schemaError

    console.log('2. Creating indexes...')
    const { error: indexError } = await supabase.rpc('exec', { 
      query: indexesSql 
    })
    if (indexError) throw indexError

    console.log('3. Creating vector index...')
    const { error: vectorError } = await supabase.rpc('exec', { 
      query: vectorIndexSql 
    })
    if (vectorError) throw vectorError

    console.log('4. Setting up RLS policies...')
    const { error: rlsError } = await supabase.rpc('exec', { 
      query: rlsPoliciesSql 
    })
    if (rlsError) throw rlsError

    console.log('5. Creating functions and triggers...')
    const { error: functionsError } = await supabase.rpc('exec', { 
      query: functionsAndTriggersSql 
    })
    if (functionsError) throw functionsError

    console.log('RAG schema applied successfully!')
    return { success: true }
  } catch (error) {
    console.error('Error applying RAG schema:', error)
    return { success: false, error }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  applyRagSchema().then((result) => {
    console.log('Result:', result)
    process.exit(result.success ? 0 : 1)
  })
}