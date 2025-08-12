import { OpenAI } from 'openai';
import { supabaseAdmin } from '@/libs/supabase/supabase-admin';

interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export class EmbeddingGenerationService {
  private openai: OpenAI;
  private defaultModel = 'text-embedding-3-small';
  private batchSize = 100; // OpenAI batch limit

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    language: 'ar' | 'en' = 'en',
    options?: EmbeddingOptions
  ): Promise<number[]> {
    try {
      // Preprocess text based on language
      const processedText = await this.preprocessText(text, language);
      
      const response = await this.openai.embeddings.create({
        model: options?.model || this.defaultModel,
        input: processedText,
        dimensions: options?.dimensions, // Optional dimension reduction
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async batchGenerateEmbeddings(
    texts: string[],
    language: 'ar' | 'en' = 'en',
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const allEmbeddings: number[][] = [];
    
    // Process texts in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const processedBatch = await Promise.all(
        batch.map(text => this.preprocessText(text, language))
      );
      
      try {
        const response = await this.openai.embeddings.create({
          model: options?.model || this.defaultModel,
          input: processedBatch,
          dimensions: options?.dimensions,
        });
        
        const embeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...embeddings);
      } catch (error) {
        console.error(`Error in batch ${i / this.batchSize}:`, error);
        // Fallback to individual processing for failed batch
        for (const text of batch) {
          const embedding = await this.generateEmbedding(text, language, options);
          allEmbeddings.push(embedding);
        }
      }
    }
    
    return allEmbeddings;
  }

  /**
   * Process company documents and generate embeddings
   */
  async processCompanyDocument(
    documentId: string,
    organizationId: string,
    chunks: Array<{ content: string; metadata?: any; chunk_index: number }>,
    language: 'ar' | 'en' = 'ar'
  ): Promise<void> {
    try {
      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.content);
      const embeddings = await this.batchGenerateEmbeddings(texts, language);
      
      // Prepare data for insertion
      const documentsWithEmbeddings = chunks.map((chunk, index) => ({
        document_id: documentId,
        organization_id: organizationId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        embedding: JSON.stringify(embeddings[index]),
        metadata: chunk.metadata || {},
        language,
        created_at: new Date().toISOString(),
      }));
      
      // Store in database
      const { error } = await supabaseAdmin
        .from('document_chunks')
        .insert(documentsWithEmbeddings);
      
      if (error) {
        throw new Error(`Failed to store document embeddings: ${error.message}`);
      }
      
      console.log(`Processed ${chunks.length} chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error processing company document:', error);
      throw error;
    }
  }

  /**
   * Process Saudi labor law articles and generate embeddings
   */
  async processSaudiLawArticle(
    article: {
      article_number: string;
      title_ar: string;
      title_en: string;
      content_ar: string;
      content_en: string;
      category: string;
    }
  ): Promise<void> {
    try {
      // Generate embeddings for both Arabic and English versions
      const [embeddingAr, embeddingEn] = await Promise.all([
        this.generateEmbedding(
          `${article.title_ar}\n\n${article.content_ar}`,
          'ar'
        ),
        this.generateEmbedding(
          `${article.title_en}\n\n${article.content_en}`,
          'en'
        ),
      ]);
      
      // Store in database
      const { error } = await supabaseAdmin
        .from('saudi_labor_law_articles')
        .upsert({
          article_number: article.article_number,
          title_ar: article.title_ar,
          title_en: article.title_en,
          content_ar: article.content_ar,
          content_en: article.content_en,
          category: article.category,
          embedding_ar: JSON.stringify(embeddingAr),
          embedding_en: JSON.stringify(embeddingEn),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'article_number'
        });
      
      if (error) {
        throw new Error(`Failed to store labor law embedding: ${error.message}`);
      }
      
      console.log(`Processed Saudi law article ${article.article_number}`);
    } catch (error) {
      console.error('Error processing Saudi law article:', error);
      throw error;
    }
  }

  /**
   * Preprocess text based on language
   */
  private async preprocessText(text: string, language: 'ar' | 'en'): Promise<string> {
    if (!text || text.trim().length === 0) {
      return '';
    }
    
    if (language === 'ar') {
      return this.normalizeArabicText(text);
    } else {
      return this.normalizeEnglishText(text);
    }
  }

  /**
   * Normalize Arabic text for better embedding quality
   */
  private normalizeArabicText(text: string): string {
    return text
      // Remove diacritics (tashkeel)
      .replace(/[\u064B-\u065F]/g, '')
      // Normalize ta marbuta
      .replace(/ة/g, 'ه')
      // Normalize alif variations
      .replace(/[أإآ]/g, 'ا')
      // Normalize ya variations
      .replace(/ى/g, 'ي')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim();
  }

  /**
   * Normalize English text for better embedding quality
   */
  private normalizeEnglishText(text: string): string {
    return text
      // Convert to lowercase for consistency
      .toLowerCase()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep essential punctuation
      .replace(/[^\w\s.,;:!?-]/g, '')
      // Trim
      .trim();
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingGenerationService();