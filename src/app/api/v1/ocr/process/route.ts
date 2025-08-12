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

const ProcessRequestSchema = z.object({
  enhanceArabicText: z.boolean().optional().default(true),
  classifyDocument: z.boolean().optional().default(true),
  engines: z.array(z.enum(['tesseract', 'azure', 'google'])).optional(),
  confidence: z.number().min(0).max(1).optional().default(0.7),
  preserveLayout: z.boolean().optional().default(true),
  language: z.string().optional().default('ara+eng'),
  enhanceImage: z.boolean().optional().default(true)
});

interface ProcessedResult {
  documentId: string;
  ocrResult: {
    text: string;
    confidence: number;
    processingTime: number;
    engineUsed: string;
    textLength: number;
    enhancedText?: string;
    corrections?: any[];
  };
  classification?: {
    documentType: string;
    confidence: number;
    category: string;
    isHandwritten: boolean;
  };
  metadata: {
    fileSize: number;
    fileType: string;
    imageMetadata: any;
    processingSteps: string[];
    qualityScore: number;
  };
}

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
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      filter: ({ mimetype }) => {
        return mimetype?.startsWith('image/') || mimetype === 'application/pdf';
      }
    });

    let fields: any;
    let files: any;

    try {
      [fields, files] = await form.parse(request as any);
    } catch (parseError) {
      structuredLogger.error('Failed to parse multipart form', { error: parseError.message });
      return NextResponse.json(
        { error: 'Invalid file upload format' },
        { status: 400 }
      );
    }

    // Validate request parameters
    const options = ProcessRequestSchema.parse({
      enhanceArabicText: fields.enhanceArabicText?.[0] === 'true',
      classifyDocument: fields.classifyDocument?.[0] === 'true',
      engines: fields.engines?.[0] ? JSON.parse(fields.engines[0]) : undefined,
      confidence: fields.confidence?.[0] ? parseFloat(fields.confidence[0]) : undefined,
      preserveLayout: fields.preserveLayout?.[0] !== 'false',
      language: fields.language?.[0] || 'ara+eng',
      enhanceImage: fields.enhanceImage?.[0] !== 'false'
    });

    // Check if files were uploaded
    const uploadedFileArray = Array.isArray(files.file) ? files.file : [files.file].filter(Boolean);
    if (!uploadedFileArray.length) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    uploadedFiles = uploadedFileArray.map((f: any) => f.filepath);

    // Initialize OCR services
    const ocrProcessor = new MultiEngineOCRProcessor();
    const documentClassifier = new DocumentClassificationService();
    const textEnhancer = new ArabicTextEnhancer();

    const results: ProcessedResult[] = [];

    // Process each uploaded file
    for (const file of uploadedFileArray) {
      const fileStartTime = Date.now();
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        structuredLogger.info('Processing file with OCR', {
          documentId,
          fileName: file.originalFilename,
          fileSize: file.size,
          mimeType: file.mimetype
        });

        // Read file buffer
        const fileBuffer = await fs.readFile(file.filepath);

        // Prepare OCR options
        const ocrOptions: OCROptions = {
          language: options.language,
          confidence: options.confidence,
          preserveLayout: options.preserveLayout,
          enhanceImage: options.enhanceImage
        };

        // Perform OCR processing
        let ocrResult;
        if (options.engines) {
          // Use specific engines if requested
          const availableEngines = await ocrProcessor.getAvailableEngines();
          const requestedEngines = availableEngines.filter(engine => 
            options.engines!.some(reqEngine => 
              engine.name.toLowerCase().includes(reqEngine.toLowerCase())
            )
          );

          if (requestedEngines.length === 0) {
            throw new Error('No requested OCR engines are available');
          }

          // Use first available requested engine
          ocrResult = await requestedEngines[0].process(fileBuffer, ocrOptions);
        } else {
          // Use best available engine
          ocrResult = await ocrProcessor.processWithBestEngine(fileBuffer, ocrOptions);
        }

        const processingSteps = ['ocr_extraction'];

        // Enhance Arabic text if requested
        let enhancedText = ocrResult.text;
        let corrections: any[] = [];

        if (options.enhanceArabicText && ArabicTextEnhancer.containsArabic(ocrResult.text)) {
          const enhancementResult = await textEnhancer.enhanceText(ocrResult.text, {
            normalizeDiacritics: true,
            correctCommonErrors: true,
            enhanceRTLLayout: true,
            fixCharacterShaping: true,
            normalizeNumbers: true,
            handleMixedContent: true
          });

          enhancedText = enhancementResult.enhancedText;
          corrections = enhancementResult.corrections;
          processingSteps.push('arabic_text_enhancement');

          structuredLogger.info('Arabic text enhancement completed', {
            documentId,
            originalLength: ocrResult.text.length,
            enhancedLength: enhancedText.length,
            correctionCount: corrections.length,
            confidenceScore: enhancementResult.metadata.confidenceScore
          });
        }

        // Classify document if requested
        let classification;
        if (options.classifyDocument) {
          const classificationResult = await documentClassifier.classifyDocument(
            enhancedText,
            null, // Layout analysis not implemented yet
            ocrResult.metadata.imageMetadata
          );

          classification = {
            documentType: classificationResult.documentType.id,
            confidence: classificationResult.confidence,
            category: classificationResult.documentType.category,
            isHandwritten: classificationResult.extractedFeatures.handwritingIndicators.length > 0
          };

          processingSteps.push('document_classification');

          structuredLogger.info('Document classification completed', {
            documentId,
            documentType: classification.documentType,
            confidence: classification.confidence,
            category: classification.category,
            isHandwritten: classification.isHandwritten
          });
        }

        // Calculate quality score
        const qualityScore = this.calculateQualityScore(ocrResult, corrections);

        // Store OCR result in database
        const { data: ocrRecord, error: dbError } = await supabase
          .from('ocr_results')
          .insert({
            id: documentId,
            user_id: user.id,
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
            quality_score: qualityScore,
            processing_steps: processingSteps,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (dbError) {
          structuredLogger.error('Failed to store OCR result', {
            documentId,
            error: dbError.message
          });
        }

        // Prepare result
        const result: ProcessedResult = {
          documentId,
          ocrResult: {
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            processingTime: ocrResult.metadata.processingTime,
            engineUsed: ocrResult.metadata.engineUsed,
            textLength: ocrResult.text.length,
            enhancedText: options.enhanceArabicText ? enhancedText : undefined,
            corrections: options.enhanceArabicText ? corrections : undefined
          },
          classification: options.classifyDocument ? classification : undefined,
          metadata: {
            fileSize: file.size,
            fileType: file.mimetype,
            imageMetadata: ocrResult.metadata.imageMetadata,
            processingSteps,
            qualityScore
          }
        };

        results.push(result);

        // Log audit event
        await auditLogger.logEvent({
          userId: user.id,
          action: 'ocr_document_processed',
          resourceType: 'document',
          resourceId: documentId,
          details: {
            fileName: file.originalFilename,
            fileSize: file.size,
            confidence: ocrResult.confidence,
            engineUsed: ocrResult.metadata.engineUsed,
            documentType: classification?.documentType,
            processingTime: Date.now() - fileStartTime
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        });

        structuredLogger.info('OCR processing completed successfully', {
          documentId,
          fileName: file.originalFilename,
          confidence: ocrResult.confidence,
          textLength: ocrResult.text.length,
          processingTime: Date.now() - fileStartTime
        });

      } catch (fileError) {
        structuredLogger.error('OCR processing failed for file', {
          documentId,
          fileName: file.originalFilename,
          error: fileError.message,
          processingTime: Date.now() - fileStartTime
        });

        // Add error result
        results.push({
          documentId,
          ocrResult: {
            text: '',
            confidence: 0,
            processingTime: Date.now() - fileStartTime,
            engineUsed: 'none',
            textLength: 0
          },
          metadata: {
            fileSize: file.size,
            fileType: file.mimetype,
            imageMetadata: {},
            processingSteps: ['error'],
            qualityScore: 0
          }
        });
      }
    }

    // Clean up temporary files
    for (const filePath of uploadedFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        structuredLogger.warn('Failed to cleanup temporary file', {
          filePath,
          error: cleanupError.message
        });
      }
    }

    const totalProcessingTime = Date.now() - startTime;

    structuredLogger.info('OCR batch processing completed', {
      totalFiles: uploadedFileArray.length,
      successfulFiles: results.filter(r => r.ocrResult.confidence > 0).length,
      totalProcessingTime,
      averageConfidence: results.reduce((sum, r) => sum + r.ocrResult.confidence, 0) / results.length
    });

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalFiles: uploadedFileArray.length,
        successfulFiles: results.filter(r => r.ocrResult.confidence > 0).length,
        failedFiles: results.filter(r => r.ocrResult.confidence === 0).length,
        averageConfidence: results.reduce((sum, r) => sum + r.ocrResult.confidence, 0) / results.length,
        totalProcessingTime,
        averageProcessingTime: totalProcessingTime / uploadedFileArray.length
      }
    });

  } catch (error) {
    structuredLogger.error('OCR processing endpoint error', {
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

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function calculateQualityScore(ocrResult: any, corrections: any[]): number {
  let score = ocrResult.confidence;

  // Adjust based on text length (longer texts might be more reliable)
  if (ocrResult.text.length > 100) {
    score += 0.1;
  } else if (ocrResult.text.length < 20) {
    score -= 0.2;
  }

  // Adjust based on corrections made
  if (corrections.length > 0) {
    const correctionRatio = corrections.length / ocrResult.text.split(' ').length;
    score -= correctionRatio * 0.3; // Reduce score if many corrections were needed
  }

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, score));
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
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const documentType = url.searchParams.get('documentType');
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');

    let query = supabase
      .from('ocr_results')
      .select('*')
      .eq('user_id', user.id)
      .gte('confidence', minConfidence)
      .order('created_at', { ascending: false });

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data: results, error: queryError, count } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      results: results || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    structuredLogger.error('OCR results query error', { error: error.message });
    
    return NextResponse.json(
      { error: 'Failed to retrieve OCR results' },
      { status: 500 }
    );
  }
}