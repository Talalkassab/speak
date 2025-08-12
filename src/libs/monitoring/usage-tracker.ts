import { trace } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { createSupabaseAdminClient } from '../supabase/supabase-admin';

// Prometheus metrics for usage tracking
const featureUsage = new promClient.Counter({
  name: 'feature_usage_total',
  help: 'Total feature usage count',
  labelNames: ['feature', 'organization_id', 'user_id', 'result'],
});

const userSessions = new promClient.Gauge({
  name: 'active_user_sessions',
  help: 'Number of active user sessions',
  labelNames: ['organization_id'],
});

const documentProcessingUsage = new promClient.Counter({
  name: 'document_processing_total',
  help: 'Total document processing operations',
  labelNames: ['operation_type', 'organization_id', 'file_type', 'result'],
});

const chatInteractions = new promClient.Counter({
  name: 'chat_interactions_total',
  help: 'Total chat interactions',
  labelNames: ['organization_id', 'conversation_type', 'source'],
});

const apiUsage = new promClient.Counter({
  name: 'api_usage_total',
  help: 'Total API usage',
  labelNames: ['endpoint', 'method', 'organization_id', 'user_tier'],
});

export type FeatureType = 
  | 'document_upload'
  | 'document_search'
  | 'chat_query'
  | 'template_generation'
  | 'bulk_processing'
  | 'compliance_check'
  | 'analytics_view'
  | 'export_data'
  | 'user_management'
  | 'settings_update';

export type DocumentOperationType = 
  | 'upload'
  | 'process'
  | 'reprocess'
  | 'delete'
  | 'export'
  | 'categorize';

export type ConversationType = 
  | 'legal_consultation'
  | 'policy_inquiry'
  | 'compliance_check'
  | 'general_hr'
  | 'labor_law';

export interface FeatureUsageEvent {
  feature: FeatureType;
  userId: string;
  organizationId: string;
  result: 'success' | 'error' | 'partial';
  metadata?: {
    duration?: number;
    itemsProcessed?: number;
    fileSize?: number;
    additionalData?: Record<string, any>;
  };
  timestamp?: Date;
}

export interface DocumentProcessingEvent {
  operationType: DocumentOperationType;
  organizationId: string;
  userId: string;
  fileType: string;
  fileSize: number;
  result: 'success' | 'error' | 'partial';
  processingTime?: number;
  metadata?: {
    pagesProcessed?: number;
    textExtracted?: number;
    embeddings?: number;
    additionalData?: Record<string, any>;
  };
  timestamp?: Date;
}

export interface ChatInteractionEvent {
  organizationId: string;
  userId: string;
  conversationId: string;
  conversationType: ConversationType;
  source: 'web' | 'api' | 'mobile';
  query: string;
  responseTime?: number;
  documentsRetrieved?: number;
  tokensUsed?: number;
  cost?: number;
  timestamp?: Date;
}

export interface ApiUsageEvent {
  endpoint: string;
  method: string;
  organizationId: string;
  userId?: string;
  userTier: string;
  statusCode: number;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
  timestamp?: Date;
}

export interface UsageStats {
  organizationId: string;
  period: 'day' | 'week' | 'month';
  features: Record<FeatureType, number>;
  documents: {
    uploaded: number;
    processed: number;
    storage: number; // in bytes
  };
  chat: {
    interactions: number;
    tokensUsed: number;
    cost: number;
  };
  api: {
    requests: number;
    errors: number;
    avgResponseTime: number;
  };
  users: {
    active: number;
    sessions: number;
  };
}

class UsageTracker {
  private tracer = trace.getTracer('hr-rag-platform-usage');
  private supabase = createSupabaseAdminClient();
  private activeUserSessions: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>

