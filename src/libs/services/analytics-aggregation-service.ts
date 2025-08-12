import { createClient } from '@/libs/supabase/server';
import cron from 'node-cron';

interface AggregationJob {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

class AnalyticsAggregationService {
  private static instance: AnalyticsAggregationService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private supabase = createClient();

  static getInstance(): AnalyticsAggregationService {
    if (!AnalyticsAggregationService.instance) {
      AnalyticsAggregationService.instance = new AnalyticsAggregationService();
    }
    return AnalyticsAggregationService.instance;
  }

  private constructor() {
    this.initializeJobs();
  }

  private initializeJobs() {
    const jobs: AggregationJob[] = [
      {
        name: 'hourly-metrics-aggregation',
        schedule: '0 * * * *', // Every hour
        handler: this.aggregateHourlyMetrics.bind(this),
        enabled: true
      },
      {
        name: 'daily-metrics-aggregation',
        schedule: '0 0 * * *', // Daily at midnight
        handler: this.aggregateDailyMetrics.bind(this),
        enabled: true
      },
      {
        name: 'weekly-metrics-aggregation',
        schedule: '0 0 * * 0', // Weekly on Sundays
        handler: this.aggregateWeeklyMetrics.bind(this),
        enabled: true
      },
      {
        name: 'monthly-metrics-aggregation',
        schedule: '0 0 1 * *', // Monthly on 1st day
        handler: this.aggregateMonthlyMetrics.bind(this),
        enabled: true
      },
      {
        name: 'cleanup-old-data',
        schedule: '0 2 * * *', // Daily at 2 AM
        handler: this.cleanupOldData.bind(this),
        enabled: true
      },
      {
        name: 'performance-monitoring',
        schedule: '*/5 * * * *', // Every 5 minutes
        handler: this.monitorPerformance.bind(this),
        enabled: true
      },
      {
        name: 'cost-alerts-check',
        schedule: '*/15 * * * *', // Every 15 minutes
        handler: this.checkCostAlerts.bind(this),
        enabled: true
      }
    ];

    jobs.forEach(job => {
      if (job.enabled) {
        this.scheduleJob(job.name, job.schedule, job.handler);
      }
    });

    console.log('Analytics aggregation service initialized with', jobs.filter(j => j.enabled).length, 'jobs');
  }

