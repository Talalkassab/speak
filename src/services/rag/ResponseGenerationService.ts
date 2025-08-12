import { OpenAI } from 'openai';
import { RetrievalResult, SearchResult } from './RetrievalService';

export interface ConversationContext {
  conversationId: string;
  messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  entities: string[];
  topics: string[];
  contextSummary: string;
  lastUpdated: Date;
}

export interface RAGResponse {
  answer: string;
  confidence: number;
  language: 'ar' | 'en';
  sources: Array<{
    id: string;
    title?: string;
    excerpt: string;
    source_type: 'company' | 'saudi_law';
    article_number?: string;
  }>;
  reasoning?: string;
  recommendations?: string[];
  followUpQuestions?: string[];
}

export class ResponseGenerationService {
  private openai: OpenAI;
  private model = 'gpt-4-turbo-preview';
  private maxTokens = 2000;
  private temperature = 0.1; // Low for factual accuracy

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  /**
   * Generate AI response based on retrieved content and context
   */
  async generateResponse(
    query: string,
    retrievedContent: RetrievalResult,
    conversationContext: ConversationContext | null,
    language: 'ar' | 'en' = 'ar'
  ): Promise<RAGResponse> {
    try {
      // Build context prompt with retrieved content
      const contextPrompt = await this.buildContextPrompt(
        retrievedContent,
        conversationContext,
        language
      );
      
      // Create system prompt for HR context
      const systemPrompt = await this.createHRSystemPrompt(language);
      
      // Build messages array
      const messages = this.buildMessages(
        systemPrompt,
        contextPrompt,
        query,
        conversationContext,
        language
      );
      
      // Generate response with OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' },
      });
      
      // Parse and validate response
      const parsedResponse = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Extract source attributions
      const sources = await this.extractSourceAttributions(
        parsedResponse.answer,
        retrievedContent
      );
      
      // Generate follow-up questions
      const followUpQuestions = await this.generateFollowUpQuestions(
        query,
        parsedResponse.answer,
        language
      );
      
