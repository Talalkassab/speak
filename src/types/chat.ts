// Chat Types and Interfaces for HR Business Consultant RAG Platform

// Core message interface
export interface ChatMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  userId?: string;
  role: 'user' | 'assistant';
  content: string;
  language: 'ar' | 'en';
  timestamp: Date;
  sources?: SourceAttribution[];
  rating?: number;
  metadata?: MessageMetadata;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
}

// Message metadata for tracking performance and user actions
export interface MessageMetadata {
  tokensUsed?: number;
  responseTimeMs?: number;
  confidence?: number;
  searchResults?: any;
  includeCompanyDocs?: boolean;
  includeLaborLaw?: boolean;
  streamed?: boolean;
  edited?: boolean;
  editedAt?: Date;
  exported?: boolean;
  exportedAt?: Date;
}

// Conversation interface
export interface Conversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  language: 'ar' | 'en';
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  status: ConversationStatus;
  metadata: ConversationMetadata;
  recentMessages?: ChatMessage[];
}

export type ConversationStatus = 'active' | 'archived' | 'deleted';

// Conversation metadata
export interface ConversationMetadata {
  tags?: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  autoTitle?: boolean;
  summaryGenerated?: boolean;
  archived?: boolean;
  archivedAt?: Date;
  exportCount?: number;
  avgRating?: number;
}

// Source attribution interface
export interface SourceAttribution {
  type: SourceType;
  id: string;
  title: string;
  excerpt: string;
  confidence: number;
  relevanceScore: number;
  documentId?: string;
  url?: string;
  page?: number;
  section?: string;
  chunkIndex?: number;
  metadata?: SourceMetadata;
}

export type SourceType = 'document' | 'law_article' | 'template' | 'policy' | 'contract' | 'form';

// Source metadata for additional context
export interface SourceMetadata {
  fileName?: string;
  fileType?: string;
  uploadedAt?: Date;
  language?: 'ar' | 'en';
  category?: string;
  version?: number;
  lastUpdated?: Date;
  author?: string;
  approver?: string;
}

// Chat state interface for component state management
export interface ChatState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId?: string;
  error: string | null;
  language: 'ar' | 'en';
  sidebarOpen: boolean;
  selectedSource?: SourceAttribution;
  typingIndicator: boolean;
}

// SSE streaming message types
export interface StreamMessage {
  type: StreamMessageType;
  data?: string | SourceAttribution[] | MessageCompletionData;
  error?: string;
  messageId?: string;
  conversationId?: string;
}

export type StreamMessageType = 'start' | 'content' | 'sources' | 'complete' | 'error' | 'typing_start' | 'typing_end';

// Message completion data from streaming
export interface MessageCompletionData {
  confidence: number;
  tokensUsed: number;
  responseTimeMs?: number;
  searchResults?: number;
  sourcesFound?: number;
}

// Chat input state
export interface ChatInputState {
  content: string;
  language: 'ar' | 'en';
  isTyping: boolean;
  includeCompanyDocs: boolean;
  includeLaborLaw: boolean;
  maxSources: number;
  attachments?: File[];
  mentionedDocuments?: string[];
}

// Chat actions for message operations
export interface ChatActions {
  sendMessage: (content: string, options?: ChatInputOptions) => Promise<void>;
  createConversation: (title?: string, language?: 'ar' | 'en') => Promise<Conversation>;
  selectConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  rateMessage: (messageId: string, rating: number) => Promise<void>;
  copyMessage: (message: ChatMessage) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  exportConversation: (conversationId: string, format: 'pdf' | 'txt' | 'json') => Promise<void>;
  searchConversations: (query: string) => Promise<Conversation[]>;
  toggleSidebar: () => void;
}

// Chat input options
export interface ChatInputOptions {
  language?: 'ar' | 'en';
  includeCompanyDocs?: boolean;
  includeLaborLaw?: boolean;
  maxSources?: number;
  conversationId?: string;
}

// Conversation filter options
export interface ConversationFilter {
  search?: string;
  language?: 'ar' | 'en';
  status?: ConversationStatus;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  sortBy?: ConversationSortField;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export type ConversationSortField = 'updated_at' | 'created_at' | 'title' | 'message_count' | 'last_message_at';

// Message action types for UI
export interface MessageAction {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ComponentType<any>;
  action: (message: ChatMessage) => void;
  visible?: (message: ChatMessage) => boolean;
  disabled?: (message: ChatMessage) => boolean;
  variant?: 'default' | 'destructive' | 'outline';
}

// Typing indicator interface
export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}

