import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { analytics } from '@/middleware/analytics';
import type { 
  ComplianceMetrics, 
  AnalyticsResponse, 
  CategoryScore,
  ComplianceIssue as AnalyticsComplianceIssue,
  ComplianceTrend,
  AuditEntry
} from '@/types/analytics';

// Compliance analytics schemas
const complianceAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categories: z.array(z.enum([
    'employment', 'wages', 'termination', 'leave', 'working_hours', 'safety', 'discrimination'
  ])).optional(),
  severity: z.enum(['all', 'critical', 'high', 'medium', 'low']).default('all'),
  includeResolved: z.boolean().default(false),
  language: z.enum(['ar', 'en']).default('ar'),
  timezone: z.string().default('Asia/Riyadh')
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
      period: searchParams.get('period'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      categories: searchParams.getAll('categories'),
      severity: searchParams.get('severity'),
      includeResolved: searchParams.get('includeResolved') === 'true',
      language: searchParams.get('language'),
      timezone: searchParams.get('timezone')
    };
    
    const validatedParams = complianceAnalyticsSchema.parse(queryParams);

    // Calculate date range
    const dateRange = calculateDateRange(validatedParams.period, validatedParams.startDate, validatedParams.endDate);

    const supabase = await createSupabaseServerClient();

    // Generate comprehensive compliance metrics
    const complianceMetrics = await getComplianceMetrics(
      supabase,
      userContext.organizationId,
      dateRange.start,
      dateRange.end,
      validatedParams.categories,
      validatedParams.severity,
      validatedParams.includeResolved,
      validatedParams.language
    );

    const response: AnalyticsResponse<ComplianceMetrics> = {
      data: complianceMetrics,
      meta: {
        organizationId: userContext.organizationId,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        timezone: validatedParams.timezone,
        generatedAt: new Date().toISOString()
      },
      success: true
    };

    // Track analytics event
    await analytics.trackAnalyticsEvent({
      userId: userContext.userId,
      organizationId: userContext.organizationId,
      eventName: 'compliance_analytics_viewed',
      eventCategory: 'analytics',
      eventAction: 'view',
      eventLabel: validatedParams.period,
      properties: {
        dateRange: { start: dateRange.start, end: dateRange.end },
        period: validatedParams.period,
        overallScore: complianceMetrics.overallScore,
        riskLevel: complianceMetrics.riskLevel
      }
    });

    // Log activity
    await logUserActivity(
      userContext,
      'compliance_analytics_viewed',
      'analytics',
      undefined,
      { 
        period: validatedParams.period,
        overallScore: complianceMetrics.overallScore,
        riskLevel: complianceMetrics.riskLevel,
        issuesCount: complianceMetrics.issuesFound.length
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(response);

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
function calculateDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function getComplianceMetrics(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  categories?: string[],
  severity: string = 'all',
  includeResolved: boolean = false,
  language: string = 'ar'
): Promise<ComplianceMetrics> {
  // Get compliance scores
  let scoresQuery = supabase
    .from('compliance_scores')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (categories && categories.length > 0) {
    scoresQuery = scoresQuery.in('category', categories);
  }

  const { data: scoresData } = await scoresQuery;

  // Get compliance issues
  let issuesQuery = supabase
    .from('compliance_issues')
    .select(`
      *,
      compliance_scores!inner(organization_id, created_at)
    `)
    .eq('compliance_scores.organization_id', organizationId)
    .gte('compliance_scores.created_at', startDate)
    .lte('compliance_scores.created_at', endDate);

  if (severity !== 'all') {
    issuesQuery = issuesQuery.eq('severity', severity);
  }

  if (!includeResolved) {
    issuesQuery = issuesQuery.eq('resolved', false);
  }

  if (categories && categories.length > 0) {
    issuesQuery = issuesQuery.in('category', categories);
  }

  const { data: issuesData } = await issuesQuery;

  // Get audit trail
  const { data: auditData } = await supabase
    .from('audit_trail')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('resource_type', 'compliance')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })
    .limit(50);

  // Calculate overall score
  const overallScore = scoresData && scoresData.length > 0 
    ? scoresData.reduce((sum, score) => sum + score.score, 0) / scoresData.length
    : 100;

  // Generate category scores
  const categoryScores = generateCategoryScores(scoresData || [], issuesData || [], categories);

  // Determine risk level
  const riskLevel = determineRiskLevel(overallScore, issuesData || []);

  // Generate compliance trends
  const complianceTrend = await generateComplianceTrends(
    supabase,
    organizationId,
    startDate,
    endDate,
    categories
  );

  // Convert issues to analytics format
  const analyticsIssues: AnalyticsComplianceIssue[] = (issuesData || []).map(issue => ({
    id: issue.id,
    category: issue.category,
    severity: issue.severity,
    description: language === 'ar' ? issue.description_arabic : issue.description,
    descriptionArabic: issue.description_arabic,
    recommendation: language === 'ar' ? issue.recommendation_arabic : issue.recommendation,
    recommendationArabic: issue.recommendation_arabic,
    laborLawReference: issue.labor_law_reference,
    affectedDocuments: issue.affected_sections || [],
    createdAt: issue.created_at,
    resolved: issue.resolved,
    resolvedAt: issue.resolved_at
  }));

  // Convert audit data to analytics format
  const auditTrail: AuditEntry[] = (auditData || []).map(audit => ({
    id: audit.id,
    action: audit.action,
    userId: audit.user_id,
    userName: 'Unknown User', // Would need to join with user data
    details: audit.new_values || {},
    timestamp: audit.created_at,
    ipAddress: audit.ip_address || '',
    userAgent: audit.user_agent || ''
  }));

  const complianceMetrics: ComplianceMetrics = {
    overallScore: Math.round(overallScore),
    categoryScores,
    riskLevel,
    issuesFound: analyticsIssues,
    complianceTrend,
    auditTrail,
    lastScanDate: scoresData && scoresData.length > 0 
      ? scoresData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : new Date().toISOString(),
    nextScheduledScan: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Next week
  };

  return complianceMetrics;
}

