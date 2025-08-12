# Comprehensive Performance Monitoring and Logging System

This document outlines the complete monitoring, logging, and alerting infrastructure implemented for the HR Intelligence Platform.

## Overview

The system provides:
- **Application Performance Monitoring (APM)** with OpenTelemetry distributed tracing
- **Comprehensive Logging** with structured logging and correlation IDs
- **Error Monitoring** with automatic capture, reporting, and grouping
- **System Health Monitoring** with resource utilization and dependency checks
- **Alerting and Notifications** with webhook, email, and Slack integrations
- **Automated Incident Response** with playbook-driven remediation
- **Database Performance Optimization** with query analysis and recommendations
- **Caching Strategy** with multi-tier caching and monitoring
- **Real-time Monitoring Dashboard** with visualizations and metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│   Middleware    │────│   Monitoring    │
│                 │    │                 │    │    System       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telemetry     │    │   Performance   │    │   Alerting      │
│   (OpenTel)     │    │   Monitor       │    │   Manager       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │   Structured    │    │   Incident      │
│   Metrics       │    │   Logger        │    │   Response      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Health Check Endpoints

**Files:**
- `/src/app/api/health/route.ts` - Comprehensive health check
- `/src/app/api/ready/route.ts` - Kubernetes readiness probe

**Usage:**
```bash
# Health check
curl http://localhost:3000/api/health

# Readiness check  
curl http://localhost:3000/api/ready

# Detailed health report
curl http://localhost:3000/api/health?detailed=true
```

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-12T10:30:00Z",
  "uptime": 86400000,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "duration_ms": 45
    },
    "telemetry": {
      "status": "healthy"
    },
    "memory": {
      "status": "healthy",
      "details": {
        "rss_mb": 250,
        "heap_used_mb": 180
      }
    }
  }
}
```

### 2. Application Performance Monitoring (APM)

**Files:**
- `/src/libs/monitoring/telemetry.ts` - OpenTelemetry integration
- `/src/libs/monitoring/performance-monitor.ts` - Performance metrics collection

**Features:**
- Distributed tracing with Jaeger
- Custom span creation with business context
- Automatic instrumentation for HTTP, database, and external services
- Performance metrics with Prometheus

**Usage:**
```typescript
import { telemetryManager } from '@/libs/monitoring/telemetry';

// Trace a custom operation
await telemetryManager.traceOperation(
  'document-processing',
  async () => {
    return await processDocument(file);
  },
  {
    organizationId: 'org-123',
    userId: 'user-456',
    documentId: 'doc-789'
  }
);

// Track OpenRouter API calls
await telemetryManager.traceOpenRouterCall(
  'anthropic/claude-3-sonnet',
  'chat-completion',
  async () => {
    return await openRouter.chat.completions.create({...});
  },
  { organizationId: 'org-123' }
);
```

### 3. Structured Logging

**Files:**
- `/src/libs/logging/structured-logger.ts` - Main logging interface
- `/src/libs/logging/audit-logger.ts` - Audit trail logging
- `/src/libs/logging/query-logger.ts` - Database query logging

**Features:**
- JSON structured logging with Winston
- Correlation IDs for request tracking
- Different log levels with automatic filtering
- Integration with telemetry traces

**Usage:**
```typescript
import { structuredLogger } from '@/libs/logging/structured-logger';

// Basic logging
structuredLogger.info('Document processed successfully', {
  service: 'document-service',
  component: 'processor',
  operation: 'process-document'
}, {
  organizationId: 'org-123',
  userId: 'user-456',
  documentId: 'doc-789'
});

// Error logging
structuredLogger.error('Document processing failed', {
  service: 'document-service',
  component: 'processor',
  operation: 'process-document',
  error: error
}, { requestId: 'req-123' });

// Component-specific logger
const docLogger = structuredLogger.forComponent('document-processor');
docLogger.info('Starting document processing');
```

### 4. Error Monitoring and Tracking

**Files:**
- `/src/libs/monitoring/error-tracker.ts` - Error capture and analysis

**Features:**
- Automatic error capture with stack traces
- Error grouping and deduplication
- Alert rule evaluation
- User impact assessment

**Usage:**
```typescript
import { errorTracker } from '@/libs/monitoring/error-tracker';

// Track custom errors
await errorTracker.createError(
  'validation_error',
  'Invalid document format',
  error,
  {
    userId: 'user-123',
    organizationId: 'org-456',
    documentId: 'doc-789'
  }
);

