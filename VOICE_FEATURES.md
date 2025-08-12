# Voice Input/Output Features for HR Intelligence Platform

This document provides comprehensive information about the voice input/output features implemented for the Arabic-enabled HR Intelligence Platform.

## Overview

The HR Intelligence Platform now includes comprehensive voice input/output support specifically designed for Arabic language processing in professional HR contexts. The implementation includes speech-to-text, text-to-speech, voice commands, document search, and conversation analysis features.

## Features

### 1. Speech-to-Text (STT) Integration
- **Web Speech API** with Arabic language support (`ar-SA`, `ar-EG`, `ar-AE`)
- **OpenRouter/OpenAI Whisper API** fallback for enhanced accuracy
- Real-time transcription with confidence scoring
- Support for multiple Arabic dialects
- Automatic language detection (Arabic/English)
- Noise reduction and audio enhancement
- Context-aware transcription for HR terminology

### 2. Text-to-Speech (TTS) Implementation
- Browser-native TTS with Arabic voice selection
- Support for Saudi Arabic dialect (`ar-SA`)
- Natural-sounding speech with proper Arabic pronunciation
- Speed, pitch, and volume controls
- Queue management for multiple speech requests
- Enhanced Arabic text processing (pause insertion, emphasis)

### 3. Voice Chat Interface
- Integrated voice input button in chat interface
- Real-time audio visualization during recording
- Voice message playback controls
- Recording status indicators and duration display
- Pause/resume functionality
- Voice transcript preview before sending

### 4. Smart Voice Features
- **Voice Commands**: Recognition of Arabic commands like "ابحث عن", "اقرأ الوثيقة"
- **Language Detection**: Automatic Arabic/English language detection
- **Voice Conversation Summaries**: AI-powered conversation analysis
- **Voice Document Search**: Speech-enabled document search functionality
- **Command Feedback**: Voice responses to executed commands

### 5. Audio Processing
- Noise reduction and audio enhancement
- Audio format conversion (MP3, WAV, WebM)
- Real-time audio level monitoring
- Silence detection and trimming
- Audio quality analysis and optimization
- Compression for storage and transmission

## Architecture

### Core Components

#### Hooks
- **`useVoiceRecording`**: Manages voice recording with Web Speech API and Whisper fallback
- **`useTextToSpeech`**: Handles text-to-speech functionality with Arabic support

#### Components
- **`AudioVisualization`**: Real-time audio waveform visualization
- **`VoiceChatControls`**: Complete voice chat interface with recording controls
- **`VoiceMessagePlayer`**: Audio message playback with transcript display
- **`VoiceErrorHandler`**: Comprehensive error handling for voice features
- **`VoiceConversationSummary`**: AI-powered conversation analysis and summary
- **`VoiceDocumentSearch`**: Voice-enabled document search interface

#### Services
- **`VoiceCommandService`**: Voice command recognition and processing
- **`AudioProcessingService`**: Audio enhancement and format conversion
- **`LanguageDetectionService`**: Automatic language detection for text

#### API Endpoints
- **`/api/v1/voice/transcribe`**: Whisper API integration for speech-to-text

## Installation and Setup

### 1. Dependencies
The following packages have been added to support voice features:

```json
{
  "dependencies": {
    "wavesurfer.js": "^7.8.2",
    "recordrtc": "^5.6.2",
    "lamejs": "^1.2.1",
    "web-audio-api": "^0.2.2",
    "opus-media-recorder": "^0.8.0"
  },
  "devDependencies": {
    "@types/recordrtc": "^5.6.11",
    "@types/lamejs": "^1.2.0"
  }
}
```

### 2. Environment Variables
Add the following environment variables for Whisper API integration:

```env
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key (alternative)
```

### 3. Browser Support
Voice features work best in modern browsers:
- **Chrome**: Full support for Web Speech API and audio processing
- **Firefox**: Good support with some limitations
- **Safari**: Basic support, may require user interaction
- **Edge**: Full support similar to Chrome

## Usage Examples

### Basic Voice Recording

```tsx
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

function VoiceRecorder() {
  const {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
  } = useVoiceRecording({
    settings: {
      language: 'ar',
      dialect: 'ar-SA',
      noiseReduction: true,
    },
    onTranscript: (result) => {
      console.log('Transcript:', result.transcript);
    },
  });

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>
      {transcript && <p>{transcript}</p>}
    </div>
  );
}
```

### Text-to-Speech

```tsx
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

function SpeechPlayer() {
  const { speak, isSpeaking, stop } = useTextToSpeech({
    settings: {
      language: 'ar',
      rate: 1.0,
      pitch: 1.0,
    },
  });

  const handleSpeak = () => {
    speak('مرحباً بك في منصة الموارد البشرية', { language: 'ar' });
  };

  return (
    <div>
      <button onClick={handleSpeak}>Speak Arabic</button>
      {isSpeaking && <button onClick={stop}>Stop</button>}
    </div>
  );
}
```

### Voice Chat Interface

```tsx
import { VoiceChatControls } from '@/components/voice';

function ChatInterface() {
  const handleTranscript = (transcript: string, confidence: number) => {
    console.log(`Transcript: ${transcript} (${confidence * 100}% confidence)`);
  };

  const handleVoiceCommand = (command: string, parameters?: string[]) => {
    console.log('Voice command:', command, parameters);
  };

  return (
    <VoiceChatControls
      onTranscript={handleTranscript}
      onVoiceCommand={handleVoiceCommand}
      language="ar"
      showVisualization={true}
      showTranscript={true}
    />
  );
}
```

### Voice Document Search

