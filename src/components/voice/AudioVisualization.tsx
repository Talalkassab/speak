'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/utils/cn';
import { AudioVisualizationData } from '@/types/voice';

interface AudioVisualizationProps {
  audioLevel: number;
  isRecording: boolean;
  isPaused?: boolean;
  className?: string;
  variant?: 'waveform' | 'bars' | 'circle' | 'pulse';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showFrequency?: boolean;
  animate?: boolean;
}

interface VisualizationStyles {
  container: string;
  primaryColor: string;
  secondaryColor: string;
  size: {
    width: number;
    height: number;
    barWidth?: number;
  };
}

export function AudioVisualization({
  audioLevel,
  isRecording,
  isPaused = false,
  className,
  variant = 'bars',
  color = 'saudi-navy',
  size = 'md',
  showFrequency = false,
  animate = true,
}: AudioVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [visualizationData, setVisualizationData] = useState<AudioVisualizationData>({
    waveform: [],
    frequencyData: [],
    volume: 0,
    timestamp: Date.now(),
  });

  // Get styles based on props
  const getStyles = useCallback((): VisualizationStyles => {
    const sizes = {
      sm: { width: 120, height: 40, barWidth: 3 },
      md: { width: 200, height: 60, barWidth: 4 },
      lg: { width: 300, height: 80, barWidth: 5 },
    };

    return {
      container: cn(
        'flex items-center justify-center rounded-lg border-2 transition-all duration-200',
        isRecording && !isPaused
          ? `border-${color}-500 bg-${color}-50`
          : isPaused
          ? `border-orange-300 bg-orange-50`
          : 'border-gray-300 bg-gray-50'
      ),
      primaryColor: isRecording && !isPaused
        ? `rgb(var(--${color}-500))`
        : isPaused
        ? 'rgb(var(--orange-500))'
        : 'rgb(var(--gray-400))',
      secondaryColor: isRecording && !isPaused
        ? `rgb(var(--${color}-300))`
        : isPaused
        ? 'rgb(var(--orange-300))'
        : 'rgb(var(--gray-300))',
      size: sizes[size],
    };
  }, [color, isRecording, isPaused, size]);

  // Generate mock frequency data based on audio level
  const generateVisualizationData = useCallback((level: number): AudioVisualizationData => {
    const barCount = variant === 'bars' ? 32 : 64;
    const waveformLength = 128;
    
    // Generate realistic audio visualization data
    const waveform: number[] = [];
    const frequencyData: number[] = [];
    
    // Base noise level
    const noiseLevel = 0.1;
    
    for (let i = 0; i < waveformLength; i++) {
      const t = i / waveformLength;
      let amplitude = noiseLevel;
      
      if (isRecording && !isPaused) {
        // Add voice-like frequencies
        amplitude += level * (
          Math.sin(t * Math.PI * 8) * 0.3 +
          Math.sin(t * Math.PI * 16) * 0.2 +
          Math.sin(t * Math.PI * 32) * 0.1 +
          (Math.random() - 0.5) * 0.1
        );
      }
      
      waveform.push(Math.max(0, Math.min(1, amplitude)));
    }
    
    for (let i = 0; i < barCount; i++) {
      const frequency = i / barCount;
      let amplitude = noiseLevel;
      
      if (isRecording && !isPaused) {
        // Voice typically has more energy in lower frequencies
        const voiceBoost = Math.exp(-frequency * 3) * level;
        amplitude += voiceBoost + (Math.random() - 0.5) * 0.05;
      }
      
      frequencyData.push(Math.max(0, Math.min(1, amplitude)));
    }
    
    return {
      waveform,
      frequencyData,
      volume: level,
      timestamp: Date.now(),
    };
  }, [variant, isRecording, isPaused]);

  // Draw waveform visualization
  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    styles: VisualizationStyles,
    data: AudioVisualizationData
  ) => {
    const { width, height } = styles.size;
    const centerY = height / 2;
    const maxAmplitude = height * 0.4;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform
    ctx.strokeStyle = styles.primaryColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    
    data.waveform.forEach((amplitude, index) => {
      const x = (index / data.waveform.length) * width;
      const y = centerY + (amplitude * maxAmplitude * (Math.random() > 0.5 ? 1 : -1));
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Add glow effect if recording
    if (isRecording && !isPaused && animate) {
      ctx.shadowColor = styles.primaryColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [isRecording, isPaused, animate]);

  // Draw bars visualization
  const drawBars = useCallback((
    ctx: CanvasRenderingContext2D,
    styles: VisualizationStyles,
    data: AudioVisualizationData
  ) => {
    const { width, height, barWidth = 4 } = styles.size;
    const barCount = data.frequencyData.length;
    const barSpacing = width / barCount;
    
    ctx.clearRect(0, 0, width, height);
    
    data.frequencyData.forEach((amplitude, index) => {
      const barHeight = amplitude * height * 0.8;
      const x = index * barSpacing + (barSpacing - barWidth) / 2;
      const y = height - barHeight;
      
      // Gradient for each bar
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, styles.primaryColor);
      gradient.addColorStop(1, styles.secondaryColor);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Add glow effect if recording
      if (isRecording && !isPaused && animate) {
        ctx.shadowColor = styles.primaryColor;
        ctx.shadowBlur = 5;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.shadowBlur = 0;
      }
    });
  }, [isRecording, isPaused, animate]);

  // Draw circle visualization
  const drawCircle = useCallback((
    ctx: CanvasRenderingContext2D,
    styles: VisualizationStyles,
    data: AudioVisualizationData
  ) => {
    const { width, height } = styles.size;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;
    const currentRadius = 10 + (data.volume * maxRadius);
    
    ctx.clearRect(0, 0, width, height);
    
    // Outer circle (pulse effect)
    if (isRecording && !isPaused && animate) {
      const pulseRadius = currentRadius + Math.sin(Date.now() * 0.01) * 5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = styles.secondaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Main circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI);
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, currentRadius);
    gradient.addColorStop(0, styles.primaryColor);
    gradient.addColorStop(1, styles.secondaryColor);
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add inner circle for microphone icon effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(8, currentRadius * 0.3), 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Microphone dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = styles.primaryColor;
    ctx.fill();
  }, [isRecording, isPaused, animate]);

  // Draw pulse visualization
  const drawPulse = useCallback((
    ctx: CanvasRenderingContext2D,
    styles: VisualizationStyles,
    data: AudioVisualizationData
  ) => {
    const { width, height } = styles.size;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.clearRect(0, 0, width, height);
    
    // Multiple pulse rings
    const ringCount = 3;
    const baseRadius = 15;
    const time = Date.now() * 0.003;
    
    for (let i = 0; i < ringCount; i++) {
      const offset = (i / ringCount) * Math.PI * 2;
      const pulseStrength = isRecording && !isPaused ? data.volume : 0.1;
      const radius = baseRadius + Math.sin(time + offset) * pulseStrength * 20;
      const opacity = isRecording && !isPaused 
        ? Math.max(0.2, 1 - (i / ringCount) * 0.7) 
        : 0.3;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = styles.primaryColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    
    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = styles.primaryColor;
    ctx.fill();
  }, [isRecording, isPaused]);

  // Animation loop
  const animate_loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const styles = getStyles();
    const data = generateVisualizationData(audioLevel);
    
    setVisualizationData(data);
    
    // Draw based on variant
    switch (variant) {
      case 'waveform':
        drawWaveform(ctx, styles, data);
        break;
      case 'bars':
        drawBars(ctx, styles, data);
        break;
      case 'circle':
        drawCircle(ctx, styles, data);
        break;
      case 'pulse':
        drawPulse(ctx, styles, data);
        break;
    }
    
    // Continue animation if recording or should animate
    if ((isRecording || animate) && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(animate_loop);
    }
  }, [
    audioLevel,
    variant,
    isRecording,
    isPaused,
    animate,
    getStyles,
    generateVisualizationData,
    drawWaveform,
    drawBars,
    drawCircle,
    drawPulse,
  ]);

  // Start/stop animation
  useEffect(() => {
    if (isRecording || animate) {
      animate_loop();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, animate, animate_loop]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const styles = getStyles();
    canvas.width = styles.size.width;
    canvas.height = styles.size.height;
    
    // Initial draw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const data = generateVisualizationData(0);
      
      switch (variant) {
        case 'waveform':
          drawWaveform(ctx, styles, data);
          break;
        case 'bars':
          drawBars(ctx, styles, data);
          break;
        case 'circle':
          drawCircle(ctx, styles, data);
          break;
        case 'pulse':
          drawPulse(ctx, styles, data);
          break;
      }
    }
  }, [variant, getStyles, generateVisualizationData, drawWaveform, drawBars, drawCircle, drawPulse]);

  const styles = getStyles();
  
  return (
    <div 
      className={cn(styles.container, className)}
      style={{ 
        width: styles.size.width, 
        height: styles.size.height 
      }}
    >
      <canvas
        ref={canvasRef}
        className="rounded-lg"
        width={styles.size.width}
        height={styles.size.height}
      />
      
      {/* Audio level indicator */}
      {showFrequency && (
        <div className="absolute bottom-1 right-1 text-xs font-mono opacity-70">
          {Math.round(audioLevel * 100)}%
        </div>
      )}
      
      {/* Recording status indicator */}
      {isRecording && (
        <div className="absolute top-1 left-1">
          <div className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            isPaused ? 'bg-orange-500' : 'bg-red-500'
          )} />
        </div>
      )}
    </div>
  );
}

// Preset configurations
export const AudioVisualizationPresets = {
  compact: {
    variant: 'pulse' as const,
    size: 'sm' as const,
    animate: true,
  },
  standard: {
    variant: 'bars' as const,
    size: 'md' as const,
    animate: true,
    showFrequency: true,
  },
  detailed: {
    variant: 'waveform' as const,
    size: 'lg' as const,
    animate: true,
    showFrequency: true,
  },
  minimal: {
    variant: 'circle' as const,
    size: 'sm' as const,
    animate: false,
  },
};

export default AudioVisualization;