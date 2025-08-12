import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { OpenAI } from 'openai';

// Context management interfaces
export interface ConversationContext {
  conversationId: string;
  organizationId: string;
  userId: string;
  currentTopic: string;
  subTopics: string[];
  mentionedEntities: Entity[];
  userIntent: Intent;
  language: 'ar' | 'en';
  sessionMetadata: SessionMetadata;
  contextHistory: ContextHistory[];
  activeMemory: ActiveMemory;
  relevanceScore: number;
}

export interface Entity {
  name: string;
  type: 'person' | 'policy' | 'document' | 'law' | 'department' | 'date' | 'amount';
  value: string;
  confidence: number;
  firstMentioned: string;
  lastMentioned: string;
  frequency: number;
}

export interface Intent {
  primary: 'question' | 'request' | 'clarification' | 'follow_up' | 'complaint';
  secondary?: string;
  confidence: number;
  parameters?: Record<string, any>;
  isMultiPart: boolean;
}

export interface SessionMetadata {
  startTime: string;
  lastActivity: string;
  messageCount: number;
  topicSwitches: number;
  averageResponseTime: number;
  userSatisfactionScore?: number;
  preferredResponseStyle: 'brief' | 'detailed' | 'balanced';
}

export interface ContextHistory {
  timestamp: string;
  topic: string;
  entities: Entity[];
  intent: Intent;
  queryType: string;
  resolved: boolean;
  followUpGenerated: boolean;
}

export interface ActiveMemory {
  shortTerm: MemoryItem[];
  longTerm: MemoryItem[];
  workingContext: WorkingContext;
  retrievalCues: string[];
}

export interface MemoryItem {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'context' | 'unresolved';
  importance: number;
  lastAccessed: string;
  accessCount: number;
  decayFactor: number;
}

export interface WorkingContext {
  currentFocus: string;
  relatedConcepts: string[];
  pendingQuestions: string[];
  assumedKnowledge: string[];
  contextualConstraints: string[];
}

export interface ContextOptimizationResult {
  optimizedContext: string;
  tokenCount: number;
  compressionRatio: number;
  preservedElements: string[];
  discardedElements: string[];
  qualityScore: number;
}

export interface ConversationSummary {
  conversationId: string;
  duration: number;
  messageCount: number;
  topicsDiscussed: string[];
  keyDecisions: string[];
  actionItems: string[];
  satisfactionScore?: number;
  language: 'ar' | 'en';
  createdAt: string;
}

export class ConversationContextService {
  private openai: OpenAI;
  private readonly MAX_SHORT_TERM_MEMORY = 20;
  private readonly MAX_LONG_TERM_MEMORY = 100;
  private readonly CONTEXT_WINDOW_TOKENS = 4000;
  private readonly DECAY_RATE = 0.1;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Initialize new conversation context
   */
  async initializeConversation(
    organizationId: string,
    userId: string,
    language: 'ar' | 'en'
  ): Promise<ConversationContext> {
    const conversationId = crypto.randomUUID();
    const currentTime = new Date().toISOString();

    const context: ConversationContext = {
      conversationId,
      organizationId,
      userId,
      currentTopic: '',
      subTopics: [],
      mentionedEntities: [],
      userIntent: {
        primary: 'question',
        confidence: 0.5,
        isMultiPart: false
      },
      language,
      sessionMetadata: {
        startTime: currentTime,
        lastActivity: currentTime,
        messageCount: 0,
        topicSwitches: 0,
        averageResponseTime: 0,
        preferredResponseStyle: 'balanced'
      },
      contextHistory: [],
      activeMemory: {
        shortTerm: [],
        longTerm: [],
        workingContext: {
          currentFocus: '',
          relatedConcepts: [],
          pendingQuestions: [],
          assumedKnowledge: [],
          contextualConstraints: []
        },
        retrievalCues: []
      },
      relevanceScore: 1.0
    };

    await this.persistContext(context);
    return context;
  }

