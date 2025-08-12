import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { TextExtractionService } from '@/libs/document-processing/TextExtractionService';
import { EmbeddingGenerationService } from '@/services/rag/EmbeddingGenerationService';

// Health check for document processing system
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {
        database: { status: 'unknown', details: null },
        storage: { status: 'unknown', details: null },
        ocr: { status: 'unknown', details: null },
        embeddings: { status: 'unknown', details: null }
      },
      processing_queue: {
        pending: 0,
        processing: 0,
        failed: 0,
        completed_last_hour: 0
      },
      system_metrics: {
        total_documents: 0,
        total_chunks: 0,
        storage_used_bytes: 0,
        avg_processing_time_ms: 0
      },
      errors: [] as string[]
    };

    // Check database connectivity
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      healthCheck.services.database = {
        status: 'healthy',
        details: 'Database connection successful'
      };
    } catch (error) {
      healthCheck.services.database = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Database connection failed'
      };
      healthCheck.errors.push(`Database: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }

    // Check storage connectivity
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .list('', { limit: 1 });
      
      if (error) {
        throw error;
      }
      
      healthCheck.services.storage = {
        status: 'healthy',
        details: 'Storage connection successful'
      };
    } catch (error) {
      healthCheck.services.storage = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Storage connection failed'
      };
      healthCheck.errors.push(`Storage: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }

    // Check OCR service
    try {
      const ocrHealth = await TextExtractionService.healthCheck();
      healthCheck.services.ocr = {
        status: ocrHealth.available ? 'healthy' : 'unhealthy',
        details: {
          available: ocrHealth.available,
          languages: ocrHealth.languages,
          error: ocrHealth.error
        }
      };
      
      if (!ocrHealth.available) {
        healthCheck.errors.push(`OCR: ${ocrHealth.error || 'Not available'}`);
      }
    } catch (error) {
      healthCheck.services.ocr = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'OCR health check failed'
      };
      healthCheck.errors.push(`OCR: ${error instanceof Error ? error.message : 'Health check failed'}`);
    }

    // Check embedding service
    try {
      const embeddingService = new EmbeddingGenerationService();
      const testEmbedding = await embeddingService.generateEmbedding('test');
      
      healthCheck.services.embeddings = {
        status: 'healthy',
        details: {
          model: 'text-embedding-ada-002',
          dimension: testEmbedding.length,
          test_successful: true
        }
      };
    } catch (error) {
      healthCheck.services.embeddings = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Embedding service failed'
      };
      healthCheck.errors.push(`Embeddings: ${error instanceof Error ? error.message : 'Service failed'}`);
    }

    // Get processing queue statistics
    try {
      const { data: queueStats } = await supabase
        .from('document_processing_queue')
        .select('status, created_at, completed_at, started_at')
        .order('created_at', { ascending: false });

      if (queueStats) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        healthCheck.processing_queue = {
          pending: queueStats.filter(item => item.status === 'pending').length,
          processing: queueStats.filter(item => item.status === 'processing').length,
          failed: queueStats.filter(item => item.status === 'failed').length,
          completed_last_hour: queueStats.filter(item => 
            item.status === 'completed' && 
            item.completed_at && 
            new Date(item.completed_at) > oneHourAgo
          ).length
        };
      }
    } catch (error) {
      healthCheck.errors.push(`Queue stats: ${error instanceof Error ? error.message : 'Failed to fetch'}`);
    }

    // Get system metrics
    try {
      const [documentsResult, chunksResult] = await Promise.all([
        supabase.from('documents').select('file_size_bytes, processing_metadata', { count: 'exact' }),
        supabase.from('document_chunks').select('id', { count: 'exact' })
      ]);

      const documents = documentsResult.data || [];
      const totalStorage = documents.reduce((sum, doc) => sum + (doc.file_size_bytes || 0), 0);
      const processingTimes = documents
        .map(doc => doc.processing_metadata?.processing_time_ms)
        .filter(time => time && time > 0);
      
      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      healthCheck.system_metrics = {
        total_documents: documentsResult.count || 0,
        total_chunks: chunksResult.count || 0,
        storage_used_bytes: totalStorage,
        avg_processing_time_ms: Math.round(avgProcessingTime)
      };
    } catch (error) {
      healthCheck.errors.push(`System metrics: ${error instanceof Error ? error.message : 'Failed to calculate'}`);
    }

    // Determine overall health status
    const unhealthyServices = Object.values(healthCheck.services)
      .filter(service => service.status === 'unhealthy').length;

    if (unhealthyServices > 0) {
      healthCheck.status = 'degraded';
    }

    if (unhealthyServices >= 3) {
      healthCheck.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 207 : 503;

    return NextResponse.json(healthCheck, { status: statusCode });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        services: {
          database: { status: 'unknown', details: null },
          storage: { status: 'unknown', details: null },
          ocr: { status: 'unknown', details: null },
          embeddings: { status: 'unknown', details: null }
        }
      },
      { status: 503 }
    );
  }
}

