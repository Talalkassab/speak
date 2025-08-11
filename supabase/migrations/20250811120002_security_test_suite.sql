-- =====================================================
-- Multi-Tenant Security Test Suite
-- Comprehensive tests for data isolation and security
-- =====================================================

-- =====================================================
-- TEST DATA SETUP FUNCTIONS
-- =====================================================

-- Function to create test organizations and users
CREATE OR REPLACE FUNCTION setup_test_environment()
RETURNS TABLE (
    org1_id UUID,
    org2_id UUID,
    user1_id UUID,
    user2_id UUID,
    admin1_id UUID,
    admin2_id UUID
) AS $$
DECLARE
    v_org1_id UUID;
    v_org2_id UUID;
    v_user1_id UUID;
    v_user2_id UUID;
    v_admin1_id UUID;
    v_admin2_id UUID;
BEGIN
    -- Create test organizations
    INSERT INTO organizations (name, slug, country_code) VALUES 
    ('شركة الاختبار الأولى', 'test-company-1', 'SA') RETURNING id INTO v_org1_id;
    
    INSERT INTO organizations (name, slug, country_code) VALUES 
    ('شركة الاختبار الثانية', 'test-company-2', 'SA') RETURNING id INTO v_org2_id;
    
    -- Note: In real implementation, users would be created through Supabase Auth
    -- These are placeholder UUIDs for testing
    v_user1_id := gen_random_uuid();
    v_user2_id := gen_random_uuid();
    v_admin1_id := gen_random_uuid();
    v_admin2_id := gen_random_uuid();
    
    -- Create organization memberships
    INSERT INTO organization_members (organization_id, user_id, role) VALUES
    (v_org1_id, v_user1_id, 'hr_staff'),
    (v_org1_id, v_admin1_id, 'admin'),
    (v_org2_id, v_user2_id, 'hr_staff'),
    (v_org2_id, v_admin2_id, 'admin');
    
    -- Return the created IDs
    RETURN QUERY SELECT v_org1_id, v_org2_id, v_user1_id, v_user2_id, v_admin1_id, v_admin2_id;
END;
$$ language 'plpgsql';

-- Function to create test documents
CREATE OR REPLACE FUNCTION create_test_documents(
    p_org1_id UUID,
    p_org2_id UUID,
    p_user1_id UUID,
    p_user2_id UUID
)
RETURNS TABLE (
    doc1_id UUID,
    doc2_id UUID
) AS $$
DECLARE
    v_doc1_id UUID;
    v_doc2_id UUID;
BEGIN
    -- Create document categories first
    INSERT INTO document_categories (organization_id, name, created_by) VALUES
    (p_org1_id, 'Test Category 1', p_user1_id),
    (p_org2_id, 'Test Category 2', p_user2_id);
    
    -- Create test documents
    INSERT INTO documents (
        organization_id, title, filename, file_size, file_type, mime_type, 
        content, uploaded_by
    ) VALUES 
    (p_org1_id, 'Test Document 1', 'test1.pdf', 1000, 'pdf', 'application/pdf', 'Test content 1', p_user1_id)
    RETURNING id INTO v_doc1_id;
    
    INSERT INTO documents (
        organization_id, title, filename, file_size, file_type, mime_type, 
        content, uploaded_by
    ) VALUES 
    (p_org2_id, 'Test Document 2', 'test2.pdf', 2000, 'pdf', 'application/pdf', 'Test content 2', p_user2_id)
    RETURNING id INTO v_doc2_id;
    
    RETURN QUERY SELECT v_doc1_id, v_doc2_id;
END;
$$ language 'plpgsql';

-- =====================================================
-- TENANT ISOLATION TESTS
-- =====================================================

