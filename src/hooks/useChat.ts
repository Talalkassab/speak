'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ChatMessage,
  Conversation,
  SourceAttribution,
  ChatInputOptions,
  StreamMessage,
  ChatState,
  ChatError,
  ChatMetrics,
  UseChatReturn,
} from '@/types/chat';
import { detectTextLanguage } from '@/types/documents';

interface UseChatOptions {
  userId: string;
  organizationId: string;
  conversationId?: string;
  initialLanguage?: 'ar' | 'en';
  onError?: (error: ChatError) => void;
  onMessageSent?: (message: ChatMessage) => void;
  onMessageReceived?: (message: ChatMessage) => void;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const {
    userId,
    organizationId,
    conversationId,
    initialLanguage = 'ar',
    onError,
    onMessageSent,
    onMessageReceived,
  } = options;

  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Chat state
  const [state, setState] = useState<ChatState>({
    currentConversation: null,
    conversations: [],
    messages: {},
    isLoading: false,
    isStreaming: false,
    error: null,
    language: initialLanguage,
    sidebarOpen: true,
    typingIndicator: false,
  });

  // Metrics tracking
  const [metrics, setMetrics] = useState<ChatMetrics>({
    messagesSent: 0,
    messagesReceived: 0,
    averageResponseTime: 0,
    tokensUsed: 0,
    sourcesRetrieved: 0,
    conversationsStarted: 0,
    ratingsProvided: 0,
    errorsEncountered: 0,
    sessionDuration: 0,
  });

  // Connection status
  const [isConnected, setIsConnected] = useState(true);