// Get detailed processing statistics
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication for detailed stats
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization membership required', code: 'ORG_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      time_range = '24h', // '1h', '24h', '7d', '30d'
      include_failed = true,
      include_performance = true 
    } = body;

    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (time_range) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get organization-specific statistics
    const statistics = {
      time_range,
      organization_id: orgMember.organization_id,
      processing_summary: {
        total_documents: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        pending: 0,
        success_rate: 0
      },
      performance_metrics: {},
      language_distribution: {},
      file_type_distribution: {},
      error_analysis: {},
      trends: []
    };

    // Get processing summary
    const { data: documents } = await supabase
      .from('documents')
      .select('status, language, file_type, processing_metadata, created_at')
      .eq('organization_id', orgMember.organization_id)
      .gte('created_at', startTime.toISOString());

    if (documents) {
      statistics.processing_summary.total_documents = documents.length;
      statistics.processing_summary.completed = documents.filter(d => d.status === 'completed').length;
      statistics.processing_summary.processing = documents.filter(d => d.status === 'processing').length;
      statistics.processing_summary.failed = documents.filter(d => d.status === 'failed').length;
      statistics.processing_summary.pending = documents.filter(d => d.status === 'pending').length;
      
      const successRate = documents.length > 0 
        ? (statistics.processing_summary.completed / documents.length * 100)
        : 0;
      statistics.processing_summary.success_rate = parseFloat(successRate.toFixed(2));

      // Language distribution
      const languageCount: Record<string, number> = {};
      documents.forEach(doc => {
        const lang = doc.language || 'unknown';
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      });
      statistics.language_distribution = languageCount;

      // File type distribution
      const fileTypeCount: Record<string, number> = {};
      documents.forEach(doc => {
        const type = doc.file_type || 'unknown';
        fileTypeCount[type] = (fileTypeCount[type] || 0) + 1;
      });
      statistics.file_type_distribution = fileTypeCount;

      // Performance metrics
      if (include_performance) {
        const completedDocs = documents.filter(d => d.status === 'completed' && d.processing_metadata?.processing_time_ms);
        const processingTimes = completedDocs.map(d => d.processing_metadata.processing_time_ms);
        
        if (processingTimes.length > 0) {
          statistics.performance_metrics = {
            avg_processing_time_ms: Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length),
            min_processing_time_ms: Math.min(...processingTimes),
            max_processing_time_ms: Math.max(...processingTimes),
            total_processing_time_ms: processingTimes.reduce((sum, time) => sum + time, 0)
          };
        }
      }

      // Error analysis
      if (include_failed) {
        const failedDocs = documents.filter(d => d.status === 'failed');
        const errorCount: Record<string, number> = {};
        
        failedDocs.forEach(doc => {
          const error = doc.processing_metadata?.error || 'Unknown error';
          errorCount[error] = (errorCount[error] || 0) + 1;
        });
        
        statistics.error_analysis = errorCount;
      }
    }

    return NextResponse.json({
      success: true,
      statistics,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Processing statistics error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}