-- Create webhook system tables
-- This migration creates the comprehensive webhook infrastructure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for webhook system
CREATE TYPE webhook_event_type AS ENUM (
  -- Document Events
  'document.uploaded',
  'document.processing.started',
  'document.processing.completed',
  'document.processing.failed',
  'document.analysis.completed',
  'document.deleted',
  
  -- Chat Events
  'chat.conversation.created',
  'chat.message.sent',
  'chat.message.received',
  'chat.ai.response.generated',
  'chat.conversation.archived',
  
  -- Analytics Events
  'analytics.usage.threshold',
  'analytics.cost.alert',
  'analytics.performance.degraded',
  'analytics.quota.exceeded',
  
  -- Compliance Events
  'compliance.policy.violation',
  'compliance.audit.trigger',
  'compliance.regulatory.alert',
  'compliance.data.breach.detected',
  
  -- System Events
  'system.health.alert',
  'system.error.critical',
  'system.maintenance.scheduled',
  'system.maintenance.started',
  'system.maintenance.completed',
  'system.backup.completed',
  'system.backup.failed'
);

CREATE TYPE webhook_delivery_status AS ENUM (
  'pending',
  'delivered',
  'failed',
  'retrying',
  'abandoned'
);

CREATE TYPE webhook_auth_type AS ENUM (
  'none',
  'api_key',
  'bearer_token',
  'hmac_sha256',
  'oauth2'
);

CREATE TYPE integration_type AS ENUM (
  'custom',
  'slack',
  'microsoft_teams',
  'email',
  'sms',
  'discord',
  'webhook'
);

-- Create webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Event filtering
  event_types webhook_event_type[] DEFAULT '{}',
  event_filters JSONB DEFAULT '{}',
  
  -- Authentication configuration
  auth_type webhook_auth_type DEFAULT 'none',
  auth_config JSONB DEFAULT '{}', -- Stores API keys, tokens, etc.
  secret_key TEXT, -- For HMAC signature verification
  
  -- Integration configuration
  integration_type integration_type DEFAULT 'custom',
  integration_config JSONB DEFAULT '{}',
  
  -- Delivery configuration
  timeout_seconds INTEGER DEFAULT 30,
  retry_count INTEGER DEFAULT 3,
  retry_backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
  max_retry_delay_seconds INTEGER DEFAULT 3600,
  
  -- Payload customization
  payload_template JSONB,
  custom_headers JSONB DEFAULT '{}',
  
  -- Rate limiting
  rate_limit_per_hour INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 10000,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  
  CONSTRAINT valid_url CHECK (url ~ '^https?://'),
  CONSTRAINT positive_timeout CHECK (timeout_seconds > 0),
  CONSTRAINT positive_retry_count CHECK (retry_count >= 0),
  CONSTRAINT positive_rate_limits CHECK (rate_limit_per_hour > 0 AND rate_limit_per_day > 0)
);

-- Create webhook events table
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type webhook_event_type NOT NULL,
  event_id VARCHAR(255) NOT NULL, -- Unique identifier for idempotency
  
  -- Event context
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID, -- ID of the related resource (document, conversation, etc.)
  resource_type VARCHAR(100), -- Type of resource (document, conversation, etc.)
  
  -- Event data
  event_data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Processing status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(event_id, event_type)
);

-- Create webhook deliveries table
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  
  -- Delivery details
  delivery_status webhook_delivery_status DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Request/Response data
  request_payload JSONB,
  request_headers JSONB DEFAULT '{}',
  response_status_code INTEGER,
  response_headers JSONB DEFAULT '{}',
  response_body TEXT,
  
  -- Timing information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB DEFAULT '{}'
);

-- Create webhook delivery logs table for detailed tracking
CREATE TABLE webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  
  -- Attempt details
  attempt_number INTEGER NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Request details
  request_url TEXT NOT NULL,
  request_method VARCHAR(10) DEFAULT 'POST',
  request_headers JSONB DEFAULT '{}',
  request_body TEXT,
  
  -- Response details
  response_status_code INTEGER,
  response_headers JSONB DEFAULT '{}',
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Error information
  error_type VARCHAR(100),
  error_message TEXT,
  
  -- Success indicator
  is_success BOOLEAN DEFAULT false
);

-- Create webhook rate limits table
CREATE TABLE webhook_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Time windows
  hour_bucket TIMESTAMPTZ NOT NULL,
  day_bucket DATE NOT NULL,
  
  -- Counters
  hourly_count INTEGER DEFAULT 0,
  daily_count INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id, hour_bucket),
  UNIQUE(webhook_id, day_bucket)
);

-- Create webhook subscriptions table for fine-grained event filtering
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type webhook_event_type NOT NULL,
  
  -- Filter conditions
  filter_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(webhook_id, event_type)
);

-- Create indexes for performance
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;
CREATE INDEX idx_webhooks_event_types ON webhooks USING GIN(event_types);

CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX idx_webhook_events_resource ON webhook_events(resource_type, resource_id);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(delivery_status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE delivery_status = 'retrying';
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

CREATE INDEX idx_webhook_delivery_logs_delivery_id ON webhook_delivery_logs(delivery_id);
CREATE INDEX idx_webhook_delivery_logs_attempted_at ON webhook_delivery_logs(attempted_at);

CREATE INDEX idx_webhook_rate_limits_webhook_hour ON webhook_rate_limits(webhook_id, hour_bucket);
CREATE INDEX idx_webhook_rate_limits_webhook_day ON webhook_rate_limits(webhook_id, day_bucket);

CREATE INDEX idx_webhook_subscriptions_webhook ON webhook_subscriptions(webhook_id);
CREATE INDEX idx_webhook_subscriptions_event_type ON webhook_subscriptions(event_type);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_webhooks_updated_at 
  BEFORE UPDATE ON webhooks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_rate_limits_updated_at 
  BEFORE UPDATE ON webhook_rate_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate HMAC signature
CREATE OR REPLACE FUNCTION generate_webhook_signature(
  payload TEXT,
  secret_key TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(hmac(payload, secret_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to validate webhook event filters
CREATE OR REPLACE FUNCTION validate_webhook_event_filter(
  event_data JSONB,
  filter_conditions JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  condition_key TEXT;
  condition_value JSONB;
BEGIN
  -- If no filter conditions, allow all events
  IF filter_conditions = '{}' OR filter_conditions IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check each filter condition
  FOR condition_key, condition_value IN SELECT * FROM jsonb_each(filter_conditions)
  LOOP
    -- Simple equality check for now - can be extended for complex conditions
    IF NOT (event_data ? condition_key AND event_data->condition_key = condition_value) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get webhooks for event
CREATE OR REPLACE FUNCTION get_webhooks_for_event(
  p_event_type webhook_event_type,
  p_user_id UUID,
  p_event_data JSONB DEFAULT '{}'
) RETURNS TABLE(
  webhook_id UUID,
  webhook_url TEXT,
  webhook_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.url,
    jsonb_build_object(
      'auth_type', w.auth_type,
      'auth_config', w.auth_config,
      'secret_key', w.secret_key,
      'custom_headers', w.custom_headers,
      'payload_template', w.payload_template,
      'timeout_seconds', w.timeout_seconds,
      'integration_type', w.integration_type,
      'integration_config', w.integration_config
    )
  FROM webhooks w
  WHERE w.is_active = true
    AND (w.user_id = p_user_id OR w.user_id IS NULL) -- Allow system-wide webhooks
    AND (
      cardinality(w.event_types) = 0 -- No specific event types means all events
      OR p_event_type = ANY(w.event_types)
    )
    AND (
      w.event_filters = '{}'
      OR validate_webhook_event_filter(p_event_data, w.event_filters)
    );
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for webhooks table
CREATE POLICY "Users can view their own webhooks" ON webhooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks" ON webhooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks" ON webhooks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks" ON webhooks
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for webhook_events table
CREATE POLICY "Users can view events for their webhooks" ON webhook_events
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all webhook events" ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for webhook_deliveries table
CREATE POLICY "Users can view deliveries for their webhooks" ON webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all webhook deliveries" ON webhook_deliveries
  FOR ALL USING (auth.role() = 'service_role');

-- Similar policies for other tables
CREATE POLICY "Users can view logs for their webhook deliveries" ON webhook_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhook_deliveries wd
      JOIN webhooks w ON w.id = wd.webhook_id
      WHERE wd.id = delivery_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all webhook logs" ON webhook_delivery_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view rate limits for their webhooks" ON webhook_rate_limits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all rate limits" ON webhook_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage subscriptions for their webhooks" ON webhook_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM webhooks w 
      WHERE w.id = webhook_id AND w.user_id = auth.uid()
    )
  );

-- Create function to clean up old webhook data
CREATE OR REPLACE FUNCTION cleanup_old_webhook_data()
RETURNS void AS $$
BEGIN
  -- Clean up old delivery logs (older than 30 days)
  DELETE FROM webhook_delivery_logs 
  WHERE attempted_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old successful deliveries (older than 7 days)
  DELETE FROM webhook_deliveries 
  WHERE delivery_status = 'delivered' 
    AND delivered_at < NOW() - INTERVAL '7 days';
  
  -- Clean up old events (older than 30 days)
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old rate limit records (older than 1 day)
  DELETE FROM webhook_rate_limits 
  WHERE day_bucket < CURRENT_DATE - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE webhooks IS 'Webhook configurations for real-time notifications';
COMMENT ON TABLE webhook_events IS 'Events generated by the system that can trigger webhooks';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery attempts and their status';
COMMENT ON TABLE webhook_delivery_logs IS 'Detailed logs of webhook delivery attempts';
COMMENT ON TABLE webhook_rate_limits IS 'Rate limiting data for webhook endpoints';
COMMENT ON TABLE webhook_subscriptions IS 'Fine-grained event subscriptions for webhooks';

COMMENT ON COLUMN webhooks.event_filters IS 'JSONB object containing filter conditions for events';
COMMENT ON COLUMN webhooks.auth_config IS 'Authentication configuration (API keys, tokens, etc.)';
COMMENT ON COLUMN webhooks.integration_config IS 'Platform-specific configuration (Slack channels, etc.)';
COMMENT ON COLUMN webhooks.payload_template IS 'Custom payload template for webhook requests';
COMMENT ON COLUMN webhooks.secret_key IS 'Secret key for HMAC signature generation';

COMMENT ON FUNCTION generate_webhook_signature(TEXT, TEXT) IS 'Generate HMAC-SHA256 signature for webhook payload verification';
COMMENT ON FUNCTION validate_webhook_event_filter(JSONB, JSONB) IS 'Validate if event data matches webhook filter conditions';
COMMENT ON FUNCTION get_webhooks_for_event(webhook_event_type, UUID, JSONB) IS 'Get all active webhooks that should receive a specific event';