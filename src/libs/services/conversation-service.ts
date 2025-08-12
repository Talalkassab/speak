import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { SourceAttribution } from './rag-query-service';

export interface Conversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  category: 'general' | 'policy' | 'labor_law' | 'benefits' | 'procedures';
  language: 'ar' | 'en';
  isArchived: boolean;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'markdown';
  language: 'ar' | 'en';
  tokensUsed: number;
  modelUsed?: string;
  responseTimeMs?: number;
  sources: SourceAttribution[];
  confidenceScore?: number;
  userRating?: number;
  userFeedback?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateConversationParams {
  userId: string;
  organizationId: string;
  title?: string;
  category?: 'general' | 'policy' | 'labor_law' | 'benefits' | 'procedures';
  language?: 'ar' | 'en';
  metadata?: Record<string, any>;
}

export interface AddMessageParams {
  conversationId: string;
  organizationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType?: 'text' | 'markdown';
  language?: 'ar' | 'en';
  tokensUsed?: number;
  modelUsed?: string;
  responseTimeMs?: number;
  sources?: SourceAttribution[];
  confidenceScore?: number;
  metadata?: Record<string, any>;
}

export interface ConversationFilters {
  userId?: string;
  category?: string;
  language?: 'ar' | 'en';
  archived?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const supabase = await createSupabaseServerClient();
    
