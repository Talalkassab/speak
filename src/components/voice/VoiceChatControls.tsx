'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
  Send,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';
import { VoiceSettings, VoiceError, SpeechToTextResult } from '@/types/voice';
import { AudioVisualization } from './AudioVisualization';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import useTextToSpeech from '@/hooks/useTextToSpeech';
import { voiceCommandService } from '@/libs/services/voice-command-service';

interface VoiceChatControlsProps {
  onTranscript?: (transcript: string, confidence: number) => void;
  onVoiceCommand?: (command: string, parameters?: string[]) => void;
  onError?: (error: VoiceError) => void;
  language?: 'ar' | 'en';
  disabled?: boolean;
  className?: string;
  showVisualization?: boolean;
  showTranscript?: boolean;
  maxRecordingDuration?: number; // seconds
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

export function VoiceChatControls({
  onTranscript,
  onVoiceCommand,
  onError,
  language = 'ar',
  disabled = false,
  className,
  showVisualization = true,
  showTranscript = true,
  maxRecordingDuration = 300,
}: VoiceChatControlsProps) {
  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
    language,
  });
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [processingCommand, setProcessingCommand] = useState(false);

  // Voice recording hook
  const {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    audioLevel,
    error: recordingError,
    transcript,
    confidence,
    audioData,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    isSupported: recordingSupported,
    hasWhisperFallback,
  } = useVoiceRecording({
    settings,
    onTranscript: handleTranscriptResult,
    onError: handleVoiceError,
    maxDuration: maxRecordingDuration,
  });

  // Text-to-speech hook
  const {
    isSpeaking,
    isPaused: ttsIsPaused,
    availableVoices,
    selectedVoice,
    speak,
    pause: pauseTTS,
    resume: resumeTTS,
    stop: stopTTS,
    setVoice,
    isSupported: ttsSupported,
  } = useTextToSpeech({
    settings,
    onError: handleVoiceError,
  });

  // Handle transcript results
  function handleTranscriptResult(result: SpeechToTextResult) {
    setCurrentTranscript(result.transcript);
    
    if (result.isFinal && result.transcript.trim()) {
      onTranscript?.(result.transcript, result.confidence);
      
      // Check for voice commands
      checkForVoiceCommands(result.transcript);
    }
  }

  // Check for voice commands in transcript
  const checkForVoiceCommands = useCallback(async (text: string) => {
    setProcessingCommand(true);
    
    try {
      const commandResult = voiceCommandService.recognizeCommand(text, settings.language);
      
      if (commandResult.recognized && commandResult.command) {
        onVoiceCommand?.(commandResult.command.command, commandResult.parameters);
        
        // Provide voice feedback
        const feedback = settings.language === 'ar' 
          ? `تم تنفيذ الأمر: ${commandResult.command.descriptionAr}`
          : `Command executed: ${commandResult.command.description}`;
          
        speak(feedback, { language: settings.language });
      } else if (commandResult.suggestion) {
        // Suggest similar command
        const suggestion = settings.language === 'ar'
          ? `لم يتم التعرف على الأمر. هل تقصد: ${commandResult.suggestionAr}`
          : `Command not recognized. Did you mean: ${commandResult.suggestion}`;
          
        speak(suggestion, { language: settings.language });
      }
    } catch (error) {
      console.error('Command processing failed:', error);
    } finally {
      setProcessingCommand(false);
    }
  }, [settings.language, onVoiceCommand, speak]);

  // Handle voice errors
  function handleVoiceError(error: VoiceError) {
    console.error('Voice error:', error);
    onError?.(error);
    
    // Provide voice feedback for errors
    const errorMessage = settings.language === 'ar' && error.messageAr 
      ? error.messageAr 
      : error.message;
    
    if (ttsSupported) {
      speak(errorMessage, { language: settings.language });
    }
  }

  // Format duration for display
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle recording controls
  const handleRecordingToggle = useCallback(async () => {
    if (isRecording) {
      if (isPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    } else {
      await startRecording();
    }
  }, [isRecording, isPaused, startRecording, pauseRecording, resumeRecording]);

  const handleStopRecording = useCallback(async () => {
    const audioBlob = await stopRecording();
    if (audioBlob && currentTranscript.trim()) {
      // Audio and transcript are ready
      setCurrentTranscript('');
    }
  }, [stopRecording, currentTranscript]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setCurrentTranscript('');
  }, [cancelRecording]);

  // Handle TTS controls
  const handleTTSToggle = useCallback(() => {
    if (isSpeaking) {
      if (ttsIsPaused) {
        resumeTTS();
      } else {
        pauseTTS();
      }
    }
  }, [isSpeaking, ttsIsPaused, pauseTTS, resumeTTS]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Listen for voice commands from the service
  useEffect(() => {
    const handleVoiceCommand = (event: CustomEvent) => {
      const { action, ...params } = event.detail;
      
      switch (action) {
        case 'start_recording':
          if (!isRecording) startRecording();
          break;
        case 'stop_recording':
          if (isRecording) handleStopRecording();
          break;
        case 'pause':
          if (isRecording && !isPaused) pauseRecording();
          else if (isSpeaking && !ttsIsPaused) pauseTTS();
          break;
        case 'continue':
          if (isRecording && isPaused) resumeRecording();
          else if (isSpeaking && ttsIsPaused) resumeTTS();
          break;
        case 'repeat':
          if (currentTranscript) {
            speak(currentTranscript, { language: settings.language });
          }
          break;
        default:
          onVoiceCommand?.(action, Object.values(params));
      }
    };

    window.addEventListener('voice-command', handleVoiceCommand as EventListener);
    
    return () => {
      window.removeEventListener('voice-command', handleVoiceCommand as EventListener);
    };
  }, [
    isRecording, isPaused, isSpeaking, ttsIsPaused, currentTranscript,
    startRecording, handleStopRecording, pauseRecording, resumeRecording,
    pauseTTS, resumeTTS, speak, settings.language, onVoiceCommand
  ]);

  const isRTL = settings.language === 'ar';
  const hasError = recordingError;
  const canRecord = recordingSupported || hasWhisperFallback;

  return (
    <div className={cn(
      'flex flex-col gap-4 p-4 bg-white border rounded-lg shadow-sm',
      isRTL && 'text-right',
      className
    )}>
      {/* Status and Duration */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRecording && (
            <Badge variant={isPaused ? 'secondary' : 'destructive'} className="animate-pulse">
              {isPaused ? (
                settings.language === 'ar' ? 'متوقف' : 'Paused'
              ) : (
                settings.language === 'ar' ? 'يسجل' : 'Recording'
              )}
            </Badge>
          )}
          
          {isSpeaking && (
            <Badge variant="default" className="animate-pulse">
              {ttsIsPaused ? (
                settings.language === 'ar' ? 'متوقف' : 'Paused'
              ) : (
                settings.language === 'ar' ? 'يتحدث' : 'Speaking'
              )}
            </Badge>
          )}
          
          {processingCommand && (
            <Badge variant="outline">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {settings.language === 'ar' ? 'معالجة الأمر...' : 'Processing...'}
            </Badge>
          )}
        </div>

        <div className="text-sm text-gray-500 font-mono">
          {isRecording && `${formatDuration(duration)} / ${formatDuration(maxRecordingDuration)}`}
        </div>
      </div>

      {/* Audio Visualization */}
      {showVisualization && (
        <AudioVisualization
          audioLevel={audioLevel}
          isRecording={isRecording}
          isPaused={isPaused}
          variant="bars"
          size="md"
          showFrequency
          className="mx-auto"
        />
      )}

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-2">
        {/* Record/Pause Button */}
        <Button
          onClick={handleRecordingToggle}
          disabled={disabled || !canRecord}
          size="lg"
          variant={isRecording ? (isPaused ? 'secondary' : 'destructive') : 'default'}
          className={cn(
            'w-14 h-14 rounded-full transition-all duration-200',
            isRecording && !isPaused && 'animate-pulse',
          )}
        >
          {isRecording ? (
            isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>

        {/* Stop Recording */}
        {isRecording && (
          <Button
            onClick={handleStopRecording}
            variant="outline"
            size="lg"
            className="w-14 h-14 rounded-full"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Square className="w-6 h-6" />
            )}
          </Button>
        )}

        {/* Cancel Recording */}
        {isRecording && (
          <Button
            onClick={handleCancelRecording}
            variant="ghost"
            size="lg"
            className="w-14 h-14 rounded-full"
          >
            <Trash2 className="w-6 h-6" />
          </Button>
        )}

        {/* TTS Controls */}
        {isSpeaking && (
          <Button
            onClick={handleTTSToggle}
            variant="outline"
            size="lg"
            className="w-14 h-14 rounded-full"
          >
            {ttsIsPaused ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </Button>
        )}

        {/* Stop TTS */}
        {isSpeaking && (
          <Button
            onClick={stopTTS}
            variant="ghost"
            size="lg"
            className="w-14 h-14 rounded-full"
          >
            <Square className="w-6 h-6" />
          </Button>
        )}

        {/* Send Transcript (if available) */}
        {currentTranscript.trim() && !isRecording && (
          <Button
            onClick={() => {
              onTranscript?.(currentTranscript, confidence || 0.8);
              setCurrentTranscript('');
            }}
            variant="default"
            size="lg"
            className="w-14 h-14 rounded-full bg-saudi-navy-600 hover:bg-saudi-navy-700"
          >
            <Send className="w-6 h-6" />
          </Button>
        )}

        {/* Settings */}
        <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="lg"
              className="w-14 h-14 rounded-full"
            >
              <Settings className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className={cn(isRTL && 'font-arabic')}>
              {settings.language === 'ar' ? 'إعدادات الصوت' : 'Voice Settings'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Language Settings */}
            <DropdownMenuLabel className="text-xs text-gray-500">
              {settings.language === 'ar' ? 'اللغة' : 'Language'}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={settings.autoDetectLanguage}
              onCheckedChange={(checked) => updateSettings({ autoDetectLanguage: checked })}
            >
              {settings.language === 'ar' ? 'كشف اللغة تلقائياً' : 'Auto-detect language'}
            </DropdownMenuCheckboxItem>

            <DropdownMenuItem onClick={() => updateSettings({ language: 'ar' })}>
              🇸🇦 العربية {settings.language === 'ar' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateSettings({ language: 'en' })}>
              🇺🇸 English {settings.language === 'en' && '✓'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Audio Enhancement */}
            <DropdownMenuLabel className="text-xs text-gray-500">
              {settings.language === 'ar' ? 'تحسين الصوت' : 'Audio Enhancement'}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={settings.noiseReduction}
              onCheckedChange={(checked) => updateSettings({ noiseReduction: checked })}
            >
              {settings.language === 'ar' ? 'تقليل الضوضاء' : 'Noise reduction'}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.echoCancellation}
              onCheckedChange={(checked) => updateSettings({ echoCancellation: checked })}
            >
              {settings.language === 'ar' ? 'إلغاء الصدى' : 'Echo cancellation'}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.autoGainControl}
              onCheckedChange={(checked) => updateSettings({ autoGainControl: checked })}
            >
              {settings.language === 'ar' ? 'التحكم التلقائي في المستوى' : 'Auto gain control'}
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

            {/* TTS Settings */}
            <DropdownMenuLabel className="text-xs text-gray-500">
              {settings.language === 'ar' ? 'إعدادات النطق' : 'Speech Settings'}
            </DropdownMenuLabel>
            <DropdownMenuItem>
              <div className="flex items-center justify-between w-full">
                <span>{settings.language === 'ar' ? 'السرعة' : 'Speed'}</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.rate}
                  onChange={(e) => updateSettings({ rate: parseFloat(e.target.value) })}
                  className="w-20"
                />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center justify-between w-full">
                <span>{settings.language === 'ar' ? 'النبرة' : 'Pitch'}</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.pitch}
                  onChange={(e) => updateSettings({ pitch: parseFloat(e.target.value) })}
                  className="w-20"
                />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center justify-between w-full">
                <span>{settings.language === 'ar' ? 'الصوت' : 'Volume'}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
                  className="w-20"
                />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Current Transcript */}
      {showTranscript && currentTranscript.trim() && (
        <div className={cn(
          'p-3 bg-gray-50 rounded-lg border text-sm',
          isRTL && 'text-right font-arabic'
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-gray-700">{currentTranscript}</p>
              {confidence && (
                <p className="text-xs text-gray-500 mt-1">
                  {settings.language === 'ar' ? 'مستوى الثقة:' : 'Confidence:'} {Math.round(confidence * 100)}%
                </p>
              )}
            </div>
            <Button
              onClick={() => setCurrentTranscript('')}
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {hasError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 font-medium">
              {settings.language === 'ar' && hasError.messageAr 
                ? hasError.messageAr 
                : hasError.message
              }
            </p>
            {hasError.details && (
              <p className="text-red-600 text-sm mt-1">{hasError.details}</p>
            )}
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Support Status */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          {recordingSupported ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span>
            {settings.language === 'ar' ? 'التسجيل:' : 'Recording:'} 
            {recordingSupported ? 
              (settings.language === 'ar' ? 'مدعوم' : 'Supported') : 
              (settings.language === 'ar' ? 'غير مدعوم' : 'Not supported')
            }
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {ttsSupported ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span>
            {settings.language === 'ar' ? 'النطق:' : 'Speech:'} 
            {ttsSupported ? 
              (settings.language === 'ar' ? 'مدعوم' : 'Supported') : 
              (settings.language === 'ar' ? 'غير مدعوم' : 'Not supported')
            }
          </span>
        </div>

        {hasWhisperFallback && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span>
              {settings.language === 'ar' ? 'Whisper API' : 'Whisper API'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChatControls;