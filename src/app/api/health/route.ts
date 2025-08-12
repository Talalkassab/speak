import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { telemetryManager } from '@/libs/monitoring/telemetry';
import { performanceMonitor } from '@/libs/monitoring/performance-monitor';
import { errorTracker } from '@/libs/monitoring/error-tracker';
import { structuredLogger } from '@/libs/logging/structured-logger';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheckResult;
    telemetry: HealthCheckResult;
    memory: HealthCheckResult;
    external_services: HealthCheckResult;
  };
  performance: {
    memory_usage: NodeJS.MemoryUsage;
    event_loop_lag: number;
    response_time_ms: number;
  };
  metrics?: {
    requests_per_minute: number;
    error_rate: number;
    avg_response_time: number;
  };
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  duration_ms?: number;
  details?: any;
}

class HealthMonitor {
  private startTime = Date.now();

  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const supabase = createSupabaseAdminClient();
      
      // Test basic connectivity
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          message: `Database connection failed: ${error.message}`,
          duration_ms: Date.now() - startTime,
          details: { error: error.message }
        };
      }

      // Check connection pool status (if available)
      const duration = Date.now() - startTime;
      
      return {
        status: duration < 100 ? 'healthy' : 'degraded',
        message: duration < 100 ? 'Database connection healthy' : 'Database connection slow',
        duration_ms: duration,
        details: {
          response_time: duration,
          records_accessible: data?.length || 0
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration_ms: Date.now() - startTime,
        details: { error: error instanceof Error ? error.stack : error }
      };
    }
  }

  async checkTelemetry(): Promise<HealthCheckResult> {
    try {
      const healthCheck = await telemetryManager.healthCheck();
      
      return {
        status: healthCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
        message: healthCheck.status === 'healthy' 
          ? 'Telemetry system operational' 
          : 'Telemetry system issues detected',
        details: healthCheck.details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Telemetry check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error }
      };
    }
  }

  checkMemory(): HealthCheckResult {
    const usage = process.memoryUsage();
    const totalMB = usage.rss / 1024 / 1024;
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    
    // Alert if memory usage is high (> 500MB RSS or > 80% heap usage)
    const isHighMemory = totalMB > 500 || (heapUsedMB / heapTotalMB) > 0.8;
    
    return {
      status: isHighMemory ? 'degraded' : 'healthy',
      message: isHighMemory 
        ? 'High memory usage detected' 
        : 'Memory usage within normal limits',
      details: {
        rss_mb: Math.round(totalMB),
        heap_used_mb: Math.round(heapUsedMB),
        heap_total_mb: Math.round(heapTotalMB),
        heap_usage_percent: Math.round((heapUsedMB / heapTotalMB) * 100),
        external_mb: Math.round(usage.external / 1024 / 1024)
      }
    };
  }

  async checkExternalServices(): Promise<HealthCheckResult> {
    const checks = [];
    
    try {
      // Check OpenRouter API availability (basic)
      const openRouterHealthy = process.env.OPENROUTER_API_KEY ? true : false;
      checks.push({
        service: 'openrouter',
        status: openRouterHealthy ? 'healthy' : 'degraded',
        message: openRouterHealthy ? 'API key configured' : 'API key not configured'
      });

      // Check other external services as needed
      // Redis, Pinecone, etc.

      const allHealthy = checks.every(check => check.status === 'healthy');
      const hasIssues = checks.some(check => check.status === 'unhealthy');

      return {
        status: hasIssues ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
        message: hasIssues ? 'External service issues detected' : 'External services operational',
        details: checks
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `External services check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error }
      };
    }
  }

  measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(lag);
      });
    });
  }

  async generateHealthReport(): Promise<HealthCheck> {
    const requestStartTime = Date.now();
    
    const [
      databaseCheck,
      telemetryCheck,
      memoryCheck,
      externalServicesCheck,
      eventLoopLag
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkTelemetry(),
      Promise.resolve(this.checkMemory()),
      this.checkExternalServices(),
      this.measureEventLoopLag()
    ]);

    const checks = {
      database: databaseCheck,
      telemetry: telemetryCheck,
      memory: memoryCheck,
      external_services: externalServicesCheck
    };

    // Determine overall status
    const hasUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy');
    const hasDegraded = Object.values(checks).some(check => check.status === 'degraded');
    
    const overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 
      hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    const responseTime = Date.now() - requestStartTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      performance: {
        memory_usage: process.memoryUsage(),
        event_loop_lag: eventLoopLag,
        response_time_ms: responseTime
      }
    };
  }
}

const healthMonitor = new HealthMonitor();

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    structuredLogger.info('Health check requested', {
      service: 'health-monitor',
      component: 'health-endpoint',
      operation: 'health-check'
    }, { requestId });

    // Generate comprehensive health report
    const healthReport = await healthMonitor.generateHealthReport();

    // Add optional detailed metrics if requested
    const detailed = request.nextUrl.searchParams.get('detailed') === 'true';
    if (detailed) {
      try {
        // Get recent performance snapshot
        const perfSnapshot = await performanceMonitor.getPerformanceSnapshot();
        healthReport.metrics = {
          requests_per_minute: 0, // Would be calculated from metrics
          error_rate: 0, // Would be calculated from error tracker
          avg_response_time: perfSnapshot.uptime // Simplified
        };
      } catch (error) {
        structuredLogger.warn('Failed to get detailed metrics', {
          service: 'health-monitor',
          component: 'health-endpoint',
          operation: 'detailed-metrics',
          error: error instanceof Error ? error : undefined
        }, { requestId });
      }
    }

    // Determine appropriate HTTP status code
    const statusCode = 
      healthReport.status === 'healthy' ? 200 :
      healthReport.status === 'degraded' ? 200 : // Still operational
      503; // Service unavailable

    const response = NextResponse.json(healthReport, { status: statusCode });

    // Add custom headers
    response.headers.set('X-Health-Status', healthReport.status);
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Log the health check result
    structuredLogger.http('Health check completed', {
      service: 'health-monitor',
      component: 'health-endpoint',
      operation: 'health-check',
      method: 'GET',
      route: '/api/health',
      statusCode,
      responseTime: Date.now() - startTime
    }, { requestId });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    structuredLogger.error('Health check failed', {
      service: 'health-monitor',
      component: 'health-endpoint',
      operation: 'health-check',
      error: error instanceof Error ? error : undefined,
      duration
    }, { requestId });

    // Track the error
    await errorTracker.createError(
      'system_error',
      'Health check endpoint failed',
      error instanceof Error ? error : new Error('Unknown health check error'),
      { requestId, route: '/api/health', method: 'GET' }
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 503 }
    );
  }
}

// Support HEAD requests for simple health checks
export async function HEAD(request: NextRequest) {
  try {
    const healthReport = await healthMonitor.generateHealthReport();
    const statusCode = healthReport.status === 'unhealthy' ? 503 : 200;
    
    const response = new NextResponse(null, { status: statusCode });
    response.headers.set('X-Health-Status', healthReport.status);
    
    return response;
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}