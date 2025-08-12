-- OCR System Database Schema
-- This migration creates all tables and functions needed for the OCR system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types for OCR system
CREATE TYPE ocr_engine_type AS ENUM ('tesseract', 'azure', 'google');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'requires_review');
CREATE TYPE confidence_level AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');
CREATE TYPE validation_type AS ENUM ('manual', 'ai_assisted', 'hybrid');
CREATE TYPE quality_grade AS ENUM ('A', 'B', 'C', 'D', 'F');
CREATE TYPE compliance_status AS ENUM ('compliant', 'non_compliant', 'requires_review', 'insufficient_data');

-- OCR Results table - stores all OCR processing results
CREATE TABLE ocr_results (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    batch_job_id TEXT NULL, -- For batch processing
    
    -- File information
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    file_hash TEXT NULL, -- For deduplication
    
    -- OCR processing data
    original_text TEXT NOT NULL,
    enhanced_text TEXT NULL,
    validated_text TEXT NULL,
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    engine_used ocr_engine_type NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    
    -- Document classification
    document_type TEXT NULL,
    document_category TEXT NULL,
    classification_confidence DECIMAL(5,4) NULL CHECK (classification_confidence >= 0 AND classification_confidence <= 1),
    is_handwritten BOOLEAN DEFAULT FALSE,
    
    -- Quality metrics
    quality_score DECIMAL(5,4) NULL CHECK (quality_score >= 0 AND quality_score <= 1),
    quality_grade quality_grade NULL,
    needs_manual_review BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    image_metadata JSONB NULL,
    corrections JSONB NULL DEFAULT '[]'::jsonb,
    processing_steps TEXT[] NULL DEFAULT ARRAY[]::TEXT[],
    
    -- Enhancement data
    enhancement_metadata JSONB NULL,
    validation_id TEXT NULL,
    validation_confidence DECIMAL(5,4) NULL,
    validation_date TIMESTAMPTZ NULL,
    validation_corrections JSONB NULL DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_confidence_range CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT valid_quality_score_range CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1)
);

-- OCR Validations table - stores human validation data
CREATE TABLE ocr_validations (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id TEXT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    
    -- Validation data
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    validation_type validation_type NOT NULL DEFAULT 'manual',
    corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- AI suggestions
    ai_suggestions JSONB NULL,
    
    -- Quality metrics
    quality_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    learning_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_feedback JSONB NULL,
    
    -- Processing metadata
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OCR Learning Patterns table - stores patterns for ML improvement
CREATE TABLE ocr_learning_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Pattern data
    pattern TEXT NOT NULL,
    correction TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    context TEXT NULL,
    
    -- Metadata
    confidence DECIMAL(5,4) DEFAULT 0.8,
    document_type TEXT NULL,
    engine_used ocr_engine_type NULL,
    
    -- Timestamps
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per user and pattern
    UNIQUE(pattern, user_id)
);

-- OCR Error Patterns table - stores common error patterns
CREATE TABLE ocr_error_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Error data
    error_type TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    suggested_fix TEXT NOT NULL,
    
    -- Metadata
    document_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    engines_affected ocr_engine_type[] DEFAULT ARRAY[]::ocr_engine_type[],
    severity TEXT DEFAULT 'medium',
    
    -- Timestamps
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per user and error type
    UNIQUE(error_type, user_id)
);

-- Quality Assessments table - stores quality assurance results
CREATE TABLE quality_assessments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Quality metrics
    overall_quality DECIMAL(5,4) NOT NULL CHECK (overall_quality >= 0 AND overall_quality <= 1),
    text_clarity DECIMAL(5,4) NOT NULL CHECK (text_clarity >= 0 AND text_clarity <= 1),
    structural_integrity DECIMAL(5,4) NOT NULL CHECK (structural_integrity >= 0 AND structural_integrity <= 1),
    language_consistency DECIMAL(5,4) NOT NULL CHECK (language_consistency >= 0 AND language_consistency <= 1),
    content_completeness DECIMAL(5,4) NOT NULL CHECK (content_completeness >= 0 AND content_completeness <= 1),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Assessment results
    quality_grade quality_grade NOT NULL,
    needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    
    -- Processing metadata
    checks_performed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    assessment_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template Matches table - stores document template matching results
CREATE TABLE template_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL, -- References hr_document_templates
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Match data
    match_score DECIMAL(5,4) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    extracted_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    recommendations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Checks table - stores compliance verification results
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Compliance data
    compliance_type TEXT NOT NULL,
    status compliance_status NOT NULL,
    score DECIMAL(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
    violations JSONB NOT NULL DEFAULT '[]'::jsonb,
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata
    rules_applied TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Embeddings table - stores vector embeddings for semantic search
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Embedding data
    embedding vector(1536), -- OpenAI embeddings dimension
    text_chunk TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    chunk_type TEXT DEFAULT 'full_document', -- full_document, paragraph, sentence
    language TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per document and chunk
    UNIQUE(document_id, chunk_index)
);

