'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  VoiceSettings,
  VoiceError,
  TextToSpeechOptions,
  BrowserVoice,
  VoiceQueueItem,
} from '@/types/voice';

interface UseTextToSpeechOptions {
  settings: VoiceSettings;
  onStart?: (text: string) => void;
  onEnd?: (text: string) => void;
  onError?: (error: VoiceError) => void;
  maxQueueSize?: number;
}

interface TextToSpeechState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentText?: string;
  availableVoices: BrowserVoice[];
  selectedVoice?: BrowserVoice;
  queue: VoiceQueueItem[];
  error?: VoiceError;
}

export function useTextToSpeech({
  settings,
  onStart,
  onEnd,
  onError,
  maxQueueSize = 10,
}: UseTextToSpeechOptions) {
  const [state, setState] = useState<TextToSpeechState>({
    isSpeaking: false,
    isPaused: false,
    availableVoices: [],
    queue: [],
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support
  const isSupported = useCallback(() => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }, []);

  // Create error helper
  const createError = useCallback((
    type: VoiceError['type'],
    code: string,
    message: string,
    messageAr?: string,
    details?: Record<string, any>
  ): VoiceError => {
    return { type, code, message, messageAr, details };
  }, []);

  // Load available voices
  const loadVoices = useCallback(() => {
    if (!isSupported()) return;

    const voices = speechSynthesis.getVoices();
    const mappedVoices: BrowserVoice[] = voices.map(voice => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
    }));

    setState(prev => ({ ...prev, availableVoices: mappedVoices }));

    // Auto-select best voice for current language
    if (!state.selectedVoice) {
      selectBestVoice(settings.language, mappedVoices);
    }
  }, [isSupported, state.selectedVoice, settings.language]);

  // Select best voice for language
  const selectBestVoice = useCallback((language: 'ar' | 'en', voices?: BrowserVoice[]) => {
    const voiceList = voices || state.availableVoices;
    
    // Preferred voice patterns for Arabic
    const arabicVoicePatterns = [
      /arabic/i,
      /ar[-_]sa/i, // Saudi Arabic
      /ar[-_]ae/i, // UAE Arabic
      /ar[-_]eg/i, // Egyptian Arabic
      /microsoft.*ar/i,
      /google.*ar/i,
      /apple.*ar/i,
      /^ar/i,
    ];

    // Preferred voice patterns for English
    const englishVoicePatterns = [
      /en[-_]us/i, // US English
      /en[-_]gb/i, // British English
      /microsoft.*en/i,
      /google.*en/i,
      /apple.*en/i,
      /^en/i,
    ];

    const patterns = language === 'ar' ? arabicVoicePatterns : englishVoicePatterns;
    
    // Find best matching voice
    let selectedVoice: BrowserVoice | undefined;
    
    for (const pattern of patterns) {
      selectedVoice = voiceList.find(voice => 
        pattern.test(voice.name) || pattern.test(voice.lang)
      );
      if (selectedVoice) break;
    }

    // Fallback to any voice of the target language
    if (!selectedVoice) {
      selectedVoice = voiceList.find(voice => 
        voice.lang.startsWith(language)
      );
    }

    // Final fallback to default voice
    if (!selectedVoice) {
      selectedVoice = voiceList.find(voice => voice.default) || voiceList[0];
    }

    if (selectedVoice) {
      setState(prev => ({ ...prev, selectedVoice }));
    }
  }, [state.availableVoices]);

  // Set specific voice
  const setVoice = useCallback((voiceURI: string) => {
    const voice = state.availableVoices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      setState(prev => ({ ...prev, selectedVoice: voice }));
    }
  }, [state.availableVoices]);

  // Get SSML enhanced text for better pronunciation
  const enhanceTextForArabic = useCallback((text: string): string => {
    if (settings.language !== 'ar') return text;

    // Add pauses for better flow
    let enhancedText = text
      .replace(/\./g, '.<break time="0.5s"/>')
      .replace(/\?/g, '?<break time="0.7s"/>')
      .replace(/!/g, '!<break time="0.7s"/>')
      .replace(/،/g, '،<break time="0.3s"/>')
      .replace(/؛/g, '؛<break time="0.5s"/>');

    // Add emphasis to common Arabic words
    const emphasisWords = ['مهم', 'ضروري', 'يجب', 'لا يجوز', 'ممنوع', 'مطلوب'];
    emphasisWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      enhancedText = enhancedText.replace(regex, `<emphasis level="strong">${word}</emphasis>`);
    });

    return enhancedText;
  }, [settings.language]);

  // Create speech utterance
  const createUtterance = useCallback((options: TextToSpeechOptions): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance();
    
    // Enhance text for Arabic
    utterance.text = enhanceTextForArabic(options.text);
    utterance.lang = options.language === 'ar' 
      ? (settings.dialect || 'ar-SA')
      : (settings.dialect || 'en-US');
    
    // Voice selection
    if (options.voice) {
      const voice = speechSynthesis.getVoices().find(v => 
        v.voiceURI === options.voice || v.name === options.voice
      );
      if (voice) utterance.voice = voice;
    } else if (state.selectedVoice) {
      const voice = speechSynthesis.getVoices().find(v => 
        v.voiceURI === state.selectedVoice?.voiceURI
      );
      if (voice) utterance.voice = voice;
    }

    // Speech parameters
    utterance.rate = options.rate || settings.rate;
    utterance.pitch = options.pitch || settings.pitch;
    utterance.volume = options.volume || settings.volume;

    return utterance;
  }, [enhanceTextForArabic, settings, state.selectedVoice]);

  // Process queue
  const processQueue = useCallback(() => {
    if (state.isSpeaking || state.queue.length === 0) return;

    const nextItem = state.queue.find(item => item.status === 'pending');
    if (!nextItem) return;

    setState(prev => ({
      ...prev,
      queue: prev.queue.map(item =>
        item.id === nextItem.id ? { ...item, status: 'speaking' } : item
      ),
    }));

    const utterance = createUtterance(nextItem.options);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setState(prev => ({ 
        ...prev, 
        isSpeaking: true, 
        currentText: nextItem.text 
      }));
      onStart?.(nextItem.text);
    };

    utterance.onend = () => {
      setState(prev => ({
        ...prev,
        isSpeaking: false,
        isPaused: false,
        currentText: undefined,
        queue: prev.queue.filter(item => item.id !== nextItem.id),
      }));
      
      onEnd?.(nextItem.text);
      
      // Process next item in queue with delay
      queueTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, 100);
    };

    utterance.onerror = (event) => {
      const error = createError(
        'processing',
        'tts_synthesis_error',
        `Text-to-speech error: ${event.error}`,
        `خطأ في تحويل النص إلى كلام: ${event.error}`,
        { event, text: nextItem.text }
      );

      setState(prev => ({
        ...prev,
        isSpeaking: false,
        isPaused: false,
        currentText: undefined,
        error,
        queue: prev.queue.map(item =>
          item.id === nextItem.id ? { ...item, status: 'error' } : item
        ),
      }));

      onError?.(error);

      // Continue with next item
      queueTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, 100);
    };

    speechSynthesis.speak(utterance);
  }, [state.isSpeaking, state.queue, createUtterance, onStart, onEnd, onError, createError]);

  // Add to queue
  const addToQueue = useCallback((
    text: string, 
    options: Partial<TextToSpeechOptions> = {}, 
    priority: VoiceQueueItem['priority'] = 'normal'
  ) => {
    if (!isSupported()) {
      const error = createError(
        'unsupported',
        'tts_not_supported',
        'Text-to-speech is not supported in this browser',
        'تحويل النص إلى كلام غير مدعوم في هذا المتصفح'
      );
      onError?.(error);
      return;
    }

    if (state.queue.length >= maxQueueSize) {
      const error = createError(
        'processing',
        'queue_full',
        'Voice queue is full. Please wait for current speech to finish.',
        'قائمة انتظار الصوت ممتلئة. يرجى انتظار انتهاء الكلام الحالي.'
      );
      onError?.(error);
      return;
    }

    const queueItem: VoiceQueueItem = {
      id: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      options: {
        language: options.language || settings.language,
        voice: options.voice,
        rate: options.rate || settings.rate,
        pitch: options.pitch || settings.pitch,
        volume: options.volume || settings.volume,
        text: text.trim(),
      },
      priority,
      timestamp: Date.now(),
      status: 'pending',
    };

    setState(prev => {
      const newQueue = [...prev.queue, queueItem];
      
      // Sort by priority (high -> normal -> low) and timestamp
      newQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.timestamp - b.timestamp;
      });
      
      return { ...prev, queue: newQueue };
    });

    // Start processing if not already speaking
    if (!state.isSpeaking) {
      setTimeout(processQueue, 50);
    }
  }, [
    isSupported,
    state.queue.length,
    state.isSpeaking,
    maxQueueSize,
    settings,
    processQueue,
    createError,
    onError
  ]);

  // Speak immediately (clears queue)
  const speak = useCallback((
    text: string, 
    options: Partial<TextToSpeechOptions> = {}
  ) => {
    if (!isSupported()) {
      const error = createError(
        'unsupported',
        'tts_not_supported',
        'Text-to-speech is not supported in this browser',
        'تحويل النص إلى كلام غير مدعوم في هذا المتصفح'
      );
      onError?.(error);
      return;
    }

    // Stop current speech and clear queue
    stop();
    
    // Add with high priority
    addToQueue(text, options, 'high');
  }, [isSupported, addToQueue, createError, onError]);

  // Pause speech
  const pause = useCallback(() => {
    if (!state.isSpeaking || state.isPaused) return;
    
    speechSynthesis.pause();
    setState(prev => ({ ...prev, isPaused: true }));
  }, [state.isSpeaking, state.isPaused]);

  // Resume speech
  const resume = useCallback(() => {
    if (!state.isPaused) return;
    
    speechSynthesis.resume();
    setState(prev => ({ ...prev, isPaused: false }));
  }, [state.isPaused]);

  // Stop speech and clear queue
  const stop = useCallback(() => {
    speechSynthesis.cancel();
    
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isSpeaking: false,
      isPaused: false,
      currentText: undefined,
      queue: [],
    }));
  }, []);

  // Clear queue without stopping current speech
  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(item => item.status === 'speaking'),
    }));
  }, []);

  // Get voices for language
  const getVoicesForLanguage = useCallback((language: 'ar' | 'en'): BrowserVoice[] => {
    return state.availableVoices.filter(voice => 
      voice.lang.toLowerCase().startsWith(language.toLowerCase())
    );
  }, [state.availableVoices]);

  // Initialize voices
  useEffect(() => {
    if (!isSupported()) return;

    loadVoices();

    // Voices might not be immediately available
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback polling for voices
    const voiceCheckInterval = setInterval(() => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        loadVoices();
        clearInterval(voiceCheckInterval);
      }
    }, 100);

    // Cleanup after 5 seconds
    setTimeout(() => {
      clearInterval(voiceCheckInterval);
    }, 5000);

    return () => {
      clearInterval(voiceCheckInterval);
      stop();
    };
  }, [isSupported, loadVoices, stop]);

  // Auto-process queue
  useEffect(() => {
    if (!state.isSpeaking && state.queue.length > 0) {
      const timer = setTimeout(processQueue, 100);
      return () => clearTimeout(timer);
    }
  }, [state.isSpeaking, state.queue.length, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
      }
    };
  }, [stop]);

  return {
    ...state,
    speak,
    addToQueue,
    pause,
    resume,
    stop,
    clearQueue,
    setVoice,
    selectBestVoice,
    getVoicesForLanguage,
    isSupported: isSupported(),
    canSpeak: isSupported() && state.availableVoices.length > 0,
  };
}

export default useTextToSpeech;