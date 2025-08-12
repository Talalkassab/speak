'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  FileText, 
  ExternalLink, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Download,
  Star,
  Calendar,
  User,
  Building,
  Tag,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/utils/cn';
import type { SourceAttribution, SourceType } from '@/types/chat';
import { SOURCE_TYPE_LABELS } from '@/types/chat';

interface SourcePanelProps {
  sources: SourceAttribution[];
  language?: 'ar' | 'en';
  className?: string;
  onSourceClick?: (source: SourceAttribution) => void;
  onSourceView?: (source: SourceAttribution) => void;
  showFilters?: boolean;
  maxHeight?: string;
}

interface SourceFilter {
  types: SourceType[];
  minConfidence: number;
  searchQuery: string;
  sortBy: 'confidence' | 'relevance' | 'type' | 'title';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTER: SourceFilter = {
  types: [],
  minConfidence: 0,
  searchQuery: '',
  sortBy: 'confidence',
  sortOrder: 'desc',
};

// Source type icons mapping
const SOURCE_TYPE_ICONS: Record<SourceType, React.ComponentType<any>> = {
  document: FileText,
  law_article: Building,
  template: FileText,
  policy: FileText,
  contract: FileText,
  form: FileText,
};

// Confidence level colors
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
  if (confidence >= 0.6) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= 0.8) return CheckCircle;
  if (confidence >= 0.6) return Info;
  if (confidence >= 0.4) return AlertCircle;
  return AlertCircle;
};

