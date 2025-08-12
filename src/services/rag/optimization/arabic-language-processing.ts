/**
 * Arabic language processing utilities for better RAG performance
 * Handles Arabic text normalization, stemming, and query enhancement
 */

export interface ArabicProcessingConfig {
  removeDiacritics: boolean;
  normalizeAlif: boolean;
  normalizeYa: boolean;
  normalizeTaMarbuta: boolean;
  enableStemming: boolean;
  handleDialects: boolean;
}

export interface ProcessedArabicText {
  original: string;
  normalized: string;
  stemmed?: string;
  keywords: string[];
  dialectVariants?: string[];
  confidence: number;
}

export class ArabicLanguageProcessor {
  private static instance: ArabicLanguageProcessor;
  private config: ArabicProcessingConfig;
  
  // Arabic stop words
  private stopWords = new Set([
    'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
    'التي', 'الذي', 'التي', 'اللذان', 'اللتان', 'الذين', 'اللواتي', 'اللاتي',
    'كان', 'كانت', 'يكون', 'تكون', 'أن', 'إن', 'لكن', 'لكن', 'أو', 'أم',
    'لا', 'لم', 'لن', 'ما', 'ليس', 'غير', 'سوف', 'قد', 'كل', 'بعض',
    'جميع', 'كلا', 'كلتا', 'عند', 'عندما', 'حيث', 'أين', 'كيف', 'متى', 'ماذا'
  ]);

  // Common HR and legal terms in Arabic
  private hrTerms = new Map([
    ['موظف', ['عامل', 'مستخدم', 'العاملين', 'الموظفين']],
    ['راتب', ['أجر', 'مرتب', 'مكافأة', 'تعويض']],
    ['إجازة', ['عطلة', 'راحة', 'استراحة']],
    ['عقد', ['اتفاقية', 'تعاقد', 'تعاهد']],
    ['فصل', ['إنهاء', 'طرد', 'إقالة', 'استغناء']],
    ['تدريب', ['تأهيل', 'تطوير', 'إعداد']],
    ['أداء', ['عمل', 'إنجاز', 'تحصيل']],
    ['شكوى', ['تظلم', 'اعتراض', 'طعن']],
  ]);

  // Dialect variations mapping
  private dialectMappings = new Map([
    ['شغل', 'عمل'], // Gulf/Levantine -> MSA
    ['دوام', 'عمل'], // Gulf -> MSA
    ['مشروع', 'عمل'], // General -> MSA
    ['وظيفة', 'عمل'], // General -> MSA
  ]);

  public static getInstance(config?: Partial<ArabicProcessingConfig>): ArabicLanguageProcessor {
    if (!ArabicLanguageProcessor.instance) {
      ArabicLanguageProcessor.instance = new ArabicLanguageProcessor(config);
    }
    return ArabicLanguageProcessor.instance;
  }

  constructor(config?: Partial<ArabicProcessingConfig>) {
    this.config = {
      removeDiacritics: true,
      normalizeAlif: true,
      normalizeYa: true,
      normalizeTaMarbuta: true,
      enableStemming: false, // Disable by default due to complexity
      handleDialects: true,
      ...config,
    };
  }

  /**
   * Main processing function for Arabic text
   */
  processArabicText(text: string): ProcessedArabicText {
    const original = text;
    let normalized = this.normalizeText(text);
    const keywords = this.extractKeywords(normalized);
    const dialectVariants = this.config.handleDialects ? this.generateDialectVariants(normalized) : undefined;
    
    // Calculate confidence based on text quality
    const confidence = this.calculateTextConfidence(normalized);

    return {
      original,
      normalized,
      keywords,
      dialectVariants,
      confidence,
    };
  }

