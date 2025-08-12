import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { MultiEngineOCRProcessor, OCROptions } from '@/libs/ocr/ocr-processing-service';
import { DocumentClassificationService } from '@/libs/ocr/document-classification-service';
import { ArabicTextEnhancer } from '@/libs/ocr/arabic-text-enhancement';
import { structuredLogger } from '@/libs/logging/structured-logger';
import { auditLogger } from '@/libs/logging/audit-logger';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import { z } from 'zod';

const BatchProcessRequestSchema = z.object({
  enhanceArabicText: z.boolean().optional().default(true),
  classifyDocuments: z.boolean().optional().default(true),
  engine: z.enum(['tesseract', 'azure', 'google', 'best']).optional().default('best'),
  confidence: z.number().min(0).max(1).optional().default(0.7),
  preserveLayout: z.boolean().optional().default(true),
  language: z.string().optional().default('ara+eng'),
  enhanceImage: z.boolean().optional().default(true),
  maxConcurrency: z.number().min(1).max(10).optional().default(3),
  stopOnFirstError: z.boolean().optional().default(false)
});

interface BatchJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  startTime: string;
  endTime?: string;
  estimatedCompletion?: string;
  results: Array<{
    documentId: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    confidence?: number;
    documentType?: string;
    error?: string;
  }>;
  errors: string[];
}

