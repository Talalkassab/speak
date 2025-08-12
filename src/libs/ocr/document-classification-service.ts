import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';
import { ArabicTextEnhancer, ArabicTextUtils } from './arabic-text-enhancement';

export interface DocumentType {
  id: string;
  name: string;
  nameAr: string;
  category: 'contract' | 'certificate' | 'form' | 'handwritten' | 'identification' | 'financial' | 'legal';
  subcategory?: string;
  confidence: number;
  patterns: {
    keywords: string[];
    keywordsAr: string[];
    layout: LayoutPattern[];
    structure: StructurePattern[];
  };
  metadata: {
    isHandwritten: boolean;
    language: 'arabic' | 'english' | 'bilingual';
    formality: 'formal' | 'informal' | 'mixed';
    orientation: 'portrait' | 'landscape' | 'mixed';
  };
}

export interface LayoutPattern {
  type: 'header' | 'footer' | 'signature' | 'seal' | 'table' | 'list' | 'paragraph' | 'form_field';
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  characteristics: string[];
  weight: number; // Importance for classification (0-1)
}

export interface StructurePattern {
  type: 'numbered_list' | 'bullet_points' | 'sections' | 'clauses' | 'fields' | 'paragraphs';
  count?: number;
  spacing?: 'tight' | 'normal' | 'loose';
  alignment?: 'right' | 'left' | 'center' | 'justified';
  weight: number;
}

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  alternativeTypes: Array<{
    type: DocumentType;
    confidence: number;
  }>;
  extractedFeatures: {
    keywords: Array<{ word: string; language: 'ar' | 'en'; position: number; confidence: number }>;
    layout: LayoutPattern[];
    structure: StructurePattern[];
    handwritingIndicators: Array<{ type: string; confidence: number; description: string }>;
  };
  metadata: {
    processingTime: number;
    textLength: number;
    arabicTextPercentage: number;
    englishTextPercentage: number;
    confidence: number;
  };
}

export class DocumentClassificationService {
  private logger: Logger;
  private textEnhancer: ArabicTextEnhancer;
  private documentTypes: DocumentType[];

  constructor() {
    this.logger = structuredLogger;
    this.textEnhancer = new ArabicTextEnhancer();
    this.documentTypes = this.initializeDocumentTypes();
  }

