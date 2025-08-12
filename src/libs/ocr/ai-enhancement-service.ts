import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';
import { openRouterClient } from '../services/openrouter-client';
import { OCRResult } from './ocr-processing-service';
import { ClassificationResult } from './document-classification-service';
import { ArabicTextEnhancer, TextEnhancementResult } from './arabic-text-enhancement';

export interface AIEnhancementOptions {
  useContextualCorrection?: boolean;
  extractEntities?: boolean;
  improvePunctuation?: boolean;
  enhanceFormatting?: boolean;
  fixGrammar?: boolean;
  preserveOriginalMeaning?: boolean;
  confidenceThreshold?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface EntityExtractionResult {
  entities: Array<{
    type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'phone' | 'email' | 'id_number' | 'contract_term';
    text: string;
    normalizedText: string;
    position: { start: number; end: number };
    confidence: number;
    metadata?: any;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    confidence: number;
  }>;
}

export interface AIEnhancementResult {
  originalText: string;
  enhancedText: string;
  corrections: Array<{
    type: 'contextual' | 'grammatical' | 'formatting' | 'entity' | 'punctuation';
    original: string;
    corrected: string;
    position: number;
    confidence: number;
    reasoning: string;
    isAiSuggestion: boolean;
  }>;
  entities?: EntityExtractionResult;
  qualityScore: number;
  improvementAreas: string[];
  processingMetadata: {
    modelUsed: string;
    tokensUsed: number;
    processingTime: number;
    confidenceScore: number;
  };
}

export class AIEnhancementService {
  private logger: Logger;
  private textEnhancer: ArabicTextEnhancer;

  constructor() {
    this.logger = structuredLogger;
    this.textEnhancer = new ArabicTextEnhancer();
  }

