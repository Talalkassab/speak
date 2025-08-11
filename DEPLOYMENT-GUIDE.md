# Multi-Tenant HR RAG System - Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the multi-tenant HR RAG database system with complete security validation.

## Prerequisites
- Supabase project with PostgreSQL 15+
- pgvector extension enabled
- Database migration access
- Admin privileges for testing

## Migration Files (Execute in Order)

### 1. Core Schema Migration
**File**: `20250811120000_multi_tenant_hr_rag_schema.sql`
- Creates all core tables with organization-level isolation
- Sets up document management, conversations, and Saudi labor law knowledge base
- Implements performance indexes and utility functions
- **Critical**: This migration creates the foundation for all tenant isolation

### 2. Security Policies Migration
**File**: `20250811120001_multi_tenant_rls_policies.sql`
- Implements comprehensive Row Level Security (RLS) policies
- Ensures complete data isolation between organizations
- Sets up role-based access control
- **Critical**: Security depends entirely on these policies

### 3. Security Test Suite Migration
**File**: `20250811120002_security_test_suite.sql`
- Comprehensive security testing framework
- Validates tenant isolation and role-based access
- Performance testing for RLS overhead
- **Critical**: Must pass 100% before production deployment

### 4. Utility Functions and Sample Data
**File**: `20250811120003_sample_data_and_functions.sql`
- Organization management utilities
- Invitation system functions
- Development helper functions
- Maintenance and cleanup utilities

### 5. Labor Law Knowledge Base
**File**: `20250811120004_initialize_labor_law_data.sql`
- Saudi labor law categories and articles
- Search functions for labor law content
- Placeholder for embeddings generation
- Shared knowledge base across all tenants

## Deployment Steps

### Step 1: Database Migration
```bash
# Apply all migrations in order
supabase db reset
supabase db push

# Or apply manually in Supabase dashboard
# Copy and paste each migration file content in order
```

### Step 2: Security Validation (CRITICAL)
```sql
-- Run comprehensive security test suite
SELECT * FROM run_security_test_suite();

-- Analyze results (must be 100% pass rate)
SELECT * FROM analyze_test_results();

-- Verify RLS is enabled on all tables
SELECT * FROM verify_rls_enabled();
```

### Step 3: Performance Testing
```sql
-- Test query performance with RLS
SELECT * FROM test_query_performance();

-- All tests should be "EXCELLENT" or "GOOD"
-- "NEEDS_OPTIMIZATION" requires investigation
```

### Step 4: Initialize Labor Law Data
```sql
-- Verify labor law data is loaded
SELECT 
    (SELECT COUNT(*) FROM labor_law_categories) as categories,
    (SELECT COUNT(*) FROM labor_law_articles) as articles;

-- Should return: categories=10, articles=15+
```

### Step 5: Create Sample Organization (Development Only)
```sql
-- Create test organization for development
SELECT * FROM create_sample_dev_organization();
```

## Security Validation Checklist

### ✅ Critical Security Tests
- [ ] Cross-tenant organization isolation passes
- [ ] Document visibility isolation passes
- [ ] Conversation privacy isolation passes
- [ ] Role-based access control works correctly
- [ ] RLS enabled on all tenant tables
- [ ] No cross-tenant data leakage possible

### ✅ Performance Benchmarks
- [ ] Organization queries < 50ms
- [ ] Document queries < 100ms (100 documents)
- [ ] Vector search < 200ms
- [ ] All performance grades "ACCEPTABLE" or better

### ✅ Data Integrity
- [ ] All foreign key constraints active
- [ ] Updated timestamp triggers working
- [ ] Labor law data complete
- [ ] Audit logging functional

## Production Deployment Verification

### 1. Run Security Test Suite
```sql
SELECT 
    test_category,
    COUNT(*) as total_tests,
    COUNT(*) FILTER (WHERE result = true) as passed_tests,
    COUNT(*) FILTER (WHERE result = false) as failed_tests,
    ROUND(
        COUNT(*) FILTER (WHERE result = true) * 100.0 / COUNT(*), 2
    ) as pass_percentage
FROM run_security_test_suite()
GROUP BY test_category;
```

**Requirements for Production:**
- All categories must show 100% pass rate
- Zero failed tests allowed
- Any failure requires immediate investigation

