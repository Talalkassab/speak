'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  language?: 'ar' | 'en';
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

interface VirtualizedMessageListProps extends MessageListProps {
  itemHeight?: number;
  overscan?: number;
}

// Simple virtualized list implementation for better performance
function VirtualizedMessageList({
  messages,
  isLoading = false,
  isStreaming = false,
  language = 'ar',
  onLoadMore,
  hasMore = false,
  itemHeight = 120, // Estimated height per message
  overscan = 5,
  className
}: VirtualizedMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    messages.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    const maxScroll = target.scrollHeight - target.clientHeight;
    
    setScrollTop(newScrollTop);
    
    // Check if user scrolled away from bottom
    const isNearBottom = newScrollTop >= maxScroll - 100;
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);
    
    // Load more messages when scrolled to top
    if (newScrollTop === 0 && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore, messages.length]);

  // Auto-scroll when new messages arrive (if enabled)
  useEffect(() => {
    if (isAutoScrollEnabled && messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [messages.length, isAutoScrollEnabled, scrollToBottom]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && isAutoScrollEnabled) {
      scrollToBottom(false);
    }
  }, [isStreaming, isAutoScrollEnabled, scrollToBottom]);

  // Update container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Group messages by date for better organization
  const groupedMessages = messages.reduce((groups, message, index) => {
    const messageDate = new Date(message.timestamp);
    const dateKey = messageDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push({ message, index });
    return groups;
  }, {} as Record<string, { message: ChatMessage; index: number }[]>);

  const visibleMessages = messages.slice(startIndex, endIndex + 1);
  const totalHeight = messages.length * itemHeight;

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      {/* Loading indicator for older messages */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-3 h-3 border-2 border-saudi-navy-300 border-t-saudi-navy-600 rounded-full animate-spin"></div>
              <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message container with virtual scrolling */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e0 #f7fafc'
        }}
      >
        {/* Spacer for virtual scrolling */}
        <div style={{ height: startIndex * itemHeight }} />

        {/* Visible messages */}
        <div className="px-4 py-4 space-y-4">
          {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => {
            // Check if any messages in this date group are visible
            const hasVisibleMessages = dateMessages.some(
              ({ index }) => index >= startIndex && index <= endIndex
            );

            if (!hasVisibleMessages) return null;

            return (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-6">
                  <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                    <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                      {dateKey}
                    </span>
                  </div>
                </div>

                {/* Messages for this date */}
                <div className="space-y-4">
                  {dateMessages
                    .filter(({ index }) => index >= startIndex && index <= endIndex)
                    .map(({ message, index }) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        language={language}
                        isStreaming={isStreaming && index === messages.length - 1}
                      />
                    ))}
                </div>
              </div>
            );
          })}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className={cn(
              "flex items-center gap-2 text-xs text-gray-500 mb-4",
              language === 'ar' ? 'justify-start font-arabic' : 'justify-start'
            )}>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span>{language === 'ar' ? 'جاري الكتابة...' : 'AI is typing...'}</span>
            </div>
          )}
        </div>

        {/* Spacer for virtual scrolling */}
        <div style={{ height: Math.max(0, totalHeight - (endIndex + 1) * itemHeight) }} />

        {/* Invisible element to measure scroll position */}
        <div ref={lastMessageRef} style={{ height: 1 }} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={() => scrollToBottom(true)}
            size="sm"
            className="bg-white border border-gray-300 text-gray-700 shadow-lg hover:bg-gray-50"
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
              {language === 'ar' ? 'إلى الأسفل' : 'Scroll down'}
            </span>
          </Button>
        </div>
      )}

      {/* Load more indicator */}
      {hasMore && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 pt-2">
          <Button
            onClick={onLoadMore}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="bg-white shadow-sm"
          >
            <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
              {isLoading 
                ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...')
                : (language === 'ar' ? 'تحميل المزيد' : 'Load more')
              }
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

// Main MessageList component
export function MessageList(props: MessageListProps) {
  // For small message lists, use simple rendering
  // For large lists (>50 messages), use virtualization
  if (props.messages.length <= 50) {
    return <SimpleMessageList {...props} />;
  }

  return <VirtualizedMessageList {...props} />;
}

// Simple message list for small conversations
function SimpleMessageList({
  messages,
  isLoading = false,
  isStreaming = false,
  language = 'ar',
  onLoadMore,
  hasMore = false,
  className
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const maxScroll = target.scrollHeight - target.clientHeight;
    
    const isNearBottom = scrollTop >= maxScroll - 100;
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);
    
    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore, messages.length]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isAutoScrollEnabled && messages.length > 0) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [messages.length, isAutoScrollEnabled, scrollToBottom]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && isAutoScrollEnabled) {
      scrollToBottom(false);
    }
  }, [isStreaming, isAutoScrollEnabled, scrollToBottom]);

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const messageDate = new Date(message.timestamp);
    const dateKey = messageDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-3 h-3 border-2 border-saudi-navy-300 border-t-saudi-navy-600 rounded-full animate-spin"></div>
              <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Messages container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth px-4 py-4"
        onScroll={handleScroll}
      >
        <div className="space-y-4">
          {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
            <div key={dateKey}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-6">
                <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                  <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
                    {dateKey}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                {dateMessages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    language={language}
                    isStreaming={isStreaming && index === dateMessages.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className={cn(
              "flex items-center gap-2 text-xs text-gray-500",
              language === 'ar' ? 'justify-start font-arabic' : 'justify-start'
            )}>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-saudi-navy-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span>{language === 'ar' ? 'جاري الكتابة...' : 'AI is typing...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={() => scrollToBottom(true)}
            size="sm"
            className="bg-white border border-gray-300 text-gray-700 shadow-lg hover:bg-gray-50"
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            <span className={cn(language === 'ar' ? 'font-arabic' : '')}>
              {language === 'ar' ? 'إلى الأسفل' : 'Scroll down'}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}