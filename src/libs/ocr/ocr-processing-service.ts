import { createWorker, PSM, OEM } from 'tesseract.js';
import sharp from 'sharp';
import { Logger } from 'winston';
import { structuredLogger } from '../logging/structured-logger';

export interface OCREngine {
  name: string;
  process(buffer: Buffer, options?: OCROptions): Promise<OCRResult>;
  isAvailable(): Promise<boolean>;
}

export interface OCROptions {
  language?: string;
  pageSegMode?: PSM;
  ocrEngineMode?: OEM;
  confidence?: number;
  preserveLayout?: boolean;
  enhanceImage?: boolean;
  dpi?: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  lines: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    words: Array<{
      text: string;
      confidence: number;
      bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      };
    }>;
  }>;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    lines: Array<{
      text: string;
      confidence: number;
      bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      };
    }>;
  }>;
  metadata: {
    engineUsed: string;
    processingTime: number;
    imageMetadata: {
      width: number;
      height: number;
      format: string;
      dpi?: number;
    };
    detectedLanguages: Array<{
      language: string;
      confidence: number;
    }>;
  };
}

export interface BatchOCRResult {
  results: Array<{
    documentId: string;
    result: OCRResult;
    status: 'success' | 'failed' | 'low_confidence';
    error?: string;
  }>;
  summary: {
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
    averageConfidence: number;
    totalProcessingTime: number;
  };
}

export class TesseractOCREngine implements OCREngine {
  name = 'Tesseract';
  private logger: Logger;

