#!/usr/bin/env node

/**
 * Document Processing CLI Tool
 * 
 * This script provides administrative tools for managing the document processing system:
 * - Health checks and monitoring
 * - Cleanup operations
 * - Processing queue management  
 * - System maintenance
 * - Performance analysis
 */

import { Command } from 'commander';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';
import { TextExtractionService } from '@/libs/document-processing/TextExtractionService';
import { SecurityValidationService } from '@/libs/document-processing/SecurityValidationService';

const program = new Command();

program
  .name('document-processing-cli')
  .description('CLI tool for managing document processing system')
  .version('1.0.0');

// Health check command
program
  .command('health')
  .description('Check system health and service status')
  .option('--detailed', 'Show detailed diagnostics')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      console.log('🔍 Checking document processing system health...\n');

      const supabase = createSupabaseServerClient();
      const healthData: any = {
        timestamp: new Date().toISOString(),
        services: {},
        metrics: {},
        recommendations: []
      };

      // Check database connectivity
      console.log('📊 Checking database...');
      try {
        const { data, error } = await supabase.from('documents').select('count').limit(1);
        healthData.services.database = { 
          status: error ? 'unhealthy' : 'healthy', 
          details: error?.message || 'Connected' 
        };
        console.log(`   ${error ? '❌' : '✅'} Database: ${error?.message || 'Connected'}`);
      } catch (error: any) {
        healthData.services.database = { status: 'unhealthy', details: error.message };
        console.log(`   ❌ Database: ${error.message}`);
      }

      // Check storage
      console.log('💾 Checking storage...');
      try {
        const { data, error } = await supabase.storage.from('documents').list('', { limit: 1 });
        healthData.services.storage = { 
          status: error ? 'unhealthy' : 'healthy', 
          details: error?.message || 'Connected' 
        };
        console.log(`   ${error ? '❌' : '✅'} Storage: ${error?.message || 'Connected'}`);
      } catch (error: any) {
        healthData.services.storage = { status: 'unhealthy', details: error.message };
        console.log(`   ❌ Storage: ${error.message}`);
      }

      // Check OCR service
      console.log('🔤 Checking OCR service...');
      try {
        const ocrHealth = await TextExtractionService.healthCheck();
        healthData.services.ocr = ocrHealth;
        console.log(`   ${ocrHealth.available ? '✅' : '❌'} OCR: ${ocrHealth.available ? 'Available' : ocrHealth.error}`);
        if (ocrHealth.available) {
          console.log(`      Languages: ${ocrHealth.languages.join(', ')}`);
        }
      } catch (error: any) {
        healthData.services.ocr = { available: false, error: error.message };
        console.log(`   ❌ OCR: ${error.message}`);
      }

      // Get processing queue statistics
      console.log('⏳ Checking processing queue...');
      try {
        const { data: queueData } = await supabase
          .from('document_processing_queue')
          .select('status, created_at, completed_at')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (queueData) {
          const statusCounts = queueData.reduce((acc: any, item: any) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});

          healthData.metrics.queue = statusCounts;
          console.log('   Queue Status:');
          Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`      ${status}: ${count}`);
          });

          if (statusCounts.failed > 10) {
            healthData.recommendations.push('High number of failed documents - investigate processing issues');
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Queue check failed: ${error.message}`);
      }

      // Get system metrics
      console.log('📈 Getting system metrics...');
      try {
        const { data: docs, count: docCount } = await supabase
          .from('documents')
          .select('file_size_bytes, status, processing_metadata', { count: 'exact' })
          .limit(1000);

        const { count: chunkCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true });

        if (docs) {
          const totalSize = docs.reduce((sum, doc) => sum + (doc.file_size_bytes || 0), 0);
          const statusCounts = docs.reduce((acc: any, doc) => {
            acc[doc.status] = (acc[doc.status] || 0) + 1;
            return acc;
          }, {});

          const processingTimes = docs
            .filter(doc => doc.processing_metadata?.processing_time_ms)
            .map(doc => doc.processing_metadata.processing_time_ms);
          
          const avgProcessingTime = processingTimes.length > 0
            ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
            : 0;

          healthData.metrics.documents = {
            total: docCount,
            status_breakdown: statusCounts,
            total_storage_bytes: totalSize,
            avg_processing_time_ms: Math.round(avgProcessingTime)
          };

          healthData.metrics.chunks = {
            total: chunkCount
          };

          console.log(`   📄 Total Documents: ${docCount}`);
          console.log(`   📑 Total Chunks: ${chunkCount}`);
          console.log(`   💾 Storage Used: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
          console.log(`   ⏱️  Avg Processing: ${Math.round(avgProcessingTime)}ms`);
        }
      } catch (error: any) {
        console.log(`   ❌ Metrics failed: ${error.message}`);
      }

      if (options.json) {
        console.log('\n' + JSON.stringify(healthData, null, 2));
      } else if (options.detailed) {
        console.log('\n📋 Detailed Health Report:');
        console.log(JSON.stringify(healthData, null, 2));
      }

      if (healthData.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        healthData.recommendations.forEach((rec: string) => {
          console.log(`   • ${rec}`);
        });
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up failed documents and orphaned files')
  .option('--dry-run', 'Show what would be cleaned up without actually doing it')
  .option('--older-than <hours>', 'Only clean up items older than specified hours', '24')
  .option('--include-completed', 'Also clean up old completed documents')
  .action(async (options) => {
    try {
      console.log('🧹 Starting cleanup process...\n');

      const supabase = createSupabaseServerClient();
      const olderThanMs = parseInt(options.olderThan) * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - olderThanMs);

      let query = supabase
        .from('documents')
        .select('id, storage_path, status, created_at, updated_at')
        .lt('updated_at', cutoffTime.toISOString());

      if (!options.includeCompleted) {
        query = query.in('status', ['failed', 'archived']);
      }

      const { data: documentsToClean } = await query.limit(100);

      if (!documentsToClean || documentsToClean.length === 0) {
        console.log('✅ No documents need cleanup');
        return;
      }

      console.log(`Found ${documentsToClean.length} documents for cleanup`);

      if (options.dryRun) {
        console.log('\n🔍 DRY RUN - Documents that would be cleaned:');
        documentsToClean.forEach(doc => {
          console.log(`   • ${doc.id} (${doc.status}) - ${doc.storage_path}`);
        });
        return;
      }

      let cleaned = 0;
      let errors = 0;

      for (const doc of documentsToClean) {
        try {
          console.log(`🗑️  Cleaning document: ${doc.id}`);

          // Delete chunks
          await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', doc.id);

          // Delete processing queue entries
          await supabase
            .from('document_processing_queue')
            .delete()
            .eq('document_id', doc.id);

          // Delete file from storage
          if (doc.storage_path) {
            await supabase.storage
              .from('documents')
              .remove([doc.storage_path]);
          }

          // Delete document record
          await supabase
            .from('documents')
            .delete()
            .eq('id', doc.id);

          cleaned++;
          console.log(`   ✅ Cleaned: ${doc.id}`);

        } catch (error) {
          errors++;
          console.log(`   ❌ Error cleaning ${doc.id}:`, error);
        }
      }

      console.log(`\n🎉 Cleanup completed: ${cleaned} cleaned, ${errors} errors`);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// Process queue management
program
  .command('queue')
  .description('Manage document processing queue')
  .option('--status <status>', 'Filter by status (pending, processing, failed, completed)')
  .option('--retry-failed', 'Retry all failed processing jobs')
  .option('--cancel-stuck', 'Cancel processing jobs stuck for more than 1 hour')
  .option('--limit <number>', 'Limit number of items to process', '50')
  .action(async (options) => {
    try {
      const supabase = createSupabaseServerClient();

      if (options.retryFailed) {
        console.log('🔄 Retrying failed processing jobs...');
        
        const { data: failedJobs } = await supabase
          .from('document_processing_queue')
          .select('document_id, retry_count, max_retries')
          .eq('status', 'failed')
          .lt('retry_count', 3)
          .limit(parseInt(options.limit));

        if (!failedJobs || failedJobs.length === 0) {
          console.log('   No failed jobs to retry');
          return;
        }

        let retried = 0;
        for (const job of failedJobs) {
          try {
            console.log(`   Retrying: ${job.document_id}`);
            await DocumentProcessorService.retryProcessing(job.document_id);
            retried++;
          } catch (error) {
            console.log(`   ❌ Failed to retry ${job.document_id}:`, error);
          }
        }

        console.log(`🎉 Retried ${retried}/${failedJobs.length} jobs`);
        return;
      }

      if (options.cancelStuck) {
        console.log('🛑 Cancelling stuck processing jobs...');
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const { data: stuckJobs } = await supabase
          .from('document_processing_queue')
          .select('document_id, started_at')
          .eq('status', 'processing')
          .lt('started_at', oneHourAgo.toISOString())
          .limit(parseInt(options.limit));

        if (!stuckJobs || stuckJobs.length === 0) {
          console.log('   No stuck jobs found');
          return;
        }

        let cancelled = 0;
        for (const job of stuckJobs) {
          try {
            console.log(`   Cancelling: ${job.document_id}`);
            await DocumentProcessorService.cancelProcessing(job.document_id);
            cancelled++;
          } catch (error) {
            console.log(`   ❌ Failed to cancel ${job.document_id}:`, error);
          }
        }

        console.log(`🎉 Cancelled ${cancelled}/${stuckJobs.length} stuck jobs`);
        return;
      }

      // Show queue status
      console.log('📋 Document Processing Queue Status\n');

      let query = supabase
        .from('document_processing_queue')
        .select('*, document:documents(name, original_filename)')
        .order('created_at', { ascending: false })
        .limit(parseInt(options.limit));

      if (options.status) {
        query = query.eq('status', options.status);
      }

      const { data: jobs } = await query;

      if (!jobs || jobs.length === 0) {
        console.log('Queue is empty');
        return;
      }

      console.log(`Showing ${jobs.length} queue items:\n`);

      jobs.forEach((job, index) => {
        const status = job.status === 'completed' ? '✅' :
                      job.status === 'processing' ? '⏳' :
                      job.status === 'failed' ? '❌' : '⏸️';
        
        console.log(`${index + 1}. ${status} ${job.document.name || job.document.original_filename}`);
        console.log(`   ID: ${job.document_id}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        
        if (job.started_at) {
          console.log(`   Started: ${new Date(job.started_at).toLocaleString()}`);
        }
        
        if (job.completed_at) {
          console.log(`   Completed: ${new Date(job.completed_at).toLocaleString()}`);
        }

        if (job.error_message) {
          console.log(`   Error: ${job.error_message}`);
        }

        if (job.retry_count > 0) {
          console.log(`   Retries: ${job.retry_count}/${job.max_retries}`);
        }
        
        console.log('');
      });

    } catch (error) {
      console.error('❌ Queue management failed:', error);
      process.exit(1);
    }
  });

// Performance analysis
program
  .command('analyze')
  .description('Analyze system performance and generate reports')
  .option('--days <number>', 'Number of days to analyze', '7')
  .option('--organization <id>', 'Analyze specific organization')
  .option('--export <file>', 'Export results to JSON file')
  .action(async (options) => {
    try {
      console.log('📊 Analyzing system performance...\n');

      const supabase = createSupabaseServerClient();
      const daysBack = parseInt(options.days);
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      let query = supabase
        .from('documents')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (options.organization) {
        query = query.eq('organization_id', options.organization);
      }

      const { data: documents } = await query;

      if (!documents || documents.length === 0) {
        console.log('No documents found for analysis');
        return;
      }

      const analysis = {
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days: daysBack
        },
        summary: {
          total_documents: documents.length,
          completed: 0,
          failed: 0,
          processing: 0,
          success_rate: 0
        },
        performance: {
          avg_processing_time_ms: 0,
          min_processing_time_ms: 0,
          max_processing_time_ms: 0,
          total_processing_time_ms: 0
        },
        languages: {} as Record<string, number>,
        file_types: {} as Record<string, number>,
        daily_stats: [] as any[]
      };

      // Calculate statistics
      const processingTimes: number[] = [];
      
      documents.forEach(doc => {
        // Status counts
        if (doc.status === 'completed') analysis.summary.completed++;
        else if (doc.status === 'failed') analysis.summary.failed++;
        else if (doc.status === 'processing') analysis.summary.processing++;

        // Language distribution
        const lang = doc.language || 'unknown';
        analysis.languages[lang] = (analysis.languages[lang] || 0) + 1;

        // File type distribution  
        const fileType = doc.file_type || 'unknown';
        analysis.file_types[fileType] = (analysis.file_types[fileType] || 0) + 1;

        // Processing times
        if (doc.processing_metadata?.processing_time_ms) {
          processingTimes.push(doc.processing_metadata.processing_time_ms);
        }
      });

      analysis.summary.success_rate = analysis.summary.total_documents > 0 
        ? (analysis.summary.completed / analysis.summary.total_documents * 100) : 0;

      if (processingTimes.length > 0) {
        analysis.performance.avg_processing_time_ms = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        analysis.performance.min_processing_time_ms = Math.min(...processingTimes);
        analysis.performance.max_processing_time_ms = Math.max(...processingTimes);
        analysis.performance.total_processing_time_ms = processingTimes.reduce((sum, time) => sum + time, 0);
      }

      // Display results
      console.log('📈 Performance Analysis Results\n');
      console.log(`Period: ${daysBack} days (${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()})`);
      console.log(`Total Documents: ${analysis.summary.total_documents}`);
      console.log(`Success Rate: ${analysis.summary.success_rate.toFixed(1)}%`);
      console.log(`Completed: ${analysis.summary.completed}`);
      console.log(`Failed: ${analysis.summary.failed}`);
      console.log(`Processing: ${analysis.summary.processing}`);

      if (processingTimes.length > 0) {
        console.log('\n⏱️  Processing Performance:');
        console.log(`Average: ${Math.round(analysis.performance.avg_processing_time_ms)}ms`);
        console.log(`Fastest: ${analysis.performance.min_processing_time_ms}ms`);
        console.log(`Slowest: ${Math.round(analysis.performance.max_processing_time_ms / 1000)}s`);
      }

      console.log('\n🌍 Language Distribution:');
      Object.entries(analysis.languages)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([lang, count]) => {
          console.log(`   ${lang}: ${count} (${((count as number) / analysis.summary.total_documents * 100).toFixed(1)}%)`);
        });

      console.log('\n📄 File Type Distribution:');
      Object.entries(analysis.file_types)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count} (${((count as number) / analysis.summary.total_documents * 100).toFixed(1)}%)`);
        });

      if (options.export) {
        const fs = require('fs');
        fs.writeFileSync(options.export, JSON.stringify(analysis, null, 2));
        console.log(`\n💾 Results exported to: ${options.export}`);
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  });

// Test command for validation
program
  .command('test')
  .description('Run system tests and validations')
  .option('--security', 'Test security validation')
  .option('--ocr', 'Test OCR functionality')
  .option('--embeddings', 'Test embedding generation')
  .action(async (options) => {
    try {
      console.log('🧪 Running system tests...\n');

      if (options.ocr || !options.security && !options.embeddings) {
        console.log('🔤 Testing OCR functionality...');
        try {
          const ocrHealth = await TextExtractionService.healthCheck();
          console.log(`   ${ocrHealth.available ? '✅' : '❌'} OCR: ${ocrHealth.available ? 'Working' : ocrHealth.error}`);
        } catch (error) {
          console.log(`   ❌ OCR test failed:`, error);
        }
      }

      if (options.embeddings || !options.security && !options.ocr) {
        console.log('🔢 Testing embedding generation...');
        try {
          const { EmbeddingGenerationService } = await import('@/services/rag/EmbeddingGenerationService');
          const embeddingService = new EmbeddingGenerationService();
          const testEmbedding = await embeddingService.generateEmbedding('test document content');
          console.log(`   ✅ Embeddings: Generated ${testEmbedding.length}-dimensional vector`);
        } catch (error) {
          console.log(`   ❌ Embedding test failed:`, error);
        }
      }

      if (options.security || !options.ocr && !options.embeddings) {
        console.log('🔒 Testing security validation...');
        try {
          // Create a test file for security scanning
          const fs = require('fs');
          const testFilePath = '/tmp/test-security-scan.txt';
          fs.writeFileSync(testFilePath, 'This is a test file for security scanning');
          
          const securityResult = await SecurityValidationService.validateFile(
            testFilePath,
            'text/plain',
            'test-org',
            'test-user'
          );

          console.log(`   ${securityResult.isValid ? '✅' : '❌'} Security: ${securityResult.threats.length} threats detected`);
          
          if (securityResult.threats.length > 0) {
            securityResult.threats.forEach(threat => {
              console.log(`      - ${threat.severity}: ${threat.description}`);
            });
          }

          // Clean up test file
          fs.unlinkSync(testFilePath);
        } catch (error) {
          console.log(`   ❌ Security test failed:`, error);
        }
      }

      console.log('\n🎉 System tests completed');

    } catch (error) {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();