### 2. Performance Validation
```sql
SELECT 
    test_name,
    execution_time_ms,
    performance_grade,
    CASE 
        WHEN performance_grade IN ('EXCELLENT', 'GOOD', 'ACCEPTABLE') THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
FROM test_query_performance();
```

### 3. Configuration Verification
```sql
-- Verify all tenant tables have RLS enabled
SELECT 
    table_name,
    rls_enabled,
    CASE 
        WHEN rls_enabled THEN '✅ ENABLED'
        ELSE '❌ MISSING'
    END as status
FROM verify_rls_enabled()
WHERE status = 'MISSING RLS';

-- Should return no rows (all tables protected)
```

## Common Issues and Solutions

### Issue: RLS Policy Errors
**Symptom**: Users cannot access their own data
**Solution**: 
```sql
-- Check if user is properly added to organization
SELECT * FROM organization_members 
WHERE user_id = auth.uid() AND is_active = true;

-- Verify organization exists
SELECT * FROM organizations WHERE is_active = true;
```

### Issue: Vector Index Performance
**Symptom**: Slow embedding searches
**Solution**:
```sql
-- Rebuild vector index with different parameters
DROP INDEX IF EXISTS idx_doc_chunks_embedding;
CREATE INDEX idx_doc_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);
```

### Issue: Cross-Tenant Data Visible
**Symptom**: Security test failures
**Solution**: 
```sql
-- This is CRITICAL - do not deploy to production
-- Check which policies are missing or incorrect
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT IN (
    SELECT tablename FROM pg_policies 
    WHERE schemaname = 'public'
);
```

## Environment-Specific Configuration

### Development Environment
```sql
-- Create sample data for testing
SELECT * FROM create_sample_dev_organization(auth.uid());

-- Enable detailed logging
SET log_statement = 'all';
```

### Staging Environment
```sql
-- Run full security test suite
SELECT * FROM run_security_test_suite();

-- Test with multiple organizations
SELECT * FROM setup_test_environment();
```

### Production Environment
```sql
-- Minimal logging for performance
SET log_statement = 'none';

-- Monitor performance
SELECT * FROM generate_org_health_report(organization_id);
```

## Maintenance Schedule

### Daily Tasks
```sql
-- Cleanup expired invitations
SELECT cleanup_expired_invitations();
```

### Weekly Tasks
```sql
-- Archive old conversations (optional)
SELECT archive_old_conversations(12); -- 12 months
```

### Monthly Tasks
```sql
-- Update usage statistics
SELECT update_organization_usage_stats();

-- Cleanup old activity logs
SELECT cleanup_old_activity_logs(90); -- 90 days
```

### Quarterly Tasks
```sql
-- Run comprehensive security audit
SELECT * FROM run_security_test_suite();

-- Performance health check
SELECT * FROM test_query_performance();
```

## Emergency Procedures

### Security Breach Detection
1. Immediately run security test suite
2. Check audit logs for unauthorized access
3. Disable affected users if necessary
4. Report findings to security team

### Performance Degradation
1. Run performance tests to identify bottlenecks
2. Check index usage and query plans
3. Consider scaling database resources
4. Review RLS policy efficiency

### Data Recovery
1. All critical data has audit trails
2. Use organization_id to scope recovery operations
3. Validate data integrity after any recovery
4. Re-run security tests after changes

## Success Criteria

### ✅ Deployment Successful When:
- [ ] All 4 migrations applied successfully
- [ ] Security test suite: 100% pass rate
- [ ] Performance tests: All "ACCEPTABLE" or better
- [ ] RLS enabled on all tenant tables
- [ ] Labor law knowledge base populated
- [ ] Sample queries work correctly
- [ ] No cross-tenant data access possible

### ❌ Do Not Deploy If:
- Any security test failures
- Performance degradation beyond acceptable limits
- Missing RLS policies on any table
- Cross-tenant data access detected
- Database constraints violations

## Support and Troubleshooting

For issues during deployment:
1. Check the security test results first
2. Verify all migrations applied in correct order
3. Test with sample organization creation
4. Review RLS policies for any gaps
5. Check PostgreSQL logs for constraint violations

**Remember: Security is paramount. Never deploy to production with failing security tests.**