  private scheduleJob(name: string, schedule: string, handler: () => Promise<void>) {
    const task = cron.schedule(schedule, async () => {
      const startTime = Date.now();
      console.log(`Starting job: ${name} at ${new Date().toISOString()}`);
      
      try {
        await handler();
        const duration = Date.now() - startTime;
        console.log(`Completed job: ${name} in ${duration}ms`);
        
        // Log job execution
        await this.logJobExecution(name, 'success', duration);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Failed job: ${name} after ${duration}ms`, error);
        
        // Log job failure
        await this.logJobExecution(name, 'error', duration, error.message);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    this.jobs.set(name, task);
  }

  public startJobs() {
    this.jobs.forEach((task, name) => {
      task.start();
      console.log(`Started job: ${name}`);
    });
  }

  public stopJobs() {
    this.jobs.forEach((task, name) => {
      task.stop();
      console.log(`Stopped job: ${name}`);
    });
  }

  public stopJob(name: string) {
    const task = this.jobs.get(name);
    if (task) {
      task.stop();
      console.log(`Stopped job: ${name}`);
    }
  }

  public startJob(name: string) {
    const task = this.jobs.get(name);
    if (task) {
      task.start();
      console.log(`Started job: ${name}`);
    }
  }

  private async logJobExecution(
    jobName: string, 
    status: 'success' | 'error', 
    duration: number, 
    errorMessage?: string
  ) {
    try {
      await this.supabase.from('analytics_job_logs').insert({
        job_name: jobName,
        status,
        duration_ms: duration,
        error_message: errorMessage,
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log job execution:', error);
    }
  }

  // Aggregation Handlers
  private async aggregateHourlyMetrics() {
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1, 0, 0, 0);
    const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1, 59, 59, 999);

    console.log(`Aggregating hourly metrics for period: ${hourStart.toISOString()} - ${hourEnd.toISOString()}`);

    // Get all organizations to process
    const { data: organizations } = await this.supabase
      .from('organizations')
      .select('id');

    if (!organizations) return;

    for (const org of organizations) {
      await this.aggregateMetricsForPeriod(
        org.id,
        hourStart.toISOString(),
        hourEnd.toISOString(),
        'hourly_usage',
        'hour'
      );
    }
  }

  private async aggregateDailyMetrics() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

    console.log(`Aggregating daily metrics for period: ${dayStart.toISOString()} - ${dayEnd.toISOString()}`);

    // Get all organizations to process
    const { data: organizations } = await this.supabase
      .from('organizations')
      .select('id');

    if (!organizations) return;

    for (const org of organizations) {
      // Call the database function to aggregate daily metrics
      await this.supabase.rpc('aggregate_daily_metrics', {
        target_date: dayStart.toISOString().split('T')[0],
        org_id: org.id
      });

      await this.aggregateMetricsForPeriod(
        org.id,
        dayStart.toISOString(),
        dayEnd.toISOString(),
        'daily_usage',
        'day'
      );
    }
  }

  private async aggregateWeeklyMetrics() {
    const now = new Date();
    const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay()); // Start of week (Sunday)
    const weekEnd = new Date(lastWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);

    console.log(`Aggregating weekly metrics for period: ${lastWeekStart.toISOString()} - ${weekEnd.toISOString()}`);

    // Get all organizations
    const { data: organizations } = await this.supabase
      .from('organizations')
      .select('id');

    if (!organizations) return;

    for (const org of organizations) {
      await this.aggregateMetricsForPeriod(
        org.id,
        lastWeekStart.toISOString(),
        weekEnd.toISOString(),
        'weekly_usage',
        'week'
      );
    }
  }

  private async aggregateMonthlyMetrics() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    console.log(`Aggregating monthly metrics for period: ${lastMonth.toISOString()} - ${monthEnd.toISOString()}`);

    // Get all organizations
    const { data: organizations } = await this.supabase
      .from('organizations')
      .select('id');

    if (!organizations) return;

    for (const org of organizations) {
      await this.aggregateMetricsForPeriod(
        org.id,
        lastMonth.toISOString(),
        monthEnd.toISOString(),
        'monthly_usage',
        'month'
      );
    }
  }

  private async aggregateMetricsForPeriod(
    organizationId: string,
    startDate: string,
    endDate: string,
    metricType: string,
    period: string
  ) {
    try {
      // Get chat interactions for the period
      const { data: chatData } = await this.supabase
        .from('chat_interactions')
        .select('id, tokens_input, tokens_output, cost_usd, response_time_ms, success, user_id')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get document processing for the period
      const { data: docData } = await this.supabase
        .from('document_processing')
        .select('id, cost_usd, processing_time_ms, success, user_id, pages_processed')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get template generation for the period
      const { data: templateData } = await this.supabase
        .from('template_generation')
        .select('id, cost_usd, generation_time_ms, success, user_id, tokens_used')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get API usage for the period
      const { data: apiData } = await this.supabase
        .from('api_usage')
        .select('id, response_time_ms, status_code, user_id')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Calculate aggregated metrics
      const aggregatedData = {
        chat_interactions: {
          total_count: chatData?.length || 0,
          successful_count: chatData?.filter(c => c.success).length || 0,
          total_tokens: chatData?.reduce((sum, c) => sum + (c.tokens_input || 0) + (c.tokens_output || 0), 0) || 0,
          total_cost: chatData?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0,
          avg_response_time: this.calculateAverage(chatData?.map(c => c.response_time_ms).filter(Boolean) || []),
          unique_users: new Set(chatData?.map(c => c.user_id).filter(Boolean) || []).size
        },
        document_processing: {
          total_count: docData?.length || 0,
          successful_count: docData?.filter(d => d.success).length || 0,
          total_cost: docData?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) || 0,
          avg_processing_time: this.calculateAverage(docData?.map(d => d.processing_time_ms).filter(Boolean) || []),
          total_pages: docData?.reduce((sum, d) => sum + (d.pages_processed || 0), 0) || 0,
          unique_users: new Set(docData?.map(d => d.user_id).filter(Boolean) || []).size
        },
        template_generation: {
          total_count: templateData?.length || 0,
          successful_count: templateData?.filter(t => t.success).length || 0,
          total_cost: templateData?.reduce((sum, t) => sum + (t.cost_usd || 0), 0) || 0,
          avg_generation_time: this.calculateAverage(templateData?.map(t => t.generation_time_ms).filter(Boolean) || []),
          total_tokens: templateData?.reduce((sum, t) => sum + (t.tokens_used || 0), 0) || 0,
          unique_users: new Set(templateData?.map(t => t.user_id).filter(Boolean) || []).size
        },
        api_usage: {
          total_count: apiData?.length || 0,
          successful_count: apiData?.filter(a => a.status_code < 400).length || 0,
          avg_response_time: this.calculateAverage(apiData?.map(a => a.response_time_ms).filter(Boolean) || []),
          error_rate: apiData?.length > 0 ? (apiData.filter(a => a.status_code >= 400).length / apiData.length) : 0
        },
        summary: {
          total_operations: (chatData?.length || 0) + (docData?.length || 0) + (templateData?.length || 0),
          total_cost: (chatData?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0) +
                     (docData?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) || 0) +
                     (templateData?.reduce((sum, t) => sum + (t.cost_usd || 0), 0) || 0),
          unique_active_users: new Set([
            ...(chatData?.map(c => c.user_id).filter(Boolean) || []),
            ...(docData?.map(d => d.user_id).filter(Boolean) || []),
            ...(templateData?.map(t => t.user_id).filter(Boolean) || [])
          ]).size
        }
      };

      // Store aggregated data
      await this.supabase
        .from('data_aggregations')
        .upsert({
          organization_id: organizationId,
          metric_type: metricType,
          aggregation_period: period,
          period_start: startDate,
          period_end: endDate,
          aggregated_data: aggregatedData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'organization_id,metric_type,aggregation_period,period_start'
        });

      console.log(`Aggregated ${metricType} metrics for organization ${organizationId}: ${aggregatedData.summary.total_operations} operations, ${aggregatedData.summary.unique_active_users} users`);
    } catch (error) {
      console.error(`Error aggregating metrics for organization ${organizationId}:`, error);
      throw error;
    }
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private async cleanupOldData() {
    console.log('Starting cleanup of old analytics data');

    try {
      // Call the database cleanup function
      await this.supabase.rpc('cleanup_old_analytics_data');
      console.log('Completed cleanup of old analytics data');
    } catch (error) {
      console.error('Error during data cleanup:', error);
      throw error;
    }
  }

  private async monitorPerformance() {
    try {
      // Get all organizations for monitoring
      const { data: organizations } = await this.supabase
        .from('organizations')
        .select('id');

      if (!organizations) return;

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      for (const org of organizations) {
        // Monitor API response times
        const { data: recentApiCalls } = await this.supabase
          .from('api_usage')
          .select('response_time_ms, status_code')
          .eq('organization_id', org.id)
          .gte('created_at', fiveMinutesAgo.toISOString())
          .not('response_time_ms', 'is', null);

        if (recentApiCalls && recentApiCalls.length > 0) {
          const avgResponseTime = this.calculateAverage(recentApiCalls.map(call => call.response_time_ms));
          const errorRate = recentApiCalls.filter(call => call.status_code >= 400).length / recentApiCalls.length;
          const throughput = recentApiCalls.length / 5; // per minute

          // Store performance metrics
          await this.supabase.from('performance_metrics').insert([
            {
              organization_id: org.id,
              metric_type: 'response_time',
              metric_value: avgResponseTime,
              measurement_unit: 'milliseconds',
              service_name: 'api',
              aggregation_period: 'minute',
              recorded_at: now.toISOString()
            },
            {
              organization_id: org.id,
              metric_type: 'error_rate',
              metric_value: errorRate * 100,
              measurement_unit: 'percentage',
              service_name: 'api',
              aggregation_period: 'minute',
              recorded_at: now.toISOString()
            },
            {
              organization_id: org.id,
              metric_type: 'throughput',
              metric_value: throughput,
              measurement_unit: 'requests_per_minute',
              service_name: 'api',
              aggregation_period: 'minute',
              recorded_at: now.toISOString()
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Error monitoring performance:', error);
    }
  }

  private async checkCostAlerts() {
    try {
      console.log('Checking cost alerts');
      
      // Get all organizations
      const { data: organizations } = await this.supabase
        .from('organizations')
        .select('id, monthly_budget_usd');

      if (!organizations) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      for (const org of organizations) {
        // Get month-to-date spending
        const { data: monthlyCosts } = await this.supabase
          .from('cost_tracking')
          .select('total_cost_usd')
          .eq('organization_id', org.id)
          .gte('created_at', monthStart.toISOString());

        const monthlySpend = monthlyCosts?.reduce((sum, cost) => sum + (cost.total_cost_usd || 0), 0) || 0;
        const monthlyBudget = org.monthly_budget_usd || 1000; // Default budget
        const utilizationPercentage = (monthlySpend / monthlyBudget) * 100;

        // Create alerts based on thresholds
        const alerts = [];
        
        if (utilizationPercentage >= 90) {
          alerts.push({
            organization_id: org.id,
            alert_type: 'cost_threshold',
            severity: 'critical',
            title: 'Monthly Budget Almost Exceeded',
            title_arabic: 'الميزانية الشهرية على وشك الانتهاء',
            message: `Monthly spending is at ${utilizationPercentage.toFixed(1)}% of budget ($${monthlySpend.toFixed(2)} / $${monthlyBudget})`,
            message_arabic: `الإنفاق الشهري ${utilizationPercentage.toFixed(1)}% من الميزانية (${monthlySpend.toFixed(2)} دولار / ${monthlyBudget} دولار)`,
            threshold: monthlyBudget * 0.9,
            current_value: monthlySpend,
            metadata: {
              budget: monthlyBudget,
              spend: monthlySpend,
              utilization: utilizationPercentage
            }
          });
        } else if (utilizationPercentage >= 75) {
          alerts.push({
            organization_id: org.id,
            alert_type: 'cost_threshold',
            severity: 'warning',
            title: 'High Monthly Spending',
            title_arabic: 'إنفاق شهري مرتفع',
            message: `Monthly spending is at ${utilizationPercentage.toFixed(1)}% of budget ($${monthlySpend.toFixed(2)} / $${monthlyBudget})`,
            message_arabic: `الإنفاق الشهري ${utilizationPercentage.toFixed(1)}% من الميزانية (${monthlySpend.toFixed(2)} دولار / ${monthlyBudget} دولار)`,
            threshold: monthlyBudget * 0.75,
            current_value: monthlySpend,
            metadata: {
              budget: monthlyBudget,
              spend: monthlySpend,
              utilization: utilizationPercentage
            }
          });
        }

        if (alerts.length > 0) {
          await this.supabase.from('analytics_alerts').insert(alerts);
          console.log(`Created ${alerts.length} cost alert(s) for organization ${org.id}`);
        }
      }
    } catch (error) {
      console.error('Error checking cost alerts:', error);
    }
  }

  // Public methods for manual operations
  public async aggregateDataForOrganization(organizationId: string, period: 'hour' | 'day' | 'week' | 'month') {
    const now = new Date();
    let startDate: Date, endDate: Date, metricType: string;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        endDate = now;
        metricType = 'hourly_usage';
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        endDate = now;
        metricType = 'daily_usage';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        metricType = 'weekly_usage';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        metricType = 'monthly_usage';
        break;
    }

    await this.aggregateMetricsForPeriod(
      organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
      metricType,
      period
    );
  }
}

// Export singleton instance
export const analyticsAggregationService = AnalyticsAggregationService.getInstance();

// Auto-start jobs in production
if (process.env.NODE_ENV === 'production') {
  analyticsAggregationService.startJobs();
  console.log('Analytics aggregation service started in production mode');
}