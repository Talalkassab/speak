import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { ArabicTextEnhancer, ArabicTextEnhancementOptions } from '@/libs/ocr/arabic-text-enhancement';
import { structuredLogger } from '@/libs/logging/structured-logger';
import { auditLogger } from '@/libs/logging/audit-logger';
import { z } from 'zod';

const EnhanceRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  documentId: z.string().optional(),
  options: z.object({
    normalizeDiacritics: z.boolean().optional().default(true),
    preserveDiacritics: z.boolean().optional().default(false),
    correctCommonErrors: z.boolean().optional().default(true),
    enhanceRTLLayout: z.boolean().optional().default(true),
    fixCharacterShaping: z.boolean().optional().default(true),
    normalizeNumbers: z.boolean().optional().default(true),
    handleMixedContent: z.boolean().optional().default(true)
  }).optional().default({})
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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

    // Parse request body
    const body = await request.json();
    const { text, documentId, options } = EnhanceRequestSchema.parse(body);

    structuredLogger.info('Starting text enhancement', {
      userId: user.id,
      documentId,
      textLength: text.length,
      options
    });

    // Check if text contains Arabic
    if (!ArabicTextEnhancer.containsArabic(text)) {
      return NextResponse.json({
        success: true,
        result: {
          originalText: text,
          enhancedText: text,
          corrections: [],
          rtlSegments: [],
          metadata: {
            originalLength: text.length,
            enhancedLength: text.length,
            correctionCount: 0,
            confidenceScore: 1.0
          }
        },
        warning: 'Text does not contain Arabic characters. No enhancement performed.'
      });
    }

    // Initialize text enhancer
    const textEnhancer = new ArabicTextEnhancer();

    // Perform text enhancement
    const enhancementResult = await textEnhancer.enhanceText(text, options as ArabicTextEnhancementOptions);

    // If documentId is provided, update the existing OCR result
    if (documentId) {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('ocr_results')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        structuredLogger.warn('Could not fetch existing OCR record for enhancement', {
          documentId,
          error: fetchError.message
        });
      } else if (existingRecord) {
        // Update the record with enhanced text
        const { error: updateError } = await supabase
          .from('ocr_results')
          .update({
            enhanced_text: enhancementResult.enhancedText,
            corrections: enhancementResult.corrections,
            enhancement_metadata: {
              enhancementDate: new Date().toISOString(),
              enhancementOptions: options,
              rtlSegments: enhancementResult.rtlSegments,
              confidenceScore: enhancementResult.metadata.confidenceScore
            }
          })
          .eq('id', documentId)
          .eq('user_id', user.id);

        if (updateError) {
          structuredLogger.error('Failed to update OCR record with enhanced text', {
            documentId,
            error: updateError.message
          });
        } else {
          structuredLogger.info('OCR record updated with enhanced text', { documentId });
        }
      }
    }

    // Log audit event
    await auditLogger.logEvent({
      userId: user.id,
      action: 'text_enhanced',
      resourceType: 'text',
      resourceId: documentId || `text_${Date.now()}`,
      details: {
        originalLength: text.length,
        enhancedLength: enhancementResult.enhancedText.length,
        correctionCount: enhancementResult.corrections.length,
        confidenceScore: enhancementResult.metadata.confidenceScore,
        processingTime: Date.now() - startTime,
        enhancementOptions: options
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    });

    const processingTime = Date.now() - startTime;

    structuredLogger.info('Text enhancement completed', {
      userId: user.id,
      documentId,
      originalLength: text.length,
      enhancedLength: enhancementResult.enhancedText.length,
      correctionCount: enhancementResult.corrections.length,
      confidenceScore: enhancementResult.metadata.confidenceScore,
      processingTime
    });

    return NextResponse.json({
      success: true,
      result: enhancementResult,
      metadata: {
        processingTime,
        updated: !!documentId
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      structuredLogger.warn('Text enhancement validation error', {
        errors: error.errors,
        processingTime
      });
      
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    structuredLogger.error('Text enhancement error', {
      error: error.message,
      processingTime
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    const documentId = url.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Fetch the OCR result
    const { data: ocrResult, error: fetchError } = await supabase
      .from('ocr_results')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !ocrResult) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Return enhancement information
    return NextResponse.json({
      success: true,
      document: {
        id: ocrResult.id,
        originalText: ocrResult.original_text,
        enhancedText: ocrResult.enhanced_text,
        corrections: ocrResult.corrections || [],
        enhancementMetadata: ocrResult.enhancement_metadata || null,
        confidence: ocrResult.confidence,
        engineUsed: ocrResult.engine_used,
        createdAt: ocrResult.created_at
      }
    });

  } catch (error) {
    structuredLogger.error('Get enhancement error', { error: error.message });
    
    return NextResponse.json(
      { error: 'Failed to retrieve enhancement data' },
      { status: 500 }
    );
  }
}