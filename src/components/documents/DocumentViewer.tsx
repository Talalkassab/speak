'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Share2,
  Edit,
  Trash2,
  Clock,
  User,
  Tag,
  FolderOpen,
  FileText,
  Image,
  File,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/contexts/organization-context';
import {
  formatFileSize,
  getStatusLabel,
  getStatusColor,
  ALLOWED_FILE_TYPES,
} from '@/types/documents';
import type { Document, DocumentVersion } from '@/types/documents';

interface DocumentViewerProps {
  document: Document;
  versions?: DocumentVersion[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onShare?: (document: Document) => void;
  language?: 'ar' | 'en';
  className?: string;
}

export function DocumentViewer({
  document,
  versions = [],
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDownload,
  onShare,
  language = 'ar',
  className = '',
}: DocumentViewerProps) {
  const { canManageDocuments } = usePermissions();
  const [currentVersion, setCurrentVersion] = useState(document);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(false);

  const text = {
    ar: {
      close: 'إغلاق',
      edit: 'تحرير',
      delete: 'حذف',
      download: 'تحميل',
      share: 'مشاركة',
      zoomIn: 'تكبير',
      zoomOut: 'تصغير',
      rotate: 'تدوير',
      fullscreen: 'ملء الشاشة',
      exitFullscreen: 'إغلاق ملء الشاشة',
      versions: 'الإصدارات',
      showVersions: 'عرض الإصدارات',
      hideVersions: 'إخفاء الإصدارات',
      currentVersion: 'الإصدار الحالي',
      version: 'إصدار',
      uploadedBy: 'رفع بواسطة',
      uploadedAt: 'تاريخ الرفع',
      fileSize: 'حجم الملف',
      fileType: 'نوع الملف',
      category: 'التصنيف',
      tags: 'العلامات',
      status: 'الحالة',
      description: 'الوصف',
      noDescription: 'لا يوجد وصف',
      noCategory: 'غير مصنف',
      noTags: 'لا توجد علامات',
      previewNotAvailable: 'المعاينة غير متوفرة لهذا النوع من الملفات',
      loading: 'جاري التحميل...',
      error: 'خطأ في تحميل الملف',
      downloadFile: 'تحميل الملف للعرض',
      arabic: 'عربي',
      english: 'إنجليزي',
      mixed: 'مختلط',
      public: 'عام',
      private: 'خاص',
    },
    en: {
      close: 'Close',
      edit: 'Edit',
      delete: 'Delete',
      download: 'Download',
      share: 'Share',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      rotate: 'Rotate',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit Fullscreen',
      versions: 'Versions',
      showVersions: 'Show Versions',
      hideVersions: 'Hide Versions',
      currentVersion: 'Current Version',
      version: 'Version',
      uploadedBy: 'Uploaded by',
      uploadedAt: 'Uploaded at',
      fileSize: 'File Size',
      fileType: 'File Type',
      category: 'Category',
      tags: 'Tags',
      status: 'Status',
      description: 'Description',
      noDescription: 'No description',
      noCategory: 'Uncategorized',
      noTags: 'No tags',
      previewNotAvailable: 'Preview not available for this file type',
      loading: 'Loading...',
      error: 'Error loading file',
      downloadFile: 'Download file to view',
      arabic: 'Arabic',
      english: 'English',
      mixed: 'Mixed',
      public: 'Public',
      private: 'Private',
    },
  };

  const t = text[language];

  // Reset state when document changes
  useEffect(() => {
    if (document) {
      setCurrentVersion(document);
      setZoomLevel(100);
      setRotation(0);
      setFullscreen(false);
    }
  }, [document]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) {
          setFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, fullscreen, onClose]);

  const getFileIcon = () => {
    const mimeType = currentVersion.mime_type;
    const fileType = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];
    
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
    if (mimeType.includes('text')) return '📄';
    
