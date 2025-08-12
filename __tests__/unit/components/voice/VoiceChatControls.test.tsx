import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceChatControls } from '@/components/voice/VoiceChatControls';

// Mock the voice recording hook
const mockUseVoiceRecording = {
  isRecording: false,
  isProcessing: false,
  audioLevel: 0,
  error: null,
  transcript: '',
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  pauseRecording: jest.fn(),
  resumeRecording: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('@/hooks/useVoiceRecording', () => ({
  useVoiceRecording: () => mockUseVoiceRecording,
}));

// Mock the text-to-speech hook
const mockUseTextToSpeech = {
  isPlaying: false,
  isSpeaking: false,
  error: null,
  speak: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  setVoice: jest.fn(),
  setRate: jest.fn(),
  setPitch: jest.fn(),
  voices: [
    { name: 'Arabic Female', lang: 'ar-SA', gender: 'female' },
    { name: 'Arabic Male', lang: 'ar-SA', gender: 'male' },
  ],
};

jest.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => mockUseTextToSpeech,
}));

// Mock icons
jest.mock('react-icons/hi2', () => ({
  HiMicrophone: () => <div data-testid="microphone-icon" />,
  HiStop: () => <div data-testid="stop-icon" />,
  HiPause: () => <div data-testid="pause-icon" />,
  HiPlay: () => <div data-testid="play-icon" />,
  HiSpeakerWave: () => <div data-testid="speaker-icon" />,
  HiCog6Tooth: () => <div data-testid="settings-icon" />,
}));