// Get error statistics
const stats = await errorTracker.getErrorStats('org-123');
```

### 5. System Health Monitoring

**Files:**
- `/src/libs/monitoring/system-health-monitor.ts` - Resource monitoring

**Features:**
- CPU, memory, and disk usage monitoring
- Database performance tracking
- External service health checks
- Automated alert generation

**Usage:**
```typescript
import { systemHealthMonitor } from '@/libs/monitoring/system-health-monitor';

// Start monitoring
systemHealthMonitor.start(30000); // 30 second intervals

// Get system status
const status = await systemHealthMonitor.getSystemStatus();

// Get historical metrics
const metrics = await systemHealthMonitor.getHistoricalMetrics(24); // 24 hours
```

### 6. Database Performance Monitoring

**Files:**
- `/src/libs/monitoring/database-performance-monitor.ts` - Query optimization

**Features:**
- Slow query detection and analysis
- Execution plan analysis
- Optimization recommendations
- Index usage tracking

**Usage:**
```typescript
import { databasePerformanceMonitor } from '@/libs/monitoring/database-performance-monitor';

// Wrap database queries for monitoring
const result = await databasePerformanceMonitor.monitorQuery(
  'SELECT',
  'documents',
  async () => {
    return await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId);
  },
  {
    organizationId: orgId,
    userId: userId
  }
);

// Get performance recommendations
const recommendations = await databasePerformanceMonitor.getOptimizationRecommendations();
```

### 7. Alerting and Notification System

**Files:**
- `/src/libs/monitoring/alert-manager.ts` - Alert processing and notifications

**Features:**
- Multi-channel notifications (webhook, email, Slack)
- Rate limiting and escalation
- Incident management
- Alert grouping and suppression

**Usage:**
```typescript
import { alertManager } from '@/libs/monitoring/alert-manager';

// Process alerts (handled automatically)
// Get alert statistics
const stats = await alertManager.getAlertStats();

// Configure notification channels in environment variables:
// ALERT_WEBHOOK_URL
// SLACK_WEBHOOK_URL
// ALERT_EMAIL_RECIPIENTS
```

### 8. Caching Strategy and Monitoring

**Files:**
- `/src/libs/caching/cache-service.ts` - Multi-tier caching
- `/src/libs/monitoring/cache-monitor.ts` - Cache performance monitoring

**Features:**
- Memory and Redis caching
- Automatic compression
- Cache hit/miss tracking
- Performance optimization recommendations

**Usage:**
```typescript
import { createCacheService } from '@/libs/caching/cache-service';

const cacheService = createCacheService({
  redis: {
    host: 'localhost',
    port: 6379
  },
  memory: {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000
  }
});

// Cache operations
await cacheService.set('user:123', userData, { ttl: 3600 });
const result = await cacheService.get<UserData>('user:123');
```

### 9. Incident Response Automation

**Files:**
- `/src/libs/monitoring/incident-response.ts` - Automated remediation

**Features:**
- Playbook-driven responses
- Automated actions (restart, scale, clear cache)
- Escalation procedures
- Recovery verification

**Configuration:**
```typescript
// Incident response is configured with default playbooks
// Actions include:
// - restart-service: PM2 restart
// - clear-cache: Clear Redis/memory cache  
// - scale-up-resources: Kubernetes scaling
// - notify-team: PagerDuty/Slack notifications
// - database-failover: Database switchover
```

### 10. Request/Response Monitoring Middleware

**Files:**
- `/src/middleware/monitoring-middleware.ts` - Request tracking
- `/src/middleware.ts` - Integration with Next.js middleware

**Features:**
- Request/response timing
- Rate limiting
- User session tracking
- API usage monitoring

**Configuration:**
```typescript
// Configured in src/middleware.ts
export async function middleware(request: NextRequest) {
  const monitoringResponse = await monitoringMiddleware.create({
    enableTracing: true,
    enableMetrics: true,
    enableLogging: true,
    rateLimiting: {
      enabled: process.env.NODE_ENV === 'production',
      windowMs: 60000,
      maxRequests: 100
    }
  })(request);
}
```

### 11. Monitoring Dashboard

**Files:**
- `/src/components/monitoring/SystemDashboard.tsx` - Real-time dashboard
- `/src/app/api/metrics/route.ts` - Metrics API

**Features:**
- Real-time system metrics visualization
- Error rate and performance charts  
- Cache hit rate monitoring
- Alert status overview

**Usage:**
Add to your admin interface:
```tsx
import SystemDashboard from '@/components/monitoring/SystemDashboard';

