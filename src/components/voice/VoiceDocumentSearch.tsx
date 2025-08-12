'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Search, 
  Mic, 
  MicOff,
  Square,
  Play,
  Pause,
  FileText, 
  Volume2,
  Filter,
  Clock,
  Target,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';
import { VoiceSettings, VoiceError, SpeechToTextResult } from '@/types/voice';
import { AudioVisualization } from './AudioVisualization';
import { VoiceErrorHandler } from './VoiceErrorHandler';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import useTextToSpeech from '@/hooks/useTextToSpeech';
import { voiceCommandService } from '@/libs/services/voice-command-service';

interface SearchResult {
  id: string;
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
  type: 'document' | 'policy' | 'contract' | 'regulation';
  category: string;
  categoryAr?: string;
  confidence: number;
  matches: Array<{
    text: string;
    position: number;
    score: number;
  }>;
  metadata: {
    author?: string;
    createdAt: Date;
    updatedAt: Date;
    fileSize?: number;
    language: 'ar' | 'en' | 'both';
  };
}

interface SearchFilters {
  documentTypes: string[];
  categories: string[];
  languages: ('ar' | 'en')[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  minConfidence: number;
}

interface VoiceDocumentSearchProps {
  onResults?: (results: SearchResult[]) => void;
  onResultSelect?: (result: SearchResult) => void;
  language?: 'ar' | 'en';
  placeholder?: string;
  maxResults?: number;
  enableVoiceSearch?: boolean;
  showFilters?: boolean;
  className?: string;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  language: 'ar',
  dialect: 'ar-SA',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
  autoDetectLanguage: true,
  noiseReduction: true,
  echoCancellation: true,
  autoGainControl: true,
};

const DEFAULT_FILTERS: SearchFilters = {
  documentTypes: [],
  categories: [],
  languages: [],
  dateRange: {},
  minConfidence: 0.5,
};

const DOCUMENT_TYPES = [
  { value: 'policy', label: 'Policy', labelAr: 'سياسة' },
  { value: 'contract', label: 'Contract', labelAr: 'عقد' },
  { value: 'regulation', label: 'Regulation', labelAr: 'لائحة' },
  { value: 'document', label: 'Document', labelAr: 'وثيقة' },
];

const CATEGORIES = [
  { value: 'hr', label: 'Human Resources', labelAr: 'الموارد البشرية' },
  { value: 'legal', label: 'Legal', labelAr: 'قانوني' },
  { value: 'finance', label: 'Finance', labelAr: 'مالية' },
  { value: 'operations', label: 'Operations', labelAr: 'العمليات' },
  { value: 'compliance', label: 'Compliance', labelAr: 'الامتثال' },
];

export function VoiceDocumentSearch({
  onResults,
  onResultSelect,
  language = 'ar',
  placeholder,
  maxResults = 10,
  enableVoiceSearch = true,
  showFilters = true,
  className,
}: VoiceDocumentSearchProps) {
  const [query, setQuery] = useState('');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
    language,
  });
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isRTL = language === 'ar';

  // Voice recording hook
  const {
    isRecording,
    isPaused: voiceIsPaused,
    isProcessing: voiceIsProcessing,
    duration: voiceDuration,
    audioLevel,
    error: voiceError,
    transcript: realtimeTranscript,
    confidence: voiceConfidence,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    isSupported: voiceSupported,
  } = useVoiceRecording({
    settings: voiceSettings,
    onTranscript: handleVoiceTranscript,
    onError: handleVoiceError,
    maxDuration: 60, // 1 minute max for search queries
  });

  // Text-to-speech hook
  const {
    speak,
    isSpeaking,
    stop: stopSpeaking,
  } = useTextToSpeech({
    settings: voiceSettings,
  });

  // Handle voice transcript results
  function handleVoiceTranscript(result: SpeechToTextResult) {
    setVoiceQuery(result.transcript);
    
    if (result.isFinal && result.transcript.trim()) {
      // Check for search commands
      checkForSearchCommands(result.transcript);
      
      // Set as search query
      setQuery(result.transcript.trim());
      setVoiceQuery('');
      
      // Auto-search if query is meaningful
      if (result.transcript.trim().length > 3) {
        handleSearch(result.transcript.trim());
      }
    }
  }

  // Handle voice errors
  function handleVoiceError(error: VoiceError) {
    console.error('Voice search error:', error);
  }

  // Check for search commands in transcript
  const checkForSearchCommands = useCallback((transcript: string) => {
    const commandResult = voiceCommandService.recognizeCommand(transcript, language);
    
    if (commandResult.recognized && commandResult.command?.command === 'search') {
      const searchQuery = commandResult.parameters?.join(' ') || '';
      if (searchQuery) {
        setQuery(searchQuery);
        handleSearch(searchQuery);
      }
    }
  }, [language]);

  // Handle search
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      // Add to search history
      setSearchHistory(prev => {
        const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)];
        return newHistory.slice(0, 10); // Keep last 10 searches
      });

      // Simulate search API call (replace with actual implementation)
      const searchResults = await performDocumentSearch(searchQuery, filters);
      
      setResults(searchResults);
      onResults?.(searchResults);

      // Provide voice feedback if enabled
      if (voiceSupported && enableVoiceSearch) {
        const resultCount = searchResults.length;
        const feedback = language === 'ar'
          ? `تم العثور على ${resultCount} نتيجة للبحث`
          : `Found ${resultCount} results for your search`;
        
        speak(feedback, { language });
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [isSearching, filters, language, voiceSupported, enableVoiceSearch, speak, onResults]);

  // Perform document search (mock implementation)
  const performDocumentSearch = async (
    query: string,
    searchFilters: SearchFilters
  ): Promise<SearchResult[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock search results
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Employee Handbook',
        titleAr: 'دليل الموظف',
        content: `Comprehensive guide covering all employee policies and procedures...`,
        contentAr: 'دليل شامل يغطي جميع سياسات وإجراءات الموظفين...',
        type: 'policy',
        category: 'hr',
        categoryAr: 'الموارد البشرية',
        confidence: 0.95,
        matches: [
          { text: query, position: 45, score: 0.9 },
        ],
        metadata: {
          author: 'HR Department',
          createdAt: new Date('2023-01-15'),
          updatedAt: new Date('2024-06-10'),
          fileSize: 2048000,
          language: 'both',
        },
      },
      {
        id: '2',
        title: 'Saudi Labor Law Guide',
        titleAr: 'دليل نظام العمل السعودي',
        content: `Complete reference for Saudi labor regulations...`,
        contentAr: 'مرجع كامل للوائح العمل السعودية...',
        type: 'regulation',
        category: 'legal',
        categoryAr: 'قانوني',
        confidence: 0.87,
        matches: [
          { text: query, position: 12, score: 0.85 },
        ],
        metadata: {
          author: 'Legal Team',
          createdAt: new Date('2023-03-20'),
          updatedAt: new Date('2024-08-05'),
          fileSize: 5120000,
          language: 'both',
        },
      },
    ];

    // Filter results based on search filters
    return mockResults
      .filter(result => {
        if (searchFilters.documentTypes.length > 0 && !searchFilters.documentTypes.includes(result.type)) {
          return false;
        }
        if (searchFilters.categories.length > 0 && !searchFilters.categories.includes(result.category)) {
          return false;
        }
        if (searchFilters.languages.length > 0 && !searchFilters.languages.includes(result.metadata.language as any)) {
          return false;
        }
        if (result.confidence < searchFilters.minConfidence) {
          return false;
        }
        return true;
      })
      .slice(0, maxResults);
  };

  // Handle voice search toggle
  const handleVoiceSearchToggle = useCallback(async () => {
    if (!enableVoiceSearch || !voiceSupported) return;
    
    if (isRecording) {
      if (voiceIsPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    } else {
      setShowVoicePanel(true);
      await startRecording();
    }
  }, [enableVoiceSearch, voiceSupported, isRecording, voiceIsPaused, startRecording, pauseRecording, resumeRecording]);

  // Handle stopping voice recording
  const handleStopVoiceRecording = useCallback(async () => {
    await stopRecording();
    setShowVoicePanel(false);
  }, [stopRecording]);

  // Handle canceling voice recording
  const handleCancelVoiceRecording = useCallback(() => {
    cancelRecording();
    setVoiceQuery('');
    setShowVoicePanel(false);
  }, [cancelRecording]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query);
    }
  }, [query, handleSearch]);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Format duration
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Auto-focus search input
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <div className={cn("space-y-4", className, isRTL && "text-right")}>
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || (
                isRTL 
                  ? 'ابحث في المستندات... (يمكنك استخدام الصوت)'
                  : 'Search documents... (voice enabled)'
              )}
              className={cn(
                "pl-10 pr-4",
                isRTL && "text-right font-arabic pr-10 pl-4"
              )}
              disabled={isSearching}
            />
            <Search className={cn(
              "absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400",
              isRTL ? "right-3" : "left-3"
            )} />
          </div>

          {/* Voice Search Button */}
          {enableVoiceSearch && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleVoiceSearchToggle}
              disabled={!voiceSupported || isSearching}
              className={cn(
                "px-3 transition-colors",
                isRecording 
                  ? voiceIsPaused
                    ? "text-orange-600 bg-orange-50 border-orange-300"
                    : "text-red-600 bg-red-50 border-red-300"
                  : voiceSupported
                    ? "text-gray-600 hover:text-saudi-navy-600"
                    : "text-gray-300 cursor-not-allowed"
              )}
              title={
                !voiceSupported 
                  ? (isRTL ? 'البحث الصوتي غير مدعوم' : 'Voice search not supported')
                  : isRecording 
                    ? voiceIsPaused 
                      ? (isRTL ? 'متوقف - اضغط للاستكمال' : 'Paused - Click to resume')
                      : (isRTL ? 'يسجل - اضغط للإيقاف المؤقت' : 'Recording - Click to pause')
                    : (isRTL ? 'ابدأ البحث الصوتي' : 'Start voice search')
              }
            >
              {isRecording ? 
                voiceIsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />
                : voiceSupported ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />
              }
            </Button>
          )}

          {/* Filters */}
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="px-3"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className={cn(isRTL && "font-arabic")}>
                  {isRTL ? 'مرشحات البحث' : 'Search Filters'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Document Types */}
                <DropdownMenuLabel className="text-xs text-gray-500">
                  {isRTL ? 'أنواع المستندات' : 'Document Types'}
                </DropdownMenuLabel>
                {DOCUMENT_TYPES.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type.value}
                    checked={filters.documentTypes.includes(type.value)}
                    onCheckedChange={(checked) => {
                      const newTypes = checked 
                        ? [...filters.documentTypes, type.value]
                        : filters.documentTypes.filter(t => t !== type.value);
                      updateFilters({ documentTypes: newTypes });
                    }}
                  >
                    {isRTL ? type.labelAr : type.label}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                {/* Categories */}
                <DropdownMenuLabel className="text-xs text-gray-500">
                  {isRTL ? 'الفئات' : 'Categories'}
                </DropdownMenuLabel>
                {CATEGORIES.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.value}
                    checked={filters.categories.includes(category.value)}
                    onCheckedChange={(checked) => {
                      const newCategories = checked 
                        ? [...filters.categories, category.value]
                        : filters.categories.filter(c => c !== category.value);
                      updateFilters({ categories: newCategories });
                    }}
                  >
                    {isRTL ? category.labelAr : category.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Search Button */}
          <Button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Voice Recording Panel */}
        {showVoicePanel && isRecording && (
          <div className={cn(
            "p-4 bg-gray-50 rounded-lg border",
            voiceError && "border-red-200 bg-red-50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  voiceIsPaused ? "bg-orange-500" : "bg-red-500"
                )}>
                </div>
                <span className={cn("text-sm font-medium", isRTL && "font-arabic")}>
                  {voiceIsPaused
                    ? (isRTL ? 'البحث الصوتي متوقف' : 'Voice search paused')
                    : (isRTL ? 'جار البحث الصوتي...' : 'Voice searching...')
                  }
                </span>
                <span className="text-sm text-gray-500 font-mono">
                  {formatDuration(voiceDuration)}
                </span>
              </div>
              
              <Button
                onClick={handleCancelVoiceRecording}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Audio Visualization */}
            <div className="mb-3 flex justify-center">
              <AudioVisualization
                audioLevel={audioLevel}
                isRecording={isRecording}
                isPaused={voiceIsPaused}
                variant="pulse"
                size="sm"
              />
            </div>

            {/* Real-time Transcript */}
            {(voiceQuery || realtimeTranscript) && (
              <div className={cn(
                "mb-3 p-2 bg-white rounded border text-sm",
                isRTL && "text-right font-arabic"
              )}>
                <p className="text-gray-700">
                  {voiceQuery || realtimeTranscript}
                </p>
                {voiceConfidence && (
                  <p className="text-xs text-gray-500 mt-1">
                    {isRTL ? 'مستوى الثقة:' : 'Confidence:'} {Math.round(voiceConfidence * 100)}%
                  </p>
                )}
              </div>
            )}

            {/* Voice Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={handleVoiceSearchToggle}
                variant={voiceIsPaused ? "default" : "secondary"}
                size="sm"
                disabled={voiceIsProcessing}
              >
                {voiceIsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              
              <Button
                onClick={handleStopVoiceRecording}
                variant="default"
                size="sm"
                disabled={voiceIsProcessing}
                className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
              >
                {voiceIsProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Voice Error Handler */}
      {voiceError && (
        <VoiceErrorHandler
          error={voiceError}
          language={language}
          onRetry={handleVoiceSearchToggle}
          onDismiss={() => {/* Clear error */}}
        />
      )}

      {/* Active Filters */}
      {(filters.documentTypes.length > 0 || filters.categories.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm text-gray-600", isRTL && "font-arabic")}>
            {isRTL ? 'المرشحات النشطة:' : 'Active filters:'}
          </span>
          
          {filters.documentTypes.map(type => {
            const typeInfo = DOCUMENT_TYPES.find(t => t.value === type);
            return (
              <Badge key={type} variant="secondary" className="text-xs">
                {isRTL ? typeInfo?.labelAr : typeInfo?.label}
                <button
                  onClick={() => {
                    const newTypes = filters.documentTypes.filter(t => t !== type);
                    updateFilters({ documentTypes: newTypes });
                  }}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
          
          {filters.categories.map(category => {
            const categoryInfo = CATEGORIES.find(c => c.value === category);
            return (
              <Badge key={category} variant="secondary" className="text-xs">
                {isRTL ? categoryInfo?.labelAr : categoryInfo?.label}
                <button
                  onClick={() => {
                    const newCategories = filters.categories.filter(c => c !== category);
                    updateFilters({ categories: newCategories });
                  }}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={cn("font-medium", isRTL && "font-arabic")}>
              {isRTL ? 'نتائج البحث' : 'Search Results'}
              <span className="text-sm text-gray-500 ml-2">
                ({results.length})
              </span>
            </h3>
            
            {isSpeaking && (
              <Button
                onClick={stopSpeaking}
                variant="outline"
                size="sm"
                className="text-saudi-navy-600"
              >
                <Volume2 className="w-4 h-4 mr-1" />
                {isRTL ? 'إيقاف' : 'Stop'}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className="p-4 bg-white border rounded-lg hover:shadow-sm cursor-pointer transition-shadow"
                onClick={() => onResultSelect?.(result)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-saudi-navy-600" />
                      <h4 className={cn("font-medium text-saudi-navy-900", isRTL && "font-arabic")}>
                        {isRTL && result.titleAr ? result.titleAr : result.title}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(result.confidence * 100)}%
                      </Badge>
                    </div>
                    
                    <p className={cn(
                      "text-sm text-gray-600 line-clamp-2",
                      isRTL && "font-arabic"
                    )}>
                      {isRTL && result.contentAr ? result.contentAr : result.content}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        <span>{isRTL ? (result.categoryAr || result.category) : result.category}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {result.metadata.updatedAt.toLocaleDateString(
                            isRTL ? 'ar-SA' : 'en-US'
                          )}
                        </span>
                      </div>
                      
                      {result.metadata.fileSize && (
                        <span>{formatFileSize(result.metadata.fileSize)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {result.type}
                    </Badge>
                    
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const textToRead = isRTL && result.contentAr 
                          ? result.contentAr 
                          : result.content;
                        speak(textToRead, { language: result.metadata.language });
                      }}
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      <Volume2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className={cn(isRTL && "font-arabic")}>
            {isRTL 
              ? 'لم يتم العثور على نتائج للبحث عن "' + query + '"'
              : 'No results found for "' + query + '"'
            }
          </p>
          <p className={cn("text-sm mt-1", isRTL && "font-arabic")}>
            {isRTL 
              ? 'جرب كلمات مختلفة أو استخدم البحث الصوتي'
              : 'Try different keywords or use voice search'
            }
          </p>
        </div>
      )}

      {/* Search History */}
      {searchHistory.length > 0 && query === '' && (
        <div className="space-y-2">
          <h4 className={cn("text-sm font-medium text-gray-700", isRTL && "font-arabic")}>
            {isRTL ? 'عمليات البحث السابقة' : 'Recent Searches'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 5).map((historyQuery, index) => (
              <Button
                key={index}
                onClick={() => {
                  setQuery(historyQuery);
                  handleSearch(historyQuery);
                }}
                variant="outline"
                size="sm"
                className="text-xs h-7"
              >
                {historyQuery}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceDocumentSearch;