import { createSupabaseAdminClient } from '../supabase/supabase-admin';
import { structuredLogger } from './structured-logger';

export type AuditEventType = 
  // Authentication events
  | 'user.login'
  | 'user.logout'
  | 'user.register'
  | 'user.password_change'
  | 'user.password_reset'
  | 'user.token_refresh'
  | 'user.session_expired'
  
  // User management events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.role_changed'
  | 'user.permissions_changed'
  
  // Organization events
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization.user_added'
  | 'organization.user_removed'
  | 'organization.settings_changed'
  
  // Document events
  | 'document.uploaded'
  | 'document.downloaded'
  | 'document.viewed'
  | 'document.updated'
  | 'document.deleted'
  | 'document.shared'
  | 'document.processed'
  | 'document.categorized'
  
  // Data access events
  | 'data.export'
  | 'data.import'
  | 'data.backup'
  | 'data.restore'
  | 'data.migration'
  
  // System events
  | 'system.config_changed'
  | 'system.maintenance'
  | 'system.backup'
  | 'system.restore'
  
  // Security events
  | 'security.unauthorized_access'
  | 'security.rate_limit_exceeded'
  | 'security.suspicious_activity'
  | 'security.data_breach_attempted'
  | 'security.permission_escalation'
  
  // Compliance events
  | 'compliance.policy_accessed'
  | 'compliance.report_generated'
  | 'compliance.audit_requested'
  
  // AI/ML events
  | 'ai.model_used'
  | 'ai.training_started'
  | 'ai.training_completed'
  | 'ai.inference_performed';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditOutcome = 'success' | 'failure' | 'partial' | 'pending';

export interface AuditEvent {
  id?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  
  // Actor (who performed the action)
  actor: {
    type: 'user' | 'system' | 'service' | 'admin';
    id: string;
    email?: string;
    name?: string;
    organizationId?: string;
  };
  
  // Target (what was acted upon)
  target?: {
    type: 'user' | 'organization' | 'document' | 'system' | 'data';
    id: string;
    name?: string;
    additionalData?: Record<string, any>;
  };
  
  // Context
  context: {
    timestamp?: Date;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    method?: string;
    endpoint?: string;
  };
  
  // Event details
  details: {
    description: string;
    changes?: {
      before?: Record<string, any>;
      after?: Record<string, any>;
      fields?: string[];
    };
    metadata?: Record<string, any>;
    error?: {
      message: string;
      code?: string;
      stack?: string;
    };
  };
  
  // Compliance and regulatory fields
  compliance?: {
    regulation?: 'GDPR' | 'CCPA' | 'SOX' | 'HIPAA' | 'Saudi_Labor_Law';
    dataCategory?: 'PII' | 'PHI' | 'Financial' | 'Legal' | 'HR';
    retentionPeriod?: number; // days
    encryptionUsed?: boolean;
  };
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  actorId?: string;
  organizationId?: string;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  targetType?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    eventsByOutcome: Record<AuditOutcome, number>;
    topActors: Array<{ actorId: string; count: number }>;
    topTargets: Array<{ targetId: string; count: number }>;
  };
  events: AuditEvent[];
}

class AuditLogger {
  private supabase = createSupabaseAdminClient();
  private logger = structuredLogger.forComponent('audit-logger', 'audit');

  constructor() {
    this.ensureAuditTable();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    const timestamp = event.context.timestamp || new Date();
    const eventId = event.id || this.generateEventId();

    try {
      // Store in database
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          id: eventId,
          event_type: event.eventType,
          severity: event.severity,
          outcome: event.outcome,
          
          // Actor
          actor_type: event.actor.type,
          actor_id: event.actor.id,
          actor_email: event.actor.email,
          actor_name: event.actor.name,
          organization_id: event.actor.organizationId,
          
          // Target
          target_type: event.target?.type,
          target_id: event.target?.id,
          target_name: event.target?.name,
          target_data: event.target?.additionalData,
          
          // Context
          ip_address: event.context.ipAddress,
          user_agent: event.context.userAgent,
          location: event.context.location,
          session_id: event.context.sessionId,
          request_id: event.context.requestId,
          trace_id: event.context.traceId,
          method: event.context.method,
          endpoint: event.context.endpoint,
          
          // Details
          description: event.details.description,
          changes_before: event.details.changes?.before,
          changes_after: event.details.changes?.after,
          changed_fields: event.details.changes?.fields,
          metadata: event.details.metadata,
          error_message: event.details.error?.message,
          error_code: event.details.error?.code,
          error_stack: event.details.error?.stack,
          
          // Compliance
          regulation: event.compliance?.regulation,
          data_category: event.compliance?.dataCategory,
          retention_period: event.compliance?.retentionPeriod,
          encryption_used: event.compliance?.encryptionUsed,
          
          created_at: timestamp.toISOString(),
        });