-- Batch Jobs table - tracks batch processing jobs
CREATE TABLE batch_ocr_jobs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Job status
    status document_status NOT NULL DEFAULT 'pending',
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    successful_files INTEGER NOT NULL DEFAULT 0,
    failed_files INTEGER NOT NULL DEFAULT 0,
    
    -- Configuration
    processing_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Results
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NULL,
    estimated_completion TIMESTAMPTZ NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ocr_results_user_id ON ocr_results(user_id);
CREATE INDEX idx_ocr_results_organization_id ON ocr_results(organization_id);
CREATE INDEX idx_ocr_results_batch_job_id ON ocr_results(batch_job_id);
CREATE INDEX idx_ocr_results_document_type ON ocr_results(document_type);
CREATE INDEX idx_ocr_results_created_at ON ocr_results(created_at);
CREATE INDEX idx_ocr_results_confidence ON ocr_results(confidence);
CREATE INDEX idx_ocr_results_quality_score ON ocr_results(quality_score);
CREATE INDEX idx_ocr_results_needs_review ON ocr_results(needs_manual_review) WHERE needs_manual_review = true;

CREATE INDEX idx_validations_user_id ON ocr_validations(user_id);
CREATE INDEX idx_validations_document_id ON ocr_validations(document_id);
CREATE INDEX idx_validations_created_at ON ocr_validations(created_at);

CREATE INDEX idx_learning_patterns_user_id ON ocr_learning_patterns(user_id);
CREATE INDEX idx_learning_patterns_pattern ON ocr_learning_patterns(pattern);
CREATE INDEX idx_learning_patterns_document_type ON ocr_learning_patterns(document_type);

CREATE INDEX idx_quality_assessments_document_id ON quality_assessments(document_id);
CREATE INDEX idx_quality_assessments_user_id ON quality_assessments(user_id);
CREATE INDEX idx_quality_assessments_quality_grade ON quality_assessments(quality_grade);
CREATE INDEX idx_quality_assessments_needs_review ON quality_assessments(needs_manual_review) WHERE needs_manual_review = true;

CREATE INDEX idx_template_matches_document_id ON template_matches(document_id);
CREATE INDEX idx_template_matches_template_id ON template_matches(template_id);
CREATE INDEX idx_template_matches_user_id ON template_matches(user_id);
CREATE INDEX idx_template_matches_score ON template_matches(match_score);

CREATE INDEX idx_compliance_checks_document_id ON compliance_checks(document_id);
CREATE INDEX idx_compliance_checks_user_id ON compliance_checks(user_id);
CREATE INDEX idx_compliance_checks_type ON compliance_checks(compliance_type);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);

