import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';

export interface ArabicTextEnhancementOptions {
  normalizeDiacritics?: boolean;
  preserveDiacritics?: boolean;
  correctCommonErrors?: boolean;
  enhanceRTLLayout?: boolean;
  fixCharacterShaping?: boolean;
  normalizeNumbers?: boolean;
  handleMixedContent?: boolean;
}

export interface TextEnhancementResult {
  originalText: string;
  enhancedText: string;
  corrections: Array<{
    type: 'diacritic' | 'character' | 'number' | 'layout' | 'common_error';
    original: string;
    corrected: string;
    position: number;
    confidence: number;
  }>;
  rtlSegments: Array<{
    text: string;
    startIndex: number;
    endIndex: number;
    direction: 'rtl' | 'ltr';
    language: 'arabic' | 'english' | 'mixed';
  }>;
  metadata: {
    originalLength: number;
    enhancedLength: number;
    correctionCount: number;
    confidenceScore: number;
  };
}

export class ArabicTextEnhancer {
  private logger: Logger;
  
  // Arabic character mappings for common OCR errors
  private readonly characterCorrections = new Map([
    // Common OCR misreadings
    ['ا', 'ا'], // Alif variations
    ['إ', 'إ'], // Alif with hamza above
    ['أ', 'أ'], // Alif with hamza below
    ['آ', 'آ'], // Alif with madda
    ['ة', 'ة'], // Taa marbouta
    ['ه', 'ه'], // Haa
    ['ي', 'ي'], // Yaa
    ['ى', 'ى'], // Alif maksura
    ['ك', 'ك'], // Kaaf
    ['ؤ', 'ؤ'], // Waw with hamza
    ['ئ', 'ئ'], // Yaa with hamza
    
    // Common OCR confusion pairs
    ['رن', 'زن'], // Ra-Noon vs Zay-Noon
    ['حج', 'خچ'], // Ha-Jeem vs Kha-Che
    ['سب', 'شب'], // Seen-Baa vs Sheen-Baa
    ['عل', 'غل'], // Ain-Lam vs Ghain-Lam
    ['فق', 'قف'], // Faa-Qaaf vs Qaaf-Faa
    ['لا', 'لآ'], // Lam-Alif ligature variations
  ]);

  // Common Arabic words that are frequently misrecognized
  private readonly commonWordCorrections = new Map([
    ['الله', 'الله'], // Allah
    ['محمد', 'محمد'], // Muhammad
    ['السلام', 'السلام'], // As-Salam
    ['عليكم', 'عليكم'], // Alaykum
    ['بسم', 'بسم'], // Bismi
    ['الرحمن', 'الرحمن'], // Ar-Rahman
    ['الرحيم', 'الرحيم'], // Ar-Raheem
    ['المملكة', 'المملكة'], // Kingdom
    ['العربية', 'العربية'], // Arabia
    ['السعودية', 'السعودية'], // Saudi
    ['الرياض', 'الرياض'], // Riyadh
    ['جدة', 'جدة'], // Jeddah
    ['مكة', 'مكة'], // Mecca
    ['المدينة', 'المدينة'], // Medina
  ]);

  // Diacritic normalization rules
  private readonly diacriticNormalization = new Map([
    ['َ', 'َ'], // Fatha
    ['ُ', 'ُ'], // Damma
    ['ِ', 'ِ'], // Kasra
    ['ْ', 'ْ'], // Sukun
    ['ً', 'ً'], // Tanween Fath
    ['ٌ', 'ٌ'], // Tanween Damm
    ['ٍ', 'ٍ'], // Tanween Kasr
    ['ّ', 'ّ'], // Shadda
    ['ٰ', 'ٰ'], // Superscript Alif
  ]);

  constructor() {
    this.logger = structuredLogger;
  }

