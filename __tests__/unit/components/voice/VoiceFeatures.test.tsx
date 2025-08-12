/**
 * Voice Features Unit Tests
 * Tests for voice recording, transcription, and TTS with Arabic language support
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import voice components
import VoiceChatControls from '@/components/voice/VoiceChatControls';
import VoiceMessagePlayer from '@/components/voice/VoiceMessagePlayer';
import AudioVisualization from '@/components/voice/AudioVisualization';
import VoiceDocumentSearch from '@/components/voice/VoiceDocumentSearch';

// Mock voice hooks
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

jest.mock('@/hooks/useVoiceRecording');
jest.mock('@/hooks/useTextToSpeech');

// Mock Web APIs
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'inactive',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  ondataavailable: null,
  onstop: null,
  onerror: null,
};

const mockAudioContext = {
  createAnalyser: jest.fn(() => ({
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  close: jest.fn(),
  resume: jest.fn(),
  suspend: jest.fn(),
  state: 'running',
};

const mockSpeechRecognition = {
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  continuous: false,
  interimResults: false,
  lang: 'ar-SA',
  onstart: null,
  onresult: null,
  onerror: null,
  onend: null,
};

const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => [
    { lang: 'ar-SA', name: 'Arabic Voice', voiceURI: 'ar-voice' },
    { lang: 'en-US', name: 'English Voice', voiceURI: 'en-voice' },
  ]),
  speaking: false,
  pending: false,
  paused: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Mock getUserMedia
const mockGetUserMedia = jest.fn();

// Arabic voice test data
const arabicVoiceData = {
  transcriptions: [
    'ما هي أحكام الإجازة السنوية؟',
    'كيف يتم حساب مكافأة نهاية الخدمة؟',
    'ما هي حقوق العامل في حالة إنهاء الخدمة؟',
    'أريد البحث عن قانون العمل السعودي',
    'اعرض لي قائمة الموظفين في قسم الموارد البشرية',
  ],
  responses: [
    'وفقاً لقانون العمل السعودي، يحق للعامل الحصول على إجازة سنوية مدفوعة الأجر لا تقل عن 21 يوماً',
    'تُحسب مكافأة نهاية الخدمة على أساس راتب نصف شهر عن كل سنة من السنوات الخمس الأولى',
    'للعامل حقوق متعددة عند إنهاء الخدمة تشمل المكافآت والإجازات المستحقة والراتب',
  ],
  audioFiles: [
    { id: 'audio-1', duration: 3.2, language: 'ar' },
    { id: 'audio-2', duration: 5.7, language: 'ar' },
    { id: 'audio-3', duration: 2.1, language: 'ar' },
  ],
};

describe('Voice Features', () => {
  let mockUseVoiceRecording: jest.MockedFunction<typeof useVoiceRecording>;
  let mockUseTextToSpeech: jest.MockedFunction<typeof useTextToSpeech>;

  beforeEach(() => {
    // Set up global mocks
    global.MediaRecorder = jest.fn(() => mockMediaRecorder) as any;
    global.AudioContext = jest.fn(() => mockAudioContext) as any;
    global.webkitAudioContext = jest.fn(() => mockAudioContext) as any;
    global.SpeechRecognition = jest.fn(() => mockSpeechRecognition) as any;
    global.webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition) as any;
    global.speechSynthesis = mockSpeechSynthesis as any;

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: jest.fn(() => Promise.resolve([])),
      },
    });

    // Mock hooks
    mockUseVoiceRecording = useVoiceRecording as jest.MockedFunction<typeof useVoiceRecording>;
    mockUseTextToSpeech = useTextToSpeech as jest.MockedFunction<typeof useTextToSpeech>;

    mockUseVoiceRecording.mockReturnValue({
      isRecording: false,
      audioBlob: null,
      duration: 0,
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      pauseRecording: jest.fn(),
      resumeRecording: jest.fn(),
      resetRecording: jest.fn(),
      error: null,
      isSupported: true,
    });

    mockUseTextToSpeech.mockReturnValue({
      speak: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isSpeaking: false,
      isPaused: false,
      isSupported: true,
      voices: mockSpeechSynthesis.getVoices(),
      selectedVoice: null,
      setSelectedVoice: jest.fn(),
    });

    // Mock successful media access
    mockGetUserMedia.mockResolvedValue(new MediaStream());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('VoiceChatControls Component', () => {
    it('should render voice control buttons', () => {
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      expect(screen.getByRole('button', { name: /بدء التسجيل/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /التحدث/ })).toBeInTheDocument();
      expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
    });

    it('should start recording when record button is clicked', async () => {
      const mockStartRecording = jest.fn();
      mockUseVoiceRecording.mockReturnValue({
        ...mockUseVoiceRecording(),
        startRecording: mockStartRecording,
      });

      const user = userEvent.setup();
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      const recordButton = screen.getByRole('button', { name: /بدء التسجيل/ });
      await user.click(recordButton);

      expect(mockStartRecording).toHaveBeenCalled();
    });

    it('should display recording state correctly', () => {
      mockUseVoiceRecording.mockReturnValue({
        ...mockUseVoiceRecording(),
        isRecording: true,
        duration: 5.5,
      });

      render(<VoiceChatControls onTranscription={jest.fn()} />);

      expect(screen.getByText(/إيقاف التسجيل/)).toBeInTheDocument();
      expect(screen.getByText('00:05')).toBeInTheDocument();
      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument();
    });

    it('should handle voice transcription in Arabic', async () => {
      const mockOnTranscription = jest.fn();
      const mockStopRecording = jest.fn();
      
      mockUseVoiceRecording.mockReturnValue({
        ...mockUseVoiceRecording(),
        isRecording: true,
        stopRecording: mockStopRecording,
      });

      render(<VoiceChatControls onTranscription={mockOnTranscription} />);

      // Simulate stopping recording
      const stopButton = screen.getByRole('button', { name: /إيقاف التسجيل/ });
      await userEvent.click(stopButton);

      expect(mockStopRecording).toHaveBeenCalled();

      // Simulate transcription result
      act(() => {
        const recognitionResult = {
          results: [{
            0: { transcript: arabicVoiceData.transcriptions[0] },
            isFinal: true,
          }],
        };
        mockSpeechRecognition.onresult?.(recognitionResult);
      });

      await waitFor(() => {
        expect(mockOnTranscription).toHaveBeenCalledWith(arabicVoiceData.transcriptions[0]);
      });
    });

    it('should handle microphone permission errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      const user = userEvent.setup();
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      const recordButton = screen.getByRole('button', { name: /بدء التسجيل/ });
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/خطأ في الوصول للميكروفون/)).toBeInTheDocument();
      });
    });

    it('should support voice commands in Arabic', async () => {
      const mockOnVoiceCommand = jest.fn();
      render(
        <VoiceChatControls 
          onTranscription={jest.fn()} 
          onVoiceCommand={mockOnVoiceCommand}
          enableVoiceCommands={true}
        />
      );

      // Simulate voice command
      act(() => {
        const commandResult = {
          results: [{
            0: { transcript: 'ابحث عن قانون العمل' },
            isFinal: true,
          }],
        };
        mockSpeechRecognition.onresult?.(commandResult);
      });

      await waitFor(() => {
        expect(mockOnVoiceCommand).toHaveBeenCalledWith({
          command: 'search',
          parameters: ['قانون العمل'],
          confidence: expect.any(Number),
        });
      });
    });
  });

  describe('VoiceMessagePlayer Component', () => {
    it('should render audio player with Arabic text', () => {
      const message = {
        id: 'msg-1',
        text: arabicVoiceData.responses[0],
        audioUrl: 'https://example.com/audio.mp3',
        duration: 5.2,
        language: 'ar',
      };

      render(<VoiceMessagePlayer message={message} />);

      expect(screen.getByText(message.text)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /تشغيل/ })).toBeInTheDocument();
      expect(screen.getByText('05:00')).toBeInTheDocument();
    });

    it('should play Arabic text-to-speech', async () => {
      const mockSpeak = jest.fn();
      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        speak: mockSpeak,
      });

      const message = {
        id: 'msg-1',
        text: arabicVoiceData.responses[0],
        language: 'ar',
      };

      const user = userEvent.setup();
      render(<VoiceMessagePlayer message={message} />);

      const playButton = screen.getByRole('button', { name: /تشغيل/ });
      await user.click(playButton);

      expect(mockSpeak).toHaveBeenCalledWith(message.text, {
        lang: 'ar-SA',
        rate: 1.0,
        pitch: 1.0,
        voice: expect.objectContaining({ lang: 'ar-SA' }),
      });
    });

    it('should display playback controls during speech', () => {
      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        isSpeaking: true,
      });

      const message = {
        id: 'msg-1',
        text: arabicVoiceData.responses[0],
        language: 'ar',
      };

      render(<VoiceMessagePlayer message={message} />);

      expect(screen.getByRole('button', { name: /إيقاف/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /توقف مؤقت/ })).toBeInTheDocument();
      expect(screen.getByTestId('audio-progress')).toBeInTheDocument();
    });

    it('should adjust playback speed', async () => {
      const mockSpeak = jest.fn();
      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        speak: mockSpeak,
      });

      const message = {
        id: 'msg-1',
        text: arabicVoiceData.responses[0],
        language: 'ar',
      };

      const user = userEvent.setup();
      render(<VoiceMessagePlayer message={message} />);

      // Open speed control
      const speedButton = screen.getByRole('button', { name: /سرعة التشغيل/ });
      await user.click(speedButton);

      // Select 1.5x speed
      const speed15x = screen.getByRole('button', { name: /1.5x/ });
      await user.click(speed15x);

      // Play with new speed
      const playButton = screen.getByRole('button', { name: /تشغيل/ });
      await user.click(playButton);

      expect(mockSpeak).toHaveBeenCalledWith(message.text, 
        expect.objectContaining({ rate: 1.5 })
      );
    });
  });

  describe('AudioVisualization Component', () => {
    it('should render audio visualization canvas', () => {
      render(<AudioVisualization isActive={true} />);

      expect(screen.getByTestId('audio-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('visualization-container')).toBeInTheDocument();
    });

    it('should start visualization when recording begins', () => {
      const { rerender } = render(<AudioVisualization isActive={false} />);

      // Start recording
      rerender(<AudioVisualization isActive={true} />);

      expect(screen.getByTestId('audio-canvas')).toHaveClass('active');
    });

    it('should handle different visualization types', async () => {
      const user = userEvent.setup();
      render(
        <AudioVisualization 
          isActive={true} 
          showControls={true}
        />
      );

      // Switch to waveform visualization
      const waveformButton = screen.getByRole('button', { name: /شكل الموجة/ });
      await user.click(waveformButton);

      expect(screen.getByTestId('audio-canvas')).toHaveAttribute('data-type', 'waveform');

      // Switch to frequency bars
      const barsButton = screen.getByRole('button', { name: /أشرطة التردد/ });
      await user.click(barsButton);

      expect(screen.getByTestId('audio-canvas')).toHaveAttribute('data-type', 'bars');
    });
  });

  describe('VoiceDocumentSearch Component', () => {
    it('should perform voice search for Arabic documents', async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup();

      render(<VoiceDocumentSearch onSearch={mockOnSearch} />);

      // Start voice search
      const voiceSearchButton = screen.getByRole('button', { name: /البحث الصوتي/ });
      await user.click(voiceSearchButton);

      // Simulate voice input
      act(() => {
        const searchResult = {
          results: [{
            0: { transcript: 'ابحث عن عقود العمل' },
            isFinal: true,
          }],
        };
        mockSpeechRecognition.onresult?.(searchResult);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith({
          query: 'ابحث عن عقود العمل',
          language: 'ar',
          searchType: 'voice',
        });
      });
    });

    it('should provide voice feedback for search results', async () => {
      const mockSpeak = jest.fn();
      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        speak: mockSpeak,
      });

      const searchResults = [
        { id: '1', title: 'عقد عمل - أحمد محمد', type: 'contract' },
        { id: '2', title: 'شهادة راتب - يناير 2024', type: 'payroll' },
      ];

      render(
        <VoiceDocumentSearch 
          onSearch={jest.fn()} 
          searchResults={searchResults}
          enableVoiceFeedback={true}
        />
      );

      await waitFor(() => {
        expect(mockSpeak).toHaveBeenCalledWith(
          'تم العثور على وثيقتين: عقد عمل - أحمد محمد، شهادة راتب - يناير 2024',
          expect.objectContaining({ lang: 'ar-SA' })
        );
      });
    });

    it('should handle voice navigation commands', async () => {
      const mockOnNavigate = jest.fn();
      render(
        <VoiceDocumentSearch 
          onSearch={jest.fn()} 
          onNavigate={mockOnNavigate}
          enableVoiceNavigation={true}
        />
      );

      // Simulate navigation command
      act(() => {
        const navResult = {
          results: [{
            0: { transcript: 'افتح الوثيقة الأولى' },
            isFinal: true,
          }],
        };
        mockSpeechRecognition.onresult?.(navResult);
      });

      await waitFor(() => {
        expect(mockOnNavigate).toHaveBeenCalledWith({
          action: 'open',
          target: 'first',
          command: 'افتح الوثيقة الأولى',
        });
      });
    });
  });

  describe('Voice Error Handling', () => {
    it('should handle speech recognition errors gracefully', async () => {
      const user = userEvent.setup();
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      const recordButton = screen.getByRole('button', { name: /بدء التسجيل/ });
      await user.click(recordButton);

      // Simulate recognition error
      act(() => {
        mockSpeechRecognition.onerror?.({
          error: 'network',
          message: 'Network error occurred',
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/خطأ في التعرف على الصوت/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeInTheDocument();
      });
    });

    it('should handle TTS synthesis errors', async () => {
      const mockSpeak = jest.fn(() => {
        throw new Error('Synthesis failed');
      });
      
      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        speak: mockSpeak,
      });

      const message = {
        id: 'msg-1',
        text: arabicVoiceData.responses[0],
        language: 'ar',
      };

      const user = userEvent.setup();
      render(<VoiceMessagePlayer message={message} />);

      const playButton = screen.getByRole('button', { name: /تشغيل/ });
      await user.click(playButton);

      await waitFor(() => {
        expect(screen.getByText(/خطأ في تشغيل الصوت/)).toBeInTheDocument();
      });
    });

    it('should provide fallback when voice features are not supported', () => {
      mockUseVoiceRecording.mockReturnValue({
        ...mockUseVoiceRecording(),
        isSupported: false,
      });

      mockUseTextToSpeech.mockReturnValue({
        ...mockUseTextToSpeech(),
        isSupported: false,
      });

      render(<VoiceChatControls onTranscription={jest.fn()} />);

      expect(screen.getByText(/الميزات الصوتية غير مدعومة/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /كتابة نص/ })).toBeInTheDocument();
    });
  });

  describe('Voice Accessibility', () => {
    it('should have proper ARIA labels for voice controls', () => {
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      expect(screen.getByRole('button', { name: /بدء التسجيل/ }))
        .toHaveAttribute('aria-label', 'بدء تسجيل الصوت');
      
      expect(screen.getByTestId('voice-controls'))
        .toHaveAttribute('role', 'toolbar');
      
      expect(screen.getByTestId('voice-controls'))
        .toHaveAttribute('aria-label', 'أدوات التحكم الصوتي');
    });

    it('should announce recording state to screen readers', () => {
      mockUseVoiceRecording.mockReturnValue({
        ...mockUseVoiceRecording(),
        isRecording: true,
        duration: 5.5,
      });

      render(<VoiceChatControls onTranscription={jest.fn()} />);

      expect(screen.getByTestId('recording-status'))
        .toHaveAttribute('aria-live', 'polite');
      
      expect(screen.getByTestId('recording-status'))
        .toHaveTextContent('جاري التسجيل - 00:05');
    });

    it('should support keyboard navigation for voice controls', async () => {
      const user = userEvent.setup();
      render(<VoiceChatControls onTranscription={jest.fn()} />);

      // Tab to record button
      await user.tab();
      expect(screen.getByRole('button', { name: /بدء التسجيل/ })).toHaveFocus();

      // Press Enter to start recording
      await user.keyboard('{Enter}');
      
      // Tab to stop button
      await user.tab();
      expect(screen.getByRole('button', { name: /إيقاف التسجيل/ })).toHaveFocus();
    });
  });
});