  private initializeDocumentTypes(): DocumentType[] {
    return [
      // Employment Contracts
      {
        id: 'employment_contract',
        name: 'Employment Contract',
        nameAr: 'عقد عمل',
        category: 'contract',
        subcategory: 'employment',
        confidence: 0,
        patterns: {
          keywords: ['employment', 'contract', 'salary', 'position', 'duties', 'responsibilities', 'termination'],
          keywordsAr: ['عقد', 'عمل', 'راتب', 'وظيفة', 'مهام', 'مسؤوليات', 'إنهاء', 'الخدمة', 'الموظف', 'صاحب العمل'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['company_logo', 'title'], weight: 0.8 },
            { type: 'signature', position: 'bottom', characteristics: ['signature_fields', 'date'], weight: 0.9 },
            { type: 'seal', position: 'bottom-right', characteristics: ['official_seal'], weight: 0.7 }
          ],
          structure: [
            { type: 'numbered_list', count: 5, spacing: 'normal', weight: 0.6 },
            { type: 'clauses', spacing: 'normal', alignment: 'justified', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Resignation Letter
      {
        id: 'resignation_letter',
        name: 'Resignation Letter',
        nameAr: 'خطاب استقالة',
        category: 'form',
        subcategory: 'resignation',
        confidence: 0,
        patterns: {
          keywords: ['resignation', 'resign', 'notice', 'last day', 'effective date', 'position'],
          keywordsAr: ['استقالة', 'أستقيل', 'إشعار', 'آخر يوم', 'تاريخ الاستقالة', 'منصب', 'إخطار'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['date', 'addressee'], weight: 0.7 },
            { type: 'signature', position: 'bottom', characteristics: ['signature', 'name'], weight: 0.9 }
          ],
          structure: [
            { type: 'paragraphs', count: 3, spacing: 'normal', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Certificate of Employment
      {
        id: 'employment_certificate',
        name: 'Certificate of Employment',
        nameAr: 'شهادة خبرة',
        category: 'certificate',
        subcategory: 'employment',
        confidence: 0,
        patterns: {
          keywords: ['certificate', 'certify', 'employed', 'position', 'duration', 'good standing'],
          keywordsAr: ['شهادة', 'خبرة', 'يشهد', 'موظف', 'منصب', 'مدة', 'حسن السيرة', 'والسلوك'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['company_letterhead', 'title'], weight: 0.9 },
            { type: 'seal', position: 'bottom-right', characteristics: ['official_seal', 'stamp'], weight: 0.8 },
            { type: 'signature', position: 'bottom', characteristics: ['authorized_signature'], weight: 0.7 }
          ],
          structure: [
            { type: 'paragraphs', count: 2, spacing: 'normal', alignment: 'justified', weight: 0.7 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Salary Certificate
      {
        id: 'salary_certificate',
        name: 'Salary Certificate',
        nameAr: 'شهادة راتب',
        category: 'certificate',
        subcategory: 'financial',
        confidence: 0,
        patterns: {
          keywords: ['salary', 'wages', 'compensation', 'monthly', 'annual', 'income', 'certificate'],
          keywordsAr: ['راتب', 'أجور', 'مرتب', 'شهري', 'سنوي', 'دخل', 'شهادة', 'مكافآت'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['company_info', 'title'], weight: 0.8 },
            { type: 'table', position: 'center', characteristics: ['salary_breakdown'], weight: 0.9 },
            { type: 'signature', position: 'bottom', characteristics: ['hr_signature'], weight: 0.7 }
          ],
          structure: [
            { type: 'sections', count: 3, spacing: 'normal', weight: 0.6 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Saudi ID (National ID)
      {
        id: 'saudi_national_id',
        name: 'Saudi National ID',
        nameAr: 'بطاقة الهوية الوطنية',
        category: 'identification',
        subcategory: 'national_id',
        confidence: 0,
        patterns: {
          keywords: ['national', 'identity', 'saudi arabia', 'kingdom', 'id number'],
          keywordsAr: ['الهوية', 'الوطنية', 'المملكة', 'العربية', 'السعودية', 'رقم الهوية'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['national_emblem', 'kingdom_name'], weight: 0.9 },
            { type: 'form_field', position: 'center', characteristics: ['photo', 'personal_info'], weight: 0.9 }
          ],
          structure: [
            { type: 'fields', count: 8, spacing: 'tight', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'landscape'
        }
      },

      // Passport
      {
        id: 'saudi_passport',
        name: 'Saudi Passport',
        nameAr: 'جواز السفر السعودي',
        category: 'identification',
        subcategory: 'passport',
        confidence: 0,
        patterns: {
          keywords: ['passport', 'saudi arabia', 'kingdom', 'travel document', 'passport number'],
          keywordsAr: ['جواز', 'سفر', 'المملكة', 'العربية', 'السعودية', 'وثيقة سفر'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['passport_cover', 'kingdom_emblem'], weight: 0.9 },
            { type: 'form_field', position: 'center', characteristics: ['photo', 'bio_data'], weight: 0.9 }
          ],
          structure: [
            { type: 'fields', count: 10, spacing: 'tight', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Iqama (Residence Permit)
      {
        id: 'iqama',
        name: 'Residence Permit (Iqama)',
        nameAr: 'الإقامة',
        category: 'identification',
        subcategory: 'residence_permit',
        confidence: 0,
        patterns: {
          keywords: ['residence', 'permit', 'iqama', 'sponsor', 'expiry', 'profession'],
          keywordsAr: ['إقامة', 'كفيل', 'انتهاء', 'مهنة', 'تصريح', 'الإقامة'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['ministry_logo', 'permit_title'], weight: 0.8 },
            { type: 'form_field', position: 'center', characteristics: ['photo', 'permit_details'], weight: 0.9 }
          ],
          structure: [
            { type: 'fields', count: 12, spacing: 'tight', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'landscape'
        }
      },

      // Bank Statement
      {
        id: 'bank_statement',
        name: 'Bank Statement',
        nameAr: 'كشف حساب بنكي',
        category: 'financial',
        subcategory: 'statement',
        confidence: 0,
        patterns: {
          keywords: ['bank', 'statement', 'account', 'balance', 'transaction', 'deposit', 'withdrawal'],
          keywordsAr: ['بنك', 'كشف', 'حساب', 'رصيد', 'معاملة', 'إيداع', 'سحب', 'مصرفي'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['bank_logo', 'statement_period'], weight: 0.8 },
            { type: 'table', position: 'center', characteristics: ['transaction_table'], weight: 0.9 }
          ],
          structure: [
            { type: 'table', spacing: 'tight', weight: 0.9 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      },

      // Handwritten Notes
      {
        id: 'handwritten_notes',
        name: 'Handwritten Notes',
        nameAr: 'ملاحظات مكتوبة بخط اليد',
        category: 'handwritten',
        subcategory: 'notes',
        confidence: 0,
        patterns: {
          keywords: ['note', 'memo', 'reminder', 'personal'],
          keywordsAr: ['ملاحظة', 'مذكرة', 'تذكير', 'شخصي'],
          layout: [
            { type: 'paragraph', position: 'center', characteristics: ['handwriting', 'informal_layout'], weight: 0.8 }
          ],
          structure: [
            { type: 'paragraphs', spacing: 'loose', weight: 0.6 }
          ]
        },
        metadata: {
          isHandwritten: true,
          language: 'arabic',
          formality: 'informal',
          orientation: 'mixed'
        }
      },

      // Legal Document
      {
        id: 'legal_document',
        name: 'Legal Document',
        nameAr: 'وثيقة قانونية',
        category: 'legal',
        subcategory: 'general',
        confidence: 0,
        patterns: {
          keywords: ['whereas', 'therefore', 'party', 'agreement', 'hereby', 'witness', 'legal'],
          keywordsAr: ['حيث', 'لذلك', 'طرف', 'اتفاقية', 'بموجب', 'شاهد', 'قانوني', 'المحكمة'],
          layout: [
            { type: 'header', position: 'top', characteristics: ['legal_header', 'case_number'], weight: 0.7 },
            { type: 'signature', position: 'bottom', characteristics: ['witness_signatures'], weight: 0.8 }
          ],
          structure: [
            { type: 'numbered_list', spacing: 'normal', weight: 0.7 },
            { type: 'clauses', spacing: 'normal', weight: 0.8 }
          ]
        },
        metadata: {
          isHandwritten: false,
          language: 'bilingual',
          formality: 'formal',
          orientation: 'portrait'
        }
      }
    ];
  }

  async classifyDocument(
    text: string,
    layoutAnalysis?: any,
    imageMetadata?: any
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    this.logger.info('Starting document classification', {
      textLength: text.length,
      hasLayoutAnalysis: !!layoutAnalysis,
      hasImageMetadata: !!imageMetadata
    });

    // Enhance Arabic text for better classification
    const enhancementResult = await this.textEnhancer.enhanceText(text, {
      normalizeDiacritics: true,
      correctCommonErrors: true,
      enhanceRTLLayout: false // Don't modify layout for classification
    });

    const enhancedText = enhancementResult.enhancedText;

    // Extract features
    const extractedFeatures = await this.extractFeatures(enhancedText, layoutAnalysis);

    // Calculate language percentages
    const { arabicPercentage, englishPercentage } = this.calculateLanguageDistribution(enhancedText);

    // Score each document type
    const typeScores = await Promise.all(
      this.documentTypes.map(async (docType) => ({
        type: docType,
        confidence: await this.calculateTypeConfidence(docType, extractedFeatures, enhancedText)
      }))
    );

    // Sort by confidence
    typeScores.sort((a, b) => b.confidence - a.confidence);

    const bestMatch = typeScores[0];
    const alternatives = typeScores.slice(1, 4); // Top 3 alternatives

    // Detect handwriting indicators
    const handwritingIndicators = this.detectHandwritingIndicators(text, extractedFeatures);

    const result: ClassificationResult = {
      documentType: bestMatch.type,
      confidence: bestMatch.confidence,
      alternativeTypes: alternatives,
      extractedFeatures: {
        ...extractedFeatures,
        handwritingIndicators
      },
      metadata: {
        processingTime: Date.now() - startTime,
        textLength: text.length,
        arabicTextPercentage: arabicPercentage,
        englishTextPercentage: englishPercentage,
        confidence: bestMatch.confidence
      }
    };

    this.logger.info('Document classification completed', {
      documentType: result.documentType.id,
      confidence: result.confidence,
      processingTime: result.metadata.processingTime,
      isHandwritten: result.extractedFeatures.handwritingIndicators.length > 0
    });

    return result;
  }

  private async extractFeatures(text: string, layoutAnalysis?: any) {
    const features = {
      keywords: [] as Array<{ word: string; language: 'ar' | 'en'; position: number; confidence: number }>,
      layout: [] as LayoutPattern[],
      structure: [] as StructurePattern[]
    };

    // Extract keywords
    features.keywords = this.extractKeywords(text);

    // Analyze structure
    features.structure = this.analyzeTextStructure(text);

    // Extract layout patterns if available
    if (layoutAnalysis) {
      features.layout = this.extractLayoutPatterns(layoutAnalysis);
    }

    return features;
  }

  private extractKeywords(text: string): Array<{ word: string; language: 'ar' | 'en'; position: number; confidence: number }> {
    const keywords: Array<{ word: string; language: 'ar' | 'en'; position: number; confidence: number }> = [];
    const normalizedText = text.toLowerCase();

    // Collect all keywords from all document types
    const allKeywords = new Map<string, { language: 'ar' | 'en'; importance: number }>();
    
    this.documentTypes.forEach(docType => {
      docType.patterns.keywords.forEach(keyword => {
        allKeywords.set(keyword.toLowerCase(), { language: 'en', importance: 0.8 });
      });
      docType.patterns.keywordsAr.forEach(keyword => {
        allKeywords.set(keyword, { language: 'ar', importance: 0.8 });
      });
    });

    // Find keywords in text
    for (const [keyword, info] of allKeywords) {
      let lastIndex = 0;
      let index;
      
      while ((index = normalizedText.indexOf(keyword, lastIndex)) !== -1) {
        keywords.push({
          word: keyword,
          language: info.language,
          position: index,
          confidence: info.importance
        });
        lastIndex = index + keyword.length;
      }
    }

    return keywords;
  }

  private analyzeTextStructure(text: string): StructurePattern[] {
    const patterns: StructurePattern[] = [];

    // Detect numbered lists
    const numberedListPattern = /^\s*\d+[.)]\s/gm;
    const numberedMatches = text.match(numberedListPattern);
    if (numberedMatches && numberedMatches.length >= 3) {
      patterns.push({
        type: 'numbered_list',
        count: numberedMatches.length,
        spacing: this.detectSpacing(text),
        weight: 0.7
      });
    }

    // Detect bullet points (Arabic and English)
    const bulletPattern = /^\s*[•·-]|\s*[◦▪▫]\s/gm;
    const bulletMatches = text.match(bulletPattern);
    if (bulletMatches && bulletMatches.length >= 2) {
      patterns.push({
        type: 'bullet_points',
        count: bulletMatches.length,
        spacing: this.detectSpacing(text),
        weight: 0.6
      });
    }

    // Detect sections/clauses
    const sectionPattern = /^(المادة|البند|الفقرة|Article|Section|Clause)\s*\d+/gm;
    const sectionMatches = text.match(sectionPattern);
    if (sectionMatches && sectionMatches.length >= 2) {
      patterns.push({
        type: 'clauses',
        count: sectionMatches.length,
        spacing: 'normal',
        weight: 0.8
      });
    }

    // Detect form fields
    const fieldPattern = /\b(الاسم|Name|التاريخ|Date|الرقم|Number|المبلغ|Amount):\s*[_\-\.]{3,}|:\s*_+/g;
    const fieldMatches = text.match(fieldPattern);
    if (fieldMatches && fieldMatches.length >= 3) {
      patterns.push({
        type: 'fields',
        count: fieldMatches.length,
        spacing: 'tight',
        weight: 0.7
      });
    }

    // Detect paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length >= 2) {
      patterns.push({
        type: 'paragraphs',
        count: paragraphs.length,
        spacing: this.detectSpacing(text),
        alignment: this.detectAlignment(text),
        weight: 0.5
      });
    }

    return patterns;
  }

  private detectSpacing(text: string): 'tight' | 'normal' | 'loose' {
    const lines = text.split('\n');
    const emptyLines = lines.filter(line => line.trim() === '').length;
    const totalLines = lines.length;
    
    const emptyLineRatio = emptyLines / totalLines;
    
    if (emptyLineRatio > 0.3) return 'loose';
    if (emptyLineRatio > 0.1) return 'normal';
    return 'tight';
  }

  private detectAlignment(text: string): 'right' | 'left' | 'center' | 'justified' {
    // Simplified alignment detection based on Arabic vs English content
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.length;
    
    if (arabicChars / totalChars > 0.5) {
      return 'right'; // Arabic text is typically right-aligned
    }
    
    return 'left'; // Default for English text
  }

  private extractLayoutPatterns(layoutAnalysis: any): LayoutPattern[] {
    const patterns: LayoutPattern[] = [];

    // This would be implemented based on the specific layout analysis format
    // For now, returning empty array as layout analysis format is not specified
    
    return patterns;
  }

  private async calculateTypeConfidence(
    docType: DocumentType,
    features: any,
    text: string
  ): Promise<number> {
    let confidence = 0;

    // Keyword matching score (40% weight)
    const keywordScore = this.calculateKeywordScore(docType, features.keywords);
    confidence += keywordScore * 0.4;

    // Structure matching score (30% weight)
    const structureScore = this.calculateStructureScore(docType, features.structure);
    confidence += structureScore * 0.3;

    // Layout matching score (20% weight)
    const layoutScore = this.calculateLayoutScore(docType, features.layout);
    confidence += layoutScore * 0.2;

    // Language compatibility score (10% weight)
    const languageScore = this.calculateLanguageScore(docType, text);
    confidence += languageScore * 0.1;

    return Math.min(confidence, 1.0);
  }

  private calculateKeywordScore(docType: DocumentType, keywords: any[]): number {
    const docKeywords = [...docType.patterns.keywords, ...docType.patterns.keywordsAr];
    
    if (docKeywords.length === 0) return 0;

    const matchedKeywords = keywords.filter(k => 
      docKeywords.some(dk => dk.toLowerCase().includes(k.word) || k.word.includes(dk.toLowerCase()))
    );

    return matchedKeywords.length / docKeywords.length;
  }

  private calculateStructureScore(docType: DocumentType, structures: StructurePattern[]): number {
    const docStructures = docType.patterns.structure;
    
    if (docStructures.length === 0) return 0.5; // Neutral score if no structure patterns

    let totalScore = 0;
    let totalWeight = 0;

    for (const docStructure of docStructures) {
      const matchingStructure = structures.find(s => s.type === docStructure.type);
      
      if (matchingStructure) {
        // Calculate similarity based on type match and count similarity
        let structureScore = 0.7; // Base score for type match
        
        if (docStructure.count && matchingStructure.count) {
          const countDiff = Math.abs(docStructure.count - matchingStructure.count);
          const countSimilarity = Math.max(0, 1 - (countDiff / Math.max(docStructure.count, matchingStructure.count)));
          structureScore += countSimilarity * 0.3;
        } else {
          structureScore += 0.15; // Partial credit if no count specified
        }

        totalScore += structureScore * docStructure.weight;
      }
      
      totalWeight += docStructure.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateLayoutScore(docType: DocumentType, layouts: LayoutPattern[]): number {
    const docLayouts = docType.patterns.layout;
    
    if (docLayouts.length === 0) return 0.5; // Neutral score if no layout patterns

    let totalScore = 0;
    let totalWeight = 0;

    for (const docLayout of docLayouts) {
      const matchingLayout = layouts.find(l => 
        l.type === docLayout.type && l.position === docLayout.position
      );
      
      if (matchingLayout) {
        totalScore += docLayout.weight;
      }
      
      totalWeight += docLayout.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateLanguageScore(docType: DocumentType, text: string): number {
    const { arabicPercentage, englishPercentage } = this.calculateLanguageDistribution(text);
    
    switch (docType.metadata.language) {
      case 'arabic':
        return arabicPercentage;
      case 'english':
        return englishPercentage;
      case 'bilingual':
        return Math.min(arabicPercentage + englishPercentage, 1.0);
      default:
        return 0.5;
    }
  }

  private calculateLanguageDistribution(text: string): { arabicPercentage: number; englishPercentage: number } {
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    const englishChars = (text.match(/[A-Za-z]/g) || []).length;
    const totalRelevantChars = arabicChars + englishChars;

    if (totalRelevantChars === 0) {
      return { arabicPercentage: 0, englishPercentage: 0 };
    }

    return {
      arabicPercentage: arabicChars / totalRelevantChars,
      englishPercentage: englishChars / totalRelevantChars
    };
  }

  private detectHandwritingIndicators(text: string, features: any): Array<{ type: string; confidence: number; description: string }> {
    const indicators: Array<{ type: string; confidence: number; description: string }> = [];

    // Irregular character recognition patterns
    const irregularPatterns = [
      /[a-zA-Z]{1}[0-9]{1}[a-zA-Z]{1}/g, // Mixed characters
      /\s{3,}/g, // Excessive spacing
      /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\d\w]/g // Unusual characters
    ];

    for (const pattern of irregularPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 5) {
        indicators.push({
          type: 'irregular_recognition',
          confidence: 0.6,
          description: 'Text contains irregular character recognition patterns common in handwritten documents'
        });
        break;
      }
    }

    // Low OCR confidence indicators
    const shortWords = text.split(/\s+/).filter(word => word.length === 1 || word.length === 2);
    if (shortWords.length > text.split(/\s+/).length * 0.3) {
      indicators.push({
        type: 'fragmented_text',
        confidence: 0.7,
        description: 'High proportion of short words suggests handwriting recognition challenges'
      });
    }

    // Inconsistent spacing
    const spacingVariations = text.match(/\s{2,}/g);
    if (spacingVariations && spacingVariations.length > 10) {
      indicators.push({
        type: 'inconsistent_spacing',
        confidence: 0.5,
        description: 'Inconsistent spacing patterns typical of handwritten text'
      });
    }

    return indicators;
  }

  // Method to add custom document type
  addCustomDocumentType(documentType: DocumentType): void {
    this.documentTypes.push(documentType);
    this.logger.info('Added custom document type', { typeId: documentType.id });
  }

  // Method to get all supported document types
  getSupportedDocumentTypes(): DocumentType[] {
    return [...this.documentTypes];
  }

  // Method to classify multiple documents in batch
  async classifyBatch(
    documents: Array<{ id: string; text: string; layoutAnalysis?: any; imageMetadata?: any }>
  ): Promise<Array<{ documentId: string; result: ClassificationResult; error?: string }>> {
    const results: Array<{ documentId: string; result: ClassificationResult; error?: string }> = [];

    for (const doc of documents) {
      try {
        const result = await this.classifyDocument(doc.text, doc.layoutAnalysis, doc.imageMetadata);
        results.push({ documentId: doc.id, result });
      } catch (error) {
        results.push({
          documentId: doc.id,
          result: null as any,
          error: error.message
        });
      }
    }

    return results;
  }
}