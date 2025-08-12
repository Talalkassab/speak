import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'up' | 'down' | 'degraded';
    vectordb: 'up' | 'down' | 'degraded';
    storage: 'up' | 'down' | 'degraded';
    ai: 'up' | 'down' | 'degraded';
  };
  performance: {
    database_latency_ms: number;
    api_response_time_ms: number;
  };
  system_info: {
    uptime_seconds: number;
    memory_usage?: {
      used_mb: number;
      total_mb: number;
      percentage: number;
    };
  };
}

const startTime = Date.now();

// GET /api/v1/health - System health check
export async function GET(request: NextRequest) {
  const checkStart = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: 'up',
        vectordb: 'up',
        storage: 'up',
        ai: 'up'
      },
      performance: {
        database_latency_ms: 0,
        api_response_time_ms: 0
      },
      system_info: {
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
      }
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      const supabase = await createSupabaseServerClient();
      
      // Simple database query to check connectivity
      const { error: dbError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      const dbLatency = Date.now() - dbStart;
      healthStatus.performance.database_latency_ms = dbLatency;

      if (dbError) {
        console.error('Database health check failed:', dbError);
        healthStatus.services.database = 'down';
        healthStatus.status = 'unhealthy';
      } else if (dbLatency > 1000) {
        healthStatus.services.database = 'degraded';
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      healthStatus.services.database = 'down';
      healthStatus.status = 'unhealthy';
    }

    // Check vector database (pgvector extension)
    try {
      const supabase = await createSupabaseServerClient();
      const { error: vectorError } = await supabase.rpc('check_vector_extension');
      
      if (vectorError) {
        console.error('Vector DB check failed:', vectorError);
        healthStatus.services.vectordb = 'down';
        if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
      }
    } catch (error) {
      console.error('Vector DB connectivity check failed:', error);
      healthStatus.services.vectordb = 'degraded';
      if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
    }

    // Check storage connectivity
    try {
      const supabase = await createSupabaseServerClient();
      const { error: storageError } = await supabase.storage
        .from('documents')
        .list('health-check', { limit: 1 });
      
      if (storageError && !storageError.message.includes('not found')) {
        console.error('Storage health check failed:', storageError);
        healthStatus.services.storage = 'down';
        if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
      }
    } catch (error) {
      console.error('Storage connectivity check failed:', error);
      healthStatus.services.storage = 'degraded';
      if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
    }

    // Check AI service (OpenAI API)
    try {
      if (!process.env.OPENAI_API_KEY) {
        healthStatus.services.ai = 'down';
        if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
      } else {
        // Simple check - could be enhanced with actual API call
        healthStatus.services.ai = 'up';
      }
    } catch (error) {
      console.error('AI service check failed:', error);
      healthStatus.services.ai = 'degraded';
      if (healthStatus.status === 'healthy') healthStatus.status = 'degraded';
    }

    // Add memory usage if available (Node.js environment)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      healthStatus.system_info.memory_usage = {
        used_mb: usedMB,
        total_mb: totalMB,
        percentage: Math.round((usedMB / totalMB) * 100)
      };
    }

    // Calculate API response time
    healthStatus.performance.api_response_time_ms = Date.now() - checkStart;

    // Determine overall status
    const downServices = Object.values(healthStatus.services).filter(status => status === 'down').length;
    const degradedServices = Object.values(healthStatus.services).filter(status => status === 'degraded').length;
    
    if (downServices > 0) {
      healthStatus.status = 'unhealthy';
    } else if (degradedServices > 1) {
      healthStatus.status = 'degraded';
    }

    // Set appropriate HTTP status code
    let httpStatus = 200;
    if (healthStatus.status === 'degraded') {
      httpStatus = 200; // Still operational but with issues
    } else if (healthStatus.status === 'unhealthy') {
      httpStatus = 503; // Service unavailable
    }

    return NextResponse.json(healthStatus, { status: httpStatus });

  } catch (error) {
    console.error('Health check failed:', error);
    
    // Return unhealthy status
    const unhealthyStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: 'down',
        vectordb: 'down',
        storage: 'down',
        ai: 'down'
      },
      performance: {
        database_latency_ms: -1,
        api_response_time_ms: Date.now() - checkStart
      },
      system_info: {
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
      }
    };

    return NextResponse.json(unhealthyStatus, { status: 503 });
  }
}

// GET /api/v1/health/detailed - Detailed health check with metrics
export async function POST(request: NextRequest) {
  const checkStart = Date.now();

  try {
    // Extended health check with more detailed metrics
    const supabase = await createSupabaseServerClient();
    
    // Database performance metrics
    const dbTests = [
      { name: 'simple_select', query: 'SELECT 1' },
      { name: 'organization_count', query: 'SELECT COUNT(*) FROM organizations' },
      { name: 'recent_queries', query: 'SELECT COUNT(*) FROM rag_queries WHERE created_at > NOW() - INTERVAL \'1 hour\'' }
    ];

    const dbMetrics = await Promise.all(
      dbTests.map(async (test) => {
        const start = Date.now();
        try {
          await supabase.rpc('execute_sql', { sql: test.query });
          return {
            test: test.name,
            latency_ms: Date.now() - start,
            status: 'success'
          };
        } catch (error) {
          return {
            test: test.name,
            latency_ms: Date.now() - start,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Vector search performance test
    let vectorMetrics = null;
    try {
      const vectorStart = Date.now();
      await supabase.rpc('match_organization_documents', {
        query_embedding: Array(1536).fill(0.1), // Test embedding
        p_organization_id: '00000000-0000-0000-0000-000000000000',
        match_count: 1
      });
      vectorMetrics = {
        latency_ms: Date.now() - vectorStart,
        status: 'success'
      };
    } catch (error) {
      vectorMetrics = {
        latency_ms: Date.now() - vectorStart,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // System resource usage
    let resourceUsage = {};
    if (typeof process !== 'undefined') {
      const memUsage = process.memoryUsage();
      resourceUsage = {
        memory: {
          rss_mb: Math.round(memUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
          external_mb: Math.round(memUsage.external / 1024 / 1024)
        },
        uptime_seconds: process.uptime()
      };
    }

    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      response_time_ms: Date.now() - checkStart,
      database_metrics: dbMetrics,
      vector_search_metrics: vectorMetrics,
      resource_usage: resourceUsage,
      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    return NextResponse.json(detailedHealth);

  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      response_time_ms: Date.now() - checkStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}