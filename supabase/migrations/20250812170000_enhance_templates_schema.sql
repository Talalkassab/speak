-- Enhance template system with additional features
-- Template categories table for better organization
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon_name TEXT,
  color_hex TEXT DEFAULT '#3B82F6',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template versions table for versioning and approval workflow
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES hr_templates(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  template_content TEXT NOT NULL,
  required_fields JSONB DEFAULT '[]',
  compliance_rules JSONB DEFAULT '[]',
  change_summary TEXT,
  change_summary_ar TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_status TEXT CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'draft',
  rejection_reason TEXT,
  rejection_reason_ar TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, version_number)
);

-- Template usage history for analytics
CREATE TABLE IF NOT EXISTS template_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES hr_templates(id) ON DELETE CASCADE NOT NULL,
  template_version_id UUID REFERENCES template_versions(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  parameters_used JSONB NOT NULL,
  generation_successful BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  processing_time_ms INTEGER,
  file_format TEXT CHECK (file_format IN ('pdf', 'docx', 'html')) DEFAULT 'pdf',
  file_size_bytes BIGINT,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template approvals workflow
CREATE TABLE IF NOT EXISTS template_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID REFERENCES template_versions(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_level INTEGER DEFAULT 1, -- Multi-level approval support
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')) DEFAULT 'pending',
  decision_reason TEXT,
  decision_reason_ar TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add version support to existing hr_templates table
ALTER TABLE hr_templates ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES template_versions(id);
ALTER TABLE hr_templates ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES template_categories(id);
ALTER TABLE hr_templates ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_templates ADD COLUMN IF NOT EXISTS approval_workflow JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_categories_code ON template_categories(code);
CREATE INDEX IF NOT EXISTS idx_template_categories_is_active ON template_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_template_categories_sort_order ON template_categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version_number ON template_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_approval_status ON template_versions(approval_status);
CREATE INDEX IF NOT EXISTS idx_template_versions_is_active ON template_versions(is_active);

CREATE INDEX IF NOT EXISTS idx_template_usage_history_template_id ON template_usage_history(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_history_organization_id ON template_usage_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_history_created_at ON template_usage_history(created_at);

CREATE INDEX IF NOT EXISTS idx_template_approvals_template_version_id ON template_approvals(template_version_id);
CREATE INDEX IF NOT EXISTS idx_template_approvals_organization_id ON template_approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_approvals_status ON template_approvals(status);
CREATE INDEX IF NOT EXISTS idx_template_approvals_assigned_to ON template_approvals(assigned_to);

-- Enable RLS on new tables
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_categories (public read)
CREATE POLICY "Everyone can view template categories" ON template_categories
  FOR SELECT USING (is_active = true);

-- RLS Policies for template_versions
CREATE POLICY "Organization members can view template versions" ON template_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hr_templates ht
      JOIN organization_members om ON (
        ht.organization_id = om.organization_id OR ht.organization_id IS NULL
      )
      WHERE ht.id = template_versions.template_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can manage template versions" ON template_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hr_templates ht
      JOIN organization_members om ON ht.organization_id = om.organization_id
      WHERE ht.id = template_versions.template_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
      AND om.is_active = true
    )
  );

-- RLS Policies for template_usage_history
CREATE POLICY "Organization members can view usage history" ON template_usage_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_usage_history.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Organization members can create usage history" ON template_usage_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_usage_history.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    ) AND used_by = auth.uid()
  );

-- RLS Policies for template_approvals
CREATE POLICY "Organization members can view template approvals" ON template_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_approvals.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "HR staff can manage template approvals" ON template_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = template_approvals.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'hr_manager')
      AND om.is_active = true
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_template_categories_updated_at 
  BEFORE UPDATE ON template_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_approvals_updated_at 
  BEFORE UPDATE ON template_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default template categories
INSERT INTO template_categories (code, name_ar, name_en, description_ar, description_en, icon_name, color_hex, sort_order) VALUES
('EMPLOYMENT_CONTRACTS', 'عقود العمل', 'Employment Contracts', 'عقود التوظيف والعمل المختلفة', 'Various employment and work contracts', 'FileContract', '#10B981', 1),
('HR_POLICIES', 'سياسات الموارد البشرية', 'HR Policies', 'سياسات وإجراءات إدارة الموارد البشرية', 'Human resources policies and procedures', 'Shield', '#6366F1', 2),
('TERMINATION_DOCS', 'وثائق إنهاء الخدمة', 'Termination Documents', 'خطابات وإجراءات إنهاء الخدمة', 'Service termination letters and procedures', 'FileX', '#EF4444', 3),
('LEAVE_FORMS', 'نماذج الإجازات', 'Leave Forms', 'نماذج طلبات الإجازات المختلفة', 'Various leave request forms', 'Calendar', '#F59E0B', 4),
('CERTIFICATES', 'الشهادات', 'Certificates', 'شهادات الراتب والخدمة والخبرة', 'Salary, service and experience certificates', 'Award', '#8B5CF6', 5),
('WARNING_LETTERS', 'خطابات التحذير', 'Warning Letters', 'خطابات التحذير والإنذار التأديبي', 'Warning and disciplinary letters', 'AlertTriangle', '#F97316', 6),
('PERFORMANCE_DOCS', 'وثائق الأداء', 'Performance Documents', 'تقييمات الأداء ونماذج التطوير', 'Performance evaluations and development forms', 'TrendingUp', '#06B6D4', 7),
('COMPLIANCE_FORMS', 'نماذج الامتثال', 'Compliance Forms', 'نماذج ووثائق الامتثال التنظيمي', 'Regulatory compliance forms and documents', 'CheckCircle', '#84CC16', 8)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  updated_at = NOW();

