// Arabic Text Processing and Language Optimization Service

export interface ArabicTextAnalysis {
  originalText: string;
  normalizedText: string;
  language: 'ar' | 'en' | 'mixed';
  arabicRatio: number;
  textDirection: 'ltr' | 'rtl' | 'mixed';
  segments: TextSegment[];
  entities: ArabicEntity[];
  readabilityScore: number;
  complexity: 'simple' | 'moderate' | 'complex';
  dialectInfo: DialectInfo;
}

export interface TextSegment {
  text: string;
  type: 'arabic' | 'english' | 'number' | 'punctuation' | 'mixed';
  position: { start: number; end: number };
  confidence: number;
  direction: 'ltr' | 'rtl';
}

export interface ArabicEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'law' | 'document';
  position: { start: number; end: number };
  confidence: number;
  normalized: string;
  variants: string[];
}

export interface DialectInfo {
  isClassicalArabic: boolean;
  dialectType: 'gulf' | 'levantine' | 'egyptian' | 'maghrebi' | 'standard' | 'mixed';
  confidence: number;
  dialectFeatures: string[];
}

export interface ArabicChunkingOptions {
  maxChunkSize: number;
  overlapSize: number;
  preserveStructure: boolean;
  respectWordBoundaries: boolean;
  useSemanticBoundaries: boolean;
  chunkingStrategy: 'sentence' | 'paragraph' | 'semantic' | 'fixed';
}

export interface ProcessedChunk {
  id: string;
  text: string;
  normalizedText: string;
  position: { start: number; end: number };
  type: 'title' | 'paragraph' | 'list' | 'table' | 'header';
  language: 'ar' | 'en' | 'mixed';
  wordCount: number;
  arabicWordCount: number;
  complexity: number;
  semanticBoundaries: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  hasNumbers: boolean;
  hasLegalTerms: boolean;
  hasHRTerms: boolean;
  hasPersonalInfo: boolean;
  formalityLevel: 'formal' | 'informal' | 'technical';
  topicTags: string[];
  entities: ArabicEntity[];
}

export interface ArabicSearchOptimization {
  originalQuery: string;
  expandedQuery: string;
  synonyms: string[];
  rootWords: string[];
  alternativeSpellings: string[];
  semanticExpansions: string[];
  transliterations: string[];
}

export interface ArabicQualityMetrics {
  textQuality: number;
  languageConsistency: number;
  formalityScore: number;
  clarityScore: number;
  completeness: number;
  culturalRelevance: number;
}

export class ArabicTextProcessingService {
  
  // Arabic character ranges and patterns
  private readonly ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  private readonly ARABIC_LETTERS = /[\u0627-\u064A\u0671-\u06D3\u06F0-\u06F9]/g;
  private readonly ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  private readonly ARABIC_TATWEEL = /[\u0640]/g;
  
  // Arabic punctuation and symbols
  private readonly ARABIC_PUNCTUATION = /[\u060C\u061B\u061F\u06D4]/g;
  
  // Zero-width characters
  private readonly ZERO_WIDTH_CHARS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
  
  // Arabic sentence separators
  private readonly SENTENCE_SEPARATORS = /[.!?؟।\u06D4]/;
  
  // Common Arabic stop words
  private readonly ARABIC_STOP_WORDS = new Set([
    'في', 'من', 'إلى', 'على', 'عن', 'مع', 'كل', 'بعض', 'هذا', 'هذه', 'ذلك', 'تلك',
    'التي', 'الذي', 'اللذان', 'اللتان', 'الذين', 'اللاتي', 'اللواتي', 'التى',
    'كان', 'كانت', 'يكون', 'تكون', 'أن', 'أما', 'إما', 'لكن', 'لكن', 'غير',
    'سوف', 'قد', 'لقد', 'منذ', 'أمس', 'اليوم', 'غداً', 'الآن', 'هنا', 'هناك',
    'كيف', 'ماذا', 'متى', 'أين', 'لماذا', 'هل', 'ما', 'لا', 'نعم', 'ولا'
  ]);

