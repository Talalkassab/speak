'use client';

import { useState, useCallback } from 'react';
import { 
  User, 
  Bot, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Copy,
  Star,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
// Simple markdown renderer (avoiding additional dependency)
const SimpleMarkdown = ({ children, className }: { children: string; className?: string }) => {
  const text = children;
  
  // Simple parsing for basic markdown
  const parseMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('###')) {
          return <h3 key={index} className="font-semibold text-sm mb-1">{line.slice(3).trim()}</h3>;
        }
        if (line.startsWith('##')) {
          return <h2 key={index} className="font-bold text-base mb-1">{line.slice(2).trim()}</h2>;
        }
        if (line.startsWith('#')) {
          return <h1 key={index} className="font-bold text-lg mb-2">{line.slice(1).trim()}</h1>;
        }
        
        // Lists
        if (line.trim().startsWith('- ')) {
          return <li key={index} className="ml-4 list-disc list-inside">{line.slice(2).trim()}</li>;
        }
        if (line.trim().match(/^\d+\.\s/)) {
          return <li key={index} className="ml-4 list-decimal list-inside">{line.trim().slice(line.indexOf('.') + 1).trim()}</li>;
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        // Regular paragraphs with inline formatting
        let processedLine = line;
        
        // Bold
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code
        processedLine = processedLine.replace(/`(.*?)`/g, '<code class="bg-opacity-20 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
        
        return (
          <p key={index} className="mb-2 last:mb-0 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      });
  };
  
  return <div className={className}>{parseMarkdown(text)}</div>;
};
import { ChatActions } from './ChatActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/utils/cn';
import type { ChatMessage, SourceAttribution } from '@/types/chat';
import { MESSAGE_STATUS_LABELS, SOURCE_TYPE_LABELS } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  language?: 'ar' | 'en';
  isStreaming?: boolean;
  showActions?: boolean;
  className?: string;
  onRateMessage?: (messageId: string, rating: number) => void;
  onCopyMessage?: (message: ChatMessage) => void;
}

// Message status icon component
function MessageStatusIcon({ 
  status, 
  language = 'ar' 
}: { 
  status: ChatMessage['status']; 
  language?: 'ar' | 'en';
}) {
  const statusConfig = {
    sending: {
      icon: Clock,
      className: 'text-gray-400',
      label: MESSAGE_STATUS_LABELS[language].sending,
    },
    sent: {
      icon: CheckCircle,
      className: 'text-green-500',
      label: MESSAGE_STATUS_LABELS[language].sent,
    },
    delivered: {
      icon: CheckCircle,
      className: 'text-green-600',
      label: MESSAGE_STATUS_LABELS[language].delivered,
    },
    failed: {
      icon: XCircle,
      className: 'text-red-500',
      label: MESSAGE_STATUS_LABELS[language].failed,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1 text-xs", config.className)} title={config.label}>
      <Icon className="w-3 h-3" />
    </div>
  );
}

// Message timestamp component
function MessageTimestamp({ 
  timestamp, 
  language = 'ar' 
}: { 
  timestamp: Date; 
  language?: 'ar' | 'en';
}) {
  const formatTime = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 1) {
      return language === 'ar' ? 'الآن' : 'now';
    } else if (diffMinutes < 60) {
      return language === 'ar' ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    } else {
      return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: language === 'en'
      });
    }
  }, [language]);

  return (
    <time className={cn(
      "text-xs text-gray-500",
      language === 'ar' ? 'font-arabic' : ''
    )}>
      {formatTime(timestamp)}
    </time>
  );
}

