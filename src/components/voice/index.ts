export { AudioVisualization } from './AudioVisualization';
export { VoiceChatControls } from './VoiceChatControls';
export { VoiceMessagePlayer } from './VoiceMessagePlayer';
export { VoiceErrorHandler } from './VoiceErrorHandler';
export { VoiceConversationSummary } from './VoiceConversationSummary';
export { VoiceDocumentSearch } from './VoiceDocumentSearch';

// Re-export types
export type {
  VoiceSettings,
  VoiceRecordingState,
  VoiceError,
  VoiceCommand,
  SpeechToTextResult,
  TextToSpeechOptions,
  AudioVisualizationData,
  VoiceMessage,
  WhisperTranscriptionRequest,
  WhisperTranscriptionResponse,
  VoiceAnalytics,
  BrowserVoice,
  VoiceQueueItem,
  ArabicVoiceCommand,
  EnglishVoiceCommand,
} from '@/types/voice';

// Re-export hooks
export { default as useVoiceRecording } from '@/hooks/useVoiceRecording';
export { default as useTextToSpeech } from '@/hooks/useTextToSpeech';

// Re-export services
export { voiceCommandService } from '@/libs/services/voice-command-service';
export { audioProcessingService } from '@/libs/services/audio-processing-service';
export { languageDetectionService } from '@/libs/services/language-detection-service';