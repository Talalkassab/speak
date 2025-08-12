import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Compliance analytics schemas
const complianceAnalyticsSchema = z.object({
  categories: z.array(z.enum([
    'employment', 'wages', 'termination', 'leave', 'working_hours', 'safety', 'discrimination'
  ])).optional(),
  severity: z.enum(['all', 'high', 'medium', 'low']).default('all'),
  includeResolved: z.boolean().default(false),
  language: z.enum(['ar', 'en']).default('ar')
});

interface ComplianceIssue {
  id: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  labor_law_reference: string;
  recommendation: string;
  affected_documents?: string[];
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at?: string;
}

interface ComplianceScore {
  overall_score: number;
  category_scores: {
    [category: string]: {
      score: number;
      issues_count: number;
      resolved_count: number;
      pending_count: number;
    };
  };
  trend: {
    current_period: number;
    previous_period: number;
    change_percentage: number;
  };
}

interface ComplianceReport {
  organization_id: string;
  assessment_date: string;
  compliance_score: ComplianceScore;
  issues: ComplianceIssue[];
  recommendations: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  action_items: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    action: string;
    due_date: string;
    responsible_role: string;
  }>;
  labor_law_updates?: Array<{
    article_number: string;
    title: string;
    change_type: 'new' | 'modified' | 'deprecated';
    effective_date: string;
    impact_assessment: string;
  }>;
}

interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

function createErrorResponse(code: string, message: string, status: number = 400, details?: any): NextResponse {
  const error: APIError = {
    code,
    message,
    details,
    timestamp: new Date()
  };
  
  console.error('API Error:', error);
  return NextResponse.json({ error }, { status });
}

function createSuccessResponse<T>(data: T, status: number = 200, metadata?: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    metadata,
    timestamp: new Date()
  }, { status });
}

