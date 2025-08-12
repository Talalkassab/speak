export interface VoiceSettings {
  language: 'ar' | 'en';
  dialect?: 'ar-SA' | 'ar-EG' | 'ar-AE' | 'en-US' | 'en-GB';
  voiceId?: string;
  rate: number; // 0.1 to 10
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
  autoDetectLanguage: boolean;
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  duration: number;
  audioLevel: number;
  error?: VoiceError;
  audioData?: Blob;
  transcript?: string;
  confidence?: number;
}

export interface VoiceError {
  type: 'permission' | 'network' | 'processing' | 'unsupported' | 'unknown';
  code: string;
  message: string;
  messageAr?: string;
  details?: Record<string, any>;
}

export interface VoiceCommand {
  command: string;
  commandAr?: string;
  pattern: RegExp;
  patternAr?: RegExp;
  action: (params?: string[]) => void;
  description: string;
  descriptionAr?: string;
  examples: string[];
  examplesAr?: string[];
}

export interface SpeechToTextResult {
  transcript: string;
  confidence: number;
  language: 'ar' | 'en';
  detectedLanguage?: {
    language: 'ar' | 'en';
    confidence: number;
    method: 'auto' | 'manual' | 'api';
  };
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
  isFinal: boolean;
  timestamp: number;
}

export interface LanguageDetectionResult {
  language: 'ar' | 'en';
  confidence: number;
  alternativeLanguages?: Array<{
    language: 'ar' | 'en';
    confidence: number;
  }>;
  detectionMethod: 'character' | 'word' | 'pattern' | 'api';
}

export interface TextToSpeechOptions {
  text: string;
  language: 'ar' | 'en';
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface AudioVisualizationData {
  waveform: number[];
  frequencyData: number[];
  volume: number;
  timestamp: number;
}

export interface VoiceMessage {
  id: string;
  type: 'voice';
  audioUrl?: string;
  audioBlob?: Blob;
  transcript: string;
  duration: number;
  language: 'ar' | 'en';
  confidence?: number;
  timestamp: number;
  isPlaying?: boolean;
}

export interface WhisperTranscriptionRequest {
  audio: Blob;
  language?: string;
  model?: 'whisper-1';
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  prompt?: string;
}

export interface WhisperTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

export interface VoiceAnalytics {
  totalRecordings: number;
  totalDuration: number;
  averageConfidence: number;
  languageDistribution: Record<string, number>;
  commandsUsed: Record<string, number>;
  errorRate: number;
  commonErrors: Array<{
    type: string;
    count: number;
    lastOccurrence: number;
  }>;
}

export interface BrowserVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface VoiceQueueItem {
  id: string;
  text: string;
  options: TextToSpeechOptions;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  status: 'pending' | 'speaking' | 'completed' | 'error';
}

export const ARABIC_DIALECTS = {
  'ar-SA': 'السعودية',
  'ar-EG': 'المصرية', 
  'ar-AE': 'الإماراتية',
  'ar-JO': 'الأردنية',
  'ar-LB': 'اللبنانية',
  'ar-MA': 'المغربية',
  'ar-TN': 'التونسية'
} as const;

export const VOICE_COMMANDS_AR = [
  'ابحث عن',
  'اقرأ الوثيقة',
  'افتح المحادثة',
  'أنهِ التسجيل',
  'ابدأ التسجيل',
  'كرر',
  'توقف',
  'استكمل',
  'احفظ',
  'شارك',
  'اطبع',
  'ترجم إلى الإنجليزية',
  'ترجم إلى العربية'
] as const;

export const VOICE_COMMANDS_EN = [
  'search for',
  'read document',
  'open conversation', 
  'stop recording',
  'start recording',
  'repeat',
  'pause',
  'continue',
  'save',
  'share',
  'print',
  'translate to english',
  'translate to arabic'
] as const;

export type ArabicVoiceCommand = typeof VOICE_COMMANDS_AR[number];
export type EnglishVoiceCommand = typeof VOICE_COMMANDS_EN[number];