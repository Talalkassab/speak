import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';
import { createServerClient } from '../supabase/supabase-server-client';
import { OCRResult } from './ocr-processing-service';
import { ClassificationResult } from './document-classification-service';
import { AIEnhancementResult } from './ai-enhancement-service';
import { ArabicTextUtils } from './arabic-text-enhancement';
import { VectorSearchService } from '../services/vector-search-service';
import { EmbeddingService } from '../services/embedding-service';

export interface DocumentSearchResult {
  documentId: string;
  title: string;
  content: string;
  documentType: string;
  similarity: number;
  relevantSections: Array<{
    text: string;
    startIndex: number;
    endIndex: number;
    similarity: number;
  }>;
  metadata: {
    createdAt: string;
    fileType: string;
    confidence: number;
    isVerified: boolean;
  };
}

export interface TemplateMatch {
  templateId: string;
  templateName: string;
  templateNameAr: string;
  category: string;
  matchScore: number;
  confidence: number;
  extractedFields: Array<{
    fieldName: string;
    fieldNameAr: string;
    value: string;
    normalizedValue: string;
    confidence: number;
    position: { start: number; end: number };
  }>;
  missingFields: string[];
  recommendations: string[];
}

export interface ComplianceCheck {
  complianceType: 'saudi_labor_law' | 'contract_requirements' | 'data_privacy' | 'document_retention';
  status: 'compliant' | 'non_compliant' | 'requires_review' | 'insufficient_data';
  score: number;
  violations: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location?: { start: number; end: number };
    recommendation: string;
  }>;
  requirements: Array<{
    requirement: string;
    status: 'met' | 'not_met' | 'partially_met';
    details: string;
  }>;
}

export interface IntegrationResult {
  documentId: string;
  searchResults: DocumentSearchResult[];
  templateMatches: TemplateMatch[];
  complianceChecks: ComplianceCheck[];
  recommendations: string[];
  metadata: {
    processingTime: number;
    searchPerformed: boolean;
    templatesChecked: number;
    complianceRulesApplied: number;
  };
}

export class DocumentIntegrationService {
  private logger: Logger;
  private vectorSearch: VectorSearchService;
  private embeddingService: EmbeddingService;
  private supabase: any;

  constructor() {
    this.logger = structuredLogger;
    this.vectorSearch = new VectorSearchService();
    this.embeddingService = new EmbeddingService();
    this.supabase = createServerClient();
  }