describe('VoiceChatControls', () => {
  const mockOnTranscript = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders voice controls with record button', () => {
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
    expect(screen.getByTestId('microphone-icon')).toBeInTheDocument();
  });

  it('handles recording start and stop', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    
    // Start recording
    await user.click(recordButton);
    expect(mockUseVoiceRecording.startRecording).toHaveBeenCalled();
    
    // Mock recording state change
    mockUseVoiceRecording.isRecording = true;
    
    // Stop recording
    await user.click(recordButton);
    expect(mockUseVoiceRecording.stopRecording).toHaveBeenCalled();
  });

  it('displays recording state visually', () => {
    mockUseVoiceRecording.isRecording = true;
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    expect(screen.getByTestId('recording-indicator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
    expect(screen.getByTestId('stop-icon')).toBeInTheDocument();
  });

  it('shows audio level visualization during recording', () => {
    mockUseVoiceRecording.isRecording = true;
    mockUseVoiceRecording.audioLevel = 0.75;
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showAudioVisualization={true}
      />
    );
    
    expect(screen.getByTestId('audio-visualization')).toBeInTheDocument();
    const visualizer = screen.getByTestId('audio-level-bar');
    expect(visualizer).toHaveStyle('height: 75%');
  });

  it('displays processing state after recording stops', () => {
    mockUseVoiceRecording.isProcessing = true;
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/processing audio/i)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows transcript preview when available', async () => {
    mockUseVoiceRecording.transcript = 'مرحباً، ما هي أنواع الإجازات المتاحة؟';
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showTranscriptPreview={true}
      />
    );
    
    expect(screen.getByTestId('transcript-preview')).toBeInTheDocument();
    expect(screen.getByText('مرحباً، ما هي أنواع الإجازات المتاحة؟')).toBeInTheDocument();
  });

  it('handles transcript confirmation and sending', async () => {
    const user = userEvent.setup();
    mockUseVoiceRecording.transcript = 'Test transcript';
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showTranscriptPreview={true}
      />
    );
    
    const sendButton = screen.getByRole('button', { name: /send transcript/i });
    await user.click(sendButton);
    
    expect(mockOnTranscript).toHaveBeenCalledWith('Test transcript');
  });

  it('allows transcript editing before sending', async () => {
    const user = userEvent.setup();
    mockUseVoiceRecording.transcript = 'Original transcript';
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showTranscriptPreview={true}
        allowTranscriptEditing={true}
      />
    );
    
    const editButton = screen.getByRole('button', { name: /edit transcript/i });
    await user.click(editButton);
    
    const textArea = screen.getByRole('textbox');
    await user.clear(textArea);
    await user.type(textArea, 'Edited transcript');
    
    const sendButton = screen.getByRole('button', { name: /send transcript/i });
    await user.click(sendButton);
    
    expect(mockOnTranscript).toHaveBeenCalledWith('Edited transcript');
  });

  it('displays language selection for speech recognition', () => {
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showLanguageSelector={true}
      />
    );
    
    expect(screen.getByRole('combobox', { name: /recognition language/i })).toBeInTheDocument();
    expect(screen.getByText('العربية (السعودية)')).toBeInTheDocument();
    expect(screen.getByText('English (US)')).toBeInTheDocument();
  });

  it('handles language change for speech recognition', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showLanguageSelector={true}
      />
    );
    
    const languageSelect = screen.getByRole('combobox');
    await user.selectOptions(languageSelect, 'en-US');
    
    // Should update the recognition language
    expect(languageSelect).toHaveValue('en-US');
  });

  it('shows voice settings panel', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showSettings={true}
      />
    );
    
    const settingsButton = screen.getByRole('button', { name: /voice settings/i });
    await user.click(settingsButton);
    
    expect(screen.getByTestId('voice-settings-panel')).toBeInTheDocument();
    expect(screen.getByText(/speech recognition/i)).toBeInTheDocument();
    expect(screen.getByText(/text to speech/i)).toBeInTheDocument();
  });

  it('handles TTS voice selection', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showSettings={true}
      />
    );
    
    // Open settings
    await user.click(screen.getByRole('button', { name: /voice settings/i }));
    
    const voiceSelect = screen.getByRole('combobox', { name: /tts voice/i });
    await user.selectOptions(voiceSelect, 'Arabic Female');
    
    expect(mockUseTextToSpeech.setVoice).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Arabic Female' })
    );
  });

  it('handles TTS rate and pitch adjustment', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showSettings={true}
      />
    );
    
    // Open settings
    await user.click(screen.getByRole('button', { name: /voice settings/i }));
    
    const rateSlider = screen.getByRole('slider', { name: /speech rate/i });
    fireEvent.change(rateSlider, { target: { value: '1.5' } });
    
    expect(mockUseTextToSpeech.setRate).toHaveBeenCalledWith(1.5);
    
    const pitchSlider = screen.getByRole('slider', { name: /speech pitch/i });
    fireEvent.change(pitchSlider, { target: { value: '0.8' } });
    
    expect(mockUseTextToSpeech.setPitch).toHaveBeenCalledWith(0.8);
  });

  it('displays error messages', () => {
    mockUseVoiceRecording.error = 'Microphone access denied';
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('handles error dismissal', async () => {
    const user = userEvent.setup();
    mockUseVoiceRecording.error = 'Network error';
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissButton);
    
    expect(mockUseVoiceRecording.clearError).toHaveBeenCalled();
  });

  it('supports pause and resume during recording', async () => {
    const user = userEvent.setup();
    mockUseVoiceRecording.isRecording = true;
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        showPauseResume={true}
      />
    );
    
    const pauseButton = screen.getByRole('button', { name: /pause recording/i });
    await user.click(pauseButton);
    
    expect(mockUseVoiceRecording.pauseRecording).toHaveBeenCalled();
    
    // Mock paused state
    mockUseVoiceRecording.isPaused = true;
    
    const resumeButton = screen.getByRole('button', { name: /resume recording/i });
    await user.click(resumeButton);
    
    expect(mockUseVoiceRecording.resumeRecording).toHaveBeenCalled();
  });

  it('is accessible with proper ARIA attributes', () => {
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    const controlsContainer = screen.getByRole('region', { name: /voice chat controls/i });
    expect(controlsContainer).toBeInTheDocument();
    
    const recordButton = screen.getByRole('button', { name: /start recording/i });
    expect(recordButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates ARIA attributes during recording', () => {
    mockUseVoiceRecording.isRecording = true;
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    const recordButton = screen.getByRole('button', { name: /stop recording/i });
    expect(recordButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('provides keyboard shortcuts', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        enableKeyboardShortcuts={true}
      />
    );
    
    // Test Space bar to start/stop recording
    await user.keyboard('{Space}');
    expect(mockUseVoiceRecording.startRecording).toHaveBeenCalled();
    
    // Test Escape to cancel
    await user.keyboard('{Escape}');
    expect(mockUseVoiceRecording.stopRecording).toHaveBeenCalled();
  });

  it('supports continuous recording mode', () => {
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
        continuousMode={true}
      />
    );
    
    expect(screen.getByText(/continuous mode/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /auto-send/i })).toBeInTheDocument();
  });

  it('handles microphone permission requests', async () => {
    // Mock permission API
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: jest.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
    
    render(
      <VoiceChatControls 
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );
    
    await waitFor(() => {
      expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'microphone' });
    });
  });
});