  constructor() {
    this.startSessionTracking();
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(event: FeatureUsageEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();

    // Update Prometheus metrics
    featureUsage.inc({
      feature: event.feature,
      organization_id: event.organizationId,
      user_id: event.userId,
      result: event.result,
    });

    // Create OpenTelemetry span
    const span = this.tracer.startSpan(`Feature Usage: ${event.feature}`, {
      attributes: {
        'feature.type': event.feature,
        'organization.id': event.organizationId,
        'user.id': event.userId,
        'usage.result': event.result,
        'usage.duration': event.metadata?.duration,
        'usage.items_processed': event.metadata?.itemsProcessed,
      },
    });

    span.end();

    try {
      // Store in database
      await this.supabase
        .from('feature_usage_logs')
        .insert({
          feature_type: event.feature,
          user_id: event.userId,
          organization_id: event.organizationId,
          result: event.result,
          duration_ms: event.metadata?.duration,
          items_processed: event.metadata?.itemsProcessed,
          file_size: event.metadata?.fileSize,
          metadata: event.metadata?.additionalData,
          created_at: timestamp.toISOString(),
        });
    } catch (error) {
      console.error('Failed to store feature usage:', error);
    }
  }

  /**
   * Track document processing events
   */
  async trackDocumentProcessing(event: DocumentProcessingEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();

    // Update Prometheus metrics
    documentProcessingUsage.inc({
      operation_type: event.operationType,
      organization_id: event.organizationId,
      file_type: event.fileType,
      result: event.result,
    });

    try {
      await this.supabase
        .from('document_processing_logs')
        .insert({
          operation_type: event.operationType,
          user_id: event.userId,
          organization_id: event.organizationId,
          file_type: event.fileType,
          file_size: event.fileSize,
          result: event.result,
          processing_time_ms: event.processingTime,
          pages_processed: event.metadata?.pagesProcessed,
          text_extracted_chars: event.metadata?.textExtracted,
          embeddings_created: event.metadata?.embeddings,
          metadata: event.metadata?.additionalData,
          created_at: timestamp.toISOString(),
        });
    } catch (error) {
      console.error('Failed to store document processing log:', error);
    }
  }

  /**
   * Track chat interactions
   */
  async trackChatInteraction(event: ChatInteractionEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();

    // Update Prometheus metrics
    chatInteractions.inc({
      organization_id: event.organizationId,
      conversation_type: event.conversationType,
      source: event.source,
    });

    try {
      await this.supabase
        .from('chat_interaction_logs')
        .insert({
          user_id: event.userId,
          organization_id: event.organizationId,
          conversation_id: event.conversationId,
          conversation_type: event.conversationType,
          source: event.source,
          query_text: event.query,
          response_time_ms: event.responseTime,
          documents_retrieved: event.documentsRetrieved,
          tokens_used: event.tokensUsed,
          cost_usd: event.cost,
          created_at: timestamp.toISOString(),
        });
    } catch (error) {
      console.error('Failed to store chat interaction log:', error);
    }
  }

  /**
   * Track API usage
   */
  async trackApiUsage(event: ApiUsageEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();

    // Update Prometheus metrics
    apiUsage.inc({
      endpoint: event.endpoint,
      method: event.method,
      organization_id: event.organizationId,
      user_tier: event.userTier,
    });

    try {
      await this.supabase
        .from('api_usage_logs')
        .insert({
          endpoint: event.endpoint,
          method: event.method,
          user_id: event.userId,
          organization_id: event.organizationId,
          user_tier: event.userTier,
          status_code: event.statusCode,
          response_time_ms: event.responseTime,
          request_size_bytes: event.requestSize,
          response_size_bytes: event.responseSize,
          created_at: timestamp.toISOString(),
        });
    } catch (error) {
      console.error('Failed to store API usage log:', error);
    }
  }

  /**
   * Track user session
   */
  trackUserSession(userId: string, organizationId: string, action: 'start' | 'end'): void {
    if (!this.activeUserSessions.has(organizationId)) {
      this.activeUserSessions.set(organizationId, new Set());
    }

    const orgSessions = this.activeUserSessions.get(organizationId)!;

    if (action === 'start') {
      orgSessions.add(userId);
    } else {
      orgSessions.delete(userId);
    }

    // Update metrics
    userSessions.set(
      { organization_id: organizationId },
      orgSessions.size
    );
  }

  /**
   * Get usage statistics for an organization
   */
  async getUsageStats(
    organizationId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<UsageStats> {
    const periodStart = this.getPeriodStart(period);

    try {
      // Get feature usage stats
      const { data: featureData } = await this.supabase
        .from('feature_usage_logs')
        .select('feature_type')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart.toISOString());

      // Get document stats
      const { data: documentData } = await this.supabase
        .from('document_processing_logs')
        .select('operation_type, file_size, result')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart.toISOString());

      // Get chat stats
      const { data: chatData } = await this.supabase
        .from('chat_interaction_logs')
        .select('tokens_used, cost_usd')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart.toISOString());

      // Get API stats
      const { data: apiData } = await this.supabase
        .from('api_usage_logs')
        .select('status_code, response_time_ms')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart.toISOString());

