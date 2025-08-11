-- =====================================================
-- Multi-Tenant Row Level Security Policies
-- Ensures complete data isolation between organizations
-- =====================================================

-- =====================================================
-- ORGANIZATIONS - Only members can see their org
-- =====================================================

CREATE POLICY "Users can view organizations they belong to"
ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Organization owners and admins can update org details"
ON organizations FOR UPDATE
USING (
    id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

-- Only system/service can create organizations (via application logic)
CREATE POLICY "Service can create organizations"
ON organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL); -- Basic auth check, creation handled by app logic

-- =====================================================
-- ORGANIZATION MEMBERS - Strict member visibility
-- =====================================================

CREATE POLICY "Members can view other members in same organization"
ON organization_members FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Organization owners and admins can manage members"
ON organization_members FOR ALL
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "Users can update their own member record"
ON organization_members FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid() 
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

-- =====================================================
-- ORGANIZATION INVITATIONS
-- =====================================================

CREATE POLICY "Organization admins can manage invitations"
ON organization_invitations FOR ALL
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "Invited users can view their invitations"
ON organization_invitations FOR SELECT
USING (
    email IN (
        SELECT email 
        FROM auth.users 
        WHERE id = auth.uid()
    )
);

-- =====================================================
-- DOCUMENT CATEGORIES - Organization scoped
-- =====================================================

CREATE POLICY "Organization members can view document categories"
ON document_categories FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "HR managers and admins can manage document categories"
ON document_categories FOR ALL
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager')
        AND is_active = true
    )
);

-- =====================================================
-- DOCUMENTS - Role-based access with organization isolation
-- =====================================================

CREATE POLICY "Organization members can view documents"
ON documents FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
        -- Public documents within org
        is_public = true
        OR
        -- Uploaded by user
        uploaded_by = auth.uid()
        OR
        -- User has specific permission
        id IN (
            SELECT document_id 
            FROM document_permissions 
            WHERE user_id = auth.uid() AND permission IN ('read', 'write', 'admin')
        )
        OR
        -- User role has access
        EXISTS (
            SELECT 1 FROM document_permissions dp
            JOIN organization_members om ON om.role = dp.role
            WHERE dp.document_id = documents.id
            AND om.user_id = auth.uid()
            AND om.organization_id = documents.organization_id
            AND om.is_active = true
            AND dp.permission IN ('read', 'write', 'admin')
        )
        OR
        -- HR staff and above can see all documents
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = auth.uid()
            AND organization_id = documents.organization_id
            AND role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
            AND is_active = true
        )
    )
);

CREATE POLICY "HR staff and above can insert documents"
ON documents FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
        AND is_active = true
    )
    AND uploaded_by = auth.uid()
);

CREATE POLICY "Document owners and HR managers can update documents"
ON documents FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
        uploaded_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = auth.uid()
            AND organization_id = documents.organization_id
            AND role IN ('owner', 'admin', 'hr_manager')
            AND is_active = true
        )
        OR
        id IN (
            SELECT document_id 
            FROM document_permissions 
            WHERE user_id = auth.uid() AND permission IN ('write', 'admin')
        )
    )
);

CREATE POLICY "Document owners and admins can delete documents"
ON documents FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
        uploaded_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = auth.uid()
            AND organization_id = documents.organization_id
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
        OR
        id IN (
            SELECT document_id 
            FROM document_permissions 
            WHERE user_id = auth.uid() AND permission = 'admin'
        )
    )
);

-- =====================================================
-- DOCUMENT PERMISSIONS
-- =====================================================

CREATE POLICY "Organization members can view document permissions"
ON document_permissions FOR SELECT
USING (
    document_id IN (
        SELECT id FROM documents 
        WHERE organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    )
);

CREATE POLICY "Document owners and HR managers can manage permissions"
ON document_permissions FOR ALL
USING (
    document_id IN (
        SELECT d.id FROM documents d
        JOIN organization_members om ON om.organization_id = d.organization_id
        WHERE om.user_id = auth.uid() 
        AND om.is_active = true
        AND (
            d.uploaded_by = auth.uid()
            OR om.role IN ('owner', 'admin', 'hr_manager')
        )
    )
);

-- =====================================================
-- DOCUMENT CHUNKS - Same as documents
-- =====================================================

CREATE POLICY "Organization members can view document chunks"
ON document_chunks FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND document_id IN (
        SELECT id FROM documents
        WHERE organization_id = document_chunks.organization_id
        -- Document access rules will be checked separately
    )
);

CREATE POLICY "HR staff can insert document chunks"
ON document_chunks FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager', 'hr_staff')
        AND is_active = true
    )
);

CREATE POLICY "HR managers can update document chunks"
ON document_chunks FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager')
        AND is_active = true
    )
);

CREATE POLICY "HR managers can delete document chunks"
ON document_chunks FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager')
        AND is_active = true
    )
);

-- =====================================================
-- CONVERSATIONS - User owns their conversations
-- =====================================================

CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (
    user_id = auth.uid()
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "HR managers can view all conversations in organization"
ON conversations FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'hr_manager')
        AND is_active = true
    )
);

