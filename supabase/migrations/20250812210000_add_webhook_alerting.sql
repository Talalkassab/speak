-- Add webhook alerting and monitoring tables
-- This migration adds support for webhook monitoring, alerting, and health tracking

-- Create webhook alerting configuration table
CREATE TABLE webhook_alerting_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Threshold configurations
  success_rate_threshold DECIMAL(3,2) DEFAULT 0.95,
  response_time_threshold INTEGER DEFAULT 5000, -- milliseconds
  consecutive_failures_threshold INTEGER DEFAULT 5,
  
  -- Alert channels (webhook URLs, email addresses, etc.)
  alert_channels JSONB DEFAULT '[]',
  
  -- Alert configuration
  alert_cooldown_minutes INTEGER DEFAULT 15,
  is_enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id)
);

-- Create webhook health snapshots table for historical health data
CREATE TABLE webhook_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Health metrics
  success_rate DECIMAL(5,4) NOT NULL,
  average_response_time INTEGER NOT NULL, -- milliseconds
  error_rate DECIMAL(5,4) NOT NULL,
  consecutive_failures INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  
  -- Health status
  is_healthy BOOLEAN NOT NULL,
  health_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Time window for this snapshot
  snapshot_start TIMESTAMPTZ NOT NULL,
  snapshot_end TIMESTAMPTZ NOT NULL,
  snapshot_duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (snapshot_end - snapshot_start)) / 60
  ) STORED,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no overlapping snapshots for same webhook
  EXCLUDE USING gist (
    webhook_id WITH =,
    tstzrange(snapshot_start, snapshot_end) WITH &&
  )
);

-- Create webhook alerts table
CREATE TABLE webhook_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type VARCHAR(50) NOT NULL, -- success_rate, response_time, consecutive_failures, endpoint_down, rate_limit
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  message TEXT NOT NULL,
  
  -- Threshold information
  threshold_value DECIMAL,
  current_value DECIMAL,
  
  -- Alert lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  
  -- Notification tracking
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_channels JSONB DEFAULT '[]',
  
  -- Additional context
  context_data JSONB DEFAULT '{}',
  
  CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CHECK (alert_type IN ('success_rate', 'response_time', 'consecutive_failures', 'endpoint_down', 'rate_limit', 'custom'))
);

-- Create webhook performance metrics table for aggregated time-series data
CREATE TABLE webhook_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Time bucket
  time_bucket TIMESTAMPTZ NOT NULL,
  granularity VARCHAR(10) NOT NULL, -- hour, day, week, month
  
  -- Performance metrics
  event_count INTEGER DEFAULT 0,
  delivery_count INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  abandoned_deliveries INTEGER DEFAULT 0,
  
  -- Response time metrics
  min_response_time INTEGER,
  max_response_time INTEGER,
  avg_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  
  -- Success rate
  success_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN delivery_count > 0 
         THEN ROUND(successful_deliveries::DECIMAL / delivery_count, 4)
         ELSE 1.0 
    END
  ) STORED,
  
  -- Error breakdown
  error_breakdown JSONB DEFAULT '{}', -- error_type -> count
  response_code_breakdown JSONB DEFAULT '{}', -- status_code -> count
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id, time_bucket, granularity),
  CHECK (granularity IN ('hour', 'day', 'week', 'month'))
);

-- Create system health overview table
CREATE TABLE system_health_overview (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Time bucket
  time_bucket TIMESTAMPTZ NOT NULL UNIQUE,
  
  -- Overall system metrics
  total_webhooks INTEGER DEFAULT 0,
  active_webhooks INTEGER DEFAULT 0,
  healthy_webhooks INTEGER DEFAULT 0,
  degraded_webhooks INTEGER DEFAULT 0,
  critical_webhooks INTEGER DEFAULT 0,
  
  -- System-wide performance
  total_events INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  system_success_rate DECIMAL(5,4),
  avg_system_response_time INTEGER,
  
  -- Health status
  overall_health VARCHAR(20) NOT NULL, -- healthy, degraded, critical
  active_alerts INTEGER DEFAULT 0,
  critical_alerts INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (overall_health IN ('healthy', 'degraded', 'critical'))
);

-- Create indexes for performance
CREATE INDEX idx_webhook_alerting_config_webhook_id ON webhook_alerting_config(webhook_id);
CREATE INDEX idx_webhook_alerting_config_enabled ON webhook_alerting_config(is_enabled) WHERE is_enabled = true;

