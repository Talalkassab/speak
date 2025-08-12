import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';
import { OCRResult } from './ocr-processing-service';
import { ClassificationResult } from './document-classification-service';
import { AIEnhancementResult } from './ai-enhancement-service';
import { ArabicTextEnhancer, ArabicTextUtils } from './arabic-text-enhancement';

export interface QualityMetrics {
  overall: number;
  textClarity: number;
  structuralIntegrity: number;
  languageConsistency: number;
  contentCompleteness: number;
  confidence: number;
}

export interface QualityIssue {
  type: 'low_confidence' | 'text_fragmentation' | 'missing_content' | 'format_issues' | 'language_mixing' | 'character_errors';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: { start: number; end: number };
  suggestedFix?: string;
  confidence: number;
}

export interface QualityAssessmentResult {
  documentId: string;
  overallQuality: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  needsManualReview: boolean;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  processingMetadata: {
    assessmentTime: number;
    checksPerformed: string[];
    confidenceScore: number;
  };
}

export interface ComparisonResult {
  similarity: number;
  differences: Array<{
    type: 'addition' | 'deletion' | 'modification';
    original: string;
    modified: string;
    position: number;
    confidence: number;
  }>;
  improvementScore: number;
  qualityDelta: number;
}

export class QualityAssuranceService {
  private logger: Logger;
  private textEnhancer: ArabicTextEnhancer;

  constructor() {
    this.logger = structuredLogger;
    this.textEnhancer = new ArabicTextEnhancer();
  }

