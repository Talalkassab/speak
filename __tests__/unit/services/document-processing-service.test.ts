import { DocumentProcessorService } from '@/libs/document-processing/DocumentProcessorService';
import { TextExtractionService } from '@/libs/document-processing/TextExtractionService';
import { DocumentChunkingService } from '@/libs/document-processing/DocumentChunkingService';
import { SecurityValidationService } from '@/libs/document-processing/SecurityValidationService';
import { EmbeddingService } from '@/libs/services/embedding-service';

// Mock the dependencies
jest.mock('@/libs/document-processing/TextExtractionService');
jest.mock('@/libs/document-processing/DocumentChunkingService');
jest.mock('@/libs/document-processing/SecurityValidationService');
jest.mock('@/libs/services/embedding-service');

const MockedTextExtractionService = TextExtractionService as jest.MockedClass<typeof TextExtractionService>;
const MockedDocumentChunkingService = DocumentChunkingService as jest.MockedClass<typeof DocumentChunkingService>;
const MockedSecurityValidationService = SecurityValidationService as jest.MockedClass<typeof SecurityValidationService>;
const MockedEmbeddingService = EmbeddingService as jest.MockedClass<typeof EmbeddingService>;

describe('DocumentProcessorService', () => {
  let documentProcessor: DocumentProcessorService;
  let mockTextExtractor: jest.Mocked<TextExtractionService>;
  let mockChunkingService: jest.Mocked<DocumentChunkingService>;
  let mockSecurityValidator: jest.Mocked<SecurityValidationService>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  const mockPdfFile = new File(['fake pdf content'], 'test-document.pdf', {
    type: 'application/pdf',
  });

  const mockArabicDocxFile = new File(['محتوى وثيقة عربية'], 'وثيقة-عربية.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockTextExtractor = {
      extractFromPDF: jest.fn(),
      extractFromDOCX: jest.fn(),
      extractFromTXT: jest.fn(),
      extractText: jest.fn(),
      detectLanguage: jest.fn(),
      getDocumentMetadata: jest.fn(),
    } as any;

    mockChunkingService = {
      chunkDocument: jest.fn(),
      chunkText: jest.fn(),
      optimizeChunks: jest.fn(),
      getChunkMetadata: jest.fn(),
    } as any;

    mockSecurityValidator = {
      validateFile: jest.fn(),
      scanForMalware: jest.fn(),
      checkFileIntegrity: jest.fn(),
      validateContent: jest.fn(),
    } as any;

    mockEmbeddingService = {
      generateEmbeddings: jest.fn(),
      generateEmbedding: jest.fn(),
      batchGenerateEmbeddings: jest.fn(),
    } as any;

    // Mock constructors
    MockedTextExtractionService.mockImplementation(() => mockTextExtractor);
    MockedDocumentChunkingService.mockImplementation(() => mockChunkingService);
    MockedSecurityValidationService.mockImplementation(() => mockSecurityValidator);
    MockedEmbeddingService.mockImplementation(() => mockEmbeddingService);

    documentProcessor = new DocumentProcessorService();
  });

  describe('processDocument', () => {
    it('successfully processes a PDF document', async () => {
      const mockExtractedText = 'هذا نص مستخرج من ملف PDF باللغة العربية';
      const mockChunks = [
        {
          id: 'chunk-1',
          content: 'هذا نص مستخرج من ملف PDF',
          startIndex: 0,
          endIndex: 32,
          metadata: { page: 1, section: 'content' },
        },
        {
          id: 'chunk-2',
          content: 'باللغة العربية',
          startIndex: 33,
          endIndex: 47,
          metadata: { page: 1, section: 'content' },
        },
      ];

      const mockEmbeddings = [
        { chunkId: 'chunk-1', embedding: [0.1, 0.2, 0.3], dimension: 3 },
        { chunkId: 'chunk-2', embedding: [0.4, 0.5, 0.6], dimension: 3 },
      ];

      // Set up mocks
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      mockTextExtractor.extractFromPDF.mockResolvedValue({
        text: mockExtractedText,
        metadata: {
          pages: 1,
          wordCount: 8,
          language: 'ar',
          extractionTime: 1200,
          confidence: 0.95,
        },
      });

      mockTextExtractor.detectLanguage.mockReturnValue('ar');

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: mockChunks,
        totalChunks: 2,
        avgChunkSize: 20,
        metadata: {
          chunkingStrategy: 'semantic',
          overlapSize: 0,
        },
      });

      mockEmbeddingService.batchGenerateEmbeddings.mockResolvedValue(mockEmbeddings);

      const result = await documentProcessor.processDocument({
        file: mockPdfFile,
        organizationId: 'org-123',
        userId: 'user-456',
        options: {
          language: 'ar',
          chunkingStrategy: 'semantic',
          generateEmbeddings: true,
        },
      });

      expect(result).toEqual({
        documentId: expect.any(String),
        filename: 'test-document.pdf',
        extractedText: mockExtractedText,
        language: 'ar',
        chunks: mockChunks,
        embeddings: mockEmbeddings,
        metadata: {
          pages: 1,
          wordCount: 8,
          processingTime: expect.any(Number),
          chunkCount: 2,
          fileSize: mockPdfFile.size,
          mimeType: mockPdfFile.type,
        },
        status: 'completed',
        organizationId: 'org-123',
        userId: 'user-456',
      });

      // Verify all services were called correctly
      expect(mockSecurityValidator.validateFile).toHaveBeenCalledWith(mockPdfFile);
      expect(mockTextExtractor.extractFromPDF).toHaveBeenCalledWith(mockPdfFile);
      expect(mockChunkingService.chunkDocument).toHaveBeenCalledWith({
        text: mockExtractedText,
        language: 'ar',
        strategy: 'semantic',
        metadata: expect.any(Object),
      });
      expect(mockEmbeddingService.batchGenerateEmbeddings).toHaveBeenCalledWith(
        mockChunks.map(chunk => chunk.content)
      );
    });

    it('successfully processes an Arabic DOCX document', async () => {
      const mockExtractedText = 'وثيقة باللغة العربية تحتوي على معلومات مهمة';
      const mockChunks = [
        {
          id: 'chunk-1',
          content: mockExtractedText,
          startIndex: 0,
          endIndex: mockExtractedText.length,
          metadata: { section: 'document' },
        },
      ];

      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockArabicDocxFile.size,
        mimeType: mockArabicDocxFile.type,
      });

      mockTextExtractor.extractFromDOCX.mockResolvedValue({
        text: mockExtractedText,
        metadata: {
          pages: 1,
          wordCount: 7,
          language: 'ar',
          extractionTime: 800,
          confidence: 0.98,
        },
      });

      mockTextExtractor.detectLanguage.mockReturnValue('ar');

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: mockChunks,
        totalChunks: 1,
        avgChunkSize: mockExtractedText.length,
        metadata: {
          chunkingStrategy: 'paragraph',
          overlapSize: 0,
        },
      });

      mockEmbeddingService.batchGenerateEmbeddings.mockResolvedValue([
        { chunkId: 'chunk-1', embedding: [0.1, 0.2, 0.3], dimension: 3 },
      ]);

      const result = await documentProcessor.processDocument({
        file: mockArabicDocxFile,
        organizationId: 'org-123',
        userId: 'user-456',
        options: {
          language: 'ar',
          chunkingStrategy: 'paragraph',
          generateEmbeddings: true,
        },
      });

      expect(result.filename).toBe('وثيقة-عربية.docx');
      expect(result.language).toBe('ar');
      expect(result.extractedText).toBe(mockExtractedText);
      expect(mockTextExtractor.extractFromDOCX).toHaveBeenCalledWith(mockArabicDocxFile);
    });

    it('handles security validation failures', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: false,
        issues: ['Suspicious file structure', 'Potential malware detected'],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      await expect(
        documentProcessor.processDocument({
          file: mockPdfFile,
          organizationId: 'org-123',
          userId: 'user-456',
        })
      ).rejects.toThrow('Document validation failed: Suspicious file structure, Potential malware detected');

      expect(mockTextExtractor.extractFromPDF).not.toHaveBeenCalled();
    });

    it('handles text extraction failures', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      mockTextExtractor.extractFromPDF.mockRejectedValue(
        new Error('Failed to extract text: Corrupted PDF structure')
      );

      await expect(
        documentProcessor.processDocument({
          file: mockPdfFile,
          organizationId: 'org-123',
          userId: 'user-456',
        })
      ).rejects.toThrow('Text extraction failed: Failed to extract text: Corrupted PDF structure');
    });

    it('handles chunking service failures', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      mockTextExtractor.extractFromPDF.mockResolvedValue({
        text: 'Valid extracted text',
        metadata: {
          pages: 1,
          wordCount: 3,
          language: 'en',
          extractionTime: 500,
          confidence: 0.9,
        },
      });

      mockChunkingService.chunkDocument.mockRejectedValue(
        new Error('Chunking failed: Invalid text format')
      );

      await expect(
        documentProcessor.processDocument({
          file: mockPdfFile,
          organizationId: 'org-123',
          userId: 'user-456',
        })
      ).rejects.toThrow('Document chunking failed: Chunking failed: Invalid text format');
    });

    it('handles embedding generation failures gracefully', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      mockTextExtractor.extractFromPDF.mockResolvedValue({
        text: 'Test content',
        metadata: {
          pages: 1,
          wordCount: 2,
          language: 'en',
          extractionTime: 300,
          confidence: 0.85,
        },
      });

      mockTextExtractor.detectLanguage.mockReturnValue('en');

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: [
          {
            id: 'chunk-1',
            content: 'Test content',
            startIndex: 0,
            endIndex: 12,
            metadata: { section: 'content' },
          },
        ],
        totalChunks: 1,
        avgChunkSize: 12,
        metadata: {
          chunkingStrategy: 'sentence',
          overlapSize: 0,
        },
      });

      mockEmbeddingService.batchGenerateEmbeddings.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await documentProcessor.processDocument({
        file: mockPdfFile,
        organizationId: 'org-123',
        userId: 'user-456',
        options: {
          generateEmbeddings: true,
          continueOnEmbeddingFailure: true,
        },
      });

      expect(result.status).toBe('completed_with_warnings');
      expect(result.embeddings).toBeUndefined();
      expect(result.metadata).toHaveProperty('embeddingError', 'OpenAI API error');
    });

    it('processes documents without generating embeddings', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      mockTextExtractor.extractFromPDF.mockResolvedValue({
        text: 'Simple text content',
        metadata: {
          pages: 1,
          wordCount: 3,
          language: 'en',
          extractionTime: 200,
          confidence: 0.9,
        },
      });

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: [
          {
            id: 'chunk-1',
            content: 'Simple text content',
            startIndex: 0,
            endIndex: 19,
            metadata: { section: 'content' },
          },
        ],
        totalChunks: 1,
        avgChunkSize: 19,
        metadata: {
          chunkingStrategy: 'sentence',
          overlapSize: 0,
        },
      });

      const result = await documentProcessor.processDocument({
        file: mockPdfFile,
        organizationId: 'org-123',
        userId: 'user-456',
        options: {
          generateEmbeddings: false,
        },
      });

      expect(result.embeddings).toBeUndefined();
      expect(mockEmbeddingService.batchGenerateEmbeddings).not.toHaveBeenCalled();
    });

    it('handles unsupported file types', async () => {
      const unsupportedFile = new File(['content'], 'test.xyz', {
        type: 'application/unknown',
      });

      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: unsupportedFile.size,
        mimeType: unsupportedFile.type,
      });

      await expect(
        documentProcessor.processDocument({
          file: unsupportedFile,
          organizationId: 'org-123',
          userId: 'user-456',
        })
      ).rejects.toThrow('Unsupported file type: application/unknown');
    });

    it('detects language automatically when not specified', async () => {
      mockSecurityValidator.validateFile.mockResolvedValue({
        isValid: true,
        issues: [],
        fileSize: mockPdfFile.size,
        mimeType: mockPdfFile.type,
      });

      const arabicText = 'هذا نص باللغة العربية';
      mockTextExtractor.extractFromPDF.mockResolvedValue({
        text: arabicText,
        metadata: {
          pages: 1,
          wordCount: 4,
          language: undefined, // No language detected by extractor
          extractionTime: 400,
          confidence: 0.88,
        },
      });

      mockTextExtractor.detectLanguage.mockReturnValue('ar');

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: [
          {
            id: 'chunk-1',
            content: arabicText,
            startIndex: 0,
            endIndex: arabicText.length,
            metadata: { section: 'content' },
          },
        ],
        totalChunks: 1,
        avgChunkSize: arabicText.length,
        metadata: {
          chunkingStrategy: 'sentence',
          overlapSize: 0,
        },
      });

      const result = await documentProcessor.processDocument({
        file: mockPdfFile,
        organizationId: 'org-123',
        userId: 'user-456',
        // No language specified in options
      });

      expect(result.language).toBe('ar');
      expect(mockTextExtractor.detectLanguage).toHaveBeenCalledWith(arabicText);
    });
  });

  describe('reprocessDocument', () => {
    it('reprocesses an existing document with new options', async () => {
      const documentId = 'doc-123';
      const existingText = 'Previously extracted text content';

      const newChunks = [
        {
          id: 'new-chunk-1',
          content: 'Previously extracted text',
          startIndex: 0,
          endIndex: 24,
          metadata: { section: 'content' },
        },
        {
          id: 'new-chunk-2',
          content: 'content',
          startIndex: 25,
          endIndex: 32,
          metadata: { section: 'content' },
        },
      ];

      // Mock getting existing document data
      jest.spyOn(documentProcessor, 'getDocumentText').mockResolvedValue(existingText);

      mockChunkingService.chunkDocument.mockResolvedValue({
        chunks: newChunks,
        totalChunks: 2,
        avgChunkSize: 16,
        metadata: {
          chunkingStrategy: 'semantic',
          overlapSize: 5,
        },
      });

      mockEmbeddingService.batchGenerateEmbeddings.mockResolvedValue([
        { chunkId: 'new-chunk-1', embedding: [0.1, 0.2], dimension: 2 },
        { chunkId: 'new-chunk-2', embedding: [0.3, 0.4], dimension: 2 },
      ]);

      const result = await documentProcessor.reprocessDocument(documentId, {
        chunkingStrategy: 'semantic',
        chunkOverlap: 5,
        generateEmbeddings: true,
      });

      expect(result.chunks).toEqual(newChunks);
      expect(result.embeddings).toHaveLength(2);
      expect(result.status).toBe('reprocessed');
    });
  });
});