'use client';

export interface LanguageDetectionResult {
  language: 'ar' | 'en';
  confidence: number;
  alternativeLanguages?: Array<{
    language: 'ar' | 'en';
    confidence: number;
  }>;
  detectionMethod: 'character' | 'word' | 'pattern' | 'api';
}

export interface LanguageStats {
  arabicCharacters: number;
  englishCharacters: number;
  totalCharacters: number;
  arabicWords: number;
  englishWords: number;
  totalWords: number;
  arabicScore: number;
  englishScore: number;
}

export class LanguageDetectionService {
  private arabicCharacterRanges = [
    [0x0600, 0x06FF], // Arabic
    [0x0750, 0x077F], // Arabic Supplement
    [0x08A0, 0x08FF], // Arabic Extended-A
    [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
    [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
  ];

  private commonArabicWords = [
    'في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي',
    'وهو', 'وهي', 'كان', 'كانت', 'يكون', 'تكون', 'عند', 'عندما', 'حيث', 'كيف',
    'ماذا', 'متى', 'أين', 'لماذا', 'كذلك', 'أيضا', 'أيضاً', 'لكن', 'ولكن', 'إذا',
    'الموظف', 'العامل', 'الشركة', 'العمل', 'الراتب', 'الأجر', 'الإجازة', 'القانون',
    'النظام', 'اللائحة', 'العقد', 'الاتفاقية', 'الموارد', 'البشرية', 'الإدارة', 'المدير',
    'التدريب', 'التطوير', 'الترقية', 'الحوافز', 'المكافآت', 'التأمينات', 'المعاش'
  ];

  private commonEnglishWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'this', 'that',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'do', 'does', 'did',
    'employee', 'worker', 'company', 'work', 'salary', 'wage', 'leave', 'vacation',
    'law', 'legal', 'contract', 'agreement', 'human', 'resources', 'management', 'manager',
    'training', 'development', 'promotion', 'incentive', 'bonus', 'insurance', 'pension'
  ];

  // Detect language from text using multiple methods
  public detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        language: 'en',
        confidence: 0,
        detectionMethod: 'character',
      };
    }

    const cleanedText = this.cleanText(text);
    const stats = this.analyzeText(cleanedText);
    
    // Use multiple detection methods and combine results
    const characterResult = this.detectByCharacters(stats);
    const wordResult = this.detectByWords(cleanedText, stats);
    const patternResult = this.detectByPatterns(cleanedText);
    
    // Combine results with weights
    const combinedResult = this.combineResults([
      { result: characterResult, weight: 0.4 },
      { result: wordResult, weight: 0.4 },
      { result: patternResult, weight: 0.2 },
    ]);

    return combinedResult;
  }

  // Clean and normalize text for analysis
  private cleanText(text: string): string {
    return text
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0020-\u007F\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Analyze text statistics
  private analyzeText(text: string): LanguageStats {
    const stats: LanguageStats = {
      arabicCharacters: 0,
      englishCharacters: 0,
      totalCharacters: 0,
      arabicWords: 0,
      englishWords: 0,
      totalWords: 0,
      arabicScore: 0,
      englishScore: 0,
    };

    // Character analysis
    for (const char of text) {
      const charCode = char.charCodeAt(0);
      stats.totalCharacters++;

      if (this.isArabicCharacter(charCode)) {
        stats.arabicCharacters++;
      } else if (this.isEnglishCharacter(charCode)) {
        stats.englishCharacters++;
      }
    }

    // Word analysis
    const words = text.split(/\s+/).filter(word => word.length > 0);
    stats.totalWords = words.length;

    for (const word of words) {
      if (this.hasArabicCharacters(word)) {
        stats.arabicWords++;
      } else if (this.hasEnglishCharacters(word)) {
        stats.englishWords++;
      }
    }

    // Calculate scores
    if (stats.totalCharacters > 0) {
      stats.arabicScore = stats.arabicCharacters / stats.totalCharacters;
      stats.englishScore = stats.englishCharacters / stats.totalCharacters;
    }

    return stats;
  }

  // Detect language based on character distribution
  private detectByCharacters(stats: LanguageStats): LanguageDetectionResult {
    const threshold = 0.1;
    
    if (stats.arabicScore > stats.englishScore + threshold) {
      return {
        language: 'ar',
        confidence: Math.min(stats.arabicScore * 2, 1),
        detectionMethod: 'character',
        alternativeLanguages: [{
          language: 'en',
          confidence: stats.englishScore,
        }],
      };
    } else if (stats.englishScore > stats.arabicScore + threshold) {
      return {
        language: 'en',
        confidence: Math.min(stats.englishScore * 2, 1),
        detectionMethod: 'character',
        alternativeLanguages: [{
          language: 'ar',
          confidence: stats.arabicScore,
        }],
      };
    } else {
      // Mixed or uncertain
      return {
        language: stats.arabicScore >= stats.englishScore ? 'ar' : 'en',
        confidence: 0.5,
        detectionMethod: 'character',
        alternativeLanguages: [{
          language: stats.arabicScore >= stats.englishScore ? 'en' : 'ar',
          confidence: Math.min(stats.arabicScore, stats.englishScore),
        }],
      };
    }
  }

  // Detect language based on common words
  private detectByWords(text: string, stats: LanguageStats): LanguageDetectionResult {
    const words = text.split(/\s+/).filter(word => word.length > 1);
    let arabicWordScore = 0;
    let englishWordScore = 0;
    let totalRelevantWords = 0;

    for (const word of words) {
      if (this.commonArabicWords.includes(word)) {
        arabicWordScore++;
        totalRelevantWords++;
      } else if (this.commonEnglishWords.includes(word)) {
        englishWordScore++;
        totalRelevantWords++;
      }
    }

    if (totalRelevantWords === 0) {
      // Fallback to word-based Arabic detection
      return {
        language: stats.arabicWords > stats.englishWords ? 'ar' : 'en',
        confidence: Math.max(0.3, Math.abs(stats.arabicWords - stats.englishWords) / stats.totalWords),
        detectionMethod: 'word',
      };
    }

    const arabicRatio = arabicWordScore / totalRelevantWords;
    const englishRatio = englishWordScore / totalRelevantWords;

    if (arabicRatio > englishRatio) {
      return {
        language: 'ar',
        confidence: arabicRatio,
        detectionMethod: 'word',
        alternativeLanguages: [{
          language: 'en',
          confidence: englishRatio,
        }],
      };
    } else {
      return {
        language: 'en',
        confidence: englishRatio,
        detectionMethod: 'word',
        alternativeLanguages: [{
          language: 'ar',
          confidence: arabicRatio,
        }],
      };
    }
  }

  // Detect language based on linguistic patterns
  private detectByPatterns(text: string): LanguageDetectionResult {
    let arabicPatterns = 0;
    let englishPatterns = 0;
    let totalPatterns = 0;

    // Arabic patterns
    const arabicRegexes = [
      /ال[ا-ي]/g, // Definite article "ال" + letter
      /[ا-ي]ة\s/g, // Feminine ending "ة"
      /[ا-ي]ين\s/g, // Plural masculine ending "ين"
      /[ا-ي]ات\s/g, // Plural feminine ending "ات"
      /في\s+ال/g, // "في ال" pattern
      /من\s+ال/g, // "من ال" pattern
      /على\s+ال/g, // "على ال" pattern
      /وال[ا-ي]/g, // "وال" pattern
    ];

    // English patterns  
    const englishRegexes = [
      /\bthe\s+\w+/g, // "the" + word
      /\b\w+ing\b/g, // "-ing" endings
      /\b\w+ed\b/g, // "-ed" endings
      /\b\w+ly\b/g, // "-ly" endings
      /\b\w+tion\b/g, // "-tion" endings
      /\b\w+ness\b/g, // "-ness" endings
      /\bof\s+the\b/g, // "of the" pattern
      /\bin\s+the\b/g, // "in the" pattern
    ];

    // Count Arabic pattern matches
    for (const regex of arabicRegexes) {
      const matches = text.match(regex);
      if (matches) {
        arabicPatterns += matches.length;
        totalPatterns += matches.length;
      }
    }

    // Count English pattern matches
    for (const regex of englishRegexes) {
      const matches = text.match(regex);
      if (matches) {
        englishPatterns += matches.length;
        totalPatterns += matches.length;
      }
    }

    if (totalPatterns === 0) {
      return {
        language: 'en',
        confidence: 0.1,
        detectionMethod: 'pattern',
      };
    }

    const arabicRatio = arabicPatterns / totalPatterns;
    const englishRatio = englishPatterns / totalPatterns;

    if (arabicRatio > englishRatio) {
      return {
        language: 'ar',
        confidence: arabicRatio,
        detectionMethod: 'pattern',
        alternativeLanguages: [{
          language: 'en',
          confidence: englishRatio,
        }],
      };
    } else {
      return {
        language: 'en',
        confidence: englishRatio,
        detectionMethod: 'pattern',
        alternativeLanguages: [{
          language: 'ar',
          confidence: arabicRatio,
        }],
      };
    }
  }

  // Combine multiple detection results
  private combineResults(
    results: Array<{ result: LanguageDetectionResult; weight: number }>
  ): LanguageDetectionResult {
    let arabicScore = 0;
    let englishScore = 0;
    let totalWeight = 0;

    for (const { result, weight } of results) {
      if (result.language === 'ar') {
        arabicScore += result.confidence * weight;
      } else {
        englishScore += result.confidence * weight;
      }
      totalWeight += weight;
    }

    // Normalize scores
    arabicScore /= totalWeight;
    englishScore /= totalWeight;

    const finalLanguage = arabicScore > englishScore ? 'ar' : 'en';
    const finalConfidence = Math.max(arabicScore, englishScore);

    return {
      language: finalLanguage,
      confidence: finalConfidence,
      detectionMethod: 'api', // Combined method
      alternativeLanguages: [{
        language: finalLanguage === 'ar' ? 'en' : 'ar',
        confidence: Math.min(arabicScore, englishScore),
      }],
    };
  }

  // Check if character code is Arabic
  private isArabicCharacter(charCode: number): boolean {
    return this.arabicCharacterRanges.some(
      ([start, end]) => charCode >= start && charCode <= end
    );
  }

  // Check if character code is English
  private isEnglishCharacter(charCode: number): boolean {
    return (charCode >= 0x0041 && charCode <= 0x005A) || // A-Z
           (charCode >= 0x0061 && charCode <= 0x007A);   // a-z
  }

  // Check if text contains Arabic characters
  private hasArabicCharacters(text: string): boolean {
    return Array.from(text).some(char => this.isArabicCharacter(char.charCodeAt(0)));
  }

  // Check if text contains English characters
  private hasEnglishCharacters(text: string): boolean {
    return Array.from(text).some(char => this.isEnglishCharacter(char.charCodeAt(0)));
  }

  // Get language name in Arabic and English
  public getLanguageName(language: 'ar' | 'en'): { ar: string; en: string } {
    const names = {
      ar: { ar: 'العربية', en: 'Arabic' },
      en: { ar: 'الإنجليزية', en: 'English' },
    };
    return names[language];
  }

  // Detect dominant language in a conversation
  public detectConversationLanguage(messages: string[]): LanguageDetectionResult {
    if (messages.length === 0) {
      return {
        language: 'en',
        confidence: 0,
        detectionMethod: 'api',
      };
    }

    // Analyze all messages
    const allText = messages.join(' ');
    const result = this.detectLanguage(allText);

    // Boost confidence for longer conversations
    const lengthBoost = Math.min(messages.length / 10, 0.2);
    result.confidence = Math.min(result.confidence + lengthBoost, 1);

    return result;
  }

  // Auto-detect language with caching for performance
  private cache = new Map<string, LanguageDetectionResult>();

  public detectLanguageWithCache(text: string): LanguageDetectionResult {
    const cacheKey = text.substring(0, 100); // Use first 100 chars as cache key
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = this.detectLanguage(text);
    
    // Cache result if confidence is high enough
    if (result.confidence > 0.7) {
      this.cache.set(cacheKey, result);
      
      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return result;
  }

  // Clear detection cache
  public clearCache(): void {
    this.cache.clear();
  }

  // Get detection statistics
  public getDetectionStats(text: string): LanguageStats & { detection: LanguageDetectionResult } {
    const cleanedText = this.cleanText(text);
    const stats = this.analyzeText(cleanedText);
    const detection = this.detectLanguage(text);

    return {
      ...stats,
      detection,
    };
  }
}

// Singleton instance
export const languageDetectionService = new LanguageDetectionService();
export default languageDetectionService;