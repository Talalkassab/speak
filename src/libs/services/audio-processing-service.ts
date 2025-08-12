'use client';

import lamejs from 'lamejs';

export interface AudioProcessingOptions {
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  noiseReduction?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  highpassFilter?: boolean;
  lowpassFilter?: boolean;
  normalize?: boolean;
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate?: number;
  format: string;
  size: number;
}

export interface ProcessingResult {
  processedBlob: Blob;
  originalBlob: Blob;
  metadata: AudioMetadata;
  compressionRatio: number;
  processingTime: number;
}

export class AudioProcessingService {
  private audioContext: AudioContext | null = null;
  private workletRegistered = false;

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // Initialize audio processing worklet
  private async initializeWorklet(): Promise<void> {
    if (!this.audioContext || this.workletRegistered) return;

    try {
      // Register custom audio worklet for advanced processing
      const workletCode = `
        class NoiseReductionProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.previousSample = 0;
            this.alpha = 0.9; // Low-pass filter coefficient
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];

            if (input.length > 0) {
              const inputChannel = input[0];
              const outputChannel = output[0];

              for (let i = 0; i < inputChannel.length; i++) {
                // Simple noise gate
                const sample = inputChannel[i];
                const threshold = 0.01;
                
                if (Math.abs(sample) < threshold) {
                  outputChannel[i] = 0; // Silence below threshold
                } else {
                  // High-pass filter to remove low-frequency noise
                  const filtered = sample - this.alpha * this.previousSample;
                  outputChannel[i] = filtered;
                  this.previousSample = sample;
                }
              }
            }

            return true;
          }
        }

        registerProcessor('noise-reduction-processor', NoiseReductionProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletRegistered = true;
      
      URL.revokeObjectURL(workletUrl);
    } catch (error) {
      console.warn('Failed to register audio worklet:', error);
    }
  }

  // Get audio metadata
  public async getAudioMetadata(audioBlob: Blob): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(audioBlob);
      
      audio.addEventListener('loadedmetadata', () => {
        const metadata: AudioMetadata = {
          duration: audio.duration,
          sampleRate: 44100, // Default, can't get from HTML5 Audio API
          channels: 2, // Default assumption
          format: audioBlob.type,
          size: audioBlob.size,
        };
        
        URL.revokeObjectURL(url);
        resolve(metadata);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio metadata'));
      });
      
      audio.src = url;
    });
  }

  // Convert audio blob to different format
  public async convertAudioFormat(
    audioBlob: Blob, 
    targetFormat: 'mp3' | 'wav' | 'webm' | 'ogg',
    options: AudioProcessingOptions = {}
  ): Promise<Blob> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      // Decode audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Process audio if needed
      const processedBuffer = await this.processAudioBuffer(audioBuffer, options);
      
      // Convert to target format
      switch (targetFormat) {
        case 'mp3':
          return this.convertToMp3(processedBuffer, options);
        case 'wav':
          return this.convertToWav(processedBuffer, options);
        case 'webm':
          return this.convertToWebm(processedBuffer, options);
        case 'ogg':
          return this.convertToOgg(processedBuffer, options);
        default:
          throw new Error(`Unsupported target format: ${targetFormat}`);
      }
    } catch (error) {
      console.error('Audio conversion failed:', error);
      throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process audio buffer with various filters and enhancements
  private async processAudioBuffer(
    audioBuffer: AudioBuffer, 
    options: AudioProcessingOptions
  ): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const {
      noiseReduction = false,
      echoCancellation = false,
      autoGainControl = false,
      highpassFilter = false,
      lowpassFilter = false,
      normalize = false,
    } = options;

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    let currentNode: AudioNode = source;

    // Apply high-pass filter (remove low-frequency noise)
    if (highpassFilter) {
      const highpass = offlineContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 300; // Remove frequencies below 300Hz
      currentNode.connect(highpass);
      currentNode = highpass;
    }

    // Apply low-pass filter (remove high-frequency noise)
    if (lowpassFilter) {
      const lowpass = offlineContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 8000; // Remove frequencies above 8kHz
      currentNode.connect(lowpass);
      currentNode = lowpass;
    }

    // Apply noise reduction using custom worklet
    if (noiseReduction && this.workletRegistered) {
      try {
        const noiseReduction = new AudioWorkletNode(offlineContext, 'noise-reduction-processor');
        currentNode.connect(noiseReduction);
        currentNode = noiseReduction;
      } catch (error) {
        console.warn('Noise reduction worklet not available, skipping');
      }
    }

    // Apply auto gain control (simple compressor)
    if (autoGainControl) {
      const compressor = offlineContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      currentNode.connect(compressor);
      currentNode = compressor;
    }

    // Connect to destination
    currentNode.connect(offlineContext.destination);
    source.start(0);

    // Render the processed audio
    let processedBuffer = await offlineContext.startRendering();

    // Apply normalization if requested
    if (normalize) {
      processedBuffer = this.normalizeAudioBuffer(processedBuffer);
    }

    return processedBuffer;
  }

  // Normalize audio buffer levels
  private normalizeAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const processedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      // Find peak level
      let peak = 0;
      for (let i = 0; i < inputData.length; i++) {
        peak = Math.max(peak, Math.abs(inputData[i]));
      }
      
      // Normalize to 0.9 to avoid clipping
      const targetLevel = 0.9;
      const gain = peak > 0 ? targetLevel / peak : 1;
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * gain;
      }
    }

    return processedBuffer;
  }

  // Convert audio buffer to MP3 using lamejs
  private async convertToMp3(
    audioBuffer: AudioBuffer, 
    options: AudioProcessingOptions
  ): Promise<Blob> {
    const { bitRate = 128, sampleRate = 44100 } = options;
    
    const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, sampleRate, bitRate);
    const mp3Data = [];
    
    const samples = new Int16Array(audioBuffer.length * audioBuffer.numberOfChannels);
    
    // Interleave channels
    if (audioBuffer.numberOfChannels === 1) {
      const data = audioBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        samples[i] = Math.max(-1, Math.min(1, data[i])) * 0x7FFF;
      }
    } else if (audioBuffer.numberOfChannels === 2) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < left.length; i++) {
        samples[i * 2] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;
        samples[i * 2 + 1] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
      }
    }
    
    // Encode in chunks
    const chunkSize = 1152; // MP3 frame size
    for (let i = 0; i < samples.length; i += chunkSize * audioBuffer.numberOfChannels) {
      const chunk = samples.subarray(i, i + chunkSize * audioBuffer.numberOfChannels);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    
    // Finalize encoding
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    
    return new Blob(mp3Data, { type: 'audio/mpeg' });
  }

  // Convert audio buffer to WAV
  private async convertToWav(
    audioBuffer: AudioBuffer, 
    options: AudioProcessingOptions
  ): Promise<Blob> {
    const { sampleRate = 44100, channels = audioBuffer.numberOfChannels } = options;
    
    const length = audioBuffer.length;
    const buffer = new ArrayBuffer(44 + length * channels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * channels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * channels * 2, true);
    
    // Convert audio data
    const offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset + (i * channels + channel) * 2, sample * 0x7FFF, true);
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Convert to WebM (placeholder - requires MediaRecorder API)
  private async convertToWebm(
    audioBuffer: AudioBuffer, 
    options: AudioProcessingOptions
  ): Promise<Blob> {
    // WebM encoding requires MediaRecorder API with WebM support
    // This is a simplified implementation
    throw new Error('WebM conversion not yet implemented - use MediaRecorder API directly');
  }

  // Convert to OGG (placeholder - requires external library)
  private async convertToOgg(
    audioBuffer: AudioBuffer, 
    options: AudioProcessingOptions
  ): Promise<Blob> {
    throw new Error('OGG conversion not yet implemented - requires additional library');
  }

  // Compress audio for storage/transmission
  public async compressAudio(
    audioBlob: Blob, 
    compressionLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const originalMetadata = await this.getAudioMetadata(audioBlob);
    
    const compressionSettings = {
      low: { bitRate: 192, sampleRate: 44100 },
      medium: { bitRate: 128, sampleRate: 44100 },
      high: { bitRate: 64, sampleRate: 22050 },
    };
    
    const settings = compressionSettings[compressionLevel];
    
    try {
      const compressedBlob = await this.convertAudioFormat(audioBlob, 'mp3', settings);
      const compressedMetadata = await this.getAudioMetadata(compressedBlob);
      
      return {
        processedBlob: compressedBlob,
        originalBlob: audioBlob,
        metadata: compressedMetadata,
        compressionRatio: originalMetadata.size / compressedMetadata.size,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Audio compression failed:', error);
      throw new Error(`Audio compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhance audio quality for speech recognition
  public async enhanceForSpeechRecognition(audioBlob: Blob): Promise<Blob> {
    const enhancementOptions: AudioProcessingOptions = {
      sampleRate: 16000, // Optimal for speech recognition
      channels: 1, // Mono
      noiseReduction: true,
      echoCancellation: true,
      autoGainControl: true,
      highpassFilter: true, // Remove low-frequency noise
      normalize: true,
    };
    
    await this.initializeWorklet();
    
    try {
      return await this.convertAudioFormat(audioBlob, 'wav', enhancementOptions);
    } catch (error) {
      console.warn('Audio enhancement failed, returning original:', error);
      return audioBlob;
    }
  }

  // Trim silence from beginning and end of audio
  public async trimSilence(audioBlob: Blob, threshold = 0.01): Promise<Blob> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      let start = 0;
      let end = channelData.length - 1;
      
      // Find start of audio (first sample above threshold)
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > threshold) {
          start = i;
          break;
        }
      }
      
