import { detectTextLanguage } from '@/types/documents';

export interface DocumentChunk {
  id?: string;
  document_id: string;
  organization_id: string;
  content: string;
  chunk_index: number;
  content_length: number;
  embedding?: number[] | null;
  embedding_model: string;
  language: 'ar' | 'en' | 'mixed';
  metadata: {
    chunk_type: 'paragraph' | 'heading' | 'list' | 'table' | 'caption';
    section_title?: string;
    page_number?: number;
    document_name: string;
    confidence_score?: number;
    contains_arabic: boolean;
    contains_english: boolean;
    word_count: number;
    character_count: number;
    created_at: string;
  };
}

export interface ChunkingConfig {
  maxChunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  separators: string[];
  preserveFormatting: boolean;
  respectSentenceBoundaries: boolean;
}

export interface ChunkingRequest {
  text: string;
  language: 'ar' | 'en' | 'mixed';
  documentId: string;
  organizationId: string;
  documentName: string;
  metadata?: Record<string, any>;
  config?: Partial<ChunkingConfig>;
}

export class DocumentChunkingService {
  
  // Default configurations for different languages
  private static readonly DEFAULT_CONFIGS: Record<'ar' | 'en' | 'mixed', ChunkingConfig> = {
    ar: {
      maxChunkSize: 800,        // Smaller for Arabic due to density
      chunkOverlap: 80,         // 10% overlap
      minChunkSize: 100,        // Minimum viable chunk
      separators: ['\n\n', '\n', '。', '！', '؟', '.', '!', '?', '؛', ';', '،', ','],
      preserveFormatting: true,
      respectSentenceBoundaries: true
    },
    en: {
      maxChunkSize: 1000,       // Standard size for English
      chunkOverlap: 100,        // 10% overlap
      minChunkSize: 150,
      separators: ['\n\n', '\n', '.', '!', '?', ';', ','],
      preserveFormatting: true,
      respectSentenceBoundaries: true
    },
    mixed: {
      maxChunkSize: 900,        // Balance between Arabic and English
      chunkOverlap: 90,
      minChunkSize: 120,
      separators: ['\n\n', '\n', '。', '！', '؟', '.', '!', '?', '؛', ';', '،', ','],
      preserveFormatting: true,
      respectSentenceBoundaries: true
    }
  };

  /**
   * Chunk a document's text into semantically meaningful segments
   */
  static async chunkDocument(request: ChunkingRequest): Promise<DocumentChunk[]> {
    const { text, language, documentId, organizationId, documentName, metadata = {}, config = {} } = request;
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for chunking');
    }

    // Get configuration for the detected language
    const chunkingConfig = {
      ...this.DEFAULT_CONFIGS[language],
      ...config
    };

    console.log(`Chunking document with language: ${language}, config:`, chunkingConfig);

    // Pre-process the text
    const preprocessedText = this.preprocessText(text, language);
    
    // Split text into logical sections first
    const sections = this.identifyDocumentSections(preprocessedText, language);
    
    const chunks: DocumentChunk[] = [];
    let globalChunkIndex = 0;

    // Process each section
    for (const section of sections) {
      const sectionChunks = await this.chunkTextContent(
        section.content,
        language,
        chunkingConfig,
        {
          documentId,
          organizationId,
          documentName,
          sectionTitle: section.title,
          sectionType: section.type,
          startIndex: globalChunkIndex,
          metadata
        }
      );

      // Update chunk indices
      sectionChunks.forEach((chunk, index) => {
        chunk.chunk_index = globalChunkIndex + index;
      });

      chunks.push(...sectionChunks);
      globalChunkIndex += sectionChunks.length;
    }

    // Post-process chunks to ensure quality
    const optimizedChunks = this.optimizeChunks(chunks, chunkingConfig);
    
    console.log(`Generated ${optimizedChunks.length} chunks from document ${documentId}`);
    