  /**
   * Normalize Arabic text for better matching
   */
  normalizeText(text: string): string {
    let normalized = text;

    if (this.config.removeDiacritics) {
      // Remove Arabic diacritics (tashkeel)
      normalized = normalized.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
    }

    if (this.config.normalizeAlif) {
      // Normalize different forms of Alif
      normalized = normalized.replace(/[أإآٱ]/g, 'ا');
    }

    if (this.config.normalizeYa) {
      // Normalize Ya and Alif Maqsura
      normalized = normalized.replace(/[يى]/g, 'ي');
    }

    if (this.config.normalizeTaMarbuta) {
      // Normalize Ta Marbuta
      normalized = normalized.replace(/ة/g, 'ه');
    }

    // Additional normalizations
    normalized = normalized
      // Normalize spaces
      .replace(/\s+/g, ' ')
      // Remove English punctuation that might interfere
      .replace(/[.,;:!?()[\]{}'"]/g, ' ')
      // Normalize Arabic punctuation
      .replace(/[،؛؟]/g, ' ')
      .trim();

    return normalized;
  }

  /**
   * Extract keywords from Arabic text
   */
  extractKeywords(text: string): string[] {
    const words = text.split(/\s+/);
    const keywords: string[] = [];

    for (const word of words) {
      // Skip stop words
      if (this.stopWords.has(word)) {
        continue;
      }

      // Skip very short words
      if (word.length < 2) {
        continue;
      }

      // Add the word
      keywords.push(word);

      // Add HR term variations if available
      if (this.hrTerms.has(word)) {
        keywords.push(...this.hrTerms.get(word)!);
      }
    }

    // Remove duplicates and return
    return [...new Set(keywords)];
  }

  /**
   * Generate dialect variants for better matching
   */
  generateDialectVariants(text: string): string[] {
    const variants: string[] = [];
    const words = text.split(/\s+/);

    // Check for dialect mappings
    const mappedWords = words.map(word => {
      if (this.dialectMappings.has(word)) {
        return this.dialectMappings.get(word)!;
      }
      return word;
    });

    if (mappedWords.join(' ') !== text) {
      variants.push(mappedWords.join(' '));
    }

    // Generate common variations
    const withoutDefiniteArticle = text.replace(/^ال/, '');
    if (withoutDefiniteArticle !== text) {
      variants.push(withoutDefiniteArticle);
    }

    return variants;
  }

  /**
   * Calculate confidence score for text quality
   */
  calculateTextConfidence(text: string): number {
    let score = 0.5; // Base score

    // Check for Arabic content
    const arabicCharCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalCharCount = text.length;
    const arabicRatio = arabicCharCount / totalCharCount;

    score += arabicRatio * 0.3; // Up to 0.3 points for Arabic content

    // Check for HR-related terms
    const words = text.split(/\s+/);
    const hrTermCount = words.filter(word => this.hrTerms.has(word)).length;
    const hrRatio = hrTermCount / words.length;

    score += hrRatio * 0.2; // Up to 0.2 points for HR terms

    // Penalize very short text
    if (text.length < 10) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Enhance query for better retrieval
   */
  enhanceArabicQuery(query: string): {
    enhanced: string;
    alternatives: string[];
    keywords: string[];
  } {
    const processed = this.processArabicText(query);
    
    // Build enhanced query
    let enhanced = processed.normalized;
    const alternatives: string[] = [];
    
    // Add dialect variants
    if (processed.dialectVariants && processed.dialectVariants.length > 0) {
      alternatives.push(...processed.dialectVariants);
    }

    // Add HR term variations
    const words = processed.normalized.split(/\s+/);
    for (const word of words) {
      if (this.hrTerms.has(word)) {
        const variations = this.hrTerms.get(word)!;
        alternatives.push(
          ...variations.map(variant => 
            processed.normalized.replace(word, variant)
          )
        );
      }
    }

    // Add stemmed versions if enabled
    if (this.config.enableStemming) {
      const stemmed = this.applyStemming(processed.normalized);
      if (stemmed !== processed.normalized) {
        alternatives.push(stemmed);
      }
    }

    return {
      enhanced,
      alternatives: [...new Set(alternatives)],
      keywords: processed.keywords,
    };
  }

  /**
   * Basic Arabic stemming (simplified approach)
   */
  private applyStemming(text: string): string {
    // This is a simplified stemming approach
    // In production, you might want to use a proper Arabic stemmer
    
    const words = text.split(/\s+/);
    const stemmed = words.map(word => {
      // Remove common prefixes
      word = word.replace(/^(ال|و|ف|ب|ك|ل|لل)/, '');
      
      // Remove common suffixes
      word = word.replace(/(ها|ان|ات|ون|ين|ه|ك|ني|نا|كم|هم|هن)$/, '');
      
      // Remove feminine marker
      word = word.replace(/ه$/, '');
      
      return word;
    });

    return stemmed.join(' ');
  }

  /**
   * Detect and handle mixed Arabic-English text
   */
  handleMixedContent(text: string): {
    arabicPart: string;
    englishPart: string;
    mixed: boolean;
  } {
    const arabicRegex = /[\u0600-\u06FF\s]+/g;
    const englishRegex = /[A-Za-z\s]+/g;
    
    const arabicMatches = text.match(arabicRegex) || [];
    const englishMatches = text.match(englishRegex) || [];
    
    const arabicPart = arabicMatches.join(' ').trim();
    const englishPart = englishMatches.join(' ').trim();
    const mixed = arabicPart.length > 0 && englishPart.length > 0;

    return {
      arabicPart,
      englishPart,
      mixed,
    };
  }

  /**
   * Generate search terms for full-text search
   */
  generateSearchTerms(query: string): string[] {
    const enhanced = this.enhanceArabicQuery(query);
    const terms: string[] = [];

    // Add main query
    terms.push(enhanced.enhanced);
    
    // Add alternatives
    terms.push(...enhanced.alternatives);
    
    // Add individual keywords
    terms.push(...enhanced.keywords.filter(k => k.length > 2));

    // Generate phrase combinations
    const keywords = enhanced.keywords;
    if (keywords.length > 1) {
      for (let i = 0; i < keywords.length - 1; i++) {
        terms.push(`${keywords[i]} ${keywords[i + 1]}`);
      }
    }

    // Remove duplicates and empty terms
    return [...new Set(terms)].filter(term => term.trim().length > 0);
  }

  /**
   * Validate Arabic text quality
   */
  validateArabicText(text: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for minimum Arabic content
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (arabicChars / totalChars < 0.5 && totalChars > 0) {
      issues.push('Text contains less than 50% Arabic characters');
      suggestions.push('Ensure the text is primarily in Arabic for better processing');
    }

    // Check for excessive diacritics
    const diacritics = (text.match(/[\u064B-\u065F]/g) || []).length;
    if (diacritics > arabicChars * 0.3) {
      issues.push('Text contains excessive diacritics');
      suggestions.push('Consider removing diacritics for better matching');
    }

    // Check text length
    if (text.trim().length < 5) {
      issues.push('Text is too short');
      suggestions.push('Provide more context for better results');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    stopWordsCount: number;
    hrTermsCount: number;
    dialectMappingsCount: number;
  } {
    return {
      stopWordsCount: this.stopWords.size,
      hrTermsCount: this.hrTerms.size,
      dialectMappingsCount: this.dialectMappings.size,
    };
  }

  /**
   * Update HR terms dictionary (for dynamic learning)
   */
  updateHRTerms(newTerms: Map<string, string[]>): void {
    newTerms.forEach((variations, term) => {
      if (this.hrTerms.has(term)) {
        const existing = this.hrTerms.get(term)!;
        this.hrTerms.set(term, [...new Set([...existing, ...variations])]);
      } else {
        this.hrTerms.set(term, variations);
      }
    });
  }
}

export const arabicProcessor = ArabicLanguageProcessor.getInstance();