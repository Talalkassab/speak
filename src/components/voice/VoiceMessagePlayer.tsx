'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  SkipBack,
  SkipForward,
  Download,
  Share2,
  MoreHorizontal,
  Copy,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';
import { VoiceMessage } from '@/types/voice';
import { AudioVisualization } from './AudioVisualization';
import useTextToSpeech from '@/hooks/useTextToSpeech';

interface VoiceMessagePlayerProps {
  message: VoiceMessage;
  language?: 'ar' | 'en';
  showTranscript?: boolean;
  showWaveform?: boolean;
  autoPlay?: boolean;
  onDelete?: (messageId: string) => void;
  onShare?: (message: VoiceMessage) => void;
  className?: string;
}

export function VoiceMessagePlayer({
  message,
  language = 'ar',
  showTranscript = true,
  showWaveform = false,
  autoPlay = false,
  onDelete,
  onShare,
  className,
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Text-to-speech for transcript reading
  const { speak, isSpeaking, stop: stopTTS } = useTextToSpeech({
    settings: {
      language,
      rate: 1.0,
      pitch: 1.0,
      volume: 0.8,
      autoDetectLanguage: false,
      noiseReduction: false,
      echoCancellation: false,
      autoGainControl: false,
    }
  });

  // Initialize audio element
  useEffect(() => {
    if (message.audioUrl || message.audioBlob) {
      const audio = new Audio();
      
      if (message.audioUrl) {
        audio.src = message.audioUrl;
      } else if (message.audioBlob) {
        audio.src = URL.createObjectURL(message.audioBlob);
      }

      audio.preload = 'metadata';
      audioRef.current = audio;

      // Setup audio context for visualization
      if (showWaveform) {
        setupAudioContext();
      }

      // Event listeners
      audio.addEventListener('loadedmetadata', () => {
        // Audio is ready
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });

      audio.addEventListener('play', () => {
        setIsPlaying(true);
        if (showWaveform) {
          updateAudioLevel();
        }
      });

      audio.addEventListener('pause', () => {
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });

      // Auto-play if requested
      if (autoPlay) {
        audio.play().catch(console.error);
      }

      return () => {
        if (audio.src && message.audioBlob) {
          URL.revokeObjectURL(audio.src);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    }
  }, [message.audioUrl, message.audioBlob, autoPlay, showWaveform]);

  // Setup audio context for waveform visualization
  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Failed to setup audio context:', error);
    }
  }, []);

  // Update audio level for visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    
    setAudioLevel(normalizedLevel);
    
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isPlaying]);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Resume audio context if suspended (required by some browsers)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audio.play().catch(console.error);
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setVolume(newVolume);
    audio.volume = newVolume;
  }, []);

  const handleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.muted = newMuted;
  }, [isMuted]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackRate(rate);
    audio.playbackRate = rate;
  }, []);

  const handleSkipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, audio.currentTime - 10);
    handleSeek(newTime);
  }, [handleSeek]);

  const handleSkipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.min(message.duration, audio.currentTime + 10);
    handleSeek(newTime);
  }, [handleSeek, message.duration]);

  // Read transcript using TTS
  const handleReadTranscript = useCallback(() => {
    if (isSpeaking) {
      stopTTS();
    } else {
      speak(message.transcript, { language: message.language });
    }
  }, [message.transcript, message.language, speak, isSpeaking, stopTTS]);

  // Copy transcript to clipboard
  const handleCopyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.transcript);
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy transcript:', error);
    }
  }, [message.transcript]);

  // Download audio file
  const handleDownload = useCallback(() => {
    if (message.audioUrl) {
      const link = document.createElement('a');
      link.href = message.audioUrl;
      link.download = `voice_message_${message.id}.${message.audioUrl.split('.').pop() || 'webm'}`;
      link.click();
    } else if (message.audioBlob) {
      const url = URL.createObjectURL(message.audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voice_message_${message.id}.webm`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [message]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isRTL = language === 'ar';
  const progress = message.duration > 0 ? (currentTime / message.duration) * 100 : 0;

  return (
    <div className={cn(
      'flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border',
      isRTL && 'text-right',
      className
    )}>
      {/* Waveform Visualization */}
      {showWaveform && (
        <AudioVisualization
          audioLevel={audioLevel}
          isRecording={false}
          isPaused={!isPlaying}
          variant="waveform"
          size="md"
          className="mx-auto"
        />
      )}

      {/* Main Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <Button
          onClick={handlePlayPause}
          size="lg"
          variant="default"
          className="w-12 h-12 rounded-full bg-saudi-navy-600 hover:bg-saudi-navy-700"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>

        {/* Progress Bar and Time */}
        <div className="flex-1">
          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-saudi-navy-600 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            {/* Clickable overlay for seeking */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                const seekTime = percentage * message.duration;
                handleSeek(seekTime);
              }}
            />
          </div>
          
          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(message.duration)}</span>
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center gap-1">
          {/* Skip Backward */}
          <Button
            onClick={handleSkipBackward}
            variant="ghost"
            size="sm"
            className="w-8 h-8"
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          {/* Skip Forward */}
          <Button
            onClick={handleSkipForward}
            variant="ghost"
            size="sm"
            className="w-8 h-8"
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          {/* Stop */}
          <Button
            onClick={handleStop}
            variant="ghost"
            size="sm"
            className="w-8 h-8"
          >
            <Square className="w-4 h-4" />
          </Button>

          {/* Volume */}
          <Button
            onClick={handleMute}
            variant="ghost"
            size="sm"
            className="w-8 h-8"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Playback Speed */}
              <DropdownMenuItem
                className="flex items-center justify-between"
                onClick={(e) => e.preventDefault()}
              >
                <span>{language === 'ar' ? 'السرعة' : 'Speed'}</span>
                <select
                  value={playbackRate}
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                  className="ml-2 text-xs"
                >
                  <option value={0.5}>0.5×</option>
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                </select>
              </DropdownMenuItem>

              {/* Volume Slider */}
              <DropdownMenuItem
                className="flex items-center justify-between"
                onClick={(e) => e.preventDefault()}
              >
                <span>{language === 'ar' ? 'الصوت' : 'Volume'}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="ml-2 w-16"
                />
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Read Transcript */}
              {showTranscript && (
                <DropdownMenuItem onClick={handleReadTranscript}>
                  <Volume2 className="w-4 h-4 mr-2" />
                  {isSpeaking 
                    ? (language === 'ar' ? 'إيقاف القراءة' : 'Stop Reading')
                    : (language === 'ar' ? 'اقرأ النص' : 'Read Text')
                  }
                </DropdownMenuItem>
              )}

              {/* Copy Transcript */}
              {showTranscript && (
                <DropdownMenuItem onClick={handleCopyTranscript}>
                  <Copy className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'نسخ النص' : 'Copy Text'}
                </DropdownMenuItem>
              )}

              {/* Download */}
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {language === 'ar' ? 'تحميل' : 'Download'}
              </DropdownMenuItem>

              {/* Share */}
              {onShare && (
                <DropdownMenuItem onClick={() => onShare(message)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'مشاركة' : 'Share'}
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Delete */}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(message.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Transcript */}
      {showTranscript && message.transcript && (
        <div className={cn(
          'p-3 bg-white rounded border text-sm',
          isRTL && 'text-right font-arabic'
        )}>
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 text-gray-700">{message.transcript}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {message.confidence && (
                <span className="text-xs text-gray-500">
                  {Math.round(message.confidence * 100)}%
                </span>
              )}
              <Button
                onClick={handleReadTranscript}
                variant="ghost"
                size="sm"
                className={cn(
                  'w-6 h-6 p-0',
                  isSpeaking && 'text-saudi-navy-600'
                )}
              >
                <Volume2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>
            {language === 'ar' ? 'مدة:' : 'Duration:'} {formatTime(message.duration)}
          </span>
          <span>•</span>
          <span>
            {language === 'ar' ? 'اللغة:' : 'Language:'} {message.language.toUpperCase()}
          </span>
        </div>
        <div>
          {new Date(message.timestamp).toLocaleString(
            language === 'ar' ? 'ar-SA' : 'en-US',
            {
              timeStyle: 'short',
              dateStyle: 'short',
            }
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceMessagePlayer;