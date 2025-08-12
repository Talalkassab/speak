-- Audit logs table for comprehensive tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  outcome TEXT CHECK (outcome IN ('success', 'failure', 'partial', 'pending')) DEFAULT 'success',
  
  -- Actor (who performed the action)
  actor_type TEXT CHECK (actor_type IN ('user', 'system', 'service', 'admin')) NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  actor_name TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Target (what was acted upon)
  target_type TEXT CHECK (target_type IN ('user', 'organization', 'document', 'template', 'system', 'data')),
  target_id TEXT,
  target_name TEXT,
  target_data JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  location TEXT,
  session_id TEXT,
  request_id TEXT,
  trace_id TEXT,
  method TEXT,
  endpoint TEXT,
  
  -- Event details
  description TEXT NOT NULL,
  changes_before JSONB,
  changes_after JSONB,
  changed_fields TEXT[],
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,
  
  -- Compliance and regulatory fields
  regulation TEXT CHECK (regulation IN ('GDPR', 'CCPA', 'SOX', 'HIPAA', 'Saudi_Labor_Law')),
  data_category TEXT CHECK (data_category IN ('PII', 'PHI', 'Financial', 'Legal', 'HR')),
  retention_period INTEGER, -- days
  encryption_used BOOLEAN DEFAULT FALSE,
  
  -- Additional template-specific fields
  compliance_flags TEXT[] DEFAULT '{}',
  sensitive_data_accessed BOOLEAN DEFAULT FALSE,
  data_classification TEXT CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')) DEFAULT 'internal',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Critical audit events table for high-priority tracking
CREATE TABLE IF NOT EXISTS critical_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template compliance reports table
CREATE TABLE IF NOT EXISTS template_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES hr_templates(id) ON DELETE CASCADE,
  report_type TEXT CHECK (report_type IN ('full_scan', 'incremental', 'on_demand')) NOT NULL,
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  violations_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,
  recommendations_count INTEGER DEFAULT 0,
  detailed_report JSONB NOT NULL DEFAULT '{}',
  scan_parameters JSONB DEFAULT '{}',
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '90 days'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance_flags ON audit_logs USING GIN(compliance_flags);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitive_data ON audit_logs(sensitive_data_accessed) WHERE sensitive_data_accessed = TRUE;

CREATE INDEX IF NOT EXISTS idx_critical_audit_events_org_id ON critical_audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_critical_audit_events_resolved ON critical_audit_events(resolved);
CREATE INDEX IF NOT EXISTS idx_critical_audit_events_created_at ON critical_audit_events(created_at);

CREATE INDEX IF NOT EXISTS idx_template_compliance_reports_template_id ON template_compliance_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_template_compliance_reports_org_id ON template_compliance_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_compliance_reports_score ON template_compliance_reports(compliance_score);

-- Enable RLS on audit tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_compliance_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs for their organization" ON audit_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true); -- System-level inserts are allowed

-- RLS Policies for critical_audit_events
CREATE POLICY "Organization admins can view critical events" ON critical_audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = critical_audit_events.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization admins can update critical events" ON critical_audit_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = critical_audit_events.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- RLS Policies for template_compliance_reports
CREATE POLICY "Organization members can view compliance reports" ON template_compliance_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_compliance_reports.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can create compliance reports" ON template_compliance_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_compliance_reports.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

-- Function to automatically clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete audit logs older than retention period
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * COALESCE(retention_period, 2555)
  AND retention_period IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up expired compliance reports
  DELETE FROM template_compliance_reports
  WHERE expires_at < NOW();
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate compliance summary
CREATE OR REPLACE FUNCTION get_compliance_summary(
  p_organization_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
  total_events INTEGER,
  critical_events INTEGER,
  compliance_violations INTEGER,
  sensitive_data_access INTEGER,
  top_risk_areas TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_events,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER AS critical_events,
    COUNT(*) FILTER (WHERE 'compliance_violation' = ANY(compliance_flags))::INTEGER AS compliance_violations,
    COUNT(*) FILTER (WHERE sensitive_data_accessed = TRUE)::INTEGER AS sensitive_data_access,
    array_agg(DISTINCT event_type) FILTER (WHERE severity IN ('high', 'critical')) AS top_risk_areas
  FROM audit_logs
  WHERE organization_id = p_organization_id
    AND created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track template compliance changes
CREATE OR REPLACE FUNCTION track_template_compliance_change()
RETURNS TRIGGER AS $$
DECLARE
  compliance_changed BOOLEAN := FALSE;
BEGIN
  -- Check if compliance-related fields changed
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.compliance_status != NEW.compliance_status OR 
        OLD.compliance_rules != NEW.compliance_rules) THEN
      compliance_changed := TRUE;
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    compliance_changed := TRUE;
  END IF;
  
  -- Log compliance change if it occurred
  IF compliance_changed THEN
    INSERT INTO audit_logs (
      event_type,
      severity,
      actor_type,
      actor_id,
      organization_id,
      target_type,
      target_id,
      target_name,
      description,
      changes_before,
      changes_after,
      compliance_flags,
      data_classification
    ) VALUES (
      CASE WHEN TG_OP = 'INSERT' THEN 'template.compliance_checked' 
           ELSE 'template.compliance_updated' END,
      CASE WHEN NEW.compliance_status = 'non_compliant' THEN 'high' 
           WHEN NEW.compliance_status = 'warning' THEN 'medium' 
           ELSE 'low' END,
      'system',
      'compliance_tracker',
      NEW.organization_id,
      'template',
      NEW.id::TEXT,
      NEW.name,
      'Template compliance status changed',
      CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD.*) ELSE NULL END,
      row_to_json(NEW.*),
      ARRAY['saudi_labor_law', 'compliance_tracking'],
      'internal'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for template compliance tracking
DROP TRIGGER IF EXISTS trigger_track_template_compliance ON hr_templates;
CREATE TRIGGER trigger_track_template_compliance
  AFTER INSERT OR UPDATE ON hr_templates
  FOR EACH ROW
  EXECUTE FUNCTION track_template_compliance_change();

-- Add template-specific audit event types
COMMENT ON COLUMN audit_logs.event_type IS 'Event type including template.created, template.updated, template.deleted, template.generated, template.compliance_checked, document.generated, etc.';
COMMENT ON COLUMN audit_logs.compliance_flags IS 'Array of compliance flags like saudi_labor_law, gdpr, sensitive_data_access, etc.';
COMMENT ON COLUMN audit_logs.data_classification IS 'Data sensitivity classification for compliance tracking';

-- Insert sample audit event types for reference
COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for all system activities including template management, document generation, and compliance tracking';
