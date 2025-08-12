-- Analytics Jobs and Alerts Migration
-- Adds tables for job logging and alert management

-- Analytics Job Logs table
CREATE TABLE analytics_job_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_name text NOT NULL,
    status text NOT NULL CHECK (status IN ('success', 'error', 'running')),
    duration_ms integer,
    error_message text,
    metadata jsonb DEFAULT '{}',
    executed_at timestamp with time zone NOT NULL DEFAULT NOW(),
    created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Analytics Alerts table
CREATE TABLE analytics_alerts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL,
    alert_type text NOT NULL CHECK (alert_type IN ('cost_threshold', 'performance_degradation', 'compliance_issue', 'usage_spike', 'system_error')),
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title text NOT NULL,
    title_arabic text NOT NULL,
    message text NOT NULL,
    message_arabic text NOT NULL,
    threshold decimal(15, 6),
    current_value decimal(15, 6),
    metadata jsonb DEFAULT '{}',
    acknowledged boolean DEFAULT false,
    acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    acknowledged_at timestamp with time zone,
    resolved boolean DEFAULT false,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_analytics_job_logs_job_name ON analytics_job_logs(job_name, executed_at DESC);
CREATE INDEX idx_analytics_job_logs_status ON analytics_job_logs(status, executed_at DESC);
CREATE INDEX idx_analytics_job_logs_executed_at ON analytics_job_logs(executed_at DESC);

CREATE INDEX idx_analytics_alerts_org_id ON analytics_alerts(organization_id, created_at DESC);
CREATE INDEX idx_analytics_alerts_type ON analytics_alerts(alert_type, created_at DESC);
CREATE INDEX idx_analytics_alerts_severity ON analytics_alerts(severity, created_at DESC);
CREATE INDEX idx_analytics_alerts_acknowledged ON analytics_alerts(acknowledged, created_at DESC);
CREATE INDEX idx_analytics_alerts_resolved ON analytics_alerts(resolved, created_at DESC);

-- Enable RLS
ALTER TABLE analytics_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_job_logs (admin only)
CREATE POLICY "Admins can view job logs" ON analytics_job_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.role = 'admin'
        )
    );

CREATE POLICY "System can insert job logs" ON analytics_job_logs
    FOR INSERT WITH CHECK (true); -- Allow system processes to insert

-- RLS Policies for analytics_alerts
CREATE POLICY "Organization members can view alerts" ON analytics_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = analytics_alerts.organization_id
        )
    );

CREATE POLICY "Organization admins can update alerts" ON analytics_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_organizations uo 
            WHERE uo.user_id = auth.uid() 
            AND uo.organization_id = analytics_alerts.organization_id
            AND uo.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "System can insert alerts" ON analytics_alerts
    FOR INSERT WITH CHECK (true); -- Allow system processes to insert

-- Add organization budget field if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'organizations' AND column_name = 'monthly_budget_usd') THEN
        ALTER TABLE organizations ADD COLUMN monthly_budget_usd decimal(10, 2) DEFAULT 1000.00;
    END IF;
END $$;

-- Update triggers for analytics_alerts
CREATE OR REPLACE FUNCTION update_analytics_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analytics_alerts_updated_at
    BEFORE UPDATE ON analytics_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_alerts_updated_at();

-- Function to acknowledge alerts
CREATE OR REPLACE FUNCTION acknowledge_alert(
    alert_id uuid,
    user_id uuid
) RETURNS boolean AS $$
DECLARE
    alert_exists boolean;
BEGIN
    -- Check if alert exists and user has permission
    SELECT EXISTS (
        SELECT 1 FROM analytics_alerts a
        JOIN user_organizations uo ON uo.organization_id = a.organization_id
        WHERE a.id = alert_id
        AND uo.user_id = acknowledge_alert.user_id
        AND uo.role IN ('admin', 'manager')
        AND NOT a.acknowledged
    ) INTO alert_exists;
    
    IF NOT alert_exists THEN
        RETURN false;
    END IF;
    
    -- Acknowledge the alert
    UPDATE analytics_alerts 
    SET 
        acknowledged = true,
        acknowledged_by = acknowledge_alert.user_id,
        acknowledged_at = NOW(),
        updated_at = NOW()
    WHERE id = alert_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_alert(
    alert_id uuid,
    user_id uuid
) RETURNS boolean AS $$
DECLARE
    alert_exists boolean;
BEGIN
    -- Check if alert exists and user has permission
    SELECT EXISTS (
        SELECT 1 FROM analytics_alerts a
        JOIN user_organizations uo ON uo.organization_id = a.organization_id
        WHERE a.id = alert_id
        AND uo.user_id = resolve_alert.user_id
        AND uo.role IN ('admin', 'manager')
        AND NOT a.resolved
    ) INTO alert_exists;
    
    IF NOT alert_exists THEN
        RETURN false;
    END IF;
    
    -- Resolve the alert (and acknowledge if not already)
    UPDATE analytics_alerts 
    SET 
        resolved = true,
        resolved_by = resolve_alert.user_id,
        resolved_at = NOW(),
        acknowledged = true,
        acknowledged_by = COALESCE(acknowledged_by, resolve_alert.user_id),
        acknowledged_at = COALESCE(acknowledged_at, NOW()),
        updated_at = NOW()
    WHERE id = alert_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get alert summary for organization
CREATE OR REPLACE FUNCTION get_alert_summary(org_id uuid)
RETURNS TABLE (
    total_alerts bigint,
    critical_alerts bigint,
    unacknowledged_alerts bigint,
    unresolved_alerts bigint,
    recent_alerts bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts,
        COUNT(*) FILTER (WHERE NOT acknowledged) as unacknowledged_alerts,
        COUNT(*) FILTER (WHERE NOT resolved) as unresolved_alerts,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_alerts
    FROM analytics_alerts
    WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old alerts
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
    -- Delete resolved alerts older than 30 days
    DELETE FROM analytics_alerts 
    WHERE resolved = true 
    AND resolved_at < NOW() - INTERVAL '30 days';
    
    -- Delete info-level alerts older than 7 days
    DELETE FROM analytics_alerts 
    WHERE severity = 'info' 
    AND created_at < NOW() - INTERVAL '7 days';
    
    -- Archive old job logs (keep last 90 days)
    DELETE FROM analytics_job_logs 
    WHERE executed_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleaned up old alerts and job logs';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE analytics_job_logs IS 'Logs execution of analytics aggregation jobs';
COMMENT ON TABLE analytics_alerts IS 'System-generated alerts for analytics thresholds and issues';
COMMENT ON FUNCTION acknowledge_alert IS 'Acknowledges an alert for an organization admin/manager';
COMMENT ON FUNCTION resolve_alert IS 'Resolves an alert for an organization admin/manager';
COMMENT ON FUNCTION get_alert_summary IS 'Gets alert summary statistics for an organization';
COMMENT ON FUNCTION cleanup_old_alerts IS 'Cleans up old resolved alerts and job logs';