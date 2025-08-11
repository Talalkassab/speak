-- =====================================================
-- Sample Data and Utility Functions
-- For development and testing purposes
-- =====================================================

-- =====================================================
-- LABOR LAW SAMPLE DATA (SHARED KNOWLEDGE BASE)
-- =====================================================

-- Insert Saudi Labor Law Categories
INSERT INTO labor_law_categories (name_ar, name_en, code, description_ar, description_en, sort_order) VALUES
('الأجور والرواتب', 'Wages and Salaries', 'WAGES', 'أحكام الأجور والرواتب والبدلات وطرق احتسابها', 'Provisions for wages, salaries, allowances and calculation methods', 1),
('إنهاء الخدمة', 'Employment Termination', 'TERMINATION', 'أحكام إنهاء عقد العمل والمكافآت والتعويضات', 'Employment contract termination, end-of-service benefits and compensations', 2),
('الإجازات', 'Leave and Holidays', 'LEAVE', 'أنواع الإجازات وأحكامها ومدتها وحقوق العامل', 'Types of leave, their provisions, duration and employee rights', 3),
('ساعات العمل', 'Working Hours', 'HOURS', 'تنظيم ساعات العمل والراحة والعمل الإضافي', 'Regulation of working hours, rest periods and overtime work', 4),
('السلامة المهنية', 'Occupational Safety', 'SAFETY', 'أحكام السلامة والصحة المهنية في بيئة العمل', 'Occupational health and safety provisions in the workplace', 5),
('التأمين الاجتماعي', 'Social Insurance', 'INSURANCE', 'أحكام التأمين الاجتماعي والضمان الاجتماعي', 'Social insurance and social security provisions', 6),
('عقود العمل', 'Employment Contracts', 'CONTRACTS', 'أنواع عقود العمل وشروطها وأحكامها', 'Types of employment contracts, their conditions and provisions', 7),
('حقوق المرأة العاملة', 'Working Women Rights', 'WOMEN', 'حقوق المرأة العاملة والأمومة والإجازات الخاصة', 'Working women rights, maternity and special leave provisions', 8),
('العمالة الأجنبية', 'Foreign Workers', 'FOREIGN', 'أحكام خاصة بالعمالة الأجنبية والإقامة والتأشيرات', 'Special provisions for foreign workers, residency and visas', 9),
('تسوية المنازعات', 'Dispute Resolution', 'DISPUTES', 'آليات تسوية منازعات العمل والجزاءات', 'Labor dispute resolution mechanisms and penalties', 10);

-- Insert Sample Labor Law Articles
INSERT INTO labor_law_articles (category_id, article_number, title_ar, title_en, content_ar, content_en, summary_ar, summary_en, keywords_ar, keywords_en, source_reference, effective_date) VALUES 

-- Wages Category Articles
((SELECT id FROM labor_law_categories WHERE code = 'WAGES'), 'المادة 90', 'استحقاق الأجر', 'Wage Entitlement', 'يستحق العامل أجره عن جميع أيام العمل الفعلية، وكذلك عن أيام الراحة الأسبوعية والإجازات الرسمية إذا تخللت فترة العمل أو جاءت عقبها، ما لم ينص في هذا النظام على غير ذلك.', 'The worker is entitled to wages for all actual working days, as well as for weekly rest days and official holidays that occur during or after the work period, unless otherwise stated in this system.', 'يستحق العامل الأجر عن أيام العمل والراحة والإجازات الرسمية', 'Worker entitled to wages for work days, rest days and official holidays', ARRAY['أجر', 'راتب', 'إجازة', 'راحة أسبوعية'], ARRAY['wage', 'salary', 'holiday', 'weekly rest'], 'نظام العمل السعودي - الباب السابع', '2005-04-23'),