      // Process feature usage
      const features = {} as Record<FeatureType, number>;
      featureData?.forEach(item => {
        features[item.feature_type as FeatureType] = 
          (features[item.feature_type as FeatureType] || 0) + 1;
      });

      // Process document stats
      const documents = {
        uploaded: documentData?.filter(d => d.operation_type === 'upload').length || 0,
        processed: documentData?.filter(d => d.result === 'success').length || 0,
        storage: documentData?.reduce((sum, d) => sum + (d.file_size || 0), 0) || 0,
      };

      // Process chat stats
      const chat = {
        interactions: chatData?.length || 0,
        tokensUsed: chatData?.reduce((sum, d) => sum + (d.tokens_used || 0), 0) || 0,
        cost: chatData?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) || 0,
      };

      // Process API stats
      const api = {
        requests: apiData?.length || 0,
        errors: apiData?.filter(d => d.status_code >= 400).length || 0,
        avgResponseTime: apiData?.length 
          ? apiData.reduce((sum, d) => sum + d.response_time_ms, 0) / apiData.length
          : 0,
      };

      // Get active users (simplified)
      const activeUsers = this.activeUserSessions.get(organizationId)?.size || 0;

      return {
        organizationId,
        period,
        features,
        documents,
        chat,
        api,
        users: {
          active: activeUsers,
          sessions: activeUsers, // Simplified for now
        },
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return this.getEmptyUsageStats(organizationId, period);
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    organizationId: string,
    feature: FeatureType,
    days: number = 30
  ): Promise<Array<{ date: string; count: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const { data } = await this.supabase
        .from('feature_usage_logs')
        .select('created_at')
        .eq('organization_id', organizationId)
        .eq('feature_type', feature)
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      // Group by date
      const trends = new Map<string, number>();
      data?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        trends.set(date, (trends.get(date) || 0) + 1);
      });

      return Array.from(trends.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    } catch (error) {
      console.error('Failed to get usage trends:', error);
      return [];
    }
  }

  /**
   * Get top features by usage
   */
  async getTopFeatures(
    organizationId: string,
    limit: number = 10
  ): Promise<Array<{ feature: FeatureType; count: number }>> {
    try {
      const { data } = await this.supabase
        .from('feature_usage_logs')
        .select('feature_type')
        .eq('organization_id', organizationId)
        .gte('created_at', this.getPeriodStart('month').toISOString());

      const featureCounts = new Map<FeatureType, number>();
      data?.forEach(item => {
        const feature = item.feature_type as FeatureType;
        featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
      });

      return Array.from(featureCounts.entries())
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get top features:', error);
      return [];
    }
  }

  /**
   * Start session tracking cleanup
   */
  private startSessionTracking(): void {
    // Clean up stale sessions every 5 minutes
    setInterval(() => {
      // This would typically integrate with actual session management
      // For now, we'll just update the metrics
      this.activeUserSessions.forEach((users, orgId) => {
        userSessions.set({ organization_id: orgId }, users.size);
      });
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
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get empty usage stats
   */
  private getEmptyUsageStats(organizationId: string, period: 'day' | 'week' | 'month'): UsageStats {
    return {
      organizationId,
      period,
      features: {} as Record<FeatureType, number>,
      documents: { uploaded: 0, processed: 0, storage: 0 },
      chat: { interactions: 0, tokensUsed: 0, cost: 0 },
      api: { requests: 0, errors: 0, avgResponseTime: 0 },
      users: { active: 0, sessions: 0 },
    };
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.activeUserSessions.clear();
  }
}

// Singleton instance
export const usageTracker = new UsageTracker();
export default usageTracker;