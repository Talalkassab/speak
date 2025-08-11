-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table to store uploaded documents
CREATE TABLE documents (
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
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge bases table for organizing documents
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  document_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for documents in knowledge bases
CREATE TABLE knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(knowledge_base_id, document_id)
);

-- API keys for users
CREATE TABLE api_keys (
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
CREATE TABLE usage_logs (
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
CREATE TABLE user_quotas (
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
CREATE TABLE rag_queries (
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

-- Indexes for better performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_rag_queries_user_id ON rag_queries(user_id);
CREATE INDEX idx_rag_queries_created_at ON rag_queries(created_at);

-- Row Level Security policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_queries ENABLE ROW LEVEL SECURITY;

-- Policies for documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for document_chunks
CREATE POLICY "Users can view own document chunks" ON document_chunks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own document chunks" ON document_chunks
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()
  ));

-- Policies for knowledge_bases
CREATE POLICY "Users can view own knowledge bases" ON knowledge_bases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge bases" ON knowledge_bases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge bases" ON knowledge_bases
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge bases" ON knowledge_bases
  FOR DELETE USING (auth.uid() = user_id);

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

-- Policies for api_keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for usage_logs
CREATE POLICY "Users can view own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true); -- Allow system to insert logs

-- Policies for user_quotas
CREATE POLICY "Users can view own quotas" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quotas" ON user_quotas
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for rag_queries
CREATE POLICY "Users can view own queries" ON rag_queries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert queries" ON rag_queries
  FOR INSERT WITH CHECK (true); -- Allow system to insert query logs

-- Triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON user_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default quota for new users
CREATE OR REPLACE FUNCTION handle_new_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id, plan_type)
  VALUES (NEW.id, 'basic');
  RETURN NEW;
END;
$$ language plpgsql security definer;

CREATE TRIGGER on_auth_user_created_quota
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_quota();

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