import { supabaseAdmin } from '@/libs/supabase/supabase-admin';
import { OpenAI } from 'openai';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface ConversationContext {
  conversationId: string;
  messageHistory: Message[];
  entities: string[];
  topics: string[];
  contextSummary: string;
  lastUpdated: Date;
}

export interface ContextWindow {
  messages: Message[];
  totalTokens: number;
  truncated: boolean;
}

export class ContextManagementService {
  private openai: OpenAI;
  private maxContextMessages = 10;
  private maxContextTokens = 4000;
  private contextCache = new Map<string, ConversationContext>();
  private cacheTimeout = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  /**
   * Build conversation context from database
   */
  async buildConversationContext(
    conversationId: string,
    maxMessages: number = 10
  ): Promise<ConversationContext> {
    try {
      // Check cache first
      const cached = this.getFromCache(conversationId);
      if (cached) {
        return cached;
      }
      
      // Get recent messages from conversation
      const messages = await this.getRecentMessages(conversationId, maxMessages);
      
      // Extract key entities and topics
      const [entities, topics] = await Promise.all([
        this.extractEntities(messages),
        this.extractTopics(messages),
      ]);
      
      // Build context summary
      const contextSummary = await this.summarizeContext(messages, entities, topics);
      
      const context: ConversationContext = {
        conversationId,
        messageHistory: messages,
        entities,
        topics,
        contextSummary,
        lastUpdated: new Date(),
      };
      
      // Cache the context
      this.saveToCache(conversationId, context);
      
      return context;
    } catch (error) {
      console.error('Error building conversation context:', error);
      throw new Error(`Failed to build context: ${error}`);
    }
  }