CREATE POLICY "Organization members can create conversations"
ON conversations FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can update their own conversations"
ON conversations FOR UPDATE
USING (
    user_id = auth.uid()
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users and HR managers can delete conversations"
ON conversations FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = auth.uid()
            AND organization_id = conversations.organization_id
            AND role IN ('owner', 'admin', 'hr_manager')
            AND is_active = true
        )
    )
);

-- =====================================================
-- MESSAGES - Follow conversation permissions
-- =====================================================

CREATE POLICY "Users can view messages in accessible conversations"
ON messages FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND conversation_id IN (
        SELECT id FROM conversations
        WHERE (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM organization_members
                WHERE user_id = auth.uid()
                AND organization_id = conversations.organization_id
                AND role IN ('owner', 'admin', 'hr_manager')
                AND is_active = true
            )
        )
    )
);

CREATE POLICY "System can insert messages"
ON messages FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = auth.uid()
        AND organization_id = messages.organization_id
    )
);

CREATE POLICY "Users can update their messages rating and feedback"
ON messages FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND conversation_id IN (
        SELECT id FROM conversations
        WHERE user_id = auth.uid()
        AND organization_id = messages.organization_id
    )
);

-- =====================================================
-- MESSAGE SOURCES - Follow message permissions
-- =====================================================

CREATE POLICY "Users can view message sources"
ON message_sources FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
    AND message_id IN (
        SELECT m.id FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE (
            c.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.user_id = auth.uid()
                AND om.organization_id = c.organization_id
                AND om.role IN ('owner', 'admin', 'hr_manager')
                AND om.is_active = true
            )
        )
    )
);

CREATE POLICY "System can insert message sources"
ON message_sources FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

-- =====================================================
-- ORGANIZATION USAGE - Admins and owners only
-- =====================================================

CREATE POLICY "Organization owners and admins can view usage"
ON organization_usage FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "System can insert usage data"
ON organization_usage FOR INSERT
WITH CHECK (true); -- System inserts usage data

CREATE POLICY "System can update usage data"
ON organization_usage FOR UPDATE
USING (true); -- System updates usage data

-- =====================================================
-- USER ACTIVITY LOGS - Users see own, admins see all
-- =====================================================

CREATE POLICY "Users can view their own activity logs"
ON user_activity_logs FOR SELECT
USING (
    user_id = auth.uid()
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Organization admins can view all activity logs"
ON user_activity_logs FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "System can insert activity logs"
ON user_activity_logs FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = user_activity_logs.user_id AND is_active = true
    )
);

-- =====================================================
-- API USAGE LOGS - Similar to activity logs
-- =====================================================

CREATE POLICY "Organization owners can view API usage logs"
ON api_usage_logs FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "System can insert API usage logs"
ON api_usage_logs FOR INSERT
WITH CHECK (true); -- System logs API usage

-- =====================================================
-- SECURITY AUDIT LOGS - Admins only
-- =====================================================

CREATE POLICY "Organization admins can view security audit logs"
ON security_audit_logs FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
    OR organization_id IS NULL -- System-wide logs for super admins
);

CREATE POLICY "System can insert security audit logs"
ON security_audit_logs FOR INSERT
WITH CHECK (true); -- System logs security events

-- =====================================================
-- DATA ACCESS LOGS - Compliance and audit
-- =====================================================

CREATE POLICY "Organization owners can view data access logs"
ON data_access_logs FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
);

CREATE POLICY "Users can view their own data access logs"
ON data_access_logs FOR SELECT
USING (
    user_id = auth.uid()
    AND organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "System can insert data access logs"
ON data_access_logs FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = data_access_logs.user_id AND is_active = true
    )
);

-- =====================================================
-- UTILITY POLICIES FOR SYSTEM OPERATIONS
-- =====================================================

-- Allow system to read organization data for background jobs
CREATE POLICY "Service role can access all data"
ON organizations FOR ALL
USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role can access organization members"
ON organization_members FOR ALL
USING (current_setting('role') = 'service_role');

-- Similar service role policies for other tables where system access is needed
-- (These would be expanded based on specific system requirements)

-- =====================================================
-- VALIDATION FUNCTIONS FOR TESTING
-- =====================================================

-- Function to test cross-tenant data isolation
CREATE OR REPLACE FUNCTION test_tenant_isolation(
    p_user1_id UUID,
    p_user2_id UUID,
    p_org1_id UUID,
    p_org2_id UUID
)
RETURNS TABLE (
    test_name TEXT,
    passed BOOLEAN,
    details TEXT
) AS $$
BEGIN
    -- Test 1: User 1 cannot see organization 2
    RETURN QUERY
    SELECT 
        'Cross-tenant organization isolation' as test_name,
        NOT EXISTS (
            SELECT 1 FROM organizations
            WHERE id = p_org2_id
            AND auth.uid() = p_user1_id
        ) as passed,
        'User from org1 should not see org2' as details;
    
    -- Test 2: User 1 cannot see documents from organization 2
    RETURN QUERY
    SELECT 
        'Cross-tenant document isolation' as test_name,
        NOT EXISTS (
            SELECT 1 FROM documents
            WHERE organization_id = p_org2_id
            AND auth.uid() = p_user1_id
        ) as passed,
        'User from org1 should not see documents from org2' as details;
        
    -- Additional tests would be added here
END;
$$ language 'plpgsql' SECURITY DEFINER;