```tsx
import { VoiceDocumentSearch } from '@/components/voice';

function DocumentSearch() {
  const handleResults = (results: SearchResult[]) => {
    console.log('Search results:', results);
  };

  return (
    <VoiceDocumentSearch
      onResults={handleResults}
      language="ar"
      enableVoiceSearch={true}
      showFilters={true}
    />
  );
}
```

## Voice Commands

The platform supports various Arabic voice commands:

### Search Commands
- **"ابحث عن [query]"** - Search for documents
- **"اعثر على [query]"** - Find specific content
- **"ابحث في [category]"** - Search in specific category

### Document Commands
- **"اقرأ الوثيقة"** - Read/open document
- **"افتح المستند"** - Open document
- **"اعرض الملف"** - Display file

### Recording Commands
- **"ابدأ التسجيل"** - Start recording
- **"أوقف التسجيل"** - Stop recording
- **"توقف"** - Pause
- **"استكمل"** - Resume

### Action Commands
- **"احفظ"** - Save current content
- **"شارك"** - Share content
- **"اطبع"** - Print document
- **"ترجم إلى الإنجليزية"** - Translate to English

## Configuration

### Voice Settings

```tsx
interface VoiceSettings {
  language: 'ar' | 'en';
  dialect?: 'ar-SA' | 'ar-EG' | 'ar-AE' | 'en-US' | 'en-GB';
  rate: number; // 0.1 to 10 (speech rate)
  pitch: number; // 0 to 2 (voice pitch)
  volume: number; // 0 to 1 (speech volume)
  autoDetectLanguage: boolean;
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}
```

### Audio Processing Options

```tsx
interface AudioProcessingOptions {
  sampleRate?: number; // Default: 16000 for speech
  bitRate?: number; // Default: 128kbps
  channels?: number; // Default: 1 (mono)
  noiseReduction?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  normalize?: boolean;
}
```

## Error Handling

The voice features include comprehensive error handling for common issues:

### Permission Errors
- Microphone access denied
- System microphone not available
- Browser security restrictions

### Network Errors
- Whisper API connectivity issues
- Rate limiting
- Service unavailable

### Processing Errors
- Audio quality too low
- Language detection failures
- Speech recognition timeouts

### Example Error Handler

```tsx
import { VoiceErrorHandler } from '@/components/voice';

function VoiceInterface() {
  const [voiceError, setVoiceError] = useState<VoiceError>();

  return (
    <div>
      {/* Voice components */}
      {voiceError && (
        <VoiceErrorHandler
          error={voiceError}
          language="ar"
          onRetry={() => {/* Retry logic */}}
          onDismiss={() => setVoiceError(undefined)}
        />
      )}
    </div>
  );
}
```

## Performance Considerations

### Audio Processing
- Use Web Workers for intensive audio processing
- Implement audio compression for network transmission
- Cache voice settings and preferences locally

### Memory Management
- Properly dispose of audio contexts
- Clean up media streams after use
- Limit voice message history to prevent memory leaks

### Network Optimization
- Compress audio before sending to Whisper API
- Implement request debouncing for real-time features
- Use WebSocket connections for real-time voice features

## Accessibility

The voice features are designed with accessibility in mind:

### Visual Indicators
- Real-time audio level visualization
- Recording status indicators
- Transcript confidence display

### Keyboard Navigation
- All voice controls accessible via keyboard
- Screen reader compatible
- Voice command alternatives for UI actions

### Language Support
- Full Arabic language support (RTL layout)
- Bilingual interface (Arabic/English)
- Cultural adaptation for Saudi context

## Testing

### Browser Compatibility Testing
Test voice features across different browsers and devices:

```bash
# Test microphone permissions
# Test speech recognition accuracy
# Test TTS voice quality
# Test network failure scenarios
```

### Automated Testing
Implement automated tests for voice features:

```tsx
// Mock voice API for testing
jest.mock('@/hooks/useVoiceRecording', () => ({
  useVoiceRecording: () => ({
    isRecording: false,
    transcript: 'مرحبا',
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
  }),
}));
```

## Security Considerations

### Audio Data Privacy
- Temporary audio storage only
- Secure transmission to transcription services
- No persistent storage of voice recordings
- GDPR/privacy compliance

### API Security
- Rate limiting on voice endpoints
- Authentication required for voice features
- Input validation for transcription requests
- Audit logging for voice activities

## Troubleshooting

### Common Issues

1. **Microphone Not Working**
   - Check browser permissions
   - Verify microphone hardware
   - Test with other applications

2. **Poor Speech Recognition**
   - Reduce background noise
   - Speak clearly and slowly
   - Check microphone positioning

3. **TTS Not Working**
   - Verify browser TTS support
   - Check voice availability
   - Test with different browsers

4. **API Errors**
   - Verify API keys
   - Check network connectivity
   - Monitor API rate limits

### Debug Mode
Enable debug mode for detailed logging:

```tsx
// Enable voice debug logging
localStorage.setItem('voice_debug', 'true');
```

## Future Enhancements

### Planned Features
- Speaker identification in multi-user conversations
- Voice biometric authentication
- Advanced noise cancellation
- Offline voice processing
- Custom wake word detection
- Voice-based form filling
- Meeting transcription and summarization

### Performance Improvements
- WebAssembly-based audio processing
- Edge computing for voice processing
- Improved Arabic dialect support
- Real-time voice translation

## Support

For issues related to voice features:
1. Check browser compatibility
2. Verify microphone permissions
3. Test with different audio devices
4. Review API key configuration
5. Contact development team for advanced issues

## License

Voice features are part of the HR Intelligence Platform and subject to the same licensing terms.