  async enhanceText(
    text: string, 
    options: ArabicTextEnhancementOptions = {}
  ): Promise<TextEnhancementResult> {
    const defaultOptions: ArabicTextEnhancementOptions = {
      normalizeDiacritics: true,
      preserveDiacritics: false,
      correctCommonErrors: true,
      enhanceRTLLayout: true,
      fixCharacterShaping: true,
      normalizeNumbers: true,
      handleMixedContent: true
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    this.logger.info('Starting Arabic text enhancement', {
      textLength: text.length,
      options: finalOptions
    });

    let enhancedText = text;
    const corrections: TextEnhancementResult['corrections'] = [];
    
    // Step 1: Fix character shaping issues
    if (finalOptions.fixCharacterShaping) {
      const { text: shapedText, corrections: shapingCorrections } = 
        this.fixCharacterShaping(enhancedText);
      enhancedText = shapedText;
      corrections.push(...shapingCorrections);
    }

    // Step 2: Correct common OCR errors
    if (finalOptions.correctCommonErrors) {
      const { text: correctedText, corrections: errorCorrections } = 
        this.correctCommonErrors(enhancedText);
      enhancedText = correctedText;
      corrections.push(...errorCorrections);
    }

    // Step 3: Handle diacritics
    if (finalOptions.normalizeDiacritics || finalOptions.preserveDiacritics) {
      const { text: diacriticText, corrections: diacriticCorrections } = 
        this.handleDiacritics(enhancedText, finalOptions);
      enhancedText = diacriticText;
      corrections.push(...diacriticCorrections);
    }

    // Step 4: Normalize numbers
    if (finalOptions.normalizeNumbers) {
      const { text: numberText, corrections: numberCorrections } = 
        this.normalizeNumbers(enhancedText);
      enhancedText = numberText;
      corrections.push(...numberCorrections);
    }

    // Step 5: Analyze RTL segments
    const rtlSegments = finalOptions.enhanceRTLLayout ? 
      this.analyzeRTLSegments(enhancedText) : [];

    // Step 6: Apply RTL layout enhancements
    if (finalOptions.enhanceRTLLayout) {
      enhancedText = this.enhanceRTLLayout(enhancedText, rtlSegments);
    }

    const result: TextEnhancementResult = {
      originalText: text,
      enhancedText,
      corrections,
      rtlSegments,
      metadata: {
        originalLength: text.length,
        enhancedLength: enhancedText.length,
        correctionCount: corrections.length,
        confidenceScore: this.calculateConfidenceScore(corrections)
      }
    };

    this.logger.info('Arabic text enhancement completed', {
      correctionCount: corrections.length,
      confidenceScore: result.metadata.confidenceScore,
      textLengthChange: result.metadata.enhancedLength - result.metadata.originalLength
    });

    return result;
  }

  private fixCharacterShaping(text: string): {
    text: string;
    corrections: TextEnhancementResult['corrections'];
  } {
    let enhancedText = text;
    const corrections: TextEnhancementResult['corrections'] = [];

    // Fix isolated character forms to contextual forms
    for (const [incorrect, correct] of this.characterCorrections) {
      const regex = new RegExp(incorrect, 'g');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        corrections.push({
          type: 'character',
          original: incorrect,
          corrected: correct,
          position: match.index,
          confidence: 0.8
        });
      }
      
      enhancedText = enhancedText.replace(regex, correct);
    }

    // Fix ligature issues (like لا)
    enhancedText = this.fixArabicLigatures(enhancedText, corrections);

    return { text: enhancedText, corrections };
  }

