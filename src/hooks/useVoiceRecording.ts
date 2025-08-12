'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import RecordRTC from 'recordrtc';
import {
  VoiceRecordingState,
  VoiceError,
  VoiceSettings,
  SpeechToTextResult,
  WhisperTranscriptionRequest,
  WhisperTranscriptionResponse,
} from '@/types/voice';

interface UseVoiceRecordingOptions {
  settings: VoiceSettings;
  onTranscript?: (result: SpeechToTextResult) => void;
  onError?: (error: VoiceError) => void;
  maxDuration?: number; // seconds
  silenceTimeout?: number; // ms
}

export function useVoiceRecording({
  settings,
  onTranscript,
  onError,
  maxDuration = 300, // 5 minutes
  silenceTimeout = 3000, // 3 seconds
}: UseVoiceRecordingOptions) {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    isProcessing: false,
    duration: 0,
    audioLevel: 0,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check browser support
  const isSpeechRecognitionSupported = useCallback(() => {
    return typeof window !== 'undefined' && 
           ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  // Get media constraints based on settings
  const getMediaConstraints = useCallback((): MediaStreamConstraints => {
    return {
      audio: {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseReduction,
        autoGainControl: settings.autoGainControl,
        sampleRate: 16000, // Optimal for speech recognition
        channelCount: 1,
      }
    };
  }, [settings]);

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

  // Setup audio level monitoring
  const setupAudioMonitoring = useCallback((stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && state.isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);
          
          setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
          
          // Check for silence
          if (normalizedLevel < 0.01 && silenceTimeout > 0) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                if (state.isRecording && !state.isPaused) {
                  stopRecording();
                }
              }, silenceTimeout);
            }
          } else {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
          
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Error setting up audio monitoring:', error);
    }
  }, [state.isRecording, state.isPaused, silenceTimeout]);

  // Setup Web Speech API
  const setupSpeechRecognition = useCallback((stream: MediaStream) => {
    if (!isSpeechRecognitionSupported()) return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    if (recognitionRef.current) {
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = settings.dialect || (settings.language === 'ar' ? 'ar-SA' : 'en-US');
      
      recognitionRef.current.onresult = (event) => {
        const results = Array.from(event.results);
        const latest = results[results.length - 1];
        
        if (latest) {
          const transcript = latest[0].transcript;
          const confidence = latest[0].confidence || 0.5;
          const isFinal = latest.isFinal;
          
          const result: SpeechToTextResult = {
            transcript,
            confidence,
            language: settings.language,
            isFinal,
            timestamp: Date.now(),
            alternatives: Array.from(latest).map(alt => ({
              transcript: alt.transcript,
              confidence: alt.confidence || 0.5,
            })).slice(1, 3), // Top 2 alternatives
          };
          
          setState(prev => ({ 
            ...prev, 
            transcript: transcript,
            confidence: confidence 
          }));
          
          onTranscript?.(result);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        const error = createError(
          'processing',
          `speech_recognition_${event.error}`,
          `Speech recognition error: ${event.error}`,
          `خطأ في التعرف على الكلام: ${event.error}`
        );
        
        setState(prev => ({ ...prev, error }));
        onError?.(error);
      };
      
      recognitionRef.current.onend = () => {
        // Auto-restart if still recording
        if (state.isRecording && !state.isPaused && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.log('Recognition restart failed:', error);
          }
        }
      };
    }
  }, [isSpeechRecognitionSupported, settings, state.isRecording, state.isPaused, onTranscript, onError, createError]);

  // Process with Whisper API fallback
  const processWithWhisper = useCallback(async (audioBlob: Blob): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', settings.language === 'ar' ? 'ar' : 'en');
      formData.append('response_format', 'verbose_json');
      
      const response = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }
      
      const result: WhisperTranscriptionResponse = await response.json();
      
      setState(prev => ({
        ...prev,
        transcript: result.text,
        confidence: 0.8, // Whisper doesn't provide confidence, use default
        isProcessing: false,
      }));
      
      const speechResult: SpeechToTextResult = {
        transcript: result.text,
        confidence: 0.8,
        language: settings.language,
        isFinal: true,
        timestamp: Date.now(),
      };
      
      onTranscript?.(speechResult);
      
      return result.text;
    } catch (error) {
      const voiceError = createError(
        'network',
        'whisper_api_error',
        error instanceof Error ? error.message : 'Whisper API processing failed',
        'فشل في معالجة الصوت باستخدام Whisper API'
      );
      
      setState(prev => ({ ...prev, error: voiceError, isProcessing: false }));
      onError?.(voiceError);
      throw error;
    }
  }, [settings.language, onTranscript, onError, createError]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: undefined }));
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
      mediaStreamRef.current = stream;
      
      // Setup audio monitoring
      setupAudioMonitoring(stream);
      
      // Setup RecordRTC for audio recording
      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
      });
      
      recorderRef.current.startRecording();
      
      // Setup Web Speech API if supported
      if (isSpeechRecognitionSupported()) {
        setupSpeechRecognition(stream);
        recognitionRef.current?.start();
      }
      
      // Start duration timer
      let seconds = 0;
      durationTimerRef.current = setInterval(() => {
        seconds += 1;
        setState(prev => ({ ...prev, duration: seconds }));
        
        // Auto-stop at max duration
        if (seconds >= maxDuration) {
          stopRecording();
        }
      }, 1000);
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
      }));
      
    } catch (error) {
      let voiceError: VoiceError;
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          voiceError = createError(
            'permission',
            'microphone_permission_denied',
            'Microphone access denied. Please allow microphone access and try again.',
            'تم رفض الوصول للميكروفون. يرجى السماح بالوصول للميكروفون والمحاولة مرة أخرى.'
          );
        } else if (error.name === 'NotFoundError') {
          voiceError = createError(
            'unsupported',
            'no_microphone_found',
            'No microphone found. Please connect a microphone and try again.',
            'لم يتم العثور على ميكروفون. يرجى توصيل ميكروفون والمحاولة مرة أخرى.'
          );
        } else {
          voiceError = createError(
            'unknown',
            'recording_start_failed',
            `Failed to start recording: ${error.message}`,
            `فشل في بدء التسجيل: ${error.message}`
          );
        }
      } else {
        voiceError = createError(
          'unknown',
          'recording_start_failed',
          'Unknown error occurred while starting recording',
          'حدث خطأ غير معروف أثناء بدء التسجيل'
        );
      }
      
      setState(prev => ({ ...prev, error: voiceError }));
      onError?.(voiceError);
    }
  }, [
    getMediaConstraints,
    setupAudioMonitoring,
    setupSpeechRecognition,
    isSpeechRecognitionSupported,
    maxDuration,
    createError,
    onError
  ]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!state.isRecording || state.isPaused) return;
    
    recorderRef.current?.pauseRecording();
    recognitionRef.current?.stop();
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    setState(prev => ({ ...prev, isPaused: true }));
  }, [state.isRecording, state.isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!state.isRecording || !state.isPaused) return;
    
    recorderRef.current?.resumeRecording();
    
    if (recognitionRef.current && isSpeechRecognitionSupported()) {
      recognitionRef.current.start();
    }
    
    // Resume duration timer
    durationTimerRef.current = setInterval(() => {
      setState(prev => {
        const newDuration = prev.duration + 1;
        if (newDuration >= maxDuration) {
          stopRecording();
        }
        return { ...prev, duration: newDuration };
      });
    }, 1000);
    
    setState(prev => ({ ...prev, isPaused: false }));
  }, [state.isRecording, state.isPaused, isSpeechRecognitionSupported, maxDuration]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!state.isRecording) return;
    
    // Stop timers
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop recognition
    recognitionRef.current?.stop();
    
    // Stop recording
    return new Promise<Blob | null>((resolve) => {
      if (recorderRef.current) {
        recorderRef.current.stopRecording(() => {
          const audioBlob = recorderRef.current?.getBlob();
          
          setState(prev => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            audioLevel: 0,
            audioData: audioBlob,
          }));
          
          // Clean up media stream
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
          
          // Clean up audio context
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          
          // If Web Speech API didn't work or wasn't available, fallback to Whisper
          if (audioBlob && (!state.transcript || !isSpeechRecognitionSupported())) {
            processWithWhisper(audioBlob).catch(console.error);
          }
          
          resolve(audioBlob || null);
        });
      } else {
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioLevel: 0,
        }));
        resolve(null);
      }
    });
  }, [state.isRecording, state.transcript, isSpeechRecognitionSupported, processWithWhisper]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    // Stop all processes
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    recognitionRef.current?.stop();
    
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        // Don't save the recording
      });
    }
    
    // Clean up media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setState({
      isRecording: false,
      isPaused: false,
      isProcessing: false,
      duration: 0,
      audioLevel: 0,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    isSupported: isSpeechRecognitionSupported(),
    hasWhisperFallback: true,
  };
}

export default useVoiceRecording;