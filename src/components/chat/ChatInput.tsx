'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Settings, 
  Mic, 
  Square,
  Loader2,
  Languages,
  FileText,
  Scale,
  Volume2,
  MicOff,
  Play,
  Pause,
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
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { detectTextLanguage } from '@/types/documents';
import type { ChatInputOptions } from '@/types/chat';
import { VoiceSettings, VoiceError, SpeechToTextResult } from '@/types/voice';
import { AudioVisualization } from '@/components/voice/AudioVisualization';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import useTextToSpeech from '@/hooks/useTextToSpeech';
import { voiceCommandService } from '@/libs/services/voice-command-service';

interface ChatInputProps {
  onSendMessage: (content: string, options?: ChatInputOptions) => void;
  isStreaming?: boolean;
  language?: 'ar' | 'en';
  conversationId?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

interface InputSettings {
  includeCompanyDocs: boolean;
  includeLaborLaw: boolean;
  maxSources: number;
  autoDetectLanguage: boolean;
  preferredLanguage: 'ar' | 'en';
  enableVoiceInput: boolean;
  enableVoiceCommands: boolean;
  voiceVisualization: boolean;
}

const DEFAULT_SETTINGS: InputSettings = {
  includeCompanyDocs: true,
  includeLaborLaw: true,
  maxSources: 10,
  autoDetectLanguage: true,
  preferredLanguage: 'ar',
  enableVoiceInput: true,
  enableVoiceCommands: true,
  voiceVisualization: true,
};

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

export function ChatInput({
  onSendMessage,
  isStreaming = false,
  language = 'ar',
  conversationId,
  placeholder,
  maxLength = 4000,
  disabled = false,
  className
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<'ar' | 'en'>(language);
  const [settings, setSettings] = useState<InputSettings>(DEFAULT_SETTINGS);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
    language,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    maxDuration: 300,
  });

  // Text-to-speech hook
  const {
    isSpeaking,
    speak,
    stop: stopSpeaking,
    isSupported: ttsSupported,
  } = useTextToSpeech({
    settings: voiceSettings,
    onError: handleVoiceError,
  });

  // Voice handlers
  function handleVoiceTranscript(result: SpeechToTextResult) {
    setVoiceTranscript(result.transcript);
    
    if (result.isFinal && result.transcript.trim()) {
      // Check for voice commands if enabled
      if (settings.enableVoiceCommands) {
        checkForVoiceCommands(result.transcript);
      }
      
      // Add transcript to content
      const newContent = content + (content ? ' ' : '') + result.transcript;
      setContent(newContent);
      handleContentChange(newContent);
      setVoiceTranscript('');
    }
  }

  function handleVoiceError(error: VoiceError) {
    console.error('Voice error:', error);
    
    // Provide user feedback
    if (ttsSupported) {
      const errorMessage = voiceSettings.language === 'ar' && error.messageAr 
        ? error.messageAr 
        : error.message;
      speak(errorMessage, { language: voiceSettings.language });
    }
  }

  // Check for voice commands
  const checkForVoiceCommands = useCallback(async (transcript: string) => {
    try {
      const commandResult = voiceCommandService.recognizeCommand(transcript, voiceSettings.language);
      
      if (commandResult.recognized && commandResult.command) {
        // Handle recognized voice command
        handleVoiceCommand(commandResult.command.command, commandResult.parameters);
        
        // Provide voice feedback
        if (ttsSupported) {
          const feedback = voiceSettings.language === 'ar' 
            ? `تم تنفيذ الأمر: ${commandResult.command.descriptionAr}`
            : `Command executed: ${commandResult.command.description}`;
          speak(feedback, { language: voiceSettings.language });
        }
      }
    } catch (error) {
      console.error('Voice command processing failed:', error);
    }
  }, [voiceSettings.language, ttsSupported, speak]);

