import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { telemetryManager } from '@/libs/monitoring/telemetry';
import { structuredLogger } from '@/libs/logging/structured-logger';

interface ReadinessCheck {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    telemetry: boolean;
    environment: boolean;
    dependencies: boolean;
  };
  details?: {
    database?: string;
    telemetry?: string;
    environment?: string;
    dependencies?: string;
  };
}

/**
 * Readiness probe endpoint for Kubernetes/container orchestration
 * This endpoint checks if the application is ready to serve requests
 * 
 * Ready means:
 * - Database connection is established
 * - All required environment variables are set
 * - Critical dependencies are initialized
 * - Application is fully started
 */

class ReadinessMonitor {
  async checkDatabaseReadiness(): Promise<{ ready: boolean; message?: string }> {
    try {
      const supabase = createSupabaseAdminClient();
      
      // Quick connection test with minimal query
      const { error } = await supabase
        .from('organizations')
        .select('count')
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          ready: false,
          message: `Database not ready: ${error.message}`
        };
      }

      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async checkTelemetryReadiness(): Promise<{ ready: boolean; message?: string }> {
    try {
      const healthCheck = await telemetryManager.healthCheck();
      
      return {
        ready: healthCheck.status === 'healthy',
        message: healthCheck.status !== 'healthy' ? 'Telemetry system not ready' : undefined
      };
    } catch (error) {
      return {
        ready: false,
        message: `Telemetry system error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  checkEnvironmentReadiness(): { ready: boolean; message?: string } {
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      return {
        ready: false,
        message: `Missing required environment variables: ${missingVars.join(', ')}`
      };
    }

    return { ready: true };
  }

  checkDependenciesReadiness(): { ready: boolean; message?: string } {
    try {
      // Check if critical modules can be loaded
      // This would include checking if all imports are successful
      
      // Check Node.js version compatibility
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        return {
          ready: false,
          message: `Node.js version ${nodeVersion} not supported. Requires Node.js 18+`
        };
      }

      // Check if we can access file system for logging
      try {
        require('fs').accessSync(process.cwd(), require('fs').constants.R_OK);
      } catch (error) {
        return {
          ready: false,
          message: 'Cannot access application directory'
        };
      }

      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        message: `Dependency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async performReadinessCheck(): Promise<ReadinessCheck> {
    const startTime = Date.now();
    
    try {
      const [
        databaseResult,
        telemetryResult,
        environmentResult,
        dependenciesResult
      ] = await Promise.all([
        this.checkDatabaseReadiness(),
        this.checkTelemetryReadiness(),
        Promise.resolve(this.checkEnvironmentReadiness()),
        Promise.resolve(this.checkDependenciesReadiness())
      ]);

      const checks = {
        database: databaseResult.ready,
        telemetry: telemetryResult.ready,
        environment: environmentResult.ready,
        dependencies: dependenciesResult.ready
      };

      const details: Record<string, string> = {};
      if (!databaseResult.ready && databaseResult.message) {
        details.database = databaseResult.message;
      }
      if (!telemetryResult.ready && telemetryResult.message) {
        details.telemetry = telemetryResult.message;
      }
      if (!environmentResult.ready && environmentResult.message) {
        details.environment = environmentResult.message;
      }
      if (!dependenciesResult.ready && dependenciesResult.message) {
        details.dependencies = dependenciesResult.message;
      }

      const allReady = Object.values(checks).every(Boolean);

      return {
        ready: allReady,
        timestamp: new Date().toISOString(),
        checks,
        ...(Object.keys(details).length > 0 && { details })
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        checks: {
          database: false,
          telemetry: false,
          environment: false,
          dependencies: false
        },
        details: {
          error: error instanceof Error ? error.message : 'Readiness check failed'
        }
      };
    }
  }
}

const readinessMonitor = new ReadinessMonitor();

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const readinessResult = await readinessMonitor.performReadinessCheck();

    // Determine HTTP status code
    const statusCode = readinessResult.ready ? 200 : 503;

    const response = NextResponse.json(readinessResult, { status: statusCode });

    // Add headers for monitoring
    response.headers.set('X-Readiness-Status', readinessResult.ready ? 'ready' : 'not-ready');
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Log readiness check
    structuredLogger.debug('Readiness check completed', {
      service: 'readiness-monitor',
      component: 'readiness-endpoint',
      operation: 'readiness-check',
      method: 'GET',
      route: '/api/ready',
      statusCode,
      responseTime: Date.now() - startTime,
      additionalData: {
        ready: readinessResult.ready,
        checks: readinessResult.checks
      }
    }, { requestId });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    structuredLogger.error('Readiness check failed', {
      service: 'readiness-monitor',
      component: 'readiness-endpoint',
      operation: 'readiness-check',
      error: error instanceof Error ? error : undefined,
      duration
    }, { requestId });

    return NextResponse.json(
      {
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 503 }
    );
  }
}

// Support HEAD requests for simple readiness checks
export async function HEAD(request: NextRequest) {
  try {
    const readinessResult = await readinessMonitor.performReadinessCheck();
    const statusCode = readinessResult.ready ? 200 : 503;
    
    const response = new NextResponse(null, { status: statusCode });
    response.headers.set('X-Readiness-Status', readinessResult.ready ? 'ready' : 'not-ready');
    
    return response;
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}