-- Analytics System Foundation Migration
-- Creates comprehensive analytics tables for HR Intelligence Platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Sessions table for tracking user activity
CREATE TABLE user_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    session_start timestamp with time zone NOT NULL DEFAULT NOW(),
    session_end timestamp with time zone,
    ip_address inet,
    user_agent text,
    device_type text,
    browser text,
    os text,
    location_country text,
    location_city text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Chat Interactions table for message tracking
CREATE TABLE chat_interactions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
    message_type text NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
    message_content text NOT NULL,
    response_content text,
    model_name text,
    provider text DEFAULT 'openrouter',
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    cost_usd decimal(10, 6) DEFAULT 0,
    response_time_ms integer,
    success boolean NOT NULL DEFAULT true,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Document Processing table
CREATE TABLE document_processing (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
    document_name text NOT NULL,
    document_type text NOT NULL,
    file_size integer NOT NULL,
    processing_type text NOT NULL CHECK (processing_type IN ('upload', 'analysis', 'compliance_check')),
    processing_time_ms integer,
    success boolean NOT NULL DEFAULT true,
    pages_processed integer DEFAULT 0,
    text_extracted_length integer DEFAULT 0,
    compliance_score decimal(5, 2),
    issues_found integer DEFAULT 0,
    cost_usd decimal(10, 6) DEFAULT 0,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Template Generation table
CREATE TABLE template_generation (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
    template_type text NOT NULL,
    template_category text NOT NULL,
    generation_time_ms integer,
    model_name text,
    provider text DEFAULT 'openrouter',
    tokens_used integer DEFAULT 0,
    cost_usd decimal(10, 6) DEFAULT 0,
    success boolean NOT NULL DEFAULT true,
    compliance_validated boolean DEFAULT false,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- API Usage tracking
CREATE TABLE api_usage (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    endpoint text NOT NULL,
    method text NOT NULL,
    status_code integer NOT NULL,
    response_time_ms integer,
    request_size integer DEFAULT 0,
    response_size integer DEFAULT 0,
    ip_address inet,
    user_agent text,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Cost Tracking table for detailed cost analysis
CREATE TABLE cost_tracking (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type text NOT NULL CHECK (service_type IN ('chat', 'document_processing', 'template_generation', 'compliance_check')),
    provider text NOT NULL,
    model_name text NOT NULL,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    cost_per_input_token decimal(15, 9) NOT NULL,
    cost_per_output_token decimal(15, 9) NOT NULL,
    total_cost_usd decimal(10, 6) NOT NULL,
    currency text DEFAULT 'USD',
    billing_period date NOT NULL DEFAULT CURRENT_DATE,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Performance Metrics table
CREATE TABLE performance_metrics (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    metric_type text NOT NULL CHECK (metric_type IN ('response_time', 'error_rate', 'throughput', 'uptime')),
    metric_value decimal(10, 4) NOT NULL,
    measurement_unit text NOT NULL,
    service_name text NOT NULL,
    endpoint text,
    aggregation_period text NOT NULL CHECK (aggregation_period IN ('minute', 'hour', 'day', 'week', 'month')),
    recorded_at timestamp with time zone NOT NULL DEFAULT NOW(),
    metadata jsonb DEFAULT '{}'
);

-- Compliance Scoring table
CREATE TABLE compliance_scores (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    document_id uuid,
    template_id uuid,
    category text NOT NULL,
    category_arabic text NOT NULL,
    score decimal(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
    max_score decimal(5, 2) NOT NULL DEFAULT 100,
    issues_found integer DEFAULT 0,
    risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    labor_law_references text[],
    scan_type text NOT NULL CHECK (scan_type IN ('automated', 'manual', 'scheduled')),
    scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Compliance Issues table
CREATE TABLE compliance_issues (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    compliance_score_id uuid NOT NULL REFERENCES compliance_scores(id) ON DELETE CASCADE,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category text NOT NULL,
    issue_code text NOT NULL,
    description text NOT NULL,
    description_arabic text NOT NULL,
    recommendation text NOT NULL,
    recommendation_arabic text NOT NULL,
    labor_law_reference text NOT NULL,
    affected_sections text[],
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Analytics Events table for custom event tracking
CREATE TABLE analytics_events (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
    event_name text NOT NULL,
    event_category text NOT NULL,
    event_action text NOT NULL,
    event_label text,
    event_value decimal(10, 4),
    properties jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Audit Trail table for compliance and security tracking
CREATE TABLE audit_trail (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    old_values jsonb DEFAULT '{}',
    new_values jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    success boolean NOT NULL DEFAULT true,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Data Aggregations table for cached metrics
CREATE TABLE data_aggregations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    metric_type text NOT NULL,
    aggregation_period text NOT NULL CHECK (aggregation_period IN ('hour', 'day', 'week', 'month', 'quarter', 'year')),
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    aggregated_data jsonb NOT NULL,
    last_updated timestamp with time zone NOT NULL DEFAULT NOW(),
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, metric_type, aggregation_period, period_start)
);

-- Create indexes for performance optimization
-- User Sessions indexes
CREATE INDEX idx_user_sessions_user_org ON user_sessions(user_id, organization_id);
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at);
CREATE INDEX idx_user_sessions_org_date ON user_sessions(organization_id, created_at DESC);

-- Chat Interactions indexes
CREATE INDEX idx_chat_interactions_user_org ON chat_interactions(user_id, organization_id);
CREATE INDEX idx_chat_interactions_created_at ON chat_interactions(created_at DESC);
CREATE INDEX idx_chat_interactions_org_date ON chat_interactions(organization_id, created_at DESC);
CREATE INDEX idx_chat_interactions_session ON chat_interactions(session_id);
CREATE INDEX idx_chat_interactions_success ON chat_interactions(success, created_at DESC);

-- Document Processing indexes
CREATE INDEX idx_document_processing_user_org ON document_processing(user_id, organization_id);
CREATE INDEX idx_document_processing_created_at ON document_processing(created_at DESC);
CREATE INDEX idx_document_processing_org_date ON document_processing(organization_id, created_at DESC);
CREATE INDEX idx_document_processing_type ON document_processing(processing_type, created_at DESC);

-- Template Generation indexes
CREATE INDEX idx_template_generation_user_org ON template_generation(user_id, organization_id);
CREATE INDEX idx_template_generation_created_at ON template_generation(created_at DESC);
CREATE INDEX idx_template_generation_category ON template_generation(template_category, created_at DESC);

-- API Usage indexes
CREATE INDEX idx_api_usage_org_date ON api_usage(organization_id, created_at DESC);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint, created_at DESC);
CREATE INDEX idx_api_usage_status ON api_usage(status_code, created_at DESC);

-- Cost Tracking indexes
CREATE INDEX idx_cost_tracking_org_date ON cost_tracking(organization_id, created_at DESC);
CREATE INDEX idx_cost_tracking_billing_period ON cost_tracking(organization_id, billing_period DESC);
CREATE INDEX idx_cost_tracking_service ON cost_tracking(service_type, created_at DESC);

-- Performance Metrics indexes
CREATE INDEX idx_performance_metrics_org_date ON performance_metrics(organization_id, recorded_at DESC);
CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type, recorded_at DESC);
CREATE INDEX idx_performance_metrics_period ON performance_metrics(aggregation_period, recorded_at DESC);

-- Compliance Scores indexes
CREATE INDEX idx_compliance_scores_org_date ON compliance_scores(organization_id, created_at DESC);
CREATE INDEX idx_compliance_scores_category ON compliance_scores(category, created_at DESC);
CREATE INDEX idx_compliance_scores_risk ON compliance_scores(risk_level, created_at DESC);

-- Compliance Issues indexes
CREATE INDEX idx_compliance_issues_org_resolved ON compliance_issues(organization_id, resolved, created_at DESC);
CREATE INDEX idx_compliance_issues_severity ON compliance_issues(severity, created_at DESC);
CREATE INDEX idx_compliance_issues_category ON compliance_issues(category, created_at DESC);

-- Analytics Events indexes
CREATE INDEX idx_analytics_events_org_date ON analytics_events(organization_id, created_at DESC);
CREATE INDEX idx_analytics_events_category ON analytics_events(event_category, created_at DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at DESC);

-- Audit Trail indexes
CREATE INDEX idx_audit_trail_org_date ON audit_trail(organization_id, created_at DESC);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id, created_at DESC);
CREATE INDEX idx_audit_trail_resource ON audit_trail(resource_type, resource_id, created_at DESC);

-- Data Aggregations indexes
CREATE INDEX idx_data_aggregations_org_metric ON data_aggregations(organization_id, metric_type, aggregation_period);
CREATE INDEX idx_data_aggregations_period ON data_aggregations(period_start, period_end);
CREATE INDEX idx_data_aggregations_updated ON data_aggregations(last_updated DESC);

-- Create Row Level Security (RLS) policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_aggregations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation
-- User Sessions
CREATE POLICY "Users can access their own sessions" ON user_sessions
    FOR ALL USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = user_sessions.organization_id
            AND uo.role IN ('admin', 'manager')
        )
    );

-- Chat Interactions
CREATE POLICY "Organization members can access chat data" ON chat_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = chat_interactions.organization_id
        )
    );