  private fixArabicLigatures(text: string, corrections: TextEnhancementResult['corrections']): string {
    // Fix common ligature OCR errors
    const ligaturePatterns = [
      { pattern: /ﻻ/g, replacement: 'لا', confidence: 0.9 }, // Lam-Alif ligature
      { pattern: /ﻷ/g, replacement: 'لأ', confidence: 0.9 }, // Lam-Alif with hamza
      { pattern: /ﻹ/g, replacement: 'لإ', confidence: 0.9 }, // Lam-Alif with hamza below
      { pattern: /ﻵ/g, replacement: 'لآ', confidence: 0.9 }, // Lam-Alif with madda
    ];

    let result = text;
    for (const { pattern, replacement, confidence } of ligaturePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        corrections.push({
          type: 'character',
          original: match[0],
          corrected: replacement,
          position: match.index,
          confidence
        });
      }
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private correctCommonErrors(text: string): {
    text: string;
    corrections: TextEnhancementResult['corrections'];
  } {
    let enhancedText = text;
    const corrections: TextEnhancementResult['corrections'] = [];

    // Correct common word misrecognitions
    for (const [incorrect, correct] of this.commonWordCorrections) {
      const regex = new RegExp(`\\b${incorrect}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        corrections.push({
          type: 'common_error',
          original: incorrect,
          corrected: correct,
          position: match.index,
          confidence: 0.9
        });
      }
      
      enhancedText = enhancedText.replace(regex, correct);
    }

    // Apply context-based corrections
    enhancedText = this.applyContextualCorrections(enhancedText, corrections);

    return { text: enhancedText, corrections };
  }

  private applyContextualCorrections(
    text: string, 
    corrections: TextEnhancementResult['corrections']
  ): string {
    // Common contextual patterns in Arabic text
    const contextualPatterns = [
      // Fix "في" (in) vs "قي" common OCR error
      {
        pattern: /\bقي\s/g,
        replacement: 'في ',
        confidence: 0.7,
        context: 'preposition'
      },
      // Fix "من" (from) vs "مز" common OCR error
      {
        pattern: /\bمز\s/g,
        replacement: 'من ',
        confidence: 0.7,
        context: 'preposition'
      },
      // Fix "إلى" (to) vs "إلي" common OCR error
      {
        pattern: /\bإلي\b/g,
        replacement: 'إلى',
        confidence: 0.8,
        context: 'preposition'
      },
      // Fix "على" (on) vs "علي" when used as preposition
      {
        pattern: /\bعلي\s(?![A-Za-z])/g,
        replacement: 'على ',
        confidence: 0.6,
        context: 'preposition'
      }
    ];

    let result = text;
    for (const { pattern, replacement, confidence, context } of contextualPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        corrections.push({
          type: 'common_error',
          original: match[0],
          corrected: replacement,
          position: match.index,
          confidence
        });
      }
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private handleDiacritics(
    text: string, 
    options: ArabicTextEnhancementOptions
  ): {
    text: string;
    corrections: TextEnhancementResult['corrections'];
  } {
    let enhancedText = text;
    const corrections: TextEnhancementResult['corrections'] = [];

    if (options.normalizeDiacritics && !options.preserveDiacritics) {
      // Remove diacritics for better text processing
      const diacriticPattern = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
      let match;
      
      while ((match = diacriticPattern.exec(text)) !== null) {
        corrections.push({
          type: 'diacritic',
          original: match[0],
          corrected: '',
          position: match.index,
          confidence: 0.9
        });
      }
      
      enhancedText = enhancedText.replace(diacriticPattern, '');
    } else if (options.normalizeDiacritics && options.preserveDiacritics) {
      // Normalize diacritics to standard forms
      for (const [original, normalized] of this.diacriticNormalization) {
        const regex = new RegExp(original, 'g');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          if (original !== normalized) {
            corrections.push({
              type: 'diacritic',
              original,
              corrected: normalized,
              position: match.index,
              confidence: 0.95
            });
          }
        }
        
        enhancedText = enhancedText.replace(regex, normalized);
      }
    }

    return { text: enhancedText, corrections };
  }

  private normalizeNumbers(text: string): {
    text: string;
    corrections: TextEnhancementResult['corrections'];
  } {
    const corrections: TextEnhancementResult['corrections'] = [];
    
    // Arabic-Indic to Western Arabic numerals mapping
    const arabicNumbers = new Map([
      ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
      ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9']
    ]);

    // Persian/Farsi numerals to Western Arabic
    const persianNumbers = new Map([
      ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
      ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9']
    ]);

    let enhancedText = text;

    // Convert Arabic-Indic numerals
    for (const [arabic, western] of arabicNumbers) {
      const regex = new RegExp(arabic, 'g');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        corrections.push({
          type: 'number',
          original: arabic,
          corrected: western,
          position: match.index,
          confidence: 0.99
        });
      }
      
      enhancedText = enhancedText.replace(regex, western);
    }

    // Convert Persian numerals
    for (const [persian, western] of persianNumbers) {
      const regex = new RegExp(persian, 'g');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        corrections.push({
          type: 'number',
          original: persian,
          corrected: western,
          position: match.index,
          confidence: 0.99
        });
      }
      
      enhancedText = enhancedText.replace(regex, western);
    }

    return { text: enhancedText, corrections };
  }

  private analyzeRTLSegments(text: string): TextEnhancementResult['rtlSegments'] {
    const segments: TextEnhancementResult['rtlSegments'] = [];
    
    // Arabic Unicode ranges
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const englishPattern = /[A-Za-z]/;
    
    let currentSegment = '';
    let currentDirection: 'rtl' | 'ltr' = 'ltr';
    let currentLanguage: 'arabic' | 'english' | 'mixed' = 'english';
    let segmentStart = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let charDirection: 'rtl' | 'ltr' = 'ltr';
      let charLanguage: 'arabic' | 'english' | 'mixed' = 'english';

      if (arabicPattern.test(char)) {
        charDirection = 'rtl';
        charLanguage = 'arabic';
      } else if (englishPattern.test(char)) {
        charDirection = 'ltr';
        charLanguage = 'english';
      } else {
        // Keep current direction for punctuation and spaces
        charDirection = currentDirection;
        charLanguage = currentLanguage;
      }

      // Check if we need to start a new segment
      if (i === 0 || charDirection !== currentDirection) {
        // Save the previous segment if it exists
        if (currentSegment) {
          segments.push({
            text: currentSegment,
            startIndex: segmentStart,
            endIndex: i - 1,
            direction: currentDirection,
            language: currentLanguage
          });
        }

        // Start new segment
        currentSegment = char;
        currentDirection = charDirection;
        currentLanguage = charLanguage;
        segmentStart = i;
      } else {
        currentSegment += char;
        
        // Update language if we have mixed content
        if (currentLanguage !== charLanguage && charLanguage !== 'english') {
          currentLanguage = 'mixed';
        }
      }
    }

    // Add the last segment
    if (currentSegment) {
      segments.push({
        text: currentSegment,
        startIndex: segmentStart,
        endIndex: text.length - 1,
        direction: currentDirection,
        language: currentLanguage
      });
    }

    return segments;
  }

  private enhanceRTLLayout(
    text: string, 
    rtlSegments: TextEnhancementResult['rtlSegments']
  ): string {
    // Apply RTL text direction markers
    let enhancedText = text;

    for (const segment of rtlSegments) {
      if (segment.direction === 'rtl' && segment.language === 'arabic') {
        // Add RTL mark (U+200F) for proper rendering
        const rtlMark = '\u200F';
        const segmentText = segment.text;
        
        // Insert RTL marks at the beginning of Arabic segments
        enhancedText = enhancedText.replace(
          segmentText,
          rtlMark + segmentText + rtlMark
        );
      }
    }

    // Clean up any duplicate RTL marks
    enhancedText = enhancedText.replace(/\u200F+/g, '\u200F');

    return enhancedText;
  }

  private calculateConfidenceScore(corrections: TextEnhancementResult['corrections']): number {
    if (corrections.length === 0) {
      return 1.0; // Perfect confidence if no corrections needed
    }

    // Calculate weighted confidence based on correction types and individual confidences
    const weights = {
      'diacritic': 0.1,      // Low impact on overall confidence
      'character': 0.3,      // Medium impact
      'number': 0.05,        // Very low impact
      'layout': 0.1,         // Low impact
      'common_error': 0.5    // High impact
    };

    let totalWeight = 0;
    let weightedConfidence = 0;

    for (const correction of corrections) {
      const weight = weights[correction.type] || 0.3;
      totalWeight += weight;
      weightedConfidence += correction.confidence * weight;
    }

    return totalWeight > 0 ? Math.min(weightedConfidence / totalWeight, 1.0) : 0.8;
  }

  // Utility method to detect if text contains Arabic
  static containsArabic(text: string): boolean {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
  }

  // Utility method to get text direction
  static getTextDirection(text: string): 'rtl' | 'ltr' | 'mixed' {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const latinPattern = /[A-Za-z]/;
    
    const hasArabic = arabicPattern.test(text);
    const hasLatin = latinPattern.test(text);
    
    if (hasArabic && hasLatin) {
      return 'mixed';
    } else if (hasArabic) {
      return 'rtl';
    } else {
      return 'ltr';
    }
  }

  // Method to enhance handwritten Arabic text recognition
  async enhanceHandwrittenText(text: string): Promise<TextEnhancementResult> {
    // Special enhancements for handwritten Arabic text
    const handwritingOptions: ArabicTextEnhancementOptions = {
      normalizeDiacritics: false, // Preserve diacritics in handwriting
      preserveDiacritics: true,
      correctCommonErrors: true,
      enhanceRTLLayout: true,
      fixCharacterShaping: true,
      normalizeNumbers: true,
      handleMixedContent: true
    };

    return this.enhanceText(text, handwritingOptions);
  }
}

// Utility functions for Arabic text processing
export class ArabicTextUtils {
  // Remove diacritics from Arabic text
  static removeDiacritics(text: string): string {
    return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  // Normalize Arabic text for search and comparison
  static normalizeArabicText(text: string): string {
    return text
      .replace(/[إأآا]/g, 'ا') // Normalize Alif variations
      .replace(/[ىي]/g, 'ي')   // Normalize Yaa variations
      .replace(/ة/g, 'ه')      // Normalize Taa Marbouta to Haa
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Remove diacritics
      .trim();
  }

  // Split text into words while preserving RTL context
  static splitArabicWords(text: string): string[] {
    // Split on whitespace and punctuation while preserving Arabic word boundaries
    return text.split(/[\s\u060C\u061B\u061F\u06D4.،؛؟]+/).filter(word => word.length > 0);
  }

  // Check if a word is likely Arabic
  static isArabicWord(word: string): boolean {
    const arabicChars = word.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
    return arabicChars ? arabicChars.length / word.length > 0.5 : false;
  }

  // Get reading order for mixed RTL/LTR text
  static getReadingOrder(text: string): Array<{ text: string; direction: 'rtl' | 'ltr' }> {
    const enhancer = new ArabicTextEnhancer();
    const segments = enhancer['analyzeRTLSegments'](text);
    
    return segments.map(segment => ({
      text: segment.text,
      direction: segment.direction
    }));
  }
}