-- Update existing tables to support organization-based multi-tenancy

-- First, add organization_id to existing tables
ALTER TABLE documents ADD COLUMN organization_id UUID;
ALTER TABLE documents ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
ALTER TABLE documents ADD COLUMN original_filename TEXT;
ALTER TABLE documents ADD COLUMN storage_path TEXT;
ALTER TABLE documents ADD COLUMN category TEXT CHECK (category IN ('policies', 'contracts', 'handbooks', 'procedures', 'forms', 'compliance', 'other'));
ALTER TABLE documents ADD COLUMN language TEXT CHECK (language IN ('ar', 'en', 'mixed'));
ALTER TABLE documents ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE documents ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE documents ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE documents RENAME COLUMN filename TO name;
ALTER TABLE documents RENAME COLUMN file_size TO file_size_bytes;
ALTER TABLE documents RENAME COLUMN content TO content_extracted;

-- Add organization_id to document_chunks
ALTER TABLE document_chunks ADD COLUMN organization_id UUID;
ALTER TABLE document_chunks RENAME COLUMN chunk_text TO content;
ALTER TABLE document_chunks ADD COLUMN content_length INTEGER;
ALTER TABLE document_chunks ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE document_chunks ADD COLUMN language TEXT CHECK (language IN ('ar', 'en', 'mixed'));

-- Update knowledge bases for organizations
ALTER TABLE knowledge_bases ADD COLUMN organization_id UUID;
ALTER TABLE knowledge_bases DROP COLUMN user_id;

-- Update API keys for organizations  
ALTER TABLE api_keys ADD COLUMN organization_id UUID;

-- Update usage logs for organizations
ALTER TABLE usage_logs ADD COLUMN organization_id UUID;

-- Update quotas to be organization-based
ALTER TABLE user_quotas RENAME TO organization_quotas;
ALTER TABLE organization_quotas ADD COLUMN organization_id UUID;
ALTER TABLE organization_quotas DROP COLUMN user_id;

-- Update rag_queries for organizations
ALTER TABLE rag_queries ADD COLUMN organization_id UUID;

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo_url TEXT,
  country_code TEXT DEFAULT 'SA',
  timezone TEXT DEFAULT 'Asia/Riyadh',
  language_code TEXT DEFAULT 'ar',
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
  max_users INTEGER DEFAULT 5,
  max_documents INTEGER DEFAULT 100,
  max_storage_gb INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization members table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'viewer')),
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Create organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  accepted BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document processing queue table
CREATE TABLE IF NOT EXISTS document_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints after adding columns
ALTER TABLE documents ADD CONSTRAINT documents_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE document_chunks ADD CONSTRAINT document_chunks_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE knowledge_bases ADD CONSTRAINT knowledge_bases_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE api_keys ADD CONSTRAINT api_keys_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE organization_quotas ADD CONSTRAINT organization_quotas_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE rag_queries ADD CONSTRAINT rag_queries_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes for organization-based queries
CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_language ON documents(language);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_chunks_organization_id ON document_chunks(organization_id);
CREATE INDEX idx_knowledge_bases_organization_id ON knowledge_bases(organization_id);
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_usage_logs_organization_id ON usage_logs(organization_id);
CREATE INDEX idx_organization_quotas_organization_id ON organization_quotas(organization_id);
CREATE INDEX idx_rag_queries_organization_id ON rag_queries(organization_id);
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_document_processing_queue_organization_id ON document_processing_queue(organization_id);
CREATE INDEX idx_document_processing_queue_status ON document_processing_queue(status);

-- Update RLS policies for organization-based access

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Users can view own document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert own document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can view own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can insert own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete own knowledge bases" ON knowledge_bases;

-- Create new organization-based policies for documents
CREATE POLICY "Organization members can view documents" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = documents.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can insert documents" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = documents.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can update documents" ON documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = documents.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

CREATE POLICY "HR managers can delete documents" ON documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = documents.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager')
      AND om.is_active = true
    )
  );

-- Policies for document_chunks
CREATE POLICY "Organization members can view chunks" ON document_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = document_chunks.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "System can insert chunks" ON document_chunks
  FOR INSERT WITH CHECK (true);

-- Policies for knowledge_bases
CREATE POLICY "Organization members can view knowledge bases" ON knowledge_bases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = knowledge_bases.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can manage knowledge bases" ON knowledge_bases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = knowledge_bases.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_queue ENABLE ROW LEVEL SECURITY;

-- Policies for organizations
CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Owners can update organizations" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- Policies for organization_members
CREATE POLICY "Members can view organization members" ON organization_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Admins can manage members" ON organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- Function to update organization quotas
CREATE OR REPLACE FUNCTION handle_new_organization_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_quotas (organization_id, plan_type)
  VALUES (NEW.id, NEW.subscription_tier);
  RETURN NEW;
END;
$$ language plpgsql security definer;

CREATE TRIGGER on_organization_created_quota
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION handle_new_organization_quota();

-- Updated vector similarity search function for organizations
CREATE OR REPLACE FUNCTION match_organization_documents(
  query_embedding vector(1536),
  p_organization_id uuid,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  p_category text DEFAULT NULL,
  p_language text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  document_name text,
  category text,
  language text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    d.name as document_name,
    d.category,
    d.language,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    dc.organization_id = p_organization_id AND
    d.status = 'completed' AND
    (p_category IS NULL OR d.category = p_category) AND
    (p_language IS NULL OR d.language = p_language) AND
    1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger to update document processing queue
CREATE OR REPLACE FUNCTION update_processing_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
        NEW.started_at = NOW();
    END IF;
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_processing_queue_updated_at 
  BEFORE UPDATE ON document_processing_queue
  FOR EACH ROW EXECUTE FUNCTION update_processing_queue_timestamp();

-- Add trigger for organization updated_at
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at 
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();