-- Additional tables needed for the RAG API system

-- Conversations table for chat functionality
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  language TEXT CHECK (language IN ('ar', 'en')) DEFAULT 'ar',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('active', 'archived', 'deleted')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for conversation messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  language TEXT CHECK (language IN ('ar', 'en')) DEFAULT 'ar',
  sources JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HR Templates table for template management
CREATE TABLE IF NOT EXISTS hr_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for system templates
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('employment', 'hr_policies', 'compliance', 'forms', 'letters')) NOT NULL,
  language TEXT CHECK (language IN ('ar', 'en')) DEFAULT 'ar',
  template_content TEXT NOT NULL,
  required_fields JSONB DEFAULT '[]',
  compliance_rules JSONB DEFAULT '[]',
  compliance_status TEXT CHECK (compliance_status IN ('compliant', 'warning', 'non_compliant')) DEFAULT 'compliant',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template generations table for tracking generated documents
CREATE TABLE IF NOT EXISTS template_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES hr_templates(id) ON DELETE CASCADE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  parameters_used JSONB NOT NULL,
  generated_content TEXT NOT NULL,
  file_format TEXT CHECK (file_format IN ('pdf', 'docx', 'html')) DEFAULT 'pdf',
  file_size_bytes BIGINT,
  download_url TEXT,
  preview_url TEXT,
  compliance_status JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  downloaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance scans table for audit trail
CREATE TABLE IF NOT EXISTS compliance_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  categories_scanned TEXT[] NOT NULL,
  issues_found INTEGER DEFAULT 0,
  overall_score NUMERIC(5,2),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  scan_metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity logs for audit trail
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization usage table for tracking usage metrics
CREATE TABLE IF NOT EXISTS organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  messages_count INTEGER DEFAULT 0,
  documents_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used_gb NUMERIC(10,2) DEFAULT 0,
  templates_generated INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, period_start)
);

-- Create indexes for performance
CREATE INDEX idx_conversations_organization_id ON conversations(organization_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_organization_id ON messages(organization_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_hr_templates_organization_id ON hr_templates(organization_id);
CREATE INDEX idx_hr_templates_category ON hr_templates(category);
CREATE INDEX idx_hr_templates_language ON hr_templates(language);
CREATE INDEX idx_hr_templates_is_active ON hr_templates(is_active);

CREATE INDEX idx_template_generations_organization_id ON template_generations(organization_id);
CREATE INDEX idx_template_generations_template_id ON template_generations(template_id);
CREATE INDEX idx_template_generations_generated_by ON template_generations(generated_by);
CREATE INDEX idx_template_generations_created_at ON template_generations(created_at);

CREATE INDEX idx_compliance_scans_organization_id ON compliance_scans(organization_id);
CREATE INDEX idx_compliance_scans_created_at ON compliance_scans(created_at);

CREATE INDEX idx_user_activity_logs_organization_id ON user_activity_logs(organization_id);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);

CREATE INDEX idx_organization_usage_organization_id ON organization_usage(organization_id);
CREATE INDEX idx_organization_usage_period ON organization_usage(period_start, period_end);

-- Enable RLS on new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Organization members can view conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = conversations.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization members can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = conversations.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for messages
CREATE POLICY "Organization members can view messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = messages.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization members can create messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = messages.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

-- RLS Policies for hr_templates
CREATE POLICY "Templates are viewable by organization members" ON hr_templates
  FOR SELECT USING (
    organization_id IS NULL OR -- System templates
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = hr_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can manage templates" ON hr_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = hr_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

-- RLS Policies for template_generations
CREATE POLICY "Organization members can view template generations" ON template_generations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_generations.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization members can create template generations" ON template_generations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_generations.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    ) AND generated_by = auth.uid()
  );

-- RLS Policies for compliance_scans
CREATE POLICY "HR managers can view compliance scans" ON compliance_scans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = compliance_scans.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager')
      AND om.is_active = true
    )
  );

CREATE POLICY "HR managers can create compliance scans" ON compliance_scans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = compliance_scans.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager')
      AND om.is_active = true
    ) AND initiated_by = auth.uid()
  );

-- RLS Policies for user_activity_logs (read-only for security)
CREATE POLICY "Organization admins can view activity logs" ON user_activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = user_activity_logs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
    )
  );

-- RLS Policies for organization_usage
CREATE POLICY "Organization admins can view usage data" ON organization_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_usage.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager')
      AND om.is_active = true
    )
  );

