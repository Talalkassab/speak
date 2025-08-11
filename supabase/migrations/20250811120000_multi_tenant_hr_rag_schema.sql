-- =====================================================
-- Multi-Tenant HR RAG System Database Schema
-- Designed for complete tenant isolation and scalability
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- CORE TENANT MANAGEMENT
-- =====================================================

-- Organizations (Primary tenant entity)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    domain TEXT, -- For domain-based tenant identification
    logo_url TEXT,
    country_code CHAR(2) DEFAULT 'SA', -- Saudi Arabia default
    timezone TEXT DEFAULT 'Asia/Riyadh',
    language_code CHAR(2) DEFAULT 'ar', -- Arabic default
    settings JSONB DEFAULT '{}',
    subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
    max_users INTEGER DEFAULT 10,
    max_documents INTEGER DEFAULT 100,
    max_storage_gb INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (replaces direct user references)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    permissions JSONB DEFAULT '{}', -- Additional granular permissions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Organization invitations
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'hr_manager', 'hr_staff', 'viewer')),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- =====================================================
-- DOCUMENT MANAGEMENT SYSTEM
-- =====================================================

-- Document categories for organization
CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280', -- Tailwind gray-500
    is_system BOOLEAN DEFAULT false, -- System categories can't be deleted
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Enhanced documents table with versioning and metadata
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content TEXT, -- Extracted text content
    content_language TEXT DEFAULT 'ar', -- Arabic/English detection
    upload_url TEXT,
    storage_path TEXT, -- Path in storage bucket
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id), -- For versioning
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'archived')),
    processing_metadata JSONB DEFAULT '{}', -- Processing status, errors, etc.
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false, -- Within organization
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document access permissions (granular control)
CREATE TABLE document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT REFERENCES organization_members(role),
    permission TEXT NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, user_id),
    CHECK ((user_id IS NOT NULL AND role IS NULL) OR (user_id IS NULL AND role IS NOT NULL))
);

-- Document chunks for RAG with enhanced metadata
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_type TEXT DEFAULT 'paragraph' CHECK (chunk_type IN ('title', 'paragraph', 'table', 'list')),
    page_number INTEGER,
    section_title TEXT,
    embedding VECTOR(1536), -- OpenAI Ada-002 embeddings
    embedding_model TEXT DEFAULT 'text-embedding-ada-002',
    language TEXT DEFAULT 'ar',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- =====================================================
-- CONVERSATION AND RAG SYSTEM
-- =====================================================

-- Conversation threads between users and AI
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'policy', 'labor_law', 'benefits', 'procedures')),
    language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages in conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'markdown')),
    language TEXT DEFAULT 'ar',
    tokens_used INTEGER DEFAULT 0,
    model_used TEXT, -- AI model that generated response
    response_time_ms INTEGER,
    sources_used JSONB DEFAULT '[]', -- Array of source document references
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message source attributions
CREATE TABLE message_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    relevance_score FLOAT NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    citation_text TEXT,
    page_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SAUDI LABOR LAW KNOWLEDGE BASE (SHARED)
-- =====================================================

-- Labor law categories (shared across all tenants)
CREATE TABLE labor_law_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    code TEXT UNIQUE, -- e.g., 'WAGES', 'TERMINATION'
    parent_id UUID REFERENCES labor_law_categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saudi labor law articles (shared knowledge base)
CREATE TABLE labor_law_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES labor_law_categories(id),
    article_number TEXT NOT NULL, -- e.g., "Article 74"
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    content_ar TEXT NOT NULL,
    content_en TEXT NOT NULL,
    summary_ar TEXT,
    summary_en TEXT,
    keywords_ar TEXT[],
    keywords_en TEXT[],
    source_reference TEXT, -- Reference to original law document
    effective_date DATE,
    last_updated DATE,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_number, version)
);

-- Labor law article embeddings (for semantic search)
CREATE TABLE labor_law_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES labor_law_articles(id) ON DELETE CASCADE,
    text_content TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('ar', 'en')),
    content_type TEXT NOT NULL CHECK (content_type IN ('title', 'content', 'summary')),
    embedding VECTOR(1536),
    embedding_model TEXT DEFAULT 'text-embedding-ada-002',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USAGE TRACKING AND ANALYTICS
-- =====================================================

-- Organization usage statistics
CREATE TABLE organization_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    users_count INTEGER DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    conversations_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    storage_used_gb FLOAT DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period_start)
);

-- User activity logs (for audit and analytics)
CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'login', 'document_upload', 'conversation_start', etc.
    resource_type TEXT, -- 'document', 'conversation', etc.
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking (for billing and monitoring)
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    api_key_id UUID, -- Will be added later if API keys are implemented
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    bytes_processed INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECURITY AND AUDIT
-- =====================================================

-- Security audit logs
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failure', 'permission_change', etc.
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data access logs (for compliance)
CREATE TABLE data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'delete')),
    granted BOOLEAN NOT NULL,
    reason TEXT, -- Reason if access denied
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Organization indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Organization members indexes
CREATE INDEX idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
CREATE INDEX idx_org_members_active ON organization_members(organization_id, is_active) WHERE is_active = true;

