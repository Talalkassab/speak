'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Grid3X3, 
  List, 
  Search, 
  Filter, 
  Upload, 
  SortAsc, 
  SortDesc, 
  RefreshCw,
  FolderPlus,
  CheckSquare,
  Square,
  Download,
  Trash2,
  Tag,
  Eye,
  Plus
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
import { DocumentCard } from './DocumentCard';
import { DocumentUploadZone } from './DocumentUploadZone';
import { useOrganization, usePermissions } from '@/contexts/organization-context';
import { 
  getDocuments, 
  getDocumentCategories,
  deleteDocument,
  processBulkUpload 
} from '@/utils/document-utils';
import type { 
  Document, 
  DocumentCategory, 
  DocumentSearchFilter, 
  DocumentStatus 
} from '@/types/documents';

interface DocumentLibraryProps {
  language?: 'ar' | 'en';
  className?: string;
  onDocumentSelect?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentView?: (document: Document) => void;
}

type ViewMode = 'grid' | 'list';
type SortField = 'created_at' | 'filename' | 'file_size' | 'updated_at';
type SortOrder = 'asc' | 'desc';

export function DocumentLibrary({
  language = 'ar',
  className = '',
  onDocumentSelect,
  onDocumentEdit,
  onDocumentView,
}: DocumentLibraryProps) {
  const { organization } = useOrganization();
  const { canManageDocuments } = usePermissions();
  
  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View and filters
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | ''>('');
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en' | 'mixed' | ''>('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Selection and bulk operations
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showUploadZone, setShowUploadZone] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const text = {
    ar: {
      title: 'مكتبة المستندات',
      search: 'البحث في المستندات...',
      upload: 'رفع مستندات',
      newCategory: 'تصنيف جديد',
      refresh: 'تحديث',
      filter: 'تصفية',
      sort: 'ترتيب',
      view: 'العرض',
      grid: 'شبكة',
      list: 'قائمة',
      allCategories: 'جميع التصنيفات',
      allStatuses: 'جميع الحالات',
      allLanguages: 'جميع اللغات',
      sortBy: 'ترتيب حسب',
      fileName: 'اسم الملف',
      fileSize: 'حجم الملف',
      createdAt: 'تاريخ الإنشاء',
      updatedAt: 'تاريخ التحديث',
      ascending: 'تصاعدي',
      descending: 'تنازلي',
      selectAll: 'تحديد الكل',
      deselectAll: 'إلغاء التحديد',
      selectedCount: 'محدد',
      downloadSelected: 'تحميل المحدد',
      deleteSelected: 'حذف المحدد',
      bulkActions: 'عمليات مجمعة',
      noDocuments: 'لا توجد مستندات',
      noDocumentsDesc: 'ابدأ برفع مستنداتك الأولى',
      loadingError: 'خطأ في تحميل المستندات',
      deleteConfirm: 'هل أنت متأكد من حذف المستندات المحددة؟',
      deleteSuccess: 'تم حذف المستندات بنجاح',
      uploadSuccess: 'تم رفع المستندات بنجاح',
      arabic: 'عربي',
      english: 'إنجليزي',
      mixed: 'مختلط',
      completed: 'مكتمل',
      processing: 'قيد المعالجة',
      failed: 'فشل',
      archived: 'مؤرشف',
    },
    en: {
      title: 'Document Library',
      search: 'Search documents...',
      upload: 'Upload Documents',
      newCategory: 'New Category',
      refresh: 'Refresh',
      filter: 'Filter',
      sort: 'Sort',
      view: 'View',
      grid: 'Grid',
      list: 'List',
      allCategories: 'All Categories',
      allStatuses: 'All Statuses',
      allLanguages: 'All Languages',
      sortBy: 'Sort by',
      fileName: 'File Name',
      fileSize: 'File Size',
      createdAt: 'Created Date',
      updatedAt: 'Updated Date',
      ascending: 'Ascending',
      descending: 'Descending',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      selectedCount: 'selected',
      downloadSelected: 'Download Selected',
      deleteSelected: 'Delete Selected',
      bulkActions: 'Bulk Actions',
      noDocuments: 'No documents found',
      noDocumentsDesc: 'Start by uploading your first documents',
      loadingError: 'Error loading documents',
      deleteConfirm: 'Are you sure you want to delete the selected documents?',
      deleteSuccess: 'Documents deleted successfully',
      uploadSuccess: 'Documents uploaded successfully',
      arabic: 'Arabic',
      english: 'English',
      mixed: 'Mixed',
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      archived: 'Archived',
    },
  };

  const t = text[language];

  // Load data
  const loadDocuments = useCallback(async () => {
    if (!organization) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const filters: DocumentSearchFilter = {
        search_query: searchQuery || undefined,
        category_id: selectedCategory || undefined,
        status: selectedStatus || undefined,
        language: selectedLanguage || undefined,
        sort_by: sortField,
        sort_order: sortOrder,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      const { documents: fetchedDocs, totalCount: total } = await getDocuments(
        organization.id,
        filters
      );
      
      setDocuments(fetchedDocs);
      setTotalCount(total);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err instanceof Error ? err.message : t.loadingError);
    } finally {
      setIsLoading(false);
    }
  }, [
    organization,
    searchQuery,
    selectedCategory,
    selectedStatus,
    selectedLanguage,
    sortField,
    sortOrder,
    currentPage,
    itemsPerPage,
    t.loadingError,
  ]);

  const loadCategories = useCallback(async () => {
    if (!organization) return;
    
    try {
      const fetchedCategories = await getDocumentCategories(organization.id);
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, [organization]);

  // Effects
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleFilterChange = (
    type: 'category' | 'status' | 'language',
    value: string
  ) => {
    switch (type) {
      case 'category':
        setSelectedCategory(value);
        break;
      case 'status':
        setSelectedStatus(value as DocumentStatus | '');
        break;
      case 'language':
        setSelectedLanguage(value as 'ar' | 'en' | 'mixed' | '');
        break;
    }
    setCurrentPage(1);
  };

  const handleSort = (field: SortField, order?: SortOrder) => {
    setSortField(field);
    setSortOrder(order || (sortField === field && sortOrder === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const handleSelectDocument = (document: Document, selected: boolean) => {
    const newSelection = new Set(selectedDocuments);
    if (selected) {
      newSelection.add(document.id);
    } else {
      newSelection.delete(document.id);
    }
    setSelectedDocuments(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map(doc => doc.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!organization || selectedDocuments.size === 0) return;

    if (!confirm(t.deleteConfirm)) return;

    try {
      await Promise.all(
        Array.from(selectedDocuments).map(docId => 
          deleteDocument(docId, organization.id)
        )
      );
      
      setSelectedDocuments(new Set());
      await loadDocuments();
      
      // Show success message (could use toast)
      alert(t.deleteSuccess);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const handleUpload = async (files: any[]) => {
    if (!organization) return;

    try {
      const commonMetadata = {
        tags: [],
        language: 'ar' as const,
        is_public: false,
      };

      const { successful, failed } = await processBulkUpload(
        files,
        organization.id,
        commonMetadata
      );

      if (successful.length > 0) {
        await loadDocuments();
        setShowUploadZone(false);
        alert(t.uploadSuccess);
      }

      if (failed.length > 0) {
        console.error('Some uploads failed:', failed);
        // Show specific error messages
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleDocumentAction = (action: string, document: Document) => {
    switch (action) {
      case 'view':
        onDocumentView?.(document);
        break;
      case 'edit':
        onDocumentEdit?.(document);
        break;
      case 'select':
        onDocumentSelect?.(document);
        break;
      case 'delete':
        // Handle single document delete
        handleBulkDelete();
        break;
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t.loadingError}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-saudi-navy-900 arabic-heading">
          {t.title}
        </h1>
        
        <div className="flex items-center space-x-3 space-x-reverse">
          <Button
            variant="outline"
            onClick={() => loadDocuments()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
          
          {canManageDocuments() && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowUploadZone(true)}
              >
                <Plus className="h-4 w-4 me-2" />
                {t.newCategory}
              </Button>
              
              <Button
                onClick={() => setShowUploadZone(true)}
                className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
              >
                <Upload className="h-4 w-4 me-2" />
                {t.upload}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="ps-10 arabic-text"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 space-x-reverse">
          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">
                <Filter className="h-4 w-4 me-2" />
                {selectedCategory 
                  ? categories.find(c => c.id === selectedCategory)?.name 
                  : t.allCategories
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
              <DropdownMenuItem onClick={() => handleFilterChange('category', '')}>
                {t.allCategories}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  onClick={() => handleFilterChange('category', category.id)}
                >
                  <div 
                    className="w-3 h-3 rounded-full me-2" 
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">
                <Filter className="h-4 w-4 me-2" />
                {selectedStatus ? t[selectedStatus as keyof typeof t] : t.allStatuses}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
              <DropdownMenuItem onClick={() => handleFilterChange('status', '')}>
                {t.allStatuses}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleFilterChange('status', 'completed')}>
                {t.completed}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange('status', 'processing')}>
                {t.processing}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange('status', 'failed')}>
                {t.failed}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange('status', 'archived')}>
                {t.archived}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">
                <Filter className="h-4 w-4 me-2" />
                {selectedLanguage ? t[selectedLanguage as keyof typeof t] : t.allLanguages}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
              <DropdownMenuItem onClick={() => handleFilterChange('language', '')}>
                {t.allLanguages}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleFilterChange('language', 'ar')}>
                {t.arabic}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange('language', 'en')}>
                {t.english}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange('language', 'mixed')}>
                {t.mixed}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 me-2" /> : <SortDesc className="h-4 w-4 me-2" />}
                {t.sort}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
              <DropdownMenuItem onClick={() => handleSort('filename')}>
                {t.fileName}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('file_size')}>
                {t.fileSize}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('created_at')}>
                {t.createdAt}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('updated_at')}>
                {t.updatedAt}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-e-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-s-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedDocuments.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-saudi-navy-50 rounded-lg border">
          <div className="flex items-center space-x-4 space-x-reverse">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedDocuments.size === documents.length ? <CheckSquare /> : <Square />}
              <span className="ms-2">
                {selectedDocuments.size === documents.length ? t.deselectAll : t.selectAll}
              </span>
            </Button>
            <span className="text-sm text-saudi-navy-700">
              {selectedDocuments.size} {t.selectedCount}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 me-2" />
              {t.downloadSelected}
            </Button>
            {canManageDocuments() && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 me-2" />
                {t.deleteSelected}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {showUploadZone && (
        <DocumentUploadZone
          categories={categories}
          onUpload={handleUpload}
          onClose={() => setShowUploadZone(false)}
          language={language}
        />
      )}

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-saudi-navy-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-red-600">{error}</p>
          <Button onClick={() => loadDocuments()}>
            <RefreshCw className="h-4 w-4 me-2" />
            {t.refresh}
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-6xl text-gray-300">📂</div>
          <h3 className="text-lg font-medium text-gray-900 arabic-heading">
            {t.noDocuments}
          </h3>
          <p className="text-gray-500 arabic-text">{t.noDocumentsDesc}</p>
          {canManageDocuments() && (
            <Button
              onClick={() => setShowUploadZone(true)}
              className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
            >
              <Upload className="h-4 w-4 me-2" />
              {t.upload}
            </Button>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-2'
          }
        >
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              viewMode={viewMode}
              language={language}
              onView={(doc) => handleDocumentAction('view', doc)}
              onEdit={(doc) => handleDocumentAction('edit', doc)}
              onDelete={(doc) => handleDocumentAction('delete', doc)}
              onSelect={handleSelectDocument}
              isSelected={selectedDocuments.has(document.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > itemsPerPage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            عرض {((currentPage - 1) * itemsPerPage) + 1} إلى {Math.min(currentPage * itemsPerPage, totalCount)} من {totalCount} مستند
          </p>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              السابق
            </Button>
            <span className="text-sm text-gray-700">
              {currentPage} / {Math.ceil(totalCount / itemsPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}