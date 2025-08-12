import { OpenAI } from 'openai';

/**
 * OpenRouter client configuration for HR Intelligence Platform
 * Provides access to multiple AI models through OpenRouter's unified API
 */

export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  embeddingModel: string;
  documentProcessingModel: string;
  backupChatModels?: string[];
  backupDocModels?: string[];
  backupEmbeddingModels?: string[];
  premiumChatModel?: string;
  premiumDocsModel?: string;
  maxRetries?: number;
  timeout?: number;
  fallbackEnabled?: boolean;
}

export interface ModelUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface OpenRouterResponse<T = any> {
  data: T;
  usage: ModelUsage;
  model: string;
  processingTime: number;
}

/**
 * OpenRouter client class for AI model access
 */
export class OpenRouterClient {
  private client: OpenAI;
  private config: OpenRouterConfig;

  constructor(config?: Partial<OpenRouterConfig>) {
    this.config = {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultModel: process.env.OPENROUTER_MODEL_CHAT || 'deepseek/deepseek-chat:free',
      embeddingModel: process.env.OPENROUTER_MODEL_EMBEDDING || 'text-embedding-3-small',
      documentProcessingModel: process.env.OPENROUTER_MODEL_DOCUMENT_PROCESSING || 'google/gemini-2.0-flash-exp:free',
      backupChatModels: process.env.OPENROUTER_BACKUP_MODELS_CHAT?.split(',').map(m => m.trim()) || [
        'google/gemini-2.0-flash-exp:free',
        'deepseek/deepseek-r1-zero:free', 
        'openai/gpt-4o-mini',
        'openai/gpt-3.5-turbo'
      ],
      backupDocModels: process.env.OPENROUTER_BACKUP_MODELS_DOCS?.split(',').map(m => m.trim()) || [
        'deepseek/deepseek-chat:free',
        'deepseek/deepseek-v3-base:free',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-haiku'
      ],
      backupEmbeddingModels: process.env.OPENROUTER_BACKUP_MODELS_EMBEDDING?.split(',').map(m => m.trim()) || [
        'text-embedding-ada-002',
        'text-embedding-3-large'
      ],
      premiumChatModel: process.env.OPENROUTER_PREMIUM_CHAT || 'openai/gpt-4o',
      premiumDocsModel: process.env.OPENROUTER_PREMIUM_DOCS || 'anthropic/claude-3-sonnet',
      maxRetries: 3,
      timeout: 60000,
      fallbackEnabled: true,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.');
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });
  }

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await this.client.models.list();
      return response.data;
    } catch (error) {
      console.error('Error fetching available models:', error);
      throw new Error('Failed to fetch available models from OpenRouter');
    }
  }

  /**
   * Generate embeddings using OpenRouter with smart fallback
   */
  async generateEmbedding(
    input: string | string[],
    options?: {
      model?: string;
      encoding_format?: 'float' | 'base64';
      dimensions?: number;
      disableFallback?: boolean;
    }
  ): Promise<OpenRouterResponse<number[][] | number[]>> {
    const startTime = Date.now();
    const primaryModel = options?.model || this.config.embeddingModel;
    const modelsToTry = [primaryModel];
    
    // Add backup models if fallback is enabled
    if (this.config.fallbackEnabled && !options?.disableFallback) {
      modelsToTry.push(...(this.config.backupEmbeddingModels || []));
    }
    
    let lastError: Error | null = null;
    
    for (const model of modelsToTry) {
      try {
        console.log(`🔄 Trying embedding model: ${model}`);
        
        const response = await this.client.embeddings.create({
          model,
          input,
          encoding_format: options?.encoding_format || 'float',
          ...(options?.dimensions && { dimensions: options.dimensions })
        });

        const embeddings = Array.isArray(input) 
          ? response.data.map(item => item.embedding)
          : response.data?.[0]?.embedding;

        console.log(`✅ Embedding successful with model: ${model}`);
        
        return {
          data: embeddings,
          usage: {
            model: response.model,
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: 0,
            totalTokens: response.usage?.total_tokens || 0,
            cost: this.calculateEmbeddingCost(response.usage?.total_tokens || 0, response.model)
          },
          model: response.model,
          processingTime: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`❌ Model ${model} failed:`, lastError.message);
        
        // Check if it's a rate limit error
        if (lastError.message.includes('rate') || lastError.message.includes('limit') || lastError.message.includes('429')) {
          console.log(`🔄 Rate limit hit for ${model}, trying next model...`);
          continue;
        }
        
        // For other errors, try next model
        continue;
      }
    }
    
    // All models failed
    console.error('💥 All embedding models failed:', lastError?.message);
    throw new Error(`Failed to generate embedding with all models. Last error: ${lastError?.message}`);
  }

  /**
   * Generate chat completion using OpenRouter with smart fallback
   */
  async generateChatCompletion(
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>,
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
      stream?: boolean;
      disableFallback?: boolean;
      isDocumentProcessing?: boolean;
    }
  ): Promise<OpenRouterResponse<string> | ReadableStream<Uint8Array>> {
    const startTime = Date.now();
    const primaryModel = options?.model || this.config.defaultModel;
    
    // Select appropriate backup models based on use case
    const backupModels = options?.isDocumentProcessing 
      ? this.config.backupDocModels 
      : this.config.backupChatModels;
    
    const modelsToTry = [primaryModel];
    
    // Add backup models if fallback is enabled
    if (this.config.fallbackEnabled && !options?.disableFallback) {
      modelsToTry.push(...(backupModels || []));
    }
    
    let lastError: Error | null = null;
    
    for (const model of modelsToTry) {
      try {
        console.log(`🔄 Trying chat model: ${model}`);
        
        const requestOptions = {
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 2000,
          top_p: options?.top_p ?? 1,
          frequency_penalty: options?.frequency_penalty ?? 0,
          presence_penalty: options?.presence_penalty ?? 0,
          stream: options?.stream ?? false,
          // OpenRouter-specific headers for attribution
          extra_headers: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002',
            "X-Title": "HR Intelligence Platform"
          }
        };

        if (options?.stream) {
          const stream = await this.client.chat.completions.create({
            ...requestOptions,
            stream: true
          });
          console.log(`✅ Streaming chat successful with model: ${model}`);
          return stream as any; // Type assertion for streaming response
        }

        const response = await this.client.chat.completions.create(requestOptions);
        const content = response.choices[0]?.message?.content || '';
        
        console.log(`✅ Chat completion successful with model: ${model}`);
        
        return {
          data: content,
          usage: {
            model: response.model,
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
            cost: this.calculateChatCost(
              response.usage?.prompt_tokens || 0,
              response.usage?.completion_tokens || 0,
              response.model
            )
          },
          model: response.model,
          processingTime: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`❌ Model ${model} failed:`, lastError.message);
        
        // Check if it's a rate limit error
        if (lastError.message.includes('rate') || lastError.message.includes('limit') || lastError.message.includes('429')) {
          console.log(`🔄 Rate limit hit for ${model}, trying next model...`);
          continue;
        }
        
        // Check if it's a context length error
        if (lastError.message.includes('context') || lastError.message.includes('length') || lastError.message.includes('token')) {
          console.log(`📏 Context length exceeded for ${model}, trying next model with larger context...`);
          continue;
        }
        
        // For other errors, try next model
        continue;
      }
    }
    
    // All models failed
    console.error('💥 All chat models failed:', lastError?.message);
    throw new Error(`Failed to generate chat completion with all models. Last error: ${lastError?.message}`);
  }

  /**
   * Process document content using OpenRouter
   */
  async processDocument(
    content: string,
    task: 'extract' | 'summarize' | 'translate' | 'analyze',
    options?: {
      model?: string;
      language?: 'ar' | 'en';
      outputFormat?: 'text' | 'json';
      instructions?: string;
    }
  ): Promise<OpenRouterResponse<string>> {
    const systemPrompts = {
      extract: `You are an expert document processor. Extract key information from the provided text. Focus on:
- Important facts and figures
- Names, dates, and locations
- Key concepts and terminology
${options?.language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'}`,
      
      summarize: `You are an expert document summarizer. Create a concise summary of the provided text.
${options?.language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'}`,
      
      translate: `You are a professional translator specializing in Arabic and English.
${options?.language === 'ar' ? 'Translate the text to Arabic.' : 'Translate the text to English.'}`,
      
      analyze: `You are an expert analyst. Analyze the provided text for:
- Main themes and topics
- Sentiment and tone
- Important insights
${options?.language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'}`
    };

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompts[task] + (options?.instructions ? `\n\nAdditional instructions: ${options.instructions}` : '')
      },
      {
        role: 'user' as const,
        content: content
      }
    ];

    return this.generateChatCompletion(messages, {
      model: options?.model || this.config.documentProcessingModel,
      temperature: 0.3,
      max_tokens: 4000,
      isDocumentProcessing: true
    }) as Promise<OpenRouterResponse<string>>;
  }

  /**
   * Estimate cost for embedding generation
   */
  private calculateEmbeddingCost(tokens: number, model: string): number {
    // OpenRouter pricing - these are approximate rates
    const embeddingPrices: Record<string, number> = {
      'text-embedding-ada-002': 0.0001 / 1000,
      'text-embedding-3-small': 0.00002 / 1000,
      'text-embedding-3-large': 0.00013 / 1000
    };

    const basePrice = embeddingPrices[model] || embeddingPrices['text-embedding-ada-002'];
    const openRouterFee = 1.055; // 5.5% OpenRouter fee
    
    return tokens * basePrice * openRouterFee;
  }

  /**
   * Estimate cost for chat completion
   */
  private calculateChatCost(promptTokens: number, completionTokens: number, model: string): number {
    // OpenRouter pricing - these are approximate rates for popular models
    const chatPrices: Record<string, { input: number; output: number }> = {
      'openai/gpt-4o': { input: 0.0025 / 1000, output: 0.01 / 1000 },
      'openai/gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
      'openai/gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
      'anthropic/claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
      'anthropic/claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 }
    };

    const prices = chatPrices[model] || chatPrices['openai/gpt-4o'];
    const openRouterFee = 1.055; // 5.5% OpenRouter fee
    
    const inputCost = promptTokens * prices.input * openRouterFee;
    const outputCost = completionTokens * prices.output * openRouterFee;
    
    return inputCost + outputCost;
  }

  /**
   * Get model recommendations for different use cases (FREE/LOW-COST FOCUSED)
   */
  getModelRecommendations(): {
    embedding: string[];
    chat: string[];
    documentProcessing: string[];
    arabicOptimized: string[];
    free: string[];
    premium: string[];
  } {
    return {
      embedding: [
        'text-embedding-3-small',   // Most cost-effective paid option
        'text-embedding-3-large',   // Higher quality for complex docs
        'text-embedding-ada-002'    // Reliable fallback
      ],
      chat: [
        'deepseek/deepseek-chat:free',        // 🆓 FREE - Excellent for HR Q&A
        'google/gemini-2.0-flash-exp:free',   // 🆓 FREE - Great multimodal support
        'deepseek/deepseek-r1-zero:free',     // 🆓 FREE - Strong reasoning
        'openai/gpt-4o-mini'                  // 💰 LOW-COST - Premium fallback
      ],
      documentProcessing: [
        'google/gemini-2.0-flash-exp:free',   // 🆓 FREE - 1M token context, multimodal
        'deepseek/deepseek-chat:free',        // 🆓 FREE - Strong document analysis
        'anthropic/claude-3-sonnet',          // 💰 PAID - For complex legal docs only
      ],
      arabicOptimized: [
        'deepseek/deepseek-chat:free',        // 🆓 FREE - Proven Arabic support
        'google/gemini-2.0-flash-exp:free',   // 🆓 FREE - Native Arabic support
        'openai/gpt-4o-mini',                 // 💰 LOW-COST - Strong multilingual
        'openai/gpt-4o'                       // 💰 PREMIUM - Best quality (when needed)
      ],
      free: [
        'deepseek/deepseek-chat:free',        // Best overall free model
        'google/gemini-2.0-flash-exp:free',   // Best free multimodal
        'deepseek/deepseek-r1-zero:free',     // Best free reasoning
        'deepseek/deepseek-v3-base:free',     // Technical optimization
      ],
      premium: [
        'openai/gpt-4o-mini',      // Most cost-effective paid
        'openai/gpt-4o',           // Best quality when needed
        'anthropic/claude-3-sonnet' // Long context specialist
      ]
    };
  }

  /**
   * Health check for OpenRouter connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    modelsAvailable: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const models = await this.getAvailableModels();
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        modelsAvailable: models.length
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        modelsAvailable: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const openRouterClient = new OpenRouterClient();