import * as fs from 'fs';
import * as path from 'path';
import { Tesseract, createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import sharp from 'sharp';
import { pdf2pic } from 'pdf2pic';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { detectTextLanguage } from '@/types/documents';

export interface ExtractedContent {
  text: string;
  language: 'ar' | 'en' | 'mixed';
  metadata: {
    page_count?: number;
    extraction_method: 'direct' | 'ocr' | 'hybrid';
    confidence?: number;
    processing_time_ms: number;
    file_info: {
      size: number;
      type: string;
      pages?: number;
    };
    ocr_applied?: boolean;
    errors?: string[];
    word_count?: number;
    extracted_at: string;
    document_type?: string;
    extracted_dates?: string[];
    emails?: string[];
    phone_numbers?: string[];
  };
}

export class TextExtractionService {
  private supabase;
  private static ocrWorker: Tesseract.Worker | null = null;

  constructor() {
    this.supabase = createSupabaseServerClient();
  }

  /**
   * Initialize OCR worker with Arabic and English language support
   */
  private static async initializeOCR(): Promise<Tesseract.Worker> {
    if (this.ocrWorker) {
      return this.ocrWorker;
    }

    try {
      const worker = await createWorker('ara+eng', 1, {
        logger: m => console.log('OCR:', m)
      });
      
      await worker.setParameters({
        tessedit_pageseg_mode: '1', // Auto page segmentation with OSD
        tessedit_ocr_engine_mode: '3', // Default, based on what is available
        preserve_interword_spaces: '1'
      });

      this.ocrWorker = worker;
      return worker;
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Extract text from various file types with enhanced OCR and Arabic support
   */
  static async extractText(filePath: string, mimeType: string): Promise<ExtractedContent> {
    const startTime = Date.now();
    const fileStats = fs.statSync(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(filePath, fileStats.size);
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromWord(filePath, fileStats.size);
        
        case 'text/plain':
          return await this.extractFromText(filePath, fileStats.size);
        
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
        case 'image/webp':
          return await this.extractFromImage(filePath, fileStats.size);
        
        default:
          // Try to detect from file extension
          if (['.pdf'].includes(fileExtension)) {
            return await this.extractFromPDF(filePath, fileStats.size);
          } else if (['.doc', '.docx'].includes(fileExtension)) {
            return await this.extractFromWord(filePath, fileStats.size);
          } else if (['.txt', '.md'].includes(fileExtension)) {
            return await this.extractFromText(filePath, fileStats.size);
          } else if (['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp'].includes(fileExtension)) {
            return await this.extractFromImage(filePath, fileStats.size);
          } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
          }
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Text extraction failed:', error);
      
      return {
        text: '',
        language: 'en',
        metadata: {
          extraction_method: 'direct',
          processing_time_ms: processingTime,
          file_info: {
            size: fileStats.size,
            type: mimeType
          },
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          extracted_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract text from PDF files with OCR fallback
   */
  private static async extractFromPDF(filePath: string, fileSize: number): Promise<ExtractedContent> {
    const startTime = Date.now();
    let extractedText = '';
    let extractionMethod: 'direct' | 'ocr' | 'hybrid' = 'direct';
    let ocrApplied = false;
    let pageCount = 0;
    const errors: string[] = [];

    try {
      // First, try direct text extraction
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text.trim();
      pageCount = pdfData.numpages;

      // If direct extraction yields little or no text, use OCR
      if (extractedText.length < 100 || this.isTextGarbled(extractedText)) {
        console.log('PDF text extraction insufficient, using OCR fallback');
        
        try {
          const ocrText = await this.extractPDFWithOCR(filePath);
          if (ocrText.length > extractedText.length) {
            extractedText = ocrText;
            extractionMethod = extractedText.length > 0 ? 'hybrid' : 'ocr';
            ocrApplied = true;
          }
        } catch (ocrError) {
          console.error('OCR fallback failed:', ocrError);
          errors.push(`OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'}`);
        }
      }

      // Clean and enhance extracted text
      extractedText = await this.cleanText(extractedText);
      const language = detectTextLanguage(extractedText);
      const processingTime = Date.now() - startTime;

      // Extract additional metadata
      const additionalMetadata = await this.extractDocumentMetadata(extractedText);

      return {
        text: extractedText,
        language,
        metadata: {
          page_count: pageCount,
          extraction_method: extractionMethod,
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'application/pdf',
            pages: pageCount
          },
          ocr_applied: ocrApplied,
          errors: errors.length > 0 ? errors : undefined,
          word_count: this.countWords(extractedText),
          extracted_at: new Date().toISOString(),
          ...additionalMetadata
        }
      };

    } catch (error) {
      console.error('PDF extraction failed:', error);
      
      // As last resort, try pure OCR
      try {
        const ocrText = await this.extractPDFWithOCR(filePath);
        const cleanedText = await this.cleanText(ocrText);
        const language = detectTextLanguage(cleanedText);
        const processingTime = Date.now() - startTime;

        return {
          text: cleanedText,
          language,
          metadata: {
            extraction_method: 'ocr',
            processing_time_ms: processingTime,
            file_info: {
              size: fileSize,
              type: 'application/pdf'
            },
            ocr_applied: true,
            errors: [`Direct extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            word_count: this.countWords(cleanedText),
            extracted_at: new Date().toISOString()
          }
        };
      } catch (ocrError) {
        const processingTime = Date.now() - startTime;
        return {
          text: '',
          language: 'en',
          metadata: {
            extraction_method: 'direct',
            processing_time_ms: processingTime,
            file_info: {
              size: fileSize,
              type: 'application/pdf'
            },
            errors: [
              `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              `OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'}`
            ],
            extracted_at: new Date().toISOString()
          }
        };
      }
    }
  }

  /**
   * Extract text from Word documents (DOC/DOCX)
   */
  private static async extractFromWord(filePath: string, fileSize: number): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      const extractedText = await this.cleanText(result.value.trim());
      const language = detectTextLanguage(extractedText);
      const processingTime = Date.now() - startTime;
      const additionalMetadata = await this.extractDocumentMetadata(extractedText);

      return {
        text: extractedText,
        language,
        metadata: {
          extraction_method: 'direct',
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          },
          errors: result.messages.length > 0 ? result.messages.map(m => m.message) : undefined,
          word_count: this.countWords(extractedText),
          extracted_at: new Date().toISOString(),
          ...additionalMetadata
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Word extraction failed:', error);
      
      return {
        text: '',
        language: 'en',
        metadata: {
          extraction_method: 'direct',
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'application/msword'
          },
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          extracted_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract text from plain text files
   */
  private static async extractFromText(filePath: string, fileSize: number): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      const buffer = fs.readFileSync(filePath);
      
      // Try to detect encoding (UTF-8, UTF-16, Windows-1256 for Arabic)
      let text = buffer.toString('utf-8');
      
      // Check if it might be Windows-1256 (Arabic encoding)
      if (this.isLikelyWindows1256(buffer)) {
        const iconv = require('iconv-lite');
        text = iconv.decode(buffer, 'windows-1256');
      }

      const cleanedText = await this.cleanText(text);
      const language = detectTextLanguage(cleanedText);
      const processingTime = Date.now() - startTime;
      const additionalMetadata = await this.extractDocumentMetadata(cleanedText);

      return {
        text: cleanedText,
        language,
        metadata: {
          extraction_method: 'direct',
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'text/plain'
          },
          word_count: this.countWords(cleanedText),
          extracted_at: new Date().toISOString(),
          ...additionalMetadata
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Text file extraction failed:', error);
      
      return {
        text: '',
        language: 'en',
        metadata: {
          extraction_method: 'direct',
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'text/plain'
          },
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          extracted_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract text from images using OCR
   */
  private static async extractFromImage(filePath: string, fileSize: number): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImageForOCR(filePath);
      
      const worker = await this.initializeOCR();
      const { data: { text, confidence } } = await worker.recognize(processedImagePath);
      
      // Clean up processed image if it's different from original
      if (processedImagePath !== filePath) {
        fs.unlinkSync(processedImagePath);
      }

      const cleanedText = await this.cleanText(text.trim());
      const language = detectTextLanguage(cleanedText);
      const processingTime = Date.now() - startTime;
      const additionalMetadata = await this.extractDocumentMetadata(cleanedText);

      return {
        text: cleanedText,
        language,
        metadata: {
          extraction_method: 'ocr',
          confidence,
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'image'
          },
          ocr_applied: true,
          word_count: this.countWords(cleanedText),
          extracted_at: new Date().toISOString(),
          ...additionalMetadata
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Image OCR failed:', error);
      
      return {
        text: '',
        language: 'en',
        metadata: {
          extraction_method: 'ocr',
          processing_time_ms: processingTime,
          file_info: {
            size: fileSize,
            type: 'image'
          },
          ocr_applied: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          extracted_at: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract text from PDF using OCR
   */
  private static async extractPDFWithOCR(filePath: string): Promise<string> {
    const convert = pdf2pic.fromPath(filePath, {
      density: 300,           // High resolution for better OCR
      saveFilename: "page",
      savePath: "/tmp",
      format: "png",
      width: 2480,           // A4 width at 300 DPI
      height: 3508           // A4 height at 300 DPI
    });

    const worker = await this.initializeOCR();
    let allText = '';

    try {
      // Convert PDF pages to images
      const results = await convert.bulk(-1); // Convert all pages
      
      for (const result of results) {
        if (result.path) {
          try {
            // Preprocess image for better OCR
            const processedImagePath = await this.preprocessImageForOCR(result.path);
            
            const { data: { text } } = await worker.recognize(processedImagePath);
            allText += text + '\n\n';
            
            // Clean up
            if (processedImagePath !== result.path) {
              fs.unlinkSync(processedImagePath);
            }
            fs.unlinkSync(result.path);
          } catch (pageError) {
            console.error('OCR failed for page:', pageError);
            // Continue with other pages
          }
        }
      }

      return allText.trim();
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      throw error;
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private static async preprocessImageForOCR(imagePath: string): Promise<string> {
    try {
      const outputPath = `/tmp/preprocessed_${Date.now()}_${path.basename(imagePath)}`;
      
      await sharp(imagePath)
        .grayscale() // Convert to grayscale
        .normalize() // Normalize the image
        .sharpen() // Apply sharpening
        .png({ quality: 100 }) // High quality PNG
        .toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      // Return original path if preprocessing fails
      return imagePath;
    }
  }

  /**
   * Clean extracted text
   */
  private static async cleanText(text: string): Promise<string> {
    let cleaned = text;

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove control characters except newlines
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize line breaks
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');
    
    // Remove multiple consecutive newlines (keep max 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Clean Arabic-specific issues
    if (this.hasArabicText(cleaned)) {
      cleaned = await this.cleanArabicText(cleaned);
    }

    return cleaned.trim();
  }

  /**
   * Clean Arabic text specifically
   */
  private static async cleanArabicText(text: string): Promise<string> {
    let cleaned = text;

    // Remove Arabic diacritics (tashkeel) for better searching
    cleaned = cleaned.replace(/[\u064B-\u065F\u0670]/g, '');
    
    // Normalize Arabic characters
    // Replace different forms of alef
    cleaned = cleaned.replace(/[أإآ]/g, 'ا');
    
    // Replace taa marbouta with haa
    cleaned = cleaned.replace(/ة/g, 'ه');
    
    // Replace different forms of yaa
    cleaned = cleaned.replace(/ى/g, 'ي');

    // Fix common RTL/LTR mixing issues
    cleaned = this.fixBidirectionalText(cleaned);

    return cleaned;
  }

  /**
   * Check if extracted text appears to be garbled or contains mostly non-text characters
   */
  private static isTextGarbled(text: string): boolean {
    if (text.length < 10) return true;
    
    // Count readable characters vs total characters
    const readableChars = text.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s\d.,!?;:()[\]{}"'-]/g);
    const readableRatio = readableChars ? readableChars.length / text.length : 0;
    
    // If less than 60% of characters are readable, consider it garbled
    return readableRatio < 0.6;
  }

  /**
   * Extract metadata from document content
   */
  private static async extractDocumentMetadata(text: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    // Extract dates in various formats
    const datePatterns = [
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, // MM/DD/YYYY or DD-MM-YYYY
      /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g, // YYYY-MM-DD
      /\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4}/g, // Arabic dates
    ];

    const dates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }
    if (dates.length > 0) {
      metadata.extracted_dates = [...new Set(dates)];
    }

    // Extract email addresses
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails) {
      metadata.emails = [...new Set(emails)];
    }

    // Extract phone numbers (Saudi format)
    const phoneNumbers = text.match(/(\+966|0)?5\d{8}/g);
    if (phoneNumbers) {
      metadata.phone_numbers = [...new Set(phoneNumbers)];
    }

    // Detect document type based on keywords
    metadata.document_type = this.detectDocumentType(text);

    return metadata;
  }

  /**
   * Static helper methods
   */

  private static hasArabicText(text: string): boolean {
    return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
  }

  private static hasEnglishText(text: string): boolean {
    return /[a-zA-Z]/.test(text);
  }

  private static countWords(text: string): number {
    // Count both Arabic and English words
    const arabicWords = (text.match(/[\u0600-\u06FF]+/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return arabicWords + englishWords;
  }

  private static isLikelyWindows1256(buffer: Buffer): boolean {
    // Check for common Windows-1256 byte patterns
    let windows1256Count = 0;
    for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
      const byte = buffer[i];
      if (byte >= 0xC0 && byte <= 0xFF) {
        windows1256Count++;
      }
    }
    return windows1256Count > 10;
  }

  private static fixBidirectionalText(text: string): string {
    // Add RTL mark for Arabic text blocks
    const lines = text.split('\n');
    const fixedLines = lines.map(line => {
      if (this.hasArabicText(line) && !this.hasEnglishText(line)) {
        // Pure Arabic line - ensure RTL
        return '\u202B' + line + '\u202C'; // RTL embedding
      }
      return line;
    });
    return fixedLines.join('\n');
  }

  private static detectDocumentType(text: string): string {
    const typeKeywords = {
      'employment_contract': ['عقد عمل', 'employment contract', 'الموظف', 'الراتب'],
      'policy': ['سياسة', 'policy', 'الإجراءات', 'procedures'],
      'handbook': ['دليل', 'handbook', 'guide', 'الدليل'],
      'form': ['نموذج', 'form', 'استمارة', 'application'],
      'letter': ['خطاب', 'letter', 'رسالة', 'correspondence'],
      'report': ['تقرير', 'report', 'ملخص', 'summary']
    };

    const textLower = text.toLowerCase();
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          return type;
        }
      }
    }

    return 'general';
  }

  /**
   * Clean up OCR worker
   */
  static async terminate(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }

  /**
   * Check if OCR is available and working
   */
  static async healthCheck(): Promise<{
    available: boolean;
    languages: string[];
    error?: string;
  }> {
    try {
      const worker = await this.initializeOCR();
      
      // Test with a simple image
      const testImagePath = '/tmp/test-ocr.png';
      
      // Create a simple test image with Arabic and English text
      await sharp({
        create: {
          width: 400,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .png()
      .toFile(testImagePath);

      const { data } = await worker.recognize(testImagePath);
      
      // Clean up test image
      fs.unlinkSync(testImagePath);
      
      return {
        available: true,
        languages: ['ara', 'eng']
      };
    } catch (error) {
      return {
        available: false,
        languages: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}