-- Vector similarity search index
CREATE INDEX idx_document_embeddings_user_id ON document_embeddings(user_id);
CREATE INDEX idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_vector ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_batch_jobs_user_id ON batch_ocr_jobs(user_id);
CREATE INDEX idx_batch_jobs_status ON batch_ocr_jobs(status);
CREATE INDEX idx_batch_jobs_created_at ON batch_ocr_jobs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_ocr_results_updated_at BEFORE UPDATE ON ocr_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_jobs_updated_at BEFORE UPDATE ON batch_ocr_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_ocr_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocr_results
CREATE POLICY "Users can view own OCR results" ON ocr_results
    FOR SELECT USING (
        user_id = auth.uid() OR 
        (organization_id IS NOT NULL AND organization_id IN (
            SELECT organization_id FROM user_organizations 
            WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert own OCR results" ON ocr_results
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY "Users can update own OCR results" ON ocr_results
    FOR UPDATE USING (
        user_id = auth.uid()
    );

CREATE POLICY "Users can delete own OCR results" ON ocr_results
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- RLS Policies for ocr_validations
CREATE POLICY "Users can view own validations" ON ocr_validations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own validations" ON ocr_validations
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for learning patterns
CREATE POLICY "Users can view own learning patterns" ON ocr_learning_patterns
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own learning patterns" ON ocr_learning_patterns
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own learning patterns" ON ocr_learning_patterns
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for error patterns
CREATE POLICY "Users can view own error patterns" ON ocr_error_patterns
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own error patterns" ON ocr_error_patterns
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own error patterns" ON ocr_error_patterns
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for quality assessments
CREATE POLICY "Users can view own quality assessments" ON quality_assessments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own quality assessments" ON quality_assessments
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for template matches
CREATE POLICY "Users can view own template matches" ON template_matches
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own template matches" ON template_matches
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for compliance checks
CREATE POLICY "Users can view own compliance checks" ON compliance_checks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own compliance checks" ON compliance_checks
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for document embeddings
CREATE POLICY "Users can view own document embeddings" ON document_embeddings
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own document embeddings" ON document_embeddings
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for batch jobs
CREATE POLICY "Users can view own batch jobs" ON batch_ocr_jobs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own batch jobs" ON batch_ocr_jobs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own batch jobs" ON batch_ocr_jobs
    FOR UPDATE USING (user_id = auth.uid());

-- Helper functions for OCR system

-- Function to calculate confidence level from decimal score
CREATE OR REPLACE FUNCTION get_confidence_level(score DECIMAL)
RETURNS confidence_level AS $$
BEGIN
    RETURN CASE
        WHEN score >= 0.9 THEN 'very_high'::confidence_level
        WHEN score >= 0.8 THEN 'high'::confidence_level
        WHEN score >= 0.6 THEN 'medium'::confidence_level
        WHEN score >= 0.4 THEN 'low'::confidence_level
        ELSE 'very_low'::confidence_level
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to search similar documents using vector similarity
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1536),
    user_id_param UUID,
    similarity_threshold DECIMAL DEFAULT 0.7,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    document_id TEXT,
    similarity DECIMAL,
    text_chunk TEXT,
    document_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.document_id,
        (de.embedding <=> query_embedding)::DECIMAL as similarity,
        de.text_chunk,
        ocr.document_type,
        ocr.created_at
    FROM document_embeddings de
    JOIN ocr_results ocr ON de.document_id = ocr.id
    WHERE de.user_id = user_id_param
        AND (de.embedding <=> query_embedding) > similarity_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get OCR statistics for a user
CREATE OR REPLACE FUNCTION get_user_ocr_statistics(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_documents', COUNT(*),
        'documents_by_type', json_agg(DISTINCT document_type),
        'average_confidence', AVG(confidence),
        'high_quality_docs', COUNT(*) FILTER (WHERE quality_score >= 0.8),
        'needs_review', COUNT(*) FILTER (WHERE needs_manual_review = true),
        'processing_engines', json_agg(DISTINCT engine_used),
        'total_processing_time', SUM(processing_time_ms),
        'recent_activity', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')
    ) INTO result
    FROM ocr_results
    WHERE user_id = user_id_param;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update learning patterns frequency
CREATE OR REPLACE FUNCTION upsert_learning_pattern(
    user_id_param UUID,
    pattern_param TEXT,
    correction_param TEXT,
    context_param TEXT DEFAULT NULL,
    confidence_param DECIMAL DEFAULT 0.8
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ocr_learning_patterns (
        user_id, pattern, correction, context, confidence, frequency, last_seen
    ) VALUES (
        user_id_param, pattern_param, correction_param, context_param, confidence_param, 1, NOW()
    )
    ON CONFLICT (pattern, user_id)
    DO UPDATE SET
        frequency = ocr_learning_patterns.frequency + 1,
        last_seen = NOW(),
        correction = EXCLUDED.correction,
        context = COALESCE(EXCLUDED.context, ocr_learning_patterns.context),
        confidence = GREATEST(ocr_learning_patterns.confidence, EXCLUDED.confidence);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old OCR data (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_ocr_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old OCR results and related data
    WITH deleted AS (
        DELETE FROM ocr_results 
        WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    -- Clean up orphaned records
    DELETE FROM document_embeddings 
    WHERE document_id NOT IN (SELECT id FROM ocr_results);
    
    DELETE FROM quality_assessments 
    WHERE document_id NOT IN (SELECT id FROM ocr_results);
    
    DELETE FROM template_matches 
    WHERE document_id NOT IN (SELECT id FROM ocr_results);
    
    DELETE FROM compliance_checks 
    WHERE document_id NOT IN (SELECT id FROM ocr_results);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Insert sample data for testing (optional)
-- This would be done in a separate seed file in production

COMMENT ON TABLE ocr_results IS 'Stores OCR processing results for documents';
COMMENT ON TABLE ocr_validations IS 'Stores human validation and correction data for OCR results';
COMMENT ON TABLE ocr_learning_patterns IS 'Stores learned correction patterns for improving OCR accuracy';
COMMENT ON TABLE quality_assessments IS 'Stores quality assessment results for OCR documents';
COMMENT ON TABLE document_embeddings IS 'Stores vector embeddings for semantic document search';
COMMENT ON TABLE batch_ocr_jobs IS 'Tracks batch processing jobs for multiple documents';

-- Add check to ensure this migration runs only once
INSERT INTO supabase_migrations (version, name, executed_at) 
VALUES ('20250812220000', 'ocr_system_schema', NOW())
ON CONFLICT (version) DO NOTHING;