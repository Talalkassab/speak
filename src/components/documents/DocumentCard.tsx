'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Edit, 
  Trash2, 
  Eye, 
  Share2, 
  Clock, 
  User, 
  Tag, 
  FolderOpen,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/contexts/organization-context';
import { 
  formatFileSize, 
  getStatusColor, 
  getStatusLabel, 
  ALLOWED_FILE_TYPES,
  type Document 
} from '@/types/documents';

interface DocumentCardProps {
  document: Document;
  onView?: (document: Document) => void;
  onEdit?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onShare?: (document: Document) => void;
  onToggleFavorite?: (document: Document) => void;
  viewMode?: 'grid' | 'list';
  language?: 'ar' | 'en';
  className?: string;
  showActions?: boolean;
  isFavorite?: boolean;
  isSelected?: boolean;
  onSelect?: (document: Document, selected: boolean) => void;
}

export function DocumentCard({
  document,
  onView,
  onEdit,
  onDelete,
  onDownload,
  onShare,
  onToggleFavorite,
  viewMode = 'grid',
  language = 'ar',
  className = '',
  showActions = true,
  isFavorite = false,
  isSelected = false,
  onSelect,
}: DocumentCardProps) {
  const { canManageDocuments } = usePermissions();
  const [isLoading, setIsLoading] = useState(false);

  const text = {
    ar: {
      view: 'عرض',
      edit: 'تحرير',
      delete: 'حذف',
      download: 'تحميل',
      share: 'مشاركة',
      addToFavorites: 'إضافة للمفضلة',
      removeFromFavorites: 'إزالة من المفضلة',
      copyLink: 'نسخ الرابط',
      category: 'التصنيف',
      uploadedBy: 'رفع بواسطة',
      createdAt: 'تاريخ الإنشاء',
      updatedAt: 'تاريخ التحديث',
      size: 'الحجم',
      language: 'اللغة',
      tags: 'العلامات',
      status: 'الحالة',
      version: 'الإصدار',
      noDescription: 'لا يوجد وصف',
      noCategory: 'غير مصنف',
      noTags: 'لا توجد علامات',
      arabic: 'عربي',
      english: 'إنجليزي',
      mixed: 'مختلط',
      public: 'عام',
      private: 'خاص',
    },
    en: {
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      download: 'Download',
      share: 'Share',
      addToFavorites: 'Add to Favorites',
      removeFromFavorites: 'Remove from Favorites',
      copyLink: 'Copy Link',
      category: 'Category',
      uploadedBy: 'Uploaded by',
      createdAt: 'Created',
      updatedAt: 'Updated',
      size: 'Size',
      language: 'Language',
      tags: 'Tags',
      status: 'Status',
      version: 'Version',
      noDescription: 'No description',
      noCategory: 'Uncategorized',
      noTags: 'No tags',
      arabic: 'Arabic',
      english: 'English',
      mixed: 'Mixed',
      public: 'Public',
      private: 'Private',
    },
  };

  const t = text[language];

  const getFileIcon = () => {
    const fileType = ALLOWED_FILE_TYPES[document.mime_type as keyof typeof ALLOWED_FILE_TYPES];
    if (fileType) {
      return fileType.icon;
    }
    return '📄';
  };

  const getStatusIcon = () => {
    switch (document.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-saudi-green-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-saudi-gold-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'archived':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <FileText className="h-4 w-4 text-saudi-navy-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'ar': return t.arabic;
      case 'en': return t.english;
      case 'mixed': return t.mixed;
      default: return lang;
    }
  };

  const handleAction = async (action: () => void | Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const cardClasses = `
    relative bg-white rounded-lg border border-gray-200 hover:border-saudi-navy-300 
    transition-all duration-200 hover:shadow-md group
    ${isSelected ? 'ring-2 ring-saudi-navy-500 border-saudi-navy-500' : ''}
    ${viewMode === 'grid' ? 'p-4' : 'p-3'}
    ${className}
  `;

  if (viewMode === 'list') {
    return (
      <div className={cardClasses} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Selection checkbox */}
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(document, e.target.checked)}
              className="w-4 h-4 text-saudi-navy-600 border-gray-300 rounded focus:ring-saudi-navy-500"
            />
          )}

          {/* File icon and status */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg">
              <span className="text-lg">{getFileIcon()}</span>
            </div>
            {getStatusIcon()}
          </div>

          {/* Document info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 space-x-reverse">
              <h3 className="text-lg font-medium text-saudi-navy-900 truncate arabic-text">
                {document.title}
              </h3>
              {isFavorite && <Star className="h-4 w-4 text-saudi-gold-500 fill-current" />}
              {document.is_public && (
                <Badge variant="secondary" className="text-xs">
                  {t.public}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-500 mt-1">
              <span>{document.filename}</span>
              <span>{formatFileSize(document.file_size, language)}</span>
              <span>{formatDate(document.created_at)}</span>
              {document.category && (
                <span className="flex items-center space-x-1 space-x-reverse">
                  <FolderOpen className="h-3 w-3" />
                  <span>{document.category.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          {document.tags.length > 0 && (
            <div className="flex items-center space-x-2 space-x-reverse">
              {document.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {document.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{document.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex items-center space-x-2 space-x-reverse">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView?.(document)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isLoading}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                  <DropdownMenuItem onClick={() => onView?.(document)}>
                    <Eye className="h-4 w-4 me-2" />
                    {t.view}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload?.(document)}>
                    <Download className="h-4 w-4 me-2" />
                    {t.download}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyToClipboard(document.upload_url || '')}>
                    <Copy className="h-4 w-4 me-2" />
                    {t.copyLink}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(document)}>
                    <Share2 className="h-4 w-4 me-2" />
                    {t.share}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleFavorite?.(document)}>
                    <Star className={`h-4 w-4 me-2 ${isFavorite ? 'fill-current' : ''}`} />
                    {isFavorite ? t.removeFromFavorites : t.addToFavorites}
                  </DropdownMenuItem>
                  {canManageDocuments() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit?.(document)}>
                        <Edit className="h-4 w-4 me-2" />
                        {t.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete?.(document)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 me-2" />
                        {t.delete}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className={cardClasses} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute top-3 start-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(document, e.target.checked)}
            className="w-4 h-4 text-saudi-navy-600 border-gray-300 rounded focus:ring-saudi-navy-500"
          />
        </div>
      )}

      {/* Favorite star */}
      {isFavorite && (
        <div className="absolute top-3 end-3 z-10">
          <Star className="h-4 w-4 text-saudi-gold-500 fill-current" />
        </div>
      )}

      {/* File preview area */}
      <div 
        className="relative h-32 bg-gray-50 rounded-lg mb-4 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => onView?.(document)}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">{getFileIcon()}</div>
          <div className="flex items-center justify-center space-x-2 space-x-reverse">
            {getStatusIcon()}
            <span className="text-xs text-gray-500 capitalize">
              {getStatusLabel(document.status, language)}
            </span>
          </div>
        </div>
      </div>

      {/* Document metadata */}
      <div className="space-y-3">
        <div>
          <h3 
            className="font-semibold text-saudi-navy-900 truncate arabic-heading cursor-pointer hover:text-saudi-navy-700"
            onClick={() => onView?.(document)}
            title={document.title}
          >
            {document.title}
          </h3>
          <p className="text-sm text-gray-600 truncate arabic-text" title={document.description}>
            {document.description || t.noDescription}
          </p>
        </div>

        {/* File details */}
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-center justify-between">
            <span>{formatFileSize(document.file_size, language)}</span>
            <span>{getLanguageLabel(document.content_language)}</span>
          </div>
          
          <div className="flex items-center space-x-1 space-x-reverse">
            <User className="h-3 w-3" />
            <span className="truncate">
              {document.uploader?.email?.split('@')[0] || 'Unknown'}
            </span>
          </div>

          <div className="flex items-center space-x-1 space-x-reverse">
            <Clock className="h-3 w-3" />
            <span>{formatDate(document.created_at)}</span>
          </div>

          {document.category && (
            <div className="flex items-center space-x-1 space-x-reverse">
              <FolderOpen className="h-3 w-3" />
              <span className="truncate">{document.category.name}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {document.tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {document.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{document.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Public indicator */}
        {document.is_public && (
          <Badge variant="outline" className="w-fit text-xs">
            {t.public}
          </Badge>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-1 space-x-reverse">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView?.(document)}
                className="text-saudi-navy-600 hover:text-saudi-navy-700"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload?.(document)}
                className="text-saudi-navy-600 hover:text-saudi-navy-700"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {canManageDocuments() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                  <DropdownMenuItem onClick={() => onShare?.(document)}>
                    <Share2 className="h-4 w-4 me-2" />
                    {t.share}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleFavorite?.(document)}>
                    <Star className={`h-4 w-4 me-2 ${isFavorite ? 'fill-current' : ''}`} />
                    {isFavorite ? t.removeFromFavorites : t.addToFavorites}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit?.(document)}>
                    <Edit className="h-4 w-4 me-2" />
                    {t.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(document)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 me-2" />
                    {t.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
}