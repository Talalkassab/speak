'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, User, Sparkles, FileText, AlertCircle } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SourcePanel } from './SourcePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import type { 
  ChatMessage, 
  Conversation, 
  SourceAttribution, 
  ChatInputOptions,
  StreamMessage 
} from '@/types/chat';
import { detectTextLanguage } from '@/types/documents';

interface ChatInterfaceProps {
  userId: string;
  organizationId: string;
  conversationId?: string;
  initialLanguage?: 'ar' | 'en';
  conversationTitle?: string;
  className?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  selectedSources: SourceAttribution[];
  error: string | null;
  currentConversation: Conversation | null;
}

// Welcome screen component for new conversations
function WelcomeScreen({ 
  onStartConversation, 
  language = 'ar' 
}: { 
  onStartConversation: (message: string) => void;
  language?: 'ar' | 'en';
}) {
  const suggestions = language === 'ar' ? [
    'ما هي حقوق الموظف في نظام العمل السعودي؟',
    'كيف أحسب إجازة الأمومة للموظفة؟',
    'ما هي الإجراءات المطلوبة لإنهاء خدمة موظف؟',
    'اشرح لي سياسة الرواتب في الشركة',
  ] : [
    'What are employee rights under Saudi Labor Law?',
    'How do I calculate maternity leave for an employee?',
    'What procedures are required to terminate an employee?',
    'Explain the company salary policy to me',
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 bg-saudi-navy-100 rounded-full flex items-center justify-center mb-6">
        <Bot className="w-10 h-10 text-saudi-navy-600" />
      </div>
      
      <h1 className={cn(
        "text-2xl font-bold mb-2",
        language === 'ar' ? 'font-arabic' : ''
      )}>
        {language === 'ar' 
          ? 'مرحباً بك في مساعد الموارد البشرية الذكي' 
          : 'Welcome to HR Intelligence Assistant'
        }
      </h1>
      
      <p className={cn(
        "text-gray-600 mb-8 leading-relaxed",
        language === 'ar' ? 'font-arabic text-right' : 'text-left'
      )}>
        {language === 'ar'
          ? 'اسأل أي سؤال متعلق بالموارد البشرية، نظام العمل السعودي، أو سياسات الشركة. سأقوم بتقديم إجابات دقيقة بناءً على المستندات والقوانين المتوفرة.'
          : 'Ask any question about HR, Saudi Labor Law, or company policies. I will provide accurate answers based on available documents and regulations.'
        }
      </p>
      
      <div className="w-full space-y-3">
        <h3 className={cn(
          "text-sm font-medium text-gray-700 mb-3",
          language === 'ar' ? 'font-arabic' : ''
        )}>
          {language === 'ar' ? 'أسئلة مقترحة:' : 'Suggested questions:'}
        </h3>
        
        <div className="grid gap-2">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              className={cn(
                "text-left justify-start h-auto p-3 whitespace-normal",
                language === 'ar' ? 'text-right font-arabic' : 'text-left'
              )}
              onClick={() => onStartConversation(suggestion)}
            >
              <Sparkles className={cn(
                "w-4 h-4 flex-shrink-0",
                language === 'ar' ? 'ml-2' : 'mr-2'
              )} />
              <span className="leading-relaxed">{suggestion}</span>
            </Button>
          ))}
        </div>
      </div>
      
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
        <FileText className="w-4 h-4" />
        <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
          {language === 'ar'
            ? 'مدعوم بقاعدة المعرفة الخاصة بالشركة ونظام العمل السعودي'
            : 'Powered by company knowledge base and Saudi Labor Law'
          }
        </span>
      </div>
    </div>
  );
}