function AdminPage() {
  return (
    <div>
      <h1>System Monitoring</h1>
      <SystemDashboard />
    </div>
  );
}
```

## Environment Variables

```bash
# Telemetry Configuration
OTEL_SERVICE_NAME=hr-rag-platform
OTEL_SERVICE_VERSION=1.0.0
JAEGER_ENDPOINT=http://localhost:14268/api/traces
PROMETHEUS_PORT=9464

# Alerting Configuration
ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL_RECIPIENTS=admin@yourcompany.com,ops@yourcompany.com

# Cache Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Incident Response
ENABLE_AUTOMATIC_INCIDENT_RESPONSE=true
PAGERDUTY_WEBHOOK_URL=https://events.pagerduty.com/...
PAGERDUTY_ROUTING_KEY=your-routing-key

# Monitoring Control
AUTO_INIT_MONITORING=true
LOG_LEVEL=info
```

## Database Schema

The monitoring system creates the following tables:

- `error_logs` - Error tracking and analysis
- `system_metrics` - System resource metrics
- `feature_usage_logs` - Feature usage tracking  
- `api_usage_logs` - API endpoint usage
- `slow_queries` - Database performance analysis
- `optimization_recommendations` - Performance recommendations
- `alerts` - Alert management
- `alert_notifications` - Notification tracking
- `incidents` - Incident management
- `system_alerts` - System-generated alerts

## Metrics Endpoints

- `GET /api/health` - Application health check
- `GET /api/ready` - Kubernetes readiness probe
- `GET /api/metrics` - Prometheus metrics
- `GET /api/metrics?format=json` - JSON metrics for dashboard

## Initialization

The monitoring system is automatically initialized in production:

```typescript
import { createMonitoringInitializer } from '@/libs/monitoring/monitoring-init';

// Auto-initialization in production
const initializer = createMonitoringInitializer({
  telemetry: { enabled: true },
  systemHealth: { enabled: true },
  alerting: { enabled: true },
  incidentResponse: { 
    enabled: true,
    automaticActions: true 
  }
});

await initializer.initialize();
```

## Deployment Considerations

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hr-rag-platform
spec:
  template:
    spec:
      containers:
      - name: app
        image: hr-rag-platform:latest
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: NODE_ENV
          value: "production"
        - name: AUTO_INIT_MONITORING
          value: "true"
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "9464:9464" # Prometheus metrics
    environment:
      - NODE_ENV=production
      - AUTO_INIT_MONITORING=true
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'hr-rag-platform'
    static_configs:
      - targets: ['app:9464']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
```

## Performance Impact

The monitoring system is designed for minimal performance overhead:

- **Telemetry**: < 1% CPU overhead
- **Logging**: Asynchronous with configurable levels
- **Metrics**: In-memory collection with batch exports
- **Caching**: Improves performance through reduced database load
- **Middleware**: < 5ms per request overhead

## Best Practices

1. **Configure appropriate log levels** for each environment
2. **Set up proper alert thresholds** to avoid alert fatigue
3. **Review optimization recommendations** regularly
4. **Monitor cache hit rates** and adjust TTL values
5. **Test incident response procedures** in staging
6. **Set up log rotation** for production deployments
7. **Use correlation IDs** for request tracing
8. **Monitor resource usage trends** for capacity planning

## Troubleshooting

### Common Issues

1. **High memory usage**: Check for memory leaks in application code
2. **Slow database queries**: Review optimization recommendations
3. **Low cache hit rates**: Adjust TTL values and cache keys
4. **Alert spam**: Tune alert thresholds and implement cooldowns
5. **Missing metrics**: Verify Prometheus endpoint accessibility

### Debug Commands

```bash
# Check health status
curl -s http://localhost:3000/api/health | jq

# View metrics
curl -s http://localhost:3000/api/metrics

# Check logs
docker logs hr-rag-platform | grep ERROR

# Monitor resource usage
docker stats hr-rag-platform
```

This comprehensive monitoring system provides production-ready observability for the HR Intelligence Platform with automated alerting, incident response, and performance optimization capabilities.