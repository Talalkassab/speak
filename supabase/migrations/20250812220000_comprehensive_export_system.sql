-- =====================================================
-- Comprehensive Conversation Export System
-- Migration: 20250812220000_comprehensive_export_system.sql
-- =====================================================

-- Create export jobs table for tracking background exports
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Job details
    type TEXT NOT NULL CHECK (type IN ('single', 'bulk', 'scheduled')),
    format TEXT NOT NULL CHECK (format IN ('pdf', 'docx', 'html', 'email')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Progress tracking
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    
    -- Results
    download_url TEXT,
    file_size BIGINT,
    error_message TEXT,
    
    -- Configuration
    options JSONB NOT NULL DEFAULT '{}',
    
    -- Priority for queue processing
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,
    
    -- Soft delete and archiving
    archived BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for export jobs
CREATE INDEX idx_export_jobs_organization_id ON export_jobs(organization_id);
CREATE INDEX idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at);
CREATE INDEX idx_export_jobs_priority_status ON export_jobs(priority, status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_export_jobs_organization_active ON export_jobs(organization_id, status) WHERE status IN ('pending', 'processing', 'completed');

-- Create export job logs table for detailed tracking
CREATE TABLE IF NOT EXISTS export_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Log details
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    details JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for export job logs
CREATE INDEX idx_export_job_logs_job_id ON export_job_logs(job_id);
CREATE INDEX idx_export_job_logs_organization_id ON export_job_logs(organization_id);
CREATE INDEX idx_export_job_logs_level ON export_job_logs(level);
CREATE INDEX idx_export_job_logs_created_at ON export_job_logs(created_at);

-- Create export templates table for custom export formatting
CREATE TABLE IF NOT EXISTS export_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Template details
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL CHECK (template_type IN ('pdf', 'docx', 'html', 'email')),
    
    -- Template configuration
    template_data JSONB NOT NULL DEFAULT '{}',
    css_styles TEXT,
    html_template TEXT,
    
    -- Settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    
    -- Version control
    version INTEGER NOT NULL DEFAULT 1,
    parent_template_id UUID REFERENCES export_templates(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(organization_id, name, template_type)
);

-- Create indexes for export templates
CREATE INDEX idx_export_templates_organization_id ON export_templates(organization_id);
CREATE INDEX idx_export_templates_created_by ON export_templates(created_by);
CREATE INDEX idx_export_templates_type_active ON export_templates(template_type, is_active);
CREATE INDEX idx_export_templates_organization_active ON export_templates(organization_id, is_active);

-- Create scheduled exports table
CREATE TABLE IF NOT EXISTS scheduled_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Schedule details
    name TEXT NOT NULL,
    description TEXT,
    
    -- Schedule configuration
    schedule_config JSONB NOT NULL,
    filter_config JSONB NOT NULL DEFAULT '{}',
    export_config JSONB NOT NULL DEFAULT '{}',
    delivery_config JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Execution tracking
    next_execution TIMESTAMPTZ,
    last_execution TIMESTAMPTZ,
    last_execution_status TEXT CHECK (last_execution_status IN ('success', 'failed', 'cancelled')),
    execution_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for scheduled exports
CREATE INDEX idx_scheduled_exports_organization_id ON scheduled_exports(organization_id);
CREATE INDEX idx_scheduled_exports_created_by ON scheduled_exports(created_by);
CREATE INDEX idx_scheduled_exports_next_execution ON scheduled_exports(next_execution) WHERE is_active = true;
CREATE INDEX idx_scheduled_exports_organization_active ON scheduled_exports(organization_id, is_active);

-- Create scheduled export executions table
CREATE TABLE IF NOT EXISTS scheduled_export_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_export_id UUID NOT NULL REFERENCES scheduled_exports(id) ON DELETE CASCADE,
    export_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Execution details
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    
    -- Results
    download_url TEXT,
    file_size BIGINT,
    conversation_count INTEGER,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    -- Email delivery tracking
    email_sent BOOLEAN NOT NULL DEFAULT false,
    email_recipients JSONB,
    email_sent_at TIMESTAMPTZ
);

-- Create indexes for scheduled export executions
CREATE INDEX idx_scheduled_export_executions_scheduled_export_id ON scheduled_export_executions(scheduled_export_id);
CREATE INDEX idx_scheduled_export_executions_organization_id ON scheduled_export_executions(organization_id);
CREATE INDEX idx_scheduled_export_executions_status ON scheduled_export_executions(status);
CREATE INDEX idx_scheduled_export_executions_started_at ON scheduled_export_executions(started_at);

