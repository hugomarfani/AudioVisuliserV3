import React, { useEffect, useState, useRef } from 'react';
import { useHue } from '../../hooks/useHue';

interface HueVisualizerProps {
  audioData?: Uint8Array;
  dominantColors?: number[][];
  isPlaying: boolean;
}

/**
 * Component that syncs Phillips Hue lights with audio visualization
 * Enhanced with beat detection for rhythmic light pulsing
 */
const HueVisualizer: React.FC<HueVisualizerProps> = ({
  audioData,
  dominantColors,
  isPlaying
}) => {
  const { isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming, setLightColor, testLights } = useHue();
  const [isConnected, setIsConnected] = useState(false);
  const lastColorUpdateTime = useRef(0);
  const updateIntervalMs = useRef(50); // Faster updates for better responsiveness

  // Beat detection state
  const energyHistory = useRef<number[]>([]);
  const beatThreshold = useRef(1.5); // Multiplier for beat detection
  const beatHoldTime = useRef(100); // How long to hold a beat color (ms)
  const lastBeatTime = useRef(0);
  const isBeat = useRef(false);

  // Color transition state
  const currentColor = useRef<number[]>([255, 255, 255]);
  const targetColor = useRef<number[]>([255, 255, 255]);
  const colorTransitionSpeed = useRef(0.3); // How fast colors blend (0-1)

  // Start/stop streaming based on playback state
  useEffect(() => {
    const connectToHue = async () => {
      if (isPlaying && isConfigured && !isStreamingActive) {
        const success = await startHueStreaming();
        setIsConnected(success);
      } else if (!isPlaying && isStreamingActive) {
        await stopHueStreaming();
        setIsConnected(false);
      }
    };

    connectToHue();

    // Cleanup on unmount
    return () => {
      if (isStreamingActive) {
        stopHueStreaming();
      }
    };
  }, [isPlaying, isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming]);

  // Detect beats and update light colors
  useEffect(() => {
    if (!isConnected || !isStreamingActive || !audioData || audioData.length === 0) return;

    const now = Date.now();
    if (now - lastColorUpdateTime.current < updateIntervalMs.current) return;

    const updateLights = async () => {
      try {
        // Split frequency data into segments
        const bassRange = Math.floor(audioData.length * 0.1); // Lower 10% for bass
        const bassSegment = audioData.slice(0, bassRange);
        const midSegment = audioData.slice(bassRange, Math.floor(audioData.length * 0.6));
        const highSegment = audioData.slice(Math.floor(audioData.length * 0.6));

        // Calculate energy levels
        const bassEnergy = bassSegment.reduce((sum, val) => sum + val, 0) / bassSegment.length;
        const midEnergy = midSegment.reduce((sum, val) => sum + val, 0) / midSegment.length;
        const highEnergy = highSegment.reduce((sum, val) => sum + val, 0) / highSegment.length;

        // Calculate total energy for beat detection (emphasize bass)
        const totalEnergy = (bassEnergy * 2 + midEnergy + highEnergy) / 4;

        // Update energy history (keep last 20 samples)
        energyHistory.current.push(totalEnergy);
        if (energyHistory.current.length > 20) {
          energyHistory.current.shift();
        }

        // Calculate average energy from history
        const avgEnergy = energyHistory.current.reduce((sum, e) => sum + e, 0) /
                          Math.max(1, energyHistory.current.length);

        // Beat detection
        const beatDetected = totalEnergy > avgEnergy * beatThreshold.current &&
                             now - lastBeatTime.current > beatHoldTime.current;

        if (beatDetected) {
          lastBeatTime.current = now;
          isBeat.current = true;

          // On beat: select a new target color
          if (dominantColors && dominantColors.length > 0) {
            // Use dominant colors if available
            const randomIndex = Math.floor(Math.random() * dominantColors.length);
            targetColor.current = dominantColors[randomIndex];
          } else {
            // Or create a color based on frequency content
            targetColor.current = [
              Math.min(255, bassEnergy * 3),
              Math.min(255, midEnergy * 2.5),
              Math.min(255, highEnergy * 2)
            ];
          }

          // On beat: make lights brighter suddenly
          const intensity = Math.min(255, avgEnergy * 4);
          const beatColor = targetColor.current.map(c => Math.min(255, c * 1.5));
          await setLightColor([0], beatColor, 10); // Fast transition
        } else if (isBeat.current && now - lastBeatTime.current > beatHoldTime.current) {
          isBeat.current = false;
        }

        // Gradually transition current color toward target color
        if (!isBeat.current) {
          currentColor.current = currentColor.current.map((c, i) => {
            return c + (targetColor.current[i] - c) * colorTransitionSpeed.current;
          });

          // Calculate transition time based on music tempo
          // Faster songs = faster transitions
          const energyRatio = totalEnergy / (avgEnergy || 1);
          const transitionTime = Math.max(50, 300 - energyRatio * 100);

          await setLightColor([0], currentColor.current, transitionTime);

          // If there are multiple lights, create more complex patterns
          if (dominantColors && dominantColors.length > 1) {
            // Create wave-like effects across multiple lights
            for (let i = 1; i < Math.min(5, dominantColors.length); i++) {
              const phaseOffset = (now % 1000) / 1000; // 0-1 phase
              const pulseAmount = 0.5 + 0.5 * Math.sin(2 * Math.PI * (phaseOffset + i * 0.2));

              const lightColor = dominantColors[i].map((c) =>
                Math.round(c * (0.3 + 0.7 * pulseAmount))
              );

              await setLightColor([i], lightColor, transitionTime);
            }
          }
        }
      } catch (error) {
        console.error('Error updating light colors:', error);
      }

      lastColorUpdateTime.current = now;
    };

    updateLights();
  }, [audioData, dominantColors, isConnected, isStreamingActive, setLightColor]);

  return null; // This component doesn't render any UI
};

export default HueVisualizer;