// Source attribution display component
function SourceAttribution({ 
  source, 
  language = 'ar' 
}: { 
  source: SourceAttribution; 
  language?: 'ar' | 'en';
}) {
  const typeLabel = SOURCE_TYPE_LABELS[language][source.type] || source.type;
  
  return (
    <div className="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
      <div className="w-1 h-8 bg-saudi-navy-400 rounded-full flex-shrink-0 mt-1"></div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {typeLabel}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>{Math.round(source.confidence * 100)}%</span>
          </div>
        </div>
        
        <h4 className={cn(
          "font-medium text-sm text-gray-900 mb-1 line-clamp-1",
          language === 'ar' ? 'font-arabic text-right' : 'text-left'
        )}>
          {source.title}
        </h4>
        
        <p className={cn(
          "text-xs text-gray-600 line-clamp-2 leading-relaxed",
          language === 'ar' ? 'font-arabic text-right' : 'text-left'
        )}>
          {source.excerpt}
        </p>
        
        {source.url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 p-1 mt-1 text-xs text-saudi-navy-600 hover:text-saudi-navy-700"
            onClick={() => window.open(source.url, '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
              {language === 'ar' ? 'عرض المصدر' : 'View source'}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

// Sources panel component
function SourcesPanel({ 
  sources, 
  language = 'ar' 
}: { 
  sources: SourceAttribution[]; 
  language?: 'ar' | 'en';
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between p-2 h-auto text-xs text-gray-600"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                {language === 'ar' 
                  ? `${sources.length} مصادر`
                  : `${sources.length} sources`
                }
              </span>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-2 mt-2">
          {sources.map((source, index) => (
            <SourceAttribution
              key={`${source.id}-${index}`}
              source={source}
              language={language}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Message rating component
function MessageRating({ 
  currentRating, 
  onRate, 
  language = 'ar' 
}: { 
  currentRating?: number;
  onRate: (rating: number) => void;
  language?: 'ar' | 'en';
}) {
  const [hoverRating, setHoverRating] = useState(0);
  
  return (
    <div className="flex items-center gap-1">
      <span className={cn(
        "text-xs text-gray-500",
        language === 'ar' ? 'font-arabic' : ''
      )}>
        {language === 'ar' ? 'قيم الإجابة:' : 'Rate:'}
      </span>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          className={cn(
            "p-1 rounded hover:bg-gray-100 transition-colors",
            (hoverRating >= rating || (currentRating && currentRating >= rating))
              ? "text-yellow-500"
              : "text-gray-300"
          )}
          onMouseEnter={() => setHoverRating(rating)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onRate(rating)}
        >
          <Star className="w-3 h-3 fill-current" />
        </button>
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  language = 'ar',
  isStreaming = false,
  showActions = true,
  className,
  onRateMessage,
  onCopyMessage
}: MessageBubbleProps) {
  const [showRating, setShowRating] = useState(false);
  const isUser = message.role === 'user';
  const isRTL = language === 'ar';
  
  // Handle copy message
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    onCopyMessage?.(message);
  }, [message, onCopyMessage]);

  // Handle rate message
  const handleRate = useCallback((rating: number) => {
    onRateMessage?.(message.id, rating);
    setShowRating(false);
  }, [message.id, onRateMessage]);

  // Determine message styling based on role and language
  const messageAlign = isUser 
    ? (isRTL ? 'justify-end' : 'justify-end')
    : (isRTL ? 'justify-start' : 'justify-start');
    
  const bubbleAlign = isUser
    ? (isRTL ? 'mr-0 ml-auto' : 'ml-0 mr-auto')
    : (isRTL ? 'ml-0 mr-auto' : 'mr-0 ml-auto');

  const bubbleColor = isUser
    ? 'bg-saudi-navy-700 text-white'
    : 'bg-gray-100 text-gray-900';

  const textAlign = isRTL ? 'text-right' : 'text-left';

  return (
    <div className={cn("flex", messageAlign, className)}>
      <div className={cn(
        "max-w-[80%] space-y-2",
        bubbleAlign
      )}>
        {/* Avatar and message container */}
        <div className="flex items-end gap-2">
          {!isUser && (
            <div className="w-8 h-8 bg-saudi-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-saudi-navy-600" />
            </div>
          )}
          
          {/* Message bubble */}
          <div className={cn(
            "relative rounded-2xl px-4 py-3 max-w-full",
            bubbleColor,
            isUser 
              ? "rounded-br-md" 
              : "rounded-bl-md"
          )}>
            {/* Message content */}
            <div className={cn(
              "prose prose-sm max-w-none",
              textAlign,
              isRTL ? 'font-arabic' : '',
              isUser ? 'prose-invert' : ''
            )}>
              {message.content.trim() ? (
                <SimpleMarkdown className="text-inherit">
                  {message.content}
                </SimpleMarkdown>
              ) : isStreaming ? (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : null}
            </div>

            {/* Message metadata */}
            {(message.metadata?.confidence || message.metadata?.tokensUsed) && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current border-opacity-20">
                {message.metadata.confidence && (
                  <div className="text-xs opacity-75">
                    <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                      {language === 'ar' ? 'الثقة:' : 'Confidence:'} {Math.round(message.metadata.confidence * 100)}%
                    </span>
                  </div>
                )}
                {message.metadata.tokensUsed && (
                  <div className="text-xs opacity-75">
                    <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                      {language === 'ar' ? 'الرموز:' : 'Tokens:'} {message.metadata.tokensUsed}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {isUser && (
            <div className="w-8 h-8 bg-saudi-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-saudi-green-600" />
            </div>
          )}
        </div>

        {/* Message timestamp and status */}
        <div className={cn(
          "flex items-center gap-2 px-3",
          isUser ? "justify-end" : "justify-start"
        )}>
          <MessageTimestamp timestamp={message.timestamp} language={language} />
          <MessageStatusIcon status={message.status} language={language} />
        </div>

        {/* Sources panel for assistant messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="px-1">
            <SourcesPanel sources={message.sources} language={language} />
          </div>
        )}

        {/* Message actions */}
        {showActions && !isStreaming && (
          <div className={cn(
            "flex items-center gap-1 px-1",
            isUser ? "justify-end" : "justify-start"
          )}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={handleCopy}
            >
              <Copy className="w-3 h-3 mr-1" />
              <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                {language === 'ar' ? 'نسخ' : 'Copy'}
              </span>
            </Button>

            {!isUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setShowRating(!showRating)}
              >
                <Star className="w-3 h-3 mr-1" />
                <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                  {language === 'ar' ? 'قيم' : 'Rate'}
                </span>
              </Button>
            )}

            {showActions && (
              <ChatActions
                message={message}
                language={language}
                onCopyMessage={onCopyMessage}
                onRateMessage={onRateMessage}
              />
            )}
          </div>
        )}

        {/* Rating panel */}
        {showRating && !isUser && (
          <div className="px-3">
            <MessageRating
              currentRating={message.rating}
              onRate={handleRate}
              language={language}
            />
          </div>
        )}
      </div>
    </div>
  );
}