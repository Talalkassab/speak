'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search,
  Plus,
  MessageSquare,
  Archive,
  Trash2,
  MoreHorizontal,
  Filter,
  ChevronDown,
  Calendar,
  Tag,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/utils/cn';
import type { Conversation, ConversationFilter } from '@/types/chat';

interface ConversationSidebarProps {
  userId: string;
  organizationId: string;
  currentConversationId?: string;
  onConversationSelect?: (conversation: Conversation) => void;
  className?: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onClick?: () => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Individual conversation item component
function ConversationItem({ 
  conversation, 
  isActive, 
  onClick, 
  onArchive, 
  onDelete 
}: ConversationItemProps) {
  const formatDate = useCallback((date: Date | null) => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'الآن';
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    
    return date.toLocaleDateString('ar-SA', {
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const getPreviewMessage = useCallback(() => {
    if (!conversation.recentMessages?.length) {
      return conversation.language === 'ar' ? 'لا توجد رسائل' : 'No messages';
    }
    
    const lastMessage = conversation.recentMessages[conversation.recentMessages.length - 1];
    const content = lastMessage.content;
    const maxLength = 60;
    
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }, [conversation]);

  const languageIcon = conversation.language === 'ar' ? '🇸🇦' : '🇺🇸';

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:shadow-sm',
        isActive 
          ? 'bg-saudi-navy-50 border-saudi-navy-300 shadow-sm' 
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      )}
      onClick={onClick}
    >
      {/* Main content */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{languageIcon}</span>
            <h3 className={cn(
              'font-medium text-sm truncate',
              conversation.language === 'ar' ? 'text-right font-arabic' : 'text-left',
              isActive ? 'text-saudi-navy-900' : 'text-gray-900'
            )}>
              {conversation.title}
            </h3>
          </div>
          
          <p className={cn(
            'text-xs text-gray-600 line-clamp-2 leading-relaxed',
            conversation.language === 'ar' ? 'text-right font-arabic' : 'text-left'
          )}>
            {getPreviewMessage()}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare className="w-3 h-3" />
              <span>{conversation.messageCount}</span>
            </div>
            
            <time className="text-xs text-gray-500 font-arabic">
              {formatDate(conversation.lastMessageAt)}
            </time>
          </div>
        </div>
        
        {/* Action menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onArchive?.(conversation.id);
            }}>
              <Archive className="w-4 h-4 ml-2" />
              <span className="font-arabic">أرشف المحادثة</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(conversation.id);
              }}
            >
              <Trash2 className="w-4 h-4 ml-2" />
              <span className="font-arabic">احذف المحادثة</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Filter panel component
function FilterPanel({ 
  filters, 
  onFiltersChange, 
  isOpen, 
  onToggle 
}: {
  filters: ConversationFilter;
  onFiltersChange: (filters: ConversationFilter) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between font-arabic">
          <span>تصفية النتائج</span>
          <div className="flex items-center gap-1">
            {(filters.language || filters.dateFrom) && (
              <Badge variant="secondary" className="h-4 text-xs">
                {Object.keys(filters).filter(k => filters[k as keyof ConversationFilter]).length}
              </Badge>
            )}
            <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
          </div>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-3 pt-3">
        {/* Language filter */}
        <div>
          <label className="text-xs font-medium text-gray-700 font-arabic mb-1 block">
            اللغة
          </label>
          <div className="flex gap-1">
            <Button
              variant={filters.language === 'ar' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs font-arabic"
              onClick={() => onFiltersChange({
                ...filters,
                language: filters.language === 'ar' ? undefined : 'ar'
              })}
            >
              🇸🇦 عربي
            </Button>
            <Button
              variant={filters.language === 'en' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onFiltersChange({
                ...filters,
                language: filters.language === 'en' ? undefined : 'en'
              })}
            >
              🇺🇸 English
            </Button>
          </div>
        </div>
        
        {/* Date range filter */}
        <div>
          <label className="text-xs font-medium text-gray-700 font-arabic mb-1 block">
            التاريخ
          </label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant={filters.dateFrom ? 'default' : 'outline'}
              size="sm"
              className="text-xs font-arabic"
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                onFiltersChange({
                  ...filters,
                  dateFrom: filters.dateFrom ? undefined : weekAgo
                });
              }}
            >
              هذا الأسبوع
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-arabic"
              onClick={() => onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined })}
            >
              إعادة تعيين
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ConversationSidebar({
  userId,
  organizationId,
  currentConversationId,
  onConversationSelect,
  className
}: ConversationSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ConversationFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.language) params.append('language', filters.language);
      params.append('limit', '50');

      const response = await fetch(`/api/v1/chat/conversations?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setConversations(result.data || []);
      } else {
        throw new Error(result.error?.message || 'Failed to load conversations');
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err instanceof Error ? err.message : 'فشل في تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  // Create new conversation
  const createNewConversation = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'ar',
          metadata: {}
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const newConversation = result.data;
        setConversations(prev => [newConversation, ...prev]);
        router.push(`/chat/${newConversation.id}`);
      } else {
        throw new Error(result.error?.message || 'Failed to create conversation');
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'فشل في إنشاء محادثة جديدة');
    }
  }, [router]);

  // Archive conversation
  const archiveConversation = useCallback(async (conversationId: string) => {
    try {
      // Implementation would call API to archive conversation
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  }, [currentConversationId, router]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المحادثة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    try {
      // Implementation would call API to delete conversation
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  }, [currentConversationId, router]);

  // Handle conversation selection
  const handleConversationClick = useCallback((conversation: Conversation) => {
    if (onConversationSelect) {
      onConversationSelect(conversation);
    } else {
      router.push(`/chat/${conversation.id}`);
    }
  }, [onConversationSelect, router]);

  // Load conversations on mount and when dependencies change
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadConversations();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, loadConversations]);

  return (
    <div className={cn("flex flex-col h-full bg-gray-50 border-r border-gray-200", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-arabic">المحادثات</h2>
          <Button
            onClick={createNewConversation}
            size="sm"
            className="bg-saudi-navy-700 hover:bg-saudi-navy-800"
          >
            <Plus className="w-4 h-4 ml-1" />
            <span className="font-arabic">جديدة</span>
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="ابحث في المحادثات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 font-arabic text-right"
          />
        </div>
        
        {/* Filters */}
        <div className="mt-3">
          <FilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            isOpen={showFilters}
            onToggle={() => setShowFilters(!showFilters)}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-8"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-600 font-arabic mb-2">خطأ في التحميل</div>
            <p className="text-sm text-gray-600 font-arabic mb-4">{error}</p>
            <Button onClick={loadConversations} variant="outline" size="sm">
              <span className="font-arabic">إعادة المحاولة</span>
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-arabic mb-4">
              {searchQuery ? 'لا توجد محادثات تطابق البحث' : 'لا توجد محادثات بعد'}
            </p>
            {!searchQuery && (
              <Button onClick={createNewConversation} className="font-arabic">
                <Plus className="w-4 h-4 ml-1" />
                ابدأ محادثة جديدة
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onClick={() => handleConversationClick(conversation)}
                onArchive={archiveConversation}
                onDelete={deleteConversation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}