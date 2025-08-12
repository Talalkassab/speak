import { trace } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';

// Prometheus metrics for cost monitoring
const openRouterCost = new promClient.Counter({
  name: 'openrouter_cost_usd_total',
  help: 'Total cost for OpenRouter API usage in USD',
  labelNames: ['model', 'organization_id', 'operation_type'],
});

const openRouterTokens = new promClient.Counter({
  name: 'openrouter_tokens_total',
  help: 'Total tokens used in OpenRouter API calls',
  labelNames: ['model', 'organization_id', 'token_type'], // prompt_tokens, completion_tokens
});

const openRouterRequests = new promClient.Counter({
  name: 'openrouter_requests_total',
  help: 'Total number of OpenRouter API requests',
  labelNames: ['model', 'organization_id', 'status'],
});

const organizationCostBudget = new promClient.Gauge({
  name: 'organization_cost_budget_usd',
  help: 'Organization cost budget in USD',
  labelNames: ['organization_id', 'period'],
});

const organizationCostSpent = new promClient.Gauge({
  name: 'organization_cost_spent_usd',
  help: 'Organization cost spent in USD',
  labelNames: ['organization_id', 'period'],
});

export interface OpenRouterUsage {
  model: string;
  organizationId: string;
  userId?: string;
  operationType: 'chat' | 'embedding' | 'completion' | 'search';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number; // in USD
  requestId?: string;
  conversationId?: string;
  timestamp?: Date;
  metadata?: {
    query?: string;
    responseLength?: number;
    processingTime?: number;
    additionalData?: Record<string, any>;
  };
}

export interface CostAlert {
  id: string;
  organizationId: string;
  threshold: number; // in USD
  period: 'daily' | 'weekly' | 'monthly';
  currentSpend: number;
  triggered: boolean;
  lastTriggered?: Date;
  actions: {
    email?: string[];
    webhook?: string;
    throttle?: boolean; // throttle API calls when threshold reached
  };
}

export interface CostBudget {
  organizationId: string;
  daily: number;
  weekly: number;
  monthly: number;
  alertThresholds: {
    daily: number[]; // e.g., [0.8, 0.9, 1.0] for 80%, 90%, 100%
    weekly: number[];
    monthly: number[];
  };
}

export interface CostStats {
  organizationId: string;
  period: 'day' | 'week' | 'month';
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costByModel: Record<string, number>;
  costByOperation: Record<string, number>;
  averageCostPerRequest: number;
  averageCostPerToken: number;
  projectedMonthlyCost: number;
  budget?: {
    limit: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  };
}

class CostMonitor {
  private tracer = trace.getTracer('hr-rag-platform-cost');
  private supabase = createSupabaseAdminClient();
  private costAlerts: Map<string, CostAlert> = new Map();
  private costBudgets: Map<string, CostBudget> = new Map();

  // OpenRouter model pricing (per 1M tokens)
  private readonly MODEL_PRICING = {
    'meta-llama/llama-3.2-3b-instruct:free': { prompt: 0, completion: 0 },
    'meta-llama/llama-3.2-1b-instruct:free': { prompt: 0, completion: 0 },
    'anthropic/claude-3.5-sonnet': { prompt: 3.0, completion: 15.0 },
    'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
    'openai/gpt-4o': { prompt: 2.5, completion: 10.0 },
    'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
    'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
  };

  constructor() {
    this.loadCostAlerts();
    this.loadCostBudgets();
    this.startCostMonitoring();
  }

  /**
   * Track OpenRouter API usage and cost
   */
  async trackOpenRouterUsage(usage: OpenRouterUsage): Promise<void> {
    const timestamp = usage.timestamp || new Date();

    // Update Prometheus metrics
    openRouterCost.inc({
      model: usage.model,
      organization_id: usage.organizationId,
      operation_type: usage.operationType,
    }, usage.cost);

    openRouterTokens.inc({
      model: usage.model,
      organization_id: usage.organizationId,
      token_type: 'prompt_tokens',
    }, usage.promptTokens);

    openRouterTokens.inc({
      model: usage.model,
      organization_id: usage.organizationId,
      token_type: 'completion_tokens',
    }, usage.completionTokens);

    openRouterRequests.inc({
      model: usage.model,
      organization_id: usage.organizationId,
      status: 'success',
    });

    // Create OpenTelemetry span
    const span = this.tracer.startSpan(`OpenRouter API: ${usage.operationType}`, {
      attributes: {
        'openrouter.model': usage.model,
        'openrouter.operation': usage.operationType,
        'openrouter.cost': usage.cost,
        'openrouter.tokens.prompt': usage.promptTokens,
        'openrouter.tokens.completion': usage.completionTokens,
        'openrouter.tokens.total': usage.totalTokens,
        'organization.id': usage.organizationId,
        'user.id': usage.userId,
        'request.id': usage.requestId,
        'conversation.id': usage.conversationId,
      },
    });

    span.end();

    try {
      // Store in database
      await this.supabase
        .from('openrouter_usage_logs')
        .insert({
          model: usage.model,
          organization_id: usage.organizationId,
          user_id: usage.userId,
          operation_type: usage.operationType,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          cost_usd: usage.cost,
          request_id: usage.requestId,
          conversation_id: usage.conversationId,
          query_text: usage.metadata?.query,
          response_length: usage.metadata?.responseLength,
          processing_time_ms: usage.metadata?.processingTime,
          metadata: usage.metadata?.additionalData,
          created_at: timestamp.toISOString(),
        });

      // Check cost alerts
      await this.checkCostAlerts(usage.organizationId, usage.cost);

    } catch (error) {
      console.error('Failed to store OpenRouter usage:', error);
    }
  }