((SELECT id FROM labor_law_categories WHERE code = 'WAGES'), 'المادة 91', 'موعد دفع الأجر', 'Wage Payment Schedule', 'يجب أن يدفع الأجر بالعملة الرسمية للمملكة، وفي مكان العمل، وفي موعد لا يتجاوز نهاية كل شهر ميلادي بالنسبة للعمال المعينين بأجور شهرية.', 'Wages must be paid in the official currency of the Kingdom, at the workplace, and no later than the end of each calendar month for workers employed on monthly wages.', 'يجب دفع الأجر بالريال السعودي في مكان العمل نهاية كل شهر', 'Wages must be paid in Saudi Riyal at workplace by end of each month', ARRAY['دفع الأجر', 'العملة الرسمية', 'مكان العمل', 'موعد الدفع'], ARRAY['wage payment', 'official currency', 'workplace', 'payment schedule'], 'نظام العمل السعودي - الباب السابع', '2005-04-23'),

-- Termination Category Articles
((SELECT id FROM labor_law_categories WHERE code = 'TERMINATION'), 'المادة 84', 'مكافأة نهاية الخدمة', 'End of Service Gratuity', 'يستحق العامل الذي أنهيت خدمته مكافأة عن مدة خدمته تحسب على أساس أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر عن كل سنة مما زاد على ذلك.', 'A worker whose service is terminated is entitled to a gratuity for the period of service calculated on the basis of half a month''s wage for each of the first five years, and one month''s wage for each additional year.', 'مكافأة نهاية الخدمة نصف شهر للسنوات الخمس الأولى وشهر كامل لما زاد', 'End of service gratuity: half month for first 5 years, full month for additional years', ARRAY['مكافأة نهاية الخدمة', 'إنهاء الخدمة', 'تعويض'], ARRAY['end of service gratuity', 'service termination', 'compensation'], 'نظام العمل السعودي - الباب السادس', '2005-04-23'),

-- Leave Category Articles
((SELECT id FROM labor_law_categories WHERE code = 'LEAVE'), 'المادة 109', 'الإجازة السنوية', 'Annual Leave', 'يستحق العامل إجازة سنوية لا تقل مدتها عن واحد وعشرين يوماً إذا أمضى في الخدمة سنة كاملة، تزاد إلى مدة لا تقل عن ثلاثين يوماً إذا أمضى في الخدمة خمس سنوات متصلة لدى صاحب عمل واحد.', 'The worker is entitled to annual leave of not less than twenty-one days after completing one full year of service, increased to not less than thirty days after completing five consecutive years of service with one employer.', 'الإجازة السنوية 21 يوم بعد سنة، و30 يوم بعد خمس سنوات', 'Annual leave: 21 days after one year, 30 days after five years', ARRAY['إجازة سنوية', 'إجازة مدفوعة الأجر', 'خدمة مستمرة'], ARRAY['annual leave', 'paid vacation', 'continuous service'], 'نظام العمل السعودي - الباب الثامن', '2005-04-23'),

-- Working Hours Category Articles
((SELECT id FROM labor_law_categories WHERE code = 'HOURS'), 'المادة 98', 'ساعات العمل اليومية', 'Daily Working Hours', 'ساعات العمل الفعلية للعمال ثماني ساعات يومياً، أو ثمان وأربعون ساعة أسبوعياً. وفي شهر رمضان المبارك تكون ساعات العمل الفعلية للعمال المسلمين ست ساعات يومياً أو ست وثلاثون ساعة أسبوعياً.', 'The actual working hours for workers are eight hours daily, or forty-eight hours weekly. In the holy month of Ramadan, the actual working hours for Muslim workers are six hours daily or thirty-six hours weekly.', 'ساعات العمل 8 ساعات يومياً أو 48 أسبوعياً، و6 ساعات في رمضان', 'Working hours: 8 hours daily or 48 weekly, 6 hours during Ramadan', ARRAY['ساعات العمل', 'الدوام الرسمي', 'شهر رمضان'], ARRAY['working hours', 'official hours', 'ramadan month'], 'نظام العمل السعودي - الباب السابع', '2005-04-23'),