// In-memory storage for batch jobs (in production, use Redis or database)
const batchJobs = new Map<string, BatchJobStatus>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let uploadedFiles: string[] = [];

  try {
    const supabase = createServerClient();
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB per file
      maxTotalFileSize: 500 * 1024 * 1024, // 500MB total
      filter: ({ mimetype }) => {
        return mimetype?.startsWith('image/') || mimetype === 'application/pdf';
      }
    });

    let fields: any;
    let files: any;

    try {
      [fields, files] = await form.parse(request as any);
    } catch (parseError) {
      structuredLogger.error('Failed to parse batch upload form', { error: parseError.message });
      return NextResponse.json(
        { error: 'Invalid file upload format' },
        { status: 400 }
      );
    }

    // Validate request parameters
    const options = BatchProcessRequestSchema.parse({
      enhanceArabicText: fields.enhanceArabicText?.[0] === 'true',
      classifyDocuments: fields.classifyDocuments?.[0] === 'true',
      engine: fields.engine?.[0] || 'best',
      confidence: fields.confidence?.[0] ? parseFloat(fields.confidence[0]) : undefined,
      preserveLayout: fields.preserveLayout?.[0] !== 'false',
      language: fields.language?.[0] || 'ara+eng',
      enhanceImage: fields.enhanceImage?.[0] !== 'false',
      maxConcurrency: fields.maxConcurrency?.[0] ? parseInt(fields.maxConcurrency[0]) : undefined,
      stopOnFirstError: fields.stopOnFirstError?.[0] === 'true'
    });

    // Check if files were uploaded
    const uploadedFileArray = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
    if (!uploadedFileArray.length) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    // Validate file count
    if (uploadedFileArray.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 files allowed per batch' },
        { status: 400 }
      );
    }

    uploadedFiles = uploadedFileArray.map((f: any) => f.filepath);

    // Create batch job
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchJob: BatchJobStatus = {
      jobId,
      status: 'pending',
      totalFiles: uploadedFileArray.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      startTime: new Date().toISOString(),
      results: uploadedFileArray.map((file: any, index: number) => ({
        documentId: `doc_${jobId}_${index}`,
        fileName: file.originalFilename || `file_${index}`,
        status: 'pending'
      })),
      errors: []
    };

    batchJobs.set(jobId, batchJob);

    // Log batch job creation
    await auditLogger.logEvent({
      userId: user.id,
      action: 'batch_ocr_started',
      resourceType: 'batch_job',
      resourceId: jobId,
      details: {
        totalFiles: uploadedFileArray.length,
        options,
        maxConcurrency: options.maxConcurrency
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    });

    structuredLogger.info('Batch OCR job created', {
      jobId,
      userId: user.id,
      totalFiles: uploadedFileArray.length,
      options
    });

    // Start processing asynchronously
    processBatchAsync(jobId, uploadedFileArray, options, user.id, supabase).catch(error => {
      structuredLogger.error('Batch processing failed', { jobId, error: error.message });
      const job = batchJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.endTime = new Date().toISOString();
        job.errors.push(`Batch processing failed: ${error.message}`);
        batchJobs.set(jobId, job);
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'processing',
      totalFiles: uploadedFileArray.length,
      message: 'Batch processing started. Use the job ID to check status.'
    });

  } catch (error) {
    structuredLogger.error('Batch OCR endpoint error', {
      error: error.message,
      processingTime: Date.now() - startTime
    });

    // Clean up temporary files on error
    for (const filePath of uploadedFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processBatchAsync(
  jobId: string,
  files: any[],
  options: any,
  userId: string,
  supabase: any
) {
  const job = batchJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  batchJobs.set(jobId, job);

  try {
    // Initialize OCR services
    const ocrProcessor = new MultiEngineOCRProcessor();
    const documentClassifier = new DocumentClassificationService();
    const textEnhancer = new ArabicTextEnhancer();

    // Process files in chunks to control concurrency
    const chunkSize = options.maxConcurrency;
    const chunks = [];
    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (file: any, chunkIndex: number) => {
        const globalIndex = chunks.slice(0, chunks.indexOf(chunk)).reduce((sum, c) => sum + c.length, 0) + chunkIndex;
        const resultItem = job.results[globalIndex];
        
        if (!resultItem) return;

        try {
          resultItem.status = 'processing';
          batchJobs.set(jobId, job);

          const fileBuffer = await fs.readFile(file.filepath);

          // Prepare OCR options
          const ocrOptions: OCROptions = {
            language: options.language,
            confidence: options.confidence,
            preserveLayout: options.preserveLayout,
            enhanceImage: options.enhanceImage
          };

          // Perform OCR
          let ocrResult;
          if (options.engine === 'best') {
            ocrResult = await ocrProcessor.processWithBestEngine(fileBuffer, ocrOptions);
          } else {
            const availableEngines = await ocrProcessor.getAvailableEngines();
            const requestedEngine = availableEngines.find(engine => 
              engine.name.toLowerCase().includes(options.engine.toLowerCase())
            );

            if (!requestedEngine) {
              throw new Error(`Requested engine '${options.engine}' is not available`);
            }

            ocrResult = await requestedEngine.process(fileBuffer, ocrOptions);
          }

          let enhancedText = ocrResult.text;
          let corrections: any[] = [];

          // Enhance Arabic text if requested
          if (options.enhanceArabicText && ArabicTextEnhancer.containsArabic(ocrResult.text)) {
            const enhancementResult = await textEnhancer.enhanceText(ocrResult.text);
            enhancedText = enhancementResult.enhancedText;
            corrections = enhancementResult.corrections;
          }

          // Classify document if requested
          let classification;
          if (options.classifyDocuments) {
            const classificationResult = await documentClassifier.classifyDocument(enhancedText);
            classification = {
              documentType: classificationResult.documentType.id,
              confidence: classificationResult.confidence,
              category: classificationResult.documentType.category,
              isHandwritten: classificationResult.extractedFeatures.handwritingIndicators.length > 0
            };
          }

          // Store result in database
          const { error: dbError } = await supabase
            .from('ocr_results')
            .insert({
              id: resultItem.documentId,
              user_id: userId,
              batch_job_id: jobId,
              original_text: ocrResult.text,
              enhanced_text: enhancedText,
              confidence: ocrResult.confidence,
              engine_used: ocrResult.metadata.engineUsed,
              processing_time_ms: ocrResult.metadata.processingTime,
              file_name: file.originalFilename,
              file_size: file.size,
              file_type: file.mimetype,
              image_metadata: ocrResult.metadata.imageMetadata,
              corrections: corrections,
              document_type: classification?.documentType,
              document_category: classification?.category,
              classification_confidence: classification?.confidence,
              is_handwritten: classification?.isHandwritten || false,
              quality_score: ocrResult.confidence,
              processing_steps: ['ocr_extraction', 'arabic_enhancement', 'classification'].filter(Boolean),
              created_at: new Date().toISOString()
            });

          if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
          }

          // Update result status
          resultItem.status = 'completed';
          resultItem.confidence = ocrResult.confidence;
          resultItem.documentType = classification?.documentType;
          
          job.successfulFiles++;
          job.processedFiles++;

          // Clean up temporary file
          try {
            await fs.unlink(file.filepath);
          } catch (cleanupError) {
            structuredLogger.warn('Failed to cleanup temporary file', {
              filePath: file.filepath,
              error: cleanupError.message
            });
          }

        } catch (fileError) {
          structuredLogger.error('Batch file processing failed', {
            jobId,
            fileName: file.originalFilename,
            error: fileError.message
          });

          resultItem.status = 'failed';
          resultItem.error = fileError.message;
          
          job.failedFiles++;
          job.processedFiles++;
          job.errors.push(`${file.originalFilename}: ${fileError.message}`);

          if (options.stopOnFirstError) {
            throw new Error(`Stopping batch on first error: ${fileError.message}`);
          }
        }

        batchJobs.set(jobId, job);
      });

      await Promise.all(chunkPromises);

      // Check if we should stop on error
      if (options.stopOnFirstError && job.failedFiles > 0) {
        break;
      }
    }

    // Mark job as completed
    job.status = 'completed';
    job.endTime = new Date().toISOString();
    batchJobs.set(jobId, job);

    // Log completion
    await auditLogger.logEvent({
      userId,
      action: 'batch_ocr_completed',
      resourceType: 'batch_job',
      resourceId: jobId,
      details: {
        totalFiles: job.totalFiles,
        successfulFiles: job.successfulFiles,
        failedFiles: job.failedFiles,
        processingTime: Date.now() - new Date(job.startTime).getTime()
      },
      ipAddress: 'system'
    });

    structuredLogger.info('Batch OCR job completed', {
      jobId,
      totalFiles: job.totalFiles,
      successfulFiles: job.successfulFiles,
      failedFiles: job.failedFiles
    });

  } catch (error) {
    structuredLogger.error('Batch processing error', { jobId, error: error.message });
    
    job.status = 'failed';
    job.endTime = new Date().toISOString();
    job.errors.push(`Batch processing error: ${error.message}`);
    batchJobs.set(jobId, job);
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      // Return list of user's batch jobs from database
      const { data: batchJobs, error: queryError } = await supabase
        .from('ocr_results')
        .select('batch_job_id, created_at')
        .eq('user_id', user.id)
        .not('batch_job_id', 'is', null)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      // Group by batch job ID and get summary
      const jobSummaries = new Map();
      
      for (const result of batchJobs || []) {
        const batchJobId = result.batch_job_id;
        if (!jobSummaries.has(batchJobId)) {
          jobSummaries.set(batchJobId, {
            jobId: batchJobId,
            createdAt: result.created_at,
            totalFiles: 0,
            completedFiles: 0
          });
        }
        
        const summary = jobSummaries.get(batchJobId);
        summary.totalFiles++;
        summary.completedFiles++;
      }

      return NextResponse.json({
        success: true,
        batchJobs: Array.from(jobSummaries.values())
      });
    }

    // Return specific job status
    const job = batchJobs.get(jobId);
    
    if (!job) {
      // Try to fetch from database
      const { data: dbResults, error: queryError } = await supabase
        .from('ocr_results')
        .select('*')
        .eq('batch_job_id', jobId)
        .eq('user_id', user.id);

      if (queryError || !dbResults || dbResults.length === 0) {
        return NextResponse.json(
          { error: 'Batch job not found' },
          { status: 404 }
        );
      }

      // Reconstruct job status from database
      const reconstructedJob: BatchJobStatus = {
        jobId,
        status: 'completed',
        totalFiles: dbResults.length,
        processedFiles: dbResults.length,
        successfulFiles: dbResults.filter(r => r.confidence > 0).length,
        failedFiles: dbResults.filter(r => r.confidence === 0).length,
        startTime: dbResults[0].created_at,
        endTime: dbResults[dbResults.length - 1].created_at,
        results: dbResults.map(r => ({
          documentId: r.id,
          fileName: r.file_name,
          status: 'completed' as const,
          confidence: r.confidence,
          documentType: r.document_type
        })),
        errors: []
      };

      return NextResponse.json({
        success: true,
        job: reconstructedJob
      });
    }

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error) {
    structuredLogger.error('Batch status query error', { error: error.message });
    
    return NextResponse.json(
      { error: 'Failed to retrieve batch status' },
      { status: 500 }
    );
  }
}