  constructor() {
    this.logger = structuredLogger;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test if Tesseract is available by creating a minimal worker
      const worker = await createWorker('ara+eng');
      await worker.terminate();
      return true;
    } catch (error) {
      this.logger.warn('Tesseract OCR engine not available', { error: error.message });
      return false;
    }
  }

  async process(buffer: Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Default options optimized for Arabic text
      const defaultOptions: OCROptions = {
        language: 'ara+eng',
        pageSegMode: PSM.AUTO_OSD,
        ocrEngineMode: OEM.LSTM_ONLY,
        confidence: 0.7,
        preserveLayout: true,
        enhanceImage: true,
        dpi: 300
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Pre-process image for better OCR results
      let processedBuffer = buffer;
      if (finalOptions.enhanceImage) {
        processedBuffer = await this.enhanceImageForOCR(buffer, finalOptions);
      }

      // Initialize Tesseract worker
      const worker = await createWorker(finalOptions.language);
      
      await worker.setParameters({
        tessedit_pageseg_mode: finalOptions.pageSegMode,
        tessedit_ocr_engine_mode: finalOptions.ocrEngineMode,
        tessedit_char_whitelist: '',
        preserve_interword_spaces: finalOptions.preserveLayout ? '1' : '0',
      });

      // Perform OCR
      const { data } = await worker.recognize(processedBuffer);
      
      // Get image metadata
      const imageMetadata = await sharp(buffer).metadata();
      
      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence / 100,
        words: data.words?.map(word => ({
          text: word.text,
          confidence: word.confidence / 100,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1
          }
        })) || [],
        lines: data.lines?.map(line => ({
          text: line.text,
          confidence: line.confidence / 100,
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1
          },
          words: line.words?.map(word => ({
            text: word.text,
            confidence: word.confidence / 100,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1
            }
          })) || []
        })) || [],
        blocks: data.blocks?.map(block => ({
          text: block.text,
          confidence: block.confidence / 100,
          bbox: {
            x0: block.bbox.x0,
            y0: block.bbox.y0,
            x1: block.bbox.x1,
            y1: block.bbox.y1
          },
          lines: block.lines?.map(line => ({
            text: line.text,
            confidence: line.confidence / 100,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1
            }
          })) || []
        })) || [],
        metadata: {
          engineUsed: this.name,
          processingTime: Date.now() - startTime,
          imageMetadata: {
            width: imageMetadata.width || 0,
            height: imageMetadata.height || 0,
            format: imageMetadata.format || 'unknown',
            dpi: imageMetadata.density
          },
          detectedLanguages: [
            { language: 'ara', confidence: 0.8 },
            { language: 'eng', confidence: 0.6 }
          ]
        }
      };

      await worker.terminate();
      
      this.logger.info('Tesseract OCR processing completed', {
        confidence: result.confidence,
        processingTime: result.metadata.processingTime,
        textLength: result.text.length
      });

      return result;

    } catch (error) {
      this.logger.error('Tesseract OCR processing failed', {
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
  }

  private async enhanceImageForOCR(buffer: Buffer, options: OCROptions): Promise<Buffer> {
    try {
      let processor = sharp(buffer);

      // Resize if image is too small or too large
      const metadata = await processor.metadata();
      const { width, height } = metadata;

      if (width && height) {
        if (width < 1000 || height < 1000) {
          // Upscale small images
          processor = processor.resize(Math.max(width * 2, 1500), Math.max(height * 2, 1500), {
            kernel: sharp.kernel.lanczos3,
            fit: 'inside',
            withoutEnlargement: false
          });
        } else if (width > 4000 || height > 4000) {
          // Downscale very large images
          processor = processor.resize(3000, 3000, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }

      // Enhance image for better OCR
      processor = processor
        .greyscale()
        .normalize()
        .sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10 })
        .gamma(1.2)
        .linear(1.2, -(128 * 1.2) + 128);

      // Set DPI if specified
      if (options.dpi) {
        processor = processor.withMetadata({ density: options.dpi });
      }

      return await processor.png().toBuffer();
    } catch (error) {
      this.logger.warn('Image enhancement failed, using original', { error: error.message });
      return buffer;
    }
  }
}

export class AzureOCREngine implements OCREngine {
  name = 'Azure Cognitive Services';
  private logger: Logger;
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.logger = structuredLogger;
    this.endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT || '';
    this.apiKey = process.env.AZURE_COMPUTER_VISION_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.endpoint && this.apiKey);
  }

  async process(buffer: Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();

    if (!await this.isAvailable()) {
      throw new Error('Azure OCR engine not configured');
    }

    try {
      // Use Azure Computer Vision Read API for better Arabic support
      const response = await fetch(`${this.endpoint}/vision/v3.2/read/analyze`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: buffer
      });

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
      }

      const operationLocation = response.headers.get('Operation-Location');
      if (!operationLocation) {
        throw new Error('Azure API did not return operation location');
      }

      // Poll for results
      let resultData;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const resultResponse = await fetch(operationLocation, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });

        if (!resultResponse.ok) {
          throw new Error(`Azure result API error: ${resultResponse.status}`);
        }

        resultData = await resultResponse.json();
        
        if (resultData.status === 'succeeded') {
          break;
        } else if (resultData.status === 'failed') {
          throw new Error('Azure OCR processing failed');
        }

        attempts++;
      }

      if (!resultData || resultData.status !== 'succeeded') {
        throw new Error('Azure OCR processing timeout or failed');
      }

      // Convert Azure results to our format
      const result = await this.convertAzureResults(resultData, buffer, startTime);
      
      this.logger.info('Azure OCR processing completed', {
        confidence: result.confidence,
        processingTime: result.metadata.processingTime,
        textLength: result.text.length
      });

      return result;

    } catch (error) {
      this.logger.error('Azure OCR processing failed', {
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Azure OCR failed: ${error.message}`);
    }
  }

  private async convertAzureResults(azureData: any, buffer: Buffer, startTime: number): Promise<OCRResult> {
    const imageMetadata = await sharp(buffer).metadata();
    let allText = '';
    const words: OCRResult['words'] = [];
    const lines: OCRResult['lines'] = [];
    const blocks: OCRResult['blocks'] = [];

    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const page of azureData.analyzeResult.readResults) {
      const pageLines = page.lines || [];
      
      for (const line of pageLines) {
        const lineWords = line.words || [];
        const lineWordsConverted = lineWords.map((word: any) => ({
          text: word.text,
          confidence: word.confidence || 0.9,
          bbox: {
            x0: word.boundingBox[0],
            y0: word.boundingBox[1],
            x1: word.boundingBox[4],
            y1: word.boundingBox[5]
          }
        }));

        words.push(...lineWordsConverted);

        const lineConfidence = line.words ? 
          line.words.reduce((sum: number, w: any) => sum + (w.confidence || 0.9), 0) / line.words.length :
          0.9;

        lines.push({
          text: line.text,
          confidence: lineConfidence,
          bbox: {
            x0: line.boundingBox[0],
            y0: line.boundingBox[1],
            x1: line.boundingBox[4],
            y1: line.boundingBox[5]
          },
          words: lineWordsConverted
        });

        allText += line.text + '\n';
        totalConfidence += lineConfidence;
        confidenceCount++;
      }

      // Create a block for this page
      if (pageLines.length > 0) {
        blocks.push({
          text: pageLines.map((l: any) => l.text).join('\n'),
          confidence: pageLines.reduce((sum: number, l: any) => {
            const lineConf = l.words ? 
              l.words.reduce((s: number, w: any) => s + (w.confidence || 0.9), 0) / l.words.length :
              0.9;
            return sum + lineConf;
          }, 0) / pageLines.length,
          bbox: {
            x0: Math.min(...pageLines.map((l: any) => l.boundingBox[0])),
            y0: Math.min(...pageLines.map((l: any) => l.boundingBox[1])),
            x1: Math.max(...pageLines.map((l: any) => l.boundingBox[4])),
            y1: Math.max(...pageLines.map((l: any) => l.boundingBox[5]))
          },
          lines: lines.slice(-pageLines.length)
        });
      }
    }

    return {
      text: allText.trim(),
      confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      words,
      lines,
      blocks,
      metadata: {
        engineUsed: this.name,
        processingTime: Date.now() - startTime,
        imageMetadata: {
          width: imageMetadata.width || 0,
          height: imageMetadata.height || 0,
          format: imageMetadata.format || 'unknown',
          dpi: imageMetadata.density
        },
        detectedLanguages: [
          { language: 'ara', confidence: 0.9 },
          { language: 'eng', confidence: 0.8 }
        ]
      }
    };
  }
}

export class GoogleVisionOCREngine implements OCREngine {
  name = 'Google Vision API';
  private logger: Logger;
  private apiKey: string;

  constructor() {
    this.logger = structuredLogger;
    this.apiKey = process.env.GOOGLE_VISION_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async process(buffer: Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();

    if (!await this.isAvailable()) {
      throw new Error('Google Vision OCR engine not configured');
    }

    try {
      const base64Image = buffer.toString('base64');
      
      const requestBody = {
        requests: [{
          image: {
            content: base64Image
          },
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }],
          imageContext: {
            languageHints: ['ar', 'en']
          }
        }]
      };

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Google Vision API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.responses[0].error) {
        throw new Error(`Google Vision API error: ${data.responses[0].error.message}`);
      }

      // Convert Google Vision results to our format
      const result = await this.convertGoogleResults(data.responses[0], buffer, startTime);
      
      this.logger.info('Google Vision OCR processing completed', {
        confidence: result.confidence,
        processingTime: result.metadata.processingTime,
        textLength: result.text.length
      });

      return result;

    } catch (error) {
      this.logger.error('Google Vision OCR processing failed', {
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Google Vision OCR failed: ${error.message}`);
    }
  }

  private async convertGoogleResults(googleData: any, buffer: Buffer, startTime: number): Promise<OCRResult> {
    const imageMetadata = await sharp(buffer).metadata();
    const fullTextAnnotation = googleData.fullTextAnnotation;
    
    if (!fullTextAnnotation) {
      return {
        text: '',
        confidence: 0,
        words: [],
        lines: [],
        blocks: [],
        metadata: {
          engineUsed: this.name,
          processingTime: Date.now() - startTime,
          imageMetadata: {
            width: imageMetadata.width || 0,
            height: imageMetadata.height || 0,
            format: imageMetadata.format || 'unknown',
            dpi: imageMetadata.density
          },
          detectedLanguages: []
        }
      };
    }

    const words: OCRResult['words'] = [];
    const lines: OCRResult['lines'] = [];
    const blocks: OCRResult['blocks'] = [];

    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const page of fullTextAnnotation.pages || []) {
      for (const block of page.blocks || []) {
        const blockWords: OCRResult['words'] = [];
        const blockLines: OCRResult['lines'] = [];
        let blockText = '';

        for (const paragraph of block.paragraphs || []) {
          for (const word of paragraph.words || []) {
            const wordText = word.symbols?.map((s: any) => s.text).join('') || '';
            const wordConfidence = word.confidence || 0.9;
            
            const wordBbox = this.getBoundingBox(word.boundingBox);
            
            const wordObj = {
              text: wordText,
              confidence: wordConfidence,
              bbox: wordBbox
            };

            words.push(wordObj);
            blockWords.push(wordObj);
            totalConfidence += wordConfidence;
            confidenceCount++;
          }
        }

        // Group words into lines (simplified approach)
        const sortedWords = blockWords.sort((a, b) => a.bbox.y0 - b.bbox.y0);
        let currentLine: OCRResult['words'] = [];
        let currentLineY = -1;
        const lineThreshold = 10; // pixels

        for (const word of sortedWords) {
          if (currentLineY === -1 || Math.abs(word.bbox.y0 - currentLineY) <= lineThreshold) {
            currentLine.push(word);
            currentLineY = currentLineY === -1 ? word.bbox.y0 : (currentLineY + word.bbox.y0) / 2;
          } else {
            if (currentLine.length > 0) {
              const lineText = currentLine.map(w => w.text).join(' ');
              const lineConfidence = currentLine.reduce((sum, w) => sum + w.confidence, 0) / currentLine.length;
              const lineBbox = {
                x0: Math.min(...currentLine.map(w => w.bbox.x0)),
                y0: Math.min(...currentLine.map(w => w.bbox.y0)),
                x1: Math.max(...currentLine.map(w => w.bbox.x1)),
                y1: Math.max(...currentLine.map(w => w.bbox.y1))
              };

              lines.push({
                text: lineText,
                confidence: lineConfidence,
                bbox: lineBbox,
                words: [...currentLine]
              });
              blockLines.push({
                text: lineText,
                confidence: lineConfidence,
                bbox: lineBbox
              });
            }

            currentLine = [word];
            currentLineY = word.bbox.y0;
          }
        }

        // Handle the last line
        if (currentLine.length > 0) {
          const lineText = currentLine.map(w => w.text).join(' ');
          const lineConfidence = currentLine.reduce((sum, w) => sum + w.confidence, 0) / currentLine.length;
          const lineBbox = {
            x0: Math.min(...currentLine.map(w => w.bbox.x0)),
            y0: Math.min(...currentLine.map(w => w.bbox.y0)),
            x1: Math.max(...currentLine.map(w => w.bbox.x1)),
            y1: Math.max(...currentLine.map(w => w.bbox.y1))
          };

          lines.push({
            text: lineText,
            confidence: lineConfidence,
            bbox: lineBbox,
            words: [...currentLine]
          });
          blockLines.push({
            text: lineText,
            confidence: lineConfidence,
            bbox: lineBbox
          });
        }

        blockText = blockLines.map(line => line.text).join('\n');
        const blockConfidence = blockWords.length > 0 ? 
          blockWords.reduce((sum, w) => sum + w.confidence, 0) / blockWords.length : 0;

        blocks.push({
          text: blockText,
          confidence: blockConfidence,
          bbox: this.getBoundingBox(block.boundingBox),
          lines: blockLines
        });
      }
    }

    return {
      text: fullTextAnnotation.text || '',
      confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      words,
      lines,
      blocks,
      metadata: {
        engineUsed: this.name,
        processingTime: Date.now() - startTime,
        imageMetadata: {
          width: imageMetadata.width || 0,
          height: imageMetadata.height || 0,
          format: imageMetadata.format || 'unknown',
          dpi: imageMetadata.density
        },
        detectedLanguages: fullTextAnnotation.pages?.[0]?.property?.detectedLanguages?.map((lang: any) => ({
          language: lang.languageCode,
          confidence: lang.confidence || 0.9
        })) || []
      }
    };
  }

  private getBoundingBox(boundingBox: any) {
    const vertices = boundingBox?.vertices || [];
    if (vertices.length < 4) {
      return { x0: 0, y0: 0, x1: 0, y1: 0 };
    }

    return {
      x0: Math.min(...vertices.map((v: any) => v.x || 0)),
      y0: Math.min(...vertices.map((v: any) => v.y || 0)),
      x1: Math.max(...vertices.map((v: any) => v.x || 0)),
      y1: Math.max(...vertices.map((v: any) => v.y || 0))
    };
  }
}

