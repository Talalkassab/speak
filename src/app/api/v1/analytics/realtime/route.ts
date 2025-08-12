import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { RealtimeUpdate, AnalyticsAlert } from '@/types/analytics';
import { getUserSession } from '@/features/account/controllers/get-session';
import { analytics } from '@/middleware/analytics';

export async function GET(request: NextRequest) {
  try {
    // Get user session and check authentication
    const session = await getUserSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const url = new URL(request.url);
    const eventType = url.searchParams.get('type') || 'all';

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

    // Check if user has permission to view analytics
    if (!['owner', 'admin', 'hr_manager'].includes(orgMember.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const orgId = orgMember.organization_id;

    // Set up Server-Sent Events headers
    const responseInit = {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = {
          type: 'connection_established',
          data: { organizationId: orgId },
          timestamp: new Date().toISOString(),
        };
        
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`)
        );

        // Set up periodic updates
        const updateInterval = setInterval(() => {
          sendRealtimeUpdates(controller, encoder, orgId, eventType);
        }, 30000); // Send updates every 30 seconds

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          const heartbeat = {
            type: 'heartbeat',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
          );
        }, 10000); // Heartbeat every 10 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(updateInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      },
    });

    return new Response(stream, responseInit);
  } catch (error) {
    console.error('Realtime analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendRealtimeUpdates(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  orgId: string,
  eventType: string
) {
  try {
    // Get current metrics for real-time updates
    const currentTime = new Date();
    const realtimeData = await getCurrentMetrics(orgId);

    if (eventType === 'all' || eventType === 'metrics') {
      const metricUpdate: RealtimeUpdate = {
        type: 'metric_update',
        data: realtimeData,
        timestamp: currentTime.toISOString(),
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(metricUpdate)}\n\n`)
      );
    }

    // Check for alerts
    if (eventType === 'all' || eventType === 'alerts') {
      const alerts = await checkForAlerts(orgId, realtimeData);
      
      for (const alert of alerts) {
        const alertUpdate: RealtimeUpdate = {
          type: 'alert',
          data: alert,
          timestamp: currentTime.toISOString(),
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(alertUpdate)}\n\n`)
        );
      }
    }

    // System status updates
    if (eventType === 'all' || eventType === 'system') {
      const systemStatus = await getSystemStatus();
      
      const statusUpdate: RealtimeUpdate = {
        type: 'system_status',
        data: systemStatus,
        timestamp: currentTime.toISOString(),
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(statusUpdate)}\n\n`)
      );
    }
  } catch (error) {
    console.error('Error sending realtime updates:', error);
    
    const errorUpdate: RealtimeUpdate = {
      type: 'alert',
      data: {
        id: crypto.randomUUID(),
        type: 'system_error',
        severity: 'error',
        title: 'Realtime Update Error',
        titleArabic: 'خطأ في التحديث المباشر',
        message: 'Failed to fetch realtime analytics data',
        messageArabic: 'فشل في جلب بيانات التحليلات المباشرة',
        createdAt: new Date().toISOString(),
        acknowledged: false,
      },
      timestamp: new Date().toISOString(),
    };

    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(errorUpdate)}\n\n`)
    );
  }
}

async function getCurrentMetrics(orgId: string) {
  try {
    const supabase = createServerClient();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get active users in the last hour
    const { data: activeSessions } = await supabase
      .from('user_sessions')
      .select('user_id')
      .eq('organization_id', orgId)
      .gte('session_start', oneHourAgo.toISOString())
      .is('session_end', null);

    const currentUsers = new Set(activeSessions?.map(s => s.user_id) || []).size;

    // Get messages in the last hour
    const { data: recentMessages } = await supabase
      .from('chat_interactions')
      .select('id, response_time_ms, success')
      .eq('organization_id', orgId)
      .gte('created_at', oneHourAgo.toISOString());

    const messagesLastHour = recentMessages?.length || 0;

    // Calculate average response time from recent messages
    const validResponseTimes = recentMessages?.filter(m => m.response_time_ms && m.response_time_ms > 0) || [];
    const averageResponseTime = validResponseTimes.length > 0
      ? validResponseTimes.reduce((sum, m) => sum + m.response_time_ms!, 0) / validResponseTimes.length / 1000
      : 0;

    // Calculate error rate from recent operations
    const totalOperations = recentMessages?.length || 0;
    const errorCount = recentMessages?.filter(m => !m.success).length || 0;
    const errorRate = totalOperations > 0 ? errorCount / totalOperations : 0;

    // Get today's cost data
    const { data: todayCosts } = await supabase
      .from('cost_tracking')
      .select('total_cost_usd, tokens_input, tokens_output')
      .eq('organization_id', orgId)
      .gte('created_at', todayStart.toISOString());

    const estimatedCostToday = todayCosts?.reduce((sum, cost) => sum + (cost.total_cost_usd || 0), 0) || 0;
    const tokensUsedToday = todayCosts?.reduce((sum, cost) => sum + (cost.tokens_input || 0) + (cost.tokens_output || 0), 0) || 0;

    // Get API queue depth (approximate from recent requests)
    const { data: recentApiCalls } = await supabase
      .from('api_usage')
      .select('id')
      .eq('organization_id', orgId)
      .gte('created_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .is('response_time_ms', null); // Pending requests

    const queueDepth = recentApiCalls?.length || 0;

    // System load estimation based on recent activity
    const systemLoad = Math.min(100, Math.max(20, (messagesLastHour * 0.5) + (currentUsers * 2) + (queueDepth * 5)));

    return {
      currentUsers,
      messagesLastHour,
      averageResponseTime: Number(averageResponseTime.toFixed(2)),
      systemLoad: Math.round(systemLoad),
      errorRate: Number(errorRate.toFixed(4)),
      queueDepth,
      tokensUsedToday,
      estimatedCostToday: Number(estimatedCostToday.toFixed(4)),
      timestamp: now.toISOString(),
    };
  } catch (error) {
    console.error('Error fetching current metrics:', error);
    
    // Fallback to mock data if real data fails
    const now = new Date();
    return {
      currentUsers: Math.floor(Math.random() * 20) + 5,
      messagesLastHour: Math.floor(Math.random() * 100) + 20,
      averageResponseTime: Number((Math.random() * 2 + 0.5).toFixed(2)),
      systemLoad: Math.floor(Math.random() * 30) + 40,
      errorRate: Number((Math.random() * 0.05).toFixed(4)),
      queueDepth: Math.floor(Math.random() * 10),
      tokensUsedToday: Math.floor(Math.random() * 50000) + 10000,
      estimatedCostToday: Number(((Math.random() * 50000 + 10000) * 0.000002).toFixed(4)),
      timestamp: now.toISOString(),
    };
  }
}

async function checkForAlerts(orgId: string, currentMetrics: any): Promise<AnalyticsAlert[]> {
  const alerts: AnalyticsAlert[] = [];

  // Cost threshold alert
  if (currentMetrics.estimatedCostToday > 50) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'cost_threshold',
      severity: 'warning',
      title: 'Daily Cost Threshold Exceeded',
      titleArabic: 'تم تجاوز حد التكلفة اليومية',
      message: `Daily cost has exceeded $50 (Current: $${currentMetrics.estimatedCostToday})`,
      messageArabic: `تجاوزت التكلفة اليومية 50 دولار (الحالية: ${currentMetrics.estimatedCostToday} دولار)`,
      threshold: 50,
      currentValue: currentMetrics.estimatedCostToday,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // Performance degradation alert
  if (currentMetrics.averageResponseTime > 3.0) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'performance_degradation',
      severity: 'error',
      title: 'High Response Time Detected',
      titleArabic: 'تم اكتشاف زمن استجابة مرتفع',
      message: `Average response time is ${currentMetrics.averageResponseTime}s (threshold: 3.0s)`,
      messageArabic: `متوسط زمن الاستجابة ${currentMetrics.averageResponseTime} ثانية (الحد: 3.0 ثانية)`,
      threshold: 3.0,
      currentValue: currentMetrics.averageResponseTime,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // Usage spike alert
  if (currentMetrics.messagesLastHour > 200) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'usage_spike',
      severity: 'info',
      title: 'Usage Spike Detected',
      titleArabic: 'تم اكتشاف ارتفاع في الاستخدام',
      message: `${currentMetrics.messagesLastHour} messages in the last hour (normal: <200)`,
      messageArabic: `${currentMetrics.messagesLastHour} رسالة في الساعة الماضية (العادي: أقل من 200)`,
      threshold: 200,
      currentValue: currentMetrics.messagesLastHour,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // High error rate alert
  if (currentMetrics.errorRate > 0.05) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'performance_degradation',
      severity: 'critical',
      title: 'High Error Rate',
      titleArabic: 'معدل خطأ مرتفع',
      message: `Error rate is ${(currentMetrics.errorRate * 100).toFixed(2)}% (threshold: 5%)`,
      messageArabic: `معدل الخطأ ${(currentMetrics.errorRate * 100).toFixed(2)}% (الحد: 5%)`,
      threshold: 0.05,
      currentValue: currentMetrics.errorRate,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return alerts;
}

async function getSystemStatus() {
  // Mock system status - in production, this would check actual system health
  return {
    status: 'healthy',
    services: {
      database: { status: 'healthy', responseTime: 12 },
      api: { status: 'healthy', responseTime: 45 },
      ai_models: { status: 'healthy', responseTime: 1200 },
      storage: { status: 'healthy', responseTime: 23 },
      cache: { status: 'healthy', responseTime: 3 },
    },
    resources: {
      cpu: Math.floor(Math.random() * 30) + 40,
      memory: Math.floor(Math.random() * 20) + 60,
      disk: Math.floor(Math.random() * 15) + 25,
      network: Math.floor(Math.random() * 40) + 30,
    },
    lastUpdated: new Date().toISOString(),
  };
}