  // HR and Legal terminology in Arabic
  private readonly HR_LEGAL_TERMS = {
    hr: [
      'موظف', 'عامل', 'موظفة', 'عاملة', 'مستخدم', 'مستخدمة',
      'راتب', 'مرتب', 'أجر', 'مكافأة', 'علاوة', 'بدل', 'تعويض',
      'إجازة', 'عطلة', 'غياب', 'حضور', 'دوام', 'عمل',
      'تدريب', 'تطوير', 'دورة', 'مهارة', 'خبرة', 'كفاءة',
      'أداء', 'تقييم', 'مراجعة', 'هدف', 'إنجاز', 'نتيجة',
      'قسم', 'إدارة', 'شعبة', 'وحدة', 'فريق', 'مجموعة',
      'مدير', 'رئيس', 'مسؤول', 'منسق', 'مشرف', 'قائد'
    ],
    legal: [
      'قانون', 'نظام', 'لائحة', 'مادة', 'فقرة', 'بند', 'حكم',
      'عقد', 'اتفاقية', 'اتفاق', 'تعاقد', 'التزام', 'حق', 'واجب',
      'مخالفة', 'انتهاك', 'تجاوز', 'خرق', 'امتثال', 'التزام',
      'دعوى', 'قضية', 'نزاع', 'خلاف', 'تظلم', 'شكوى', 'استئناف',
      'محكمة', 'قاضي', 'حكم', 'قرار', 'جلسة', 'جلسات',
      'وزارة', 'هيئة', 'مؤسسة', 'جهة', 'سلطة', 'مرجع'
    ]
  };

  // Dialect-specific patterns
  private readonly DIALECT_PATTERNS = {
    gulf: ['شلون', 'وين', 'شنو', 'يالله', 'ماشاءالله', 'الحين', 'زين'],
    levantine: ['شو', 'وين', 'كيف', 'عم', 'رح', 'بدي', 'معي'],
    egyptian: ['إيه', 'فين', 'ازاي', 'عايز', 'هيروح', 'خلاص'],
    maghrebi: ['شنو', 'فين', 'كيفاش', 'بغيت', 'غادي', 'واخا']
  };

  // Arabic root patterns (simplified)
  private readonly ROOT_PATTERNS = [
    /^(.)\u064E(.)\u064E(.)$/,     // فَعَل
    /^(.)\u064F(.)\u0652(.)$/,     // فُعْل  
    /^(.)\u0650(.)\u0652(.)$/,     // فِعْل
    /^(.)\u064E(.)\u0650(.)$/,     // فَعِل
    /^(.)\u064E(.)\u064F(.)$/,     // فَعُل
  ];

  /**
   * Comprehensive Arabic text analysis
   */
  analyzeArabicText(text: string): ArabicTextAnalysis {
    const normalizedText = this.normalizeArabicText(text);
    const segments = this.segmentText(text);
    const arabicRatio = this.calculateArabicRatio(text);
    const entities = this.extractArabicEntities(text);
    const dialectInfo = this.analyzeDialect(text);
    const readabilityScore = this.calculateReadabilityScore(text);
    const complexity = this.assessTextComplexity(text);
    const textDirection = this.determineTextDirection(segments);

    return {
      originalText: text,
      normalizedText,
      language: this.detectLanguage(arabicRatio),
      arabicRatio,
      textDirection,
      segments,
      entities,
      readabilityScore,
      complexity,
      dialectInfo
    };
  }

  /**
   * Normalize Arabic text for better processing
   */
  normalizeArabicText(text: string): string {
    return text
      // Unicode normalization
      .normalize('NFKC')
      
      // Remove diacritics
      .replace(this.ARABIC_DIACRITICS, '')
      
      // Remove tatweel (kashida)
      .replace(this.ARABIC_TATWEEL, '')
      
      // Remove zero-width characters
      .replace(this.ZERO_WIDTH_CHARS, '')
      
      // Normalize Yaa variants
      .replace(/ي/g, 'ى')
      .replace(/ؤ/g, 'ء')
      .replace(/إ/g, 'أ')
      .replace(/آ/g, 'أ')
      
      // Normalize Taa Marbuta
      .replace(/ة/g, 'ه')
      
      // Normalize Hamza variants
      .replace(/[ٱأإآ]/g, 'ا')
      .replace(/[ئؤءٕٔ]/g, 'ء')
      
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Segment text into different types (Arabic, English, mixed)
   */
  segmentText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const words = text.split(/\s+/);
    let currentPosition = 0;

    words.forEach((word, index) => {
      const wordStart = text.indexOf(word, currentPosition);
      const wordEnd = wordStart + word.length;
      
      const type = this.classifyWord(word);
      const direction = type === 'arabic' ? 'rtl' : 'ltr';
      const confidence = this.calculateSegmentConfidence(word, type);

      segments.push({
        text: word,
        type,
        position: { start: wordStart, end: wordEnd },
        confidence,
        direction
      });

      currentPosition = wordEnd;
    });

    return this.mergeAdjacentSegments(segments);
  }

  /**
   * Classify a word by its script type
   */
  private classifyWord(word: string): TextSegment['type'] {
    const arabicChars = (word.match(this.ARABIC_RANGE) || []).length;
    const totalChars = word.replace(/\s/g, '').length;
    const numbers = /\d/.test(word);
    const punctuation = /[^\w\s\u0600-\u06FF]/.test(word);

    if (numbers && arabicChars === 0 && !/[a-zA-Z]/.test(word)) {
      return 'number';
    }

    if (punctuation && totalChars <= 3) {
      return 'punctuation';
    }

    if (totalChars === 0) return 'punctuation';

    const arabicRatio = arabicChars / totalChars;
    
    if (arabicRatio > 0.8) return 'arabic';
    if (arabicRatio > 0.2) return 'mixed';
    return 'english';
  }