-- Functions and triggers for updated_at columns
CREATE TRIGGER update_conversations_updated_at 
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hr_templates_updated_at 
  BEFORE UPDATE ON hr_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_usage_updated_at 
  BEFORE UPDATE ON organization_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE hr_templates 
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check vector extension (for health checks)
CREATE OR REPLACE FUNCTION check_vector_extension()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some system templates for Saudi Arabian HR
INSERT INTO hr_templates (id, name, description, category, language, template_content, required_fields, compliance_rules, created_by) VALUES
(
  gen_random_uuid(),
  'عقد عمل محدد المدة',
  'نموذج عقد عمل محدد المدة متوافق مع نظام العمل السعودي',
  'employment',
  'ar',
  'بسم الله الرحمن الرحيم

عقد عمل محدد المدة

بين:
الطرف الأول: {{organization_name}}
والطرف الثاني: {{employee_name}}

المادة الأولى: طبيعة العمل
يتعهد الطرف الثاني بالعمل لدى الطرف الأول في وظيفة {{job_title}} بقسم {{department}}.

المادة الثانية: مدة العقد
مدة هذا العقد {{contract_duration}} شهر، تبدأ من تاريخ {{start_date}}.

المادة الثالثة: فترة التجربة
فترة التجربة {{probation_period}} يوماً من تاريخ بدء العمل.

المادة الرابعة: الراتب والمزايا
الراتب الأساسي: {{basic_salary}} ريال سعودي شهرياً
بدل السكن: {{housing_allowance}} ريال سعودي شهرياً
بدل المواصلات: {{transport_allowance}} ريال سعودي شهرياً

المادة الخامسة: ساعات العمل
ساعات العمل اليومية: {{daily_hours}} ساعات
أيام العمل الأسبوعية: {{working_days}} أيام

تم توقيع هذا العقد في تاريخ {{current_date}}

توقيع الطرف الأول: ________________
توقيع الطرف الثاني: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "اسم الموظف"},
    {"name": "job_title", "type": "text", "required": true, "label": "المسمى الوظيفي"},
    {"name": "department", "type": "text", "required": true, "label": "القسم"},
    {"name": "contract_duration", "type": "number", "required": true, "label": "مدة العقد (بالأشهر)", "validation": {"min": 1, "max": 12}},
    {"name": "start_date", "type": "date", "required": true, "label": "تاريخ بدء العمل"},
    {"name": "probation_period", "type": "number", "required": true, "label": "فترة التجربة (بالأيام)", "validation": {"min": 0, "max": 90}},
    {"name": "basic_salary", "type": "number", "required": true, "label": "الراتب الأساسي"},
    {"name": "housing_allowance", "type": "number", "required": false, "label": "بدل السكن"},
    {"name": "transport_allowance", "type": "number", "required": false, "label": "بدل المواصلات"},
    {"name": "daily_hours", "type": "number", "required": true, "label": "ساعات العمل اليومية", "validation": {"min": 1, "max": 8}},
    {"name": "working_days", "type": "number", "required": true, "label": "أيام العمل الأسبوعية", "validation": {"min": 1, "max": 6}}
  ]',
  '[
    {"ruleId": "probation_limit", "description": "فترة التجربة لا تتجاوز 90 يوماً", "severity": "error", "laborLawReference": "المادة 53 - نظام العمل السعودي"},
    {"ruleId": "working_hours_limit", "description": "ساعات العمل اليومية لا تتجاوز 8 ساعات", "severity": "error", "laborLawReference": "المادة 98 - نظام العمل السعودي"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  gen_random_uuid(),
  'Fixed-term Employment Contract',
  'Fixed-term employment contract template compliant with Saudi Labor Law',
  'employment',
  'en',
  'FIXED-TERM EMPLOYMENT CONTRACT

Between:
First Party: {{organization_name}}
Second Party: {{employee_name}}

Article 1: Nature of Work
The Second Party agrees to work for the First Party in the position of {{job_title}} in {{department}} department.

Article 2: Contract Duration
The duration of this contract is {{contract_duration}} months, starting from {{start_date}}.

Article 3: Probation Period
The probation period is {{probation_period}} days from the start date of employment.

Article 4: Salary and Benefits
Basic Salary: {{basic_salary}} Saudi Riyals per month
Housing Allowance: {{housing_allowance}} Saudi Riyals per month
Transportation Allowance: {{transport_allowance}} Saudi Riyals per month

Article 5: Working Hours
Daily working hours: {{daily_hours}} hours
Weekly working days: {{working_days}} days

This contract was signed on {{current_date}}

First Party Signature: ________________
Second Party Signature: ________________',
  '[
    {"name": "employee_name", "type": "text", "required": true, "label": "Employee Name"},
    {"name": "job_title", "type": "text", "required": true, "label": "Job Title"},
    {"name": "department", "type": "text", "required": true, "label": "Department"},
    {"name": "contract_duration", "type": "number", "required": true, "label": "Contract Duration (months)", "validation": {"min": 1, "max": 12}},
    {"name": "start_date", "type": "date", "required": true, "label": "Start Date"},
    {"name": "probation_period", "type": "number", "required": true, "label": "Probation Period (days)", "validation": {"min": 0, "max": 90}},
    {"name": "basic_salary", "type": "number", "required": true, "label": "Basic Salary"},
    {"name": "housing_allowance", "type": "number", "required": false, "label": "Housing Allowance"},
    {"name": "transport_allowance", "type": "number", "required": false, "label": "Transportation Allowance"},
    {"name": "daily_hours", "type": "number", "required": true, "label": "Daily Working Hours", "validation": {"min": 1, "max": 8}},
    {"name": "working_days", "type": "number", "required": true, "label": "Weekly Working Days", "validation": {"min": 1, "max": 6}}
  ]',
  '[
    {"ruleId": "probation_limit", "description": "Probation period must not exceed 90 days", "severity": "error", "laborLawReference": "Article 53 - Saudi Labor Law"},
    {"ruleId": "working_hours_limit", "description": "Daily working hours must not exceed 8 hours", "severity": "error", "laborLawReference": "Article 98 - Saudi Labor Law"}
  ]',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Create function to execute SQL for health checks (restricted)
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  -- Only allow safe SELECT queries for health checks
  IF sql ~ '^SELECT\s+(1|COUNT\(\*\))' THEN
    EXECUTE sql;
  ELSE
    RAISE EXCEPTION 'Unauthorized SQL command';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;