  async enhanceOCRText(
    ocrResult: OCRResult,
    documentClassification?: ClassificationResult,
    options: AIEnhancementOptions = {}
  ): Promise<AIEnhancementResult> {
    const startTime = Date.now();

    const defaultOptions: AIEnhancementOptions = {
      useContextualCorrection: true,
      extractEntities: true,
      improvePunctuation: true,
      enhanceFormatting: true,
      fixGrammar: true,
      preserveOriginalMeaning: true,
      confidenceThreshold: 0.7,
      maxTokens: 4000,
      temperature: 0.2
    };

    const finalOptions = { ...defaultOptions, ...options };

    this.logger.info('Starting AI enhancement', {
      textLength: ocrResult.text.length,
      confidence: ocrResult.confidence,
      documentType: documentClassification?.documentType?.id,
      options: finalOptions
    });

    try {
      // Step 1: Contextual correction using AI
      let enhancedText = ocrResult.text;
      const corrections: AIEnhancementResult['corrections'] = [];

      if (finalOptions.useContextualCorrection) {
        const contextualResult = await this.performContextualCorrection(
          ocrResult.text,
          documentClassification,
          finalOptions
        );
        enhancedText = contextualResult.enhancedText;
        corrections.push(...contextualResult.corrections);
      }

      // Step 2: Extract entities if requested
      let entities: EntityExtractionResult | undefined;
      if (finalOptions.extractEntities) {
        entities = await this.extractEntities(enhancedText, documentClassification);
      }

      // Step 3: Improve formatting and structure
      if (finalOptions.enhanceFormatting) {
        const formatResult = await this.enhanceFormatting(
          enhancedText,
          documentClassification,
          finalOptions
        );
        enhancedText = formatResult.enhancedText;
        corrections.push(...formatResult.corrections);
      }

      // Step 4: Calculate quality score and improvement areas
      const qualityScore = this.calculateQualityScore(ocrResult.text, enhancedText, corrections);
      const improvementAreas = this.identifyImprovementAreas(corrections, ocrResult);

      const result: AIEnhancementResult = {
        originalText: ocrResult.text,
        enhancedText,
        corrections,
        entities,
        qualityScore,
        improvementAreas,
        processingMetadata: {
          modelUsed: 'anthropic/claude-3-haiku',
          tokensUsed: 0, // Will be updated based on actual usage
          processingTime: Date.now() - startTime,
          confidenceScore: qualityScore
        }
      };

      this.logger.info('AI enhancement completed', {
        originalLength: ocrResult.text.length,
        enhancedLength: enhancedText.length,
        correctionCount: corrections.length,
        qualityScore,
        processingTime: result.processingMetadata.processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('AI enhancement failed', {
        error: error.message,
        textLength: ocrResult.text.length,
        processingTime: Date.now() - startTime
      });

      // Return original text with error information
      return {
        originalText: ocrResult.text,
        enhancedText: ocrResult.text,
        corrections: [],
        qualityScore: ocrResult.confidence,
        improvementAreas: ['ai_enhancement_failed'],
        processingMetadata: {
          modelUsed: 'none',
          tokensUsed: 0,
          processingTime: Date.now() - startTime,
          confidenceScore: 0
        }
      };
    }
  }

  private async performContextualCorrection(
    text: string,
    classification?: ClassificationResult,
    options: AIEnhancementOptions = {}
  ): Promise<{ enhancedText: string; corrections: AIEnhancementResult['corrections'] }> {
    try {
      const prompt = this.buildContextualCorrectionPrompt(text, classification);

      const response = await openRouterClient.chat.completions.create({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.2,
        max_tokens: options.maxTokens || 3000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI model');
      }

      const parsed = JSON.parse(aiResponse);
      
      return {
        enhancedText: parsed.enhancedText || text,
        corrections: (parsed.corrections || []).map((correction: any) => ({
          ...correction,
          isAiSuggestion: true
        }))
      };

    } catch (error) {
      this.logger.warn('Contextual correction failed', { error: error.message });
      return { enhancedText: text, corrections: [] };
    }
  }

  private buildContextualCorrectionPrompt(text: string, classification?: ClassificationResult): string {
    const documentContext = classification 
      ? `This is a ${classification.documentType.name} (${classification.documentType.nameAr}) document in the ${classification.documentType.category} category.`
      : 'This is a document that may contain Arabic and English text.';

    return `You are an expert in Arabic OCR text correction and Arabic-English document processing. Your task is to improve the following OCR-extracted text by fixing errors while preserving the original meaning and format.

${documentContext}

OCR Text to Correct:
${text}

Please:
1. Fix obvious OCR errors (character misrecognition, spacing issues)
2. Correct Arabic text while preserving diacritics if present
3. Fix English spelling and grammar errors
4. Improve punctuation and formatting
5. Maintain the original document structure and meaning
6. Handle mixed Arabic-English content appropriately

Respond in JSON format:
{
  "enhancedText": "corrected version of the entire text",
  "corrections": [
    {
      "type": "contextual|grammatical|formatting|punctuation",
      "original": "original text segment",
      "corrected": "corrected text segment", 
      "position": 123,
      "confidence": 0.95,
      "reasoning": "explanation of the correction"
    }
  ]
}

Important guidelines:
- Preserve Arabic RTL text direction
- Keep technical terms and proper nouns intact
- Maintain legal and formal language style if applicable
- Only suggest high-confidence corrections (>0.7)
- Preserve numbers, dates, and monetary amounts exactly`;
  }

  private async extractEntities(
    text: string,
    classification?: ClassificationResult
  ): Promise<EntityExtractionResult> {
    try {
      const prompt = this.buildEntityExtractionPrompt(text, classification);

      const response = await openRouterClient.chat.completions.create({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI model');
      }

      const parsed = JSON.parse(aiResponse);
      return parsed as EntityExtractionResult;

    } catch (error) {
      this.logger.warn('Entity extraction failed', { error: error.message });
      return { entities: [], relationships: [] };
    }
  }

  private buildEntityExtractionPrompt(text: string, classification?: ClassificationResult): string {
    const documentType = classification?.documentType?.id || 'unknown';
    
    return `Extract relevant entities from this ${documentType} document. Focus on HR-related entities common in Saudi Arabian documents.

Text:
${text}

Extract and normalize these entity types:
- person: Names of people (Arabic and English)
- organization: Company names, government agencies
- location: Cities, addresses, countries
- date: Dates in any format (Hijri or Gregorian)
- amount: Salaries, monetary amounts
- phone: Phone numbers
- email: Email addresses  
- id_number: National ID, Iqama, passport numbers
- contract_term: Employment terms, job titles, durations

Respond in JSON format:
{
  "entities": [
    {
      "type": "person|organization|location|date|amount|phone|email|id_number|contract_term",
      "text": "original text as found",
      "normalizedText": "standardized/cleaned version", 
      "position": {"start": 123, "end": 456},
      "confidence": 0.95,
      "metadata": {"additional_info": "if applicable"}
    }
  ],
  "relationships": [
    {
      "from": "entity1",
      "to": "entity2", 
      "type": "employed_by|located_in|dated|amount_of",
      "confidence": 0.9
    }
  ]
}

Guidelines:
- Extract entities in both Arabic and English
- Normalize Arabic names to standard transliteration
- Convert dates to ISO format when possible
- Include Saudi phone number patterns (+966...)
- Identify Hijri dates and convert if clear`;
  }

  private async enhanceFormatting(
    text: string,
    classification?: ClassificationResult,
    options: AIEnhancementOptions = {}
  ): Promise<{ enhancedText: string; corrections: AIEnhancementResult['corrections'] }> {
    try {
      const prompt = this.buildFormattingPrompt(text, classification);

      const response = await openRouterClient.chat.completions.create({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI model');
      }

      const parsed = JSON.parse(aiResponse);
      
      return {
        enhancedText: parsed.enhancedText || text,
        corrections: (parsed.corrections || []).map((correction: any) => ({
          ...correction,
          type: 'formatting',
          isAiSuggestion: true
        }))
      };

    } catch (error) {
      this.logger.warn('Formatting enhancement failed', { error: error.message });
      return { enhancedText: text, corrections: [] };
    }
  }

  private buildFormattingPrompt(text: string, classification?: ClassificationResult): string {
    const documentType = classification?.documentType?.id || 'unknown';
    
    return `Improve the formatting and structure of this ${documentType} document while preserving all content.

Text:
${text}

Improvements to make:
1. Fix paragraph breaks and spacing
2. Proper bullet point formatting
3. Consistent indentation
4. Table formatting if applicable
5. Header/footer distinction
6. Proper Arabic RTL formatting
7. Number and date formatting
8. Signature line formatting

Respond in JSON format:
{
  "enhancedText": "formatted version with proper structure",
  "corrections": [
    {
      "original": "original formatting",
      "corrected": "improved formatting",
      "position": 123,
      "confidence": 0.9,
      "reasoning": "formatting improvement explanation"
    }
  ]
}

Guidelines:
- Maintain all original content
- Improve readability through better structure
- Use consistent Arabic and English formatting
- Preserve legal document formatting if applicable
- Add appropriate line breaks and spacing`;
  }

  private calculateQualityScore(
    originalText: string,
    enhancedText: string,
    corrections: AIEnhancementResult['corrections']
  ): number {
    let score = 0.5; // Base score

    // Text length improvement
    if (enhancedText.length >= originalText.length * 0.9) {
      score += 0.1; // No significant text loss
    }

    // Correction quality
    const highConfidenceCorrections = corrections.filter(c => c.confidence > 0.8);
    if (highConfidenceCorrections.length > 0) {
      score += Math.min(0.3, highConfidenceCorrections.length * 0.05);
    }

    // Structural improvements
    const formattingCorrections = corrections.filter(c => c.type === 'formatting');
    if (formattingCorrections.length > 0) {
      score += 0.1;
    }

    // Entity extraction bonus
    const entityCorrections = corrections.filter(c => c.type === 'entity');
    if (entityCorrections.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private identifyImprovementAreas(
    corrections: AIEnhancementResult['corrections'],
    ocrResult: OCRResult
  ): string[] {
    const areas: string[] = [];

    // Low confidence OCR
    if (ocrResult.confidence < 0.7) {
      areas.push('low_ocr_confidence');
    }

    // Many corrections needed
    if (corrections.length > ocrResult.text.length * 0.1) {
      areas.push('high_error_rate');
    }

    // Specific correction types
    const correctionTypes = new Set(corrections.map(c => c.type));
    
    if (correctionTypes.has('contextual')) {
      areas.push('contextual_errors');
    }
    
    if (correctionTypes.has('grammatical')) {
      areas.push('grammar_issues');
    }
    
    if (correctionTypes.has('formatting')) {
      areas.push('formatting_needs_improvement');
    }

    // Arabic-specific issues
    if (ArabicTextEnhancer.containsArabic(ocrResult.text)) {
      const arabicCorrections = corrections.filter(c => 
        /[\u0600-\u06FF]/.test(c.original) || /[\u0600-\u06FF]/.test(c.corrected)
      );
      
      if (arabicCorrections.length > 0) {
        areas.push('arabic_text_issues');
      }
    }

    return areas.length > 0 ? areas : ['no_major_issues'];
  }

  // Method to enhance text with specific focus areas
  async enhanceWithFocus(
    text: string,
    focusAreas: string[],
    documentType?: string
  ): Promise<AIEnhancementResult> {
    const mockOCRResult: OCRResult = {
      text,
      confidence: 0.8,
      words: [],
      lines: [],
      blocks: [],
      metadata: {
        engineUsed: 'focus_enhancement',
        processingTime: 0,
        imageMetadata: { width: 0, height: 0, format: 'unknown' },
        detectedLanguages: []
      }
    };

    const options: AIEnhancementOptions = {
      useContextualCorrection: focusAreas.includes('contextual'),
      extractEntities: focusAreas.includes('entities'),
      improvePunctuation: focusAreas.includes('punctuation'),
      enhanceFormatting: focusAreas.includes('formatting'),
      fixGrammar: focusAreas.includes('grammar'),
      preserveOriginalMeaning: true,
      confidenceThreshold: 0.6
    };

    return this.enhanceOCRText(mockOCRResult, undefined, options);
  }

  // Batch enhancement for multiple documents
  async enhanceBatch(
    ocrResults: Array<{ id: string; result: OCRResult; classification?: ClassificationResult }>,
    options: AIEnhancementOptions = {}
  ): Promise<Array<{ id: string; enhancement: AIEnhancementResult; error?: string }>> {
    const results: Array<{ id: string; enhancement: AIEnhancementResult; error?: string }> = [];

    // Process in smaller batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < ocrResults.length; i += batchSize) {
      const batch = ocrResults.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const enhancement = await this.enhanceOCRText(
            item.result,
            item.classification,
            options
          );
          return { id: item.id, enhancement };
        } catch (error) {
          this.logger.error('Batch enhancement failed for item', {
            id: item.id,
            error: error.message
          });
          
          return {
            id: item.id,
            enhancement: {
              originalText: item.result.text,
              enhancedText: item.result.text,
              corrections: [],
              qualityScore: 0,
              improvementAreas: ['enhancement_failed'],
              processingMetadata: {
                modelUsed: 'none',
                tokensUsed: 0,
                processingTime: 0,
                confidenceScore: 0
              }
            },
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to respect rate limits
      if (i + batchSize < ocrResults.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}