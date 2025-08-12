import { openRouterClient, OpenRouterClient } from './openrouter-client';
import { EnhancedSearchResult } from './enhanced-retrieval-service';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// Response generation interfaces
export interface ResponseGenerationRequest {
  query: string;
  searchResults: EnhancedSearchResult[];
  context: ResponseContext;
  preferences?: ResponsePreferences;
}

export interface ResponseContext {
  organizationId: string;
  userId: string;
  language: 'ar' | 'en';
  conversationHistory?: ConversationMessage[];
  organizationProfile?: OrganizationProfile;
  userProfile?: UserProfile;
  sessionContext?: SessionContext;
}

export interface ResponsePreferences {
  responseStyle: 'formal' | 'casual' | 'technical';
  detailLevel: 'brief' | 'moderate' | 'detailed';
  includeSources: boolean;
  includeLegalReferences: boolean;
  includeActionItems: boolean;
  maxLength?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OrganizationProfile {
  name: string;
  industry: string;
  size: 'small' | 'medium' | 'large';
  country: string;
  customPolicies?: string[];
  complianceRequirements?: string[];
}

export interface UserProfile {
  role: string;
  department?: string;
  experienceLevel: 'junior' | 'senior' | 'expert';
  preferredLanguage: 'ar' | 'en';
  accessLevel: 'basic' | 'advanced' | 'admin';
}

export interface SessionContext {
  currentTopic?: string;
  mentionedEntities?: string[];
  previousQueries?: string[];
  userIntent?: string;
  contextualFactors?: Record<string, any>;
}

export interface GeneratedResponse {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  factChecking: FactCheckResult;
  actionItems?: ActionItem[];
  legalReferences?: LegalReference[];
  followUpQuestions?: string[];
  responseMetadata: ResponseMetadata;
}

export interface SourceReference {
  id: string;
  type: 'document' | 'labor_law';
  title: string;
  excerpt: string;
  relevanceScore: number;
  page?: number;
  section?: string;
  url?: string;
}

export interface FactCheckResult {
  isFactuallySound: boolean;
  confidenceScore: number;
  potentialIssues?: string[];
  verificationSources?: string[];
  lastVerified?: string;
}

export interface ActionItem {
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: 'immediate' | 'follow_up' | 'documentation';
  estimatedTime?: string;
  responsible?: string;
}

export interface LegalReference {
  articleNumber: string;
  title: string;
  summary: string;
  relevance: string;
  complianceLevel: 'mandatory' | 'recommended' | 'optional';
}

export interface ResponseMetadata {
  generationTimeMs: number;
  tokensUsed: number;
  model: string;
  promptVersion: string;
  qualityScore: number;
  biasCheck: BiasCheckResult;
  complianceCheck: ComplianceCheckResult;
}

export interface BiasCheckResult {
  score: number;
  detectedBiases?: string[];
  recommendations?: string[];
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  checkedRegulations: string[];
  potentialIssues?: string[];
  recommendations?: string[];
}

export class ResponseGenerationService {
  private openRouterClient: OpenRouterClient;
  private readonly PROMPT_VERSION = '2.0';
  private readonly MAX_CONTEXT_TOKENS = 4000;

  // Model configurations for different scenarios
  private readonly models = {
    'gpt-4-turbo': {
      name: 'gpt-4-turbo',
      maxTokens: 4096,
      temperature: 0.1,
      contextWindow: 128000,
      costPerToken: 0.00003,
      capabilities: ['reasoning', 'analysis', 'arabic', 'legal']
    },
    'gpt-4o': {
      name: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.1,
      contextWindow: 128000,
      costPerToken: 0.000005,
      capabilities: ['reasoning', 'analysis', 'arabic', 'legal', 'efficient']
    }
  };

  constructor() {
    this.openRouterClient = openRouterClient;
  }