  /**
   * Calculate cost for OpenRouter usage
   */
  calculateOpenRouterCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = this.MODEL_PRICING[model as keyof typeof this.MODEL_PRICING];
    
    if (!pricing) {
      console.warn(`Unknown model pricing for: ${model}`);
      return 0;
    }

    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    
    return promptCost + completionCost;
  }

  /**
   * Set cost budget for organization
   */
  async setCostBudget(budget: CostBudget): Promise<void> {
    this.costBudgets.set(budget.organizationId, budget);

    // Update Prometheus metrics
    organizationCostBudget.set(
      { organization_id: budget.organizationId, period: 'daily' },
      budget.daily
    );
    organizationCostBudget.set(
      { organization_id: budget.organizationId, period: 'weekly' },
      budget.weekly
    );
    organizationCostBudget.set(
      { organization_id: budget.organizationId, period: 'monthly' },
      budget.monthly
    );

    try {
      // Store in database
      await this.supabase
        .from('organization_cost_budgets')
        .upsert({
          organization_id: budget.organizationId,
          daily_budget: budget.daily,
          weekly_budget: budget.weekly,
          monthly_budget: budget.monthly,
          alert_thresholds: budget.alertThresholds,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to store cost budget:', error);
    }
  }

  /**
   * Get cost statistics for organization
   */
  async getCostStats(
    organizationId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<CostStats> {
    const periodStart = this.getPeriodStart(period);
    
    try {
      const { data: usageData } = await this.supabase
        .from('openrouter_usage_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart.toISOString());

      if (!usageData || usageData.length === 0) {
        return this.getEmptyCostStats(organizationId, period);
      }

      // Calculate totals
      const totalCost = usageData.reduce((sum, item) => sum + item.cost_usd, 0);
      const totalTokens = usageData.reduce((sum, item) => sum + item.total_tokens, 0);
      const totalRequests = usageData.length;

      // Group by model
      const costByModel: Record<string, number> = {};
      usageData.forEach(item => {
        costByModel[item.model] = (costByModel[item.model] || 0) + item.cost_usd;
      });

      // Group by operation
      const costByOperation: Record<string, number> = {};
      usageData.forEach(item => {
        costByOperation[item.operation_type] = 
          (costByOperation[item.operation_type] || 0) + item.cost_usd;
      });

      // Calculate averages
      const averageCostPerRequest = totalCost / totalRequests;
      const averageCostPerToken = totalTokens > 0 ? totalCost / totalTokens : 0;

      // Project monthly cost based on current usage
      const daysInPeriod = this.getDaysInPeriod(period);
      const dailyAverage = totalCost / daysInPeriod;
      const projectedMonthlyCost = dailyAverage * 30;

      // Get budget information
      const budget = this.costBudgets.get(organizationId);
      let budgetInfo;
      
      if (budget) {
        const budgetLimit = budget[period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'];
        budgetInfo = {
          limit: budgetLimit,
          spent: totalCost,
          remaining: Math.max(0, budgetLimit - totalCost),
          percentUsed: (totalCost / budgetLimit) * 100,
        };
      }

      return {
        organizationId,
        period,
        totalCost,
        totalTokens,
        totalRequests,
        costByModel,
        costByOperation,
        averageCostPerRequest,
        averageCostPerToken,
        projectedMonthlyCost,
        budget: budgetInfo,
      };
    } catch (error) {
      console.error('Failed to get cost stats:', error);
      return this.getEmptyCostStats(organizationId, period);
    }
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(
    organizationId: string,
    days: number = 30
  ): Promise<Array<{ date: string; cost: number; tokens: number; requests: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const { data } = await this.supabase
        .from('openrouter_usage_logs')
        .select('created_at, cost_usd, total_tokens')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      if (!data) return [];

      // Group by date
      const trends = new Map<string, { cost: number; tokens: number; requests: number }>();
      
      data.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        const existing = trends.get(date) || { cost: 0, tokens: 0, requests: 0 };
        
        trends.set(date, {
          cost: existing.cost + item.cost_usd,
          tokens: existing.tokens + item.total_tokens,
          requests: existing.requests + 1,
        });
      });

      return Array.from(trends.entries()).map(([date, stats]) => ({
        date,
        ...stats,
      }));
    } catch (error) {
      console.error('Failed to get cost trends:', error);
      return [];
    }
  }

  /**
   * Check if organization is approaching cost limits
   */
  async checkCostAlerts(organizationId: string, additionalCost: number = 0): Promise<void> {
    const budget = this.costBudgets.get(organizationId);
    if (!budget) return;

    const periods: Array<'day' | 'week' | 'month'> = ['day', 'week', 'month'];
    
    for (const period of periods) {
      const stats = await this.getCostStats(organizationId, period);
      const currentSpend = stats.totalCost + additionalCost;
      const budgetLimit = budget[period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'];
      const thresholds = budget.alertThresholds[period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'];

      for (const threshold of thresholds) {
        const alertThreshold = budgetLimit * threshold;
        
        if (currentSpend >= alertThreshold) {
          await this.triggerCostAlert({
            id: `${organizationId}_${period}_${threshold}`,
            organizationId,
            threshold: alertThreshold,
            period,
            currentSpend,
            triggered: true,
            lastTriggered: new Date(),
            actions: {
              email: [], // Configure as needed
              throttle: threshold >= 1.0, // Throttle at 100% budget
            },
          });
        }
      }
    }
  }

  /**
   * Trigger cost alert
   */
  private async triggerCostAlert(alert: CostAlert): Promise<void> {
    console.log(`Cost alert triggered: ${alert.organizationId} - $${alert.currentSpend.toFixed(2)} / $${alert.threshold.toFixed(2)} (${alert.period})`);

    this.costAlerts.set(alert.id, alert);

    try {
      // Store alert in database
      await this.supabase
        .from('cost_alerts')
        .upsert({
          id: alert.id,
          organization_id: alert.organizationId,
          threshold_usd: alert.threshold,
          period: alert.period,
          current_spend_usd: alert.currentSpend,
          triggered: alert.triggered,
          last_triggered: alert.lastTriggered?.toISOString(),
          actions: alert.actions,
        });

      // TODO: Implement actual alerting (email, webhook, Slack)
      
    } catch (error) {
      console.error('Failed to store cost alert:', error);
    }
  }

  /**
   * Check if organization should be throttled due to budget limits
   */
  shouldThrottleOrganization(organizationId: string): boolean {
    const alerts = Array.from(this.costAlerts.values())
      .filter(alert => 
        alert.organizationId === organizationId && 
        alert.triggered && 
        alert.actions.throttle
      );

    return alerts.length > 0;
  }

  /**
   * Get model recommendations based on cost efficiency
   */
  getModelRecommendations(organizationId: string): Array<{
    model: string;
    reason: string;
    estimatedSavings?: number;
  }> {
    // This would analyze usage patterns and suggest more cost-effective models
    // For now, return some basic recommendations
    return [
      {
        model: 'openai/gpt-4o-mini',
        reason: 'Most cost-effective for general queries with good quality',
      },
      {
        model: 'anthropic/claude-3-haiku',
        reason: 'Fast and economical for simple document processing',
      },
      {
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        reason: 'Free model for basic operations (no API costs)',
      },
    ];
  }

  /**
   * Load cost alerts from database
   */
  private async loadCostAlerts(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('cost_alerts')
        .select('*')
        .eq('triggered', true);

      if (data) {
        data.forEach(alert => {
          this.costAlerts.set(alert.id, {
            id: alert.id,
            organizationId: alert.organization_id,
            threshold: alert.threshold_usd,
            period: alert.period,
            currentSpend: alert.current_spend_usd,
            triggered: alert.triggered,
            lastTriggered: alert.last_triggered ? new Date(alert.last_triggered) : undefined,
            actions: alert.actions,
          });
        });
      }
    } catch (error) {
      console.error('Failed to load cost alerts:', error);
    }
  }

  /**
   * Load cost budgets from database
   */
  private async loadCostBudgets(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('organization_cost_budgets')
        .select('*');

      if (data) {
        data.forEach(budget => {
          this.costBudgets.set(budget.organization_id, {
            organizationId: budget.organization_id,
            daily: budget.daily_budget,
            weekly: budget.weekly_budget,
            monthly: budget.monthly_budget,
            alertThresholds: budget.alert_thresholds,
          });
        });
      }
    } catch (error) {
      console.error('Failed to load cost budgets:', error);
    }
  }

  /**
   * Start cost monitoring
   */
  private startCostMonitoring(): void {
    // Update cost metrics every 5 minutes
    setInterval(async () => {
      for (const [orgId] of this.costBudgets) {
        const stats = await this.getCostStats(orgId, 'day');
        organizationCostSpent.set(
          { organization_id: orgId, period: 'daily' },
          stats.totalCost
        );
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get period start date
   */
  private getPeriodStart(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get days in period
   */
  private getDaysInPeriod(period: 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
    }
  }

  /**
   * Get empty cost stats
   */
  private getEmptyCostStats(organizationId: string, period: 'day' | 'week' | 'month'): CostStats {
    return {
      organizationId,
      period,
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      costByModel: {},
      costByOperation: {},
      averageCostPerRequest: 0,
      averageCostPerToken: 0,
      projectedMonthlyCost: 0,
    };
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }
}

// Singleton instance
export const costMonitor = new CostMonitor();
export default costMonitor;