-- Webhook Security and Alerting Enhancement
-- Add missing tables for webhook security events and alerting configuration

-- Create webhook security events table
CREATE TABLE IF NOT EXISTS webhook_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook alerting configuration table
CREATE TABLE IF NOT EXISTS webhook_alerting_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  success_rate_threshold DECIMAL(3,2) DEFAULT 0.95,
  response_time_threshold INTEGER DEFAULT 5000,
  consecutive_failures_threshold INTEGER DEFAULT 5,
  alert_channels JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id)
);

-- Create webhook batch processing table for job processor
CREATE TABLE IF NOT EXISTS webhook_batch_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  batch_size INTEGER DEFAULT 10,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook performance metrics table
CREATE TABLE IF NOT EXISTS webhook_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  metric_unit VARCHAR(20),
  time_bucket TIMESTAMPTZ NOT NULL,
  bucket_size VARCHAR(20) DEFAULT 'hour', -- hour, day, week, month
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id, metric_name, time_bucket, bucket_size)
);

-- Create webhook integration templates table
CREATE TABLE IF NOT EXISTS webhook_integration_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_type integration_type NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_description TEXT,
  payload_template JSONB NOT NULL,
  configuration_schema JSONB,
  is_system_template BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(integration_type, template_name)
);

-- Create indexes for performance
CREATE INDEX idx_webhook_security_events_webhook_id ON webhook_security_events(webhook_id);
CREATE INDEX idx_webhook_security_events_created_at ON webhook_security_events(created_at);
CREATE INDEX idx_webhook_security_events_type ON webhook_security_events(event_type);

CREATE INDEX idx_webhook_batch_jobs_status ON webhook_batch_jobs(status);
CREATE INDEX idx_webhook_batch_jobs_type ON webhook_batch_jobs(job_type);
CREATE INDEX idx_webhook_batch_jobs_created_at ON webhook_batch_jobs(created_at);

CREATE INDEX idx_webhook_performance_metrics_webhook_time ON webhook_performance_metrics(webhook_id, time_bucket);
CREATE INDEX idx_webhook_performance_metrics_metric ON webhook_performance_metrics(metric_name);
CREATE INDEX idx_webhook_performance_metrics_bucket ON webhook_performance_metrics(time_bucket, bucket_size);

CREATE INDEX idx_webhook_integration_templates_type ON webhook_integration_templates(integration_type);

-- Add trigger for updating webhook_alerting_config.updated_at
CREATE TRIGGER update_webhook_alerting_config_updated_at 
  BEFORE UPDATE ON webhook_alerting_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_integration_templates_updated_at 
  BEFORE UPDATE ON webhook_integration_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for new tables
ALTER TABLE webhook_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_alerting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_integration_templates ENABLE ROW LEVEL SECURITY;

-- Policies for webhook_security_events
CREATE POLICY "Users can view security events for their webhooks" ON webhook_security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all security events" ON webhook_security_events
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for webhook_alerting_config
CREATE POLICY "Users can manage alerting config for their webhooks" ON webhook_alerting_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

-- Policies for webhook_batch_jobs (system only)
CREATE POLICY "Service role can manage batch jobs" ON webhook_batch_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for webhook_performance_metrics
CREATE POLICY "Users can view performance metrics for their webhooks" ON webhook_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all performance metrics" ON webhook_performance_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for webhook_integration_templates
CREATE POLICY "Users can view all integration templates" ON webhook_integration_templates
  FOR SELECT USING (true);

CREATE POLICY "Users can create custom templates" ON webhook_integration_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by AND is_system_template = false);

CREATE POLICY "Users can update their own custom templates" ON webhook_integration_templates
  FOR UPDATE USING (auth.uid() = created_by AND is_system_template = false);

CREATE POLICY "Users can delete their own custom templates" ON webhook_integration_templates
  FOR DELETE USING (auth.uid() = created_by AND is_system_template = false);