  async assessQuality(
    ocrResult: OCRResult,
    classification?: ClassificationResult,
    aiEnhancement?: AIEnhancementResult,
    originalImage?: Buffer
  ): Promise<QualityAssessmentResult> {
    const startTime = Date.now();
    const documentId = `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Starting quality assessment', {
      documentId,
      textLength: ocrResult.text.length,
      hasClassification: !!classification,
      hasAIEnhancement: !!aiEnhancement
    });

    const checksPerformed: string[] = [];
    const issues: QualityIssue[] = [];

    // Perform various quality checks
    const textClarityScore = this.assessTextClarity(ocrResult, issues);
    checksPerformed.push('text_clarity');

    const structuralScore = this.assessStructuralIntegrity(ocrResult, classification, issues);
    checksPerformed.push('structural_integrity');

    const languageScore = this.assessLanguageConsistency(ocrResult, issues);
    checksPerformed.push('language_consistency');

    const completenessScore = this.assessContentCompleteness(ocrResult, classification, issues);
    checksPerformed.push('content_completeness');

    const confidenceScore = this.assessConfidenceDistribution(ocrResult, issues);
    checksPerformed.push('confidence_distribution');

    // Additional checks if AI enhancement is available
    if (aiEnhancement) {
      this.assessAIEnhancementQuality(aiEnhancement, issues);
      checksPerformed.push('ai_enhancement_quality');
    }

    // Calculate overall quality metrics
    const overallQuality: QualityMetrics = {
      overall: (textClarityScore + structuralScore + languageScore + completenessScore + confidenceScore) / 5,
      textClarity: textClarityScore,
      structuralIntegrity: structuralScore,
      languageConsistency: languageScore,
      contentCompleteness: completenessScore,
      confidence: confidenceScore
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, overallQuality);

    // Determine if manual review is needed
    const needsManualReview = this.determineManualReviewNeed(issues, overallQuality);

    // Assign quality grade
    const qualityGrade = this.assignQualityGrade(overallQuality.overall);

    const result: QualityAssessmentResult = {
      documentId,
      overallQuality,
      issues,
      recommendations,
      needsManualReview,
      qualityGrade,
      processingMetadata: {
        assessmentTime: Date.now() - startTime,
        checksPerformed,
        confidenceScore: overallQuality.overall
      }
    };

    this.logger.info('Quality assessment completed', {
      documentId,
      qualityGrade,
      overallScore: overallQuality.overall,
      issueCount: issues.length,
      needsManualReview,
      processingTime: result.processingMetadata.assessmentTime
    });

    return result;
  }

  private assessTextClarity(ocrResult: OCRResult, issues: QualityIssue[]): number {
    let score = 0.8; // Base score

    // Check for fragmented text (too many single-character "words")
    const words = ocrResult.text.split(/\s+/).filter(w => w.length > 0);
    const singleCharWords = words.filter(w => w.length === 1);
    const fragmentationRatio = singleCharWords.length / words.length;

    if (fragmentationRatio > 0.2) {
      issues.push({
        type: 'text_fragmentation',
        severity: 'high',
        description: `High text fragmentation detected (${Math.round(fragmentationRatio * 100)}% single-character words)`,
        confidence: 0.9,
        suggestedFix: 'Consider re-processing with different OCR settings or image enhancement'
      });
      score -= 0.3;
    } else if (fragmentationRatio > 0.1) {
      issues.push({
        type: 'text_fragmentation',
        severity: 'medium',
        description: `Moderate text fragmentation detected (${Math.round(fragmentationRatio * 100)}% single-character words)`,
        confidence: 0.8,
        suggestedFix: 'Review and correct fragmented text segments'
      });
      score -= 0.15;
    }

    // Check for excessive special characters or noise
    const specialCharPattern = /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\w\d.,!?؟،؛]/g;
    const specialChars = ocrResult.text.match(specialCharPattern);
    
    if (specialChars && specialChars.length > ocrResult.text.length * 0.05) {
      issues.push({
        type: 'character_errors',
        severity: 'medium',
        description: `Excessive special characters or OCR noise detected (${specialChars.length} instances)`,
        confidence: 0.7,
        suggestedFix: 'Clean up special characters and OCR artifacts'
      });
      score -= 0.2;
    }

    // Check word-level confidence if available
    if (ocrResult.words && ocrResult.words.length > 0) {
      const lowConfidenceWords = ocrResult.words.filter(w => w.confidence < 0.6);
      const lowConfidenceRatio = lowConfidenceWords.length / ocrResult.words.length;

      if (lowConfidenceRatio > 0.3) {
        issues.push({
          type: 'low_confidence',
          severity: 'high',
          description: `Many words have low confidence (${Math.round(lowConfidenceRatio * 100)}% below 60%)`,
          confidence: 0.9,
          suggestedFix: 'Consider manual review of low-confidence words'
        });
        score -= 0.25;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessStructuralIntegrity(
    ocrResult: OCRResult,
    classification?: ClassificationResult,
    issues: QualityIssue[]
  ): number {
    let score = 0.7; // Base score

    // Check for proper paragraph structure
    const paragraphs = ocrResult.text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const averageParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;

    if (paragraphs.length === 1 && ocrResult.text.length > 500) {
      issues.push({
        type: 'format_issues',
        severity: 'medium',
        description: 'Document appears to be one large paragraph without proper breaks',
        confidence: 0.8,
        suggestedFix: 'Add appropriate paragraph breaks for better readability'
      });
      score -= 0.2;
    }

    // Check for proper line breaks and spacing
    const lines = ocrResult.text.split('\n');
    const veryShortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 10);
    
    if (veryShortLines.length > lines.length * 0.3) {
      issues.push({
        type: 'format_issues',
        severity: 'medium',
        description: 'Many very short lines detected, possible formatting issues',
        confidence: 0.7,
        suggestedFix: 'Review line breaks and text flow'
      });
      score -= 0.15;
    }

    // Document-type specific checks
    if (classification) {
      score += this.performDocumentSpecificStructureChecks(
        ocrResult.text,
        classification,
        issues
      );
    }

    return Math.max(0, Math.min(1, score));
  }

  private performDocumentSpecificStructureChecks(
    text: string,
    classification: ClassificationResult,
    issues: QualityIssue[]
  ): number {
    let adjustmentScore = 0;
    const docType = classification.documentType.id;

    switch (docType) {
      case 'employment_contract':
        // Check for essential contract elements
        const contractElements = ['عقد', 'راتب', 'وظيفة', 'contract', 'salary', 'position'];
        const foundElements = contractElements.filter(element => 
          text.toLowerCase().includes(element.toLowerCase())
        );
        
        if (foundElements.length < 3) {
          issues.push({
            type: 'missing_content',
            severity: 'high',
            description: 'Missing essential contract elements',
            confidence: 0.8,
            suggestedFix: 'Verify all contract sections are captured'
          });
          adjustmentScore -= 0.2;
        }
        break;

      case 'saudi_national_id':
        // Check for ID number pattern
        const idPattern = /\d{10}/;
        if (!idPattern.test(text)) {
          issues.push({
            type: 'missing_content',
            severity: 'high',
            description: 'National ID number not detected',
            confidence: 0.9,
            suggestedFix: 'Ensure ID number is clearly captured'
          });
          adjustmentScore -= 0.3;
        }
        break;

      case 'bank_statement':
        // Check for transaction patterns
        const amountPattern = /\d+[.,]\d{2}/;
        if (!amountPattern.test(text)) {
          issues.push({
            type: 'missing_content',
            severity: 'medium',
            description: 'No monetary amounts detected in bank statement',
            confidence: 0.7,
            suggestedFix: 'Verify transaction amounts are captured'
          });
          adjustmentScore -= 0.15;
        }
        break;
    }

    return adjustmentScore;
  }

  private assessLanguageConsistency(ocrResult: OCRResult, issues: QualityIssue[]): number {
    let score = 0.8; // Base score

    // Analyze language distribution
    const arabicChars = (ocrResult.text.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (ocrResult.text.match(/[A-Za-z]/g) || []).length;
    const totalChars = arabicChars + englishChars;

    if (totalChars === 0) {
      issues.push({
        type: 'language_mixing',
        severity: 'critical',
        description: 'No recognizable Arabic or English text detected',
        confidence: 0.9,
        suggestedFix: 'Re-process with appropriate language settings'
      });
      return 0;
    }

    // Check for proper RTL/LTR handling
    if (arabicChars > 0) {
      const rtlSegments = this.textEnhancer['analyzeRTLSegments'](ocrResult.text);
      const arabicSegments = rtlSegments.filter(s => s.language === 'arabic');
      
      if (arabicSegments.length === 0 && arabicChars > totalChars * 0.3) {
        issues.push({
          type: 'language_mixing',
          severity: 'medium',
          description: 'Arabic text detected but RTL segments not properly identified',
          confidence: 0.7,
          suggestedFix: 'Review Arabic text direction and formatting'
        });
        score -= 0.2;
      }
    }

    // Check for mixed script issues
    const mixedScriptPattern = /[\u0600-\u06FF][A-Za-z]|[A-Za-z][\u0600-\u06FF]/g;
    const mixedScriptMatches = ocrResult.text.match(mixedScriptPattern);
    
    if (mixedScriptMatches && mixedScriptMatches.length > 5) {
      issues.push({
        type: 'language_mixing',
        severity: 'medium',
        description: 'Frequent Arabic-English character mixing detected',
        confidence: 0.8,
        suggestedFix: 'Review and separate mixed script segments'
      });
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessContentCompleteness(
    ocrResult: OCRResult,
    classification?: ClassificationResult,
    issues: QualityIssue[]
  ): number {
    let score = 0.7; // Base score

    // Check text length relative to expected content
    const textLength = ocrResult.text.trim().length;
    
    if (textLength < 50) {
      issues.push({
        type: 'missing_content',
        severity: 'critical',
        description: 'Very short text content, possible extraction failure',
        confidence: 0.9,
        suggestedFix: 'Verify entire document was processed'
      });
      return 0.1;
    }

    if (textLength < 200) {
      issues.push({
        type: 'missing_content',
        severity: 'medium',
        description: 'Short text content, may be incomplete',
        confidence: 0.7,
        suggestedFix: 'Check if all document sections were captured'
      });
      score -= 0.2;
    }

    // Check for incomplete words or sentences
    const incompleteWords = ocrResult.text.match(/\b\w{1,2}\s/g);
    if (incompleteWords && incompleteWords.length > ocrResult.text.split(/\s+/).length * 0.2) {
      issues.push({
        type: 'missing_content',
        severity: 'medium',
        description: 'Many very short words detected, possible incomplete extraction',
        confidence: 0.6,
        suggestedFix: 'Review for missing characters or word parts'
      });
      score -= 0.15;
    }

    // Check for truncated sentences
    const sentences = ocrResult.text.split(/[.!?؟۔]/);
    const incompleteSentences = sentences.filter(s => 
      s.trim().length > 0 && s.trim().length < 10
    );
    
    if (incompleteSentences.length > sentences.length * 0.3) {
      issues.push({
        type: 'missing_content',
        severity: 'medium',
        description: 'Many incomplete sentences detected',
        confidence: 0.7,
        suggestedFix: 'Review sentence completeness and punctuation'
      });
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessConfidenceDistribution(ocrResult: OCRResult, issues: QualityIssue[]): number {
    let score = ocrResult.confidence;

    // Check overall confidence
    if (ocrResult.confidence < 0.5) {
      issues.push({
        type: 'low_confidence',
        severity: 'critical',
        description: `Very low overall OCR confidence: ${Math.round(ocrResult.confidence * 100)}%`,
        confidence: 0.9,
        suggestedFix: 'Consider re-processing with image enhancement or different OCR engine'
      });
    } else if (ocrResult.confidence < 0.7) {
      issues.push({
        type: 'low_confidence',
        severity: 'high',
        description: `Low overall OCR confidence: ${Math.round(ocrResult.confidence * 100)}%`,
        confidence: 0.8,
        suggestedFix: 'Manual review recommended'
      });
    }

    // Analyze word-level confidence distribution if available
    if (ocrResult.words && ocrResult.words.length > 0) {
      const confidences = ocrResult.words.map(w => w.confidence);
      const averageConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      const stdDev = Math.sqrt(
        confidences.reduce((sum, c) => sum + Math.pow(c - averageConfidence, 2), 0) / confidences.length
      );

      if (stdDev > 0.3) {
        issues.push({
          type: 'low_confidence',
          severity: 'medium',
          description: 'High variance in word confidence scores',
          confidence: 0.7,
          suggestedFix: 'Focus manual review on low-confidence words'
        });
        score -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessAIEnhancementQuality(enhancement: AIEnhancementResult, issues: QualityIssue[]): void {
    // Check if AI enhancement actually improved the text
    if (enhancement.qualityScore < 0.5) {
      issues.push({
        type: 'format_issues',
        severity: 'medium',
        description: 'AI enhancement did not significantly improve text quality',
        confidence: 0.6,
        suggestedFix: 'Consider manual correction or different enhancement settings'
      });
    }

    // Check for excessive corrections
    const correctionRatio = enhancement.corrections.length / enhancement.originalText.split(/\s+/).length;
    if (correctionRatio > 0.3) {
      issues.push({
        type: 'character_errors',
        severity: 'high',
        description: 'AI made many corrections, original OCR quality may be very poor',
        confidence: 0.8,
        suggestedFix: 'Verify AI corrections are accurate'
      });
    }
  }

  private generateRecommendations(issues: QualityIssue[], quality: QualityMetrics): string[] {
    const recommendations: string[] = [];

    // Critical issues first
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical issues immediately before using this text');
      recommendations.push('Consider re-processing the document with different settings');
    }

    // Quality-specific recommendations
    if (quality.textClarity < 0.6) {
      recommendations.push('Improve image quality or use image enhancement before OCR');
      recommendations.push('Consider using a different OCR engine');
    }

    if (quality.structuralIntegrity < 0.6) {
      recommendations.push('Review document formatting and add proper structure');
      recommendations.push('Check for missing sections or content');
    }

    if (quality.languageConsistency < 0.6) {
      recommendations.push('Review Arabic text direction and formatting');
      recommendations.push('Separate mixed-language content appropriately');
    }

    if (quality.contentCompleteness < 0.6) {
      recommendations.push('Verify all document content was captured');
      recommendations.push('Check for truncated or missing text sections');
    }

    if (quality.confidence < 0.6) {
      recommendations.push('Manual review strongly recommended');
      recommendations.push('Focus on low-confidence text segments');
    }

    // General recommendations
    if (quality.overall < 0.7) {
      recommendations.push('Consider human validation before using this text');
    }

    return recommendations.length > 0 ? recommendations : ['Text quality is acceptable for most uses'];
  }

  private determineManualReviewNeed(issues: QualityIssue[], quality: QualityMetrics): boolean {
    // Always need review for critical issues
    if (issues.some(i => i.severity === 'critical')) {
      return true;
    }

    // Need review for low overall quality
    if (quality.overall < 0.6) {
      return true;
    }

    // Need review for multiple high-severity issues
    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length >= 2) {
      return true;
    }

    // Need review for very low confidence
    if (quality.confidence < 0.5) {
      return true;
    }

    return false;
  }

  private assignQualityGrade(overallScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (overallScore >= 0.9) return 'A';
    if (overallScore >= 0.8) return 'B';
    if (overallScore >= 0.7) return 'C';
    if (overallScore >= 0.6) return 'D';
    return 'F';
  }

  // Method to compare two versions of text (e.g., before and after correction)
  compareTextVersions(originalText: string, revisedText: string): ComparisonResult {
    const similarity = this.calculateTextSimilarity(originalText, revisedText);
    const differences = this.findTextDifferences(originalText, revisedText);
    
    // Calculate improvement score based on the nature of differences
    let improvementScore = 0.5; // Base score
    
    const corrections = differences.filter(d => d.type === 'modification');
    const additions = differences.filter(d => d.type === 'addition');
    
    // Additions generally indicate improvement (missing content added)
    if (additions.length > 0) {
      improvementScore += Math.min(0.3, additions.length * 0.1);
    }
    
    // Modifications can be improvements (corrections) or degradations
    if (corrections.length > 0) {
      // Assume corrections are improvements if they're not too numerous
      const correctionRatio = corrections.length / originalText.split(/\s+/).length;
      if (correctionRatio < 0.2) {
        improvementScore += 0.2;
      } else {
        improvementScore -= 0.1; // Too many changes might indicate problems
      }
    }

    const qualityDelta = revisedText.length >= originalText.length ? 0.1 : -0.1;

    return {
      similarity,
      differences,
      improvementScore: Math.max(0, Math.min(1, improvementScore)),
      qualityDelta
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for words
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private findTextDifferences(original: string, revised: string): ComparisonResult['differences'] {
    // Simplified diff algorithm
    const differences: ComparisonResult['differences'] = [];
    
    const originalWords = original.split(/\s+/);
    const revisedWords = revised.split(/\s+/);
    
    let i = 0, j = 0;
    let position = 0;
    
    while (i < originalWords.length || j < revisedWords.length) {
      if (i < originalWords.length && j < revisedWords.length) {
        if (originalWords[i] === revisedWords[j]) {
          // Words match, continue
          position += originalWords[i].length + 1;
          i++;
          j++;
        } else {
          // Words differ, record as modification
          differences.push({
            type: 'modification',
            original: originalWords[i],
            modified: revisedWords[j],
            position,
            confidence: 0.8
          });
          position += originalWords[i].length + 1;
          i++;
          j++;
        }
      } else if (i < originalWords.length) {
        // Word deleted from original
        differences.push({
          type: 'deletion',
          original: originalWords[i],
          modified: '',
          position,
          confidence: 0.9
        });
        position += originalWords[i].length + 1;
        i++;
      } else {
        // Word added in revised
        differences.push({
          type: 'addition',
          original: '',
          modified: revisedWords[j],
          position,
          confidence: 0.9
        });
        j++;
      }
    }
    
    return differences;
  }

  // Method to get quality statistics for a batch of documents
  async getBatchQualityStatistics(
    assessments: QualityAssessmentResult[]
  ): Promise<{
    averageQuality: QualityMetrics;
    gradeDistribution: Record<string, number>;
    commonIssues: Array<{ type: string; frequency: number; averageSeverity: string }>;
    recommendationsFrequency: Record<string, number>;
  }> {
    if (assessments.length === 0) {
      throw new Error('No assessments provided');
    }

    // Calculate average quality metrics
    const averageQuality: QualityMetrics = {
      overall: assessments.reduce((sum, a) => sum + a.overallQuality.overall, 0) / assessments.length,
      textClarity: assessments.reduce((sum, a) => sum + a.overallQuality.textClarity, 0) / assessments.length,
      structuralIntegrity: assessments.reduce((sum, a) => sum + a.overallQuality.structuralIntegrity, 0) / assessments.length,
      languageConsistency: assessments.reduce((sum, a) => sum + a.overallQuality.languageConsistency, 0) / assessments.length,
      contentCompleteness: assessments.reduce((sum, a) => sum + a.overallQuality.contentCompleteness, 0) / assessments.length,
      confidence: assessments.reduce((sum, a) => sum + a.overallQuality.confidence, 0) / assessments.length
    };

    // Calculate grade distribution
    const gradeDistribution: Record<string, number> = {};
    assessments.forEach(a => {
      gradeDistribution[a.qualityGrade] = (gradeDistribution[a.qualityGrade] || 0) + 1;
    });

    // Analyze common issues
    const issueMap = new Map<string, { count: number; severities: string[] }>();
    assessments.forEach(a => {
      a.issues.forEach(issue => {
        if (!issueMap.has(issue.type)) {
          issueMap.set(issue.type, { count: 0, severities: [] });
        }
        const issueData = issueMap.get(issue.type)!;
        issueData.count++;
        issueData.severities.push(issue.severity);
      });
    });

    const commonIssues = Array.from(issueMap.entries()).map(([type, data]) => {
      const severityScore = data.severities.reduce((sum, s) => {
        const scores = { low: 1, medium: 2, high: 3, critical: 4 };
        return sum + scores[s as keyof typeof scores];
      }, 0) / data.severities.length;
      
      const averageSeverity = severityScore < 1.5 ? 'low' : 
                             severityScore < 2.5 ? 'medium' : 
                             severityScore < 3.5 ? 'high' : 'critical';

      return {
        type,
        frequency: data.count,
        averageSeverity
      };
    }).sort((a, b) => b.frequency - a.frequency);

    // Analyze recommendation frequency
    const recommendationsFrequency: Record<string, number> = {};
    assessments.forEach(a => {
      a.recommendations.forEach(rec => {
        recommendationsFrequency[rec] = (recommendationsFrequency[rec] || 0) + 1;
      });
    });

    return {
      averageQuality,
      gradeDistribution,
      commonIssues,
      recommendationsFrequency
    };
  }
}