    return optimizedChunks;
  }

  /**
   * Preprocess text to normalize and clean it for chunking
   */
  private static preprocessText(text: string, language: 'ar' | 'en' | 'mixed'): string {
    let processed = text;

    // Normalize whitespace
    processed = processed.replace(/\r\n/g, '\n');
    processed = processed.replace(/\r/g, '\n');
    processed = processed.replace(/\t/g, ' ');

    // Remove excessive whitespace but preserve paragraph breaks
    processed = processed.replace(/ +/g, ' ');
    processed = processed.replace(/\n +/g, '\n');
    processed = processed.replace(/ +\n/g, '\n');

    // Normalize multiple newlines
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // Language-specific preprocessing
    if (language === 'ar' || language === 'mixed') {
      processed = this.preprocessArabicText(processed);
    }

    // Fix common OCR issues
    processed = this.fixCommonOCRErrors(processed);

    return processed.trim();
  }

  /**
   * Preprocess Arabic text specifically
   */
  private static preprocessArabicText(text: string): string {
    let processed = text;

    // Fix Arabic punctuation spacing
    processed = processed.replace(/\s*([؟؛،])\s*/g, '$1 ');
    processed = processed.replace(/\s*([.])\s*/g, '$1 ');

    // Fix Arabic quotation marks
    processed = processed.replace(/[""]/g, '"');
    processed = processed.replace(/['']/g, "'");

    // Normalize Arabic numerals vs English numerals
    const arabicNumerals = '٠١٢٣٤٥٦٧٨٩';
    const englishNumerals = '0123456789';
    
    // Convert Arabic numerals to English for consistency
    for (let i = 0; i < arabicNumerals.length; i++) {
      const arabicNum = arabicNumerals[i];
      const englishNum = englishNumerals[i];
      processed = processed.replace(new RegExp(arabicNum, 'g'), englishNum);
    }

    // Fix common Arabic text direction issues
    processed = this.fixArabicTextDirection(processed);

    return processed;
  }

  /**
   * Fix common OCR errors
   */
  private static fixCommonOCRErrors(text: string): string {
    let processed = text;

    // Common OCR substitutions
    const ocrFixes = [
      // English
      [/l(?=\d)/g, '1'],           // letter l before numbers
      [/O(?=\d)/g, '0'],           // letter O before numbers  
      [/rn/g, 'm'],                // rn -> m
      [/vv/g, 'w'],                // vv -> w
      
      // Arabic common OCR errors
      [/ر‌ن/g, 'رن'],              // Remove unnecessary zero-width non-joiner
      [/ل‌ا/g, 'لا'],              // Fix lam-alif
      [/ه‌/g, 'ه'],                // Remove unnecessary ZWNJ after heh
    ];

    for (const [pattern, replacement] of ocrFixes) {
      processed = processed.replace(pattern, replacement as string);
    }

    return processed;
  }

  /**
   * Fix Arabic text direction issues
   */
  private static fixArabicTextDirection(text: string): string {
    const lines = text.split('\n');
    
    return lines.map(line => {
      // If line contains mostly Arabic, ensure RTL context
      const arabicChars = (line.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = line.replace(/\s/g, '').length;
      
      if (arabicChars > totalChars * 0.6) {
        // Add RTL mark if not already present
        if (!line.includes('\u202B') && !line.includes('\u202E')) {
          return '\u202B' + line + '\u202C'; // RTL embedding
        }
      }
      
      return line;
    }).join('\n');
  }

  /**
   * Identify different sections in the document
   */
  private static identifyDocumentSections(text: string, language: 'ar' | 'en' | 'mixed'): Array<{
    title?: string;
    content: string;
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'caption';
  }> {
    const sections = [];
    const lines = text.split('\n');
    
    let currentSection = {
      title: undefined as string | undefined,
      content: '',
      type: 'paragraph' as const
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        if (currentSection.content.trim()) {
          currentSection.content += '\n';
        }
        continue;
      }

      // Detect headings
      if (this.isHeading(line, language)) {
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        
        // Start new section with this heading
        currentSection = {
          title: line,
          content: '',
          type: 'heading'
        };
      }
      // Detect lists
      else if (this.isListItem(line, language)) {
        if (currentSection.type !== 'list') {
          // Save previous section if it has content
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          
          currentSection = {
            title: currentSection.title,
            content: line + '\n',
            type: 'list'
          };
        } else {
          currentSection.content += line + '\n';
        }
      }
      // Detect tables (basic detection)
      else if (this.isTableRow(line)) {
        if (currentSection.type !== 'table') {
          // Save previous section if it has content
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          
          currentSection = {
            title: currentSection.title,
            content: line + '\n',
            type: 'table'
          };
        } else {
          currentSection.content += line + '\n';
        }
      }
      // Regular paragraph content
      else {
        if (currentSection.type === 'heading') {
          currentSection.type = 'paragraph';
        }
        currentSection.content += line + '\n';
      }
    }

    // Add the last section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if a line is likely a heading
   */
  private static isHeading(line: string, language: 'ar' | 'en' | 'mixed'): boolean {
    // Common heading patterns
    const headingPatterns = [
      /^#{1,6}\s+/,                    // Markdown headings
      /^\d+\.\s+/,                     // Numbered headings
      /^[أ-ي]+\.\s+/,                  // Arabic numbered headings
      /^[A-Z][A-Z\s]{2,}$/,            // ALL CAPS
      /^[أ-ي\s]{3,}$/,                 // Arabic caps equivalent
    ];

    // Check patterns
    for (const pattern of headingPatterns) {
      if (pattern.test(line)) return true;
    }

    // Check if line is short and likely a title
    if (line.length < 100 && line.length > 5) {
      // Check for title-like characteristics
      const hasColon = line.includes(':') || line.includes('：');
      const isShort = line.length < 50;
      const hasCapitalization = /^[A-Z]/.test(line) || /^[أ-ي]/.test(line);
      
      if ((hasColon || isShort) && hasCapitalization) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a line is a list item
   */
  private static isListItem(line: string, language: 'ar' | 'en' | 'mixed'): boolean {
    const listPatterns = [
      /^[-•·*]\s+/,                    // Bullet points
      /^\d+[\.\)]\s+/,                 // Numbered lists
      /^[أ-ي]+[\.\)]\s+/,              // Arabic numbered lists
      /^[a-zA-Z][\.\)]\s+/,            // Letter lists
    ];

    return listPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if a line is part of a table
   */
  private static isTableRow(line: string): boolean {
    // Basic table detection - contains multiple separators
    const separatorCount = (line.match(/[|\t]/g) || []).length;
    return separatorCount >= 2;
  }

  /**
   * Chunk text content using the specified configuration
   */
  private static async chunkTextContent(
    text: string,
    language: 'ar' | 'en' | 'mixed',
    config: ChunkingConfig,
    context: {
      documentId: string;
      organizationId: string;
      documentName: string;
      sectionTitle?: string;
      sectionType: string;
      startIndex: number;
      metadata: Record<string, any>;
    }
  ): Promise<DocumentChunk[]> {
    
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;
    
    // Split text using separators
    const segments = this.splitTextBySeparators(text, config.separators);
    
    let currentChunk = '';
    let currentChunkStart = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + segment;
      
      // Check if adding this segment would exceed max size
      if (potentialChunk.length > config.maxChunkSize && currentChunk.length > config.minChunkSize) {
        // Create chunk from current content
        const chunk = this.createChunk(
          currentChunk,
          chunkIndex,
          language,
          context
        );
        
        chunks.push(chunk);
        chunkIndex++;
        
        // Start new chunk with overlap
        if (config.chunkOverlap > 0 && currentChunk.length > config.chunkOverlap) {
          const overlapText = this.extractOverlapText(currentChunk, config.chunkOverlap);
          currentChunk = overlapText + ' ' + segment;
        } else {
          currentChunk = segment;
        }
        
        currentChunkStart = i;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add remaining content as final chunk
    if (currentChunk.length >= config.minChunkSize) {
      const chunk = this.createChunk(
        currentChunk,
        chunkIndex,
        language,
        context
      );
      chunks.push(chunk);
    } else if (chunks.length > 0) {
      // If remaining content is too small, append to last chunk
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += ' ' + currentChunk;
      lastChunk.content_length = lastChunk.content.length;
      lastChunk.metadata.word_count = this.countWords(lastChunk.content);
      lastChunk.metadata.character_count = lastChunk.content.length;
    }

    return chunks;
  }

  /**
   * Split text by separators while preserving context
   */
  private static splitTextBySeparators(text: string, separators: string[]): string[] {
    let segments = [text];
    
    for (const separator of separators) {
      const newSegments: string[] = [];
      
      for (const segment of segments) {
        const parts = segment.split(separator);
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            // Add separator back to maintain meaning
            if (separator === '\n' || separator === '\n\n') {
              // Don't add newlines back as separators
            } else {
              newSegments.push(separator);
            }
          }
          if (parts[i].trim()) {
            newSegments.push(parts[i].trim());
          }
        }
      }
      
      segments = newSegments.filter(s => s.length > 0);
    }
    
    return segments;
  }

  /**
   * Extract overlap text from the end of current chunk
   */
  private static extractOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }
    
    const endText = text.slice(-overlapSize);
    
    // Try to find a sentence boundary to make clean overlap
    const sentenceBoundaries = ['.', '!', '?', '؟', '؛'];
    
    for (const boundary of sentenceBoundaries) {
      const boundaryIndex = endText.lastIndexOf(boundary);
      if (boundaryIndex > overlapSize * 0.5) {
        return endText.slice(boundaryIndex + 1).trim();
      }
    }
    
    // If no sentence boundary found, use word boundary
    const words = endText.trim().split(/\s+/);
    return words.slice(-Math.min(words.length, 10)).join(' ');
  }

  /**
   * Create a document chunk object
   */
  private static createChunk(
    content: string,
    chunkIndex: number,
    language: 'ar' | 'en' | 'mixed',
    context: {
      documentId: string;
      organizationId: string;
      documentName: string;
      sectionTitle?: string;
      sectionType: string;
      startIndex: number;
      metadata: Record<string, any>;
    }
  ): DocumentChunk {
    
    const cleanContent = content.trim();
    const hasArabic = /[\u0600-\u06FF]/.test(cleanContent);
    const hasEnglish = /[a-zA-Z]/.test(cleanContent);
    
    // Detect chunk-specific language
    const chunkLanguage = detectTextLanguage(cleanContent);
    
    return {
      document_id: context.documentId,
      organization_id: context.organizationId,
      content: cleanContent,
      chunk_index: context.startIndex + chunkIndex,
      content_length: cleanContent.length,
      embedding_model: 'text-embedding-ada-002', // Will be set by embedding service
      language: chunkLanguage,
      metadata: {
        chunk_type: context.sectionType as any,
        section_title: context.sectionTitle,
        document_name: context.documentName,
        contains_arabic: hasArabic,
        contains_english: hasEnglish,
        word_count: this.countWords(cleanContent),
        character_count: cleanContent.length,
        created_at: new Date().toISOString(),
        ...context.metadata
      }
    };
  }

  /**
   * Count words in text (supports both Arabic and English)
   */
  private static countWords(text: string): number {
    // Arabic words
    const arabicWords = (text.match(/[\u0600-\u06FF]+/g) || []).length;
    
    // English words
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    
    return arabicWords + englishWords;
  }

  /**
   * Optimize chunks by merging small chunks and splitting large ones
   */
  private static optimizeChunks(chunks: DocumentChunk[], config: ChunkingConfig): DocumentChunk[] {
    const optimized: DocumentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // If chunk is too small and we have a next chunk, try to merge
      if (chunk.content_length < config.minChunkSize && i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const mergedContent = chunk.content + ' ' + nextChunk.content;
        
        if (mergedContent.length <= config.maxChunkSize) {
          // Merge chunks
          const mergedChunk: DocumentChunk = {
            ...chunk,
            content: mergedContent,
            content_length: mergedContent.length,
            metadata: {
              ...chunk.metadata,
              word_count: this.countWords(mergedContent),
              character_count: mergedContent.length,
              merged_with_next: true
            }
          };
          
          optimized.push(mergedChunk);
          i++; // Skip next chunk as it's been merged
          continue;
        }
      }
      
      // If chunk is too large, split it
      if (chunk.content_length > config.maxChunkSize) {
        const subChunks = this.splitLargeChunk(chunk, config);
        optimized.push(...subChunks);
      } else {
        optimized.push(chunk);
      }
    }
    
    // Re-index all chunks
    optimized.forEach((chunk, index) => {
      chunk.chunk_index = index;
    });
    
    return optimized;
  }

  /**
   * Split a large chunk into smaller pieces
   */
  private static splitLargeChunk(chunk: DocumentChunk, config: ChunkingConfig): DocumentChunk[] {
    const subChunks: DocumentChunk[] = [];
    const sentences = chunk.content.split(/[.!?؟؛]/).filter(s => s.trim());
    
    let currentContent = '';
    let subChunkIndex = 0;
    
    for (const sentence of sentences) {
      const potentialContent = currentContent + (currentContent ? '. ' : '') + sentence.trim();
      
      if (potentialContent.length > config.maxChunkSize && currentContent.length > 0) {
        // Create sub-chunk
        const subChunk: DocumentChunk = {
          ...chunk,
          content: currentContent + '.',
          content_length: currentContent.length + 1,
          chunk_index: chunk.chunk_index + subChunkIndex,
          metadata: {
            ...chunk.metadata,
            word_count: this.countWords(currentContent),
            character_count: currentContent.length + 1,
            sub_chunk_of: chunk.chunk_index,
            sub_chunk_index: subChunkIndex
          }
        };
        
        subChunks.push(subChunk);
        subChunkIndex++;
        currentContent = sentence.trim();
      } else {
        currentContent = potentialContent;
      }
    }
    
    // Add remaining content
    if (currentContent.trim()) {
      const subChunk: DocumentChunk = {
        ...chunk,
        content: currentContent,
        content_length: currentContent.length,
        chunk_index: chunk.chunk_index + subChunkIndex,
        metadata: {
          ...chunk.metadata,
          word_count: this.countWords(currentContent),
          character_count: currentContent.length,
          sub_chunk_of: chunk.chunk_index,
          sub_chunk_index: subChunkIndex
        }
      };
      
      subChunks.push(subChunk);
    }
    
    return subChunks;
  }

  /**
   * Get optimal chunking configuration for specific document type
   */
  static getConfigForDocumentType(
    language: 'ar' | 'en' | 'mixed',
    documentType: string
  ): ChunkingConfig {
    const baseConfig = this.DEFAULT_CONFIGS[language];
    
    // Adjust configuration based on document type
    switch (documentType) {
      case 'legal':
      case 'contract':
        return {
          ...baseConfig,
          maxChunkSize: baseConfig.maxChunkSize * 1.2, // Legal docs need larger context
          respectSentenceBoundaries: true,
          preserveFormatting: true
        };
      
      case 'policy':
      case 'handbook':
        return {
          ...baseConfig,
          maxChunkSize: baseConfig.maxChunkSize * 0.9, // Policies benefit from smaller chunks
          chunkOverlap: baseConfig.chunkOverlap * 1.2
        };
      
      case 'form':
        return {
          ...baseConfig,
          maxChunkSize: 500, // Forms are usually short and structured
          minChunkSize: 50,
          preserveFormatting: true
        };
      
      default:
        return baseConfig;
    }
  }
}