import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/supabase-server-client';
import { ArabicTextEnhancer } from '@/libs/ocr/arabic-text-enhancement';
import { DocumentClassificationService } from '@/libs/ocr/document-classification-service';
import { openRouterClient } from '@/libs/services/openrouter-client';
import { structuredLogger } from '@/libs/logging/structured-logger';
import { auditLogger } from '@/libs/logging/audit-logger';
import { z } from 'zod';

const ValidationRequestSchema = z.object({
  documentId: z.string().optional(),
  originalText: z.string().min(1, 'Original text is required'),
  correctedText: z.string().min(1, 'Corrected text is required'),
  validationType: z.enum(['manual', 'ai_assisted', 'hybrid']).optional().default('manual'),
  confidence: z.number().min(0).max(1).optional(),
  corrections: z.array(z.object({
    type: z.enum(['diacritic', 'character', 'number', 'layout', 'common_error']),
    original: z.string(),
    corrected: z.string(),
    position: z.number(),
    confidence: z.number(),
    isManualCorrection: z.boolean().optional().default(true)
  })).optional().default([]),
  feedback: z.object({
    accuracy: z.enum(['excellent', 'good', 'fair', 'poor']),
    readability: z.enum(['excellent', 'good', 'fair', 'poor']),
    completeness: z.enum(['complete', 'mostly_complete', 'incomplete', 'very_incomplete']),
    comments: z.string().optional(),
    suggestedImprovements: z.array(z.string()).optional().default([])
  }).optional()
});

