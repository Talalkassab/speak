/**
 * Webhook Events API
 * GET /api/v1/webhooks/events - List available event types and their descriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import type { WebhookEventType } from '@/types/webhooks';

interface EventTypeInfo {
  type: WebhookEventType;
  category: string;
  description: string;
  exampleData: Record<string, any>;
}

const eventTypes: EventTypeInfo[] = [
  // Document Events
  {
    type: 'document.uploaded',
    category: 'Document',
    description: 'Triggered when a new document is uploaded to the system',
    exampleData: {
      documentId: 'doc_123456',
      fileName: 'contract.pdf',
      fileSize: 2048576,
      mimeType: 'application/pdf',
      uploadedBy: 'user_789'
    }
  },
  {
    type: 'document.processing.started',
    category: 'Document',
    description: 'Triggered when document processing begins',
    exampleData: {
      documentId: 'doc_123456',
      processingType: 'text_extraction',
      estimatedDuration: 120
    }
  },
  {
    type: 'document.processing.completed',
    category: 'Document',
    description: 'Triggered when document processing is completed successfully',
    exampleData: {
      documentId: 'doc_123456',
      processingDuration: 95,
      extractedPages: 12,
      extractedText: 'Sample extracted text...'
    }
  },
  {
    type: 'document.processing.failed',
    category: 'Document',
    description: 'Triggered when document processing fails',
    exampleData: {
      documentId: 'doc_123456',
      error: 'Unable to extract text from corrupted PDF',
      retryCount: 2
    }
  },
  {
    type: 'document.analysis.completed',
    category: 'Document',
    description: 'Triggered when AI analysis of a document is completed',
    exampleData: {
      documentId: 'doc_123456',
      analysisType: 'compliance_check',
      findings: ['Missing signature', 'Incomplete sections'],
      confidence: 0.95
    }
  },
  {
    type: 'document.deleted',
    category: 'Document',
    description: 'Triggered when a document is deleted from the system',
    exampleData: {
      documentId: 'doc_123456',
      fileName: 'contract.pdf',
      deletedBy: 'user_789'
    }
  },

  // Chat Events
  {
    type: 'chat.conversation.created',
    category: 'Chat',
    description: 'Triggered when a new chat conversation is started',
    exampleData: {
      conversationId: 'conv_123456',
      userId: 'user_789',
      initialMessage: 'What are the key points in this contract?'
    }
  },
  {
    type: 'chat.message.sent',
    category: 'Chat',
    description: 'Triggered when a user sends a message in a chat',
    exampleData: {
      conversationId: 'conv_123456',
      messageId: 'msg_123456',
      content: 'Can you explain clause 15?',
      userId: 'user_789'
    }
  },
  {
    type: 'chat.message.received',
    category: 'Chat',
    description: 'Triggered when the AI receives a message (for processing)',
    exampleData: {
      conversationId: 'conv_123456',
      messageId: 'msg_123456',
      processingStarted: true
    }
  },
  {
    type: 'chat.ai.response.generated',
    category: 'Chat',
    description: 'Triggered when the AI generates a response to a user message',
    exampleData: {
      conversationId: 'conv_123456',
      messageId: 'msg_123457',
      responseLength: 245,
      processingTime: 1.2,
      sourcesUsed: ['doc_123456']
    }
  },
  {
    type: 'chat.conversation.archived',
    category: 'Chat',
    description: 'Triggered when a conversation is archived',
    exampleData: {
      conversationId: 'conv_123456',
      messageCount: 15,
      archivedBy: 'user_789'
    }
  },

  // Analytics Events
  {
    type: 'analytics.usage.threshold',
    category: 'Analytics',
    description: 'Triggered when usage metrics cross defined thresholds',
    exampleData: {
      metric: 'api_requests',
      currentValue: 8500,
      threshold: 8000,
      period: 'daily',
      severity: 'warning'
    }
  },
  {
    type: 'analytics.cost.alert',
    category: 'Analytics',
    description: 'Triggered when costs exceed budget thresholds',
    exampleData: {
      currentCost: 125.50,
      budgetLimit: 100.00,
      period: 'monthly',
      services: ['openai_api', 'pinecone'],
      severity: 'high'
    }
  },
  {
    type: 'analytics.performance.degraded',
    category: 'Analytics',
    description: 'Triggered when system performance degrades below acceptable levels',
    exampleData: {
      metric: 'response_time',
      currentValue: 5.2,
      threshold: 3.0,
      component: 'rag_query_service',
      severity: 'critical'
    }
  },
  {
    type: 'analytics.quota.exceeded',
    category: 'Analytics',
    description: 'Triggered when API quotas are exceeded',
    exampleData: {
      service: 'openai_api',
      quota: 'tokens_per_minute',
      limit: 60000,
      currentUsage: 62000,
      severity: 'critical'
    }
  },

  // Compliance Events
  {
    type: 'compliance.policy.violation',
    category: 'Compliance',
    description: 'Triggered when a policy violation is detected',
    exampleData: {
      policyId: 'policy_data_retention',
      violationType: 'data_retention_exceeded',
      resourceId: 'doc_123456',
      severity: 'high',
      details: 'Document retained beyond 7-year limit'
    }
  },
  {
    type: 'compliance.audit.trigger',
    category: 'Compliance',
    description: 'Triggered when an audit event occurs',
    exampleData: {
      auditType: 'data_access',
      userId: 'user_789',
      resourceId: 'doc_123456',
      action: 'download',
      ipAddress: '192.168.1.100'
    }
  },
  {
    type: 'compliance.regulatory.alert',
    category: 'Compliance',
    description: 'Triggered for regulatory compliance alerts',
    exampleData: {
      regulation: 'GDPR',
      alertType: 'data_breach_notification',
      affectedRecords: 150,
      reportingRequired: true,
      deadline: '2024-01-15T00:00:00Z'
    }
  },
  {
    type: 'compliance.data.breach.detected',
    category: 'Compliance',
    description: 'Triggered when a potential data breach is detected',
    exampleData: {
      severity: 'critical',
      detectionMethod: 'anomalous_access_pattern',
      affectedUsers: ['user_789', 'user_456'],
      suspiciousActivity: 'multiple_failed_logins',
      ipAddress: '203.0.113.1'
    }
  },

  // System Events
  {
    type: 'system.health.alert',
    category: 'System',
    description: 'Triggered when system health issues are detected',
    exampleData: {
      component: 'database',
      healthStatus: 'degraded',
      metrics: {
        responseTime: 2500,
        errorRate: 0.05,
        cpuUsage: 85
      },
      severity: 'warning'
    }
  },
  {
    type: 'system.error.critical',
    category: 'System',
    description: 'Triggered when critical system errors occur',
    exampleData: {
      errorCode: 'DB_CONNECTION_FAILED',
      component: 'supabase_client',
      message: 'Unable to establish database connection',
      stackTrace: 'Error: Connection timeout...',
      severity: 'critical'
    }
  },
  {
    type: 'system.maintenance.scheduled',
    category: 'System',
    description: 'Triggered when system maintenance is scheduled',
    exampleData: {
      maintenanceId: 'maint_123456',
      scheduledTime: '2024-01-15T02:00:00Z',
      estimatedDuration: 120,
      affectedServices: ['api', 'web_app'],
      description: 'Database optimization and security updates'
    }
  },
  {
    type: 'system.maintenance.started',
    category: 'System',
    description: 'Triggered when scheduled maintenance begins',
    exampleData: {
      maintenanceId: 'maint_123456',
      startTime: '2024-01-15T02:00:00Z',
      affectedServices: ['api', 'web_app']
    }
  },
  {
    type: 'system.maintenance.completed',
    category: 'System',
    description: 'Triggered when scheduled maintenance is completed',
    exampleData: {
      maintenanceId: 'maint_123456',
      startTime: '2024-01-15T02:00:00Z',
      endTime: '2024-01-15T03:45:00Z',
      actualDuration: 105,
      status: 'completed_successfully'
    }
  },
  {
    type: 'system.backup.completed',
    category: 'System',
    description: 'Triggered when system backups are completed',
    exampleData: {
      backupId: 'backup_123456',
      backupType: 'full',
      size: '2.5GB',
      duration: 45,
      status: 'success'
    }
  },
  {
    type: 'system.backup.failed',
    category: 'System',
    description: 'Triggered when system backups fail',
    exampleData: {
      backupId: 'backup_123456',
      backupType: 'incremental',
      error: 'Insufficient storage space',
      retryScheduled: '2024-01-15T04:00:00Z'
    }
  }
];

// GET /api/v1/webhooks/events - List event types
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let filteredEvents = eventTypes;

    // Filter by category if specified
    if (category) {
      filteredEvents = filteredEvents.filter(event => 
        event.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter by search term if specified
    if (search) {
      const searchLower = search.toLowerCase();
      filteredEvents = filteredEvents.filter(event =>
        event.type.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower)
      );
    }

    // Group events by category
    const eventsByCategory = filteredEvents.reduce((acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    }, {} as Record<string, EventTypeInfo[]>);

    return NextResponse.json({
      eventTypes: filteredEvents,
      eventsByCategory,
      categories: Array.from(new Set(eventTypes.map(e => e.category))).sort(),
      total: filteredEvents.length
    });

  } catch (error) {
    console.error('Error listing event types:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}