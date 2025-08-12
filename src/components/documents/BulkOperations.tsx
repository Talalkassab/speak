'use client';

import React, { useState, useCallback } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Tag,
  FolderOpen,
  Archive,
  Share2,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization, usePermissions } from '@/contexts/organization-context';
import { DocumentUploadZone } from './DocumentUploadZone';
import {
  deleteDocument,
  updateDocument,
  processBulkUpload,
} from '@/utils/document-utils';
import type { Document, DocumentCategory } from '@/types/documents';

interface BulkOperationsProps {
  selectedDocuments: Document[];
  categories: DocumentCategory[];
  onSelectionChange: (documents: Document[]) => void;
  onOperationComplete: () => void;
  language?: 'ar' | 'en';
  className?: string;
}

type BulkOperation = 
  | 'delete'
  | 'archive'
  | 'categorize'
  | 'tag'
  | 'download'
  | 'share'
  | 'upload';

interface BulkUploadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

export function BulkOperations({
  selectedDocuments,
  categories,
  onSelectionChange,
  onOperationComplete,
  language = 'ar',
  className = '',
}: BulkOperationsProps) {
  const { organization } = useOrganization();
  const { canManageDocuments } = usePermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BulkUploadProgress | null>(null);
  const [operationStatus, setOperationStatus] = useState<string>('');
  
  // Tag management
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  // Category management
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategorySelect, setShowCategorySelect] = useState(false);

  const text = {
    ar: {
      bulkOperations: 'العمليات المجمعة',
      selectedItems: 'عنصر محدد',
      selectAll: 'تحديد الكل',
      deselectAll: 'إلغاء تحديد الكل',
      bulkUpload: 'رفع مجمع',
      bulkDownload: 'تحميل مجمع',
      bulkDelete: 'حذف مجمع',
      bulkArchive: 'أرشفة مجمعة',
      bulkCategorize: 'تصنيف مجمع',
      bulkTag: 'وضع علامات مجمعة',
      bulkShare: 'مشاركة مجمعة',
      addTag: 'إضافة علامة',
      tagPlaceholder: 'أدخل علامة جديدة...',
      selectCategory: 'اختر تصنيف',
      apply: 'تطبيق',
      cancel: 'إلغاء',
      processing: 'جاري المعالجة...',
      completed: 'تم بنجاح',
      failed: 'فشل',
      confirmDelete: 'هل أنت متأكد من حذف',
      confirmDeleteMultiple: 'مستندات محددة؟',
      deleteSuccess: 'تم حذف المستندات بنجاح',
      deleteError: 'خطأ في حذف بعض المستندات',
      updateSuccess: 'تم تحديث المستندات بنجاح',
      updateError: 'خطأ في تحديث بعض المستندات',
      uploadSuccess: 'تم رفع الملفات بنجاح',
      uploadError: 'خطأ في رفع بعض الملفات',
      uploading: 'جاري الرفع...',
      uploadProgress: 'من',
      close: 'إغلاق',
      noSelection: 'لم يتم تحديد أي مستندات',
      operationsDisabled: 'لا يمكنك إجراء عمليات مجمعة',
    },
    en: {
      bulkOperations: 'Bulk Operations',
      selectedItems: 'items selected',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      bulkUpload: 'Bulk Upload',
      bulkDownload: 'Bulk Download',
      bulkDelete: 'Bulk Delete',
      bulkArchive: 'Bulk Archive',
      bulkCategorize: 'Bulk Categorize',
      bulkTag: 'Bulk Tag',
      bulkShare: 'Bulk Share',
      addTag: 'Add Tag',
      tagPlaceholder: 'Enter new tag...',
      selectCategory: 'Select Category',
      apply: 'Apply',
      cancel: 'Cancel',
      processing: 'Processing...',
      completed: 'Completed',
      failed: 'Failed',
      confirmDelete: 'Are you sure you want to delete',
      confirmDeleteMultiple: 'selected documents?',
      deleteSuccess: 'Documents deleted successfully',
      deleteError: 'Error deleting some documents',
      updateSuccess: 'Documents updated successfully',
      updateError: 'Error updating some documents',
      uploadSuccess: 'Files uploaded successfully',
      uploadError: 'Error uploading some files',
      uploading: 'Uploading...',
      uploadProgress: 'of',
      close: 'Close',
      noSelection: 'No documents selected',
      operationsDisabled: 'You cannot perform bulk operations',
    },
  };

  const t = text[language];

  const handleBulkOperation = useCallback(async (operation: BulkOperation) => {
    if (!organization || selectedDocuments.length === 0) return;

    setIsProcessing(true);
    setOperationStatus(`${t.processing}`);

    try {
      switch (operation) {
        case 'delete':
          await handleBulkDelete();
          break;
        case 'archive':
          await handleBulkArchive();
          break;
        case 'categorize':
          if (selectedCategory) {
            await handleBulkCategorize(selectedCategory);
          }
          break;
        case 'tag':
          if (newTag.trim()) {
            await handleBulkTag(newTag.trim());
          }
          break;
        case 'download':
          await handleBulkDownload();
          break;
        case 'share':
          await handleBulkShare();
          break;
      }
    } catch (error) {
      console.error(`Bulk ${operation} failed:`, error);
      setOperationStatus(`${t.failed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setOperationStatus(''), 3000);
    }
  }, [organization, selectedDocuments, selectedCategory, newTag, t]);

  const handleBulkDelete = async () => {
    if (!canManageDocuments()) return;
    
    if (!confirm(`${t.confirmDelete} ${selectedDocuments.length} ${t.confirmDeleteMultiple}`)) {
      return;
    }

    const results = await Promise.allSettled(
      selectedDocuments.map(doc => deleteDocument(doc.id, organization!.id))
    );

    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed === 0) {
      setOperationStatus(t.deleteSuccess);
    } else {
      setOperationStatus(`${t.deleteError}: ${failed}/${selectedDocuments.length}`);
    }

    onSelectionChange([]);
    onOperationComplete();
  };

  const handleBulkArchive = async () => {
    if (!canManageDocuments()) return;

    const results = await Promise.allSettled(
      selectedDocuments.map(doc => 
        updateDocument(doc.id, organization!.id, { 
          // Note: In a real implementation, you'd have an archived status or field
          // For now, we'll use a tag
          tags: [...doc.tags, 'archived'].filter((tag, index, arr) => arr.indexOf(tag) === index)
        })
      )
    );

    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed === 0) {
      setOperationStatus(t.updateSuccess);
    } else {
      setOperationStatus(`${t.updateError}: ${failed}/${selectedDocuments.length}`);
    }

    onSelectionChange([]);
    onOperationComplete();
  };

  const handleBulkCategorize = async (categoryId: string) => {
    if (!canManageDocuments()) return;

    const results = await Promise.allSettled(
      selectedDocuments.map(doc => 
        updateDocument(doc.id, organization!.id, { category_id: categoryId })
      )
    );

    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed === 0) {
      setOperationStatus(t.updateSuccess);
    } else {
      setOperationStatus(`${t.updateError}: ${failed}/${selectedDocuments.length}`);
    }

    setShowCategorySelect(false);
    setSelectedCategory('');
    onSelectionChange([]);
    onOperationComplete();
  };

  const handleBulkTag = async (tag: string) => {
    if (!canManageDocuments()) return;

    const results = await Promise.allSettled(
      selectedDocuments.map(doc => {
        const newTags = [...doc.tags, tag].filter((t, index, arr) => arr.indexOf(t) === index);
        return updateDocument(doc.id, organization!.id, { tags: newTags });
      })
    );

    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed === 0) {
      setOperationStatus(t.updateSuccess);
    } else {
      setOperationStatus(`${t.updateError}: ${failed}/${selectedDocuments.length}`);
    }

    setShowTagInput(false);
    setNewTag('');
    onSelectionChange([]);
    onOperationComplete();
  };

  const handleBulkDownload = async () => {
    // Create a simple CSV export of document metadata
    const csvContent = [
      'Title,Filename,Size,Type,Created,Category,Tags',
      ...selectedDocuments.map(doc => [
        doc.title,
        doc.filename,
        doc.file_size,
        doc.file_type,
        new Date(doc.created_at).toLocaleDateString(),
        doc.category?.name || '',
        doc.tags.join('; ')
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setOperationStatus(t.completed);
  };

  const handleBulkShare = async () => {
    // Generate shareable links (simplified implementation)
    const links = selectedDocuments.map(doc => `${window.location.origin}/documents/${doc.id}`);
    const shareText = links.join('\n');
    
    try {
      await navigator.clipboard.writeText(shareText);
      setOperationStatus('Links copied to clipboard');
    } catch (error) {
      console.error('Failed to copy links:', error);
      setOperationStatus('Failed to copy links');
    }
  };

  const handleBulkUpload = async (files: File[]) => {
    if (!organization) return;

    setUploadProgress({ total: files.length, completed: 0, failed: 0 });
    
    try {
      const commonMetadata = {
        tags: [],
        language: 'ar' as const,
        is_public: false,
      };

      // Process files in batches to avoid overwhelming the server
      const batchSize = 5;
      let completed = 0;
      let failed = 0;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const results = await processBulkUpload(
          batch,
          organization.id,
          commonMetadata
        );
        
        completed += results.successful.length;
        failed += results.failed.length;
        
        setUploadProgress(prev => prev ? {
          ...prev,
          completed,
          failed,
          current: batch[batch.length - 1]?.name
        } : null);
      }

      if (failed === 0) {
        setOperationStatus(t.uploadSuccess);
      } else {
        setOperationStatus(`${t.uploadError}: ${failed}/${files.length}`);
      }

      onOperationComplete();
    } catch (error) {
      console.error('Bulk upload failed:', error);
      setOperationStatus(`${t.uploadError}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadProgress(null);
      setShowUploadZone(false);
    }
  };

  if (!organization || !canManageDocuments()) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-gray-600 arabic-text">{t.operationsDisabled}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <FileText className="h-5 w-5 text-saudi-navy-600" />
            <h3 className="text-lg font-semibold text-saudi-navy-900 arabic-heading">
              {t.bulkOperations}
            </h3>
            {selectedDocuments.length > 0 && (
              <Badge className="bg-saudi-navy-600">
                {selectedDocuments.length} {t.selectedItems}
              </Badge>
            )}
          </div>
        </div>
        
        {operationStatus && (
          <div className="mt-3 p-3 rounded-md bg-saudi-navy-50 border border-saudi-navy-200">
            <div className="flex items-center space-x-2 space-x-reverse">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin text-saudi-navy-600" />
              ) : operationStatus.includes(t.failed) ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-saudi-green-600" />
              )}
              <span className="text-sm arabic-text">{operationStatus}</span>
            </div>
          </div>
        )}
      </div>

      {selectedDocuments.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-gray-600 arabic-text">{t.noSelection}</p>
          <Button
            onClick={() => setShowUploadZone(true)}
            className="mt-4 bg-saudi-navy-600 hover:bg-saudi-navy-700"
          >
            <Upload className="h-4 w-4 me-2" />
            {t.bulkUpload}
          </Button>
        </div>
      ) : (
        <div className="p-4">
          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  {t.uploading}
                </span>
                <span className="text-sm text-blue-700">
                  {uploadProgress.completed} {t.uploadProgress} {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` 
                  }}
                />
              </div>
              {uploadProgress.current && (
                <p className="text-xs text-blue-600 arabic-text">
                  {uploadProgress.current}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => setShowUploadZone(true)}
              disabled={isProcessing}
              className="bg-saudi-green-600 hover:bg-saudi-green-700"
            >
              <Upload className="h-4 w-4 me-2" />
              {t.bulkUpload}
            </Button>

            <Button
              onClick={() => handleBulkOperation('download')}
              disabled={isProcessing}
              variant="outline"
            >
              <Download className="h-4 w-4 me-2" />
              {t.bulkDownload}
            </Button>

            <Button
              onClick={() => handleBulkOperation('share')}
              disabled={isProcessing}
              variant="outline"
            >
              <Share2 className="h-4 w-4 me-2" />
              {t.bulkShare}
            </Button>

            <Button
              onClick={() => handleBulkOperation('archive')}
              disabled={isProcessing}
              variant="outline"
            >
              <Archive className="h-4 w-4 me-2" />
              {t.bulkArchive}
            </Button>
          </div>

          {/* Advanced Operations */}
          <div className="mt-4 space-y-3">
            {/* Categorize */}
            <div className="flex items-center space-x-3 space-x-reverse">
              <Button
                onClick={() => setShowCategorySelect(!showCategorySelect)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                <FolderOpen className="h-4 w-4 me-2" />
                {t.bulkCategorize}
              </Button>
              
              {showCategorySelect && (
                <div className="flex items-center space-x-2 space-x-reverse flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="min-w-[150px] justify-between">
                        <span className="truncate">
                          {selectedCategory
                            ? categories.find(c => c.id === selectedCategory)?.name || t.selectCategory
                            : t.selectCategory
                          }
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                      {categories.map((category) => (
                        <DropdownMenuItem
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{category.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    onClick={() => handleBulkOperation('categorize')}
                    disabled={!selectedCategory || isProcessing}
                    size="sm"
                  >
                    {t.apply}
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setShowCategorySelect(false);
                      setSelectedCategory('');
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    {t.cancel}
                  </Button>
                </div>
              )}
            </div>

            {/* Tag */}
            <div className="flex items-center space-x-3 space-x-reverse">
              <Button
                onClick={() => setShowTagInput(!showTagInput)}
                disabled={isProcessing}
                variant="outline"
                size="sm"
              >
                <Tag className="h-4 w-4 me-2" />
                {t.bulkTag}
              </Button>
              
              {showTagInput && (
                <div className="flex items-center space-x-2 space-x-reverse flex-1">
                  <Input
                    type="text"
                    placeholder={t.tagPlaceholder}
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && newTag.trim() && handleBulkOperation('tag')}
                    className="max-w-xs arabic-text"
                  />
                  
                  <Button
                    onClick={() => handleBulkOperation('tag')}
                    disabled={!newTag.trim() || isProcessing}
                    size="sm"
                  >
                    {t.apply}
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setShowTagInput(false);
                      setNewTag('');
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    {t.cancel}
                  </Button>
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-gray-200">
              <Button
                onClick={() => handleBulkOperation('delete')}
                disabled={isProcessing}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 me-2" />
                {t.bulkDelete}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Zone */}
      {showUploadZone && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <DocumentUploadZone
              categories={categories}
              onUpload={handleBulkUpload}
              onClose={() => setShowUploadZone(false)}
              language={language}
              maxFiles={50}
            />
          </div>
        </div>
      )}
    </div>
  );
}