  // Handle voice commands
  const handleVoiceCommand = useCallback((command: string, parameters?: string[]) => {
    switch (command) {
      case 'search':
        if (parameters && parameters.length > 0) {
          const query = parameters.join(' ');
          setContent(query);
          handleContentChange(query);
        }
        break;
      case 'stop_recording':
        if (isRecording) {
          stopRecording();
        }
        break;
      case 'start_recording':
        if (!isRecording && voiceSupported) {
          startRecording();
        }
        break;
      case 'pause':
        if (isRecording && !voiceIsPaused) {
          pauseRecording();
        } else if (isSpeaking) {
          stopSpeaking();
        }
        break;
      case 'continue':
        if (isRecording && voiceIsPaused) {
          resumeRecording();
        }
        break;
      case 'repeat':
        if (content.trim() && ttsSupported) {
          speak(content, { language: voiceSettings.language });
        }
        break;
      default:
        console.log('Unhandled voice command:', command, parameters);
    }
  }, [
    isRecording, voiceIsPaused, isSpeaking, content, voiceSupported, ttsSupported,
    startRecording, stopRecording, pauseRecording, resumeRecording, stopSpeaking,
    speak, voiceSettings.language, handleContentChange
  ]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Max 5 lines approximately
    
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    setIsExpanded(scrollHeight > 48); // Expanded when more than 2 lines
  }, []);

  // Handle content change
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setCharCount(value.length);
    
    // Auto-detect language if enabled
    if (settings.autoDetectLanguage && value.trim().length > 10) {
      const detected = detectTextLanguage(value) as 'ar' | 'en';
      setDetectedLanguage(detected);
    }
    
    adjustTextareaHeight();
  }, [settings.autoDetectLanguage, adjustTextareaHeight]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || isStreaming || disabled) return;
    
    const messageLanguage = settings.autoDetectLanguage ? detectedLanguage : settings.preferredLanguage;
    
    onSendMessage(content.trim(), {
      language: messageLanguage,
      includeCompanyDocs: settings.includeCompanyDocs,
      includeLaborLaw: settings.includeLaborLaw,
      maxSources: settings.maxSources,
      conversationId,
    });
    
    // Clear input
    setContent('');
    setCharCount(0);
    setDetectedLanguage(language);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsExpanded(false);
  }, [
    content,
    isStreaming,
    disabled,
    detectedLanguage,
    settings,
    conversationId,
    language,
    onSendMessage
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
      return;
    }
    
    // Settings on Ctrl/Cmd + /
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      // Focus settings dropdown (implementation depends on dropdown library)
      return;
    }
  }, [handleSubmit]);

  // Handle paste events
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    // Check if pasted content would exceed max length
    const newContent = content + pastedText;
    if (newContent.length > maxLength) {
      e.preventDefault();
      const allowedLength = maxLength - content.length;
      const truncatedText = pastedText.substring(0, allowedLength);
      
      const newValue = content + truncatedText;
      setContent(newValue);
      handleContentChange(newValue);
    }
  }, [content, maxLength, handleContentChange]);

  // Stop streaming
  const handleStopStreaming = useCallback(() => {
    // Implementation would stop the streaming request
    console.log('Stop streaming requested');
  }, []);

  // Voice recording toggle
  const handleVoiceToggle = useCallback(async () => {
    if (!settings.enableVoiceInput || !voiceSupported) return;
    
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
  }, [settings.enableVoiceInput, voiceSupported, isRecording, voiceIsPaused, startRecording, pauseRecording, resumeRecording]);

  // Stop voice recording
  const handleStopVoiceRecording = useCallback(async () => {
    await stopRecording();
    setShowVoicePanel(false);
  }, [stopRecording]);

  // Cancel voice recording
  const handleCancelVoiceRecording = useCallback(() => {
    cancelRecording();
    setVoiceTranscript('');
    setShowVoicePanel(false);
  }, [cancelRecording]);

  // Get placeholder text based on language
  const getPlaceholder = useCallback(() => {
    if (placeholder) return placeholder;
    
    const placeholders = {
      ar: 'اكتب سؤالك هنا... (اضغط Enter للإرسال، Shift+Enter لسطر جديد)',
      en: 'Type your question here... (Press Enter to send, Shift+Enter for new line)'
    };
    
    const displayLanguage = settings.autoDetectLanguage ? detectedLanguage : settings.preferredLanguage;
    return placeholders[displayLanguage];
  }, [placeholder, settings.autoDetectLanguage, detectedLanguage, settings.preferredLanguage]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<InputSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Update voice settings
  const updateVoiceSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  const canSend = content.trim().length > 0 && !isStreaming && !disabled && charCount <= maxLength;
  const displayLanguage = settings.autoDetectLanguage ? detectedLanguage : settings.preferredLanguage;
  const isRTL = displayLanguage === 'ar';

  return (
    <div className={cn("border-t bg-white", className)}>
      {/* Settings indicators */}
      {(settings.includeCompanyDocs || settings.includeLaborLaw || detectedLanguage !== language) && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs">
            <span className={cn(
              "text-gray-500",
              isRTL ? 'font-arabic' : ''
            )}>
              {isRTL ? 'مصادر البحث:' : 'Search sources:'}
            </span>
            
            {settings.includeCompanyDocs && (
              <Badge variant="secondary" className="h-5 text-xs">
                <FileText className="w-3 h-3 mr-1" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'مستندات الشركة' : 'Company docs'}
                </span>
              </Badge>
            )}
            
            {settings.includeLaborLaw && (
              <Badge variant="secondary" className="h-5 text-xs">
                <Scale className="w-3 h-3 mr-1" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'نظام العمل' : 'Labor law'}
                </span>
              </Badge>
            )}
            
            {settings.autoDetectLanguage && detectedLanguage !== language && (
              <Badge variant="outline" className="h-5 text-xs">
                <Languages className="w-3 h-3 mr-1" />
                <span>
                  {detectedLanguage === 'ar' ? '🇸🇦 AR' : '🇺🇸 EN'}
                </span>
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Main input area */}
      <form ref={formRef} onSubmit={handleSubmit} className="p-4">
        <div className={cn(
          "flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-saudi-navy-300 transition-colors",
          isExpanded ? "items-start" : "items-end"
        )}>
          {/* File attachment button (placeholder) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="p-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
            disabled={disabled}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          
          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={getPlaceholder()}
              disabled={disabled}
              maxLength={maxLength}
              className={cn(
                "w-full bg-transparent border-none outline-none resize-none py-2 px-0",
                "placeholder:text-gray-400 text-gray-900",
                "min-h-[48px] max-h-[120px]",
                isRTL ? 'text-right font-arabic' : 'text-left',
                "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300"
              )}
              style={{
                direction: isRTL ? 'rtl' : 'ltr',
              }}
            />
            
            {/* Character counter */}
            {content.length > 0 && (
              <div className={cn(
                "absolute bottom-1 text-xs text-gray-400",
                isRTL ? 'left-1' : 'right-1'
              )}>
                <span className={cn(
                  charCount > maxLength * 0.9 ? 'text-orange-500' : '',
                  charCount >= maxLength ? 'text-red-500' : ''
                )}>
                  {charCount}
                </span>
                <span>/{maxLength}</span>
              </div>
            )}
          </div>
          
          {/* Voice input button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "p-2 flex-shrink-0 transition-colors",
              isRecording 
                ? voiceIsPaused
                  ? "text-orange-500 hover:text-orange-600 bg-orange-50"
                  : "text-red-500 hover:text-red-600 bg-red-50" 
                : settings.enableVoiceInput && voiceSupported
                  ? "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  : "text-gray-300 cursor-not-allowed"
            )}
            onClick={handleVoiceToggle}
            disabled={disabled || !settings.enableVoiceInput}
            title={
              !voiceSupported 
                ? (isRTL ? 'الإدخال الصوتي غير مدعوم' : 'Voice input not supported')
                : isRecording 
                  ? voiceIsPaused 
                    ? (isRTL ? 'متوقف - اضغط للاستكمال' : 'Paused - Click to resume')
                    : (isRTL ? 'يسجل - اضغط للإيقاف المؤقت' : 'Recording - Click to pause')
                  : (isRTL ? 'ابدأ التسجيل الصوتي' : 'Start voice recording')
            }
          >
            {isRecording ? 
              voiceIsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />
              : voiceSupported ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />
            }
          </Button>

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="p-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
                disabled={disabled}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className={cn(isRTL ? 'font-arabic' : '')}>
                {isRTL ? 'إعدادات الرسالة' : 'Message Settings'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Language settings */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'اللغة' : 'Language'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={settings.autoDetectLanguage}
                onCheckedChange={(checked) => updateSettings({ autoDetectLanguage: checked })}
              >
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'كشف اللغة تلقائياً' : 'Auto-detect language'}
                </span>
              </DropdownMenuCheckboxItem>
              
              {!settings.autoDetectLanguage && (
                <>
                  <DropdownMenuItem onClick={() => updateSettings({ preferredLanguage: 'ar' })}>
                    <div className="flex items-center gap-2">
                      <span>🇸🇦</span>
                      <span className="font-arabic">العربية</span>
                      {settings.preferredLanguage === 'ar' && <span className="ml-auto">✓</span>}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateSettings({ preferredLanguage: 'en' })}>
                    <div className="flex items-center gap-2">
                      <span>🇺🇸</span>
                      <span>English</span>
                      {settings.preferredLanguage === 'en' && <span className="ml-auto">✓</span>}
                    </div>
                  </DropdownMenuItem>
                </>
              )}
              
              <DropdownMenuSeparator />
              
              {/* Search sources */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'مصادر البحث' : 'Search Sources'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={settings.includeCompanyDocs}
                onCheckedChange={(checked) => updateSettings({ includeCompanyDocs: checked })}
              >
                <FileText className="w-4 h-4 mr-2" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'مستندات الشركة' : 'Company documents'}
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={settings.includeLaborLaw}
                onCheckedChange={(checked) => updateSettings({ includeLaborLaw: checked })}
              >
                <Scale className="w-4 h-4 mr-2" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'نظام العمل السعودي' : 'Saudi Labor Law'}
                </span>
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              
              {/* Max sources */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'عدد المصادر القصوى' : 'Max sources'}
                </span>
              </DropdownMenuLabel>
              {[5, 10, 15, 20].map(num => (
                <DropdownMenuItem
                  key={num}
                  onClick={() => updateSettings({ maxSources: num })}
                >
                  <span>{num}</span>
                  {settings.maxSources === num && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              {/* Voice Settings */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'إعدادات الصوت' : 'Voice Settings'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={settings.enableVoiceInput}
                onCheckedChange={(checked) => updateSettings({ enableVoiceInput: checked })}
                disabled={!voiceSupported}
              >
                <Mic className="w-4 h-4 mr-2" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'تفعيل الإدخال الصوتي' : 'Enable voice input'}
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={settings.enableVoiceCommands}
                onCheckedChange={(checked) => updateSettings({ enableVoiceCommands: checked })}
                disabled={!voiceSupported}
              >
                <Volume2 className="w-4 h-4 mr-2" />
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'تفعيل الأوامر الصوتية' : 'Enable voice commands'}
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={settings.voiceVisualization}
                onCheckedChange={(checked) => updateSettings({ voiceVisualization: checked })}
                disabled={!voiceSupported}
              >
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'إظهار المؤشر الصوتي' : 'Show voice visualization'}
                </span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              {/* Voice Quality Settings */}
              <DropdownMenuLabel className="text-xs text-gray-500">
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'جودة الصوت' : 'Audio Quality'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={voiceSettings.noiseReduction}
                onCheckedChange={(checked) => updateVoiceSettings({ noiseReduction: checked })}
                disabled={!voiceSupported}
              >
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'تقليل الضوضاء' : 'Noise reduction'}
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={voiceSettings.echoCancellation}
                onCheckedChange={(checked) => updateVoiceSettings({ echoCancellation: checked })}
                disabled={!voiceSupported}
              >
                <span className={cn(isRTL ? 'font-arabic' : '')}>
                  {isRTL ? 'إلغاء الصدى' : 'Echo cancellation'}
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Send/Stop button */}
          {isStreaming ? (
            <Button
              type="button"
              onClick={handleStopStreaming}
              size="sm"
              variant="destructive"
              className="p-2 flex-shrink-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!canSend}
              size="sm"
              className={cn(
                "p-2 flex-shrink-0 transition-all",
                canSend 
                  ? "bg-saudi-navy-700 hover:bg-saudi-navy-800 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Voice Recording Panel */}
        {showVoicePanel && isRecording && (
          <div className={cn(
            "mt-3 p-4 bg-gray-50 rounded-lg border",
            voiceError && "border-red-200 bg-red-50"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  voiceIsPaused ? "bg-orange-500" : "bg-red-500"
                )}>
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isRTL && "font-arabic"
                )}>
                  {voiceIsPaused
                    ? (isRTL ? 'التسجيل متوقف' : 'Recording paused')
                    : (isRTL ? 'جار التسجيل...' : 'Recording...')
                  }
                </span>
                <span className="text-sm text-gray-500 font-mono">
                  {Math.floor(voiceDuration / 60)}:{(voiceDuration % 60).toString().padStart(2, '0')}
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
            {settings.voiceVisualization && (
              <div className="mb-3 flex justify-center">
                <AudioVisualization
                  audioLevel={audioLevel}
                  isRecording={isRecording}
                  isPaused={voiceIsPaused}
                  variant="bars"
                  size="md"
                  showFrequency
                />
              </div>
            )}

            {/* Real-time Transcript */}
            {(voiceTranscript || realtimeTranscript) && (
              <div className={cn(
                "mb-3 p-2 bg-white rounded border text-sm",
                isRTL && "text-right font-arabic"
              )}>
                <p className="text-gray-700">
                  {voiceTranscript || realtimeTranscript}
                </p>
                {voiceConfidence && (
                  <p className="text-xs text-gray-500 mt-1">
                    {isRTL ? 'مستوى الثقة:' : 'Confidence:'} {Math.round(voiceConfidence * 100)}%
                  </p>
                )}
              </div>
            )}

            {/* Voice Error */}
            {voiceError && (
              <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-sm">
                <p className="text-red-700">
                  {isRTL && voiceError.messageAr ? voiceError.messageAr : voiceError.message}
                </p>
              </div>
            )}

            {/* Voice Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={handleVoiceToggle}
                variant={voiceIsPaused ? "default" : "secondary"}
                size="sm"
                disabled={voiceIsProcessing}
              >
                {voiceIsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className={cn("ml-1", isRTL && "font-arabic")}>
                  {voiceIsPaused 
                    ? (isRTL ? 'متابعة' : 'Resume')
                    : (isRTL ? 'إيقاف' : 'Pause')
                  }
                </span>
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
                <span className={cn("ml-1", isRTL && "font-arabic")}>
                  {voiceIsProcessing
                    ? (isRTL ? 'معالجة...' : 'Processing...')
                    : (isRTL ? 'إنهاء' : 'Stop')
                  }
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        {content.length === 0 && !showVoicePanel && (
          <div className="mt-2 text-xs text-gray-400 text-center">
            <span className={cn(isRTL ? 'font-arabic' : '')}>
              {isRTL 
                ? 'Enter للإرسال • Shift+Enter لسطر جديد • Ctrl+/ للإعدادات'
                : 'Enter to send • Shift+Enter for new line • Ctrl+/ for settings'
              }
            </span>
          </div>
        )}
      </form>
    </div>
  );
}