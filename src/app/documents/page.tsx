'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Filter,
  Search,
  Grid3X3,
  List,
  Settings,
  Plus,
  RefreshCw,
  Eye,
  Download,
  BarChart3,
  Users,
  Building,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentLibrary } from '@/components/documents/DocumentLibrary';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { DocumentUploadZone } from '@/components/documents/DocumentUploadZone';
import { CategoryManager } from '@/components/documents/CategoryManager';
import { BulkOperations } from '@/components/documents/BulkOperations';
import { useOrganization, usePermissions } from '@/contexts/organization-context';
import {
  getDocuments,
  getDocumentCategories,
  processBulkUpload
} from '@/utils/document-utils';
import type {
  Document,
  DocumentCategory,
  DocumentSearchFilter
} from '@/types/documents';

export default function DocumentManagementPage() {
  const { organization } = useOrganization();
  const { canManageDocuments, canViewReports } = usePermissions();
  
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [viewedDocument, setViewedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filter state
  const [currentFilters, setCurrentFilters] = useState<DocumentSearchFilter>({
    sort_by: 'updated_at',
    sort_order: 'desc',
    limit: 20,
    offset: 0,
  });
  
  // Language preference (could be from user settings or context)
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    categories: 0,
  });

  const text = {
    ar: {
      title: 'مكتبة المستندات',
      subtitle: 'نظام إدارة مستندات الموارد البشرية',
      uploadDocuments: 'رفع مستندات',
      manageCategories: 'إدارة التصنيفات',
      showFilters: 'عرض المرشحات',
      hideFilters: 'إخفاء المرشحات',
      bulkOperations: 'العمليات المجمعة',
      refresh: 'تحديث',
      gridView: 'عرض شبكي',
      listView: 'عرض قائمة',
      statistics: 'الإحصائيات',
      totalDocuments: 'إجمالي المستندات',
      completed: 'مكتمل',
      processing: 'قيد المعالجة',
      failed: 'فشل',
      categories: 'تصنيفات',
      documentsSelected: 'مستند محدد',
      loading: 'جاري التحميل...',
      error: 'خطأ في تحميل المستندات',
      retry: 'إعادة المحاولة',
      noOrganization: 'لم يتم تحديد منظمة',
      selectOrganization: 'اختر منظمة للمتابعة',
      accessDenied: 'لا يمكنك الوصول إلى هذه الصفحة',
      contactAdmin: 'برجاء التواصل مع مدير النظام',
      welcome: 'مرحباً بمكتبة المستندات',
      welcomeDesc: 'ابدأ برفع مستندات الموارد البشرية وتنظيمها بكفاءة',
      getStarted: 'ابدأ الآن',
      uploadSuccess: 'تم رفع المستندات بنجاح',
      uploadError: 'خطأ في رفع المستندات',
    },
    en: {
      title: 'Document Library',
      subtitle: 'HR Document Management System',
      uploadDocuments: 'Upload Documents',
      manageCategories: 'Manage Categories',
      showFilters: 'Show Filters',
      hideFilters: 'Hide Filters',
      bulkOperations: 'Bulk Operations',
      refresh: 'Refresh',
      gridView: 'Grid View',
      listView: 'List View',
      statistics: 'Statistics',
      totalDocuments: 'Total Documents',
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      categories: 'Categories',
      documentsSelected: 'documents selected',
      loading: 'Loading...',
      error: 'Error loading documents',
      retry: 'Retry',
      noOrganization: 'No organization selected',
      selectOrganization: 'Select an organization to continue',
      accessDenied: 'You cannot access this page',
      contactAdmin: 'Please contact your system administrator',
      welcome: 'Welcome to Document Library',
      welcomeDesc: 'Start by uploading and organizing your HR documents efficiently',
      getStarted: 'Get Started',
      uploadSuccess: 'Documents uploaded successfully',
      uploadError: 'Error uploading documents',
    },
  };

  const t = text[language];

  // Load initial data
  const loadData = useCallback(async () => {
    if (!organization) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Load documents and categories in parallel
      const [documentsResult, categoriesResult] = await Promise.allSettled([
        getDocuments(organization.id, currentFilters),
        getDocumentCategories(organization.id)
      ]);
      
      if (documentsResult.status === 'fulfilled') {
        setDocuments(documentsResult.value.documents);
        setTotalCount(documentsResult.value.totalCount);
        
        // Calculate statistics
        const docs = documentsResult.value.documents;
        setStats({
          total: documentsResult.value.totalCount,
          completed: docs.filter(d => d.status === 'completed').length,
          processing: docs.filter(d => d.status === 'processing').length,
          failed: docs.filter(d => d.status === 'failed').length,
          categories: 0, // Will be updated when categories load
        });
      }
      
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
        setStats(prev => ({ ...prev, categories: categoriesResult.value.length }));
      }
      
      if (documentsResult.status === 'rejected') {
        throw documentsResult.reason;
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setIsLoading(false);
    }
  }, [organization, currentFilters, t.error]);

  // Effects
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleFiltersChange = (filters: DocumentSearchFilter) => {
    setCurrentFilters(filters);
  };

  const handleDocumentSelect = (document: Document, selected: boolean) => {
    setSelectedDocuments(prev => 
      selected 
        ? [...prev, document]
        : prev.filter(d => d.id !== document.id)
    );
  };

  const handleDocumentView = (document: Document) => {
    setViewedDocument(document);
  };

  const handleUpload = async (files: File[]) => {
    if (!organization) return;
    
    try {
      const commonMetadata = {
        tags: [],
        language: language as 'ar' | 'en' | 'mixed',
        is_public: false,
      };
      
      const result = await processBulkUpload(files, organization.id, commonMetadata);
      
      if (result.successful.length > 0) {
        // Refresh documents
        await loadData();
        setShowUpload(false);
        
        // Show success message (you could use a toast notification library)
        console.log(`${t.uploadSuccess}: ${result.successful.length} files`);
      }
      
      if (result.failed.length > 0) {
        console.error(`${t.uploadError}: ${result.failed.length} files`);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleBulkOperationComplete = () => {
    // Clear selection and refresh data
    setSelectedDocuments([]);
    loadData();
  };

  // Early returns for loading states
  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="text-center space-y-4 p-8">
          <Building className="h-16 w-16 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900 arabic-heading">{t.noOrganization}</h2>
          <p className="text-gray-600 arabic-text">{t.selectOrganization}</p>
        </div>
      </div>
    );
  }

  // Check permissions
  if (!canManageDocuments() && !canViewReports()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="text-center space-y-4 p-8">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900 arabic-heading">{t.accessDenied}</h2>
          <p className="text-gray-600 arabic-text">{t.contactAdmin}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-saudi-navy-900 arabic-heading">
                {t.title}
              </h1>
              <p className="text-gray-600 mt-2 arabic-text">{t.subtitle}</p>
            </div>
            
            <div className="flex items-center space-x-3 space-x-reverse">
              <Button
                variant="outline"
                onClick={() => loadData()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t.refresh}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 me-2" />
                {showFilters ? t.hideFilters : t.showFilters}
              </Button>
              
              {canManageDocuments() && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowCategoryManager(true)}
                  >
                    <Settings className="h-4 w-4 me-2" />
                    {t.manageCategories}
                  </Button>
                  
                  <Button
                    onClick={() => setShowUpload(true)}
                    className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
                  >
                    <Upload className="h-4 w-4 me-2" />
                    {t.uploadDocuments}
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 arabic-text">{t.totalDocuments}</p>
                  <p className="text-2xl font-semibold text-saudi-navy-900">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-saudi-navy-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 arabic-text">{t.completed}</p>
                  <p className="text-2xl font-semibold text-saudi-green-600">{stats.completed}</p>
                </div>
                <Badge className="bg-saudi-green-600">{stats.completed}</Badge>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 arabic-text">{t.processing}</p>
                  <p className="text-2xl font-semibold text-saudi-gold-600">{stats.processing}</p>
                </div>
                <Badge className="bg-saudi-gold-600">{stats.processing}</Badge>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 arabic-text">{t.failed}</p>
                  <p className="text-2xl font-semibold text-red-600">{stats.failed}</p>
                </div>
                <Badge className="bg-red-600">{stats.failed}</Badge>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 arabic-text">{t.categories}</p>
                  <p className="text-2xl font-semibold text-purple-600">{stats.categories}</p>
                </div>
                <Badge className="bg-purple-600">{stats.categories}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6">
            <DocumentFilters
              onFiltersChange={handleFiltersChange}
              initialFilters={currentFilters}
              language={language}
            />
          </div>
        )}

        {/* Bulk Operations */}
        {(selectedDocuments.length > 0 || canManageDocuments()) && (
          <div className="mb-6">
            <BulkOperations
              selectedDocuments={selectedDocuments}
              categories={categories}
              onSelectionChange={setSelectedDocuments}
              onOperationComplete={handleBulkOperationComplete}
              language={language}
            />
          </div>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-saudi-navy-600 mx-auto mb-4" />
              <p className="text-saudi-navy-600 arabic-text">{t.loading}</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2 arabic-heading">{t.error}</h3>
            <p className="text-gray-600 mb-4 arabic-text">{error}</p>
            <Button onClick={loadData} className="bg-saudi-navy-600 hover:bg-saudi-navy-700">
              <RefreshCw className="h-4 w-4 me-2" />
              {t.retry}
            </Button>
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="text-6xl text-gray-300 mb-6">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 arabic-heading">{t.welcome}</h3>
            <p className="text-gray-600 mb-6 arabic-text max-w-md mx-auto">{t.welcomeDesc}</p>
            {canManageDocuments() && (
              <Button
                onClick={() => setShowUpload(true)}
                className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
              >
                <Upload className="h-5 w-5 me-2" />
                {t.getStarted}
              </Button>
            )}
          </div>
        ) : (
          <DocumentLibrary
            language={language}
            onDocumentSelect={handleDocumentSelect}
            onDocumentView={handleDocumentView}
          />
        )}

        {/* Modals */}
        {showUpload && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <DocumentUploadZone
                categories={categories}
                onUpload={handleUpload}
                onClose={() => setShowUpload(false)}
                language={language}
              />
            </div>
          </div>
        )}

        {showCategoryManager && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CategoryManager
                language={language}
                onClose={() => {
                  setShowCategoryManager(false);
                  loadData(); // Refresh to get updated categories
                }}
              />
            </div>
          </div>
        )}

        {viewedDocument && (
          <DocumentViewer
            document={viewedDocument}
            isOpen={!!viewedDocument}
            onClose={() => setViewedDocument(null)}
            language={language}
          />
        )}
      </div>
    </div>
  );
}