  async integrateDocument(
    ocrResult: OCRResult,
    classification?: ClassificationResult,
    aiEnhancement?: AIEnhancementResult,
    userId?: string
  ): Promise<IntegrationResult> {
    const startTime = Date.now();
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Starting document integration', {
      documentId,
      textLength: ocrResult.text.length,
      documentType: classification?.documentType?.id,
      hasAIEnhancement: !!aiEnhancement,
      userId
    });

    try {
      // Use enhanced text if available, otherwise use original OCR text
      const processedText = aiEnhancement?.enhancedText || ocrResult.text;

      // Perform similar document search
      const searchResults = await this.searchSimilarDocuments(
        processedText,
        classification?.documentType?.category,
        userId
      );

      // Match against templates
      const templateMatches = await this.matchDocumentTemplates(
        processedText,
        classification?.documentType?.id
      );

      // Perform compliance checks
      const complianceChecks = await this.performComplianceChecks(
        processedText,
        classification?.documentType?.id || 'unknown'
      );

      // Generate integration recommendations
      const recommendations = this.generateIntegrationRecommendations(
        searchResults,
        templateMatches,
        complianceChecks
      );

      // Store in vector database for future searches
      if (userId) {
        await this.storeInVectorDatabase(documentId, processedText, classification, userId);
      }

      const result: IntegrationResult = {
        documentId,
        searchResults,
        templateMatches,
        complianceChecks,
        recommendations,
        metadata: {
          processingTime: Date.now() - startTime,
          searchPerformed: searchResults.length > 0,
          templatesChecked: templateMatches.length,
          complianceRulesApplied: complianceChecks.length
        }
      };

      this.logger.info('Document integration completed', {
        documentId,
        searchResultsCount: searchResults.length,
        templateMatchesCount: templateMatches.length,
        complianceChecksCount: complianceChecks.length,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Document integration failed', {
        documentId,
        error: error.message,
        processingTime: Date.now() - startTime
      });

      // Return empty result with error information
      return {
        documentId,
        searchResults: [],
        templateMatches: [],
        complianceChecks: [],
        recommendations: ['Integration failed - manual review required'],
        metadata: {
          processingTime: Date.now() - startTime,
          searchPerformed: false,
          templatesChecked: 0,
          complianceRulesApplied: 0
        }
      };
    }
  }

  private async searchSimilarDocuments(
    text: string,
    category?: string,
    userId?: string
  ): Promise<DocumentSearchResult[]> {
    try {
      // Generate embedding for the text
      const embedding = await this.embeddingService.generateEmbedding(text);

      // Search for similar documents in vector database
      const searchResults = await this.vectorSearch.searchSimilar(
        embedding,
        {
          limit: 10,
          threshold: 0.7,
          filters: {
            user_id: userId,
            document_category: category
          }
        }
      );

      return searchResults.map(result => ({
        documentId: result.id,
        title: result.metadata?.title || 'Untitled Document',
        content: result.text.substring(0, 500) + '...',
        documentType: result.metadata?.document_type || 'unknown',
        similarity: result.similarity,
        relevantSections: this.extractRelevantSections(text, result.text),
        metadata: {
          createdAt: result.metadata?.created_at || new Date().toISOString(),
          fileType: result.metadata?.file_type || 'unknown',
          confidence: result.metadata?.confidence || 0.5,
          isVerified: result.metadata?.is_verified || false
        }
      }));

    } catch (error) {
      this.logger.warn('Similar document search failed', { error: error.message });
      return [];
    }
  }

  private extractRelevantSections(queryText: string, documentText: string): Array<{
    text: string;
    startIndex: number;
    endIndex: number;
    similarity: number;
  }> {
    const sections: Array<{
      text: string;
      startIndex: number;
      endIndex: number;
      similarity: number;
    }> = [];

    // Split both texts into sentences
    const queryWords = new Set(
      ArabicTextUtils.normalizeArabicText(queryText)
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    const sentences = documentText.split(/[.!?؟۔]/).filter(s => s.trim().length > 20);

    sentences.forEach((sentence, index) => {
      const sentenceWords = new Set(
        ArabicTextUtils.normalizeArabicText(sentence)
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 2)
      );

      // Calculate Jaccard similarity
      const intersection = new Set([...queryWords].filter(w => sentenceWords.has(w)));
      const union = new Set([...queryWords, ...sentenceWords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0.2) {
        const startIndex = documentText.indexOf(sentence.trim());
        sections.push({
          text: sentence.trim(),
          startIndex,
          endIndex: startIndex + sentence.trim().length,
          similarity
        });
      }
    });

    return sections.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  private async matchDocumentTemplates(
    text: string,
    documentType?: string
  ): Promise<TemplateMatch[]> {
    try {
      // Get available templates for the document type
      const { data: templates, error } = await this.supabase
        .from('hr_document_templates')
        .select('*')
        .eq('is_active', true)
        .eq('document_type', documentType || null);

      if (error) {
        throw error;
      }

      const matches: TemplateMatch[] = [];

      for (const template of templates || []) {
        const match = await this.matchAgainstTemplate(text, template);
        if (match.matchScore > 0.3) {
          matches.push(match);
        }
      }

      return matches.sort((a, b) => b.matchScore - a.matchScore);

    } catch (error) {
      this.logger.warn('Template matching failed', { error: error.message });
      return [];
    }
  }

  private async matchAgainstTemplate(text: string, template: any): Promise<TemplateMatch> {
    const templateFields = template.fields || [];
    const extractedFields: TemplateMatch['extractedFields'] = [];
    const missingFields: string[] = [];

    let totalFieldScore = 0;
    let matchedFieldsCount = 0;

    // Extract each field from the text
    for (const field of templateFields) {
      const extraction = this.extractFieldValue(text, field);
      
      if (extraction.found) {
        extractedFields.push({
          fieldName: field.name,
          fieldNameAr: field.name_ar || field.name,
          value: extraction.value,
          normalizedValue: extraction.normalizedValue,
          confidence: extraction.confidence,
          position: extraction.position
        });
        totalFieldScore += extraction.confidence;
        matchedFieldsCount++;
      } else {
        missingFields.push(field.name);
      }
    }

    const matchScore = templateFields.length > 0 ? 
      (matchedFieldsCount / templateFields.length) * 0.7 + 
      (totalFieldScore / Math.max(matchedFieldsCount, 1)) * 0.3 : 0;

    const recommendations = this.generateTemplateRecommendations(
      extractedFields,
      missingFields,
      template
    );

    return {
      templateId: template.id,
      templateName: template.name,
      templateNameAr: template.name_ar || template.name,
      category: template.category,
      matchScore,
      confidence: matchScore,
      extractedFields,
      missingFields,
      recommendations
    };
  }

  private extractFieldValue(text: string, field: any): {
    found: boolean;
    value: string;
    normalizedValue: string;
    confidence: number;
    position: { start: number; end: number };
  } {
    const fieldPatterns = field.patterns || [];
    const fieldType = field.type || 'text';

    // Try each pattern to extract the field value
    for (const pattern of fieldPatterns) {
      const regex = new RegExp(pattern.regex, pattern.flags || 'gi');
      const match = regex.exec(text);

      if (match) {
        const value = match[1] || match[0];
        const normalizedValue = this.normalizeFieldValue(value, fieldType);

        return {
          found: true,
          value,
          normalizedValue,
          confidence: pattern.confidence || 0.8,
          position: {
            start: match.index,
            end: match.index + match[0].length
          }
        };
      }
    }

    // Try keyword-based extraction as fallback
    const keywords = field.keywords || [];
    for (const keyword of keywords) {
      const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        // Look for value after the keyword
        const afterKeyword = text.substring(keywordIndex + keyword.length);
        const valueMatch = afterKeyword.match(/:\s*([^\n\r]{1,100})/);
        
        if (valueMatch) {
          const value = valueMatch[1].trim();
          const normalizedValue = this.normalizeFieldValue(value, fieldType);

          return {
            found: true,
            value,
            normalizedValue,
            confidence: 0.6,
            position: {
              start: keywordIndex + keyword.length + valueMatch.index!,
              end: keywordIndex + keyword.length + valueMatch.index! + value.length
            }
          };
        }
      }
    }

    return {
      found: false,
      value: '',
      normalizedValue: '',
      confidence: 0,
      position: { start: 0, end: 0 }
    };
  }

  private normalizeFieldValue(value: string, fieldType: string): string {
    switch (fieldType) {
      case 'date':
        // Normalize date formats
        return this.normalizeDateValue(value);
      
      case 'amount':
        // Normalize monetary amounts
        return this.normalizeAmountValue(value);
      
      case 'phone':
        // Normalize phone numbers
        return this.normalizePhoneValue(value);
      
      case 'name':
        // Normalize names
        return this.normalizeNameValue(value);
      
      default:
        return value.trim();
    }
  }

  private normalizeDateValue(value: string): string {
    // Handle both Gregorian and Hijri dates
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /(\d{1,2})\s*(ه|هـ)\s*(\d{2,4})/,
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = value.match(pattern);
      if (match) {
        // Return normalized format - could implement proper date parsing
        return match[0];
      }
    }

    return value.trim();
  }

  private normalizeAmountValue(value: string): string {
    // Remove currency symbols and normalize decimal separators
    const cleanValue = value
      .replace(/[^\d.,]/g, '')
      .replace(',', '.');

    const number = parseFloat(cleanValue);
    return isNaN(number) ? value : number.toString();
  }

  private normalizePhoneValue(value: string): string {
    // Normalize Saudi phone numbers
    const digits = value.replace(/\D/g, '');
    
    if (digits.length === 9 && digits.startsWith('5')) {
      return `+966${digits}`;
    } else if (digits.length === 10 && digits.startsWith('05')) {
      return `+966${digits.substring(1)}`;
    } else if (digits.length === 12 && digits.startsWith('966')) {
      return `+${digits}`;
    }
    
    return value.trim();
  }

  private normalizeNameValue(value: string): string {
    // Basic name normalization
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private generateTemplateRecommendations(
    extractedFields: TemplateMatch['extractedFields'],
    missingFields: string[],
    template: any
  ): string[] {
    const recommendations: string[] = [];

    if (missingFields.length > 0) {
      recommendations.push(`Missing fields: ${missingFields.join(', ')}`);
      recommendations.push('Review document to ensure all required information is present');
    }

    const lowConfidenceFields = extractedFields.filter(f => f.confidence < 0.6);
    if (lowConfidenceFields.length > 0) {
      recommendations.push('Some fields have low confidence - manual verification recommended');
    }

    if (extractedFields.length > 0) {
      recommendations.push('Successfully extracted structured data from document');
    }

    return recommendations;
  }

  private async performComplianceChecks(
    text: string,
    documentType: string
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Saudi Labor Law compliance
    if (documentType === 'employment_contract') {
      checks.push(await this.checkSaudiLaborLawCompliance(text));
    }

    // Contract requirements
    if (documentType.includes('contract')) {
      checks.push(await this.checkContractRequirements(text, documentType));
    }

    // Data privacy compliance
    checks.push(await this.checkDataPrivacyCompliance(text));

    return checks.filter(check => check.status !== 'insufficient_data');
  }

  private async checkSaudiLaborLawCompliance(text: string): Promise<ComplianceCheck> {
    const violations: ComplianceCheck['violations'] = [];
    const requirements: ComplianceCheck['requirements'] = [];

    // Check for required contract elements
    const requiredElements = [
      { keyword: 'راتب|salary', requirement: 'Salary specification required' },
      { keyword: 'ساعات العمل|working hours', requirement: 'Working hours must be specified' },
      { keyword: 'إجازة|vacation|leave', requirement: 'Leave entitlement must be mentioned' },
      { keyword: 'تأمين|insurance', requirement: 'Insurance coverage should be specified' },
      { keyword: 'إنهاء|termination', requirement: 'Termination conditions must be clear' }
    ];

    let metRequirements = 0;

    for (const element of requiredElements) {
      const regex = new RegExp(element.keyword, 'i');
      const found = regex.test(text);

      requirements.push({
        requirement: element.requirement,
        status: found ? 'met' : 'not_met',
        details: found ? 'Found in document' : 'Not found in document'
      });

      if (found) metRequirements++;
    }

    // Check for prohibited clauses
    const prohibitedPatterns = [
      { pattern: /تنازل عن الحقوق|waive.*rights/i, description: 'Waiver of rights clause' },
      { pattern: /عدم المنافسة|non.?compete/i, description: 'Non-compete clause may violate labor law' }
    ];

    for (const prohibited of prohibitedPatterns) {
      if (prohibited.pattern.test(text)) {
        violations.push({
          type: 'prohibited_clause',
          description: prohibited.description,
          severity: 'high',
          recommendation: 'Remove or modify this clause to comply with Saudi Labor Law'
        });
      }
    }

    const score = metRequirements / requiredElements.length;
    const status = violations.length > 0 ? 'non_compliant' :
                  score >= 0.8 ? 'compliant' :
                  score >= 0.6 ? 'requires_review' : 'non_compliant';

    return {
      complianceType: 'saudi_labor_law',
      status,
      score,
      violations,
      requirements
    };
  }

  private async checkContractRequirements(text: string, documentType: string): Promise<ComplianceCheck> {
    const violations: ComplianceCheck['violations'] = [];
    const requirements: ComplianceCheck['requirements'] = [];

    // Basic contract requirements
    const basicRequirements = [
      { keyword: 'تاريخ|date', requirement: 'Contract must be dated' },
      { keyword: 'طرف|party|أطراف|parties', requirement: 'Contracting parties must be identified' },
      { keyword: 'توقيع|signature|ختم|seal', requirement: 'Contract must be signed/sealed' }
    ];

    let metRequirements = 0;

    for (const req of basicRequirements) {
      const regex = new RegExp(req.keyword, 'i');
      const found = regex.test(text);

      requirements.push({
        requirement: req.requirement,
        status: found ? 'met' : 'not_met',
        details: found ? 'Found in document' : 'Not found in document'
      });

      if (found) metRequirements++;
    }

    const score = metRequirements / basicRequirements.length;
    const status = score >= 0.8 ? 'compliant' : 
                  score >= 0.6 ? 'requires_review' : 'non_compliant';

    return {
      complianceType: 'contract_requirements',
      status,
      score,
      violations,
      requirements
    };
  }

  private async checkDataPrivacyCompliance(text: string): Promise<ComplianceCheck> {
    const violations: ComplianceCheck['violations'] = [];
    const requirements: ComplianceCheck['requirements'] = [];

    // Look for sensitive data that might need protection
    const sensitivePatterns = [
      { pattern: /\d{10}/, type: 'national_id', description: 'National ID number detected' },
      { pattern: /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, type: 'credit_card', description: 'Credit card number pattern' },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email', description: 'Email address' }
    ];

    for (const pattern of sensitivePatterns) {
      const matches = text.match(new RegExp(pattern.pattern, 'g'));
      if (matches && matches.length > 0) {
        requirements.push({
          requirement: `Protect ${pattern.type} data`,
          status: 'requires_review',
          details: `${matches.length} instances of ${pattern.description} found`
        });
      }
    }

    const score = requirements.length === 0 ? 1.0 : 0.7; // Lower score if sensitive data found
    const status = requirements.length === 0 ? 'compliant' : 'requires_review';

    return {
      complianceType: 'data_privacy',
      status,
      score,
      violations,
      requirements
    };
  }

  private generateIntegrationRecommendations(
    searchResults: DocumentSearchResult[],
    templateMatches: TemplateMatch[],
    complianceChecks: ComplianceCheck[]
  ): string[] {
    const recommendations: string[] = [];

    // Search results recommendations
    if (searchResults.length > 0) {
      const highSimilarityResults = searchResults.filter(r => r.similarity > 0.8);
      if (highSimilarityResults.length > 0) {
        recommendations.push('Similar documents found - consider using as reference or template');
      }
    } else {
      recommendations.push('No similar documents found - this may be a new document type');
    }

    // Template matching recommendations
    if (templateMatches.length > 0) {
      const bestMatch = templateMatches[0];
      if (bestMatch.matchScore > 0.8) {
        recommendations.push(`Strong match with ${bestMatch.templateName} template`);
      } else if (bestMatch.matchScore > 0.5) {
        recommendations.push(`Partial match with ${bestMatch.templateName} template - consider standardization`);
      }
    }

    // Compliance recommendations
    const nonCompliantChecks = complianceChecks.filter(c => c.status === 'non_compliant');
    if (nonCompliantChecks.length > 0) {
      recommendations.push('Compliance issues detected - legal review recommended');
    }

    const reviewRequiredChecks = complianceChecks.filter(c => c.status === 'requires_review');
    if (reviewRequiredChecks.length > 0) {
      recommendations.push('Some areas require compliance review');
    }

    return recommendations.length > 0 ? recommendations : ['Document processed successfully'];
  }

  private async storeInVectorDatabase(
    documentId: string,
    text: string,
    classification?: ClassificationResult,
    userId?: string
  ): Promise<void> {
    try {
      // Generate embedding for the document
      const embedding = await this.embeddingService.generateEmbedding(text);

      // Store in vector database
      await this.vectorSearch.addDocument(documentId, {
        text,
        embedding,
        metadata: {
          user_id: userId,
          document_type: classification?.documentType?.id,
          document_category: classification?.documentType?.category,
          confidence: classification?.confidence,
          created_at: new Date().toISOString(),
          is_searchable: true
        }
      });

      this.logger.info('Document stored in vector database', { documentId, userId });

    } catch (error) {
      this.logger.warn('Failed to store document in vector database', {
        documentId,
        error: error.message
      });
    }
  }

  // Method to search documents by query
  async searchDocuments(
    query: string,
    filters?: {
      documentType?: string;
      category?: string;
      userId?: string;
      dateRange?: { from: string; to: string };
    }
  ): Promise<DocumentSearchResult[]> {
    try {
      // Generate embedding for search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Perform vector search
      const searchResults = await this.vectorSearch.searchSimilar(
        queryEmbedding,
        {
          limit: 20,
          threshold: 0.6,
          filters: {
            user_id: filters?.userId,
            document_type: filters?.documentType,
            document_category: filters?.category
          }
        }
      );

      return searchResults.map(result => ({
        documentId: result.id,
        title: result.metadata?.title || 'Untitled Document',
        content: result.text.substring(0, 500) + '...',
        documentType: result.metadata?.document_type || 'unknown',
        similarity: result.similarity,
        relevantSections: this.extractRelevantSections(query, result.text),
        metadata: {
          createdAt: result.metadata?.created_at || new Date().toISOString(),
          fileType: result.metadata?.file_type || 'unknown',
          confidence: result.metadata?.confidence || 0.5,
          isVerified: result.metadata?.is_verified || false
        }
      }));

    } catch (error) {
      this.logger.error('Document search failed', { error: error.message });
      return [];
    }
  }

  // Method to get template suggestions for a document
  async getTemplateSuggestions(
    text: string,
    documentType?: string
  ): Promise<Array<{ templateId: string; name: string; nameAr: string; matchScore: number }>> {
    try {
      const templateMatches = await this.matchDocumentTemplates(text, documentType);
      
      return templateMatches.map(match => ({
        templateId: match.templateId,
        name: match.templateName,
        nameAr: match.templateNameAr,
        matchScore: match.matchScore
      }));

    } catch (error) {
      this.logger.error('Template suggestions failed', { error: error.message });
      return [];
    }
  }
}