CREATE POLICY "Service role can manage system templates" ON webhook_integration_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to aggregate webhook performance metrics
CREATE OR REPLACE FUNCTION aggregate_webhook_performance_metrics()
RETURNS void AS $$
BEGIN
  -- Aggregate hourly metrics from delivery logs
  INSERT INTO webhook_performance_metrics (webhook_id, metric_name, metric_value, metric_unit, time_bucket, bucket_size)
  SELECT 
    wd.webhook_id,
    'success_rate',
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE wdl.is_success = true) * 100.0 / COUNT(*)), 2)
      ELSE 0
    END,
    'percentage',
    date_trunc('hour', wdl.attempted_at),
    'hour'
  FROM webhook_delivery_logs wdl
  JOIN webhook_deliveries wd ON wd.id = wdl.delivery_id
  WHERE wdl.attempted_at >= NOW() - INTERVAL '2 hours'
    AND wdl.attempted_at < date_trunc('hour', NOW())
  GROUP BY wd.webhook_id, date_trunc('hour', wdl.attempted_at)
  ON CONFLICT (webhook_id, metric_name, time_bucket, bucket_size) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    created_at = NOW();

  -- Aggregate response time metrics
  INSERT INTO webhook_performance_metrics (webhook_id, metric_name, metric_value, metric_unit, time_bucket, bucket_size)
  SELECT 
    wd.webhook_id,
    'avg_response_time',
    ROUND(AVG(wdl.response_time_ms), 2),
    'milliseconds',
    date_trunc('hour', wdl.attempted_at),
    'hour'
  FROM webhook_delivery_logs wdl
  JOIN webhook_deliveries wd ON wd.id = wdl.delivery_id
  WHERE wdl.attempted_at >= NOW() - INTERVAL '2 hours'
    AND wdl.attempted_at < date_trunc('hour', NOW())
    AND wdl.response_time_ms IS NOT NULL
    AND wdl.response_time_ms > 0
  GROUP BY wd.webhook_id, date_trunc('hour', wdl.attempted_at)
  ON CONFLICT (webhook_id, metric_name, time_bucket, bucket_size) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    created_at = NOW();

  -- Aggregate event count metrics
  INSERT INTO webhook_performance_metrics (webhook_id, metric_name, metric_value, metric_unit, time_bucket, bucket_size)
  SELECT 
    wd.webhook_id,
    'event_count',
    COUNT(*),
    'count',
    date_trunc('hour', wdl.attempted_at),
    'hour'
  FROM webhook_delivery_logs wdl
  JOIN webhook_deliveries wd ON wd.id = wdl.delivery_id
  WHERE wdl.attempted_at >= NOW() - INTERVAL '2 hours'
    AND wdl.attempted_at < date_trunc('hour', NOW())
  GROUP BY wd.webhook_id, date_trunc('hour', wdl.attempted_at)
  ON CONFLICT (webhook_id, metric_name, time_bucket, bucket_size) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Insert system webhook integration templates
INSERT INTO webhook_integration_templates (integration_type, template_name, template_description, payload_template, configuration_schema, is_system_template) VALUES
-- Slack templates
('slack', 'Simple Notification', 'Basic Slack notification template', 
 '{"text": "{{event.data.message}}", "channel": "{{config.channel}}", "username": "HR Platform"}',
 '{"type": "object", "required": ["channel"], "properties": {"channel": {"type": "string"}}}',
 true),

('slack', 'Rich Document Alert', 'Rich Slack notification for document events',
 '{"text": "Document {{event.type}}", "attachments": [{"color": "good", "fields": [{"title": "Document", "value": "{{event.data.fileName}}", "short": true}, {"title": "Status", "value": "{{event.data.status}}", "short": true}]}]}',
 '{"type": "object", "required": ["channel"], "properties": {"channel": {"type": "string"}}}',
 true),

-- Microsoft Teams templates  
('microsoft_teams', 'Simple Card', 'Basic Teams card notification',
 '{"@type": "MessageCard", "summary": "{{event.type}}", "text": "{{event.data.message}}", "themeColor": "0076D7"}',
 '{"type": "object", "required": ["webhookUrl"], "properties": {"webhookUrl": {"type": "string"}}}',
 true),

('microsoft_teams', 'Detailed Alert', 'Detailed Teams alert with facts',
 '{"@type": "MessageCard", "summary": "{{event.type}}", "sections": [{"facts": [{"name": "Event", "value": "{{event.type}}"}, {"name": "Time", "value": "{{event.timestamp}}"}]}]}',
 '{"type": "object", "required": ["webhookUrl"], "properties": {"webhookUrl": {"type": "string"}}}', 
 true),

-- Email templates
('email', 'Alert Email', 'Basic email alert template',
 '{"subject": "HR Platform Alert: {{event.type}}", "body": "<p>Alert: {{event.data.message}}</p><p>Time: {{event.timestamp}}</p>"}',
 '{"type": "object", "required": ["to"], "properties": {"to": {"type": "array", "items": {"type": "string"}}}}',
 true),

-- Discord templates
('discord', 'Simple Embed', 'Basic Discord embed notification',
 '{"embeds": [{"title": "{{event.type}}", "description": "{{event.data.message}}", "color": 3447003, "timestamp": "{{event.timestamp}}"}]}',
 '{"type": "object", "required": ["webhookUrl"], "properties": {"webhookUrl": {"type": "string"}}}',
 true);

-- Add comments for documentation
COMMENT ON TABLE webhook_security_events IS 'Security events and audit trail for webhook operations';
COMMENT ON TABLE webhook_alerting_config IS 'Alerting configuration and thresholds for webhooks';
COMMENT ON TABLE webhook_batch_jobs IS 'Background job tracking for webhook batch operations';
COMMENT ON TABLE webhook_performance_metrics IS 'Aggregated performance metrics for webhook monitoring';
COMMENT ON TABLE webhook_integration_templates IS 'Reusable templates for different webhook integrations';

COMMENT ON FUNCTION aggregate_webhook_performance_metrics() IS 'Aggregates webhook performance metrics from delivery logs into time buckets';

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;