-- Document indexes
CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_category_id ON documents(category_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_created_at ON documents(organization_id, created_at DESC);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- Document chunks indexes
CREATE INDEX idx_doc_chunks_organization_id ON document_chunks(organization_id);
CREATE INDEX idx_doc_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_doc_chunks_language ON document_chunks(organization_id, language);

-- Vector similarity indexes
CREATE INDEX idx_doc_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_labor_law_embeddings ON labor_law_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Conversation indexes
CREATE INDEX idx_conversations_organization_id ON conversations(organization_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(organization_id, created_at DESC);
CREATE INDEX idx_conversations_category ON conversations(organization_id, category);

-- Message indexes
CREATE INDEX idx_messages_organization_id ON messages(organization_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_role ON messages(conversation_id, role);

-- Labor law indexes
CREATE INDEX idx_labor_law_articles_category ON labor_law_articles(category_id);
CREATE INDEX idx_labor_law_articles_number ON labor_law_articles(article_number);
CREATE INDEX idx_labor_law_articles_active ON labor_law_articles(is_active) WHERE is_active = true;
CREATE INDEX idx_labor_law_embeddings_article ON labor_law_embeddings(article_id);
CREATE INDEX idx_labor_law_embeddings_lang ON labor_law_embeddings(language, content_type);

-- Usage and audit indexes
CREATE INDEX idx_org_usage_organization_period ON organization_usage(organization_id, period_start);
CREATE INDEX idx_user_activity_logs_org_user ON user_activity_logs(organization_id, user_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX idx_api_usage_logs_org ON api_usage_logs(organization_id);
CREATE INDEX idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_security_audit_logs_org ON security_audit_logs(organization_id);
CREATE INDEX idx_security_audit_logs_severity ON security_audit_logs(severity, created_at) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_data_access_logs_org_user ON data_access_logs(organization_id, user_id);
CREATE INDEX idx_data_access_logs_resource ON data_access_logs(resource_type, resource_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get user's organization ID (for RLS policies)
CREATE OR REPLACE FUNCTION get_user_organization_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = p_user_id AND is_active = true
        LIMIT 1
    );
END;
$$ language 'plpgsql' STABLE SECURITY DEFINER;

-- Function to check if user has role in organization
CREATE OR REPLACE FUNCTION user_has_role_in_org(
    p_organization_id UUID,
    p_user_id UUID DEFAULT auth.uid(),
    p_required_roles TEXT[] DEFAULT ARRAY['viewer']
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND user_id = p_user_id
        AND role = ANY(p_required_roles)
        AND is_active = true
    );
END;
$$ language 'plpgsql' STABLE SECURITY DEFINER;

-- Function to check if user can access document
CREATE OR REPLACE FUNCTION user_can_access_document(
    p_document_id UUID,
    p_user_id UUID DEFAULT auth.uid(),
    p_permission TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
    doc_org_id UUID;
    user_role TEXT;
BEGIN
    -- Get document's organization
    SELECT organization_id INTO doc_org_id
    FROM documents WHERE id = p_document_id;
    
    -- Get user's role in that organization
    SELECT role INTO user_role
    FROM organization_members
    WHERE organization_id = doc_org_id
    AND user_id = p_user_id
    AND is_active = true;
    
    -- Check permissions based on role
    CASE user_role
        WHEN 'owner', 'admin' THEN RETURN true;
        WHEN 'hr_manager', 'hr_staff' THEN RETURN true;
        WHEN 'viewer' THEN RETURN (p_permission = 'read');
        ELSE RETURN false;
    END CASE;
END;
$$ language 'plpgsql' STABLE SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_categories_updated_at
    BEFORE UPDATE ON document_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_labor_law_categories_updated_at
    BEFORE UPDATE ON labor_law_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_labor_law_articles_updated_at
    BEFORE UPDATE ON labor_law_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL SETUP FUNCTIONS
-- =====================================================

-- Function to create default document categories for new organization
CREATE OR REPLACE FUNCTION create_default_document_categories(p_organization_id UUID, p_created_by UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO document_categories (organization_id, name, description, is_system, created_by) VALUES
    (p_organization_id, 'سياسات الموارد البشرية', 'سياسات وإجراءات الموارد البشرية', true, p_created_by),
    (p_organization_id, 'عقود العمل', 'عقود ومستندات العمل', true, p_created_by),
    (p_organization_id, 'الرواتب والمزايا', 'مستندات الرواتب والمزايا', true, p_created_by),
    (p_organization_id, 'التدريب والتطوير', 'مواد التدريب والتطوير المهني', true, p_created_by),
    (p_organization_id, 'الامتثال والقوانين', 'مستندات الامتثال والقوانين', true, p_created_by);
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to initialize Saudi labor law data
CREATE OR REPLACE FUNCTION initialize_labor_law_data()
RETURNS VOID AS $$
BEGIN
    -- Insert main categories
    INSERT INTO labor_law_categories (name_ar, name_en, code, description_ar, description_en) VALUES
    ('الأجور والرواتب', 'Wages and Salaries', 'WAGES', 'أحكام الأجور والرواتب والبدلات', 'Provisions for wages, salaries and allowances'),
    ('إنهاء الخدمة', 'Employment Termination', 'TERMINATION', 'أحكام إنهاء عقد العمل والمكافآت', 'Employment contract termination and benefits'),
    ('الإجازات', 'Leave and Holidays', 'LEAVE', 'أنواع الإجازات وأحكامها', 'Types of leave and their provisions'),
    ('ساعات العمل', 'Working Hours', 'HOURS', 'تنظيم ساعات العمل والراحة', 'Regulation of working hours and rest periods'),
    ('السلامة المهنية', 'Occupational Safety', 'SAFETY', 'أحكام السلامة والصحة المهنية', 'Occupational health and safety provisions'),
    ('التأمين الاجتماعي', 'Social Insurance', 'INSURANCE', 'أحكام التأمين الاجتماعي', 'Social insurance provisions');
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- Labor law tables are shared (no RLS needed)
-- ALTER TABLE labor_law_categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE labor_law_articles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE labor_law_embeddings ENABLE ROW LEVEL SECURITY;