      if (error) {
        throw error;
      }

      // Also log to structured logger
      this.logger.info(`Audit Event: ${event.eventType}`, {
        service: 'audit',
        component: 'audit-logger',
        operation: 'audit-log',
        additionalData: {
          eventId,
          eventType: event.eventType,
          severity: event.severity,
          outcome: event.outcome,
          actorId: event.actor.id,
          organizationId: event.actor.organizationId,
        },
      }, {
        organizationId: event.actor.organizationId,
        userId: event.actor.id,
        requestId: event.context.requestId,
        traceId: event.context.traceId,
        ip: event.context.ipAddress,
      });

    } catch (error) {
      this.logger.error('Failed to log audit event', {
        service: 'audit',
        component: 'audit-logger',
        operation: 'audit-log-failed',
        error: error as Error,
        additionalData: {
          eventType: event.eventType,
          actorId: event.actor.id,
        },
      });
      
      // Don't throw - audit logging should not break the main flow
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * Log user authentication event
   */
  async logAuthEvent(
    eventType: Extract<AuditEventType, 'user.login' | 'user.logout' | 'user.register' | 'user.password_change' | 'user.password_reset'>,
    userId: string,
    organizationId: string,
    outcome: AuditOutcome,
    context: Partial<AuditEvent['context']>,
    error?: Error
  ): Promise<void> {
    await this.logEvent({
      eventType,
      severity: outcome === 'failure' ? 'high' : 'low',
      outcome,
      actor: {
        type: 'user',
        id: userId,
        organizationId,
      },
      context: {
        ...context,
        timestamp: context.timestamp || new Date(),
      },
      details: {
        description: `User authentication: ${eventType}`,
        error: error ? {
          message: error.message,
          code: 'AUTH_ERROR',
          stack: error.stack,
        } : undefined,
      },
      compliance: {
        regulation: 'GDPR',
        dataCategory: 'PII',
        retentionPeriod: 2555, // 7 years
      },
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    operation: 'read' | 'write' | 'delete' | 'export',
    targetType: 'document' | 'user' | 'organization',
    targetId: string,
    actorId: string,
    organizationId: string,
    context: Partial<AuditEvent['context']>,
    details?: {
      query?: string;
      recordCount?: number;
      dataCategory?: AuditEvent['compliance']['dataCategory'];
    }
  ): Promise<void> {
    const eventTypeMap = {
      read: 'data.export' as const,
      write: 'data.import' as const,
      delete: 'document.deleted' as const,
      export: 'data.export' as const,
    };

    await this.logEvent({
      eventType: eventTypeMap[operation],
      severity: operation === 'delete' || operation === 'export' ? 'medium' : 'low',
      outcome: 'success',
      actor: {
        type: 'user',
        id: actorId,
        organizationId,
      },
      target: {
        type: targetType,
        id: targetId,
      },
      context: {
        ...context,
        timestamp: context.timestamp || new Date(),
      },
      details: {
        description: `Data ${operation} operation on ${targetType}`,
        metadata: {
          operation,
          query: details?.query,
          recordCount: details?.recordCount,
        },
      },
      compliance: {
        regulation: 'GDPR',
        dataCategory: details?.dataCategory || 'PII',
        retentionPeriod: operation === 'delete' ? 2555 : 1095, // 7 years for deletes, 3 years for others
      },
    });
  }

  /**
   * Log system configuration change
   */
  async logSystemChange(
    component: string,
    changes: {
      before: Record<string, any>;
      after: Record<string, any>;
    },
    actorId: string,
    organizationId?: string,
    context?: Partial<AuditEvent['context']>
  ): Promise<void> {
    await this.logEvent({
      eventType: 'system.config_changed',
      severity: 'medium',
      outcome: 'success',
      actor: {
        type: 'admin',
        id: actorId,
        organizationId,
      },
      target: {
        type: 'system',
        id: component,
        name: component,
      },
      context: {
        ...context,
        timestamp: context?.timestamp || new Date(),
      },
      details: {
        description: `System configuration changed: ${component}`,
        changes: {
          before: changes.before,
          after: changes.after,
          fields: Object.keys(changes.after),
        },
      },
      compliance: {
        regulation: 'SOX',
        retentionPeriod: 2555, // 7 years
      },
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: Extract<AuditEventType, 'security.unauthorized_access' | 'security.rate_limit_exceeded' | 'security.suspicious_activity'>,
    severity: AuditSeverity,
    actorId: string,
    context: Partial<AuditEvent['context']>,
    details: {
      description: string;
      threat?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logEvent({
      eventType,
      severity,
      outcome: 'failure',
      actor: {
        type: 'user',
        id: actorId,
      },
      context: {
        ...context,
        timestamp: context.timestamp || new Date(),
      },
      details: {
        description: details.description,
        metadata: {
          threat: details.threat,
          action: details.action,
          ...details.metadata,
        },
      },
      compliance: {
        regulation: 'GDPR',
        dataCategory: 'PII',
        retentionPeriod: 2555, // 7 years for security events
      },
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      let dbQuery = this.supabase.from('audit_logs').select('*');

      // Apply filters
      if (query.startDate) {
        dbQuery = dbQuery.gte('created_at', query.startDate.toISOString());
      }
      if (query.endDate) {
        dbQuery = dbQuery.lte('created_at', query.endDate.toISOString());
      }
      if (query.eventTypes && query.eventTypes.length > 0) {
        dbQuery = dbQuery.in('event_type', query.eventTypes);
      }
      if (query.actorId) {
        dbQuery = dbQuery.eq('actor_id', query.actorId);
      }
      if (query.organizationId) {
        dbQuery = dbQuery.eq('organization_id', query.organizationId);
      }
      if (query.severity) {
        dbQuery = dbQuery.eq('severity', query.severity);
      }
      if (query.outcome) {
        dbQuery = dbQuery.eq('outcome', query.outcome);
      }
      if (query.targetType) {
        dbQuery = dbQuery.eq('target_type', query.targetType);
      }
      if (query.targetId) {
        dbQuery = dbQuery.eq('target_id', query.targetId);
      }

      // Apply sorting
      const sortBy = query.sortBy || 'timestamp';
      const sortOrder = query.sortOrder || 'desc';
      dbQuery = dbQuery.order('created_at', { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }
      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, (query.offset + (query.limit || 100)) - 1);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      return (data || []).map(this.mapDbRecordToAuditEvent);
    } catch (error) {
      this.logger.error('Failed to query audit logs', {
        service: 'audit',
        component: 'audit-logger',
        operation: 'query-logs',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Generate audit report
   */
  async generateReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditReport> {
    const events = await this.queryLogs({
      organizationId,
      startDate,
      endDate,
      limit: 10000, // Large limit for comprehensive report
    });

    // Generate summary statistics
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};
    const targetCounts: Record<string, number> = {};

    events.forEach(event => {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by outcome
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
      
      // Count by actor
      actorCounts[event.actor.id] = (actorCounts[event.actor.id] || 0) + 1;
      
      // Count by target
      if (event.target) {
        targetCounts[event.target.id] = (targetCounts[event.target.id] || 0) + 1;
      }
    });

    // Get top actors and targets
    const topActors = Object.entries(actorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([actorId, count]) => ({ actorId, count }));

    const topTargets = Object.entries(targetCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([targetId, count]) => ({ targetId, count }));

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: events.length,
        eventsByType: eventsByType as Record<AuditEventType, number>,
        eventsBySeverity: eventsBySeverity as Record<AuditSeverity, number>,
        eventsByOutcome: eventsByOutcome as Record<AuditOutcome, number>,
        topActors,
        topTargets,
      },
      events: events.slice(0, 100), // Limit events in report
    };
  }

  /**
   * Ensure audit table exists
   */
  private async ensureAuditTable(): Promise<void> {
    // This would typically be handled by migrations
    // For now, we'll just log that we're checking
    this.logger.info('Audit logger initialized', {
      service: 'audit',
      component: 'audit-logger',
      operation: 'initialize',
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map database record to AuditEvent
   */
  private mapDbRecordToAuditEvent(record: any): AuditEvent {
    return {
      id: record.id,
      eventType: record.event_type,
      severity: record.severity,
      outcome: record.outcome,
      actor: {
        type: record.actor_type,
        id: record.actor_id,
        email: record.actor_email,
        name: record.actor_name,
        organizationId: record.organization_id,
      },
      target: record.target_type ? {
        type: record.target_type,
        id: record.target_id,
        name: record.target_name,
        additionalData: record.target_data,
      } : undefined,
      context: {
        timestamp: new Date(record.created_at),
        ipAddress: record.ip_address,
        userAgent: record.user_agent,
        location: record.location,
        sessionId: record.session_id,
        requestId: record.request_id,
        traceId: record.trace_id,
        method: record.method,
        endpoint: record.endpoint,
      },
      details: {
        description: record.description,
        changes: (record.changes_before || record.changes_after) ? {
          before: record.changes_before,
          after: record.changes_after,
          fields: record.changed_fields,
        } : undefined,
        metadata: record.metadata,
        error: record.error_message ? {
          message: record.error_message,
          code: record.error_code,
          stack: record.error_stack,
        } : undefined,
      },
      compliance: {
        regulation: record.regulation,
        dataCategory: record.data_category,
        retentionPeriod: record.retention_period,
        encryptionUsed: record.encryption_used,
      },
    };
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
export default auditLogger;