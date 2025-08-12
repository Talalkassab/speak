// Chat Interface Components for HR Business Consultant RAG Platform

export { ChatInterface } from './ChatInterface';
export { ConversationSidebar } from './ConversationSidebar';
export { MessageList } from './MessageList';
export { MessageBubble } from './MessageBubble';
export { ChatInput } from './ChatInput';
export { SourcePanel } from './SourcePanel';
export { ChatActions } from './ChatActions';

// Re-export chat types for convenience
export type {
  ChatMessage,
  Conversation,
  SourceAttribution,
  ChatInputOptions,
  StreamMessage,
  ChatState,
  ChatActions as ChatActionType,
  MessageAction,
  ConversationFilter,
  ChatTheme,
  ChatError,
  ChatMetrics,
  MessageValidation,
  UseChatReturn,
  UseConversationsReturn,
  UseMessagesReturn,
} from '../../types/chat';