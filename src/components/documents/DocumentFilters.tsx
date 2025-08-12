'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  Tag,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOrganization } from '@/contexts/organization-context';
import { getDocumentCategories } from '@/utils/document-utils';
import {
  ALLOWED_FILE_TYPES,
  createSearchFilter,
  type DocumentSearchFilter,
  type DocumentCategory,
  type DocumentStatus,
} from '@/types/documents';

interface DocumentFiltersProps {
  onFiltersChange: (filters: DocumentSearchFilter) => void;
  initialFilters?: Partial<DocumentSearchFilter>;
  language?: 'ar' | 'en';
  className?: string;
  collapsed?: boolean;
}

export function DocumentFilters({
  onFiltersChange,
  initialFilters = {},
  language = 'ar',
  className = '',
  collapsed = false,
}: DocumentFiltersProps) {
  const { organization } = useOrganization();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(initialFilters.search_query || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialFilters.category_id ? [initialFilters.category_id] : []
  );
  const [selectedStatuses, setSelectedStatuses] = useState<DocumentStatus[]>(
    initialFilters.status ? [initialFilters.status] : []
  );
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    initialFilters.language ? [initialFilters.language] : []
  );
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>(
    initialFilters.file_types || []
  );
  const [tags, setTags] = useState<string[]>(initialFilters.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [dateFrom, setDateFrom] = useState(initialFilters.date_from || '');
  const [dateTo, setDateTo] = useState(initialFilters.date_to || '');
  const [uploadedBy, setUploadedBy] = useState(initialFilters.uploaded_by || '');
  const [sortBy, setSortBy] = useState(initialFilters.sort_by || 'updated_at');
  const [sortOrder, setSortOrder] = useState(initialFilters.sort_order || 'desc');

  const text = {
    ar: {
      filters: 'المرشحات',
      search: 'البحث...',
      searchPlaceholder: 'ابحث في المستندات والملفات والعلامات...',
      categories: 'التصنيفات',
      allCategories: 'جميع التصنيفات',
      status: 'الحالة',
      allStatuses: 'جميع الحالات',
      language: 'اللغة',
      allLanguages: 'جميع اللغات',
      fileTypes: 'أنواع الملفات',
      allFileTypes: 'جميع الأنواع',
      tags: 'العلامات',
      tagsPlaceholder: 'أضف علامة...',
      dateRange: 'نطاق التاريخ',
      from: 'من',
      to: 'إلى',
      uploadedBy: 'رفع بواسطة',
      uploadedByPlaceholder: 'البحث بالمستخدم...',
      sortBy: 'ترتيب حسب',
      sortOrder: 'ترتيب',
      ascending: 'تصاعدي',
      descending: 'تنازلي',
      clearFilters: 'مسح المرشحات',
      applyFilters: 'تطبيق المرشحات',
      showAdvanced: 'إظهار المرشحات المتقدمة',
      hideAdvanced: 'إخفاء المرشحات المتقدمة',
      fileName: 'اسم الملف',
      fileSize: 'حجم الملف',
      createdAt: 'تاريخ الإنشاء',
      updatedAt: 'تاريخ التحديث',
      completed: 'مكتمل',
      processing: 'قيد المعالجة',
      failed: 'فشل',
      archived: 'مؤرشف',
      arabic: 'عربي',
      english: 'إنجليزي',
      mixed: 'مختلط',
      addTag: 'إضافة علامة',
      removeTag: 'إزالة علامة',
      activeFilters: 'المرشحات النشطة',
    },
    en: {
      filters: 'Filters',
      search: 'Search...',
      searchPlaceholder: 'Search documents, files, tags...',
      categories: 'Categories',
      allCategories: 'All Categories',
      status: 'Status',
      allStatuses: 'All Statuses',
      language: 'Language',
      allLanguages: 'All Languages',
      fileTypes: 'File Types',
      allFileTypes: 'All Types',
      tags: 'Tags',
      tagsPlaceholder: 'Add tag...',
      dateRange: 'Date Range',
      from: 'From',
      to: 'To',
      uploadedBy: 'Uploaded By',
      uploadedByPlaceholder: 'Search by user...',
      sortBy: 'Sort By',
      sortOrder: 'Order',
      ascending: 'Ascending',
      descending: 'Descending',
      clearFilters: 'Clear Filters',
      applyFilters: 'Apply Filters',
      showAdvanced: 'Show Advanced Filters',
      hideAdvanced: 'Hide Advanced Filters',
      fileName: 'File Name',
      fileSize: 'File Size',
      createdAt: 'Created Date',
      updatedAt: 'Updated Date',
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      archived: 'Archived',
      arabic: 'Arabic',
      english: 'English',
      mixed: 'Mixed',
      addTag: 'Add Tag',
      removeTag: 'Remove Tag',
      activeFilters: 'Active Filters',
    },
  };

  const t = text[language];

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      if (!organization) return;
      
      try {
        const fetchedCategories = await getDocumentCategories(organization.id);
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, [organization]);

  // Build and emit filters whenever they change
  useEffect(() => {
    const filters = createSearchFilter(searchQuery, {
      category_id: selectedCategories[0],
      status: selectedStatuses[0],
      language: selectedLanguages[0] as 'ar' | 'en' | 'mixed',
      file_types: selectedFileTypes.length > 0 ? selectedFileTypes : undefined,
      tags: tags.length > 0 ? tags : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      uploaded_by: uploadedBy || undefined,
      sort_by: sortBy as any,
      sort_order: sortOrder as 'asc' | 'desc',
    });
    
    onFiltersChange(filters);
  }, [
    searchQuery,
    selectedCategories,
    selectedStatuses,
    selectedLanguages,
    selectedFileTypes,
    tags,
    dateFrom,
    dateTo,
    uploadedBy,
    sortBy,
    sortOrder,
    onFiltersChange,
  ]);

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [categoryId] // Only allow single selection for now
    );
  };

  const handleToggleStatus = (status: DocumentStatus) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [status] // Only allow single selection for now
    );
  };

  const handleToggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [lang] // Only allow single selection for now
    );
  };

  const handleToggleFileType = (fileType: string) => {
    setSelectedFileTypes(prev => 
      prev.includes(fileType)
        ? prev.filter(ft => ft !== fileType)
        : [...prev, fileType]
    );
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSelectedLanguages([]);
    setSelectedFileTypes([]);
    setTags([]);
    setTagInput('');
    setDateFrom('');
    setDateTo('');
    setUploadedBy('');
    setSortBy('updated_at');
    setSortOrder('desc');
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedCategories.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedLanguages.length > 0) count++;
    if (selectedFileTypes.length > 0) count++;
    if (tags.length > 0) count++;
    if (dateFrom || dateTo) count++;
    if (uploadedBy) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3 space-x-reverse">
          <Filter className="h-5 w-5 text-saudi-navy-600" />
          <h3 className="text-lg font-semibold text-saudi-navy-900 arabic-heading">
            {t.filters}
          </h3>
          {activeFiltersCount > 0 && (
            <Badge className="bg-saudi-navy-600">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2 space-x-reverse">
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 me-2" />
              {t.clearFilters}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Search Bar - Always Visible */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10 arabic-text"
          />
        </div>
      </div>

      {/* Collapsible Advanced Filters */}
      <Collapsible open={!isCollapsed}>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-6">
            {/* Quick Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.categories}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="truncate">
                        {selectedCategories.length > 0
                          ? categories.find(c => c.id === selectedCategories[0])?.name || t.allCategories
                          : t.allCategories
                        }
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'} className="w-56">
                    <DropdownMenuItem onClick={() => setSelectedCategories([])}>
                      {t.allCategories}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {categories.map((category) => (
                      <DropdownMenuItem
                        key={category.id}
                        onClick={() => handleToggleCategory(category.id)}
                      >
                        <div className="flex items-center space-x-2 space-x-reverse w-full">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="flex-1">{category.name}</span>
                          {selectedCategories.includes(category.id) && (
                            <div className="w-2 h-2 bg-saudi-navy-600 rounded-full" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.status}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="truncate">
                        {selectedStatuses.length > 0 ? t[selectedStatuses[0] as keyof typeof t] : t.allStatuses}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => setSelectedStatuses([])}>
                      {t.allStatuses}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(['completed', 'processing', 'failed', 'archived'] as DocumentStatus[]).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => handleToggleStatus(status)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{t[status as keyof typeof t]}</span>
                          {selectedStatuses.includes(status) && (
                            <div className="w-2 h-2 bg-saudi-navy-600 rounded-full" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.language}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="truncate">
                        {selectedLanguages.length > 0 
                          ? t[selectedLanguages[0] as keyof typeof t] 
                          : t.allLanguages
                        }
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => setSelectedLanguages([])}>
                      {t.allLanguages}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {['ar', 'en', 'mixed'].map((lang) => (
                      <DropdownMenuItem
                        key={lang}
                        onClick={() => handleToggleLanguage(lang)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{t[lang as keyof typeof t]}</span>
                          {selectedLanguages.includes(lang) && (
                            <div className="w-2 h-2 bg-saudi-navy-600 rounded-full" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.sortBy}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="truncate">
                        {t[sortBy as keyof typeof t]} ({sortOrder === 'asc' ? t.ascending : t.descending})
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                    {['filename', 'file_size', 'created_at', 'updated_at'].map((field) => (
                      <React.Fragment key={field}>
                        <DropdownMenuItem onClick={() => { setSortBy(field); setSortOrder('asc'); }}>
                          {t[field as keyof typeof t]} - {t.ascending}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortBy(field); setSortOrder('desc'); }}>
                          {t[field as keyof typeof t]} - {t.descending}
                        </DropdownMenuItem>
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Types */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-3">
                  {t.fileTypes}
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ALLOWED_FILE_TYPES).map(([mimeType, config]) => (
                    <button
                      key={mimeType}
                      onClick={() => handleToggleFileType(config.label)}
                      className={`
                        px-3 py-1 text-xs rounded-full border transition-colors
                        ${selectedFileTypes.includes(config.label)
                          ? 'bg-saudi-navy-600 text-white border-saudi-navy-600'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:border-saudi-navy-400'
                        }
                      `}
                    >
                      {config.icon} {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-3">
                  {t.tags}
                </label>
                <div className="space-y-2">
                  <div className="flex space-x-2 space-x-reverse">
                    <Input
                      type="text"
                      placeholder={t.tagsPlaceholder}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      className="flex-1 arabic-text"
                    />
                    <Button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      size="sm"
                    >
                      {t.addTag}
                    </Button>
                  </div>
                  
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="flex items-center space-x-1 space-x-reverse"
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ms-1 hover:text-red-600"
                            title={t.removeTag}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range and User Filter */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.from}
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.to}
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                  {t.uploadedBy}
                </label>
                <Input
                  type="text"
                  placeholder={t.uploadedByPlaceholder}
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  className="arabic-text"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && !isCollapsed && (
        <div className="px-4 pb-4">
          <div className="text-sm font-medium text-saudi-navy-700 mb-2">
            {t.activeFilters}
          </div>
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="outline" className="flex items-center space-x-1 space-x-reverse">
                <Search className="h-3 w-3" />
                <span>{searchQuery}</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="ms-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {selectedCategories.map((catId) => {
              const category = categories.find(c => c.id === catId);
              return category ? (
                <Badge key={catId} variant="outline" className="flex items-center space-x-1 space-x-reverse">
                  <FolderOpen className="h-3 w-3" />
                  <span>{category.name}</span>
                  <button
                    onClick={() => handleToggleCategory(catId)}
                    className="ms-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            
            {tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="flex items-center space-x-1 space-x-reverse">
                <Tag className="h-3 w-3" />
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ms-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}