-- Document Processing
CREATE POLICY "Organization members can access document data" ON document_processing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = document_processing.organization_id
        )
    );

-- Template Generation
CREATE POLICY "Organization members can access template data" ON template_generation
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = template_generation.organization_id
        )
    );

-- API Usage
CREATE POLICY "Organization members can access API usage data" ON api_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = api_usage.organization_id
        )
    );

-- Cost Tracking
CREATE POLICY "Organization members can access cost data" ON cost_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = cost_tracking.organization_id
            AND uo.role IN ('admin', 'manager')
        )
    );

-- Performance Metrics
CREATE POLICY "Organization members can access performance data" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = performance_metrics.organization_id
        )
    );

-- Compliance Scores
CREATE POLICY "Organization members can access compliance data" ON compliance_scores
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = compliance_scores.organization_id
        )
    );

-- Compliance Issues
CREATE POLICY "Organization members can access compliance issues" ON compliance_issues
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = compliance_issues.organization_id
        )
    );

-- Analytics Events
CREATE POLICY "Organization members can access analytics events" ON analytics_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = analytics_events.organization_id
        )
    );

-- Audit Trail
CREATE POLICY "Organization admins can access audit trail" ON audit_trail
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = audit_trail.organization_id
            AND uo.role IN ('admin', 'manager')
        )
    );