-- Create export analytics table for tracking usage
CREATE TABLE IF NOT EXISTS export_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Analytics data
    date DATE NOT NULL,
    export_type TEXT NOT NULL,
    format TEXT NOT NULL,
    conversation_count INTEGER NOT NULL DEFAULT 0,
    file_size BIGINT,
    processing_time_ms INTEGER,
    
    -- Aggregated metrics
    total_exports INTEGER NOT NULL DEFAULT 1,
    successful_exports INTEGER NOT NULL DEFAULT 0,
    failed_exports INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(organization_id, user_id, date, export_type, format)
);

-- Create indexes for export analytics
CREATE INDEX idx_export_analytics_organization_id ON export_analytics(organization_id);
CREATE INDEX idx_export_analytics_user_id ON export_analytics(user_id);
CREATE INDEX idx_export_analytics_date ON export_analytics(date);
CREATE INDEX idx_export_analytics_organization_date ON export_analytics(organization_id, date);

-- Create conversation compliance analysis table
CREATE TABLE IF NOT EXISTS conversation_compliance_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Compliance scores
    overall_score DECIMAL(5,4) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
    policy_compliance DECIMAL(5,4),
    legal_compliance DECIMAL(5,4),
    ethical_compliance DECIMAL(5,4),
    
    -- Risk assessment
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_factors JSONB,
    
    -- Detailed analysis
    compliance_details JSONB,
    recommendations JSONB,
    
    -- Analysis metadata
    analyzed_by TEXT, -- AI model or system that performed analysis
    analysis_version TEXT,
    confidence_score DECIMAL(5,4),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(conversation_id, organization_id)
);

-- Create indexes for compliance analysis
CREATE INDEX idx_compliance_analysis_conversation_id ON conversation_compliance_analysis(conversation_id);
CREATE INDEX idx_compliance_analysis_organization_id ON conversation_compliance_analysis(organization_id);
CREATE INDEX idx_compliance_analysis_risk_level ON conversation_compliance_analysis(risk_level);
CREATE INDEX idx_compliance_analysis_overall_score ON conversation_compliance_analysis(overall_score);

-- Create conversation cost tracking table
CREATE TABLE IF NOT EXISTS conversation_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Cost breakdown
    total_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Model costs (stored as JSONB for flexibility)
    model_costs JSONB,
    
    -- Cost per operation
    embedding_cost DECIMAL(10,6) DEFAULT 0,
    generation_cost DECIMAL(10,6) DEFAULT 0,
    retrieval_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Currency and pricing
    currency TEXT NOT NULL DEFAULT 'USD',
    pricing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(conversation_id, organization_id)
);

-- Create indexes for cost tracking
CREATE INDEX idx_cost_tracking_conversation_id ON conversation_cost_tracking(conversation_id);
CREATE INDEX idx_cost_tracking_organization_id ON conversation_cost_tracking(organization_id);
CREATE INDEX idx_cost_tracking_total_cost ON conversation_cost_tracking(total_cost);
CREATE INDEX idx_cost_tracking_pricing_date ON conversation_cost_tracking(pricing_date);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON export_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_export_templates_updated_at BEFORE UPDATE ON export_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_exports_updated_at BEFORE UPDATE ON scheduled_exports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_export_analytics_updated_at BEFORE UPDATE ON export_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_analysis_updated_at BEFORE UPDATE ON conversation_compliance_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cost_tracking_updated_at BEFORE UPDATE ON conversation_cost_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_export_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_compliance_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_cost_tracking ENABLE ROW LEVEL SECURITY;

-- Export Jobs Policies
CREATE POLICY "Users can view their organization's export jobs" ON export_jobs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can create export jobs in their organization" ON export_jobs
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND user_id = auth.uid()
    );

CREATE POLICY "Users can update their own export jobs" ON export_jobs
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        (organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'hr_manager')
        ))
    );

-- Export Job Logs Policies
CREATE POLICY "Users can view logs for their organization's export jobs" ON export_job_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert export job logs" ON export_job_logs
    FOR INSERT WITH CHECK (true); -- Logs are inserted by system