  // Error handler
  const handleError = useCallback((error: ChatError | Error | string) => {
    let chatError: ChatError;
    
    if (typeof error === 'string') {
      chatError = {
        code: 'NETWORK_ERROR',
        message: error,
        timestamp: new Date(),
        retryable: true,
      };
    } else if (error instanceof Error) {
      chatError = {
        code: 'SERVER_ERROR',
        message: error.message,
        timestamp: new Date(),
        retryable: true,
      };
    } else {
      chatError = error;
    }

    setState(prev => ({ ...prev, error: chatError.message }));
    setMetrics(prev => ({ ...prev, errorsEncountered: prev.errorsEncountered + 1 }));
    onError?.(chatError);
  }, [onError]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`/api/v1/chat/conversations?limit=50`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          conversations: result.data || [],
          isLoading: false,
        }));
      } else {
        throw new Error(result.error?.message || 'Failed to load conversations');
      }
    } catch (error) {
      handleError(error as Error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [handleError]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`/api/v1/chat/conversations/${convId}/messages`);
      
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [convId]: result.data || [],
          },
          isLoading: false,
        }));
      } else {
        throw new Error(result.error?.message || 'Failed to load messages');
      }
    } catch (error) {
      handleError(error as Error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [handleError]);

  // Create new conversation
  const createConversation = useCallback(async (title?: string, language?: 'ar' | 'en'): Promise<Conversation> => {
    try {
      const response = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || (language === 'ar' ? 'محادثة جديدة' : 'New Conversation'),
          language: language || state.language,
          metadata: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const newConversation = result.data;
        
        setState(prev => ({
          ...prev,
          conversations: [newConversation, ...prev.conversations],
        }));

        setMetrics(prev => ({
          ...prev,
          conversationsStarted: prev.conversationsStarted + 1,
        }));

        return newConversation;
      } else {
        throw new Error(result.error?.message || 'Failed to create conversation');
      }
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  }, [state.language, handleError]);

  // Select conversation
  const selectConversation = useCallback(async (convId: string) => {
    try {
      // Load messages if not already loaded
      if (!state.messages[convId]) {
        await loadMessages(convId);
      }

      // Find the conversation
      const conversation = state.conversations.find(c => c.id === convId);
      if (conversation) {
        setState(prev => ({
          ...prev,
          currentConversation: conversation,
        }));
      }
    } catch (error) {
      handleError(error as Error);
    }
  }, [state.conversations, state.messages, loadMessages, handleError]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatInputOptions) => {
    try {
      let targetConversationId = options?.conversationId || conversationId;
      
      // Create new conversation if needed
      if (!targetConversationId) {
        const detectedLanguage = options?.language || detectTextLanguage(content) as 'ar' | 'en';
        const newConversation = await createConversation(undefined, detectedLanguage);
        targetConversationId = newConversation.id;
        
        // Navigate to new conversation
        router.push(`/chat/${newConversation.id}`);
      }

      if (!targetConversationId) {
        throw new Error('No conversation ID available');
      }

      setState(prev => ({ 
        ...prev, 
        isStreaming: true, 
        streamingContent: '', 
        error: null 
      }));

      const messageLanguage = options?.language || detectTextLanguage(content) as 'ar' | 'en';

      // Create optimistic user message
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId: targetConversationId,
        organizationId,
        userId,
        role: 'user',
        content,
        language: messageLanguage,
        timestamp: new Date(),
        status: 'sending',
      };

      // Create optimistic assistant message
      const assistantMessage: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        conversationId: targetConversationId,
        organizationId,
        role: 'assistant',
        content: '',
        language: messageLanguage,
        timestamp: new Date(),
        status: 'sending',
      };

      // Add messages to state
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [targetConversationId!]: [
            ...(prev.messages[targetConversationId!] || []),
            userMessage,
            assistantMessage,
          ],
        },
        streamingMessageId: assistantMessage.id,
      }));

      // Close existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Start streaming
      const requestBody = {
        conversationId: targetConversationId,
        content,
        language: messageLanguage,
        includeCompanyDocs: options?.includeCompanyDocs ?? true,
        includeLaborLaw: options?.includeLaborLaw ?? true,
        maxSources: options?.maxSources ?? 10,
      };

      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.statusText}`);
      }

      // Set up EventSource for streaming
      const eventSource = new EventSource('/api/v1/chat/stream');
      eventSourceRef.current = eventSource;

      let streamingContent = '';
      let sources: SourceAttribution[] = [];
      const startTime = Date.now();

      eventSource.onmessage = (event) => {
        try {
          const data: StreamMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'start':
              setState(prev => ({ ...prev, streamingContent: '' }));
              break;

            case 'content':
              streamingContent += data.data as string;
              setState(prev => ({ ...prev, streamingContent }));
              break;

            case 'sources':
              sources = data.data as SourceAttribution[];
              setMetrics(prev => ({
                ...prev,
                sourcesRetrieved: prev.sourcesRetrieved + sources.length,
              }));
              break;

            case 'complete':
              const completionData = data.data as any;
              const responseTime = Date.now() - startTime;
              
              setState(prev => {
                const updatedMessages = prev.messages[targetConversationId!]?.map(msg => {
                  if (msg.id === assistantMessage.id) {
                    return {
                      ...msg,
                      content: streamingContent,
                      status: 'delivered' as const,
                      sources,
                      metadata: {
                        confidence: completionData?.confidence,
                        tokensUsed: completionData?.tokensUsed,
                        responseTimeMs: responseTime,
                        streamed: true,
                      },
                    };
                  }
                  if (msg.id === userMessage.id) {
                    return { ...msg, status: 'delivered' as const };
                  }
                  return msg;
                }) || [];

                return {
                  ...prev,
                  messages: {
                    ...prev.messages,
                    [targetConversationId!]: updatedMessages,
                  },
                  isStreaming: false,
                  streamingMessageId: undefined,
                  streamingContent: '',
                };
              });

              // Update metrics
              setMetrics(prev => ({
                ...prev,
                messagesSent: prev.messagesSent + 1,
                messagesReceived: prev.messagesReceived + 1,
                averageResponseTime: 
                  (prev.averageResponseTime * prev.messagesReceived + responseTime) / 
                  (prev.messagesReceived + 1),
                tokensUsed: prev.tokensUsed + (completionData?.tokensUsed || 0),
              }));

              // Callbacks
              onMessageSent?.(userMessage);
              onMessageReceived?.({
                ...assistantMessage,
                content: streamingContent,
                sources,
                status: 'delivered',
              });

              eventSource.close();
              break;

            case 'error':
              handleError({
                code: 'STREAMING_ERROR',
                message: data.error || 'Streaming error occurred',
                timestamp: new Date(),
                retryable: true,
              });
              setState(prev => ({
                ...prev,
                isStreaming: false,
                streamingMessageId: undefined,
              }));
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error parsing stream data:', error);
          handleError('Failed to parse streaming data');
        }
      };

      eventSource.onerror = () => {
        handleError({
          code: 'CONNECTION_FAILED',
          message: 'Connection to server lost',
          timestamp: new Date(),
          retryable: true,
        });
        setState(prev => ({
          ...prev,
          isStreaming: false,
          streamingMessageId: undefined,
        }));
        setIsConnected(false);
        eventSource.close();
      };

    } catch (error) {
      handleError(error as Error);
      setState(prev => ({
        ...prev,
        isStreaming: false,
        streamingMessageId: undefined,
      }));
    }
  }, [
    conversationId,
    organizationId,
    userId,
    createConversation,
    router,
    handleError,
    onMessageSent,
    onMessageReceived,
  ]);

  // Rate message
  const rateMessage = useCallback(async (messageId: string, rating: number) => {
    try {
      // Implementation would call API to rate message
      // For now, update local state
      setState(prev => ({
        ...prev,
        messages: Object.fromEntries(
          Object.entries(prev.messages).map(([convId, messages]) => [
            convId,
            messages.map(msg => 
              msg.id === messageId ? { ...msg, rating } : msg
            ),
          ])
        ),
      }));

      setMetrics(prev => ({
        ...prev,
        ratingsProvided: prev.ratingsProvided + 1,
      }));
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError]);

  // Copy message
  const copyMessage = useCallback((message: ChatMessage) => {
    navigator.clipboard.writeText(message.content);
  }, []);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      // Implementation would call API to delete message
      setState(prev => ({
        ...prev,
        messages: Object.fromEntries(
          Object.entries(prev.messages).map(([convId, messages]) => [
            convId,
            messages.filter(msg => msg.id !== messageId),
          ])
        ),
      }));
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError]);

  // Archive conversation
  const archiveConversation = useCallback(async (convId: string) => {
    try {
      // Implementation would call API to archive conversation
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== convId),
      }));
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError]);

  // Delete conversation
  const deleteConversation = useCallback(async (convId: string) => {
    try {
      // Implementation would call API to delete conversation
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== convId),
        messages: Object.fromEntries(
          Object.entries(prev.messages).filter(([id]) => id !== convId)
        ),
      }));
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError]);

  // Export conversation
  const exportConversation = useCallback(async (convId: string, format: 'pdf' | 'txt' | 'json') => {
    try {
      // Implementation would call API to export conversation
      console.log(`Exporting conversation ${convId} as ${format}`);
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError]);

  // Search conversations
  const searchConversations = useCallback(async (query: string) => {
    try {
      const response = await fetch(`/api/v1/chat/conversations?search=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      handleError(error as Error);
      return [];
    }
  }, [handleError]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Chat actions object
  const actions = {
    sendMessage,
    createConversation,
    selectConversation,
    loadConversations,
    loadMessages,
    rateMessage,
    copyMessage,
    deleteMessage,
    editMessage: async () => {}, // Placeholder
    archiveConversation,
    deleteConversation,
    exportConversation,
    searchConversations,
    toggleSidebar,
  };

  return {
    state,
    actions,
    metrics,
    error: state.error ? {
      code: 'UNKNOWN',
      message: state.error,
      timestamp: new Date(),
      retryable: true,
    } as ChatError : null,
    isConnected,
  };
}