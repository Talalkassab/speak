import { openRouterClient, OpenRouterClient } from './openrouter-client';
import { VectorSearchService, SearchResult, LaborLawResult } from './vector-search-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export interface SourceAttribution {
  id: string;
  type: 'document' | 'labor_law';
  title: string;
  excerpt: string;
  pageNumber?: number;
  relevanceScore: number;
  articleNumber?: string; // For labor law sources
  category?: string;
}

export interface RAGResponse {
  answer: string;
  sources: SourceAttribution[];
  confidence: number;
  language: 'ar' | 'en';
  conversationId?: string;
  messageId?: string;
  tokensUsed: number;
  responseTimeMs: number;
  searchResults: {
    documentCount: number;
    laborLawCount: number;
    combinedRelevance: number;
  };
}

export interface QueryContext {
  organizationId: string;
  userId: string;
  conversationId?: string;
  language: 'ar' | 'en';
  includeCompanyDocs: boolean;
  includeLaborLaw: boolean;
  maxSources: number;
}

export class RAGQueryService {
  private openRouterClient: OpenRouterClient;
  private vectorSearch: VectorSearchService;
  
  constructor() {
    this.openRouterClient = openRouterClient;
    this.vectorSearch = new VectorSearchService();
  }

  /**
   * Process a RAG query and generate AI response with sources
   */
  async processQuery(
    query: string,
    context: QueryContext
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Search for relevant content
      const searchResults = await this.searchRelevantContent(query, context);
      
      // 2. Prepare context for AI model
      const contextualPrompt = await this.prepareContextualPrompt(
        query,
        searchResults,
        context
      );
      
      // 3. Generate AI response
      const aiResponse = await this.generateAIResponse(contextualPrompt, context.language);
      
      // 4. Extract and format source attributions
      const sources = this.formatSourceAttributions(searchResults);
      
      // 5. Calculate confidence score
      const confidence = this.calculateConfidenceScore(searchResults, aiResponse);
      
      const responseTimeMs = Date.now() - startTime;
      
      return {
        answer: aiResponse.content,
        sources,
        confidence,
        language: context.language,
        conversationId: context.conversationId,
        tokensUsed: aiResponse.tokensUsed,
        responseTimeMs,
        searchResults: {
          documentCount: searchResults.documentResults.length,
          laborLawCount: searchResults.laborLawResults.length,
          combinedRelevance: searchResults.combinedRelevance
        }
      };

    } catch (error) {
      console.error('Error processing RAG query:', error);
      throw new Error('Failed to process query');
    }
  }

  /**
   * Search for relevant content using hybrid search
   */
  async searchRelevantContent(
    query: string,
    context: QueryContext
  ): Promise<{
    documentResults: SearchResult[];
    laborLawResults: LaborLawResult[];
    combinedRelevance: number;
  }> {
    return await this.vectorSearch.hybridSearch({
      query,
      organizationId: context.organizationId,
      language: context.language,
      limit: context.maxSources,
      threshold: 0.75,
      includeLabourLaw: context.includeLaborLaw
    });
  }

  /**
   * Prepare contextual prompt for AI model
   */
  private async prepareContextualPrompt(
    userQuery: string,
    searchResults: {
      documentResults: SearchResult[];
      laborLawResults: LaborLawResult[];
    },
    context: QueryContext
  ): Promise<string> {
    const { language, organizationId } = context;
    
    // Get organization context
    const supabase = await createSupabaseServerClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('name, country_code')
      .eq('id', organizationId)
      .single();

    const systemPrompts = {
      ar: {
        role: 'أنت مستشار موارد بشرية متخصص في قانون العمل السعودي. مهمتك هي تقديم إجابات دقيقة ومفيدة باللغة العربية.',
        context: 'السياق التنظيمي',
        companyDocs: 'مستندات الشركة',
        laborLaw: 'قانون العمل السعودي',
        instructions: `تعليمات مهمة:
1. استخدم المعلومات المرفقة فقط للإجابة
2. إذا لم تجد إجابة في المصادر، قل "لا تتوفر معلومات كافية"
3. اذكر المصادر المرجعية في إجابتك
4. قدم إجابات عملية وقابلة للتطبيق
5. التزم بقانون العمل السعودي في جميع التوصيات`
      },
      en: {
        role: 'You are an expert HR consultant specializing in Saudi Labor Law. Your task is to provide accurate and helpful answers in English.',
        context: 'Organizational Context',
        companyDocs: 'Company Documents',
        laborLaw: 'Saudi Labor Law',
        instructions: `Important instructions:
1. Use only the provided information to answer
2. If no adequate information is found, say "Insufficient information available"
3. Reference sources in your response
4. Provide practical and actionable answers
5. Ensure all recommendations comply with Saudi Labor Law`
      }
    };

    const prompts = systemPrompts[language];
    
    let contextSection = `${prompts.context}: ${org?.name || 'المنظمة'}\n\n`;
    
    // Add company documents context
    if (searchResults.documentResults.length > 0) {
      contextSection += `${prompts.companyDocs}:\n`;
      searchResults.documentResults.forEach((doc, index) => {
        contextSection += `${index + 1}. ${doc.documentTitle}\n${doc.chunkText}\n\n`;
      });
    }
    
    // Add labor law context
    if (searchResults.laborLawResults.length > 0) {
      contextSection += `${prompts.laborLaw}:\n`;
      searchResults.laborLawResults.forEach((law, index) => {
        contextSection += `${index + 1}. ${law.articleNumber}: ${law.title}\n${law.content}\n\n`;
      });
    }

    return `${prompts.role}

${prompts.instructions}

${contextSection}

${language === 'ar' ? 'السؤال' : 'Question'}: ${userQuery}

${language === 'ar' ? 'الإجابة' : 'Answer'}:`;
  }

  /**
   * Generate AI response using OpenRouter with Arabic optimization
   */
  private async generateAIResponse(
    prompt: string,
    language: 'ar' | 'en'
  ): Promise<{ content: string; tokensUsed: number }> {
    try {
      const response = await this.openRouterClient.generateChatCompletion([
        {
          role: 'system',
          content: prompt
        }
      ], {
        temperature: 0.1, // Low temperature for more consistent responses
        max_tokens: 1000,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      });

      const content = response.data;
      const tokensUsed = response.usage.totalTokens;

      // Validate response quality
      if (content.length < 50) {
        throw new Error('Generated response too short');
      }

      return { content, tokensUsed };

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback response
      const fallbackResponses = {
        ar: 'عذراً، حدث خطأ في معالجة استفسارك. يرجى المحاولة مرة أخرى أو إعادة صياغة السؤال.',
        en: 'Sorry, there was an error processing your query. Please try again or rephrase your question.'
      };
      
      return {
        content: fallbackResponses[language],
        tokensUsed: 0
      };
    }
  }

  /**
   * Format search results into source attributions
   */
  private formatSourceAttributions(searchResults: {
    documentResults: SearchResult[];
    laborLawResults: LaborLawResult[];
  }): SourceAttribution[] {
    const sources: SourceAttribution[] = [];
    
    // Add document sources
    searchResults.documentResults.forEach(doc => {
      sources.push({
        id: doc.id,
        type: 'document',
        title: doc.documentTitle,
        excerpt: doc.chunkText.substring(0, 200) + '...',
        pageNumber: doc.pageNumber,
        relevanceScore: doc.relevanceScore,
        category: doc.category
      });
    });
    
    // Add labor law sources
    searchResults.laborLawResults.forEach(law => {
      sources.push({
        id: law.id,
        type: 'labor_law',
        title: law.title,
        excerpt: law.summary || law.content.substring(0, 200) + '...',
        relevanceScore: law.relevanceScore,
        articleNumber: law.articleNumber,
        category: law.category
      });
    });

    // Sort by relevance score
    return sources.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate confidence score based on search results and response quality
   */
  private calculateConfidenceScore(
    searchResults: {
      documentResults: SearchResult[];
      laborLawResults: LaborLawResult[];
      combinedRelevance: number;
    },
    aiResponse: { content: string }
  ): number {
    let confidence = 0;
    
    // Base confidence from search relevance (40% weight)
    confidence += searchResults.combinedRelevance * 0.4;
    
    // Number of relevant sources found (30% weight)
    const totalSources = searchResults.documentResults.length + searchResults.laborLawResults.length;
    const sourceScore = Math.min(totalSources / 5, 1); // Normalize to 5 sources max
    confidence += sourceScore * 0.3;
    
    // Response length and quality indicators (20% weight)
    const responseLength = aiResponse.content.length;
    const lengthScore = Math.min(responseLength / 500, 1); // Normalize to 500 chars
    confidence += lengthScore * 0.2;
    
    // Labor law coverage bonus (10% weight)
    if (searchResults.laborLawResults.length > 0) {
      confidence += 0.1;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get conversation context for follow-up queries
   */
  async getConversationContext(
    conversationId: string,
    organizationId: string,
    limit: number = 5
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
        .limit(limit * 2); // Get both user and assistant messages

      if (error || !messages) {
        return [];
      }

      return messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    } catch (error) {
      console.error('Error getting conversation context:', error);
      return [];
    }
  }

  /**
   * Enhanced query processing with conversation context
   */
  async processConversationalQuery(
    query: string,
    context: QueryContext
  ): Promise<RAGResponse> {
    try {
      let enhancedQuery = query;
      
      // Get conversation context if available
      if (context.conversationId) {
        const conversationHistory = await this.getConversationContext(
          context.conversationId,
          context.organizationId
        );
        
        if (conversationHistory.length > 0) {
          // Enhance query with conversation context
          enhancedQuery = this.enhanceQueryWithContext(query, conversationHistory);
        }
      }

      // Process enhanced query
      return await this.processQuery(enhancedQuery, context);

    } catch (error) {
      console.error('Error processing conversational query:', error);
      // Fallback to basic query processing
      return await this.processQuery(query, context);
    }
  }

  /**
   * Enhance query with conversation context for better understanding
   */
  private enhanceQueryWithContext(
    currentQuery: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  ): string {
    // Get last few exchanges for context
    const recentHistory = conversationHistory.slice(-4); // Last 2 exchanges
    
    if (recentHistory.length === 0) {
      return currentQuery;
    }

    // Build context summary
    let contextSummary = 'Previous conversation: ';
    recentHistory.forEach(msg => {
      if (msg.role === 'user') {
        contextSummary += `User asked: "${msg.content.substring(0, 100)}..." `;
      }
    });

    return `${contextSummary}\n\nCurrent question: ${currentQuery}`;
  }

  /**
   * Generate query suggestions based on organization documents and common patterns
   */
  async generateQuerySuggestions(
    organizationId: string,
    language: 'ar' | 'en' = 'ar',
    limit: number = 5
  ): Promise<string[]> {
    const suggestionTemplates = {
      ar: [
        'ما هي سياسة الإجازات في الشركة؟',
        'كيف يتم احتساب مكافأة نهاية الخدمة؟',
        'ما هي إجراءات إنهاء عقد العمل؟',
        'ما هي ساعات العمل المسموحة قانونياً؟',
        'كيف يتم التعامل مع الإجازات المرضية؟',
        'ما هي حقوق الموظف في فترة التجربة؟',
        'كيف يتم احتساب الراتب الأساسي والبدلات؟',
        'ما هي إجراءات تقديم الشكاوى؟'
      ],
      en: [
        'What is the company\'s leave policy?',
        'How is end-of-service gratuity calculated?',
        'What are the procedures for employment termination?',
        'What are the legally allowed working hours?',
        'How are sick leaves handled?',
        'What are employee rights during probation period?',
        'How are basic salary and allowances calculated?',
        'What are the procedures for filing complaints?'
      ]
    };

    // For now, return template suggestions
    // In production, this could be enhanced with ML to suggest based on actual usage patterns
    return suggestionTemplates[language].slice(0, limit);
  }
}