    try {
      const conversationData = {
        organization_id: params.organizationId,
        user_id: params.userId,
        title: params.title || (params.language === 'ar' ? 'محادثة جديدة' : 'New Conversation'),
        category: params.category || 'general',
        language: params.language || 'ar',
        metadata: params.metadata || {}
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select('*')
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }

      return this.mapConversationFromDB(data);

    } catch (error) {
      console.error('Error in createConversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID with permission check
   */
  async getConversation(
    conversationId: string,
    organizationId: string,
    userId: string
  ): Promise<Conversation | null> {
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          _message_count:messages(count)
        `)
        .eq('id', conversationId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapConversationFromDB(data);

    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }

  /**
   * List conversations with filters and pagination
   */
  async listConversations(
    organizationId: string,
    filters: ConversationFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  }> {
    const supabase = await createSupabaseServerClient();

    try {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          _message_count:messages(count),
          _last_message:messages(created_at)
        `, { count: 'exact' })
        .eq('organization_id', organizationId);

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.language) {
        query = query.eq('language', filters.language);
      }
      
      if (filters.archived !== undefined) {
        query = query.eq('is_archived', filters.archived);
      }
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }
      
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%`);
      }

      // Pagination and ordering
      const offset = (page - 1) * limit;
      query = query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error listing conversations:', error);
        throw new Error('Failed to list conversations');
      }

      const conversations = (data || []).map(conv => this.mapConversationFromDB(conv));
      const total = count || 0;
      const hasMore = total > page * limit;

      return {
        conversations,
        total,
        hasMore
      };

    } catch (error) {
      console.error('Error in listConversations:', error);
      throw error;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(params: AddMessageParams): Promise<Message> {
    const supabase = await createSupabaseServerClient();

    try {
      // Verify conversation ownership
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', params.conversationId)
        .eq('organization_id', params.organizationId)
        .eq('user_id', params.userId)
        .single();

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Insert message
      const messageData = {
        organization_id: params.organizationId,
        conversation_id: params.conversationId,
        role: params.role,
        content: params.content,
        content_type: params.contentType || 'text',
        language: params.language || 'ar',
        tokens_used: params.tokensUsed || 0,
        model_used: params.modelUsed,
        response_time_ms: params.responseTimeMs,
        sources_used: params.sources || [],
        confidence_score: params.confidenceScore,
        metadata: params.metadata || {}
      };

      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert(messageData)
        .select('*')
        .single();

      if (messageError) {
        console.error('Error adding message:', messageError);
        throw new Error('Failed to add message');
      }

      // Insert source attributions if provided
      if (params.sources && params.sources.length > 0) {
        const sourceData = params.sources.map(source => ({
          organization_id: params.organizationId,
          message_id: message.id,
          document_id: source.type === 'document' ? source.id : null,
          chunk_id: source.type === 'document' ? source.id : null,
          relevance_score: source.relevanceScore,
          citation_text: source.excerpt,
          page_number: source.pageNumber
        })).filter(source => source.document_id); // Only document sources for now

        if (sourceData.length > 0) {
          await supabase
            .from('message_sources')
            .insert(sourceData);
        }
      }

      // Update conversation updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.conversationId);

      return this.mapMessageFromDB(message);

    } catch (error) {
      console.error('Error in addMessage:', error);
      throw error;
    }
  }

  /**
   * Get conversation messages with pagination
   */
  async getConversationMessages(
    conversationId: string,
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    messages: Message[];
    total: number;
    hasMore: boolean;
  }> {
    const supabase = await createSupabaseServerClient();

    try {
      // Verify conversation access
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Get messages with sources
      const offset = (page - 1) * limit;
      const { data, error, count } = await supabase
        .from('messages')
        .select(`
          *,
          message_sources (
            relevance_score,
            citation_text,
            page_number,
            documents (
              title,
              filename
            )
          )
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error getting messages:', error);
        throw new Error('Failed to get messages');
      }

      const messages = (data || []).map(msg => this.mapMessageFromDB(msg));
      const total = count || 0;
      const hasMore = total > page * limit;

      return {
        messages,
        total,
        hasMore
      };

    } catch (error) {
      console.error('Error in getConversationMessages:', error);
      throw error;
    }
  }

  /**
   * Update conversation (title, category, etc.)
   */
  async updateConversation(
    conversationId: string,
    organizationId: string,
    userId: string,
    updates: {
      title?: string;
      category?: string;
      isArchived?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<Conversation> {
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({
          title: updates.title,
          category: updates.category,
          is_archived: updates.isArchived,
          metadata: updates.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error('Failed to update conversation');
      }

      return this.mapConversationFromDB(data);

    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  /**
   * Rate a message (user feedback)
   */
  async rateMessage(
    messageId: string,
    organizationId: string,
    userId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const supabase = await createSupabaseServerClient();

    try {
      // Verify message belongs to user's conversation
      const { data: message } = await supabase
        .from('messages')
        .select(`
          id,
          conversations!inner (
            user_id
          )
        `)
        .eq('id', messageId)
        .eq('organization_id', organizationId)
        .single();

      if (!message || message.conversations.user_id !== userId) {
        throw new Error('Message not found or access denied');
      }

      // Update message rating
      const { error } = await supabase
        .from('messages')
        .update({
          user_rating: rating,
          user_feedback: feedback
        })
        .eq('id', messageId);

      if (error) {
        throw new Error('Failed to rate message');
      }

    } catch (error) {
      console.error('Error rating message:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation (soft delete - archive)
   */
  async deleteConversation(
    conversationId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: true })
        .eq('id', conversationId)
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error('Failed to delete conversation');
      }

    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(
    organizationId: string,
    userId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    avgMessagesPerConversation: number;
    avgRating: number;
  }> {
    const supabase = await createSupabaseServerClient();

    try {
      let query = supabase
        .from('conversations')
        .select(`
          category,
          language,
          messages (
            id,
            user_rating
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_archived', false);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error('Failed to get conversation stats');
      }

      const stats = {
        total: data?.length || 0,
        byCategory: {} as Record<string, number>,
        byLanguage: {} as Record<string, number>,
        avgMessagesPerConversation: 0,
        avgRating: 0
      };

      if (data && data.length > 0) {
        let totalMessages = 0;
        let totalRatings = 0;
        let ratingCount = 0;

        data.forEach(conv => {
          // Count by category
          stats.byCategory[conv.category] = (stats.byCategory[conv.category] || 0) + 1;
          
          // Count by language
          stats.byLanguage[conv.language] = (stats.byLanguage[conv.language] || 0) + 1;
          
          // Count messages and ratings
          const messageCount = conv.messages?.length || 0;
          totalMessages += messageCount;
          
          conv.messages?.forEach((msg: any) => {
            if (msg.user_rating) {
              totalRatings += msg.user_rating;
              ratingCount++;
            }
          });
        });

        stats.avgMessagesPerConversation = totalMessages / data.length;
        stats.avgRating = ratingCount > 0 ? totalRatings / ratingCount : 0;
      }

      return stats;

    } catch (error) {
      console.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  /**
   * Map database row to Conversation object
   */
  private mapConversationFromDB(data: any): Conversation {
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      title: data.title,
      category: data.category,
      language: data.language,
      isArchived: data.is_archived,
      messageCount: data._message_count?.[0]?.count || 0,
      lastMessageAt: data._last_message ? new Date(data._last_message[0]?.created_at) : data.updated_at,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      metadata: data.metadata || {}
    };
  }

  /**
   * Map database row to Message object
   */
  private mapMessageFromDB(data: any): Message {
    // Map sources from message_sources join
    const sources: SourceAttribution[] = [];
    if (data.message_sources) {
      data.message_sources.forEach((source: any) => {
        sources.push({
          id: source.document_id || 'unknown',
          type: 'document',
          title: source.documents?.title || source.documents?.filename || 'Unknown Document',
          excerpt: source.citation_text || '',
          pageNumber: source.page_number,
          relevanceScore: source.relevance_score || 0
        });
      });
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      conversationId: data.conversation_id,
      role: data.role,
      content: data.content,
      contentType: data.content_type,
      language: data.language,
      tokensUsed: data.tokens_used || 0,
      modelUsed: data.model_used,
      responseTimeMs: data.response_time_ms,
      sources,
      confidenceScore: data.confidence_score,
      userRating: data.user_rating,
      userFeedback: data.user_feedback,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at)
    };
  }
}