// Individual source item component
function SourceItem({ 
  source, 
  language = 'ar', 
  onSourceClick, 
  onSourceView,
  isExpanded,
  onToggleExpanded
}: {
  source: SourceAttribution;
  language?: 'ar' | 'en';
  onSourceClick?: (source: SourceAttribution) => void;
  onSourceView?: (source: SourceAttribution) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const isRTL = language === 'ar';
  const typeLabel = SOURCE_TYPE_LABELS[language][source.type] || source.type;
  const IconComponent = SOURCE_TYPE_ICONS[source.type] || FileText;
  const confidencePercentage = Math.round(source.confidence * 100);
  const confidenceColor = getConfidenceColor(source.confidence);
  const ConfidenceIcon = getConfidenceIcon(source.confidence);

  const handleClick = useCallback(() => {
    onSourceClick?.(source);
  }, [source, onSourceClick]);

  const handleView = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSourceView?.(source);
  }, [source, onSourceView]);

  const handleExternalLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer');
    }
  }, [source.url]);

  return (
    <div className={cn(
      "border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-all duration-200",
      "cursor-pointer group"
    )}>
      <div className="p-3" onClick={handleClick}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-2">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconComponent className="w-4 h-4 text-gray-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="h-5 text-xs">
                {typeLabel}
              </Badge>
              
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border",
                confidenceColor
              )}>
                <ConfidenceIcon className="w-3 h-3" />
                <span>{confidencePercentage}%</span>
              </div>
            </div>
            
            <h3 className={cn(
              "font-medium text-sm text-gray-900 line-clamp-1",
              isRTL ? 'text-right font-arabic' : 'text-left'
            )}>
              {source.title}
            </h3>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {source.url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                onClick={handleExternalLink}
                title={isRTL ? 'فتح الرابط' : 'Open link'}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              onClick={handleView}
              title={isRTL ? 'عرض المصدر' : 'View source'}
            >
              <Eye className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Excerpt */}
        <p className={cn(
          "text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2",
          isRTL ? 'text-right font-arabic' : 'text-left'
        )}>
          {source.excerpt}
        </p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            {source.page && (
              <span className={cn(isRTL ? 'font-arabic' : '')}>
                {isRTL ? `صفحة ${source.page}` : `Page ${source.page}`}
              </span>
            )}
            {source.section && (
              <>
                {source.page && <span>•</span>}
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {source.section}
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />
            <span>{source.relevanceScore?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>

        {/* Extended metadata (collapsible) */}
        {source.metadata && (
          <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 h-6 text-xs text-gray-500 hover:text-gray-700"
              >
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'تفاصيل إضافية' : 'More details'}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-1" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {source.metadata.fileName && (
                  <div>
                    <span className="text-gray-500 font-medium">
                      {isRTL ? 'اسم الملف:' : 'File:'}
                    </span>
                    <p className="text-gray-700 truncate">{source.metadata.fileName}</p>
                  </div>
                )}
                
                {source.metadata.uploadedAt && (
                  <div>
                    <span className="text-gray-500 font-medium">
                      {isRTL ? 'تاريخ الرفع:' : 'Uploaded:'}
                    </span>
                    <p className="text-gray-700">
                      {new Date(source.metadata.uploadedAt).toLocaleDateString(
                        isRTL ? 'ar-SA' : 'en-US'
                      )}
                    </p>
                  </div>
                )}
                
                {source.metadata.category && (
                  <div>
                    <span className="text-gray-500 font-medium">
                      {isRTL ? 'الفئة:' : 'Category:'}
                    </span>
                    <p className="text-gray-700">{source.metadata.category}</p>
                  </div>
                )}
                
                {source.metadata.author && (
                  <div>
                    <span className="text-gray-500 font-medium">
                      {isRTL ? 'المؤلف:' : 'Author:'}
                    </span>
                    <p className="text-gray-700">{source.metadata.author}</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

// Filter panel component
function FilterPanel({ 
  filter, 
  onFilterChange, 
  sources,
  language = 'ar'
}: {
  filter: SourceFilter;
  onFilterChange: (filter: SourceFilter) => void;
  sources: SourceAttribution[];
  language?: 'ar' | 'en';
}) {
  const isRTL = language === 'ar';
  
  // Get available source types from sources
  const availableTypes = useMemo(() => {
    const types = new Set(sources.map(s => s.type));
    return Array.from(types);
  }, [sources]);

  const handleTypeToggle = useCallback((type: SourceType) => {
    const newTypes = filter.types.includes(type)
      ? filter.types.filter(t => t !== type)
      : [...filter.types, type];
    
    onFilterChange({ ...filter, types: newTypes });
  }, [filter, onFilterChange]);

  const handleConfidenceChange = useCallback((confidence: number) => {
    onFilterChange({ ...filter, minConfidence: confidence });
  }, [filter, onFilterChange]);

  const handleSortChange = useCallback((sortBy: SourceFilter['sortBy'], sortOrder: SourceFilter['sortOrder']) => {
    onFilterChange({ ...filter, sortBy, sortOrder });
  }, [filter, onFilterChange]);

  const clearFilters = useCallback(() => {
    onFilterChange(DEFAULT_FILTER);
  }, [onFilterChange]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <label className={cn(
          "block text-xs font-medium text-gray-700 mb-1",
          isRTL ? 'font-arabic' : ''
        )}>
          {isRTL ? 'البحث في المصادر' : 'Search sources'}
        </label>
        <Input
          placeholder={isRTL ? 'ابحث...' : 'Search...'}
          value={filter.searchQuery}
          onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
          className={cn(
            "h-8 text-xs",
            isRTL ? 'text-right font-arabic' : 'text-left'
          )}
        />
      </div>

      {/* Source types */}
      <div>
        <label className={cn(
          "block text-xs font-medium text-gray-700 mb-2",
          isRTL ? 'font-arabic' : ''
        )}>
          {isRTL ? 'نوع المصدر' : 'Source type'}
        </label>
        <div className="space-y-1">
          {availableTypes.map(type => (
            <label key={type} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filter.types.includes(type)}
                onChange={() => handleTypeToggle(type)}
                className="rounded border-gray-300"
              />
              <span className={cn(isRTL ? 'font-arabic' : '')}>
                {SOURCE_TYPE_LABELS[language][type] || type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Confidence threshold */}
      <div>
        <label className={cn(
          "block text-xs font-medium text-gray-700 mb-2",
          isRTL ? 'font-arabic' : ''
        )}>
          {isRTL ? 'الحد الأدنى للثقة' : 'Min confidence'} ({Math.round(filter.minConfidence * 100)}%)
        </label>
        <div className="space-y-1">
          {[0, 0.4, 0.6, 0.8].map(confidence => (
            <label key={confidence} className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="confidence"
                checked={filter.minConfidence === confidence}
                onChange={() => handleConfidenceChange(confidence)}
                className="border-gray-300"
              />
              <span>{Math.round(confidence * 100)}%+</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sort options */}
      <div>
        <label className={cn(
          "block text-xs font-medium text-gray-700 mb-2",
          isRTL ? 'font-arabic' : ''
        )}>
          {isRTL ? 'ترتيب حسب' : 'Sort by'}
        </label>
        <div className="grid grid-cols-2 gap-1">
          <Button
            variant={filter.sortBy === 'confidence' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleSortChange('confidence', 'desc')}
          >
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'الثقة' : 'Confidence'}
            </span>
          </Button>
          <Button
            variant={filter.sortBy === 'relevance' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleSortChange('relevance', 'desc')}
          >
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL ? 'الصلة' : 'Relevance'}
            </span>
          </Button>
        </div>
      </div>

      {/* Clear filters */}
      <Button
        variant="outline"
        size="sm"
        onClick={clearFilters}
        className="w-full h-7 text-xs"
      >
        <span className={cn(isRTL ? 'font-arabic' : '')}>
          {isRTL ? 'مسح المرشحات' : 'Clear filters'}
        </span>
      </Button>
    </div>
  );
}

export function SourcePanel({
  sources,
  language = 'ar',
  className,
  onSourceClick,
  onSourceView,
  showFilters = true,
  maxHeight = '600px'
}: SourcePanelProps) {
  const [filter, setFilter] = useState<SourceFilter>(DEFAULT_FILTER);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const isRTL = language === 'ar';

  // Filter and sort sources
  const filteredSources = useMemo(() => {
    let filtered = sources.filter(source => {
      // Type filter
      if (filter.types.length > 0 && !filter.types.includes(source.type)) {
        return false;
      }
      
      // Confidence filter
      if (source.confidence < filter.minConfidence) {
        return false;
      }
      
      // Search filter
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        return (
          source.title.toLowerCase().includes(query) ||
          source.excerpt.toLowerCase().includes(query) ||
          (source.section && source.section.toLowerCase().includes(query))
        );
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (filter.sortBy) {
        case 'confidence':
          compareValue = a.confidence - b.confidence;
          break;
        case 'relevance':
          compareValue = (a.relevanceScore || 0) - (b.relevanceScore || 0);
          break;
        case 'title':
          compareValue = a.title.localeCompare(b.title);
          break;
        case 'type':
          compareValue = a.type.localeCompare(b.type);
          break;
        default:
          compareValue = 0;
      }
      
      return filter.sortOrder === 'desc' ? -compareValue : compareValue;
    });

    return filtered;
  }, [sources, filter]);

  const toggleExpanded = useCallback((sourceId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  }, []);

  if (sources.length === 0) {
    return (
      <div className={cn(
        "h-full flex items-center justify-center p-6 bg-gray-50",
        className
      )}>
        <div className="text-center">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className={cn(
            "text-sm text-gray-500",
            isRTL ? 'font-arabic' : ''
          )}>
            {isRTL ? 'لا توجد مصادر متاحة' : 'No sources available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-gray-50", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className={cn(
            "font-semibold text-gray-900",
            isRTL ? 'font-arabic' : ''
          )}>
            {isRTL ? 'المصادر' : 'Sources'}
          </h3>
          <Badge variant="secondary" className="h-5 text-xs">
            {filteredSources.length} / {sources.length}
          </Badge>
        </div>
        
        {showFilters && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={cn(
                "h-7 text-xs",
                showFilterPanel && "bg-gray-100"
              )}
            >
              <Filter className="w-3 h-3 mr-1" />
              <span className={cn(isRTL ? 'font-arabic' : '')}>
                {isRTL ? 'تصفية' : 'Filter'}
              </span>
            </Button>
            
            {(filter.types.length > 0 || filter.minConfidence > 0 || filter.searchQuery) && (
              <Badge variant="secondary" className="h-5 text-xs">
                {Object.values(filter).filter(v => 
                  Array.isArray(v) ? v.length > 0 : v > 0 || v !== ''
                ).length}
              </Badge>
            )}
          </div>
        )}

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <FilterPanel
              filter={filter}
              onFilterChange={setFilter}
              sources={sources}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Sources list */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight }}
      >
        {filteredSources.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className={cn(
              "text-sm text-gray-500",
              isRTL ? 'font-arabic' : ''
            )}>
              {isRTL ? 'لم يتم العثور على مصادر تطابق المرشحات' : 'No sources match the current filters'}
            </p>
          </div>
        ) : (
          filteredSources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              language={language}
              onSourceClick={onSourceClick}
              onSourceView={onSourceView}
              isExpanded={expandedSources.has(source.id)}
              onToggleExpanded={() => toggleExpanded(source.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}