-- Function to create new template version
CREATE OR REPLACE FUNCTION create_template_version(
  p_template_id UUID,
  p_template_content TEXT,
  p_required_fields JSONB DEFAULT '[]',
  p_compliance_rules JSONB DEFAULT '[]',
  p_change_summary TEXT DEFAULT NULL,
  p_change_summary_ar TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number
  FROM template_versions 
  WHERE template_id = p_template_id;
  
  -- Create new version
  INSERT INTO template_versions (
    template_id, version_number, template_content, required_fields, 
    compliance_rules, change_summary, change_summary_ar, created_by
  ) VALUES (
    p_template_id, v_version_number, p_template_content, p_required_fields,
    p_compliance_rules, p_change_summary, p_change_summary_ar, p_created_by
  ) RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve template version
CREATE OR REPLACE FUNCTION approve_template_version(
  p_version_id UUID,
  p_approved_by UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_template_id UUID;
BEGIN
  -- Update version status
  UPDATE template_versions 
  SET 
    approval_status = 'approved',
    approved_by = p_approved_by,
    approved_at = NOW(),
    is_active = TRUE
  WHERE id = p_version_id
  RETURNING template_id INTO v_template_id;
  
  -- Deactivate other versions
  UPDATE template_versions 
  SET is_active = FALSE
  WHERE template_id = v_template_id AND id != p_version_id;
  
  -- Update current version in template
  UPDATE hr_templates 
  SET current_version_id = p_version_id
  WHERE id = v_template_id;
  
  -- Update approval records
  UPDATE template_approvals 
  SET 
    status = 'approved',
    decided_by = p_approved_by,
    decided_at = NOW()
  WHERE template_version_id = p_version_id AND status = 'pending';
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track template usage
CREATE OR REPLACE FUNCTION track_template_usage(
  p_template_id UUID,
  p_parameters JSONB,
  p_format TEXT DEFAULT 'pdf',
  p_file_size BIGINT DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL,
  p_processing_time INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
  v_org_id UUID;
  v_version_id UUID;
BEGIN
  -- Get organization ID and current version
  SELECT 
    COALESCE(ht.organization_id, (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true LIMIT 1
    )),
    ht.current_version_id
  INTO v_org_id, v_version_id
  FROM hr_templates ht
  WHERE ht.id = p_template_id;
  
  -- Create usage record
  INSERT INTO template_usage_history (
    template_id, template_version_id, organization_id, used_by,
    parameters_used, generation_successful, error_message,
    processing_time_ms, file_format, file_size_bytes
  ) VALUES (
    p_template_id, v_version_id, v_org_id, auth.uid(),
    p_parameters, p_success, p_error_message,
    p_processing_time, p_format, p_file_size
  ) RETURNING id INTO v_usage_id;
  
  -- Update template usage count
  UPDATE hr_templates 
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = p_template_id;
  
  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add template content validation function
CREATE OR REPLACE FUNCTION validate_template_content(
  p_content TEXT,
  p_required_fields JSONB
)
RETURNS TABLE(valid BOOLEAN, issues TEXT[]) AS $$
DECLARE
  v_issues TEXT[] := '{}';
  v_field JSONB;
  v_placeholder TEXT;
  v_found_placeholders TEXT[];
  v_required_placeholders TEXT[];
BEGIN
  -- Extract all placeholders from content
  SELECT array_agg(matches[1])
  INTO v_found_placeholders
  FROM regexp_matches(p_content, '\{\{(\w+)\}\}', 'g') AS matches;
  
  -- Get required field names
  SELECT array_agg(field->>'name')
  INTO v_required_placeholders
  FROM jsonb_array_elements(p_required_fields) AS field
  WHERE (field->>'required')::boolean = true;
  
  -- Check for missing required placeholders
  IF v_required_placeholders IS NOT NULL THEN
    FOR i IN 1..array_length(v_required_placeholders, 1) LOOP
      IF NOT (v_required_placeholders[i] = ANY(COALESCE(v_found_placeholders, '{}'))) THEN
        v_issues := array_append(v_issues, 'Missing placeholder for required field: ' || v_required_placeholders[i]);
      END IF;
    END LOOP;
  END IF;
  
  -- Check for orphaned placeholders (not in required fields)
  IF v_found_placeholders IS NOT NULL THEN
    SELECT array_agg(field->>'name')
    INTO v_required_placeholders  -- reuse for all fields
    FROM jsonb_array_elements(p_required_fields) AS field;
    
    FOR i IN 1..array_length(v_found_placeholders, 1) LOOP
      IF NOT (v_found_placeholders[i] = ANY(COALESCE(v_required_placeholders, '{}'))) THEN
        v_issues := array_append(v_issues, 'Unmatched placeholder: {{' || v_found_placeholders[i] || '}}');
      END IF;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT (array_length(v_issues, 1) IS NULL), v_issues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;