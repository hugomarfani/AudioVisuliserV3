import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { hsvToRgb } from '../../utils/AudioAnalysisUtils';

interface HueMusicVisualizerProps {
  // Remove static audioData prop and add a getter function
  getAudioData?: () => Uint8Array | null;
  colorMode: 'spectrum' | 'intensity' | 'pulse';
  sensitivity: number;
  height?: number;
}

const HueMusicVisualizer: React.FC<HueMusicVisualizerProps> = ({
  getAudioData,
  colorMode,
  sensitivity,
  height = 150
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const draw = () => {
      resizeCanvas();
      ctx.fillStyle = 'rgb(15, 15, 15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Always fetch latest audio data via the provided getter
      const audioData = getAudioData ? getAudioData() : null;

      if (audioData && audioData.length > 0) {
        const bufferLength = audioData.length;
        switch (colorMode) {
          case 'spectrum': {
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const barHeight = audioData[i] * (sensitivity / 10);
              const hue = (i / bufferLength) * 360;
              ctx.fillStyle = `hsl(${hue}, 100%, ${Math.min(50, barHeight / 4 + 20)}%)`;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
            break;
          }
          case 'intensity': {
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += audioData[i];
            }
            const average = sum / bufferLength;
            const scaledAverage = average * (sensitivity / 5);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.min(canvas.width, canvas.height) * 0.45;
            const radius = (scaledAverage / 255) * maxRadius;
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            const hue = Math.min(240, 30 + (scaledAverage / 255) * 210);
            const saturation = 0.3 + (scaledAverage / 255) * 0.7;
            gradient.addColorStop(0, `hsla(${hue}, ${saturation * 100}%, 50%, 1)`);
            gradient.addColorStop(0.7, `hsla(${hue}, ${saturation * 100}%, 40%, 0.5)`);
            gradient.addColorStop(1, `hsla(${hue}, ${saturation * 100}%, 30%, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `hsla(${hue}, ${saturation * 100}%, 60%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'pulse': {
            let peakIndex = 0;
            let peakValue = 0;
            for (let i = 0; i < bufferLength; i++) {
              if (audioData[i] > peakValue) {
                peakValue = audioData[i];
                peakIndex = i;
              }
            }
            const amplitude = peakValue * (sensitivity / 10);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const hue = (peakIndex / bufferLength) * 360;
            const [r, g, b] = hsvToRgb(hue / 360, 1, Math.min(1, amplitude / 128));
            const numCircles = 3;
            for (let i = 0; i < numCircles; i++) {
              const pulsePhase = (Date.now() / 500 + i / numCircles) % 1;
              const pulseScale = Math.sin(pulsePhase * Math.PI);
              const radius = (0.2 + 0.3 * pulseScale) * Math.min(canvas.width, canvas.height) / 2;
              const alpha = 0.7 - 0.6 * pulseScale;
              ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${alpha})`;
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius * (amplitude / 128), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, 0.9)`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (amplitude / 255) * Math.min(canvas.width, canvas.height) * 0.15, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [colorMode, sensitivity, getAudioData]);

  return (
    <Box
      sx={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#111',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default HueMusicVisualizer;