-- Export Templates Policies
CREATE POLICY "Users can view their organization's export templates" ON export_templates
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "HR managers can manage export templates" ON export_templates
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'hr_manager')
        )
    );

-- Scheduled Exports Policies
CREATE POLICY "Users can view their organization's scheduled exports" ON scheduled_exports
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "HR managers can manage scheduled exports" ON scheduled_exports
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'hr_manager', 'hr_analyst')
        )
    );

-- Scheduled Export Executions Policies
CREATE POLICY "Users can view their organization's export executions" ON scheduled_export_executions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can manage export executions" ON scheduled_export_executions
    FOR ALL WITH CHECK (true); -- System manages executions

-- Export Analytics Policies
CREATE POLICY "Users can view their organization's export analytics" ON export_analytics
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can manage export analytics" ON export_analytics
    FOR ALL WITH CHECK (true); -- System manages analytics

-- Compliance Analysis Policies
CREATE POLICY "Users can view compliance analysis for accessible conversations" ON conversation_compliance_analysis
    FOR SELECT USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.is_active = true
            AND (c.user_id = auth.uid() OR om.role IN ('owner', 'admin', 'hr_manager', 'hr_analyst'))
        )
    );

CREATE POLICY "System can manage compliance analysis" ON conversation_compliance_analysis
    FOR ALL WITH CHECK (true); -- System manages compliance analysis

-- Cost Tracking Policies
CREATE POLICY "Users can view cost tracking for accessible conversations" ON conversation_cost_tracking
    FOR SELECT USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.is_active = true
            AND (c.user_id = auth.uid() OR om.role IN ('owner', 'admin', 'hr_manager', 'hr_analyst'))
        )
    );