CREATE INDEX idx_webhook_health_snapshots_webhook_id ON webhook_health_snapshots(webhook_id);
CREATE INDEX idx_webhook_health_snapshots_created_at ON webhook_health_snapshots(created_at);
CREATE INDEX idx_webhook_health_snapshots_window ON webhook_health_snapshots(snapshot_start, snapshot_end);
CREATE INDEX idx_webhook_health_snapshots_healthy ON webhook_health_snapshots(is_healthy);

CREATE INDEX idx_webhook_alerts_webhook_id ON webhook_alerts(webhook_id);
CREATE INDEX idx_webhook_alerts_created_at ON webhook_alerts(created_at);
CREATE INDEX idx_webhook_alerts_severity ON webhook_alerts(severity);
CREATE INDEX idx_webhook_alerts_unresolved ON webhook_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_webhook_alerts_type_severity ON webhook_alerts(alert_type, severity);

CREATE INDEX idx_webhook_performance_metrics_webhook_time ON webhook_performance_metrics(webhook_id, time_bucket);
CREATE INDEX idx_webhook_performance_metrics_granularity ON webhook_performance_metrics(granularity, time_bucket);
CREATE INDEX idx_webhook_performance_metrics_success_rate ON webhook_performance_metrics(success_rate);

CREATE INDEX idx_system_health_overview_time ON system_health_overview(time_bucket);
CREATE INDEX idx_system_health_overview_health ON system_health_overview(overall_health);

-- Create triggers for updated_at columns
CREATE TRIGGER update_webhook_alerting_config_updated_at 
  BEFORE UPDATE ON webhook_alerting_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_performance_metrics_updated_at 
  BEFORE UPDATE ON webhook_performance_metrics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate webhook health score
CREATE OR REPLACE FUNCTION calculate_webhook_health_score(
  p_success_rate DECIMAL,
  p_avg_response_time INTEGER,
  p_consecutive_failures INTEGER,
  p_max_response_time INTEGER DEFAULT 5000,
  p_max_failures INTEGER DEFAULT 5
) RETURNS DECIMAL AS $$
BEGIN
  -- Health score formula (0.0 to 1.0)
  -- 60% weight on success rate, 30% on response time, 10% on consecutive failures
  RETURN ROUND(
    (p_success_rate * 0.6) +
    (GREATEST(0, 1 - (p_avg_response_time::DECIMAL / p_max_response_time)) * 0.3) +
    (GREATEST(0, 1 - (p_consecutive_failures::DECIMAL / p_max_failures)) * 0.1),
    2
  );
END;
$$ LANGUAGE plpgsql;

-- Function to determine overall health status
CREATE OR REPLACE FUNCTION determine_health_status(
  p_health_score DECIMAL
) RETURNS VARCHAR AS $$
BEGIN
  IF p_health_score >= 0.9 THEN
    RETURN 'healthy';
  ELSIF p_health_score >= 0.7 THEN
    RETURN 'degraded';
  ELSE
    RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate webhook performance metrics