// Error display component
function ErrorDisplay({ 
  error, 
  onRetry, 
  language = 'ar' 
}: { 
  error: string;
  onRetry?: () => void;
  language?: 'ar' | 'en';
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      
      <h3 className={cn(
        "text-lg font-semibold text-gray-900 mb-2",
        language === 'ar' ? 'font-arabic' : ''
      )}>
        {language === 'ar' ? 'حدث خطأ' : 'An error occurred'}
      </h3>
      
      <p className={cn(
        "text-gray-600 mb-4",
        language === 'ar' ? 'font-arabic' : ''
      )}>
        {error}
      </p>
      
      {onRetry && (
        <Button onClick={onRetry} className={cn(language === 'ar' ? 'font-arabic' : '')}>
          {language === 'ar' ? 'إعادة المحاولة' : 'Try again'}
        </Button>
      )}
    </div>
  );
}

export function ChatInterface({
  userId,
  organizationId,
  conversationId,
  initialLanguage = 'ar',
  conversationTitle,
  className
}: ChatInterfaceProps) {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: '',
    streamingMessageId: null,
    selectedSources: [],
    error: null,
    currentConversation: null,
  });

  // Load conversation and messages
  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      setState(prev => ({
        ...prev,
        messages: [],
        currentConversation: null,
        error: null,
        isLoading: false,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Load messages for the conversation
      const response = await fetch(`/api/v1/chat/conversations/${conversationId}/messages`);
      
      if (!response.ok) {
        throw new Error(`Failed to load conversation: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          messages: result.data || [],
          currentConversation: {
            id: conversationId,
            organizationId,
            userId,
            title: conversationTitle || 'محادثة',
            language: initialLanguage,
            messageCount: result.data?.length || 0,
            lastMessageAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            metadata: {}
          } as Conversation,
          error: null,
        }));
      } else {
        throw new Error(result.error?.message || 'فشل في تحميل المحادثة');
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'فشل في تحميل المحادثة',
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [conversationId, organizationId, userId, conversationTitle, initialLanguage]);

  // Create new conversation
  const createNewConversation = useCallback(async (message: string, options?: ChatInputOptions) => {
    try {
      const detectedLanguage = options?.language || detectTextLanguage(message) as 'ar' | 'en';
      
      const response = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: detectedLanguage,
          metadata: options || {}
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const newConversation = result.data;
        
        // Navigate to new conversation
        router.push(`/chat/${newConversation.id}`);
        
        // Send the message after navigation
        setTimeout(() => {
          sendMessage(message, { ...options, conversationId: newConversation.id });
        }, 100);
        
        return newConversation;
      } else {
        throw new Error(result.error?.message || 'Failed to create conversation');
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'فشل في إنشاء محادثة جديدة'
      }));
      return null;
    }
  }, [router]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string, options?: ChatInputOptions) => {
    const actualConversationId = options?.conversationId || conversationId;
    
    if (!actualConversationId) {
      // Create new conversation first
      await createNewConversation(content, options);
      return;
    }

    try {
      setState(prev => ({ ...prev, isStreaming: true, streamingContent: '', error: null }));

      // Create temporary user message
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId: actualConversationId,
        organizationId,
        userId,
        role: 'user',
        content,
        language: options?.language || detectTextLanguage(content) as 'ar' | 'en',
        timestamp: new Date(),
        status: 'sending',
      };

      // Create temporary assistant message
      const assistantMessage: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        conversationId: actualConversationId,
        organizationId,
        role: 'assistant',
        content: '',
        language: userMessage.language,
        timestamp: new Date(),
        status: 'sending',
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        streamingMessageId: assistantMessage.id,
      }));

      // Close existing EventSource if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Send the message and get streaming response
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: actualConversationId,
          content,
          language: userMessage.language,
          includeCompanyDocs: options?.includeCompanyDocs ?? true,
          includeLaborLaw: options?.includeLaborLaw ?? true,
          maxSources: options?.maxSources ?? 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.statusText}`);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      let streamingContent = '';
      let sources: SourceAttribution[] = [];

      // Process the streaming response
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              try {
                const dataStr = line.slice(6); // Remove 'data: ' prefix
                if (dataStr.trim() === '') continue;
                
                const data: StreamMessage = JSON.parse(dataStr);

                switch (data.type) {
                  case 'start':
                    streamingContent = '';
                    setState(prev => ({
                      ...prev,
                      streamingContent: '',
                    }));
                    break;

                  case 'content':
                    streamingContent += data.data as string;
                    setState(prev => ({
                      ...prev,
                      streamingContent,
                    }));
                    break;

                  case 'sources':
                    sources = data.data as SourceAttribution[] || [];
                    setState(prev => ({
                      ...prev,
                      selectedSources: sources,
                    }));
                    break;

                  case 'complete':
                    const completionData = data.data as any;
                    setState(prev => {
                      const updatedMessages = prev.messages.map(msg => {
                        if (msg.id === assistantMessage.id) {
                          return {
                            ...msg,
                            content: streamingContent,
                            status: 'delivered' as const,
                            sources: sources,
                            metadata: {
                              confidence: completionData?.confidence,
                              tokensUsed: completionData?.tokensUsed,
                              responseTimeMs: completionData?.responseTimeMs,
                              streamed: true,
                            }
                          };
                        }
                        if (msg.id === userMessage.id) {
                          return { ...msg, status: 'delivered' as const };
                        }
                        return msg;
                      });

                      return {
                        ...prev,
                        messages: updatedMessages,
                        isStreaming: false,
                        streamingMessageId: null,
                        streamingContent: '',
                      };
                    });
                    
                    reader.releaseLock();
                    return; // Exit the streaming loop

                  case 'error':
                    setState(prev => ({
                      ...prev,
                      error: data.error || 'حدث خطأ أثناء المعالجة',
                      isStreaming: false,
                      streamingMessageId: null,
                    }));
                    reader.releaseLock();
                    return; // Exit the streaming loop
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        setState(prev => ({
          ...prev,
          error: 'خطأ في الاتصال أثناء البث',
          isStreaming: false,
          streamingMessageId: null,
        }));
      } finally {
        reader.releaseLock();
      }

    } catch (err) {
      console.error('Error sending message:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'فشل في إرسال الرسالة',
        isStreaming: false,
      }));
    }
  }, [conversationId, organizationId, userId, createNewConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Load conversation when conversationId changes
  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Update streaming message content in real-time
  const displayMessages = state.messages.map(msg => {
    if (msg.id === state.streamingMessageId && state.isStreaming) {
      return { ...msg, content: state.streamingContent };
    }
    return msg;
  });

  const language = state.currentConversation?.language || initialLanguage;
  const hasMessages = displayMessages.length > 0;

  return (
    <div className={cn("flex flex-col h-full bg-white", className)} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      {state.currentConversation && (
        <div className="border-b border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-saudi-navy-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-saudi-navy-600" />
              </div>
              <div>
                <h1 className={cn(
                  "font-medium text-gray-900",
                  language === 'ar' ? 'font-arabic' : ''
                )}>
                  {state.currentConversation.title}
                </h1>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Badge variant="outline" className="h-5">
                    {language === 'ar' ? '🇸🇦 عربي' : '🇺🇸 English'}
                  </Badge>
                  <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                    {displayMessages.length} {language === 'ar' ? 'رسالة' : 'messages'}
                  </span>
                </div>
              </div>
            </div>
            
            {state.isStreaming && (
              <div className="flex items-center gap-2 text-xs text-saudi-navy-600">
                <div className="w-2 h-2 bg-saudi-navy-600 rounded-full animate-pulse"></div>
                <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                  {language === 'ar' ? 'جاري الكتابة...' : 'Typing...'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {state.error ? (
            <ErrorDisplay 
              error={state.error} 
              onRetry={loadConversation}
              language={language}
            />
          ) : !hasMessages ? (
            <WelcomeScreen 
              onStartConversation={sendMessage}
              language={language}
            />
          ) : (
            <MessageList
              messages={displayMessages}
              isLoading={state.isLoading}
              isStreaming={state.isStreaming}
              language={language}
            />
          )}
        </div>

        {/* Sources Panel */}
        {state.selectedSources.length > 0 && (
          <div className="w-80 border-l border-gray-200">
            <SourcePanel
              sources={state.selectedSources}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 bg-white">
        <ChatInput
          onSendMessage={sendMessage}
          isStreaming={state.isStreaming}
          language={language}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}