CREATE POLICY "System can manage cost tracking" ON conversation_cost_tracking
    FOR ALL WITH CHECK (true); -- System manages cost tracking

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get conversation message statistics
CREATE OR REPLACE FUNCTION get_conversation_message_stats(conv_id UUID)
RETURNS TABLE (
    message_count INTEGER,
    user_messages INTEGER,
    assistant_messages INTEGER,
    total_tokens INTEGER,
    avg_response_time DECIMAL,
    sources_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as message_count,
        COUNT(*) FILTER (WHERE role = 'user')::INTEGER as user_messages,
        COUNT(*) FILTER (WHERE role = 'assistant')::INTEGER as assistant_messages,
        COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens,
        COALESCE(AVG(response_time_ms), 0)::DECIMAL as avg_response_time,
        COALESCE((
            SELECT COUNT(*) FROM message_sources ms 
            WHERE ms.message_id IN (
                SELECT id FROM messages WHERE conversation_id = conv_id
            )
        ), 0)::INTEGER as sources_count
    FROM messages 
    WHERE conversation_id = conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation analytics
CREATE OR REPLACE FUNCTION get_conversation_analytics(conv_id UUID, org_id UUID)
RETURNS TABLE (
    conversation_id UUID,
    message_count INTEGER,
    avg_message_length DECIMAL,
    total_tokens INTEGER,
    avg_response_time DECIMAL,
    user_satisfaction DECIMAL,
    source_usage_count INTEGER,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        conv_id as conversation_id,
        COUNT(m.*)::INTEGER as message_count,
        COALESCE(AVG(LENGTH(m.content)), 0)::DECIMAL as avg_message_length,
        COALESCE(SUM(m.tokens_used), 0)::INTEGER as total_tokens,
        COALESCE(AVG(m.response_time_ms), 0)::DECIMAL as avg_response_time,
        COALESCE(AVG(m.user_rating), 0)::DECIMAL as user_satisfaction,
        COALESCE((
            SELECT COUNT(*) FROM message_sources ms 
            JOIN messages msg ON ms.message_id = msg.id
            WHERE msg.conversation_id = conv_id AND ms.organization_id = org_id
        ), 0)::INTEGER as source_usage_count,
        MAX(m.created_at) as last_activity
    FROM messages m
    WHERE m.conversation_id = conv_id AND m.organization_id = org_id
    GROUP BY conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get scheduled export statistics
CREATE OR REPLACE FUNCTION get_scheduled_export_stats(org_id UUID)
RETURNS TABLE (
    total_scheduled_exports INTEGER,
    active_exports INTEGER,
    total_executions INTEGER,
    successful_executions INTEGER,
    failed_executions INTEGER,
    success_rate DECIMAL,
    next_upcoming TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_scheduled_exports,
        COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_exports,
        COALESCE((SELECT COUNT(*) FROM scheduled_export_executions WHERE organization_id = org_id), 0)::INTEGER as total_executions,
        COALESCE((SELECT COUNT(*) FROM scheduled_export_executions WHERE organization_id = org_id AND status = 'completed'), 0)::INTEGER as successful_executions,
        COALESCE((SELECT COUNT(*) FROM scheduled_export_executions WHERE organization_id = org_id AND status = 'failed'), 0)::INTEGER as failed_executions,
        CASE 
            WHEN (SELECT COUNT(*) FROM scheduled_export_executions WHERE organization_id = org_id) > 0 
            THEN (
                SELECT COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)::DECIMAL 
                FROM scheduled_export_executions 
                WHERE organization_id = org_id
            )
            ELSE 0
        END as success_rate,
        MIN(next_execution) as next_upcoming
    FROM scheduled_exports 
    WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Insert Default Export Templates
-- =====================================================

-- Insert system default templates (will be created for each organization)
DO $$
DECLARE
    org_record RECORD;
    system_user_id UUID;
BEGIN
    -- Get system user ID (use the first admin user or create a system user)
    SELECT id INTO system_user_id FROM auth.users LIMIT 1;
    
    -- Insert default templates for each organization
    FOR org_record IN SELECT id FROM organizations LOOP
        -- Default PDF Template
        INSERT INTO export_templates (
            organization_id, created_by, name, description, template_type, 
            template_data, is_active, is_default, is_system
        ) VALUES (
            org_record.id, system_user_id, 'Default PDF', 'Standard PDF export template', 'pdf',
            '{"format": "pdf", "layout": "standard", "include_branding": true, "font_size": 14}',
            true, true, true
        ) ON CONFLICT (organization_id, name, template_type) DO NOTHING;

        -- Legal PDF Template
        INSERT INTO export_templates (
            organization_id, created_by, name, description, template_type,
            template_data, is_active, is_default, is_system
        ) VALUES (
            org_record.id, system_user_id, 'Legal Document', 'Legal-formatted PDF with compliance details', 'pdf',
            '{"format": "pdf", "layout": "legal", "include_compliance": true, "include_signatures": true}',
            true, false, true
        ) ON CONFLICT (organization_id, name, template_type) DO NOTHING;

        -- Executive Summary Template
        INSERT INTO export_templates (
            organization_id, created_by, name, description, template_type,
            template_data, is_active, is_default, is_system
        ) VALUES (
            org_record.id, system_user_id, 'Executive Summary', 'High-level summary format for executives', 'pdf',
            '{"format": "pdf", "layout": "executive", "include_summary": true, "include_metrics": true}',
            true, false, true
        ) ON CONFLICT (organization_id, name, template_type) DO NOTHING;

        -- Interactive HTML Template
        INSERT INTO export_templates (
            organization_id, created_by, name, description, template_type,
            template_data, is_active, is_default, is_system
        ) VALUES (
            org_record.id, system_user_id, 'Interactive HTML', 'Web-friendly interactive export', 'html',
            '{"format": "html", "include_search": true, "include_toc": true, "theme": "light"}',
            true, true, true
        ) ON CONFLICT (organization_id, name, template_type) DO NOTHING;
    END LOOP;
END $$;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE export_jobs IS 'Tracks background export job processing with progress and status';
COMMENT ON TABLE export_job_logs IS 'Detailed logs for export job processing and debugging';
COMMENT ON TABLE export_templates IS 'Custom export templates for different formats and organizations';
COMMENT ON TABLE scheduled_exports IS 'Automated scheduled export configurations';
COMMENT ON TABLE scheduled_export_executions IS 'History of scheduled export execution attempts';
COMMENT ON TABLE export_analytics IS 'Analytics and metrics for export usage tracking';
COMMENT ON TABLE conversation_compliance_analysis IS 'AI-generated compliance analysis for conversations';
COMMENT ON TABLE conversation_cost_tracking IS 'Token usage and cost tracking per conversation';

COMMENT ON FUNCTION get_conversation_message_stats IS 'Returns message statistics for a specific conversation';
COMMENT ON FUNCTION get_conversation_analytics IS 'Returns comprehensive analytics for a conversation';
COMMENT ON FUNCTION get_scheduled_export_stats IS 'Returns statistics for scheduled exports in an organization';