-- Data Aggregations
CREATE POLICY "Organization members can access aggregated data" ON data_aggregations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = data_aggregations.organization_id
        )
    );

-- Create functions for automated data aggregation
CREATE OR REPLACE FUNCTION update_session_end()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-update session end time when user becomes inactive
    UPDATE user_sessions 
    SET session_end = NOW(), updated_at = NOW()
    WHERE user_id = NEW.user_id 
    AND session_end IS NULL 
    AND session_start < NOW() - INTERVAL '30 minutes';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update session end times
CREATE TRIGGER trigger_update_session_end
    AFTER INSERT ON chat_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_end();

-- Function to calculate compliance score
CREATE OR REPLACE FUNCTION calculate_compliance_score(
    p_organization_id uuid,
    p_document_id uuid DEFAULT NULL,
    p_template_id uuid DEFAULT NULL
) RETURNS decimal AS $$
DECLARE
    score decimal(5,2) := 0;
    issue_count integer := 0;
    total_checks integer := 10; -- Base number of compliance checks
BEGIN
    -- Get issue count for the specific document/template or organization
    SELECT COUNT(*)
    INTO issue_count
    FROM compliance_issues ci
    JOIN compliance_scores cs ON cs.id = ci.compliance_score_id
    WHERE cs.organization_id = p_organization_id
    AND (p_document_id IS NULL OR cs.document_id = p_document_id)
    AND (p_template_id IS NULL OR cs.template_id = p_template_id)
    AND ci.resolved = false;
    
    -- Calculate score based on issues found
    score := GREATEST(0, 100 - (issue_count * 10));
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily metrics
CREATE OR REPLACE FUNCTION aggregate_daily_metrics(target_date date, org_id uuid)
RETURNS void AS $$
DECLARE
    aggregation_data jsonb;
