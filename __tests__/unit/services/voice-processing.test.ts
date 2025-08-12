/**
 * Voice Processing Service Unit Tests
 * Tests for audio processing, transcription, and voice command recognition
 */

import { AudioProcessingService } from '@/libs/services/audio-processing-service';
import { VoiceCommandService } from '@/libs/services/voice-command-service';

// Mock dependencies
jest.mock('@/libs/services/openrouter-client');
jest.mock('@/libs/logging/structured-logger');

// Mock Web Audio API
const mockAudioContext = {
  createAnalyser: jest.fn(() => ({
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
    getByteTimeDomainData: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    fftSize: 2048,
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  createScriptProcessor: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null,
  })),
  sampleRate: 44100,
  destination: {},
  close: jest.fn(),
  resume: jest.fn(),
  suspend: jest.fn(),
  state: 'running',
};

// Mock audio data
const arabicAudioTestData = {
  audioBlob: new Blob(['mock audio data'], { type: 'audio/wav' }),
  transcriptions: {
    highQuality: 'ما هي أحكام الإجازة السنوية في قانون العمل السعودي؟',
    mediumQuality: 'ما هي أحكام الإجازة السنوية في قانون العمل السعودي',
    lowQuality: 'ما هي أحكام الاجازة السنوية في قانون العمل',
    withNoise: 'ما ## أحكام ## الإجازة ## السنوية ##',
  },
  commands: {
    search: 'ابحث عن قانون العمل',
    create: 'أنشئ عقد عمل جديد',
    open: 'افتح المستند الأول',
    navigate: 'اذهب إلى الصفحة الرئيسية',
    export: 'صدر هذا التقرير',
  },
  frequencies: new Uint8Array(1024).fill(128),
  waveform: new Float32Array(1024).fill(0.5),
};