      return {
        answer: parsedResponse.answer,
        confidence: parsedResponse.confidence || 0.8,
        language,
        sources,
        reasoning: parsedResponse.reasoning,
        recommendations: parsedResponse.recommendations || [],
        followUpQuestions,
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Response generation failed: ${error}`);
    }
  }

  /**
   * Build context prompt from retrieved content
   */
  private async buildContextPrompt(
    retrievedContent: RetrievalResult,
    conversationContext: ConversationContext | null,
    language: 'ar' | 'en'
  ): Promise<string> {
    let contextPrompt = '';
    
    // Add conversation context if available
    if (conversationContext && conversationContext.contextSummary) {
      const contextLabel = language === 'ar' ? 'سياق المحادثة:' : 'Conversation Context:';
      contextPrompt += `${contextLabel}\n${conversationContext.contextSummary}\n\n`;
    }
    
    // Add retrieved content organized by source
    const companyDocs = retrievedContent.results.filter(r => r.source === 'company');
    const saudiLaw = retrievedContent.results.filter(r => r.source === 'saudi_law');
    
    if (saudiLaw.length > 0) {
      const lawLabel = language === 'ar' 
        ? 'مواد نظام العمل السعودي ذات الصلة:' 
        : 'Relevant Saudi Labor Law Articles:';
      contextPrompt += `${lawLabel}\n`;
      
      saudiLaw.forEach((article, index) => {
        const articleLabel = language === 'ar' ? 'المادة' : 'Article';
        contextPrompt += `\n${index + 1}. ${articleLabel} ${article.article_number || ''}:\n`;
        contextPrompt += `${article.title || ''}\n`;
        contextPrompt += `${article.content}\n`;
        contextPrompt += `(الصلة: ${(article.score * 100).toFixed(0)}%)\n`;
      });
      contextPrompt += '\n';
    }
    
    if (companyDocs.length > 0) {
      const docsLabel = language === 'ar' 
        ? 'سياسات الشركة ذات الصلة:' 
        : 'Relevant Company Policies:';
      contextPrompt += `${docsLabel}\n`;
      
      companyDocs.forEach((doc, index) => {
        contextPrompt += `\n${index + 1}. ${doc.content}\n`;
        contextPrompt += `(الصلة: ${(doc.score * 100).toFixed(0)}%)\n`;
      });
    }
    
    return contextPrompt;
  }

  /**
   * Create HR-specific system prompt
   */
  private async createHRSystemPrompt(language: 'ar' | 'en'): Promise<string> {
    if (language === 'ar') {
      return `أنت مستشار خبير في الموارد البشرية متخصص في القانون السعودي للعمل.

دورك:
- تقديم نصائح دقيقة ومفيدة في مجال الموارد البشرية للشركات السعودية
- ضمان الامتثال الكامل لنظام العمل السعودي ولوائحه التنفيذية
- تقديم إجابات واضحة ومفصلة باللغة العربية الفصحى
- عند وجود تضارب بين سياسة الشركة والقانون، يكون القانون السعودي له الأولوية المطلقة
- تضمين المصادر والمراجع القانونية في كل إجابة
- مراعاة الثقافة السعودية والأعراف المهنية المحلية

معايير الإجابة:
- الدقة القانونية: يجب أن تكون جميع المعلومات القانونية صحيحة ومحدثة
- الوضوح: استخدم لغة واضحة ومباشرة يفهمها غير المختصين
- التطبيق العملي: قدم خطوات عملية قابلة للتنفيذ
- الشمولية: غطِ جميع جوانب السؤال المطروح
- التوثيق: أشر إلى المواد القانونية والسياسات ذات الصلة

صيغة الإجابة JSON:
{
  "answer": "الإجابة الكاملة والمفصلة على السؤال",
  "confidence": 0.95,
  "reasoning": "شرح الأساس القانوني والمنطق المتبع في الإجابة",
  "recommendations": [
    "التوصية الأولى: خطوة عملية محددة",
    "التوصية الثانية: إجراء وقائي أو تحسيني"
  ]
}

ملاحظات مهمة:
- إذا كان السؤال غامضًا، اطلب توضيحًا
- إذا كانت المعلومات غير كافية، أشر إلى ذلك
- لا تقدم نصائح قانونية نهائية بل إرشادات عامة
- نبه إلى ضرورة مراجعة مستشار قانوني للحالات المعقدة`;
    } else {
      return `You are an expert HR consultant specializing in Saudi Arabian labor law.

Your role:
- Provide accurate and helpful HR advice for Saudi companies
- Ensure full compliance with Saudi Labor Law and its executive regulations
- Give clear, detailed answers in professional English
- When conflicts exist between company policy and law, Saudi Labor Law takes absolute precedence
- Include legal sources and references in every response
- Consider Saudi culture and local professional norms

Response criteria:
- Legal accuracy: All legal information must be correct and up-to-date
- Clarity: Use clear, direct language understandable by non-specialists
- Practical application: Provide actionable steps
- Comprehensiveness: Cover all aspects of the question
- Documentation: Reference relevant legal articles and policies

JSON Response format:
{
  "answer": "Complete and detailed answer to the question",
  "confidence": 0.95,
  "reasoning": "Explanation of legal basis and logic used",
  "recommendations": [
    "First recommendation: Specific actionable step",
    "Second recommendation: Preventive or improvement measure"
  ]
}

Important notes:
- If the question is ambiguous, request clarification
- If information is insufficient, indicate this
- Provide general guidance, not final legal advice
- Advise consulting a legal advisor for complex cases`;
    }
  }

  /**
   * Build messages array for OpenAI
   */
  private buildMessages(
    systemPrompt: string,
    contextPrompt: string,
    query: string,
    conversationContext: ConversationContext | null,
    language: 'ar' | 'en'
  ): any[] {
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add recent conversation history if available
    if (conversationContext && conversationContext.messageHistory.length > 0) {
      // Include last 3-5 exchanges for context
      const recentHistory = conversationContext.messageHistory.slice(-6);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }
    
    // Add current query with context
    const questionLabel = language === 'ar' ? 'السؤال:' : 'Question:';
    const contextLabel = language === 'ar' ? 'المعلومات المتاحة:' : 'Available Information:';
    
    messages.push({
      role: 'user',
      content: `${contextLabel}\n${contextPrompt}\n\n${questionLabel}\n${query}`,
    });
    
    return messages;
  }

  /**
   * Extract source attributions from response
   */
  private async extractSourceAttributions(
    answer: string,
    retrievedContent: RetrievalResult
  ): Promise<RAGResponse['sources']> {
    const sources: RAGResponse['sources'] = [];
    const addedSources = new Set<string>();
    
    // Check which sources are likely referenced in the answer
    for (const result of retrievedContent.results) {
      // Simple heuristic: check if key terms from source appear in answer
      const contentWords = result.content
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 10);
      
      const isReferenced = contentWords.some(word => 
        answer.toLowerCase().includes(word.toLowerCase())
      );
      
      if (isReferenced && !addedSources.has(result.id)) {
        sources.push({
          id: result.id,
          title: result.title,
          excerpt: result.content.substring(0, 200) + '...',
          source_type: result.source,
          article_number: result.article_number,
        });
        addedSources.add(result.id);
      }
      
      if (sources.length >= 5) break; // Limit sources
    }
    
    return sources;
  }

  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    originalQuery: string,
    answer: string,
    language: 'ar' | 'en'
  ): Promise<string[]> {
    try {
      const prompt = language === 'ar'
        ? `بناءً على السؤال التالي والإجابة المقدمة، اقترح 3 أسئلة متابعة مفيدة:
          
السؤال: ${originalQuery}
الإجابة: ${answer.substring(0, 500)}...

قدم الأسئلة في صيغة JSON:
{"questions": ["سؤال 1", "سؤال 2", "سؤال 3"]}`
        : `Based on the following question and answer, suggest 3 helpful follow-up questions:
          
Question: ${originalQuery}
Answer: ${answer.substring(0, 500)}...

Provide questions in JSON format:
{"questions": ["Question 1", "Question 2", "Question 3"]}`;
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });
      
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.questions || [];
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return [];
    }
  }

  /**
   * Validate response quality
   */
  async validateResponse(response: RAGResponse): Promise<boolean> {
    // Check for minimum response length
    if (response.answer.length < 50) {
      return false;
    }
    
    // Check for confidence threshold
    if (response.confidence < 0.5) {
      return false;
    }
    
    // Check for source attribution
    if (response.sources.length === 0) {
      console.warn('Response has no source attributions');
    }
    
    return true;
  }
}

// Export singleton instance
export const responseGenerationService = new ResponseGenerationService();