  /**
   * Update conversation context with new message
   */
  async updateContext(
    conversationId: string,
    message: string,
    role: 'user' | 'assistant',
    metadata?: Record<string, any>
  ): Promise<ConversationContext> {
    let context = await this.loadContext(conversationId);
    if (!context) {
      throw new Error('Conversation context not found');
    }

    const currentTime = new Date().toISOString();

    if (role === 'user') {
      // Process user message
      context = await this.processUserMessage(context, message, metadata);
    } else {
      // Process assistant response
      context = await this.processAssistantResponse(context, message, metadata);
    }

    // Update session metadata
    context.sessionMetadata.lastActivity = currentTime;
    context.sessionMetadata.messageCount += 1;

    // Apply memory decay
    context = await this.applyMemoryDecay(context);

    // Optimize context if needed
    if (this.shouldOptimizeContext(context)) {
      context = await this.optimizeContext(context);
    }

    await this.persistContext(context);
    return context;
  }

  /**
   * Process user message and extract context
   */
  private async processUserMessage(
    context: ConversationContext,
    message: string,
    metadata?: Record<string, any>
  ): Promise<ConversationContext> {
    
    // Extract entities from message
    const entities = await this.extractEntities(message, context.language);
    
    // Update mentioned entities
    entities.forEach(entity => {
      const existing = context.mentionedEntities.find(e => 
        e.name === entity.name && e.type === entity.type
      );
      
      if (existing) {
        existing.frequency += 1;
        existing.lastMentioned = new Date().toISOString();
        existing.confidence = Math.max(existing.confidence, entity.confidence);
      } else {
        context.mentionedEntities.push({
          ...entity,
          firstMentioned: new Date().toISOString(),
          lastMentioned: new Date().toISOString(),
          frequency: 1
        });
      }
    });

    // Classify intent
    const intent = await this.classifyIntent(message, context);
    context.userIntent = intent;

    // Determine topic
    const topic = await this.identifyTopic(message, context);
    
    // Check for topic switch
    if (context.currentTopic && context.currentTopic !== topic) {
      context.sessionMetadata.topicSwitches += 1;
      context.contextHistory.push({
        timestamp: new Date().toISOString(),
        topic: context.currentTopic,
        entities: [...context.mentionedEntities],
        intent: { ...context.userIntent },
        queryType: 'topic_switch',
        resolved: false,
        followUpGenerated: false
      });
    }
    
    context.currentTopic = topic;

    // Update working context
    await this.updateWorkingContext(context, message, 'user');

    // Add to short-term memory
    this.addToMemory(context, {
      id: crypto.randomUUID(),
      content: message,
      type: 'context',
      importance: this.calculateImportance(message, context),
      lastAccessed: new Date().toISOString(),
      accessCount: 1,
      decayFactor: 1.0
    }, 'short');

    return context;
  }

  /**
   * Process assistant response
   */
  private async processAssistantResponse(
    context: ConversationContext,
    response: string,
    metadata?: Record<string, any>
  ): Promise<ConversationContext> {
    
    // Update working context based on response
    await this.updateWorkingContext(context, response, 'assistant');

    // Extract any new facts or information to remember
    const facts = await this.extractFacts(response, context.language);
    facts.forEach(fact => {
      this.addToMemory(context, {
        id: crypto.randomUUID(),
        content: fact,
        type: 'fact',
        importance: 0.8,
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        decayFactor: 0.9 // Facts decay slower
      }, 'long');
    });

    // Check if user query was resolved
    const resolved = await this.assessQueryResolution(response, context);
    if (resolved && context.contextHistory.length > 0) {
      const lastHistory = context.contextHistory[context.contextHistory.length - 1];
      lastHistory.resolved = true;
    }

    return context;
  }