  /**
   * Calculate confidence for segment classification
   */
  private calculateSegmentConfidence(word: string, type: TextSegment['type']): number {
    const arabicChars = (word.match(this.ARABIC_RANGE) || []).length;
    const totalChars = word.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 0.5;
    
    const arabicRatio = arabicChars / totalChars;
    
    switch (type) {
      case 'arabic':
        return Math.min(arabicRatio * 1.2, 1.0);
      case 'english':
        return Math.min((1 - arabicRatio) * 1.2, 1.0);
      case 'mixed':
        return 1 - Math.abs(0.5 - arabicRatio);
      case 'number':
        return /^\d+$/.test(word) ? 1.0 : 0.7;
      case 'punctuation':
        return /^[^\w\s]+$/.test(word) ? 1.0 : 0.5;
      default:
        return 0.5;
    }
  }

  /**
   * Merge adjacent segments of the same type
   */
  private mergeAdjacentSegments(segments: TextSegment[]): TextSegment[] {
    if (segments.length === 0) return segments;

    const merged: TextSegment[] = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const last = merged[merged.length - 1];
      
      // Merge if same type and direction
      if (current.type === last.type && current.direction === last.direction) {
        last.text += ' ' + current.text;
        last.position.end = current.position.end;
        last.confidence = (last.confidence + current.confidence) / 2;
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }

  /**
   * Calculate ratio of Arabic characters in text
   */
  calculateArabicRatio(text: string): number {
    const arabicChars = (text.match(this.ARABIC_RANGE) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    return totalChars > 0 ? arabicChars / totalChars : 0;
  }

  /**
   * Detect primary language of text
   */
  detectLanguage(arabicRatio: number): 'ar' | 'en' | 'mixed' {
    if (arabicRatio > 0.7) return 'ar';
    if (arabicRatio > 0.3) return 'mixed';
    return 'en';
  }

  /**
   * Determine text direction based on segments
   */
  determineTextDirection(segments: TextSegment[]): 'ltr' | 'rtl' | 'mixed' {
    const rtlSegments = segments.filter(s => s.direction === 'rtl').length;
    const ltrSegments = segments.filter(s => s.direction === 'ltr').length;
    
    if (rtlSegments > ltrSegments * 2) return 'rtl';
    if (ltrSegments > rtlSegments * 2) return 'ltr';
    return 'mixed';
  }

  /**
   * Extract Arabic named entities
   */
  extractArabicEntities(text: string): ArabicEntity[] {
    const entities: ArabicEntity[] = [];

    // Person names (with titles)
    const personPattern = /(?:السيد|الأستاذ|الدكتور|المهندس|الأستاذة|الدكتورة|المهندسة)\s+([أ-ي\s]{2,30})/g;
    let match;
    
    while ((match = personPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'person',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.8,
        normalized: this.normalizeArabicText(match[1]),
        variants: [match[1], match[1].trim()]
      });
    }

    // Organizations
    const orgPattern = /(?:شركة|مؤسسة|هيئة|وزارة|إدارة|قسم|منظمة)\s+([أ-ي\s]{2,50})/g;
    while ((match = orgPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'organization',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.7,
        normalized: this.normalizeArabicText(match[1]),
        variants: [match[1]]
      });
    }

    // Dates in Arabic
    const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}|في\s+\d{1,2}\s+\w+\s+\d{4}/g;
    while ((match = datePattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'date',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.9,
        normalized: match[0],
        variants: [match[0]]
      });
    }

    // Money amounts
    const moneyPattern = /\d+(?:،\d{3})*(?:\.\d{2})?\s*(?:ريال|درهم|دولار|جنيه)/g;
    while ((match = moneyPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'money',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.9,
        normalized: match[0],
        variants: [match[0]]
      });
    }

    // Legal references
    const legalPattern = /(?:المادة|الفقرة|البند)\s+(?:رقم\s+)?\d+/g;
    while ((match = legalPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'law',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.8,
        normalized: this.normalizeArabicText(match[0]),
        variants: [match[0]]
      });
    }

    return entities.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Analyze Arabic dialect
   */
  analyzeDialect(text: string): DialectInfo {
    const normalizedText = text.toLowerCase();
    let dialectScores: Record<string, number> = {
      gulf: 0,
      levantine: 0,
      egyptian: 0,
      maghrebi: 0,
      standard: 0
    };

    // Check for dialect-specific words
    Object.entries(this.DIALECT_PATTERNS).forEach(([dialect, patterns]) => {
      patterns.forEach(pattern => {
        if (normalizedText.includes(pattern)) {
          dialectScores[dialect] += 1;
        }
      });
    });

    // Check for Classical Arabic indicators
    const classicalIndicators = ['إن', 'أن', 'كان', 'قد', 'لقد', 'إذا', 'إذ', 'حيث'];
    let classicalScore = 0;
    classicalIndicators.forEach(indicator => {
      if (normalizedText.includes(indicator)) {
        classicalScore += 1;
      }
    });

    dialectScores.standard = classicalScore;

    // Find dominant dialect
    const totalScore = Object.values(dialectScores).reduce((sum, score) => sum + score, 0);
    const dominantDialect = Object.entries(dialectScores)
      .reduce((max, [dialect, score]) => score > max.score ? { dialect, score } : max, 
              { dialect: 'standard', score: 0 });

    const confidence = totalScore > 0 ? dominantDialect.score / totalScore : 0.5;
    const isClassicalArabic = dominantDialect.dialect === 'standard' && confidence > 0.6;

    return {
      isClassicalArabic,
      dialectType: dominantDialect.dialect as DialectInfo['dialectType'],
      confidence,
      dialectFeatures: Object.entries(dialectScores)
        .filter(([, score]) => score > 0)
        .map(([dialect]) => dialect)
    };
  }

  /**
   * Calculate readability score for Arabic text
   */
  calculateReadabilityScore(text: string): number {
    const sentences = text.split(this.SENTENCE_SEPARATORS).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const arabicWords = words.filter(word => this.ARABIC_RANGE.test(word));
    
    if (sentences.length === 0 || words.length === 0) return 0;

    const averageWordsPerSentence = words.length / sentences.length;
    const averageCharsPerWord = arabicWords.reduce((sum, word) => sum + word.length, 0) / arabicWords.length;
    
    // Complex words (more than 7 characters in Arabic)
    const complexWords = arabicWords.filter(word => word.length > 7).length;
    const complexWordRatio = complexWords / arabicWords.length;

    // Readability formula adapted for Arabic
    let readabilityScore = 100 - (averageWordsPerSentence * 1.5) - (averageCharsPerWord * 2) - (complexWordRatio * 30);
    
    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, readabilityScore / 100));
  }

  /**
   * Assess text complexity
   */
  assessTextComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const readability = this.calculateReadabilityScore(text);
    const hasLegalTerms = this.HR_LEGAL_TERMS.legal.some(term => text.includes(term));
    const hasHRTerms = this.HR_LEGAL_TERMS.hr.some(term => text.includes(term));
    const wordCount = text.split(/\s+/).length;
    
    let complexityScore = 0;
    
    if (readability < 0.5) complexityScore += 1;
    if (hasLegalTerms) complexityScore += 1;
    if (hasHRTerms) complexityScore += 0.5;
    if (wordCount > 200) complexityScore += 1;
    
    if (complexityScore >= 2.5) return 'complex';
    if (complexityScore >= 1.5) return 'moderate';
    return 'simple';
  }

  /**
   * Intelligent Arabic text chunking
   */
  chunkArabicText(text: string, options: ArabicChunkingOptions): ProcessedChunk[] {
    const analysis = this.analyzeArabicText(text);
    const chunks: ProcessedChunk[] = [];
    
    switch (options.chunkingStrategy) {
      case 'sentence':
        return this.chunkBySentences(text, analysis, options);
      case 'paragraph':
        return this.chunkByParagraphs(text, analysis, options);
      case 'semantic':
        return this.chunkBySemantic(text, analysis, options);
      case 'fixed':
      default:
        return this.chunkByFixedSize(text, analysis, options);
    }
  }

  /**
   * Chunk text by sentences
   */
  private chunkBySentences(text: string, analysis: ArabicTextAnalysis, options: ArabicChunkingOptions): ProcessedChunk[] {
    const sentences = text.split(this.SENTENCE_SEPARATORS);
    const chunks: ProcessedChunk[] = [];
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    sentences.forEach((sentence, index) => {
      sentence = sentence.trim();
      if (!sentence) return;

      const proposedChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (proposedChunk.length <= options.maxChunkSize || currentChunk === '') {
        currentChunk = proposedChunk;
      } else {
        // Create chunk from current content
        if (currentChunk) {
          chunks.push(this.createProcessedChunk(
            chunkIndex++,
            currentChunk,
            currentStart,
            currentStart + currentChunk.length,
            analysis.language
          ));
        }
        
        // Start new chunk
        currentChunk = sentence;
        currentStart = text.indexOf(sentence, currentStart);
      }
    });

    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createProcessedChunk(
        chunkIndex,
        currentChunk,
        currentStart,
        currentStart + currentChunk.length,
        analysis.language
      ));
    }

    return chunks;
  }

  /**
   * Chunk text by paragraphs
   */
  private chunkByParagraphs(text: string, analysis: ArabicTextAnalysis, options: ArabicChunkingOptions): ProcessedChunk[] {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks: ProcessedChunk[] = [];
    let currentPosition = 0;

    paragraphs.forEach((paragraph, index) => {
      const paragraphStart = text.indexOf(paragraph, currentPosition);
      
      if (paragraph.length <= options.maxChunkSize) {
        chunks.push(this.createProcessedChunk(
          index,
          paragraph,
          paragraphStart,
          paragraphStart + paragraph.length,
          analysis.language
        ));
      } else {
        // Split large paragraphs into smaller chunks
        const subChunks = this.chunkBySentences(paragraph, analysis, options);
        chunks.push(...subChunks);
      }
      
      currentPosition = paragraphStart + paragraph.length;
    });

    return chunks;
  }

  /**
   * Semantic chunking based on topic boundaries
   */
  private chunkBySemantic(text: string, analysis: ArabicTextAnalysis, options: ArabicChunkingOptions): ProcessedChunk[] {
    // Simplified semantic chunking - in practice would use more advanced NLP
    const sentences = text.split(this.SENTENCE_SEPARATORS).filter(s => s.trim().length > 0);
    const chunks: ProcessedChunk[] = [];
    
    let currentChunk: string[] = [];
    let currentTopic = '';
    let chunkIndex = 0;
    let currentStart = 0;

    sentences.forEach((sentence, index) => {
      sentence = sentence.trim();
      const sentenceTopic = this.extractTopicFromSentence(sentence);
      
      if (!currentTopic || sentenceTopic === currentTopic || currentChunk.length === 0) {
        currentChunk.push(sentence);
        currentTopic = sentenceTopic;
      } else {
        // Topic change detected - create new chunk
        const chunkText = currentChunk.join(' ');
        chunks.push(this.createProcessedChunk(
          chunkIndex++,
          chunkText,
          currentStart,
          currentStart + chunkText.length,
          analysis.language
        ));
        
        currentChunk = [sentence];
        currentTopic = sentenceTopic;
        currentStart = text.indexOf(sentence, currentStart);
      }
      
      // Check size limits
      const chunkText = currentChunk.join(' ');
      if (chunkText.length > options.maxChunkSize) {
        chunks.push(this.createProcessedChunk(
          chunkIndex++,
          chunkText,
          currentStart,
          currentStart + chunkText.length,
          analysis.language
        ));
        currentChunk = [];
        currentTopic = '';
      }
    });

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      chunks.push(this.createProcessedChunk(
        chunkIndex,
        chunkText,
        currentStart,
        currentStart + chunkText.length,
        analysis.language
      ));
    }

    return chunks;
  }

  /**
   * Fixed-size chunking with word boundary respect
   */
  private chunkByFixedSize(text: string, analysis: ArabicTextAnalysis, options: ArabicChunkingOptions): ProcessedChunk[] {
    const chunks: ProcessedChunk[] = [];
    const words = text.split(/\s+/);
    
    let currentChunk: string[] = [];
    let currentSize = 0;
    let chunkIndex = 0;
    let currentStart = 0;

    words.forEach((word, index) => {
      const wordSize = word.length + (currentChunk.length > 0 ? 1 : 0); // +1 for space
      
      if (currentSize + wordSize <= options.maxChunkSize || currentChunk.length === 0) {
        currentChunk.push(word);
        currentSize += wordSize;
      } else {
        // Create chunk
        const chunkText = currentChunk.join(' ');
        chunks.push(this.createProcessedChunk(
          chunkIndex++,
          chunkText,
          currentStart,
          currentStart + chunkText.length,
          analysis.language
        ));
        
        // Start new chunk with overlap
        if (options.overlapSize > 0) {
          const overlapWords = currentChunk.slice(-Math.floor(options.overlapSize / 10));
          currentChunk = [...overlapWords, word];
          currentSize = currentChunk.join(' ').length;
        } else {
          currentChunk = [word];
          currentSize = word.length;
        }
        
        currentStart = text.indexOf(word, currentStart);
      }
    });

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      chunks.push(this.createProcessedChunk(
        chunkIndex,
        chunkText,
        currentStart,
        currentStart + chunkText.length,
        analysis.language
      ));
    }

    return chunks;
  }

  /**
   * Create a processed chunk with metadata
   */
  private createProcessedChunk(
    index: number,
    text: string,
    start: number,
    end: number,
    language: 'ar' | 'en' | 'mixed'
  ): ProcessedChunk {
    const normalizedText = this.normalizeArabicText(text);
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const arabicWords = words.filter(word => this.ARABIC_RANGE.test(word));
    
    const metadata: ChunkMetadata = {
      hasNumbers: /\d/.test(text),
      hasLegalTerms: this.HR_LEGAL_TERMS.legal.some(term => text.includes(term)),
      hasHRTerms: this.HR_LEGAL_TERMS.hr.some(term => text.includes(term)),
      hasPersonalInfo: /(?:السيد|الأستاذ|الدكتور|رقم|هوية)/.test(text),
      formalityLevel: this.assessFormality(text),
      topicTags: this.extractTopicTags(text),
      entities: this.extractArabicEntities(text)
    };

    return {
      id: `chunk_${index}`,
      text,
      normalizedText,
      position: { start, end },
      type: this.inferChunkType(text),
      language,
      wordCount: words.length,
      arabicWordCount: arabicWords.length,
      complexity: this.calculateChunkComplexity(text),
      semanticBoundaries: this.findSemanticBoundaries(text),
      metadata
    };
  }

  /**
   * Extract topic from sentence for semantic chunking
   */
  private extractTopicFromSentence(sentence: string): string {
    // Extract main nouns and topics from sentence
    const hrTopics = this.HR_LEGAL_TERMS.hr.find(term => sentence.includes(term));
    const legalTopics = this.HR_LEGAL_TERMS.legal.find(term => sentence.includes(term));
    
    if (hrTopics) return 'hr';
    if (legalTopics) return 'legal';
    
    // Look for common topic indicators
    if (sentence.includes('راتب') || sentence.includes('أجر')) return 'salary';
    if (sentence.includes('إجازة') || sentence.includes('عطلة')) return 'leave';
    if (sentence.includes('تدريب') || sentence.includes('تطوير')) return 'training';
    
    return 'general';
  }

  /**
   * Assess formality level of text
   */
  private assessFormality(text: string): 'formal' | 'informal' | 'technical' {
    const formalIndicators = ['يرجى', 'نتشرف', 'نود', 'نفيدكم', 'نحيطكم علماً'];
    const technicalIndicators = ['وفقاً', 'طبقاً', 'استناداً', 'بموجب', 'حسب'];
    const informalIndicators = ['شو', 'ايش', 'كيف', 'وين', 'شلون'];

    let formalScore = 0;
    let technicalScore = 0;
    let informalScore = 0;

    formalIndicators.forEach(indicator => {
      if (text.includes(indicator)) formalScore++;
    });

    technicalIndicators.forEach(indicator => {
      if (text.includes(indicator)) technicalScore++;
    });

    informalIndicators.forEach(indicator => {
      if (text.includes(indicator)) informalScore++;
    });

    if (technicalScore > formalScore && technicalScore > informalScore) return 'technical';
    if (formalScore > informalScore) return 'formal';
    return 'informal';
  }

  /**
   * Extract topic tags from text
   */
  private extractTopicTags(text: string): string[] {
    const tags: string[] = [];

    // HR topics
    if (this.HR_LEGAL_TERMS.hr.some(term => text.includes(term))) {
      tags.push('hr');
    }

    // Legal topics  
    if (this.HR_LEGAL_TERMS.legal.some(term => text.includes(term))) {
      tags.push('legal');
    }

    // Specific topics
    if (text.includes('راتب') || text.includes('أجر') || text.includes('مكافأة')) {
      tags.push('compensation');
    }

    if (text.includes('إجازة') || text.includes('عطلة') || text.includes('غياب')) {
      tags.push('leave');
    }

    if (text.includes('تدريب') || text.includes('تطوير') || text.includes('مهارة')) {
      tags.push('training');
    }

    if (text.includes('عقد') || text.includes('اتفاقية') || text.includes('التزام')) {
      tags.push('contract');
    }

    return tags;
  }

  /**
   * Infer chunk type based on content
   */
  private inferChunkType(text: string): ProcessedChunk['type'] {
    if (text.length < 50) return 'title';
    if (text.includes('•') || text.includes('-') || text.includes('*')) return 'list';
    if (text.includes('|') || text.includes('\t')) return 'table';
    if (/^(الفصل|القسم|الباب|المادة)/i.test(text.trim())) return 'header';
    return 'paragraph';
  }

  /**
   * Calculate complexity score for a chunk
   */
  private calculateChunkComplexity(text: string): number {
    let complexity = 0.5; // Base complexity

    // Length factor
    if (text.length > 500) complexity += 0.2;
    if (text.length > 1000) complexity += 0.2;

    // Technical terms
    if (this.HR_LEGAL_TERMS.legal.some(term => text.includes(term))) {
      complexity += 0.3;
    }

    // Sentence structure complexity
    const sentences = text.split(this.SENTENCE_SEPARATORS);
    const avgWordsPerSentence = text.split(/\s+/).length / sentences.length;
    if (avgWordsPerSentence > 15) complexity += 0.2;
    if (avgWordsPerSentence > 25) complexity += 0.2;

    return Math.min(complexity, 1.0);
  }

  /**
   * Find semantic boundaries in text
   */
  private findSemanticBoundaries(text: string): number[] {
    const boundaries: number[] = [];
    const sentences = text.split(this.SENTENCE_SEPARATORS);
    let currentPos = 0;

    sentences.forEach((sentence, index) => {
      currentPos += sentence.length;
      
      // Mark boundary if significant topic shift or structural indicator
      if (sentence.includes('أولاً') || sentence.includes('ثانياً') || 
          sentence.includes('بالإضافة إلى') || sentence.includes('علاوة على ذلك')) {
        boundaries.push(currentPos);
      }
      
      currentPos += 1; // For separator
    });

    return boundaries;
  }

  /**
   * Optimize Arabic search queries
   */
  optimizeArabicSearchQuery(query: string): ArabicSearchOptimization {
    const normalizedQuery = this.normalizeArabicText(query);
    const synonyms = this.generateArabicSynonyms(query);
    const rootWords = this.extractArabicRoots(query);
    const alternativeSpellings = this.generateAlternativeSpellings(query);
    const semanticExpansions = this.generateSemanticExpansions(query);
    const transliterations = this.generateTransliterations(query);

    // Build expanded query
    const allExpansions = [
      ...synonyms,
      ...rootWords,
      ...alternativeSpellings.slice(0, 3), // Limit alternatives
      ...semanticExpansions.slice(0, 2)   // Limit expansions
    ];

    const expandedQuery = query + ' ' + allExpansions.join(' ');

    return {
      originalQuery: query,
      expandedQuery,
      synonyms,
      rootWords,
      alternativeSpellings,
      semanticExpansions,
      transliterations
    };
  }

  /**
   * Generate Arabic synonyms
   */
  private generateArabicSynonyms(query: string): string[] {
    const synonymMap: Record<string, string[]> = {
      'راتب': ['مرتب', 'أجر', 'دخل'],
      'إجازة': ['عطلة', 'استراحة', 'راحة'],
      'موظف': ['عامل', 'مستخدم', 'مستوظف'],
      'شركة': ['مؤسسة', 'منظمة', 'منشأة'],
      'عمل': ['وظيفة', 'مهنة', 'حرفة'],
      'مدير': ['رئيس', 'مسؤول', 'قائد'],
      'قانون': ['نظام', 'لائحة', 'تشريع'],
      'عقد': ['اتفاقية', 'اتفاق', 'تعاقد']
    };

    const synonyms: string[] = [];
    const words = query.split(/\s+/);

    words.forEach(word => {
      const normalizedWord = this.normalizeArabicText(word);
      if (synonymMap[normalizedWord]) {
        synonyms.push(...synonymMap[normalizedWord]);
      }
    });

    return [...new Set(synonyms)];
  }

  /**
   * Extract Arabic root words (simplified)
   */
  private extractArabicRoots(query: string): string[] {
    // Simplified root extraction - in practice would use morphological analyzer
    const roots: string[] = [];
    const words = query.split(/\s+/).filter(word => this.ARABIC_RANGE.test(word));

    words.forEach(word => {
      const normalized = this.normalizeArabicText(word);
      
      // Simple 3-letter root extraction
      if (normalized.length >= 3) {
        // Remove common prefixes and suffixes
        let root = normalized
          .replace(/^(ال|و|ب|ل|ك)/, '')  // Prefixes
          .replace(/(ة|ها|هم|هن|ني|ات|ين|ون|وا)$/, ''); // Suffixes
        
        if (root.length >= 3) {
          roots.push(root.substring(0, 3));
        }
      }
    });

    return [...new Set(roots)];
  }

  /**
   * Generate alternative spellings
   */
  private generateAlternativeSpellings(query: string): string[] {
    const alternatives: string[] = [];
    
    // Common spelling variations
    const variations = [
      { from: 'ي', to: 'ى' },
      { from: 'ة', to: 'ه' },
      { from: 'أ', to: 'ا' },
      { from: 'إ', to: 'ا' },
      { from: 'آ', to: 'ا' }
    ];

    variations.forEach(({ from, to }) => {
      if (query.includes(from)) {
        alternatives.push(query.replace(new RegExp(from, 'g'), to));
      }
    });

    return [...new Set(alternatives)];
  }

  /**
   * Generate semantic expansions
   */
  private generateSemanticExpansions(query: string): string[] {
    const expansions: string[] = [];

    // Context-based expansions for HR queries
    if (query.includes('راتب') || query.includes('أجر')) {
      expansions.push('مكافأة', 'علاوة', 'بدل', 'تعويض');
    }

    if (query.includes('إجازة')) {
      expansions.push('غياب', 'مرض', 'سنوية', 'طارئة');
    }

    if (query.includes('عمل') || query.includes('وظيفة')) {
      expansions.push('توظيف', 'مهنة', 'دوام', 'حضور');
    }

    return expansions;
  }

  /**
   * Generate transliterations
   */
  private generateTransliterations(query: string): string[] {
    // Simplified transliteration mapping
    const transliterationMap: Record<string, string> = {
      'راتب': 'salary',
      'إجازة': 'leave',
      'موظف': 'employee',
      'عمل': 'work',
      'شركة': 'company'
    };

    const transliterations: string[] = [];
    const words = query.split(/\s+/);

    words.forEach(word => {
      const normalized = this.normalizeArabicText(word);
      if (transliterationMap[normalized]) {
        transliterations.push(transliterationMap[normalized]);
      }
    });

    return transliterations;
  }

  /**
   * Calculate quality metrics for Arabic text
   */
  calculateArabicQualityMetrics(text: string): ArabicQualityMetrics {
    const analysis = this.analyzeArabicText(text);
    
    return {
      textQuality: this.assessTextQuality(text, analysis),
      languageConsistency: this.assessLanguageConsistency(analysis),
      formalityScore: this.assessFormality(text) === 'formal' ? 0.8 : 
                     this.assessFormality(text) === 'technical' ? 0.9 : 0.6,
      clarityScore: analysis.readabilityScore,
      completeness: this.assessCompleteness(text, analysis),
      culturalRelevance: this.assessCulturalRelevance(text)
    };
  }

  /**
   * Assess overall text quality
   */
  private assessTextQuality(text: string, analysis: ArabicTextAnalysis): number {
    let quality = 0.5;

    // Grammar and spelling (simplified check)
    if (analysis.normalizedText.length > 0) quality += 0.1;
    
    // Structure and organization
    const sentences = text.split(this.SENTENCE_SEPARATORS);
    if (sentences.length > 1) quality += 0.1;
    
    // Vocabulary richness
    const uniqueWords = new Set(text.split(/\s+/).map(w => this.normalizeArabicText(w)));
    const vocabularyRichness = uniqueWords.size / text.split(/\s+/).length;
    quality += vocabularyRichness * 0.2;

    // Professional terminology
    if (this.HR_LEGAL_TERMS.hr.some(term => text.includes(term)) ||
        this.HR_LEGAL_TERMS.legal.some(term => text.includes(term))) {
      quality += 0.1;
    }

    return Math.min(quality, 1.0);
  }

  /**
   * Assess language consistency
   */
  private assessLanguageConsistency(analysis: ArabicTextAnalysis): number {
    // Check for consistent language use throughout text
    const arabicSegments = analysis.segments.filter(s => s.type === 'arabic').length;
    const englishSegments = analysis.segments.filter(s => s.type === 'english').length;
    const mixedSegments = analysis.segments.filter(s => s.type === 'mixed').length;
    
    const totalSegments = analysis.segments.length;
    if (totalSegments === 0) return 0.5;
    
    // Prefer consistency in primary language
    const dominantType = arabicSegments > englishSegments ? 'arabic' : 'english';
    const dominantCount = Math.max(arabicSegments, englishSegments);
    
    const consistency = dominantCount / totalSegments;
    
    // Penalty for excessive mixing
    const mixingPenalty = mixedSegments / totalSegments * 0.3;
    
    return Math.max(0, Math.min(1, consistency - mixingPenalty));
  }

  /**
   * Assess content completeness
   */
  private assessCompleteness(text: string, analysis: ArabicTextAnalysis): number {
    let completeness = 0.5;

    // Length factor
    if (text.length > 100) completeness += 0.1;
    if (text.length > 500) completeness += 0.1;

    // Structure elements
    const sentences = text.split(this.SENTENCE_SEPARATORS);
    if (sentences.length > 3) completeness += 0.1;

    // Entity presence
    if (analysis.entities.length > 0) completeness += 0.1;

    // Topic coverage
    const topicTags = this.extractTopicTags(text);
    completeness += Math.min(topicTags.length * 0.1, 0.2);

    return Math.min(completeness, 1.0);
  }

  /**
   * Assess cultural relevance for Saudi context
   */
  private assessCulturalRelevance(text: string): number {
    let relevance = 0.5;

    // Saudi/Arabic cultural markers
    const culturalTerms = ['المملكة', 'السعودية', 'ريال', 'هجري', 'إسلامي'];
    culturalTerms.forEach(term => {
      if (text.includes(term)) relevance += 0.1;
    });

    // Appropriate honorifics
    const honorifics = ['السيد', 'الأستاذ', 'الدكتور', 'المهندس'];
    if (honorifics.some(term => text.includes(term))) {
      relevance += 0.1;
    }

    // Professional Arabic terminology
    if (this.HR_LEGAL_TERMS.hr.some(term => text.includes(term))) {
      relevance += 0.1;
    }

    return Math.min(relevance, 1.0);
  }
}