CREATE OR REPLACE FUNCTION aggregate_webhook_performance(
  p_webhook_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_granularity VARCHAR DEFAULT 'hour'
) RETURNS TABLE(
  time_bucket TIMESTAMPTZ,
  event_count INTEGER,
  success_rate DECIMAL,
  avg_response_time INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc(p_granularity, wd.created_at) as time_bucket,
    COUNT(*)::INTEGER as event_count,
    ROUND(
      COUNT(CASE WHEN wd.delivery_status = 'delivered' THEN 1 END)::DECIMAL / COUNT(*),
      4
    ) as success_rate,
    AVG(wdl.response_time_ms)::INTEGER as avg_response_time
  FROM webhook_deliveries wd
  LEFT JOIN webhook_delivery_logs wdl ON wdl.delivery_id = wd.id
  WHERE wd.webhook_id = p_webhook_id
    AND wd.created_at >= p_start_time
    AND wd.created_at <= p_end_time
  GROUP BY date_trunc(p_granularity, wd.created_at)
  ORDER BY time_bucket;
END;
$$ LANGUAGE plpgsql;

-- Function to create health snapshot
CREATE OR REPLACE FUNCTION create_webhook_health_snapshot(
  p_webhook_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_success_rate DECIMAL;
  v_avg_response_time INTEGER;
  v_consecutive_failures INTEGER;
  v_total_deliveries INTEGER;
  v_health_score DECIMAL;
  v_is_healthy BOOLEAN;
BEGIN
  -- Calculate metrics
  SELECT 
    COUNT(*),
    ROUND(
      COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END)::DECIMAL / COUNT(*),
      4
    ),
    COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END)
  INTO v_total_deliveries, v_success_rate, v_avg_response_time
  FROM webhook_deliveries
  WHERE webhook_id = p_webhook_id
    AND created_at >= p_start_time
    AND created_at <= p_end_time;

  -- Get average response time from logs
  SELECT COALESCE(AVG(response_time_ms)::INTEGER, 0)
  INTO v_avg_response_time
  FROM webhook_delivery_logs wdl
  JOIN webhook_deliveries wd ON wd.id = wdl.delivery_id
  WHERE wd.webhook_id = p_webhook_id
    AND wdl.attempted_at >= p_start_time
    AND wdl.attempted_at <= p_end_time
    AND wdl.response_time_ms IS NOT NULL;

  -- Count consecutive failures (simplified)
  SELECT COUNT(*)
  INTO v_consecutive_failures
  FROM (
    SELECT delivery_status
    FROM webhook_deliveries
    WHERE webhook_id = p_webhook_id
      AND created_at >= p_start_time
    ORDER BY created_at DESC
    LIMIT 10
  ) recent
  WHERE delivery_status IN ('failed', 'abandoned');

  -- Calculate health score
  v_health_score := calculate_webhook_health_score(
    COALESCE(v_success_rate, 1.0),
    COALESCE(v_avg_response_time, 0),
    COALESCE(v_consecutive_failures, 0)
  );

  v_is_healthy := (v_health_score >= 0.8);

  -- Insert snapshot
  INSERT INTO webhook_health_snapshots (
    webhook_id,
    success_rate,
    average_response_time,
    error_rate,
    consecutive_failures,
    total_deliveries,
    is_healthy,
    health_score,
    snapshot_start,
    snapshot_end
  ) VALUES (
    p_webhook_id,
    COALESCE(v_success_rate, 1.0),
    COALESCE(v_avg_response_time, 0),
    COALESCE(1.0 - v_success_rate, 0.0),
    COALESCE(v_consecutive_failures, 0),
    COALESCE(v_total_deliveries, 0),
    v_is_healthy,
    v_health_score,
    p_start_time,
    p_end_time
  ) RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old monitoring data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data(
  p_retention_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
  
  -- Clean up old health snapshots
  DELETE FROM webhook_health_snapshots 
  WHERE created_at < v_cutoff_date;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Clean up old resolved alerts
  DELETE FROM webhook_alerts 
  WHERE is_resolved = true AND resolved_at < v_cutoff_date;
  
  -- Clean up old performance metrics (keep daily and higher granularity longer)
  DELETE FROM webhook_performance_metrics 
  WHERE granularity = 'hour' AND created_at < v_cutoff_date;
  
  DELETE FROM webhook_performance_metrics 
  WHERE granularity = 'day' AND created_at < (NOW() - '90 days'::INTERVAL);
  
  -- Clean up old system health overview
  DELETE FROM system_health_overview 
  WHERE created_at < v_cutoff_date;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE webhook_alerting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_overview ENABLE ROW LEVEL SECURITY;

-- Policies for webhook_alerting_config
CREATE POLICY "Users can manage alerting config for their webhooks" ON webhook_alerting_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

-- Policies for webhook_health_snapshots
CREATE POLICY "Users can view health snapshots for their webhooks" ON webhook_health_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all health snapshots" ON webhook_health_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for webhook_alerts
CREATE POLICY "Users can view alerts for their webhooks" ON webhook_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all alerts" ON webhook_alerts
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

-- Policies for system_health_overview
CREATE POLICY "Authenticated users can view system health overview" ON system_health_overview
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage system health overview" ON system_health_overview
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add comments
COMMENT ON TABLE webhook_alerting_config IS 'Configuration for webhook monitoring and alerting';
COMMENT ON TABLE webhook_health_snapshots IS 'Historical health snapshots for webhooks';
COMMENT ON TABLE webhook_alerts IS 'Webhook alerts and notifications';
COMMENT ON TABLE webhook_performance_metrics IS 'Time-series performance metrics for webhooks';
COMMENT ON TABLE system_health_overview IS 'System-wide health overview snapshots';

COMMENT ON FUNCTION calculate_webhook_health_score IS 'Calculate overall health score for a webhook';
COMMENT ON FUNCTION determine_health_status IS 'Determine health status based on health score';
COMMENT ON FUNCTION aggregate_webhook_performance IS 'Aggregate webhook performance metrics over time';
COMMENT ON FUNCTION create_webhook_health_snapshot IS 'Create a health snapshot for a webhook';
COMMENT ON FUNCTION cleanup_old_monitoring_data IS 'Clean up old monitoring data based on retention policy';