  /**
   * Extract entities from text using NLP
   */
  private async extractEntities(text: string, language: 'ar' | 'en'): Promise<Entity[]> {
    const entities: Entity[] = [];

    // HR-specific entity patterns
    const patterns = {
      ar: {
        person: /(?:السيد|الأستاذ|المدير|الموظف)\s+([أ-ي\s]+)/g,
        department: /(?:قسم|إدارة|شعبة)\s+([أ-ي\s]+)/g,
        policy: /(?:سياسة|نظام|لائحة)\s+([أ-ي\s]+)/g,
        date: /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g,
        amount: /\d+(?:،\d{3})*(?:\.\d{2})?\s*(?:ريال|درهم|دولار)/g
      },
      en: {
        person: /(?:Mr|Ms|Mrs|Dr|Manager|Employee)\s+([A-Za-z\s]+)/gi,
        department: /(?:Department|Division|Team)\s+(?:of\s+)?([A-Za-z\s]+)/gi,
        policy: /(?:Policy|Procedure|Regulation)\s+(?:on\s+|for\s+)?([A-Za-z\s]+)/gi,
        date: /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},?\s+\d{4}/g,
        amount: /\$?\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|SAR|AED|dollars?|riyals?)/gi
      }
    };

    const langPatterns = patterns[language];

    // Extract each entity type
    Object.entries(langPatterns).forEach(([type, pattern]) => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          name: match[1] || match[0],
          type: type as Entity['type'],
          value: match[0],
          confidence: 0.8
        } as Entity);
      }
    });

    return entities;
  }

  /**
   * Classify user intent
   */
  private async classifyIntent(message: string, context: ConversationContext): Promise<Intent> {
    const lowerMessage = message.toLowerCase();
    
    // Intent classification patterns
    const intentPatterns = {
      ar: {
        question: ['ما هو', 'ما هي', 'كيف', 'متى', 'أين', 'لماذا', 'هل'],
        request: ['أريد', 'أحتاج', 'يرجى', 'من فضلك', 'ساعدني'],
        clarification: ['ماذا تعني', 'اشرح لي', 'وضح', 'لا أفهم'],
        follow_up: ['وماذا عن', 'أيضاً', 'بالإضافة إلى ذلك', 'علاوة على ذلك'],
        complaint: ['مشكلة', 'شكوى', 'غير راض', 'اعتراض', 'خطأ']
      },
      en: {
        question: ['what is', 'what are', 'how', 'when', 'where', 'why', 'can you'],
        request: ['i need', 'i want', 'please', 'could you', 'help me'],
        clarification: ['what do you mean', 'explain', 'clarify', 'i dont understand'],
        follow_up: ['what about', 'also', 'additionally', 'furthermore', 'and'],
        complaint: ['problem', 'complaint', 'issue', 'wrong', 'error', 'dissatisfied']
      }
    };

    const patterns = intentPatterns[context.language];
    let primaryIntent: Intent['primary'] = 'question';
    let confidence = 0.5;
    let isMultiPart = false;

    // Check for intent patterns
    Object.entries(patterns).forEach(([intent, keywords]) => {
      const matchCount = keywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      if (matchCount > 0) {
        const intentConfidence = Math.min(matchCount * 0.3, 1.0);
        if (intentConfidence > confidence) {
          primaryIntent = intent as Intent['primary'];
          confidence = intentConfidence;
        }
      }
    });

    // Check for multi-part questions
    const conjunctions = context.language === 'ar' 
      ? ['و', 'أو', 'لكن', 'أيضاً']
      : ['and', 'or', 'but', 'also'];
    
    isMultiPart = conjunctions.some(conj => lowerMessage.includes(conj)) ||
                  (message.split(/[.?!]/).length > 2);

    return {
      primary: primaryIntent,
      confidence,
      isMultiPart,
      parameters: this.extractIntentParameters(message, primaryIntent)
    };
  }

  /**
   * Extract parameters from intent
   */
  private extractIntentParameters(message: string, intent: Intent['primary']): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (intent === 'request') {
      // Extract what is being requested
      const requestPatterns = /(?:i need|i want|please|أريد|أحتاج)\s+(.+?)(?:\.|$)/gi;
      const match = requestPatterns.exec(message);
      if (match) {
        parameters.requestedItem = match[1].trim();
      }
    }

    if (intent === 'question') {
      // Extract question focus
      const questionWords = ['what', 'how', 'when', 'where', 'why', 'ما', 'كيف', 'متى', 'أين', 'لماذا'];
      const focusWord = questionWords.find(word => message.toLowerCase().includes(word));
      if (focusWord) {
        parameters.questionType = focusWord;
      }
    }

    return parameters;
  }

  /**
   * Identify conversation topic
   */
  private async identifyTopic(message: string, context: ConversationContext): Promise<string> {
    // HR topic classification
    const topicKeywords = {
      ar: {
        'الرواتب والمزايا': ['راتب', 'مرتب', 'أجر', 'مكافأة', 'علاوة', 'بدل', 'تأمين'],
        'الإجازات والغياب': ['إجازة', 'عطلة', 'غياب', 'مرض', 'أمومة', 'سنوية'],
        'عقود العمل': ['عقد', 'توظيف', 'تعيين', 'استقالة', 'فصل', 'إنهاء خدمة'],
        'التدريب والتطوير': ['تدريب', 'تطوير', 'دورة', 'مهارات', 'شهادة', 'تأهيل'],
        'الأداء والتقييم': ['أداء', 'تقييم', 'مراجعة', 'هدف', 'إنجاز', 'ترقية'],
        'الامتثال والقوانين': ['قانون', 'نظام', 'لائحة', 'امتثال', 'التزام', 'مخالفة'],
        'علاقات العمل': ['شكوى', 'نزاع', 'وساطة', 'تظلم', 'حل خلافات']
      },
      en: {
        'compensation_benefits': ['salary', 'wage', 'pay', 'bonus', 'allowance', 'insurance', 'benefits'],
        'leave_absence': ['leave', 'vacation', 'absence', 'sick', 'maternity', 'annual'],
        'employment_contracts': ['contract', 'employment', 'hiring', 'resignation', 'termination', 'end of service'],
        'training_development': ['training', 'development', 'course', 'skills', 'certificate', 'qualification'],
        'performance_evaluation': ['performance', 'evaluation', 'review', 'goal', 'achievement', 'promotion'],
        'compliance_legal': ['law', 'regulation', 'compliance', 'legal', 'violation', 'requirement'],
        'employee_relations': ['complaint', 'dispute', 'mediation', 'grievance', 'conflict resolution']
      }
    };

    const keywords = topicKeywords[context.language];
    const lowerMessage = message.toLowerCase();

    let bestTopic = 'general_inquiry';
    let maxMatches = 0;

    Object.entries(keywords).forEach(([topic, words]) => {
      const matches = words.filter(word => lowerMessage.includes(word.toLowerCase())).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestTopic = topic;
      }
    });

    return bestTopic;
  }

  /**
   * Update working context with new information
   */
  private async updateWorkingContext(
    context: ConversationContext,
    message: string,
    role: 'user' | 'assistant'
  ): Promise<void> {
    const workingContext = context.activeMemory.workingContext;

    if (role === 'user') {
      // Extract focus from user message
      workingContext.currentFocus = await this.extractFocus(message, context.language);
      
      // Update retrieval cues
      const cues = this.extractRetrievalCues(message, context.language);
      context.activeMemory.retrievalCues.push(...cues);
      
      // Keep only recent cues
      context.activeMemory.retrievalCues = context.activeMemory.retrievalCues.slice(-10);

    } else {
      // Update assumed knowledge based on assistant response
      const assumptions = this.extractAssumptions(message, context.language);
      workingContext.assumedKnowledge.push(...assumptions);
      
      // Keep only relevant assumptions
      workingContext.assumedKnowledge = workingContext.assumedKnowledge.slice(-5);
    }

    // Update related concepts
    const concepts = await this.extractConcepts(message, context.language);
    workingContext.relatedConcepts.push(...concepts);
    workingContext.relatedConcepts = [...new Set(workingContext.relatedConcepts)].slice(-10);
  }

  /**
   * Extract focus from message
   */
  private async extractFocus(message: string, language: 'ar' | 'en'): Promise<string> {
    // Simple focus extraction based on main nouns
    const focusPatterns = {
      ar: /(?:عن|حول|بخصوص)\s+([أ-ي\s]+)/,
      en: /(?:about|regarding|concerning)\s+([a-zA-Z\s]+)/i
    };

    const pattern = focusPatterns[language];
    const match = pattern.exec(message);
    
    return match ? match[1].trim() : this.extractMainNoun(message, language);
  }

  /**
   * Extract main noun from message
   */
  private extractMainNoun(message: string, language: 'ar' | 'en'): string {
    // Simplified noun extraction
    const words = message.split(/\s+/);
    const commonNouns = {
      ar: ['راتب', 'إجازة', 'عقد', 'تدريب', 'أداء', 'قانون', 'سياسة'],
      en: ['salary', 'leave', 'contract', 'training', 'performance', 'law', 'policy']
    };

    const nouns = commonNouns[language];
    for (const word of words) {
      if (nouns.some(noun => word.toLowerCase().includes(noun))) {
        return word;
      }
    }

    return words.find(word => word.length > 3) || 'general';
  }

  /**
   * Extract retrieval cues
   */
  private extractRetrievalCues(message: string, language: 'ar' | 'en'): string[] {
    const words = message.toLowerCase().split(/\s+/);
    const stopWords = {
      ar: ['في', 'من', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي'],
      en: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    };

    return words
      .filter(word => word.length > 3)
      .filter(word => !stopWords[language].includes(word))
      .slice(0, 5);
  }

  /**
   * Extract concepts from message
   */
  private async extractConcepts(message: string, language: 'ar' | 'en'): Promise<string[]> {
    // Extract key concepts using keyword matching
    const conceptKeywords = {
      ar: {
        'تعويضات': ['راتب', 'أجر', 'مكافأة', 'تعويض'],
        'إجازات': ['إجازة', 'عطلة', 'غياب', 'راحة'],
        'قوانين': ['قانون', 'نظام', 'لائحة', 'تشريع'],
        'أداء': ['تقييم', 'أداء', 'مراجعة', 'هدف']
      },
      en: {
        'compensation': ['salary', 'pay', 'wage', 'bonus', 'compensation'],
        'leave': ['leave', 'vacation', 'absence', 'time off'],
        'legal': ['law', 'regulation', 'legal', 'compliance'],
        'performance': ['performance', 'evaluation', 'review', 'goal']
      }
    };

    const concepts: string[] = [];
    const keywords = conceptKeywords[language];
    const lowerMessage = message.toLowerCase();

    Object.entries(keywords).forEach(([concept, words]) => {
      if (words.some(word => lowerMessage.includes(word))) {
        concepts.push(concept);
      }
    });

    return concepts;
  }

  /**
   * Extract assumptions from assistant response
   */
  private extractAssumptions(response: string, language: 'ar' | 'en'): string[] {
    const assumptionPatterns = {
      ar: [
        /كما تعلم/gi,
        /بالطبع/gi,
        /من المؤكد/gi,
        /كما هو معروف/gi
      ],
      en: [
        /as you know/gi,
        /of course/gi,
        /obviously/gi,
        /clearly/gi,
        /as mentioned/gi
      ]
    };

    const patterns = assumptionPatterns[language];
    const assumptions: string[] = [];

    patterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        assumptions.push(...matches);
      }
    });

    return assumptions;
  }

  /**
   * Extract facts from assistant response
   */
  private async extractFacts(response: string, language: 'ar' | 'en'): Promise<string[]> {
    // Extract factual statements
    const sentences = response
      .split(/[.!]/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // Filter for factual statements (avoid questions and opinions)
    const facts = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return !lowerSentence.includes('?') && 
             !lowerSentence.includes('might') &&
             !lowerSentence.includes('could') &&
             !lowerSentence.includes('يمكن') &&
             !lowerSentence.includes('ربما');
    });

    return facts.slice(0, 3); // Keep top 3 facts
  }

  /**
   * Assess if user query was resolved
   */
  private async assessQueryResolution(response: string, context: ConversationContext): Promise<boolean> {
    // Simple resolution assessment
    const resolutionIndicators = {
      ar: ['نعم', 'إجابة', 'حل', 'واضح', 'مفهوم'],
      en: ['yes', 'answer', 'solution', 'clear', 'resolved', 'complete']
    };

    const indicators = resolutionIndicators[context.language];
    const lowerResponse = response.toLowerCase();

    return indicators.some(indicator => lowerResponse.includes(indicator)) &&
           response.length > 50; // Substantial response
  }

  /**
   * Calculate importance score for memory item
   */
  private calculateImportance(content: string, context: ConversationContext): number {
    let importance = 0.5; // Base importance

    // Longer content might be more important
    if (content.length > 100) importance += 0.2;

    // Contains entities
    const entityCount = context.mentionedEntities.filter(entity =>
      content.toLowerCase().includes(entity.name.toLowerCase())
    ).length;
    importance += Math.min(entityCount * 0.1, 0.3);

    // Recent in conversation
    if (context.sessionMetadata.messageCount <= 3) {
      importance += 0.2;
    }

    // Related to current topic
    if (content.toLowerCase().includes(context.currentTopic.toLowerCase())) {
      importance += 0.2;
    }

    return Math.min(importance, 1.0);
  }

  /**
   * Add item to memory (short-term or long-term)
   */
  private addToMemory(
    context: ConversationContext,
    item: MemoryItem,
    memoryType: 'short' | 'long'
  ): void {
    const memory = memoryType === 'short' 
      ? context.activeMemory.shortTerm 
      : context.activeMemory.longTerm;

    const maxSize = memoryType === 'short' 
      ? this.MAX_SHORT_TERM_MEMORY 
      : this.MAX_LONG_TERM_MEMORY;

    // Add to memory
    memory.push(item);

    // Remove least important items if over capacity
    if (memory.length > maxSize) {
      memory.sort((a, b) => (b.importance * b.decayFactor) - (a.importance * a.decayFactor));
      memory.splice(maxSize);
    }
  }

  /**
   * Apply memory decay over time
   */
  private async applyMemoryDecay(context: ConversationContext): Promise<ConversationContext> {
    const now = new Date();

    // Apply decay to short-term memory
    context.activeMemory.shortTerm.forEach(item => {
      const timeDiff = now.getTime() - new Date(item.lastAccessed).getTime();
      const hoursElapsed = timeDiff / (1000 * 60 * 60);
      item.decayFactor *= Math.exp(-this.DECAY_RATE * hoursElapsed);
    });

    // Apply decay to long-term memory (slower)
    context.activeMemory.longTerm.forEach(item => {
      const timeDiff = now.getTime() - new Date(item.lastAccessed).getTime();
      const daysElapsed = timeDiff / (1000 * 60 * 60 * 24);
      item.decayFactor *= Math.exp(-this.DECAY_RATE * 0.1 * daysElapsed);
    });

    // Remove items below threshold
    const threshold = 0.1;
    context.activeMemory.shortTerm = context.activeMemory.shortTerm
      .filter(item => item.decayFactor > threshold);
    context.activeMemory.longTerm = context.activeMemory.longTerm
      .filter(item => item.decayFactor > threshold);

    return context;
  }

  /**
   * Check if context optimization is needed
   */
  private shouldOptimizeContext(context: ConversationContext): boolean {
    const totalMemoryItems = context.activeMemory.shortTerm.length + 
                           context.activeMemory.longTerm.length;
    
    return totalMemoryItems > 50 || 
           context.sessionMetadata.messageCount > 20 ||
           context.contextHistory.length > 10;
  }

  /**
   * Optimize context for better performance
   */
  async optimizeContext(context: ConversationContext): Promise<ConversationContext> {
    // Compress context history
    if (context.contextHistory.length > 5) {
      const important = context.contextHistory
        .sort((a, b) => (b.resolved ? 0 : 1) - (a.resolved ? 0 : 1))
        .slice(0, 5);
      context.contextHistory = important;
    }

    // Merge similar entities
    const entityMap = new Map<string, Entity>();
    context.mentionedEntities.forEach(entity => {
      const key = `${entity.type}:${entity.name.toLowerCase()}`;
      const existing = entityMap.get(key);
      
      if (existing) {
        existing.frequency += entity.frequency;
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        existing.lastMentioned = entity.lastMentioned > existing.lastMentioned 
          ? entity.lastMentioned 
          : existing.lastMentioned;
      } else {
        entityMap.set(key, { ...entity });
      }
    });
    
    context.mentionedEntities = Array.from(entityMap.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);

    // Optimize working context
    context.activeMemory.workingContext.relatedConcepts = 
      [...new Set(context.activeMemory.workingContext.relatedConcepts)].slice(0, 8);
    
    context.activeMemory.workingContext.assumedKnowledge = 
      [...new Set(context.activeMemory.workingContext.assumedKnowledge)].slice(0, 5);

    return context;
  }

  /**
   * Get optimized context for prompt generation
   */
  async getOptimizedContextForPrompt(
    conversationId: string,
    maxTokens: number = 1000
  ): Promise<ContextOptimizationResult> {
    const context = await this.loadContext(conversationId);
    if (!context) {
      throw new Error('Context not found');
    }

    let contextText = '';
    const preservedElements: string[] = [];
    const discardedElements: string[] = [];

    // Build context text from most important elements
    
    // 1. Current topic and intent
    if (context.currentTopic) {
      contextText += `Current topic: ${context.currentTopic}\n`;
      preservedElements.push('current_topic');
    }

    // 2. Most important entities
    const topEntities = context.mentionedEntities
      .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
      .slice(0, 5);
    
    if (topEntities.length > 0) {
      contextText += `Key entities: ${topEntities.map(e => e.name).join(', ')}\n`;
      preservedElements.push('key_entities');
    }

    // 3. Recent memory items
    const recentMemory = [...context.activeMemory.shortTerm, ...context.activeMemory.longTerm]
      .sort((a, b) => (b.importance * b.decayFactor) - (a.importance * a.decayFactor))
      .slice(0, 3);
    
    recentMemory.forEach(item => {
      if (this.estimateTokens(contextText + item.content) < maxTokens) {
        contextText += `Memory: ${item.content}\n`;
        preservedElements.push(`memory_${item.type}`);
      } else {
        discardedElements.push(`memory_${item.type}`);
      }
    });

    // 4. Working context
    if (context.activeMemory.workingContext.currentFocus) {
      contextText += `Focus: ${context.activeMemory.workingContext.currentFocus}\n`;
      preservedElements.push('current_focus');
    }

    const tokenCount = this.estimateTokens(contextText);
    const originalSize = this.estimateTokens(JSON.stringify(context));
    const compressionRatio = tokenCount / originalSize;
    
    // Calculate quality score based on preserved important elements
    const qualityScore = preservedElements.length / 
      (preservedElements.length + discardedElements.length);

    return {
      optimizedContext: contextText.trim(),
      tokenCount,
      compressionRatio,
      preservedElements,
      discardedElements,
      qualityScore
    };
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for mixed content
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate conversation summary
   */
  async generateConversationSummary(conversationId: string): Promise<ConversationSummary> {
    const context = await this.loadContext(conversationId);
    if (!context) {
      throw new Error('Context not found');
    }

    const duration = new Date().getTime() - new Date(context.sessionMetadata.startTime).getTime();
    const topicsDiscussed = [...new Set([
      context.currentTopic,
      ...context.contextHistory.map(h => h.topic)
    ])].filter(Boolean);

    const keyDecisions = context.activeMemory.longTerm
      .filter(item => item.type === 'fact' && item.importance > 0.7)
      .map(item => item.content);

    const actionItems = context.activeMemory.shortTerm
      .filter(item => item.content.toLowerCase().includes('should') || 
                     item.content.includes('يجب'))
      .map(item => item.content);

    return {
      conversationId,
      duration,
      messageCount: context.sessionMetadata.messageCount,
      topicsDiscussed,
      keyDecisions,
      actionItems,
      satisfactionScore: context.sessionMetadata.userSatisfactionScore,
      language: context.language,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Load context from storage
   */
  private async loadContext(conversationId: string): Promise<ConversationContext | null> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('conversation_contexts')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error || !data) {
        console.error('Error loading context:', error);
        return null;
      }

      return JSON.parse(data.context_data);
    } catch (error) {
      console.error('Error loading context:', error);
      return null;
    }
  }

  /**
   * Persist context to storage
   */
  private async persistContext(context: ConversationContext): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      
      const { error } = await supabase
        .from('conversation_contexts')
        .upsert({
          conversation_id: context.conversationId,
          organization_id: context.organizationId,
          user_id: context.userId,
          context_data: JSON.stringify(context),
          last_updated: new Date().toISOString()
        });

      if (error) {
        console.error('Error persisting context:', error);
        throw new Error('Failed to persist context');
      }
    } catch (error) {
      console.error('Error persisting context:', error);
      throw error;
    }
  }
}