-- Safety Category Articles
((SELECT id FROM labor_law_categories WHERE code = 'SAFETY'), 'المادة 123', 'توفير بيئة عمل آمنة', 'Providing Safe Work Environment', 'على صاحب العمل توفير وسائل السلامة والصحة المهنية في أماكن العمل، بما يكفل الوقاية من المخاطر المهنية، وحماية العمال من الإصابات والأمراض المهنية.', 'The employer must provide occupational safety and health measures in the workplace, ensuring protection from occupational hazards and protecting workers from injuries and occupational diseases.', 'على صاحب العمل توفير وسائل السلامة والصحة المهنية', 'Employer must provide occupational safety and health measures', ARRAY['السلامة المهنية', 'الصحة المهنية', 'بيئة العمل'], ARRAY['occupational safety', 'occupational health', 'work environment'], 'نظام العمل السعودي - الباب التاسع', '2005-04-23');

-- =====================================================
-- UTILITY FUNCTIONS FOR MULTI-TENANT OPERATIONS
-- =====================================================

-- Function to create a new organization with default setup
CREATE OR REPLACE FUNCTION create_organization(
    p_name TEXT,
    p_slug TEXT,
    p_owner_user_id UUID,
    p_domain TEXT DEFAULT NULL,
    p_subscription_tier TEXT DEFAULT 'basic'
)
RETURNS TABLE (
    organization_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_org_id UUID;
    v_category_id UUID;
BEGIN
    -- Validate inputs
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Organization name must be at least 2 characters';
        RETURN;
    END IF;
    
    IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Invalid slug format. Use lowercase letters, numbers, and hyphens only';
        RETURN;
    END IF;
    
    -- Check if slug already exists
    IF EXISTS (SELECT 1 FROM organizations WHERE slug = p_slug) THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Organization slug already exists';
        RETURN;
    END IF;
    
    BEGIN
        -- Create organization
        INSERT INTO organizations (name, slug, domain, subscription_tier)
        VALUES (p_name, p_slug, p_domain, p_subscription_tier)
        RETURNING id INTO v_org_id;
        
        -- Add owner to organization
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_owner_user_id, 'owner');
        
        -- Create default document categories
        PERFORM create_default_document_categories(v_org_id, p_owner_user_id);
        
        -- Initialize usage tracking
        INSERT INTO organization_usage (organization_id, period_start, period_end)
        VALUES (
            v_org_id, 
            date_trunc('month', CURRENT_DATE),
            (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date
        );
        
        RETURN QUERY SELECT v_org_id, true, 'Organization created successfully';
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Error creating organization: ' || SQLERRM;
    END;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to invite user to organization
CREATE OR REPLACE FUNCTION invite_user_to_organization(
    p_organization_id UUID,
    p_email TEXT,
    p_role TEXT,
    p_invited_by UUID
)
RETURNS TABLE (
    invitation_id UUID,
    invitation_token TEXT,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_invitation_id UUID;
    v_token TEXT;
BEGIN
    -- Validate role
    IF p_role NOT IN ('admin', 'hr_manager', 'hr_staff', 'viewer') THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'Invalid role specified';
        RETURN;
    END IF;
    
    -- Check if inviter has permission
    IF NOT user_has_role_in_org(p_organization_id, p_invited_by, ARRAY['owner', 'admin']) THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'Insufficient permissions to invite users';
        RETURN;
    END IF;
    
    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM organization_members om
        JOIN auth.users u ON u.id = om.user_id
        WHERE om.organization_id = p_organization_id 
        AND u.email = p_email
    ) THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'User is already a member of this organization';
        RETURN;
    END IF;
    
    -- Check if invitation already exists
    IF EXISTS (
        SELECT 1 FROM organization_invitations
        WHERE organization_id = p_organization_id 
        AND email = p_email
        AND expires_at > NOW()
    ) THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'Active invitation already exists for this email';
        RETURN;
    END IF;
    
    BEGIN
        -- Create invitation
        INSERT INTO organization_invitations (organization_id, email, role, invited_by)
        VALUES (p_organization_id, p_email, p_role, p_invited_by)
        RETURNING id, token INTO v_invitation_id, v_token;
        
        -- Log the invitation
        INSERT INTO user_activity_logs (organization_id, user_id, action, details)
        VALUES (
            p_organization_id,
            p_invited_by,
            'user_invited',
            json_build_object('email', p_email, 'role', p_role, 'invitation_id', v_invitation_id)
        );
        
        RETURN QUERY SELECT v_invitation_id, v_token, true, 'Invitation created successfully';
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'Error creating invitation: ' || SQLERRM;
    END;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to accept organization invitation
CREATE OR REPLACE FUNCTION accept_organization_invitation(
    p_token TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    organization_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
BEGIN
    -- Get user email
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
    
    IF v_user_email IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 'User not found';
        RETURN;
    END IF;
    
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM organization_invitations
    WHERE token = p_token
    AND email = v_user_email
    AND expires_at > NOW()
    AND accepted_at IS NULL;
    
    IF v_invitation IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Invalid or expired invitation';
        RETURN;
    END IF;
    
    BEGIN
        -- Add user to organization
        INSERT INTO organization_members (organization_id, user_id, role, invited_by)
        VALUES (v_invitation.organization_id, p_user_id, v_invitation.role, v_invitation.invited_by);
        
        -- Mark invitation as accepted
        UPDATE organization_invitations
        SET accepted_at = NOW()
        WHERE id = v_invitation.id;
        
        -- Log the acceptance
        INSERT INTO user_activity_logs (organization_id, user_id, action, details)
        VALUES (
            v_invitation.organization_id,
            p_user_id,
            'invitation_accepted',
            json_build_object('role', v_invitation.role, 'invitation_id', v_invitation.id)
        );
        
        RETURN QUERY SELECT v_invitation.organization_id, true, 'Invitation accepted successfully';
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Error accepting invitation: ' || SQLERRM;
    END;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to get organization statistics
CREATE OR REPLACE FUNCTION get_organization_stats(p_organization_id UUID)
RETURNS TABLE (
    stat_name TEXT,
    stat_value INTEGER,
    stat_description TEXT
) AS $$
BEGIN
    -- Check permissions
    IF NOT user_has_role_in_org(p_organization_id, auth.uid(), ARRAY['owner', 'admin', 'hr_manager']) THEN
        RETURN QUERY SELECT 'error'::TEXT, 0, 'Insufficient permissions';
        RETURN;
    END IF;
    
    -- Total members
    RETURN QUERY SELECT 
        'total_members',
        COUNT(*)::INTEGER,
        'Total active organization members'
    FROM organization_members 
    WHERE organization_id = p_organization_id AND is_active = true;
    
    -- Total documents
    RETURN QUERY SELECT 
        'total_documents',
        COUNT(*)::INTEGER,
        'Total documents in organization'
    FROM documents 
    WHERE organization_id = p_organization_id AND status = 'completed';
    
    -- Total conversations this month
    RETURN QUERY SELECT 
        'monthly_conversations',
        COUNT(*)::INTEGER,
        'Conversations started this month'
    FROM conversations 
    WHERE organization_id = p_organization_id 
    AND created_at >= date_trunc('month', CURRENT_DATE);
    
    -- Total messages this month
    RETURN QUERY SELECT 
        'monthly_messages',
        COUNT(*)::INTEGER,
        'Messages sent this month'
    FROM messages 
    WHERE organization_id = p_organization_id 
    AND created_at >= date_trunc('month', CURRENT_DATE);
    
    -- Storage used (in MB)
    RETURN QUERY SELECT 
        'storage_used_mb',
        COALESCE(SUM(file_size)::BIGINT / 1024 / 1024, 0)::INTEGER,
        'Total storage used in megabytes'
    FROM documents 
    WHERE organization_id = p_organization_id AND status = 'completed';
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM organization_invitations 
    WHERE expires_at < NOW() AND accepted_at IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to update organization usage statistics
CREATE OR REPLACE FUNCTION update_organization_usage_stats()
RETURNS VOID AS $$
DECLARE
    org_record RECORD;
    current_period_start DATE;
    current_period_end DATE;
BEGIN
    current_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    current_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
    
    -- Update stats for each organization
    FOR org_record IN SELECT id FROM organizations WHERE is_active = true LOOP
        INSERT INTO organization_usage (
            organization_id,
            period_start,
            period_end,
            users_count,
            documents_count,
            conversations_count,
            messages_count,
            storage_used_gb
        )
        SELECT 
            org_record.id,
            current_period_start,
            current_period_end,
            (SELECT COUNT(*) FROM organization_members WHERE organization_id = org_record.id AND is_active = true),
            (SELECT COUNT(*) FROM documents WHERE organization_id = org_record.id AND status = 'completed'),
            (SELECT COUNT(*) FROM conversations WHERE organization_id = org_record.id AND created_at >= current_period_start),
            (SELECT COUNT(*) FROM messages WHERE organization_id = org_record.id AND created_at >= current_period_start),
            (SELECT COALESCE(SUM(file_size), 0) / 1024.0 / 1024.0 / 1024.0 FROM documents WHERE organization_id = org_record.id AND status = 'completed')
        ON CONFLICT (organization_id, period_start) 
        DO UPDATE SET
            users_count = EXCLUDED.users_count,
            documents_count = EXCLUDED.documents_count,
            conversations_count = EXCLUDED.conversations_count,
            messages_count = EXCLUDED.messages_count,
            storage_used_gb = EXCLUDED.storage_used_gb;
    END LOOP;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =====================================================
-- SAMPLE DEVELOPMENT DATA (USE CAREFULLY)
-- =====================================================

-- Function to create sample development organization
CREATE OR REPLACE FUNCTION create_sample_dev_organization(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    organization_id UUID,
    admin_user_id UUID,
    success BOOLEAN,
    details TEXT
) AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_doc_id UUID;
    v_category_id UUID;
BEGIN
    -- Use provided user_id or create a placeholder
    v_user_id := COALESCE(p_user_id, gen_random_uuid());
    
    -- Create sample organization
    SELECT org_id, success, message INTO v_org_id, success, details
    FROM create_organization(
        'شركة التطوير للموارد البشرية',
        'dev-hr-company',
        v_user_id,
        'dev.hrrag.com',
        'professional'
    );
    
    IF NOT success THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, details;
        RETURN;
    END IF;
    
    -- Add some sample members
    INSERT INTO organization_members (organization_id, user_id, role) VALUES
    (v_org_id, gen_random_uuid(), 'hr_manager'),
    (v_org_id, gen_random_uuid(), 'hr_staff'),
    (v_org_id, gen_random_uuid(), 'viewer');
    
    -- Get a sample category
    SELECT id INTO v_category_id 
    FROM document_categories 
    WHERE organization_id = v_org_id 
    LIMIT 1;
    
    -- Create sample documents
    INSERT INTO documents (
        organization_id, category_id, title, filename, file_size, file_type, 
        mime_type, content, uploaded_by, is_public, status
    ) VALUES 
    (v_org_id, v_category_id, 'دليل الموظف الجديد', 'employee-handbook.pdf', 2048000, 'pdf', 'application/pdf', 
     'هذا دليل شامل للموظف الجديد يحتوي على جميع السياسات والإجراءات المطلوبة للعمل في الشركة...', 
     v_user_id, true, 'completed'),
    (v_org_id, v_category_id, 'سياسة الإجازات', 'leave-policy.pdf', 1024000, 'pdf', 'application/pdf',
     'تحدد هذه الوثيقة سياسة الشركة فيما يتعلق بأنواع الإجازات المختلفة وآليات طلبها...', 
     v_user_id, true, 'completed'),
    (v_org_id, v_category_id, 'إجراءات الرواتب والمزايا', 'payroll-procedures.pdf', 1536000, 'pdf', 'application/pdf',
     'تفصل هذه الوثيقة إجراءات احتساب الرواتب والمزايا والبدلات المختلفة...', 
     v_user_id, false, 'completed');
    
    RETURN QUERY SELECT v_org_id, v_user_id, true, 'Sample organization created successfully';
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, 'Error creating sample organization: ' || SQLERRM;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- =====================================================
-- MAINTENANCE AND CLEANUP FUNCTIONS
-- =====================================================

-- Function to archive old conversations
CREATE OR REPLACE FUNCTION archive_old_conversations(p_months_old INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE conversations 
    SET is_archived = true
    WHERE created_at < (CURRENT_DATE - INTERVAL '1 month' * p_months_old)
    AND is_archived = false;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to cleanup old activity logs
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_activity_logs 
    WHERE created_at < (CURRENT_DATE - INTERVAL '1 day' * p_days_old);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to generate organization health report
CREATE OR REPLACE FUNCTION generate_org_health_report(p_organization_id UUID)
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    status TEXT,
    recommendation TEXT
) AS $$
DECLARE
    active_users INTEGER;
    total_documents INTEGER;
    monthly_conversations INTEGER;
    storage_gb NUMERIC;
    avg_response_time NUMERIC;
BEGIN
    -- Check permissions
    IF NOT user_has_role_in_org(p_organization_id, auth.uid(), ARRAY['owner', 'admin']) THEN
        RETURN QUERY SELECT 'error'::TEXT, 0::NUMERIC, 'denied', 'Insufficient permissions';
        RETURN;
    END IF;
    
    -- Get metrics
    SELECT COUNT(*) INTO active_users
    FROM organization_members 
    WHERE organization_id = p_organization_id AND is_active = true;
    
    SELECT COUNT(*) INTO total_documents
    FROM documents 
    WHERE organization_id = p_organization_id AND status = 'completed';
    
    SELECT COUNT(*) INTO monthly_conversations
    FROM conversations 
    WHERE organization_id = p_organization_id 
    AND created_at >= date_trunc('month', CURRENT_DATE);
    
    SELECT COALESCE(SUM(file_size), 0) / 1024.0 / 1024.0 / 1024.0 INTO storage_gb
    FROM documents 
    WHERE organization_id = p_organization_id AND status = 'completed';
    
    SELECT COALESCE(AVG(response_time_ms), 0) INTO avg_response_time
    FROM messages 
    WHERE organization_id = p_organization_id 
    AND response_time_ms IS NOT NULL
    AND created_at >= (CURRENT_DATE - INTERVAL '30 days');
    
    -- Return metrics with health status
    RETURN QUERY SELECT 
        'active_users',
        active_users::NUMERIC,
        CASE WHEN active_users > 5 THEN 'healthy' WHEN active_users > 1 THEN 'moderate' ELSE 'low' END,
        CASE WHEN active_users <= 1 THEN 'Consider inviting more team members' ELSE 'User engagement looks good' END;
        
    RETURN QUERY SELECT 
        'total_documents',
        total_documents::NUMERIC,
        CASE WHEN total_documents > 10 THEN 'healthy' WHEN total_documents > 2 THEN 'moderate' ELSE 'low' END,
        CASE WHEN total_documents <= 2 THEN 'Upload more documents to improve AI responses' ELSE 'Good document coverage' END;
        
    RETURN QUERY SELECT 
        'monthly_conversations',
        monthly_conversations::NUMERIC,
        CASE WHEN monthly_conversations > 20 THEN 'healthy' WHEN monthly_conversations > 5 THEN 'moderate' ELSE 'low' END,
        CASE WHEN monthly_conversations <= 5 THEN 'Encourage team to use AI assistant more' ELSE 'Good AI assistant usage' END;
        
    RETURN QUERY SELECT 
        'storage_gb',
        storage_gb,
        CASE WHEN storage_gb > 4 THEN 'warning' WHEN storage_gb > 2 THEN 'moderate' ELSE 'healthy' END,
        CASE WHEN storage_gb > 4 THEN 'Consider upgrading storage plan' ELSE 'Storage usage within limits' END;
        
    RETURN QUERY SELECT 
        'avg_response_time_ms',
        avg_response_time,
        CASE WHEN avg_response_time > 5000 THEN 'warning' WHEN avg_response_time > 2000 THEN 'moderate' ELSE 'healthy' END,
        CASE WHEN avg_response_time > 5000 THEN 'Response times are slow, check system performance' ELSE 'Response times are acceptable' END;
END;
$$ language 'plpgsql' SECURITY DEFINER;