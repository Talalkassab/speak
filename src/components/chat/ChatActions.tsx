'use client';

import { useState, useCallback } from 'react';
import { 
  Copy, 
  Star, 
  Download, 
  Share2, 
  Edit, 
  Trash2, 
  Flag,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';
import type { ChatMessage, MessageAction } from '@/types/chat';

interface ChatActionsProps {
  message: ChatMessage;
  language?: 'ar' | 'en';
  onCopyMessage?: (message: ChatMessage) => void;
  onRateMessage?: (messageId: string, rating: number) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onShareMessage?: (message: ChatMessage) => void;
  onFlagMessage?: (messageId: string, reason: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  showAllActions?: boolean;
  className?: string;
}

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentRating?: number;
  onRate: (rating: number) => void;
  language?: 'ar' | 'en';
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage;
  onShare: (message: ChatMessage) => void;
  language?: 'ar' | 'en';
}

interface EditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage;
  onEdit: (messageId: string, newContent: string) => void;
  language?: 'ar' | 'en';
}

interface FlagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  onFlag: (messageId: string, reason: string) => void;
  language?: 'ar' | 'en';
}

// Rating dialog component
function RatingDialog({ isOpen, onClose, currentRating, onRate, language = 'ar' }: RatingDialogProps) {
  const [selectedRating, setSelectedRating] = useState(currentRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const isRTL = language === 'ar';

  const handleRate = useCallback(() => {
    if (selectedRating > 0) {
      onRate(selectedRating);
      onClose();
    }
  }, [selectedRating, onRate, onClose]);

  const ratingLabels = {
    ar: ['سيء جداً', 'سيء', 'متوسط', 'جيد', 'ممتاز'],
    en: ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(isRTL ? 'font-arabic text-right' : 'text-left')}>
            {isRTL ? 'قيم جودة الإجابة' : 'Rate Response Quality'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  (hoverRating >= rating || selectedRating >= rating)
                    ? "text-yellow-500 bg-yellow-50"
                    : "text-gray-300 hover:text-yellow-400 hover:bg-yellow-50"
                )}
                onMouseEnter={() => setHoverRating(rating)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setSelectedRating(rating)}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>
          
          {(selectedRating > 0 || hoverRating > 0) && (
            <div className="text-center">
              <p className={cn(
                "text-sm text-gray-600",
                isRTL ? 'font-arabic' : ''
              )}>
                {ratingLabels[language][(hoverRating || selectedRating) - 1]}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </span>
          </Button>
          <Button onClick={handleRate} disabled={selectedRating === 0}>
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'تقييم' : 'Rate'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Share dialog component
function ShareDialog({ isOpen, onClose, message, onShare, language = 'ar' }: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const isRTL = language === 'ar';

  const handleCopyLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}/chat/${message.conversationId}#${message.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      
      toast({
        title: isRTL ? 'تم النسخ' : 'Copied',
        description: isRTL ? 'تم نسخ الرابط إلى الحافظة' : 'Link copied to clipboard',
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في نسخ الرابط' : 'Failed to copy link',
        variant: 'destructive',
      });
    }
  }, [message, toast, isRTL]);

  const handleShare = useCallback(() => {
    onShare(message);
    onClose();
  }, [message, onShare, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(isRTL ? 'font-arabic text-right' : 'text-left')}>
            {isRTL ? 'مشاركة الرسالة' : 'Share Message'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div>
            <label className={cn(
              "block text-sm font-medium text-gray-700 mb-2",
              isRTL ? 'font-arabic' : ''
            )}>
              {isRTL ? 'نسخة من الرسالة:' : 'Message preview:'}
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className={cn(
                "text-sm text-gray-700 line-clamp-3",
                isRTL ? 'text-right font-arabic' : 'text-left'
              )}>
                {message.content}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex-1"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              <span className={cn(isRTL ? 'font-arabic' : '')}>
                {copied 
                  ? (isRTL ? 'تم النسخ' : 'Copied')
                  : (isRTL ? 'نسخ الرابط' : 'Copy link')
                }
              </span>
            </Button>
            
            <Button onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              <span className={cn(isRTL ? 'font-arabic' : '')}>
                {isRTL ? 'مشاركة' : 'Share'}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'إغلاق' : 'Close'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit dialog component
function EditDialog({ isOpen, onClose, message, onEdit, language = 'ar' }: EditDialogProps) {
  const [editedContent, setEditedContent] = useState(message.content);
  const [isEditing, setIsEditing] = useState(false);
  const isRTL = language === 'ar';

  const handleEdit = useCallback(async () => {
    if (editedContent.trim() !== message.content.trim()) {
      setIsEditing(true);
      try {
        await onEdit(message.id, editedContent.trim());
        onClose();
      } catch (error) {
        console.error('Failed to edit message:', error);
      } finally {
        setIsEditing(false);
      }
    } else {
      onClose();
    }
  }, [editedContent, message, onEdit, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className={cn(isRTL ? 'font-arabic text-right' : 'text-left')}>
            {isRTL ? 'تعديل الرسالة' : 'Edit Message'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className={cn(
              "min-h-[120px] resize-none",
              isRTL ? 'text-right font-arabic' : 'text-left'
            )}
            placeholder={isRTL ? 'عدل رسالتك...' : 'Edit your message...'}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <div className="mt-2 text-xs text-gray-500 text-right">
            {editedContent.length}/4000
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isEditing}>
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </span>
          </Button>
          <Button onClick={handleEdit} disabled={isEditing || !editedContent.trim()}>
            {isEditing && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isEditing 
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : (isRTL ? 'حفظ' : 'Save')
              }
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Flag dialog component
function FlagDialog({ isOpen, onClose, messageId, onFlag, language = 'ar' }: FlagDialogProps) {
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRTL = language === 'ar';

  const flagReasons = {
    ar: [
      'محتوى غير مناسب',
      'معلومات خاطئة',
      'محتوى مؤذي',
      'محتوى مكرر',
      'مشكلة أخرى'
    ],
    en: [
      'Inappropriate content',
      'Incorrect information',
      'Harmful content',
      'Spam or duplicate',
      'Other issue'
    ]
  };

  const handleFlag = useCallback(async () => {
    const finalReason = selectedReason || reason;
    if (!finalReason.trim()) return;

    setIsSubmitting(true);
    try {
      await onFlag(messageId, finalReason);
      onClose();
      setReason('');
      setSelectedReason('');
    } catch (error) {
      console.error('Failed to flag message:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [messageId, selectedReason, reason, onFlag, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(isRTL ? 'font-arabic text-right' : 'text-left')}>
            {isRTL ? 'الإبلاغ عن مشكلة' : 'Report Issue'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div>
            <label className={cn(
              "block text-sm font-medium text-gray-700 mb-2",
              isRTL ? 'font-arabic' : ''
            )}>
              {isRTL ? 'سبب الإبلاغ:' : 'Reason for reporting:'}
            </label>
            <div className="space-y-2">
              {flagReasons[language].map((reasonOption, index) => (
                <label key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="reason"
                    value={reasonOption}
                    checked={selectedReason === reasonOption}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="border-gray-300"
                  />
                  <span className={cn(
                    "text-sm",
                    isRTL ? 'font-arabic' : ''
                  )}>
                    {reasonOption}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === flagReasons[language][flagReasons[language].length - 1] && (
            <div>
              <label className={cn(
                "block text-sm font-medium text-gray-700 mb-2",
                isRTL ? 'font-arabic' : ''
              )}>
                {isRTL ? 'تفاصيل إضافية:' : 'Additional details:'}
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={cn(
                  "min-h-[80px] resize-none",
                  isRTL ? 'text-right font-arabic' : 'text-left'
                )}
                placeholder={isRTL ? 'اشرح المشكلة...' : 'Describe the issue...'}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </span>
          </Button>
          <Button 
            onClick={handleFlag} 
            disabled={isSubmitting || (!selectedReason && !reason.trim())}
            variant="destructive"
          >
            {isSubmitting && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isSubmitting 
                ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
                : (isRTL ? 'إرسال البلاغ' : 'Submit report')
              }
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChatActions({
  message,
  language = 'ar',
  onCopyMessage,
  onRateMessage,
  onEditMessage,
  onDeleteMessage,
  onShareMessage,
  onFlagMessage,
  onRetryMessage,
  showAllActions = false,
  className
}: ChatActionsProps) {
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const { toast } = useToast();

  const isRTL = language === 'ar';
  const isUser = message.role === 'user';
  const canEdit = isUser && message.status !== 'sending';
  const canRate = !isUser && message.status === 'delivered';
  const canRetry = message.status === 'failed';

  // Copy message handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      onCopyMessage?.(message);
      
      toast({
        title: isRTL ? 'تم النسخ' : 'Copied',
        description: isRTL ? 'تم نسخ الرسالة إلى الحافظة' : 'Message copied to clipboard',
      });
    } catch (error) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في نسخ الرسالة' : 'Failed to copy message',
        variant: 'destructive',
      });
    }
  }, [message, onCopyMessage, toast, isRTL]);

  // Delete message handler
  const handleDelete = useCallback(() => {
    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Are you sure you want to delete this message?')) {
      onDeleteMessage?.(message.id);
    }
  }, [message.id, onDeleteMessage, isRTL]);

  // Retry message handler
  const handleRetry = useCallback(() => {
    onRetryMessage?.(message);
  }, [message, onRetryMessage]);

  // Define available actions
  const actions: MessageAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      labelAr: 'نسخ',
      icon: Copy,
      action: handleCopy,
      visible: () => true,
    },
    {
      id: 'rate',
      label: 'Rate',
      labelAr: 'تقييم',
      icon: Star,
      action: () => setShowRatingDialog(true),
      visible: () => canRate,
    },
    {
      id: 'edit',
      label: 'Edit',
      labelAr: 'تعديل',
      icon: Edit,
      action: () => setShowEditDialog(true),
      visible: () => canEdit && !!onEditMessage,
    },
    {
      id: 'share',
      label: 'Share',
      labelAr: 'مشاركة',
      icon: Share2,
      action: () => setShowShareDialog(true),
      visible: () => !!onShareMessage,
    },
    {
      id: 'retry',
      label: 'Retry',
      labelAr: 'إعادة المحاولة',
      icon: RefreshCw,
      action: handleRetry,
      visible: () => canRetry && !!onRetryMessage,
    },
    {
      id: 'flag',
      label: 'Report',
      labelAr: 'إبلاغ',
      icon: Flag,
      action: () => setShowFlagDialog(true),
      visible: () => !isUser && !!onFlagMessage,
      variant: 'destructive' as const,
    },
    {
      id: 'delete',
      label: 'Delete',
      labelAr: 'حذف',
      icon: Trash2,
      action: handleDelete,
      visible: () => isUser && !!onDeleteMessage,
      variant: 'destructive' as const,
    },
  ];

  const visibleActions = actions.filter(action => action.visible(message));
  const primaryActions = showAllActions ? visibleActions : visibleActions.slice(0, 2);
  const moreActions = showAllActions ? [] : visibleActions.slice(2);

  if (visibleActions.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Primary actions */}
      {primaryActions.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs text-gray-500 hover:text-gray-700",
            action.variant === 'destructive' && "hover:text-red-600"
          )}
          onClick={() => action.action(message)}
        >
          <action.icon className="w-3 h-3 mr-1" />
          <span className={cn(isRTL ? 'font-arabic' : '')}>
            {isRTL ? action.labelAr : action.label}
          </span>
        </Button>
      ))}

      {/* More actions dropdown */}
      {moreActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {moreActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => action.action(message)}
                className={cn(
                  action.variant === 'destructive' && "text-red-600 focus:text-red-600"
                )}
              >
                <action.icon className="w-4 h-4 mr-2" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? action.labelAr : action.label}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Dialogs */}
      <RatingDialog
        isOpen={showRatingDialog}
        onClose={() => setShowRatingDialog(false)}
        currentRating={message.rating}
        onRate={(rating) => onRateMessage?.(message.id, rating)}
        language={language}
      />

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        message={message}
        onShare={onShareMessage!}
        language={language}
      />

      {canEdit && onEditMessage && (
        <EditDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          message={message}
          onEdit={onEditMessage}
          language={language}
        />
      )}

      <FlagDialog
        isOpen={showFlagDialog}
        onClose={() => setShowFlagDialog(false)}
        messageId={message.id}
        onFlag={onFlagMessage!}
        language={language}
      />
    </div>
  );
}