// GET /api/v1/analytics/compliance - Get compliance report
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for compliance analytics
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to view compliance analytics',
        403
      );
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'api_call');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `API call limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      categories: searchParams.getAll('categories'),
      severity: searchParams.get('severity'),
      includeResolved: searchParams.get('includeResolved') === 'true',
      language: searchParams.get('language')
    };
    
    const { categories, severity, includeResolved, language } = complianceAnalyticsSchema.parse(queryParams);

    const supabase = await createSupabaseServerClient();

    // Generate compliance report
    const complianceReport = await generateComplianceReport(
      supabase,
      userContext.organizationId,
      categories,
      severity,
      includeResolved,
      language
    );

    // Log activity
    await logUserActivity(
      userContext,
      'compliance_report_generated',
      'compliance',
      undefined,
      { 
        overallScore: complianceReport.compliance_score.overall_score,
        riskLevel: complianceReport.risk_level,
        issuesCount: complianceReport.issues.length
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(complianceReport);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error generating compliance report:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// POST /api/v1/analytics/compliance/scan - Perform new compliance scan
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions
    if (!hasRole(userContext, ['owner', 'admin', 'hr_manager'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions to perform compliance scan',
        403
      );
    }

    const body = await request.json().catch(() => ({}));
    const { 
      categories = ['employment', 'wages', 'termination', 'leave'], 
      language = 'ar' 
    } = body;

    const supabase = await createSupabaseServerClient();

    // Perform comprehensive compliance scan
    const scanResults = await performComplianceScan(
      supabase,
      userContext.organizationId,
      categories,
      language
    );

    // Store scan results
    const { data: scanRecord, error: scanError } = await supabase
      .from('compliance_scans')
      .insert({
        organization_id: userContext.organizationId,
        initiated_by: userContext.userId,
        categories_scanned: categories,
        issues_found: scanResults.issues.length,
        overall_score: scanResults.overall_score,
        risk_level: scanResults.risk_level,
        scan_metadata: {
          documents_analyzed: scanResults.documents_analyzed,
          templates_analyzed: scanResults.templates_analyzed,
          processing_time_ms: scanResults.processing_time_ms
        }
      })
      .select()
      .single();

    if (scanError) {
      console.error('Error storing scan results:', scanError);
    }

    // Log activity
    await logUserActivity(
      userContext,
      'compliance_scan_performed',
      'compliance',
      scanRecord?.id,
      { 
        categories,
        issuesFound: scanResults.issues.length,
        overallScore: scanResults.overall_score
      },
      request
    );

    return createSuccessResponse({
      scan_id: scanRecord?.id,
      ...scanResults
    }, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }

    console.error('Unexpected error performing compliance scan:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper functions
async function generateComplianceReport(
  supabase: any,
  organizationId: string,
  categories?: string[],
  severity: string = 'all',
  includeResolved: boolean = false,
  language: string = 'ar'
): Promise<ComplianceReport> {
  
  // Get organization documents and templates for analysis
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'completed');

  const { data: templates } = await supabase
    .from('template_generations')
    .select('*, hr_templates!inner(category, compliance_rules)')
    .eq('organization_id', organizationId);

  // Analyze compliance issues
  const issues = await analyzeComplianceIssues(documents || [], templates || [], categories, language);
  
  // Filter by severity
  const filteredIssues = severity === 'all' 
    ? issues 
    : issues.filter(issue => issue.severity === severity);

  // Filter by resolution status
  const finalIssues = includeResolved 
    ? filteredIssues 
    : filteredIssues.filter(issue => issue.status !== 'resolved');

  // Calculate compliance scores
  const complianceScore = calculateComplianceScore(issues, categories);
  
  // Determine risk level
  const riskLevel = determineRiskLevel(complianceScore.overall_score, issues);
  
  // Generate recommendations
  const recommendations = generateRecommendations(issues, language);
  
  // Generate action items
  const actionItems = generateActionItems(issues, language);
  
  // Get recent labor law updates
  const laborLawUpdates = await getLaborLawUpdates(supabase, language);

  return {
    organization_id: organizationId,
    assessment_date: new Date().toISOString(),
    compliance_score: complianceScore,
    issues: finalIssues,
    recommendations,
    risk_level: riskLevel,
    action_items: actionItems,
    labor_law_updates: laborLawUpdates
  };
}

async function performComplianceScan(
  supabase: any,
  organizationId: string,
  categories: string[],
  language: string
): Promise<{
  overall_score: number;
  risk_level: string;
  issues: ComplianceIssue[];
  documents_analyzed: number;
  templates_analyzed: number;
  processing_time_ms: number;
}> {
  const startTime = Date.now();

  // Get all documents and templates for analysis
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', organizationId);

  const { data: templates } = await supabase
    .from('template_generations')
    .select('*, hr_templates!inner(category, compliance_rules)')
    .eq('organization_id', organizationId);

  // Analyze compliance
  const issues = await analyzeComplianceIssues(documents || [], templates || [], categories, language);
  const complianceScore = calculateComplianceScore(issues, categories);
  const riskLevel = determineRiskLevel(complianceScore.overall_score, issues);

  const processingTime = Date.now() - startTime;

  return {
    overall_score: complianceScore.overall_score,
    risk_level: riskLevel,
    issues,
    documents_analyzed: documents?.length || 0,
    templates_analyzed: templates?.length || 0,
    processing_time_ms: processingTime
  };
}

async function analyzeComplianceIssues(
  documents: any[],
  templates: any[],
  categories?: string[],
  language: string = 'ar'
): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Define compliance rules by category
  const complianceRules = {
    employment: {
      ar: [
        {
          rule: 'probation_period_limit',
          title: 'فترة التجربة تتجاوز الحد المسموح',
          description: 'فترة التجربة يجب ألا تتجاوز 90 يوماً',
          labor_law_reference: 'المادة 53 - نظام العمل السعودي',
          severity: 'high' as const
        },
        {
          rule: 'missing_job_description',
          title: 'الوصف الوظيفي غير محدد',
          description: 'يجب تحديد الوصف الوظيفي بوضوح في عقد العمل',
          labor_law_reference: 'المادة 50 - نظام العمل السعودي',
          severity: 'medium' as const
        }
      ],
      en: [
        {
          rule: 'probation_period_limit',
          title: 'Probation period exceeds allowed limit',
          description: 'Probation period must not exceed 90 days',
          labor_law_reference: 'Article 53 - Saudi Labor Law',
          severity: 'high' as const
        },
        {
          rule: 'missing_job_description',
          title: 'Job description not specified',
          description: 'Job description must be clearly defined in employment contract',
          labor_law_reference: 'Article 50 - Saudi Labor Law',
          severity: 'medium' as const
        }
      ]
    },
    working_hours: {
      ar: [
        {
          rule: 'weekly_hours_limit',
          title: 'ساعات العمل الأسبوعية تتجاوز الحد المسموح',
          description: 'ساعات العمل يجب ألا تتجاوز 48 ساعة في الأسبوع',
          labor_law_reference: 'المادة 98 - نظام العمل السعودي',
          severity: 'high' as const
        }
      ],
      en: [
        {
          rule: 'weekly_hours_limit',
          title: 'Weekly working hours exceed allowed limit',
          description: 'Working hours must not exceed 48 hours per week',
          labor_law_reference: 'Article 98 - Saudi Labor Law',
          severity: 'high' as const
        }
      ]
    },
    wages: {
      ar: [
        {
          rule: 'minimum_wage_compliance',
          title: 'الراتب أقل من الحد الأدنى للأجور',
          description: 'يجب ألا يقل الراتب عن الحد الأدنى المحدد',
          labor_law_reference: 'المادة 95 - نظام العمل السعودي',
          severity: 'critical' as const
        }
      ],
      en: [
        {
          rule: 'minimum_wage_compliance',
          title: 'Salary below minimum wage',
          description: 'Salary must not be below the specified minimum wage',
          labor_law_reference: 'Article 95 - Saudi Labor Law',
          severity: 'critical' as const
        }
      ]
    }
  };

  // Analyze documents and templates
  const categoriesToCheck = categories || Object.keys(complianceRules);
  
  categoriesToCheck.forEach(category => {
    if (complianceRules[category as keyof typeof complianceRules]) {
      const categoryRules = complianceRules[category as keyof typeof complianceRules][language as keyof typeof complianceRules.employment];
      
      categoryRules?.forEach((rule, index) => {
        // Simple rule checking (in production, this would be more sophisticated)
        const hasViolation = Math.random() > 0.7; // Mock violation detection
        
        if (hasViolation) {
          issues.push({
            id: `${category}_${rule.rule}_${index}`,
            category,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            labor_law_reference: rule.labor_law_reference,
            recommendation: generateRecommendationForRule(rule, language),
            status: 'open',
            created_at: new Date().toISOString()
          });
        }
      });
    }
  });

  return issues;
}

function calculateComplianceScore(
  issues: ComplianceIssue[],
  categories?: string[]
): ComplianceScore {
  const totalCategories = categories?.length || 7;
  const maxScorePerCategory = 100;
  const totalMaxScore = totalCategories * maxScorePerCategory;
  
  // Calculate deductions based on severity
  const severityDeductions = {
    'critical': 50,
    'high': 25,
    'medium': 15,
    'low': 5
  };

  let totalDeductions = 0;
  const categoryScores: { [category: string]: any } = {};
  
  // Group issues by category
  const issuesByCategory = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as { [category: string]: ComplianceIssue[] });

  // Calculate scores for each category
  Object.entries(issuesByCategory).forEach(([category, categoryIssues]) => {
    let categoryDeductions = 0;
    let resolvedCount = 0;
    let pendingCount = 0;

    categoryIssues.forEach(issue => {
      categoryDeductions += severityDeductions[issue.severity as keyof typeof severityDeductions];
      if (issue.status === 'resolved') {
        resolvedCount++;
      } else {
        pendingCount++;
      }
    });

    const categoryScore = Math.max(0, maxScorePerCategory - categoryDeductions);
    categoryScores[category] = {
      score: categoryScore,
      issues_count: categoryIssues.length,
      resolved_count: resolvedCount,
      pending_count: pendingCount
    };

    totalDeductions += categoryDeductions;
  });

  // Add perfect scores for categories without issues
  const allCategories = categories || ['employment', 'wages', 'termination', 'leave', 'working_hours', 'safety', 'discrimination'];
  allCategories.forEach(category => {
    if (!categoryScores[category]) {
      categoryScores[category] = {
        score: maxScorePerCategory,
        issues_count: 0,
        resolved_count: 0,
        pending_count: 0
      };
    }
  });

  const overallScore = Math.max(0, Math.round((totalMaxScore - totalDeductions) / totalMaxScore * 100));

  return {
    overall_score: overallScore,
    category_scores: categoryScores,
    trend: {
      current_period: overallScore,
      previous_period: overallScore + Math.floor(Math.random() * 20) - 10, // Mock previous score
      change_percentage: Math.floor(Math.random() * 20) - 10 // Mock change
    }
  };
}

function determineRiskLevel(overallScore: number, issues: ComplianceIssue[]): 'low' | 'medium' | 'high' | 'critical' {
  const criticalIssues = issues.filter(i => i.severity === 'high').length;
  const highIssues = issues.filter(i => i.severity === 'high').length;
  
  if (overallScore < 60 || criticalIssues > 0) return 'critical';
  if (overallScore < 75 || highIssues > 2) return 'high';
  if (overallScore < 85) return 'medium';
  return 'low';
}

function generateRecommendations(issues: ComplianceIssue[], language: string): string[] {
  const recommendations = new Set<string>();
  
  issues.forEach(issue => {
    switch (issue.category) {
      case 'employment':
        if (language === 'ar') {
          recommendations.add('مراجعة جميع عقود العمل للتأكد من مطابقتها لنظام العمل السعودي');
          recommendations.add('تحديث نماذج عقود العمل لتشمل جميع البنود المطلوبة');
        } else {
          recommendations.add('Review all employment contracts for Saudi Labor Law compliance');
          recommendations.add('Update employment contract templates to include all required clauses');
        }
        break;
      case 'working_hours':
        if (language === 'ar') {
          recommendations.add('مراجعة سياسات ساعات العمل لضمان عدم تجاوز الحدود القانونية');
        } else {
          recommendations.add('Review working hours policies to ensure legal limits are not exceeded');
        }
        break;
    }
  });
  
  return Array.from(recommendations);
}

function generateActionItems(issues: ComplianceIssue[], language: string): Array<{
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  due_date: string;
  responsible_role: string;
}> {
  return issues.slice(0, 5).map(issue => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (issue.severity === 'high' ? 7 : 30));
    
    return {
      priority: issue.severity === 'critical' ? 'high' : issue.severity,
      category: issue.category,
      action: language === 'ar' ? 
        `معالجة مشكلة: ${issue.title}` : 
        `Address issue: ${issue.title}`,
      due_date: dueDate.toISOString(),
      responsible_role: 'hr_manager'
    };
  });
}

function generateRecommendationForRule(rule: any, language: string): string {
  // Generate specific recommendations based on the rule
  if (language === 'ar') {
    return `يُنصح بـ: ${rule.description}. راجع ${rule.labor_law_reference} لمزيد من التفاصيل.`;
  } else {
    return `Recommended action: ${rule.description}. Please refer to ${rule.labor_law_reference} for more details.`;
  }
}

async function getLaborLawUpdates(supabase: any, language: string): Promise<Array<{
  article_number: string;
  title: string;
  change_type: 'new' | 'modified' | 'deprecated';
  effective_date: string;
  impact_assessment: string;
}>> {
  // Get recent updates from Saudi labor law database
  const { data: updates } = await supabase
    .from('saudi_labor_law_articles')
    .select('*')
    .eq('language', language)
    .gte('last_updated', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
    .order('last_updated', { ascending: false })
    .limit(5);

  return updates?.map(update => ({
    article_number: update.article_number,
    title: update.title,
    change_type: 'modified' as const, // This would be determined from actual change tracking
    effective_date: update.last_updated,
    impact_assessment: language === 'ar' ? 
      'قد يتطلب مراجعة السياسات الحالية' : 
      'May require review of current policies'
  })) || [];
}