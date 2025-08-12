import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { getClientIP } from '@/libs/utils/ip';
import { parseUserAgent } from '@/libs/utils/user-agent';

interface AnalyticsData {
  userId?: string;
  organizationId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  ipAddress: string;
  userAgent: string;
  errorMessage?: string;
}

interface SessionData {
  userId: string;
  organizationId: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    deviceType: string;
    browser: string;
    os: string;
  };
}

class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private supabase = createClient();

  static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  async trackAPIUsage(data: AnalyticsData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_usage')
        .insert({
          user_id: data.userId || null,
          organization_id: data.organizationId,
          endpoint: data.endpoint,
          method: data.method,
          status_code: data.statusCode,
          response_time_ms: data.responseTime,
          request_size: data.requestSize,
          response_size: data.responseSize,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          error_message: data.errorMessage || null
        });

      if (error) {
        console.error('Failed to track API usage:', error);
      }
    } catch (error) {
      console.error('Error tracking API usage:', error);
    }
  }

  async trackChatInteraction(data: {
    userId: string;
    organizationId: string;
    sessionId?: string;
    messageType: 'user' | 'assistant' | 'system';
    messageContent: string;
    responseContent?: string;
    modelName?: string;
    provider?: string;
    tokensInput?: number;
    tokensOutput?: number;
    costUsd?: number;
    responseTimeMs?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    try {
      const { data: result, error } = await this.supabase
        .from('chat_interactions')
        .insert({
          user_id: data.userId,
          organization_id: data.organizationId,
          session_id: data.sessionId || null,
          message_type: data.messageType,
          message_content: data.messageContent,
          response_content: data.responseContent || null,
          model_name: data.modelName || null,
          provider: data.provider || 'openrouter',
          tokens_input: data.tokensInput || 0,
          tokens_output: data.tokensOutput || 0,
          cost_usd: data.costUsd || 0,
          response_time_ms: data.responseTimeMs || null,
          success: data.success,
          error_message: data.errorMessage || null,
          metadata: data.metadata || {}
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to track chat interaction:', error);
        return null;
      }

      return result.id;
    } catch (error) {
      console.error('Error tracking chat interaction:', error);
      return null;
    }
  }

  async trackDocumentProcessing(data: {
    userId: string;
    organizationId: string;
    sessionId?: string;
    documentName: string;
    documentType: string;
    fileSize: number;
    processingType: 'upload' | 'analysis' | 'compliance_check';
    processingTimeMs?: number;
    success: boolean;
    pagesProcessed?: number;
    textExtractedLength?: number;
    complianceScore?: number;
    issuesFound?: number;
    costUsd?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    try {
      const { data: result, error } = await this.supabase
        .from('document_processing')
        .insert({
          user_id: data.userId,
          organization_id: data.organizationId,
          session_id: data.sessionId || null,
          document_name: data.documentName,
          document_type: data.documentType,
          file_size: data.fileSize,
          processing_type: data.processingType,
          processing_time_ms: data.processingTimeMs || null,
          success: data.success,
          pages_processed: data.pagesProcessed || 0,
          text_extracted_length: data.textExtractedLength || 0,
          compliance_score: data.complianceScore || null,
          issues_found: data.issuesFound || 0,
          cost_usd: data.costUsd || 0,
          error_message: data.errorMessage || null,
          metadata: data.metadata || {}
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to track document processing:', error);
        return null;
      }

      return result.id;
    } catch (error) {
      console.error('Error tracking document processing:', error);
      return null;
    }
  }

  async trackTemplateGeneration(data: {
    userId: string;
    organizationId: string;
    sessionId?: string;
    templateType: string;
    templateCategory: string;
    generationTimeMs?: number;
    modelName?: string;
    provider?: string;
    tokensUsed?: number;
    costUsd?: number;
    success: boolean;
    complianceValidated?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    try {
      const { data: result, error } = await this.supabase
        .from('template_generation')
        .insert({
          user_id: data.userId,
          organization_id: data.organizationId,
          session_id: data.sessionId || null,
          template_type: data.templateType,
          template_category: data.templateCategory,
          generation_time_ms: data.generationTimeMs || null,
          model_name: data.modelName || null,
          provider: data.provider || 'openrouter',
          tokens_used: data.tokensUsed || 0,
          cost_usd: data.costUsd || 0,
          success: data.success,
          compliance_validated: data.complianceValidated || false,
          error_message: data.errorMessage || null,
          metadata: data.metadata || {}
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to track template generation:', error);
        return null;
      }

      return result.id;
    } catch (error) {
      console.error('Error tracking template generation:', error);
      return null;
    }
  }

  async trackCostUsage(data: {
    organizationId: string;
    userId?: string;
    serviceType: 'chat' | 'document_processing' | 'template_generation' | 'compliance_check';
    provider: string;
    modelName: string;
    tokensInput?: number;
    tokensOutput?: number;
    costPerInputToken: number;
    costPerOutputToken: number;
    totalCostUsd: number;
    currency?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('cost_tracking')
        .insert({
          organization_id: data.organizationId,
          user_id: data.userId || null,
          service_type: data.serviceType,
          provider: data.provider,
          model_name: data.modelName,
          tokens_input: data.tokensInput || 0,
          tokens_output: data.tokensOutput || 0,
          cost_per_input_token: data.costPerInputToken,
          cost_per_output_token: data.costPerOutputToken,
          total_cost_usd: data.totalCostUsd,
          currency: data.currency || 'USD',
          metadata: data.metadata || {}
        });

      if (error) {
        console.error('Failed to track cost usage:', error);
      }
    } catch (error) {
      console.error('Error tracking cost usage:', error);
    }
  }

  async trackPerformanceMetric(data: {
    organizationId: string;
    metricType: 'response_time' | 'error_rate' | 'throughput' | 'uptime';
    metricValue: number;
    measurementUnit: string;
    serviceName: string;
    endpoint?: string;
    aggregationPeriod: 'minute' | 'hour' | 'day' | 'week' | 'month';
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert({
          organization_id: data.organizationId,
          metric_type: data.metricType,
          metric_value: data.metricValue,
          measurement_unit: data.measurementUnit,
          service_name: data.serviceName,
          endpoint: data.endpoint || null,
          aggregation_period: data.aggregationPeriod,
          metadata: data.metadata || {}
        });

      if (error) {
        console.error('Failed to track performance metric:', error);
      }
    } catch (error) {
      console.error('Error tracking performance metric:', error);
    }
  }

  async trackAnalyticsEvent(data: {
    userId?: string;
    organizationId: string;
    sessionId?: string;
    eventName: string;
    eventCategory: string;
    eventAction: string;
    eventLabel?: string;
    eventValue?: number;
    properties?: Record<string, any>;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('analytics_events')
        .insert({
          user_id: data.userId || null,
          organization_id: data.organizationId,
          session_id: data.sessionId || null,
          event_name: data.eventName,
          event_category: data.eventCategory,
          event_action: data.eventAction,
          event_label: data.eventLabel || null,
          event_value: data.eventValue || null,
          properties: data.properties || {}
        });

      if (error) {
        console.error('Failed to track analytics event:', error);
      }
    } catch (error) {
      console.error('Error tracking analytics event:', error);
    }
  }

  async trackAuditTrail(data: {
    userId?: string;
    organizationId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_trail')
        .insert({
          user_id: data.userId || null,
          organization_id: data.organizationId,
          action: data.action,
          resource_type: data.resourceType,
          resource_id: data.resourceId || null,
          old_values: data.oldValues || {},
          new_values: data.newValues || {},
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          success: data.success,
          error_message: data.errorMessage || null
        });

      if (error) {
        console.error('Failed to track audit trail:', error);
      }
    } catch (error) {
      console.error('Error tracking audit trail:', error);
    }
  }

  async startUserSession(data: SessionData): Promise<string | null> {
    try {
      // Check for existing active session
      const { data: existingSession } = await this.supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', data.userId)
        .eq('organization_id', data.organizationId)
        .is('session_end', null)
        .single();

      if (existingSession) {
        return existingSession.id;
      }

      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .insert({
          user_id: data.userId,
          organization_id: data.organizationId,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          device_type: data.deviceInfo.deviceType,
          browser: data.deviceInfo.browser,
          os: data.deviceInfo.os
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to start user session:', error);
        return null;
      }

      return session.id;
    } catch (error) {
      console.error('Error starting user session:', error);
      return null;
    }
  }

  async endUserSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .update({
          session_end: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Failed to end user session:', error);
      }
    } catch (error) {
      console.error('Error ending user session:', error);
    }
  }

  async getUserSession(userId: string, organizationId: string): Promise<string | null> {
    try {
      const { data: session } = await this.supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .is('session_end', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return session?.id || null;
    } catch (error) {
      console.error('Error getting user session:', error);
      return null;
    }
  }
}

// Middleware function
export async function analyticsMiddleware(request: NextRequest, response: NextResponse) {
  const startTime = Date.now();
  const tracker = AnalyticsTracker.getInstance();

  // Extract request information
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const deviceInfo = parseUserAgent(userAgent);
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  // Get request size
  const requestSize = request.headers.get('content-length') 
    ? parseInt(request.headers.get('content-length')!) 
    : 0;

  // Extract user and organization info from headers or session
  const userId = request.headers.get('x-user-id') || undefined;
  const organizationId = request.headers.get('x-organization-id') || undefined;

  // Track the request
  response.headers.set('x-response-time', `${Date.now() - startTime}ms`);

  // Calculate response size (approximation)
  const responseBody = await response.text();
  const responseSize = new TextEncoder().encode(responseBody).length;

  // Track API usage
  if (organizationId) {
    await tracker.trackAPIUsage({
      userId,
      organizationId,
      endpoint,
      method,
      statusCode: response.status,
      responseTime: Date.now() - startTime,
      requestSize,
      responseSize,
      ipAddress,
      userAgent,
      errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined
    });

    // Track performance metrics
    await tracker.trackPerformanceMetric({
      organizationId,
      metricType: 'response_time',
      metricValue: Date.now() - startTime,
      measurementUnit: 'milliseconds',
      serviceName: 'api',
      endpoint,
      aggregationPeriod: 'minute'
    });

    // Track error rate if there's an error
    if (response.status >= 400) {
      await tracker.trackPerformanceMetric({
        organizationId,
        metricType: 'error_rate',
        metricValue: 1,
        measurementUnit: 'count',
        serviceName: 'api',
        endpoint,
        aggregationPeriod: 'minute'
      });
    }
  }

  // Create new response with the original body
  return new NextResponse(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

// Export the singleton instance
export const analytics = AnalyticsTracker.getInstance();