-- Test function for organization isolation
CREATE OR REPLACE FUNCTION test_organization_isolation()
RETURNS TABLE (
    test_name TEXT,
    test_result BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_env RECORD;
    isolation_passed BOOLEAN;
BEGIN
    -- Setup test environment
    SELECT * FROM setup_test_environment() INTO test_env;
    
    -- Test 1: Users can only see their own organization
    BEGIN
        -- Simulate user1 trying to access org2 data
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_env.user1_id)::text, true);
        
        SELECT NOT EXISTS (
            SELECT 1 FROM organizations 
            WHERE id = test_env.org2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Organization visibility isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other organization' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Organization visibility isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Test 2: Organization members isolation
    BEGIN
        -- User1 should not see members of org2
        SELECT NOT EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = test_env.org2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Organization members isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other org members' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Organization members isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM organization_members WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organizations WHERE id IN (test_env.org1_id, test_env.org2_id);
END;
$$ language 'plpgsql';

-- Test function for document isolation
CREATE OR REPLACE FUNCTION test_document_isolation()
RETURNS TABLE (
    test_name TEXT,
    test_result BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_env RECORD;
    test_docs RECORD;
    isolation_passed BOOLEAN;
BEGIN
    -- Setup test environment
    SELECT * FROM setup_test_environment() INTO test_env;
    SELECT * FROM create_test_documents(test_env.org1_id, test_env.org2_id, test_env.user1_id, test_env.user2_id) INTO test_docs;
    
    -- Test 1: Document visibility isolation
    BEGIN
        -- Simulate user1 trying to access org2 documents
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_env.user1_id)::text, true);
        
        SELECT NOT EXISTS (
            SELECT 1 FROM documents 
            WHERE organization_id = test_env.org2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Document visibility isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other org documents' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Document visibility isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Test 2: Document chunks isolation
    BEGIN
        -- Add some test chunks
        INSERT INTO document_chunks (organization_id, document_id, chunk_text, chunk_index) VALUES
        (test_env.org1_id, test_docs.doc1_id, 'Chunk 1 content', 1),
        (test_env.org2_id, test_docs.doc2_id, 'Chunk 2 content', 1);
        
        -- User1 should not see chunks from org2
        SELECT NOT EXISTS (
            SELECT 1 FROM document_chunks 
            WHERE organization_id = test_env.org2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Document chunks isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other org chunks' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Document chunks isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM document_chunks WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM documents WHERE id IN (test_docs.doc1_id, test_docs.doc2_id);
    DELETE FROM document_categories WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organization_members WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organizations WHERE id IN (test_env.org1_id, test_env.org2_id);
END;
$$ language 'plpgsql';

-- Test function for conversation isolation
CREATE OR REPLACE FUNCTION test_conversation_isolation()
RETURNS TABLE (
    test_name TEXT,
    test_result BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_env RECORD;
    conv1_id UUID;
    conv2_id UUID;
    isolation_passed BOOLEAN;
BEGIN
    -- Setup test environment
    SELECT * FROM setup_test_environment() INTO test_env;
    
    -- Test 1: Conversation visibility isolation
    BEGIN
        -- Create test conversations
        INSERT INTO conversations (organization_id, user_id, title) VALUES
        (test_env.org1_id, test_env.user1_id, 'Conversation 1') RETURNING id INTO conv1_id;
        
        INSERT INTO conversations (organization_id, user_id, title) VALUES
        (test_env.org2_id, test_env.user2_id, 'Conversation 2') RETURNING id INTO conv2_id;
        
        -- Simulate user1 trying to access conversations
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_env.user1_id)::text, true);
        
        -- User1 should only see their own conversations
        SELECT NOT EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conv2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Conversation visibility isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other user conversations' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Conversation visibility isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Test 2: Message isolation
    BEGIN
        -- Create test messages
        INSERT INTO messages (organization_id, conversation_id, role, content) VALUES
        (test_env.org1_id, conv1_id, 'user', 'Test message 1'),
        (test_env.org2_id, conv2_id, 'user', 'Test message 2');
        
        -- User1 should not see messages from conv2
        SELECT NOT EXISTS (
            SELECT 1 FROM messages 
            WHERE conversation_id = conv2_id
        ) INTO isolation_passed;
        
        RETURN QUERY SELECT 
            'Message visibility isolation',
            isolation_passed,
            CASE WHEN isolation_passed THEN 'PASSED' ELSE 'FAILED: User can see other user messages' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Message visibility isolation',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM messages WHERE conversation_id IN (conv1_id, conv2_id);
    DELETE FROM conversations WHERE id IN (conv1_id, conv2_id);
    DELETE FROM organization_members WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organizations WHERE id IN (test_env.org1_id, test_env.org2_id);
END;
$$ language 'plpgsql';

-- =====================================================
-- ROLE-BASED ACCESS CONTROL TESTS
-- =====================================================

-- Test function for role-based permissions
CREATE OR REPLACE FUNCTION test_role_based_access()
RETURNS TABLE (
    test_name TEXT,
    test_result BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_env RECORD;
    test_docs RECORD;
    viewer_id UUID;
    can_access BOOLEAN;
BEGIN
    -- Setup test environment
    SELECT * FROM setup_test_environment() INTO test_env;
    SELECT * FROM create_test_documents(test_env.org1_id, test_env.org2_id, test_env.user1_id, test_env.user2_id) INTO test_docs;
    
    -- Add a viewer to org1
    viewer_id := gen_random_uuid();
    INSERT INTO organization_members (organization_id, user_id, role) VALUES
    (test_env.org1_id, viewer_id, 'viewer');
    
    -- Test 1: Viewer can read documents but not modify
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', viewer_id)::text, true);
        
        -- Viewer should be able to see public documents
        SELECT EXISTS (
            SELECT 1 FROM documents 
            WHERE organization_id = test_env.org1_id AND is_public = true
        ) INTO can_access;
        
        RETURN QUERY SELECT 
            'Viewer can read public documents',
            can_access,
            CASE WHEN can_access THEN 'PASSED' ELSE 'FAILED: Viewer cannot see public documents' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Viewer can read public documents',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Test 2: HR staff can create documents
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_env.user1_id)::text, true);
        
        -- Try to insert a document
        BEGIN
            INSERT INTO documents (
                organization_id, title, filename, file_size, file_type, mime_type, 
                content, uploaded_by
            ) VALUES 
            (test_env.org1_id, 'HR Test Doc', 'hr_test.pdf', 1500, 'pdf', 'application/pdf', 'HR content', test_env.user1_id);
            
            can_access := true;
        EXCEPTION WHEN OTHERS THEN
            can_access := false;
        END;
        
        RETURN QUERY SELECT 
            'HR staff can create documents',
            can_access,
            CASE WHEN can_access THEN 'PASSED' ELSE 'FAILED: HR staff cannot create documents' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'HR staff can create documents',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Test 3: Admin can manage organization
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_env.admin1_id)::text, true);
        
        -- Try to update organization
        BEGIN
            UPDATE organizations 
            SET name = 'Updated Company Name' 
            WHERE id = test_env.org1_id;
            
            can_access := true;
        EXCEPTION WHEN OTHERS THEN
            can_access := false;
        END;
        
        RETURN QUERY SELECT 
            'Admin can update organization',
            can_access,
            CASE WHEN can_access THEN 'PASSED' ELSE 'FAILED: Admin cannot update organization' END;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Admin can update organization',
            false,
            'ERROR: ' || SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM documents WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM document_categories WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organization_members WHERE organization_id IN (test_env.org1_id, test_env.org2_id);
    DELETE FROM organizations WHERE id IN (test_env.org1_id, test_env.org2_id);