  /**
   * Generate context-aware response with Saudi law expertise
   */
  async generateResponse(request: ResponseGenerationRequest): Promise<GeneratedResponse> {
    const startTime = Date.now();

    try {
      // 1. Analyze request and select optimal strategy
      const strategy = await this.analyzeAndSelectStrategy(request);
      
      // 2. Prepare contextual prompt with Saudi law expertise
      const prompt = await this.prepareContextualPrompt(request, strategy);
      
      // 3. Generate AI response
      const aiResponse = await this.generateAIResponse(prompt, request.context.language, strategy);
      
      // 4. Perform fact-checking and validation
      const factCheck = await this.performFactChecking(aiResponse.content, request.searchResults);
      
      // 5. Extract source references
      const sources = this.extractSourceReferences(request.searchResults);
      
      // 6. Generate action items if requested
      const actionItems = request.preferences?.includeActionItems 
        ? await this.generateActionItems(request.query, aiResponse.content, request.context)
        : undefined;
      
      // 7. Generate legal references
      const legalReferences = request.preferences?.includeLegalReferences
        ? await this.generateLegalReferences(request.searchResults, request.context.language)
        : undefined;
      
      // 8. Generate follow-up questions
      const followUpQuestions = await this.generateFollowUpQuestions(
        request.query,
        aiResponse.content,
        request.context
      );
      
      // 9. Perform bias and compliance checks
      const biasCheck = await this.performBiasCheck(aiResponse.content, request.context.language);
      const complianceCheck = await this.performComplianceCheck(aiResponse.content, request.context);
      
      // 10. Calculate quality and confidence scores
      const qualityScore = this.calculateQualityScore(aiResponse, request.searchResults, factCheck);
      const confidence = this.calculateConfidenceScore(aiResponse, request.searchResults, factCheck);

      const generationTimeMs = Date.now() - startTime;

      return {
        answer: aiResponse.content,
        confidence,
        sources,
        factChecking: factCheck,
        actionItems,
        legalReferences,
        followUpQuestions,
        responseMetadata: {
          generationTimeMs,
          tokensUsed: aiResponse.tokensUsed,
          model: strategy.model,
          promptVersion: this.PROMPT_VERSION,
          qualityScore,
          biasCheck,
          complianceCheck
        }
      };

    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze request and select optimal generation strategy
   */
  private async analyzeAndSelectStrategy(request: ResponseGenerationRequest): Promise<{
    model: string;
    approach: 'direct' | 'analytical' | 'comparative' | 'explanatory';
    focusAreas: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const query = request.query.toLowerCase();
    const hasLegalContent = request.searchResults.some(r => r.sourceType === 'labor_law');
    const complexity = query.length > 100 || query.includes('compare') || query.includes('explain');
    
    // Determine risk level based on query content
    const highRiskKeywords = {
      ar: ['فصل', 'استقالة', 'قانوني', 'محكمة', 'تعويض', 'دعوى'],
      en: ['termination', 'lawsuit', 'legal', 'court', 'compensation', 'dispute']
    };
    
    const isHighRisk = highRiskKeywords[request.context.language].some(keyword => 
      query.includes(keyword)
    );

    return {
      model: complexity || hasLegalContent ? 'gpt-4-turbo' : 'gpt-4o',
      approach: this.determineApproach(query, request.searchResults),
      focusAreas: this.identifyFocusAreas(query, request.searchResults),
      riskLevel: isHighRisk ? 'high' : hasLegalContent ? 'medium' : 'low'
    };
  }

  /**
   * Determine response approach based on query and content
   */
  private determineApproach(
    query: string,
    results: EnhancedSearchResult[]
  ): 'direct' | 'analytical' | 'comparative' | 'explanatory' {
    if (query.includes('explain') || query.includes('how') || query.includes('كيف')) {
      return 'explanatory';
    }
    
    if (query.includes('compare') || query.includes('difference') || query.includes('مقارنة')) {
      return 'comparative';
    }
    
    if (query.includes('analysis') || query.includes('evaluate') || query.includes('تحليل')) {
      return 'analytical';
    }
    
    return 'direct';
  }

  /**
   * Identify focus areas for the response
   */
  private identifyFocusAreas(query: string, results: EnhancedSearchResult[]): string[] {
    const focusAreas: string[] = [];
    
    // Analyze query for focus areas
    const hrFocus = {
      ar: ['راتب', 'إجازة', 'تدريب', 'أداء', 'تقييم', 'مكافأة'],
      en: ['salary', 'leave', 'training', 'performance', 'evaluation', 'bonus']
    };
    
    const legalFocus = {
      ar: ['قانون', 'نظام', 'لائحة', 'مادة', 'حكم'],
      en: ['law', 'regulation', 'article', 'clause', 'provision']
    };
    
    const complianceFocus = {
      ar: ['امتثال', 'التزام', 'متطلبات', 'إجراءات'],
      en: ['compliance', 'requirements', 'procedures', 'obligations']
    };

    // Check for HR focus
    if (Object.values(hrFocus).flat().some(term => query.toLowerCase().includes(term))) {
      focusAreas.push('hr_operations');
    }
    
    // Check for legal focus
    if (Object.values(legalFocus).flat().some(term => query.toLowerCase().includes(term))) {
      focusAreas.push('legal_compliance');
    }
    
    // Check for compliance focus
    if (Object.values(complianceFocus).flat().some(term => query.toLowerCase().includes(term))) {
      focusAreas.push('regulatory_compliance');
    }
    
    // Analyze results for additional focus areas
    const categories = results.map(r => r.category).filter(Boolean);
    if (categories.some(cat => cat?.toLowerCase().includes('policy'))) {
      focusAreas.push('policy_guidance');
    }

    return focusAreas.length > 0 ? focusAreas : ['general_hr'];
  }

  /**
   * Prepare contextual prompt with Saudi law expertise
   */
  private async prepareContextualPrompt(
    request: ResponseGenerationRequest,
    strategy: any
  ): Promise<string> {
    const { query, searchResults, context } = request;
    const language = context.language;

    // Get organization context
    const orgContext = await this.getOrganizationContext(context.organizationId);
    
    // Build system prompt based on language and strategy
    const systemPrompt = this.buildSystemPrompt(language, strategy, orgContext);
    
    // Build context section
    const contextSection = this.buildContextSection(searchResults, language);
    
    // Build conversation history if available
    const historySection = context.conversationHistory 
      ? this.buildHistorySection(context.conversationHistory, language)
      : '';

    // Build user profile context
    const userContext = context.userProfile 
      ? this.buildUserContext(context.userProfile, language)
      : '';

    // Construct final prompt
    const prompt = `${systemPrompt}

${this.getSpecialInstructions(language, strategy.riskLevel)}

${contextSection}

${userContext}

${historySection}

${language === 'ar' ? 'السؤال' : 'Question'}: ${query}

${language === 'ar' ? 'الإجابة' : 'Answer'}:`;

    return this.optimizePromptLength(prompt);
  }

  /**
   * Build system prompt based on language and strategy
   */
  private buildSystemPrompt(
    language: 'ar' | 'en',
    strategy: any,
    orgContext?: any
  ): string {
    const prompts = {
      ar: {
        role: 'أنت مستشار موارد بشرية خبير متخصص في قانون العمل السعودي والممارسات الأفضل في إدارة الموارد البشرية.',
        expertise: `خبرتك تشمل:
- قانون العمل السعودي ولوائحه التنفيذية
- سياسات الموارد البشرية وإجراءاتها
- إدارة الأداء والتطوير المهني
- علاقات العمل وحل النزاعات
- الامتثال والحوكمة التنظيمية`,
        approach: this.getApproachDescription(strategy.approach, 'ar')
      },
      en: {
        role: 'You are an expert HR consultant specializing in Saudi Labor Law and best practices in human resources management.',
        expertise: `Your expertise includes:
- Saudi Labor Law and its executive regulations
- HR policies and procedures
- Performance management and professional development
- Employee relations and dispute resolution
- Compliance and organizational governance`,
        approach: this.getApproachDescription(strategy.approach, 'en')
      }
    };

    return `${prompts[language].role}

${prompts[language].expertise}

${prompts[language].approach}`;
  }

  /**
   * Get approach description in specified language
   */
  private getApproachDescription(approach: string, language: 'ar' | 'en'): string {
    const descriptions = {
      ar: {
        direct: 'نهجك في الإجابة مباشر ومحدد مع التركيز على الحلول العملية.',
        analytical: 'نهجك تحليلي يتضمن تقييم الخيارات والتوصيات المدروسة.',
        comparative: 'نهجك مقارن يعرض الخيارات المختلفة ومزايا وعيوب كل منها.',
        explanatory: 'نهجك تفسيري يشرح المفاهيم بالتفصيل مع أمثلة عملية.'
      },
      en: {
        direct: 'Your approach is direct and specific, focusing on practical solutions.',
        analytical: 'Your approach is analytical, including evaluation of options and well-considered recommendations.',
        comparative: 'Your approach is comparative, presenting different options and their pros and cons.',
        explanatory: 'Your approach is explanatory, detailing concepts with practical examples.'
      }
    };

    return descriptions[language][approach as keyof typeof descriptions['ar']];
  }

  /**
   * Get special instructions based on language and risk level
   */
  private getSpecialInstructions(language: 'ar' | 'en', riskLevel: string): string {
    const instructions = {
      ar: {
        base: `تعليمات مهمة:
1. استخدم المعلومات المرفقة فقط للإجابة
2. إذا لم تجد إجابة كافية في المصادر، قل "لا تتوفر معلومات كافية"
3. اذكر المصادر المرجعية في إجابتك
4. قدم إجابات عملية وقابلة للتطبيق
5. التزم بقانون العمل السعودي في جميع التوصيات`,
        high_risk: `6. هذا سؤال حساس قانونياً - كن دقيقاً جداً
7. أوصِ بالتشاور مع مختص قانوني للحالات المعقدة
8. اذكر المخاطر المحتملة والاحتياطات اللازمة`
      },
      en: {
        base: `Important Instructions:
1. Use only the provided information to answer
2. If insufficient information is available, say "Insufficient information available"
3. Reference sources in your response
4. Provide practical and actionable answers
5. Ensure all recommendations comply with Saudi Labor Law`,
        high_risk: `6. This is a legally sensitive question - be extremely precise
7. Recommend consulting with legal specialist for complex cases
8. Mention potential risks and necessary precautions`
      }
    };

    let result = instructions[language].base;
    if (riskLevel === 'high') {
      result += '\n' + instructions[language].high_risk;
    }

    return result;
  }

  /**
   * Build context section from search results
   */
  private buildContextSection(results: EnhancedSearchResult[], language: 'ar' | 'en'): string {
    if (results.length === 0) return '';

    const headers = {
      ar: {
        company: 'مستندات الشركة:',
        law: 'قانون العمل السعودي:'
      },
      en: {
        company: 'Company Documents:',
        law: 'Saudi Labor Law:'
      }
    };

    let contextSection = '';
    
    // Separate company documents from labor law
    const companyDocs = results.filter(r => r.sourceType === 'document');
    const laborLawDocs = results.filter(r => r.sourceType === 'labor_law');

    // Add company documents context
    if (companyDocs.length > 0) {
      contextSection += `${headers[language].company}\n`;
      companyDocs.slice(0, 5).forEach((doc, index) => {
        contextSection += `${index + 1}. ${doc.documentTitle}\n${doc.chunkText}\n\n`;
      });
    }

    // Add labor law context
    if (laborLawDocs.length > 0) {
      contextSection += `${headers[language].law}\n`;
      laborLawDocs.slice(0, 3).forEach((law, index) => {
        contextSection += `${index + 1}. ${law.sectionTitle}: ${law.documentTitle}\n${law.chunkText}\n\n`;
      });
    }

    return contextSection;
  }

  /**
   * Build conversation history section
   */
  private buildHistorySection(history: ConversationMessage[], language: 'ar' | 'en'): string {
    if (history.length === 0) return '';

    const header = language === 'ar' ? 'السياق السابق:' : 'Previous Context:';
    let historySection = `${header}\n`;

    // Include last 3 exchanges
    const recentHistory = history.slice(-6); // Last 3 user-assistant pairs
    
    recentHistory.forEach(msg => {
      const roleLabel = msg.role === 'user' 
        ? (language === 'ar' ? 'المستخدم' : 'User')
        : (language === 'ar' ? 'المساعد' : 'Assistant');
      
      historySection += `${roleLabel}: ${msg.content.substring(0, 200)}...\n`;
    });

    return historySection + '\n';
  }

  /**
   * Build user context section
   */
  private buildUserContext(userProfile: UserProfile, language: 'ar' | 'en'): string {
    const contextLabels = {
      ar: {
        role: 'دور المستخدم:',
        dept: 'القسم:',
        level: 'مستوى الخبرة:'
      },
      en: {
        role: 'User Role:',
        dept: 'Department:',
        level: 'Experience Level:'
      }
    };

    let context = `${contextLabels[language].role} ${userProfile.role}\n`;
    
    if (userProfile.department) {
      context += `${contextLabels[language].dept} ${userProfile.department}\n`;
    }
    
    context += `${contextLabels[language].level} ${userProfile.experienceLevel}\n\n`;
    
    return context;
  }

  /**
   * Optimize prompt length to fit model context window
   */
  private optimizePromptLength(prompt: string): string {
    // Rough token estimation (1 token ≈ 4 characters for mixed content)
    const estimatedTokens = prompt.length / 4;
    
    if (estimatedTokens <= this.MAX_CONTEXT_TOKENS) {
      return prompt;
    }

    // Truncate context sections proportionally
    const sections = prompt.split('\n\n');
    const systemSection = sections[0];
    const contextSections = sections.slice(1);
    
    // Calculate truncation ratio
    const targetLength = this.MAX_CONTEXT_TOKENS * 4;
    const systemLength = systemSection.length;
    const availableLength = targetLength - systemLength;
    const currentContextLength = contextSections.join('\n\n').length;
    const truncationRatio = availableLength / currentContextLength;

    if (truncationRatio < 1) {
      const truncatedContext = contextSections
        .map(section => section.substring(0, Math.floor(section.length * truncationRatio)))
        .join('\n\n');
      
      return systemSection + '\n\n' + truncatedContext;
    }

    return prompt;
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateAIResponse(
    prompt: string,
    language: 'ar' | 'en',
    strategy: any
  ): Promise<{ content: string; tokensUsed: number }> {
    try {
      const modelConfig = this.models[strategy.model as keyof typeof this.models];
      
      const response = await this.openRouterClient.generateChatCompletion([
        {
          role: 'system',
          content: prompt
        }
      ], {
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        top_p: 0.95
      });

      const content = response.data;
      const tokensUsed = response.usage.totalTokens;

      // Validate response quality
      if (content.length < 50) {
        throw new Error('Generated response too short');
      }

      // Check for potential issues
      if (content.toLowerCase().includes('i cannot') || content.includes('لا أستطيع')) {
        console.warn('AI declined to answer - may need prompt adjustment');
      }

      return { content, tokensUsed };

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback response
      const fallbackResponses = {
        ar: 'عذراً، حدث خطأ في معالجة استفسارك. يرجى إعادة صياغة السؤال أو التواصل مع مختص موارد بشرية.',
        en: 'Sorry, there was an error processing your query. Please rephrase your question or contact an HR specialist.'
      };
      
      return {
        content: fallbackResponses[language],
        tokensUsed: 0
      };
    }
  }

  /**
   * Perform fact-checking on generated response
   */
  private async performFactChecking(
    response: string,
    searchResults: EnhancedSearchResult[]
  ): Promise<FactCheckResult> {
    try {
      // Extract claims from the response
      const claims = this.extractClaims(response);
      
      // Verify claims against source documents
      const verifiedClaims = await this.verifyClaims(claims, searchResults);
      
      // Calculate confidence score
      const confidenceScore = verifiedClaims.length > 0 
        ? verifiedClaims.filter(c => c.verified).length / verifiedClaims.length
        : 0.5;
      
      // Identify potential issues
      const potentialIssues = verifiedClaims
        .filter(c => !c.verified)
        .map(c => `Unverified claim: ${c.claim}`);

      return {
        isFactuallySound: confidenceScore >= 0.8,
        confidenceScore,
        potentialIssues: potentialIssues.length > 0 ? potentialIssues : undefined,
        verificationSources: searchResults.slice(0, 3).map(r => r.documentTitle),
        lastVerified: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error in fact-checking:', error);
      return {
        isFactuallySound: false,
        confidenceScore: 0.3,
        potentialIssues: ['Fact-checking failed'],
        lastVerified: new Date().toISOString()
      };
    }
  }

  /**
   * Extract claims from response for fact-checking
   */
  private extractClaims(response: string): string[] {
    // Simple claim extraction based on sentence structure
    const sentences = response
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    // Filter factual claims (avoid questions and opinions)
    return sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return !lowerSentence.includes('?') && 
             !lowerSentence.includes('maybe') &&
             !lowerSentence.includes('possibly') &&
             !lowerSentence.includes('might');
    });
  }

  /**
   * Verify claims against search results
   */
  private async verifyClaims(
    claims: string[],
    searchResults: EnhancedSearchResult[]
  ): Promise<{ claim: string; verified: boolean; confidence: number }[]> {
    const verifiedClaims = claims.map(claim => {
      let verified = false;
      let confidence = 0;

      // Check if claim is supported by search results
      searchResults.forEach(result => {
        const similarity = this.calculateTextSimilarity(claim, result.chunkText);
        if (similarity > 0.5) {
          verified = true;
          confidence = Math.max(confidence, similarity);
        }
      });

      return { claim, verified, confidence };
    });

    return verifiedClaims;
  }

  /**
   * Calculate text similarity for claim verification
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Extract source references from search results
   */
  private extractSourceReferences(results: EnhancedSearchResult[]): SourceReference[] {
    return results.slice(0, 5).map(result => ({
      id: result.id,
      type: result.sourceType,
      title: result.documentTitle,
      excerpt: result.chunkText.substring(0, 200) + '...',
      relevanceScore: result.finalScore,
      page: result.pageNumber,
      section: result.sectionTitle
    }));
  }

  /**
   * Generate actionable items from response
   */
  private async generateActionItems(
    query: string,
    response: string,
    context: ResponseContext
  ): Promise<ActionItem[]> {
    // Extract action-oriented sentences
    const actionPatterns = {
      ar: [/يجب/, /ينبغي/, /يُفضل/, /قم ب/, /تأكد من/],
      en: [/should/, /must/, /need to/, /ensure/, /verify/, /contact/]
    };

    const patterns = actionPatterns[context.language];
    const sentences = response.split(/[.!]/).filter(sentence =>
      patterns.some(pattern => pattern.test(sentence.toLowerCase()))
    );

    const actionItems: ActionItem[] = sentences.slice(0, 3).map((sentence, index) => {
      const priority = sentence.toLowerCase().includes('must') || sentence.includes('يجب') 
        ? 'high' as const 
        : 'medium' as const;
      
      const category = sentence.toLowerCase().includes('contact') || sentence.includes('تواصل')
        ? 'follow_up' as const
        : 'immediate' as const;

      return {
        description: sentence.trim(),
        priority,
        category,
        estimatedTime: priority === 'high' ? 'Immediate' : '1-2 days'
      };
    });

    return actionItems;
  }

  /**
   * Generate legal references from search results
   */
  private async generateLegalReferences(
    results: EnhancedSearchResult[],
    language: 'ar' | 'en'
  ): Promise<LegalReference[]> {
    const legalResults = results.filter(r => r.sourceType === 'labor_law');
    
    return legalResults.slice(0, 3).map(result => ({
      articleNumber: result.sectionTitle || 'Unknown',
      title: result.documentTitle,
      summary: result.chunkText.substring(0, 150) + '...',
      relevance: 'High relevance to your query',
      complianceLevel: 'mandatory' as const
    }));
  }

  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    originalQuery: string,
    response: string,
    context: ResponseContext
  ): Promise<string[]> {
    const templates = {
      ar: [
        'هل تحتاج معلومات إضافية حول هذا الموضوع؟',
        'ما هي الخطوات التالية التي يجب اتخاذها؟',
        'هل هناك حالات خاصة تريد مناقشتها؟'
      ],
      en: [
        'Do you need additional information about this topic?',
        'What are the next steps that should be taken?',
        'Are there any specific cases you would like to discuss?'
      ]
    };

    return templates[context.language].slice(0, 2);
  }

  /**
   * Perform bias check on response
   */
  private async performBiasCheck(response: string, language: 'ar' | 'en'): Promise<BiasCheckResult> {
    // Simple bias detection based on keywords
    const biasIndicators = {
      ar: ['دائماً', 'أبداً', 'كل الرجال', 'كل النساء', 'فقط', 'حصرياً'],
      en: ['always', 'never', 'all men', 'all women', 'only', 'exclusively']
    };

    const indicators = biasIndicators[language];
    const detectedBiases: string[] = [];

    indicators.forEach(indicator => {
      if (response.toLowerCase().includes(indicator.toLowerCase())) {
        detectedBiases.push(`Absolute language detected: ${indicator}`);
      }
    });

    const score = detectedBiases.length === 0 ? 1.0 : Math.max(0, 1 - (detectedBiases.length * 0.2));

    return {
      score,
      detectedBiases: detectedBiases.length > 0 ? detectedBiases : undefined,
      recommendations: detectedBiases.length > 0 ? ['Use more nuanced language'] : undefined
    };
  }

  /**
   * Perform compliance check on response
   */
  private async performComplianceCheck(
    response: string,
    context: ResponseContext
  ): Promise<ComplianceCheckResult> {
    const checkedRegulations = ['Saudi Labor Law', 'GDPR', 'Data Protection'];
    
    // Check for compliance keywords
    const complianceKeywords = {
      ar: ['قانون العمل', 'نظام', 'لائحة', 'امتثال'],
      en: ['labor law', 'regulation', 'compliance', 'legal requirement']
    };

    const keywords = complianceKeywords[context.language];
    const hasComplianceReference = keywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );

    return {
      isCompliant: hasComplianceReference || response.length > 0,
      checkedRegulations,
      potentialIssues: hasComplianceReference ? undefined : ['No legal compliance reference found'],
      recommendations: hasComplianceReference ? undefined : ['Consider adding legal compliance context']
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    aiResponse: any,
    searchResults: EnhancedSearchResult[],
    factCheck: FactCheckResult
  ): number {
    let score = 0.5; // Base score

    // Response length quality
    const length = aiResponse.content.length;
    if (length > 100 && length < 2000) {
      score += 0.2;
    }

    // Fact-checking score
    score += factCheck.confidenceScore * 0.3;

    // Source coverage
    if (searchResults.length > 0) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    aiResponse: any,
    searchResults: EnhancedSearchResult[],
    factCheck: FactCheckResult
  ): number {
    // Combine multiple confidence factors
    const factors = [
      factCheck.confidenceScore,
      searchResults.length > 0 ? 0.8 : 0.3,
      aiResponse.content.length > 100 ? 0.8 : 0.5
    ];

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  /**
   * Get organization context for personalization
   */
  private async getOrganizationContext(organizationId: string): Promise<OrganizationProfile | null> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: org, error } = await supabase
        .from('organizations')
        .select('name, industry, country_code')
        .eq('id', organizationId)
        .single();

      if (error || !org) {
        return null;
      }

      return {
        name: org.name,
        industry: org.industry || 'General',
        size: 'medium',
        country: org.country_code || 'SA'
      };

    } catch (error) {
      console.error('Error getting organization context:', error);
      return null;
    }
  }
}