// Chat theme interface for RTL/LTR styling
export interface ChatTheme {
  direction: 'rtl' | 'ltr';
  messageAlignment: {
    user: 'right' | 'left';
    assistant: 'left' | 'right';
  };
  fontFamily: string;
  fontSize: string;
  lineHeight: number;
  spacing: {
    message: string;
    bubble: string;
    sidebar: string;
  };
}

// Message export options
export interface MessageExportOptions {
  format: 'pdf' | 'txt' | 'json' | 'csv';
  includeMetadata: boolean;
  includeSources: boolean;
  language: 'ar' | 'en';
  dateRange?: {
    start: Date;
    end: Date;
  };
  messagesOnly?: boolean;
}

// Error types specific to chat functionality
export interface ChatError {
  code: ChatErrorCode;
  message: string;
  messageAr?: string;
  details?: any;
  timestamp: Date;
  conversationId?: string;
  messageId?: string;
  retryable: boolean;
}

export type ChatErrorCode = 
  | 'CONNECTION_FAILED'
  | 'MESSAGE_SEND_FAILED'
  | 'CONVERSATION_LOAD_FAILED'
  | 'STREAMING_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_MESSAGE'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

// Performance metrics for chat operations
export interface ChatMetrics {
  messagesSent: number;
  messagesReceived: number;
  averageResponseTime: number;
  tokensUsed: number;
  sourcesRetrieved: number;
  conversationsStarted: number;
  ratingsProvided: number;
  errorsEncountered: number;
  sessionDuration: number;
}

// Language detection utility types
export interface LanguageDetection {
  detected: 'ar' | 'en' | 'mixed';
  confidence: number;
  arabicRatio: number;
  suggestions?: {
    language: 'ar' | 'en';
    reason: string;
  }[];
}

// Search result types for conversation search
export interface ConversationSearchResult {
  conversation: Conversation;
  matchType: 'title' | 'message' | 'metadata';
  matchedContent: string;
  relevanceScore: number;
  snippet?: string;
}

// Message validation types
export interface MessageValidation {
  isValid: boolean;
  errors: MessageValidationError[];
  warnings: MessageValidationWarning[];
}

export interface MessageValidationError {
  field: string;
  code: string;
  message: string;
  messageAr: string;
}

export interface MessageValidationWarning {
  code: string;
  message: string;
  messageAr: string;
  severity: 'low' | 'medium' | 'high';
}

// Utility type for message formatting
export type MessageContent = string | {
  text: string;
  format: 'plain' | 'markdown' | 'html';
  language: 'ar' | 'en';
};

// Hook return types for custom chat hooks
export interface UseChatReturn {
  state: ChatState;
  actions: ChatActions;
  metrics: ChatMetrics;
  error: ChatError | null;
  isConnected: boolean;
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<void>;
  filter: (filter: ConversationFilter) => Promise<void>;
}

export interface UseMessagesReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, options?: ChatInputOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isStreaming: boolean;
  streamingContent: string;
}

// Default values and constants
export const DEFAULT_CHAT_STATE: ChatState = {
  currentConversation: null,
  conversations: [],
  messages: {},
  isLoading: false,
  isStreaming: false,
  error: null,
  language: 'ar',
  sidebarOpen: true,
  typingIndicator: false,
};

export const DEFAULT_CHAT_INPUT_STATE: ChatInputState = {
  content: '',
  language: 'ar',
  isTyping: false,
  includeCompanyDocs: true,
  includeLaborLaw: true,
  maxSources: 10,
};

export const MESSAGE_STATUS_LABELS = {
  ar: {
    sending: 'جاري الإرسال',
    sent: 'تم الإرسال',
    delivered: 'تم التسليم',
    failed: 'فشل الإرسال',
  },
  en: {
    sending: 'Sending',
    sent: 'Sent',
    delivered: 'Delivered',
    failed: 'Failed',
  },
};

export const CONVERSATION_STATUS_LABELS = {
  ar: {
    active: 'نشط',
    archived: 'مؤرشف',
    deleted: 'محذوف',
  },
  en: {
    active: 'Active',
    archived: 'Archived',
    deleted: 'Deleted',
  },
};

export const SOURCE_TYPE_LABELS = {
  ar: {
    document: 'وثيقة',
    law_article: 'مادة قانونية',
    template: 'نموذج',
    policy: 'سياسة',
    contract: 'عقد',
    form: 'استمارة',
  },
  en: {
    document: 'Document',
    law_article: 'Law Article',
    template: 'Template',
    policy: 'Policy',
    contract: 'Contract',
    form: 'Form',
  },
};

// Validation constants
export const MESSAGE_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 4000,
  MAX_SOURCES: 20,
  MIN_SOURCES: 1,
} as const;

export const CONVERSATION_CONSTRAINTS = {
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 200,
  MAX_CONVERSATIONS_PER_USER: 1000,
} as const;