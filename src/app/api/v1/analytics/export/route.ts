import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { ExportOptions, ExportProgress, AnalyticsResponse } from '@/types/analytics';
import { getUserSession } from '@/features/account/controllers/get-session';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    // Get user session and check authentication
    const session = await getUserSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const exportOptions: ExportOptions = await request.json();

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to export analytics
    if (!['owner', 'admin', 'hr_manager'].includes(orgMember.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const orgId = orgMember.organization_id;

    // Create export job record
    const exportId = crypto.randomUUID();
    const exportProgress: ExportProgress = {
      id: exportId,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    // In a real implementation, this would be queued for background processing
    // For now, we'll generate a mock download URL
    setTimeout(async () => {
      try {
        // Update progress to processing
        await updateExportProgress(supabase, exportId, 'processing', 25);

        // Generate the export data
        const exportData = await generateExportData(supabase, orgId, exportOptions);
        
        // Update progress
        await updateExportProgress(supabase, exportId, 'processing', 75);

        // Generate file (mock)
        const downloadUrl = await generateExportFile(exportData, exportOptions);
        
        // Complete the export
        await updateExportProgress(supabase, exportId, 'completed', 100, downloadUrl);
      } catch (error) {
        console.error('Export generation failed:', error);
        await updateExportProgress(supabase, exportId, 'failed', 0, undefined, error as Error);
      }
    }, 1000);

    const response: AnalyticsResponse<ExportProgress> = {
      data: exportProgress,
      meta: {
        organizationId: orgId,
        dateRange: {
          start: format(exportOptions.dateRange.start, 'yyyy-MM-dd'),
          end: format(exportOptions.dateRange.end, 'yyyy-MM-dd'),
        },
        timezone: 'Asia/Riyadh',
        generatedAt: new Date().toISOString(),
      },
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Export creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user session and check authentication
    const session = await getUserSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const url = new URL(request.url);
    const exportId = url.searchParams.get('id');

    if (!exportId) {
      return NextResponse.json({ error: 'Export ID is required' }, { status: 400 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission
    if (!['owner', 'admin', 'hr_manager'].includes(orgMember.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get export progress (mock data for now)
    const exportProgress: ExportProgress = {
      id: exportId,
      status: 'completed',
      progress: 100,
      downloadUrl: `/api/v1/analytics/export/download?id=${exportId}&token=mock-token`,
      createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      completedAt: new Date().toISOString(),
    };

    const response: AnalyticsResponse<ExportProgress> = {
      data: exportProgress,
      meta: {
        organizationId: orgMember.organization_id,
        dateRange: {
          start: format(new Date(), 'yyyy-MM-dd'),
          end: format(new Date(), 'yyyy-MM-dd'),
        },
        timezone: 'Asia/Riyadh',
        generatedAt: new Date().toISOString(),
      },
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Export status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateExportProgress(
  supabase: any,
  exportId: string,
  status: ExportProgress['status'],
  progress: number,
  downloadUrl?: string,
  error?: Error
) {
  // In a real implementation, this would update a database record
  // For now, we'll just log the progress
  console.log('Export progress update:', {
    exportId,
    status,
    progress,
    downloadUrl,
    error: error?.message,
  });
}

async function generateExportData(supabase: any, orgId: string, options: ExportOptions) {
  const startDate = format(options.dateRange.start, 'yyyy-MM-dd');
  const endDate = format(options.dateRange.end, 'yyyy-MM-dd');

  const exportData: any = {};

  // Generate data based on requested metrics
  for (const metric of options.metrics) {
    switch (metric) {
      case 'usage':
        exportData.usage = await getUsageExportData(supabase, orgId, startDate, endDate);
        break;
      case 'cost':
        exportData.cost = await getCostExportData(supabase, orgId, startDate, endDate);
        break;
      case 'performance':
        exportData.performance = await getPerformanceExportData(supabase, orgId, startDate, endDate);
        break;
      case 'compliance':
        exportData.compliance = await getComplianceExportData(supabase, orgId);
        break;
      case 'activity':
        exportData.activity = await getActivityExportData(supabase, orgId, startDate, endDate);
        break;
    }
  }

  return exportData;
}

async function generateExportFile(data: any, options: ExportOptions): Promise<string> {
  // In a real implementation, this would generate the actual file
  // and upload it to a storage service (like Supabase Storage)
  
  switch (options.format) {
    case 'csv':
      return generateCSVFile(data);
    case 'excel':
      return generateExcelFile(data);
    case 'pdf':
      return generatePDFFile(data, options);
    default:
      throw new Error('Unsupported export format');
  }
}

async function generateCSVFile(data: any): Promise<string> {
  // Mock CSV generation - in production would use a proper CSV library
  console.log('Generating CSV file with data:', Object.keys(data));
  return 'https://mock-storage.example.com/exports/analytics-export.csv';
}

async function generateExcelFile(data: any): Promise<string> {
  // Mock Excel generation - in production would use a library like xlsx
  console.log('Generating Excel file with data:', Object.keys(data));
  return 'https://mock-storage.example.com/exports/analytics-export.xlsx';
}

async function generatePDFFile(data: any, options: ExportOptions): Promise<string> {
  // Mock PDF generation - in production would use a library like puppeteer or pdfkit
  console.log('Generating PDF file with data:', Object.keys(data));
  console.log('Include charts:', options.includeCharts);
  return 'https://mock-storage.example.com/exports/analytics-export.pdf';
}

// Data export functions (updated for new analytics schema)
async function getUsageExportData(supabase: any, orgId: string, startDate: string, endDate: string) {
  const { data: chatInteractions } = await supabase
    .from('chat_interactions')
    .select('id, created_at, message_type, tokens_input, tokens_output, cost_usd, success, user_id')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: documents } = await supabase
    .from('document_processing')
    .select('id, created_at, document_name, document_type, processing_type, success, cost_usd, user_id')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { data: templates } = await supabase
    .from('template_generation')
    .select('id, created_at, template_type, template_category, success, cost_usd, user_id')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  return {
    summary: {
      totalChatInteractions: chatInteractions?.length || 0,
      totalDocuments: documents?.length || 0,
      totalTemplates: templates?.length || 0,
      dateRange: { startDate, endDate },
    },
    rawData: {
      chatInteractions: chatInteractions || [],
      documents: documents || [],
      templates: templates || [],
    },
  };
}

async function getCostExportData(supabase: any, orgId: string, startDate: string, endDate: string) {
  const { data: costData } = await supabase
    .from('cost_tracking')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const totalCost = costData?.reduce((sum: number, record: any) => sum + (record.total_cost_usd || 0), 0) || 0;
  const totalTokens = costData?.reduce((sum: number, record: any) => sum + (record.tokens_input || 0) + (record.tokens_output || 0), 0) || 0;

  return {
    summary: {
      totalTokens,
      totalCost,
      averageCostPerToken: totalTokens > 0 ? totalCost / totalTokens : 0,
      dateRange: { startDate, endDate },
    },
    rawData: {
      costTracking: costData || [],
    },
  };
}

async function getPerformanceExportData(supabase: any, orgId: string, startDate: string, endDate: string) {
  const { data: performanceData } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('organization_id', orgId)
    .gte('recorded_at', startDate)
    .lte('recorded_at', endDate);

  const { data: apiUsage } = await supabase
    .from('api_usage')
    .select('response_time_ms, status_code, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const avgResponseTime = apiUsage?.length > 0
    ? apiUsage.reduce((sum, api) => sum + (api.response_time_ms || 0), 0) / apiUsage.length
    : 0;

  const errorRate = apiUsage?.length > 0
    ? (apiUsage.filter(api => api.status_code >= 400).length / apiUsage.length) * 100
    : 0;

  return {
    summary: {
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: apiUsage?.length || 0,
      dateRange: { startDate, endDate },
    },
    rawData: {
      performanceMetrics: performanceData || [],
      apiUsage: apiUsage || [],
    },
  };
}

async function getComplianceExportData(supabase: any, orgId: string) {
  const { data: complianceScores } = await supabase
    .from('compliance_scores')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: complianceIssues } = await supabase
    .from('compliance_issues')
    .select('*, compliance_scores!inner(organization_id)')
    .eq('compliance_scores.organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  const latestScore = complianceScores?.length > 0 
    ? complianceScores.reduce((sum, score) => sum + score.score, 0) / complianceScores.length
    : 0;

  const openIssues = complianceIssues?.filter(issue => !issue.resolved).length || 0;
  const totalIssues = complianceIssues?.length || 0;

  return {
    summary: {
      latestScore: Math.round(latestScore),
      openIssues,
      totalIssues,
      riskLevel: latestScore >= 80 ? 'low' : latestScore >= 60 ? 'medium' : 'high',
    },
    rawData: {
      complianceScores: complianceScores || [],
      complianceIssues: complianceIssues || [],
    },
  };
}

async function getActivityExportData(supabase: any, orgId: string, startDate: string, endDate: string) {
  const { data: auditTrail } = await supabase
    .from('audit_trail')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .limit(1000); // Limit for export

  const { data: analyticsEvents } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .limit(1000);

  const { data: userSessions } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('organization_id', orgId)
    .gte('session_start', startDate)
    .lte('session_start', endDate)
    .limit(500);

  const allActivities = [
    ...(auditTrail || []),
    ...(analyticsEvents || []),
  ];

  return {
    summary: {
      totalAuditEntries: auditTrail?.length || 0,
      totalAnalyticsEvents: analyticsEvents?.length || 0,
      totalSessions: userSessions?.length || 0,
      uniqueUsers: new Set([
        ...(auditTrail?.map(log => log.user_id).filter(Boolean) || []),
        ...(analyticsEvents?.map(event => event.user_id).filter(Boolean) || []),
        ...(userSessions?.map(session => session.user_id).filter(Boolean) || [])
      ]).size,
      dateRange: { startDate, endDate },
    },
    rawData: {
      auditTrail: auditTrail || [],
      analyticsEvents: analyticsEvents || [],
      userSessions: userSessions || [],
    },
  };
}