      // Find end of audio (last sample above threshold)
      for (let i = channelData.length - 1; i >= 0; i--) {
        if (Math.abs(channelData[i]) > threshold) {
          end = i;
          break;
        }
      }
      
      // Create trimmed buffer
      const trimmedLength = end - start + 1;
      const trimmedBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        trimmedLength,
        audioBuffer.sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = trimmedBuffer.getChannelData(channel);
        
        for (let i = 0; i < trimmedLength; i++) {
          outputData[i] = inputData[start + i];
        }
      }
      
      // Convert back to blob
      return await this.convertToWav(trimmedBuffer, {});
      
    } catch (error) {
      console.warn('Silence trimming failed, returning original:', error);
      return audioBlob;
    }
  }

  // Analyze audio levels and provide feedback
  public async analyzeAudioLevels(audioBlob: Blob): Promise<{
    averageLevel: number;
    peakLevel: number;
    dynamicRange: number;
    tooQuiet: boolean;
    tooLoud: boolean;
    clipping: boolean;
  }> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      
      let sum = 0;
      let peak = 0;
      let clippingCount = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        sum += sample;
        peak = Math.max(peak, sample);
        
        if (sample >= 0.99) {
          clippingCount++;
        }
      }
      
      const average = sum / channelData.length;
      const dynamicRange = peak - average;
      
      return {
        averageLevel: average,
        peakLevel: peak,
        dynamicRange,
        tooQuiet: peak < 0.1,
        tooLoud: peak > 0.95,
        clipping: clippingCount > channelData.length * 0.001, // More than 0.1% clipping
      };
      
    } catch (error) {
      console.error('Audio analysis failed:', error);
      throw new Error('Failed to analyze audio levels');
    }
  }

  // Cleanup resources
  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton instance
export const audioProcessingService = new AudioProcessingService();
export default audioProcessingService;