describe('Audio Processing Service', () => {
  let audioProcessingService: AudioProcessingService;
  let mockLogger: any;

  beforeEach(() => {
    // Mock global AudioContext
    global.AudioContext = jest.fn(() => mockAudioContext) as any;
    global.webkitAudioContext = jest.fn(() => mockAudioContext) as any;

    // Mock logger
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    audioProcessingService = new AudioProcessingService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Audio Initialization', () => {
    it('should initialize audio context successfully', async () => {
      const result = await audioProcessingService.initialize();
      
      expect(result.success).toBe(true);
      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Audio context initialized successfully');
    });

    it('should handle audio context creation failure', async () => {
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext not supported');
      }) as any;
      
      const service = new AudioProcessingService();
      const result = await service.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('AudioContext not supported');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize audio context', expect.any(Error));
    });

    it('should check audio feature support', () => {
      const support = audioProcessingService.checkSupport();
      
      expect(support.audioContext).toBe(true);
      expect(support.mediaRecorder).toBe(true);
      expect(support.speechRecognition).toBe(true);
      expect(support.speechSynthesis).toBe(true);
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await audioProcessingService.initialize();
    });

    it('should process Arabic audio for transcription', async () => {
      const processResult = await audioProcessingService.processAudioForTranscription(
        arabicAudioTestData.audioBlob,
        { language: 'ar-SA' }
      );

      expect(processResult.success).toBe(true);
      expect(processResult.audioBuffer).toBeDefined();
      expect(processResult.duration).toBeGreaterThan(0);
      expect(processResult.sampleRate).toBe(16000); // Optimized for speech
      expect(processResult.channels).toBe(1); // Mono for speech recognition
    });

    it('should enhance audio quality for better recognition', async () => {
      const enhancementResult = await audioProcessingService.enhanceAudioQuality(
        arabicAudioTestData.audioBlob,
        {
          removeNoise: true,
          normalizeVolume: true,
          optimizeForSpeech: true,
        }
      );

      expect(enhancementResult.success).toBe(true);
      expect(enhancementResult.enhancedBlob).toBeDefined();
      expect(enhancementResult.improvements).toEqual(
        expect.objectContaining({
          noiseReduced: true,
          volumeNormalized: true,
          speechOptimized: true,
        })
      );
    });

    it('should extract audio features for analysis', async () => {
      const features = await audioProcessingService.extractAudioFeatures(
        arabicAudioTestData.audioBlob
      );

      expect(features.duration).toBeGreaterThan(0);
      expect(features.averageVolume).toBeGreaterThan(0);
      expect(features.peakVolume).toBeGreaterThan(0);
      expect(features.silencePeriods).toBeInstanceOf(Array);
      expect(features.speechSegments).toBeInstanceOf(Array);
      expect(features.dominantFrequency).toBeGreaterThan(0);
    });

    it('should detect language from audio characteristics', async () => {
      const languageResult = await audioProcessingService.detectLanguageFromAudio(
        arabicAudioTestData.audioBlob
      );

      expect(languageResult.detectedLanguage).toBe('ar');
      expect(languageResult.confidence).toBeGreaterThan(0.8);
      expect(languageResult.alternatives).toContain('ar-SA');
    });

    it('should convert audio format for compatibility', async () => {
      const conversionResult = await audioProcessingService.convertAudioFormat(
        arabicAudioTestData.audioBlob,
        {
          outputFormat: 'mp3',
          bitrate: 128,
          sampleRate: 44100,
        }
      );

      expect(conversionResult.success).toBe(true);
      expect(conversionResult.convertedBlob).toBeDefined();
      expect(conversionResult.outputFormat).toBe('mp3');
      expect(conversionResult.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('Real-time Audio Analysis', () => {
    it('should analyze audio stream in real-time', async () => {
      const mockStream = new MediaStream();
      const analysisCallback = jest.fn();

      await audioProcessingService.startRealtimeAnalysis(mockStream, {
        onVolumeChange: analysisCallback,
        onFrequencyData: analysisCallback,
        updateInterval: 100,
      });

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should detect voice activity in real-time', async () => {
      const mockStream = new MediaStream();
      const voiceCallback = jest.fn();

      await audioProcessingService.detectVoiceActivity(mockStream, {
        onVoiceStart: voiceCallback,
        onVoiceEnd: voiceCallback,
        threshold: 0.3,
      });

      // Simulate voice detection
      const analyser = mockAudioContext.createAnalyser();
      analyser.getByteFrequencyData.mockImplementation((array) => {
        // Simulate loud audio (voice detected)
        array.fill(200);
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(voiceCallback).toHaveBeenCalledWith({
        type: 'voiceStart',
        timestamp: expect.any(Number),
        volume: expect.any(Number),
      });
    });

    it('should provide audio visualization data', async () => {
      const mockStream = new MediaStream();
      const visualizationCallback = jest.fn();

      await audioProcessingService.getVisualizationData(mockStream, {
        onUpdate: visualizationCallback,
        type: 'frequency',
        smoothing: 0.8,
      });

      expect(visualizationCallback).toHaveBeenCalledWith({
        frequencyData: expect.any(Uint8Array),
        waveformData: expect.any(Float32Array),
        volume: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing audio context gracefully', async () => {
      global.AudioContext = undefined as any;
      global.webkitAudioContext = undefined as any;

      const service = new AudioProcessingService();
      const result = await service.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('AudioContext not supported in this browser');
    });

    it('should handle corrupt audio file', async () => {
      const corruptBlob = new Blob(['invalid audio data'], { type: 'audio/wav' });

      const result = await audioProcessingService.processAudioForTranscription(corruptBlob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to decode audio');
      expect(mockLogger.error).toHaveBeenCalledWith('Audio processing failed', expect.any(Error));
    });

    it('should handle audio processing timeout', async () => {
      const largeBlob = new Blob([new ArrayBuffer(100 * 1024 * 1024)], { type: 'audio/wav' });

      const result = await audioProcessingService.processAudioForTranscription(largeBlob, {
        timeout: 1000, // 1 second timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Audio processing timeout');
    });
  });
});

describe('Voice Command Service', () => {
  let voiceCommandService: VoiceCommandService;
  let mockLogger: any;

  beforeEach(() => {
    const { StructuredLogger } = require('@/libs/logging/structured-logger');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    StructuredLogger.getInstance = jest.fn(() => mockLogger);

    voiceCommandService = new VoiceCommandService();
  });

  describe('Command Recognition', () => {
    it('should recognize Arabic search commands', async () => {
      const result = await voiceCommandService.parseCommand(
        arabicAudioTestData.commands.search,
        { language: 'ar' }
      );

      expect(result.success).toBe(true);
      expect(result.command.action).toBe('search');
      expect(result.command.entity).toBe('قانون العمل');
      expect(result.command.confidence).toBeGreaterThan(0.8);
      expect(result.command.language).toBe('ar');
    });

    it('should recognize document creation commands', async () => {
      const result = await voiceCommandService.parseCommand(
        arabicAudioTestData.commands.create,
        { language: 'ar' }
      );

      expect(result.success).toBe(true);
      expect(result.command.action).toBe('create');
      expect(result.command.entity).toBe('عقد عمل');
      expect(result.command.parameters).toEqual({
        type: 'document',
        template: 'employment_contract',
      });
    });

    it('should recognize navigation commands', async () => {
      const result = await voiceCommandService.parseCommand(
        arabicAudioTestData.commands.navigate,
        { language: 'ar' }
      );

      expect(result.success).toBe(true);
      expect(result.command.action).toBe('navigate');
      expect(result.command.destination).toBe('home');
      expect(result.command.parameters).toEqual({
        route: '/',
        method: 'push',
      });
    });

    it('should handle complex commands with multiple parameters', async () => {
      const complexCommand = 'ابحث عن عقود العمل في قسم الموارد البشرية من شهر يناير';

      const result = await voiceCommandService.parseCommand(complexCommand, {
        language: 'ar',
        includeContext: true,
      });

      expect(result.success).toBe(true);
      expect(result.command.action).toBe('search');
      expect(result.command.entity).toBe('عقود العمل');
      expect(result.command.filters).toEqual({
        department: 'الموارد البشرية',
        month: 'يناير',
      });
    });

    it('should provide suggestions for ambiguous commands', async () => {
      const ambiguousCommand = 'افتح';

      const result = await voiceCommandService.parseCommand(ambiguousCommand, {
        language: 'ar',
        provideSuggestions: true,
      });

      expect(result.success).toBe(false);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions).toContain('افتح المستند');
      expect(result.suggestions).toContain('افتح الملف');
      expect(result.suggestions).toContain('افتح الصفحة');
    });
  });

  describe('Command Execution', () => {
    it('should execute search commands', async () => {
      const command = {
        action: 'search',
        entity: 'قانون العمل',
        parameters: { type: 'documents' },
      };

      const mockSearchCallback = jest.fn();
      voiceCommandService.registerHandler('search', mockSearchCallback);

      const result = await voiceCommandService.executeCommand(command, {
        context: { userId: 'user-123', organizationId: 'org-123' },
      });

      expect(result.success).toBe(true);
      expect(mockSearchCallback).toHaveBeenCalledWith({
        query: 'قانون العمل',
        type: 'documents',
        context: { userId: 'user-123', organizationId: 'org-123' },
      });
    });

    it('should execute document creation commands', async () => {
      const command = {
        action: 'create',
        entity: 'عقد عمل',
        parameters: { template: 'employment_contract' },
      };

      const mockCreateCallback = jest.fn();
      voiceCommandService.registerHandler('create', mockCreateCallback);

      const result = await voiceCommandService.executeCommand(command);

      expect(result.success).toBe(true);
      expect(mockCreateCallback).toHaveBeenCalledWith({
        type: 'عقد عمل',
        template: 'employment_contract',
      });
    });

    it('should handle command validation errors', async () => {
      const invalidCommand = {
        action: 'invalid_action',
        entity: 'test',
      };

      const result = await voiceCommandService.executeCommand(invalidCommand);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid command action');
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid voice command', invalidCommand);
    });

    it('should support command chaining', async () => {
      const commands = [
        { action: 'search', entity: 'عقود العمل' },
        { action: 'filter', parameters: { department: 'الموارد البشرية' } },
        { action: 'sort', parameters: { by: 'date', order: 'desc' } },
      ];

      const result = await voiceCommandService.executeCommandChain(commands);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.finalResult).toBeDefined();
    });
  });

  describe('Command Learning and Adaptation', () => {
    it('should learn from user corrections', async () => {
      const originalCommand = 'ابحث عن عقد';
      const correctedCommand = 'ابحث عن عقود العمل';

      await voiceCommandService.learnFromCorrection(
        originalCommand,
        correctedCommand,
        { userId: 'user-123' }
      );

      // Test improved recognition
      const result = await voiceCommandService.parseCommand(originalCommand, {
        language: 'ar',
        usePersonalization: true,
        userId: 'user-123',
      });

      expect(result.command.entity).toBe('عقود العمل');
      expect(result.command.confidence).toBeGreaterThan(0.9);
    });

    it('should adapt to user speech patterns', async () => {
      const userCommands = [
        'ابحث عن عقود العمل',
        'اعرض عقود العمل',
        'أريد رؤية عقود العمل',
      ];

      for (const command of userCommands) {
        await voiceCommandService.recordUserPattern(command, {
          userId: 'user-123',
          action: 'search',
          entity: 'عقود العمل',
        });
      }

      const adaptedPatterns = await voiceCommandService.getUserPatterns('user-123');

      expect(adaptedPatterns.searchPatterns).toHaveLength(3);
      expect(adaptedPatterns.preferredPhrases).toContain('عقود العمل');
    });

    it('should suggest command improvements', async () => {
      const inefficientCommand = 'اذهب إلى صفحة المستندات ثم ابحث عن عقود العمل';

      const suggestions = await voiceCommandService.suggestImprovement(inefficientCommand);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].improvement).toBe('ابحث عن عقود العمل');
      expect(suggestions[0].reason).toBe('Direct search is more efficient');
      expect(suggestions[0].timeSaved).toBeGreaterThan(0);
    });
  });

  describe('Multilingual Support', () => {
    it('should handle mixed Arabic-English commands', async () => {
      const mixedCommand = 'ابحث عن employment contracts في HR department';

      const result = await voiceCommandService.parseCommand(mixedCommand, {
        language: 'mixed',
        primaryLanguage: 'ar',
      });

      expect(result.success).toBe(true);
      expect(result.command.action).toBe('search');
      expect(result.command.entity).toBe('employment contracts');
      expect(result.command.filters).toEqual({
        department: 'HR department',
      });
      expect(result.command.languages).toEqual(['ar', 'en']);
    });

    it('should translate commands between languages', async () => {
      const arabicCommand = 'ابحث عن عقود العمل';

      const translatedCommand = await voiceCommandService.translateCommand(
        arabicCommand,
        'ar',
        'en'
      );

      expect(translatedCommand.success).toBe(true);
      expect(translatedCommand.translated).toBe('search for employment contracts');
      expect(translatedCommand.preservedIntent).toBe(true);
    });
  });
});