interface ValidationResult {
  validationId: string;
  documentId?: string;
  originalText: string;
  correctedText: string;
  aiSuggestions?: {
    suggestedText: string;
    confidence: number;
    corrections: Array<{
      type: string;
      original: string;
      suggested: string;
      position: number;
      confidence: number;
      reasoning: string;
    }>;
  };
  qualityMetrics: {
    improvementScore: number;
    confidenceIncrease: number;
    readabilityScore: number;
    completenessScore: number;
  };
  learningData: {
    patternCorrections: Array<{
      pattern: string;
      correction: string;
      frequency: number;
      context: string;
    }>;
    commonErrors: Array<{
      errorType: string;
      frequency: number;
      suggestedFix: string;
    }>;
  };
  metadata: {
    validationType: string;
    processingTime: number;
    validationDate: string;
    userId: string;
  };
}

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
    const validationData = ValidationRequestSchema.parse(body);

    structuredLogger.info('Starting OCR validation', {
      userId: user.id,
      documentId: validationData.documentId,
      validationType: validationData.validationType,
      originalLength: validationData.originalText.length,
      correctedLength: validationData.correctedText.length
    });

    const validationId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate basic quality metrics
    const qualityMetrics = calculateQualityMetrics(
      validationData.originalText,
      validationData.correctedText,
      validationData.corrections
    );

    // Get AI suggestions if requested
    let aiSuggestions;
    if (validationData.validationType === 'ai_assisted' || validationData.validationType === 'hybrid') {
      aiSuggestions = await getAISuggestions(validationData.originalText, validationData.correctedText);
    }

    // Extract learning patterns
    const learningData = extractLearningPatterns(
      validationData.originalText,
      validationData.correctedText,
      validationData.corrections
    );

    // Create validation result
    const validationResult: ValidationResult = {
      validationId,
      documentId: validationData.documentId,
      originalText: validationData.originalText,
      correctedText: validationData.correctedText,
      aiSuggestions,
      qualityMetrics,
      learningData,
      metadata: {
        validationType: validationData.validationType,
        processingTime: Date.now() - startTime,
        validationDate: new Date().toISOString(),
        userId: user.id
      }
    };

    // Store validation in database
    const { data: validationRecord, error: dbError } = await supabase
      .from('ocr_validations')
      .insert({
        id: validationId,
        user_id: user.id,
        document_id: validationData.documentId,
        original_text: validationData.originalText,
        corrected_text: validationData.correctedText,
        validation_type: validationData.validationType,
        corrections: validationData.corrections,
        ai_suggestions: aiSuggestions,
        quality_metrics: qualityMetrics,
        learning_data: learningData,
        user_feedback: validationData.feedback,
        processing_time_ms: validationResult.metadata.processingTime,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      structuredLogger.error('Failed to store validation result', {
        validationId,
        error: dbError.message
      });
      // Continue processing even if storage fails
    }

    // Update original OCR result if document ID provided
    if (validationData.documentId) {
      const { error: updateError } = await supabase
        .from('ocr_results')
        .update({
          validated_text: validationData.correctedText,
          validation_id: validationId,
          validation_confidence: qualityMetrics.improvementScore,
          validation_date: new Date().toISOString(),
          validation_corrections: validationData.corrections
        })
        .eq('id', validationData.documentId)
        .eq('user_id', user.id);

      if (updateError) {
        structuredLogger.warn('Failed to update OCR result with validation', {
          documentId: validationData.documentId,
          error: updateError.message
        });
      }
    }

    // Store learning patterns for future improvements
    await storeLearningPatterns(learningData, user.id, supabase);

    // Log audit event
    await auditLogger.logEvent({
      userId: user.id,
      action: 'ocr_text_validated',
      resourceType: 'validation',
      resourceId: validationId,
      details: {
        documentId: validationData.documentId,
        validationType: validationData.validationType,
        correctionCount: validationData.corrections.length,
        improvementScore: qualityMetrics.improvementScore,
        processingTime: validationResult.metadata.processingTime
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    });

    structuredLogger.info('OCR validation completed', {
      validationId,
      userId: user.id,
      documentId: validationData.documentId,
      improvementScore: qualityMetrics.improvementScore,
      processingTime: validationResult.metadata.processingTime
    });

    return NextResponse.json({
      success: true,
      result: validationResult
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      structuredLogger.warn('Validation request validation error', {
        errors: error.errors,
        processingTime
      });
      
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    structuredLogger.error('OCR validation error', {
      error: error.message,
      processingTime
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAISuggestions(originalText: string, correctedText: string) {
  try {
    const prompt = `
You are an expert in Arabic OCR text correction. Analyze the following OCR text and its human correction to provide suggestions for improvement.

Original OCR Text:
${originalText}

Human Corrected Text:
${correctedText}

Please analyze the differences and provide:
1. Specific corrections made by the human
2. Additional suggestions for improvement
3. Confidence scores for each suggestion
4. Reasoning for each correction

Respond in JSON format with the following structure:
{
  "suggestedText": "improved version of the text",
  "confidence": 0.95,
  "corrections": [
    {
      "type": "character|word|punctuation|diacritic",
      "original": "original text",
      "suggested": "suggested correction",
      "position": 123,
      "confidence": 0.9,
      "reasoning": "explanation of why this correction is suggested"
    }
  ]
}
`;

    const response = await openRouterClient.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const suggestion = response.choices[0]?.message?.content;
    if (suggestion) {
      return JSON.parse(suggestion);
    }

    return null;
  } catch (error) {
    structuredLogger.warn('Failed to get AI suggestions', { error: error.message });
    return null;
  }
}

function calculateQualityMetrics(originalText: string, correctedText: string, corrections: any[]) {
  // Calculate improvement score based on corrections made
  const totalCharacters = originalText.length;
  const correctionCount = corrections.length;
  
  // Base improvement score
  let improvementScore = 0.5; // Base score
  
  if (correctionCount > 0) {
    // Positive corrections increase score
    const correctionRatio = Math.min(correctionCount / (totalCharacters * 0.1), 1);
    improvementScore += correctionRatio * 0.3;
  }

  // Calculate confidence increase
  const averageCorrectionConfidence = corrections.length > 0 
    ? corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length
    : 0.5;
  
  const confidenceIncrease = averageCorrectionConfidence * 0.4;

  // Simple readability score based on text structure
  const readabilityScore = calculateReadabilityScore(correctedText);
  
  // Completeness score based on text length and structure
  const completenessScore = calculateCompletenessScore(correctedText);

  return {
    improvementScore: Math.min(improvementScore, 1.0),
    confidenceIncrease,
    readabilityScore,
    completenessScore
  };
}

function calculateReadabilityScore(text: string): number {
  // Simple readability metrics for Arabic text
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?؟۔]/).filter(s => s.trim().length > 0);
  
  if (words.length === 0 || sentences.length === 0) return 0;
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  
  // Optimal Arabic readability: 8-12 words per sentence, 4-8 characters per word
  const sentenceLengthScore = Math.max(0, 1 - Math.abs(avgWordsPerSentence - 10) / 10);
  const wordLengthScore = Math.max(0, 1 - Math.abs(avgWordLength - 6) / 6);
  
  return (sentenceLengthScore + wordLengthScore) / 2;
}

function calculateCompletenessScore(text: string): number {
  // Check for common document completeness indicators
  const hasNumbers = /\d/.test(text);
  const hasDates = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
  const hasProperNouns = /[A-Z][a-z]+|[أ-ي]{2,}/.test(text);
  const hasMinLength = text.length > 50;
  const hasStructure = text.includes('\n') || text.includes('.') || text.includes('؟');
  
  const indicators = [hasNumbers, hasDates, hasProperNouns, hasMinLength, hasStructure];
  return indicators.filter(Boolean).length / indicators.length;
}

function extractLearningPatterns(originalText: string, correctedText: string, corrections: any[]) {
  const patternCorrections: Array<{ pattern: string; correction: string; frequency: number; context: string }> = [];
  const commonErrors: Array<{ errorType: string; frequency: number; suggestedFix: string }> = [];

  // Group corrections by type
  const errorTypes = new Map<string, number>();
  const patterns = new Map<string, { correction: string; context: string }>();

  corrections.forEach(correction => {
    // Count error types
    const currentCount = errorTypes.get(correction.type) || 0;
    errorTypes.set(correction.type, currentCount + 1);

    // Extract patterns
    const pattern = correction.original;
    const contextStart = Math.max(0, correction.position - 10);
    const contextEnd = Math.min(originalText.length, correction.position + correction.original.length + 10);
    const context = originalText.substring(contextStart, contextEnd);

    if (patterns.has(pattern)) {
      patterns.get(pattern)!.frequency = (patterns.get(pattern)!.frequency || 1) + 1;
    } else {
      patterns.set(pattern, { correction: correction.corrected, context, frequency: 1 });
    }
  });

  // Convert to arrays
  patterns.forEach((data, pattern) => {
    patternCorrections.push({
      pattern,
      correction: data.correction,
      frequency: data.frequency,
      context: data.context
    });
  });

  errorTypes.forEach((frequency, errorType) => {
    const relevantCorrections = corrections.filter(c => c.type === errorType);
    const suggestedFix = relevantCorrections.length > 0 
      ? `Common fix: ${relevantCorrections[0].corrected}` 
      : 'Review and correct manually';

    commonErrors.push({
      errorType,
      frequency,
      suggestedFix
    });
  });

  return { patternCorrections, commonErrors };
}

async function storeLearningPatterns(learningData: any, userId: string, supabase: any) {
  try {
    // Store pattern corrections for machine learning
    for (const pattern of learningData.patternCorrections) {
      await supabase
        .from('ocr_learning_patterns')
        .upsert({
          pattern: pattern.pattern,
          correction: pattern.correction,
          frequency: pattern.frequency,
          context: pattern.context,
          user_id: userId,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'pattern,user_id'
        });
    }

    // Store common errors for analysis
    for (const error of learningData.commonErrors) {
      await supabase
        .from('ocr_error_patterns')
        .upsert({
          error_type: error.errorType,
          frequency: error.frequency,
          suggested_fix: error.suggestedFix,
          user_id: userId,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'error_type,user_id'
        });
    }
  } catch (error) {
    structuredLogger.warn('Failed to store learning patterns', { error: error.message });
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
    const validationId = url.searchParams.get('validationId');
    const documentId = url.searchParams.get('documentId');

    if (validationId) {
      // Get specific validation
      const { data: validation, error: fetchError } = await supabase
        .from('ocr_validations')
        .select('*')
        .eq('id', validationId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !validation) {
        return NextResponse.json(
          { error: 'Validation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        validation
      });
    }

    if (documentId) {
      // Get validations for specific document
      const { data: validations, error: fetchError } = await supabase
        .from('ocr_validations')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return NextResponse.json({
        success: true,
        validations: validations || []
      });
    }

    // Get recent validations
    const { data: validations, error: fetchError } = await supabase
      .from('ocr_validations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    return NextResponse.json({
      success: true,
      validations: validations || []
    });

  } catch (error) {
    structuredLogger.error('Validation query error', { error: error.message });
    
    return NextResponse.json(
      { error: 'Failed to retrieve validations' },
      { status: 500 }
    );
  }
}