END;
$$ language 'plpgsql';

-- =====================================================
-- PERFORMANCE TESTS
-- =====================================================

-- Test function for query performance with RLS
CREATE OR REPLACE FUNCTION test_query_performance()
RETURNS TABLE (
    test_name TEXT,
    execution_time_ms NUMERIC,
    result_count INTEGER,
    performance_grade TEXT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_ms NUMERIC;
    result_cnt INTEGER;
    test_org_id UUID;
    test_user_id UUID;
BEGIN
    -- Create test organization and user
    INSERT INTO organizations (name, slug) VALUES ('Performance Test Org', 'perf-test-org') 
    RETURNING id INTO test_org_id;
    
    test_user_id := gen_random_uuid();
    INSERT INTO organization_members (organization_id, user_id, role) VALUES
    (test_org_id, test_user_id, 'hr_staff');
    
    -- Simulate user context
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
    
    -- Test 1: Organization query performance
    start_time := clock_timestamp();
    SELECT COUNT(*) FROM organizations INTO result_cnt;
    end_time := clock_timestamp();
    execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'Organization query with RLS',
        execution_ms,
        result_cnt,
        CASE 
            WHEN execution_ms < 10 THEN 'EXCELLENT'
            WHEN execution_ms < 50 THEN 'GOOD'
            WHEN execution_ms < 200 THEN 'ACCEPTABLE'
            ELSE 'NEEDS_OPTIMIZATION'
        END;
    
    -- Test 2: Document query performance (with sample data)
    -- Insert sample documents
    INSERT INTO document_categories (organization_id, name, created_by) VALUES
    (test_org_id, 'Sample Category', test_user_id);
    
    INSERT INTO documents (organization_id, title, filename, file_size, file_type, mime_type, content, uploaded_by)
    SELECT 
        test_org_id,
        'Sample Doc ' || i,
        'sample' || i || '.pdf',
        1000 + i,
        'pdf',
        'application/pdf',
        'Sample content ' || i,
        test_user_id
    FROM generate_series(1, 100) i;
    
    start_time := clock_timestamp();
    SELECT COUNT(*) FROM documents INTO result_cnt;
    end_time := clock_timestamp();
    execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'Document query with RLS (100 docs)',
        execution_ms,
        result_cnt,
        CASE 
            WHEN execution_ms < 20 THEN 'EXCELLENT'
            WHEN execution_ms < 100 THEN 'GOOD'
            WHEN execution_ms < 500 THEN 'ACCEPTABLE'
            ELSE 'NEEDS_OPTIMIZATION'
        END;
    
    -- Cleanup
    DELETE FROM documents WHERE organization_id = test_org_id;
    DELETE FROM document_categories WHERE organization_id = test_org_id;
    DELETE FROM organization_members WHERE organization_id = test_org_id;
    DELETE FROM organizations WHERE id = test_org_id;
END;
$$ language 'plpgsql';

-- =====================================================
-- COMPREHENSIVE TEST RUNNER
-- =====================================================

-- Main test runner function
CREATE OR REPLACE FUNCTION run_security_test_suite()
RETURNS TABLE (
    test_category TEXT,
    test_name TEXT,
    result BOOLEAN,
    details TEXT,
    execution_time_ms NUMERIC DEFAULT NULL,
    result_count INTEGER DEFAULT NULL
) AS $$
BEGIN
    -- Run organization isolation tests
    RETURN QUERY 
    SELECT 
        'Tenant Isolation' as test_category,
        t.test_name,
        t.test_result as result,
        t.error_message as details,
        NULL::NUMERIC as execution_time_ms,
        NULL::INTEGER as result_count
    FROM test_organization_isolation() t;
    
    -- Run document isolation tests
    RETURN QUERY 
    SELECT 
        'Document Isolation' as test_category,
        t.test_name,
        t.test_result as result,
        t.error_message as details,
        NULL::NUMERIC as execution_time_ms,
        NULL::INTEGER as result_count
    FROM test_document_isolation() t;
    
    -- Run conversation isolation tests
    RETURN QUERY 
    SELECT 
        'Conversation Isolation' as test_category,
        t.test_name,
        t.test_result as result,
        t.error_message as details,
        NULL::NUMERIC as execution_time_ms,
        NULL::INTEGER as result_count
    FROM test_conversation_isolation() t;
    
    -- Run role-based access tests
    RETURN QUERY 
    SELECT 
        'Role-Based Access' as test_category,
        t.test_name,
        t.test_result as result,
        t.error_message as details,
        NULL::NUMERIC as execution_time_ms,
        NULL::INTEGER as result_count
    FROM test_role_based_access() t;
    
    -- Run performance tests
    RETURN QUERY 
    SELECT 
        'Performance' as test_category,
        t.test_name,
        (t.performance_grade != 'NEEDS_OPTIMIZATION') as result,
        t.performance_grade as details,
        t.execution_time_ms,
        t.result_count
    FROM test_query_performance() t;
END;
$$ language 'plpgsql';

-- =====================================================
-- TEST RESULT ANALYSIS
-- =====================================================

-- Function to analyze test results and provide summary
CREATE OR REPLACE FUNCTION analyze_test_results()
RETURNS TABLE (
    total_tests INTEGER,
    passed_tests INTEGER,
    failed_tests INTEGER,
    pass_percentage NUMERIC,
    critical_failures TEXT[],
    recommendations TEXT[]
) AS $$
DECLARE
    v_total INTEGER;
    v_passed INTEGER;
    v_failed INTEGER;
    v_pass_pct NUMERIC;
    v_critical_failures TEXT[] := '{}';
    v_recommendations TEXT[] := '{}';
    r RECORD;
BEGIN
    -- Get test counts
    SELECT COUNT(*), COUNT(*) FILTER (WHERE result = true), COUNT(*) FILTER (WHERE result = false)
    FROM run_security_test_suite()
    INTO v_total, v_passed, v_failed;
    
    -- Calculate percentage
    v_pass_pct := ROUND((v_passed::NUMERIC / v_total::NUMERIC) * 100, 2);
    
    -- Identify critical failures
    FOR r IN 
        SELECT test_category, test_name, details 
        FROM run_security_test_suite() 
        WHERE result = false AND test_category IN ('Tenant Isolation', 'Document Isolation')
    LOOP
        v_critical_failures := array_append(v_critical_failures, 
            r.test_category || ': ' || r.test_name || ' - ' || r.details);
    END LOOP;
    
    -- Generate recommendations
    IF array_length(v_critical_failures, 1) > 0 THEN
        v_recommendations := array_append(v_recommendations, 
            'CRITICAL: Fix tenant isolation issues immediately - data security is compromised');
    END IF;
    
    IF v_pass_pct < 100 THEN
        v_recommendations := array_append(v_recommendations, 
            'Review and fix failing tests before deploying to production');
    END IF;
    
    IF v_pass_pct >= 95 THEN
        v_recommendations := array_append(v_recommendations, 
            'Security tests are passing well. Consider additional edge case testing.');
    END IF;
    
    RETURN QUERY SELECT v_total, v_passed, v_failed, v_pass_pct, v_critical_failures, v_recommendations;
END;
$$ language 'plpgsql';

-- =====================================================
-- QUICK VALIDATION FUNCTIONS
-- =====================================================

-- Quick function to verify RLS is enabled on all tenant tables
CREATE OR REPLACE FUNCTION verify_rls_enabled()
RETURNS TABLE (
    table_name TEXT,
    rls_enabled BOOLEAN,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        rowsecurity as rls_enabled,
        CASE WHEN rowsecurity THEN 'OK' ELSE 'MISSING RLS' END as status
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename IN (
        'organizations', 'organization_members', 'organization_invitations',
        'document_categories', 'documents', 'document_permissions', 'document_chunks',
        'conversations', 'messages', 'message_sources',
        'organization_usage', 'user_activity_logs', 'api_usage_logs',
        'security_audit_logs', 'data_access_logs'
    )
    ORDER BY tablename;
END;
$$ language 'plpgsql';

-- Function to check for tables missing organization_id
CREATE OR REPLACE FUNCTION verify_tenant_columns()
RETURNS TABLE (
    table_name TEXT,
    has_org_id BOOLEAN,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename as table_name,
        EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = t.tablename
            AND c.column_name = 'organization_id'
        ) as has_org_id,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                AND c.table_name = t.tablename
                AND c.column_name = 'organization_id'
            ) THEN 'OK'
            ELSE 'MISSING ORGANIZATION_ID'
        END as status
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename NOT IN ('labor_law_categories', 'labor_law_articles', 'labor_law_embeddings')
    AND t.tablename LIKE '%organization%' = false
    ORDER BY t.tablename;
END;
$$ language 'plpgsql';