  /**
   * Get recent messages from conversation
   */
  private async getRecentMessages(
    conversationId: string,
    limit: number
  ): Promise<Message[]> {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
    
    return (data || [])
      .reverse()
      .map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        metadata: msg.metadata,
      }));
  }

  /**
   * Extract entities from messages using NER
   */
  private async extractEntities(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];
    
    try {
      const text = messages
        .map(m => m.content)
        .join('\n')
        .slice(0, 2000); // Limit text length
      
      const prompt = `Extract key entities (names, organizations, dates, locations, legal terms) from this HR conversation:

${text}

Return as JSON: {"entities": ["entity1", "entity2", ...]}`;
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });
      
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.entities || [];
    } catch (error) {
      console.error('Error extracting entities:', error);
      return [];
    }
  }

  /**
   * Extract topics from messages
   */
  private async extractTopics(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];
    
    try {
      const text = messages
        .map(m => m.content)
        .join('\n')
        .slice(0, 2000);
      
      const prompt = `Identify main HR topics discussed in this conversation:

${text}

Common HR topics include: recruitment, termination, leave policy, compensation, benefits, performance, training, compliance, contracts, disputes.

Return as JSON: {"topics": ["topic1", "topic2", ...]}`;
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });
      
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.topics || [];
    } catch (error) {
      console.error('Error extracting topics:', error);
      return [];
    }
  }

  /**
   * Summarize conversation context
   */
  private async summarizeContext(
    messages: Message[],
    entities: string[],
    topics: string[]
  ): Promise<string> {
    if (messages.length === 0) return '';
    
    try {
      const recentMessages = messages.slice(-5);
      const conversation = recentMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
      
      const prompt = `Summarize this HR consultation conversation in 2-3 sentences, focusing on the main issue and context:

Key entities: ${entities.join(', ')}
Topics: ${topics.join(', ')}

Conversation:
${conversation}

Provide a brief, factual summary:`;
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });
      
      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error summarizing context:', error);
      return '';
    }
  }

  /**
   * Manage context window for token limits
   */
  async manageContextWindow(
    messages: Message[],
    maxTokens: number = 4000
  ): Promise<ContextWindow> {
    let totalTokens = 0;
    const relevantMessages: Message[] = [];
    let truncated = false;
    
    // Start from most recent and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const messageTokens = await this.estimateTokens(messages[i].content);
      
      if (totalTokens + messageTokens <= maxTokens) {
        totalTokens += messageTokens;
        relevantMessages.unshift(messages[i]);
      } else {
        truncated = true;
        break;
      }
    }
    
    // If we had to truncate, add a summary of older messages
    if (truncated && messages.length > relevantMessages.length) {
      const olderMessages = messages.slice(0, messages.length - relevantMessages.length);
      const summary = await this.summarizeMessages(olderMessages);
      
      if (summary) {
        relevantMessages.unshift({
          id: 'summary',
          role: 'assistant',
          content: `[Previous conversation summary: ${summary}]`,
          timestamp: olderMessages[0].timestamp,
        });
      }
    }
    
    return {
      messages: relevantMessages,
      totalTokens,
      truncated,
    };
  }

  /**
   * Estimate token count for text
   */
  private async estimateTokens(text: string): Promise<number> {
    // Simple estimation: ~4 characters per token for English, ~2 for Arabic
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const charsPerToken = hasArabic ? 2 : 4;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Summarize a list of messages
   */
  private async summarizeMessages(messages: Message[]): Promise<string> {
    if (messages.length === 0) return '';
    
    const conversation = messages
      .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Summarize this conversation in one sentence: ${conversation}`,
        }],
        temperature: 0.3,
        max_tokens: 100,
      });
      
      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error summarizing messages:', error);
      return '';
    }
  }

  /**
   * Update conversation context with new message
   */
  async updateContext(
    conversationId: string,
    newMessage: Message
  ): Promise<ConversationContext> {
    const context = await this.buildConversationContext(conversationId);
    
    // Add new message
    context.messageHistory.push(newMessage);
    
    // Keep only recent messages
    if (context.messageHistory.length > this.maxContextMessages) {
      context.messageHistory = context.messageHistory.slice(-this.maxContextMessages);
    }
    
    // Re-extract entities and topics if needed
    if (newMessage.role === 'user') {
      const newEntities = await this.extractEntities([newMessage]);
      const newTopics = await this.extractTopics([newMessage]);
      
      // Merge with existing, keeping unique
      context.entities = [...new Set([...context.entities, ...newEntities])];
      context.topics = [...new Set([...context.topics, ...newTopics])];
    }
    
    // Update summary
    context.contextSummary = await this.summarizeContext(
      context.messageHistory,
      context.entities,
      context.topics
    );
    
    context.lastUpdated = new Date();
    
    // Update cache
    this.saveToCache(conversationId, context);
    
    return context;
  }

  /**
   * Clear context for a conversation
   */
  async clearContext(conversationId: string): Promise<void> {
    this.contextCache.delete(conversationId);
    
    // Optionally mark conversation as closed in database
    await supabaseAdmin
      .from('conversations')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  /**
   * Cache management
   */
  private getFromCache(conversationId: string): ConversationContext | null {
    const cached = this.contextCache.get(conversationId);
    
    if (cached) {
      const age = Date.now() - cached.lastUpdated.getTime();
      if (age < this.cacheTimeout) {
        return cached;
      } else {
        this.contextCache.delete(conversationId);
      }
    }
    
    return null;
  }

  private saveToCache(conversationId: string, context: ConversationContext): void {
    this.contextCache.set(conversationId, context);
    
    // Clean old cache entries
    if (this.contextCache.size > 100) {
      const oldestKey = this.contextCache.keys().next().value;
      if (oldestKey) {
        this.contextCache.delete(oldestKey);
      }
    }
  }

  /**
   * Get context statistics
   */
  async getContextStats(conversationId: string): Promise<{
    messageCount: number;
    entityCount: number;
    topicCount: number;
    estimatedTokens: number;
  }> {
    const context = await this.buildConversationContext(conversationId);
    
    let totalTokens = 0;
    for (const msg of context.messageHistory) {
      totalTokens += await this.estimateTokens(msg.content);
    }
    
    return {
      messageCount: context.messageHistory.length,
      entityCount: context.entities.length,
      topicCount: context.topics.length,
      estimatedTokens: totalTokens,
    };
  }
}

// Export singleton instance
export const contextManagementService = new ContextManagementService();