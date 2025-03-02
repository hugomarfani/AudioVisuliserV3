import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { hsvToRgb } from '../../utils/AudioAnalysisUtils';

interface HueMusicVisualizerProps {
  audioData?: Uint8Array | null;
  colorMode: 'spectrum' | 'intensity' | 'pulse';
  sensitivity: number;
  height?: number;
}

const HueMusicVisualizer: React.FC<HueMusicVisualizerProps> = ({
  audioData,
  colorMode,
  sensitivity,
  height = 150
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Draw visualization on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    // Draw visualization
    const draw = () => {
      resizeCanvas();

      // Clear canvas
      ctx.fillStyle = 'rgb(15, 15, 15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (audioData && audioData.length > 0) {
        const bufferLength = audioData.length;

        switch (colorMode) {
          case 'spectrum': {
            // Draw frequency spectrum
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              // Apply sensitivity
              const barHeight = audioData[i] * (sensitivity / 10);

              // Map index to hue (0-360)
              const hue = (i / bufferLength) * 360;

              // Draw bar with color based on frequency
              ctx.fillStyle = `hsl(${hue}, 100%, ${Math.min(50, barHeight / 4 + 20)}%)`;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

              x += barWidth + 1;
            }
            break;
          }

          case 'intensity': {
            // Calculate overall volume level
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += audioData[i];
            }
            const average = sum / bufferLength;
            const scaledAverage = average * (sensitivity / 5);

            // Visualize as expanding circle
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.min(canvas.width, canvas.height) * 0.45;
            const radius = (scaledAverage / 255) * maxRadius;

            // Create gradient from center
            const gradient = ctx.createRadialGradient(
              centerX, centerY, 0,
              centerX, centerY, radius
            );

            // Map intensity to warm white -> bright blue
            const hue = Math.min(240, 30 + (scaledAverage / 255) * 210);
            const saturation = 0.3 + (scaledAverage / 255) * 0.7;

            gradient.addColorStop(0, `hsla(${hue}, ${saturation * 100}%, 50%, 1)`);
            gradient.addColorStop(0.7, `hsla(${hue}, ${saturation * 100}%, 40%, 0.5)`);
            gradient.addColorStop(1, `hsla(${hue}, ${saturation * 100}%, 30%, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Add outer ring
            ctx.strokeStyle = `hsla(${hue}, ${saturation * 100}%, 60%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();

            break;
          }

          case 'pulse': {
            // Find peak frequency
            let peakIndex = 0;
            let peakValue = 0;
            for (let i = 0; i < bufferLength; i++) {
              if (audioData[i] > peakValue) {
                peakValue = audioData[i];
                peakIndex = i;
              }
            }

            // Use peak frequency to determine visualization
            const amplitude = peakValue * (sensitivity / 10);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Map peak index to hue
            const hue = (peakIndex / bufferLength) * 360;
            const [r, g, b] = hsvToRgb(hue / 360, 1, Math.min(1, amplitude / 128));

            // Create multiple pulsing circles
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

            // Add center circle that grows with peak
            ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, 0.9)`;
            ctx.beginPath();
            ctx.arc(
              centerX,
              centerY,
              (amplitude / 255) * Math.min(canvas.width, canvas.height) * 0.15,
              0,
              Math.PI * 2
            );
            ctx.fill();

            break;
          }
        }
      }

      // Continue animation
      animationRef.current = requestAnimationFrame(draw);
    };

    // Start animation
    animationRef.current = requestAnimationFrame(draw);

    // Clean up
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, colorMode, sensitivity]);

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
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </Box>
  );
};

export default HueMusicVisualizer;