    return fileType?.icon || '📄';
  };

  const canPreview = () => {
    const mimeType = currentVersion.mime_type;
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain'
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prev => {
      if (direction === 'in') {
        return Math.min(prev + 25, 300);
      } else {
        return Math.max(prev - 25, 50);
      }
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleVersionSelect = (version: DocumentVersion) => {
    // In a real implementation, you'd fetch the version document
    // For now, we'll just show the current document
    setShowVersions(false);
  };

  const renderPreview = () => {
    const mimeType = currentVersion.mime_type;
    const transform = `scale(${zoomLevel / 100}) rotate(${rotation}deg)`;

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saudi-navy-600 mx-auto mb-4"></div>
            <p className="text-saudi-navy-600 arabic-text">{t.loading}</p>
          </div>
        </div>
      );
    }

    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center h-full overflow-hidden">
          <img
            src={currentVersion.upload_url}
            alt={currentVersion.title}
            style={{ transform }}
            className="max-w-full max-h-full object-contain transition-transform"
            onError={() => setLoading(false)}
          />
        </div>
      );
    }

    if (mimeType === 'application/pdf') {
      return (
        <div className="flex items-center justify-center h-full">
          <iframe
            src={`${currentVersion.upload_url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border-0"
            style={{ transform }}
            title={currentVersion.title}
          />
        </div>
      );
    }

    if (mimeType === 'text/plain') {
      return (
        <div className="h-full overflow-auto p-6 bg-white">
          <div 
            style={{ transform, transformOrigin: 'top left' }}
            className="transition-transform"
          >
            <pre className="whitespace-pre-wrap arabic-text text-sm leading-relaxed">
              {currentVersion.content || t.loading}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="text-6xl">{getFileIcon()}</div>
        <div>
          <h3 className="text-lg font-medium text-saudi-navy-900 mb-2 arabic-heading">
            {t.previewNotAvailable}
          </h3>
          <p className="text-gray-600 mb-4 arabic-text">
            {currentVersion.filename}
          </p>
          <Button
            onClick={() => onDownload?.(currentVersion)}
            className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
          >
            <Download className="h-4 w-4 me-2" />
            {t.downloadFile}
          </Button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const containerClasses = fullscreen 
    ? 'fixed inset-0 z-50 bg-black' 
    : 'fixed inset-0 z-40 bg-black bg-opacity-50';

  const modalClasses = fullscreen
    ? 'w-full h-full bg-white'
    : 'bg-white rounded-lg shadow-xl max-w-7xl max-h-[90vh] w-full mx-4';

  return (
    <div className={containerClasses} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`flex items-center justify-center min-h-full p-4 ${fullscreen ? 'p-0' : ''}`}>
        <div className={`${modalClasses} flex flex-col relative ${className}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4 space-x-reverse flex-1 min-w-0">
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-2xl">{getFileIcon()}</span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getStatusColor(currentVersion.status) }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-saudi-navy-900 truncate arabic-heading">
                  {currentVersion.title}
                </h2>
                <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-500 mt-1">
                  <span>{currentVersion.filename}</span>
                  <span>{formatFileSize(currentVersion.file_size, language)}</span>
                  <span>{formatDate(currentVersion.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2 space-x-reverse">
              {versions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVersions(!showVersions)}
                >
                  <Clock className="h-4 w-4 me-2" />
                  {t.versions} ({versions.length})
                </Button>
              )}
              
              {canPreview() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom('out')}
                    disabled={zoomLevel <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    {zoomLevel}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom('in')}
                    disabled={zoomLevel >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotate}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFullscreen(!fullscreen)}
              >
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload?.(currentVersion)}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {canManageDocuments() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit?.(currentVersion)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShare?.(currentVersion)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex flex-1 min-h-0">
            {/* Versions Sidebar */}
            {showVersions && versions.length > 0 && (
              <div className="w-80 border-e border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <h3 className="font-semibold text-saudi-navy-900 mb-4 arabic-heading">
                  {t.versions}
                </h3>
                <div className="space-y-2">
                  <div
                    className="p-3 bg-saudi-navy-100 border border-saudi-navy-200 rounded-lg cursor-pointer"
                    onClick={() => setCurrentVersion(document)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-saudi-navy-900">
                          {t.currentVersion}
                        </div>
                        <div className="text-sm text-saudi-navy-600">
                          {formatDate(document.created_at)}
                        </div>
                      </div>
                      <Badge className="bg-saudi-navy-600">
                        v{document.version}
                      </Badge>
                    </div>
                  </div>
                  
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-saudi-navy-300 hover:bg-saudi-navy-50 transition-colors"
                      onClick={() => handleVersionSelect(version)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {t.version} {version.version_number}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatDate(version.created_at)}
                          </div>
                          {version.changes_summary && (
                            <div className="text-xs text-gray-500 mt-1">
                              {version.changes_summary}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatFileSize(version.file_size, language)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-hidden bg-gray-100">
                {renderPreview()}
              </div>
              
              {/* Document Info Footer */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">{t.status}</div>
                    <Badge style={{ backgroundColor: getStatusColor(currentVersion.status) }}>
                      {getStatusLabel(currentVersion.status, language)}
                    </Badge>
                  </div>
                  
                  {currentVersion.category && (
                    <div>
                      <div className="text-gray-500 mb-1">{t.category}</div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: currentVersion.category.color }}
                        />
                        <span className="arabic-text">{currentVersion.category.name}</span>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-gray-500 mb-1">{t.uploadedBy}</div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <User className="h-3 w-3" />
                      <span>{currentVersion.uploader?.email?.split('@')[0] || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500 mb-1">{t.fileType}</div>
                    <div className="text-gray-900 arabic-text">
                      {getLanguageLabel(currentVersion.content_language)}
                    </div>
                  </div>
                  
                  {currentVersion.tags.length > 0 && (
                    <div className="md:col-span-2 lg:col-span-4">
                      <div className="text-gray-500 mb-2">{t.tags}</div>
                      <div className="flex flex-wrap gap-1">
                        {currentVersion.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {currentVersion.description && (
                    <div className="md:col-span-2 lg:col-span-4">
                      <div className="text-gray-500 mb-1">{t.description}</div>
                      <p className="text-gray-900 arabic-text">{currentVersion.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}