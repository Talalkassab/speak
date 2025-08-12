'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, TrendingUp, User, Sparkles, ChevronRight, X } from 'lucide-react';
import { AutocompleteSuggestion, SuggestionType } from '@/types/suggestions';
import { cn } from '@/libs/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  placeholderArabic?: string;
  language?: 'ar' | 'en' | 'both';
  maxSuggestions?: number;
  includePopular?: boolean;
  includePersonalized?: boolean;
  className?: string;
  disabled?: boolean;
  showRecentQueries?: boolean;
  context?: {
    currentPage?: string;
    conversationId?: string;
    previousQueries?: string[];
    userRole?: string;
    department?: string;
  };
}

interface SuggestionItemProps {
  suggestion: AutocompleteSuggestion;
  isSelected: boolean;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  onMouseEnter: () => void;
  language: 'ar' | 'en' | 'both';
}

const SuggestionTypeIcons: Record<SuggestionType, React.ElementType> = {
  autocomplete: Search,
  popular: TrendingUp,
  contextual: User,
  related: ChevronRight,
  template: Sparkles,
  refinement: Sparkles,
  intent_based: Sparkles,
  followup: ChevronRight
};

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  isSelected,
  onSelect,
  onMouseEnter,
  language
}) => {
  const Icon = SuggestionTypeIcons[suggestion.type] || Search;
  const displayText = language === 'ar' && suggestion.textArabic 
    ? suggestion.textArabic 
    : suggestion.text;
  
  const highlightedText = language === 'ar' && suggestion.highlightedTextArabic 
    ? suggestion.highlightedTextArabic 
    : suggestion.highlightedText;

  const description = language === 'ar' && suggestion.descriptionArabic 
    ? suggestion.descriptionArabic 
    : suggestion.description;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isSelected && "bg-blue-50 dark:bg-blue-900/20",
        language === 'ar' && "text-right"
      )}
      onClick={() => onSelect(suggestion)}
      onMouseEnter={onMouseEnter}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex-shrink-0">
        <Icon 
          size={16} 
          className={cn(
            "text-gray-400",
            suggestion.type === 'popular' && "text-orange-500",
            suggestion.type === 'contextual' && "text-blue-500",
            suggestion.type === 'template' && "text-purple-500"
          )} 
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div 
          className="text-sm font-medium text-gray-900 dark:text-white truncate"
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
            {description}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-xs text-gray-400">
        {suggestion.type === 'popular' && (
          <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded">
            {language === 'ar' ? 'شائع' : 'Popular'}
          </span>
        )}
        {suggestion.type === 'contextual' && (
          <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
            {language === 'ar' ? 'شخصي' : 'Personal'}
          </span>
        )}
        {suggestion.type === 'template' && (
          <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
            {language === 'ar' ? 'قالب' : 'Template'}
          </span>
        )}
      </div>
    </div>
  );
};

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask a question about HR or labor law...",
  placeholderArabic = "اسأل سؤالاً حول الموارد البشرية أو قانون العمل...",
  language = 'both',
  maxSuggestions = 8,
  includePopular = true,
  includePersonalized = true,
  className,
  disabled = false,
  showRecentQueries = true,
  context = {}
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  // Load recent queries from localStorage
  useEffect(() => {
    if (showRecentQueries) {
      const saved = localStorage.getItem('hr-recent-queries');
      if (saved) {
        try {
          setRecentQueries(JSON.parse(saved));
        } catch (error) {
          console.error('Failed to load recent queries:', error);
        }
      }
    }
  }, [showRecentQueries]);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        query,
        language,
        maxSuggestions: maxSuggestions.toString(),
        includePopular: includePopular.toString(),
        includePersonalized: includePersonalized.toString()
      });

      const response = await fetch(`/api/v1/suggestions/autocomplete?${params}`);
      const result = await response.json();

      if (result.success) {
        setSuggestions(result.data.suggestions);
      } else {
        console.error('Autocomplete error:', result.error);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [language, maxSuggestions, includePopular, includePersonalized]);

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    fetchSuggestions(debouncedValue);
  }, [debouncedValue, fetchSuggestions]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);
    
    if (newValue.trim()) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else if (value.trim()) {
          handleSubmit();
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: AutocompleteSuggestion) => {
    const selectedText = language === 'ar' && suggestion.textArabic 
      ? suggestion.textArabic 
      : suggestion.text;
    
    onChange(selectedText);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Save to recent queries
    if (showRecentQueries) {
      const updated = [selectedText, ...recentQueries.filter(q => q !== selectedText)].slice(0, 10);
      setRecentQueries(updated);
      localStorage.setItem('hr-recent-queries', JSON.stringify(updated));
    }

    // Auto-submit or focus for further editing
    if (onSubmit) {
      setTimeout(() => onSubmit(selectedText), 100);
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (value.trim() && onSubmit) {
      // Save to recent queries
      if (showRecentQueries && value.trim()) {
        const updated = [value.trim(), ...recentQueries.filter(q => q !== value.trim())].slice(0, 10);
        setRecentQueries(updated);
        localStorage.setItem('hr-recent-queries', JSON.stringify(updated));
      }
      
      onSubmit(value.trim());
      setShowSuggestions(false);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (value.trim() || recentQueries.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear input
  const handleClear = () => {
    onChange('');
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const displayPlaceholder = language === 'ar' ? placeholderArabic : placeholder;
  const isRTL = language === 'ar';

  // Combine suggestions with recent queries when input is empty
  const displaySuggestions = value.trim() 
    ? suggestions 
    : recentQueries.slice(0, 5).map((query, index) => ({
        text: query,
        textArabic: query,
        highlightedText: query,
        highlightedTextArabic: query,
        type: 'contextual' as SuggestionType,
        score: 1,
        category: 'general' as any,
        description: language === 'ar' ? 'استعلام سابق' : 'Recent query',
        descriptionArabic: 'استعلام سابق'
      }));

  const shouldShowSuggestions = showSuggestions && (displaySuggestions.length > 0 || isLoading);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <Search size={20} />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={displayPlaceholder}
          disabled={disabled}
          dir={isRTL ? 'rtl' : 'ltr'}
          className={cn(
            "w-full px-12 py-4 text-base border border-gray-300 rounded-xl",
            "focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "dark:bg-gray-800 dark:border-gray-600 dark:text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200",
            isRTL && "text-right"
          )}
        />

        {value.trim() && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            type="button"
          >
            <X size={18} />
          </button>
        )}

        {isLoading && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {shouldShowSuggestions && (
        <div 
          ref={suggestionsRef}
          className={cn(
            "absolute z-50 w-full mt-2 bg-white dark:bg-gray-900",
            "border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg",
            "max-h-96 overflow-y-auto"
          )}
        >
          {isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              {language === 'ar' ? 'جاري البحث...' : 'Searching...'}
            </div>
          ) : displaySuggestions.length > 0 ? (
            <>
              {!value.trim() && recentQueries.length > 0 && (
                <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <Clock size={14} />
                  {language === 'ar' ? 'الاستعلامات الأخيرة' : 'Recent queries'}
                </div>
              )}
              
              {displaySuggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.text}-${index}`}
                  suggestion={suggestion}
                  isSelected={index === selectedIndex}
                  onSelect={handleSuggestionSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  language={language}
                />
              ))}
              
              {value.trim() && suggestions.length > 0 && (
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 text-center">
                  {language === 'ar' 
                    ? `${suggestions.length} اقتراح • اضغط Tab للاختيار` 
                    : `${suggestions.length} suggestions • Press Tab to select`
                  }
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              {language === 'ar' 
                ? 'لا توجد اقتراحات'
                : 'No suggestions found'
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};