function generateCategoryScores(
  scoresData: any[],
  issuesData: any[],
  categories?: string[]
): CategoryScore[] {
  const allCategories = categories || ['employment', 'wages', 'termination', 'leave', 'working_hours', 'safety', 'discrimination'];
  
  return allCategories.map(category => {
    const categoryScores = scoresData.filter(score => score.category === category);
    const categoryIssues = issuesData.filter(issue => issue.category === category);
    
    const averageScore = categoryScores.length > 0 
      ? categoryScores.reduce((sum, score) => sum + score.score, 0) / categoryScores.length
      : 100;
    
    const issuesCount = categoryIssues.length;
    let status: 'compliant' | 'warning' | 'non_compliant' = 'compliant';
    
    if (averageScore < 60 || categoryIssues.some(issue => issue.severity === 'critical')) {
      status = 'non_compliant';
    } else if (averageScore < 80 || issuesCount > 0) {
      status = 'warning';
    }

    return {
      category,
      categoryArabic: getCategoryArabicName(category),
      score: Math.round(averageScore),
      maxScore: 100,
      percentage: Math.round(averageScore),
      status,
      issuesCount
    };
  });
}

function getCategoryArabicName(category: string): string {
  const categoryNames: { [key: string]: string } = {
    'employment': 'التوظيف',
    'wages': 'الأجور',
    'termination': 'إنهاء الخدمة',
    'leave': 'الإجازات',
    'working_hours': 'ساعات العمل',
    'safety': 'السلامة المهنية',
    'discrimination': 'عدم التمييز'
  };
  return categoryNames[category] || category;
}

async function generateComplianceTrends(
  supabase: any,
  organizationId: string,
  startDate: string,
  endDate: string,
  categories?: string[]
): Promise<ComplianceTrend[]> {
  // Generate daily compliance trends
  const { data: dailyScores } = await supabase
    .from('compliance_scores')
    .select('score, issues_found, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at');

  const { data: dailyIssues } = await supabase
    .from('compliance_issues')
    .select(`
      created_at,
      resolved,
      resolved_at,
      compliance_scores!inner(organization_id)
    `)
    .eq('compliance_scores.organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const trendsMap = new Map<string, ComplianceTrend>();

  // Process scores
  dailyScores?.forEach(score => {
    const date = new Date(score.created_at).toISOString().split('T')[0];
    if (!trendsMap.has(date)) {
      trendsMap.set(date, {
        date,
        score: 0,
        issuesCount: 0,
        resolvedIssues: 0
      });
    }
    const trend = trendsMap.get(date)!;
    trend.score = Math.max(trend.score, score.score);
    trend.issuesCount += score.issues_found || 0;
  });

  // Process resolved issues
  dailyIssues?.forEach(issue => {
    if (issue.resolved && issue.resolved_at) {
      const date = new Date(issue.resolved_at).toISOString().split('T')[0];
      const trend = trendsMap.get(date);
      if (trend) {
        trend.resolvedIssues++;
      }
    }
  });

  return Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
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