export class MultiEngineOCRProcessor {
  private engines: OCREngine[];
  private logger: Logger;

  constructor() {
    this.engines = [
      new TesseractOCREngine(),
      new AzureOCREngine(),
      new GoogleVisionOCREngine()
    ];
    this.logger = structuredLogger;
  }

  async getAvailableEngines(): Promise<OCREngine[]> {
    const availableEngines = [];
    for (const engine of this.engines) {
      if (await engine.isAvailable()) {
        availableEngines.push(engine);
      }
    }
    return availableEngines;
  }

  async processWithBestEngine(buffer: Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const availableEngines = await this.getAvailableEngines();
    
    if (availableEngines.length === 0) {
      throw new Error('No OCR engines available');
    }

    // Try engines in order of preference (Azure > Google > Tesseract for Arabic)
    const engineOrder = [
      availableEngines.find(e => e.name === 'Azure Cognitive Services'),
      availableEngines.find(e => e.name === 'Google Vision API'),
      availableEngines.find(e => e.name === 'Tesseract')
    ].filter(Boolean) as OCREngine[];

    let lastError: Error | null = null;

    for (const engine of engineOrder) {
      try {
        this.logger.info(`Attempting OCR with ${engine.name}`);
        const result = await engine.process(buffer, options);
        
        // Check if result meets minimum quality threshold
        if (result.confidence >= (options.confidence || 0.5)) {
          this.logger.info(`OCR successful with ${engine.name}`, {
            confidence: result.confidence,
            textLength: result.text.length
          });
          return result;
        } else {
          this.logger.warn(`OCR result below confidence threshold with ${engine.name}`, {
            confidence: result.confidence,
            threshold: options.confidence || 0.5
          });
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`OCR failed with ${engine.name}`, { error: error.message });
      }
    }

    throw new Error(`All OCR engines failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  async processWithMultipleEngines(buffer: Buffer, options: OCROptions = {}): Promise<{
    results: Array<{ engine: string; result: OCRResult; error?: string }>;
    bestResult: OCRResult;
  }> {
    const availableEngines = await this.getAvailableEngines();
    const results: Array<{ engine: string; result: OCRResult; error?: string }> = [];
    
    // Process with all available engines
    const promises = availableEngines.map(async (engine) => {
      try {
        const result = await engine.process(buffer, options);
        return { engine: engine.name, result, error: undefined };
      } catch (error) {
        return { 
          engine: engine.name, 
          result: null, 
          error: error.message 
        };
      }
    });

    const engineResults = await Promise.all(promises);
    
    // Collect successful results
    const successfulResults = engineResults.filter(r => r.result !== null) as Array<{ 
      engine: string; 
      result: OCRResult; 
      error?: string; 
    }>;
    
    results.push(...engineResults);

    if (successfulResults.length === 0) {
      throw new Error('All OCR engines failed');
    }

    // Find best result based on confidence
    const bestResult = successfulResults.reduce((best, current) => 
      current.result.confidence > best.result.confidence ? current : best
    ).result;

    this.logger.info('Multi-engine OCR processing completed', {
      enginesUsed: results.length,
      successfulEngines: successfulResults.length,
      bestEngine: results.find(r => r.result === bestResult)?.engine,
      bestConfidence: bestResult.confidence
    });

    return { results, bestResult };
  }

  async processBatch(
    documents: Array<{ id: string; buffer: Buffer }>,
    options: OCROptions = {}
  ): Promise<BatchOCRResult> {
    const startTime = Date.now();
    const results: BatchOCRResult['results'] = [];
    
    let successfulDocuments = 0;
    let failedDocuments = 0;
    let totalConfidence = 0;

    // Process documents in parallel with controlled concurrency
    const concurrency = 3; // Process 3 documents at a time
    const chunks = [];
    for (let i = 0; i < documents.length; i += concurrency) {
      chunks.push(documents.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (doc) => {
        try {
          const result = await this.processWithBestEngine(doc.buffer, options);
          const status = result.confidence >= (options.confidence || 0.5) ? 'success' : 'low_confidence';
          
          if (status === 'success') {
            successfulDocuments++;
            totalConfidence += result.confidence;
          }

          return {
            documentId: doc.id,
            result,
            status,
            error: undefined
          };
        } catch (error) {
          failedDocuments++;
          return {
            documentId: doc.id,
            result: null as any,
            status: 'failed' as const,
            error: error.message
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const summary = {
      totalDocuments: documents.length,
      successfulDocuments,
      failedDocuments,
      averageConfidence: successfulDocuments > 0 ? totalConfidence / successfulDocuments : 0,
      totalProcessingTime: Date.now() - startTime
    };

    this.logger.info('Batch OCR processing completed', summary);

    return { results, summary };
  }
}