BEGIN
    -- Aggregate chat interactions
    WITH chat_stats AS (
        SELECT 
            COUNT(*) as total_messages,
            COUNT(DISTINCT user_id) as unique_users,
            AVG(response_time_ms) as avg_response_time,
            SUM(cost_usd) as total_cost,
            COUNT(*) FILTER (WHERE success = false) as error_count,
            SUM(tokens_input + tokens_output) as total_tokens
        FROM chat_interactions
        WHERE organization_id = org_id
        AND DATE(created_at) = target_date
    ),
    doc_stats AS (
        SELECT 
            COUNT(*) as total_documents,
            AVG(processing_time_ms) as avg_processing_time,
            SUM(cost_usd) as processing_cost,
            SUM(pages_processed) as total_pages
        FROM document_processing
        WHERE organization_id = org_id
        AND DATE(created_at) = target_date
    ),
    template_stats AS (
        SELECT 
            COUNT(*) as total_templates,
            AVG(generation_time_ms) as avg_generation_time,
            SUM(cost_usd) as generation_cost
        FROM template_generation
        WHERE organization_id = org_id
        AND DATE(created_at) = target_date
    )
    SELECT jsonb_build_object(
        'chat', row_to_json(c.*),
        'documents', row_to_json(d.*),
        'templates', row_to_json(t.*)
    )
    INTO aggregation_data
    FROM chat_stats c, doc_stats d, template_stats t;
    
    -- Insert or update aggregation
    INSERT INTO data_aggregations (
        organization_id,
        metric_type,
        aggregation_period,
        period_start,
        period_end,
        aggregated_data
    ) VALUES (
        org_id,
        'daily_usage',
        'day',
        target_date::timestamp,
        (target_date + INTERVAL '1 day')::timestamp,
        aggregation_data
    )
    ON CONFLICT (organization_id, metric_type, aggregation_period, period_start)
    DO UPDATE SET 
        aggregated_data = EXCLUDED.aggregated_data,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create automated cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Delete sessions older than 1 year
    DELETE FROM user_sessions 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- Delete raw chat data older than 6 months (keep aggregated data)
    DELETE FROM chat_interactions 
    WHERE created_at < NOW() - INTERVAL '6 months';
    
    -- Delete API usage data older than 3 months
    DELETE FROM api_usage 
    WHERE created_at < NOW() - INTERVAL '3 months';
    
    -- Delete performance metrics older than 1 month (raw data)
    DELETE FROM performance_metrics 
    WHERE recorded_at < NOW() - INTERVAL '1 month'
    AND aggregation_period = 'minute';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_sessions IS 'Tracks user login sessions and activity periods';
COMMENT ON TABLE chat_interactions IS 'Records all chat messages and responses with cost and performance metrics';
COMMENT ON TABLE document_processing IS 'Tracks document uploads, analysis, and compliance checking';
COMMENT ON TABLE template_generation IS 'Records template creation with compliance validation';
COMMENT ON TABLE cost_tracking IS 'Detailed cost breakdown by service, model, and usage';
COMMENT ON TABLE performance_metrics IS 'System performance measurements and KPIs';
COMMENT ON TABLE compliance_scores IS 'Saudi Labor Law compliance scoring for documents and templates';
COMMENT ON TABLE compliance_issues IS 'Specific compliance violations found during analysis';
COMMENT ON TABLE analytics_events IS 'Custom event tracking for user behavior analysis';
COMMENT ON TABLE audit_trail IS 'Security and compliance audit log';
COMMENT ON TABLE data_aggregations IS 'Pre-computed metrics for fast dashboard loading';