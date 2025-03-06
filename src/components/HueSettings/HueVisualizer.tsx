import React, { useEffect, useState, useRef } from 'react';
import { useHue } from '../../hooks/useHue';

interface HueVisualizerProps {
  audioData?: Uint8Array;
  dominantColors?: number[][];
  isPlaying: boolean;
}

/**
 * Component that syncs Phillips Hue lights with audio visualization
 */
const HueVisualizer: React.FC<HueVisualizerProps> = ({ 
  audioData, 
  dominantColors,
  isPlaying 
}) => {
  const { isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming, setLightColor } = useHue();
  const [isConnected, setIsConnected] = useState(false);
  const lastColorUpdateTime = useRef(0);
  const updateIntervalMs = useRef(100); // Update lights every 100ms to avoid rate limiting

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
  }, [isPlaying, isConfigured, isStreamingActive]);

  // Update light colors based on audio data or dominant colors
  useEffect(() => {
    if (!isConnected || !isStreamingActive) return;

    const now = Date.now();
    if (now - lastColorUpdateTime.current < updateIntervalMs.current) return;

    const updateLights = async () => {
      // If we have dominant colors from the visualization, use those
      if (dominantColors && dominantColors.length > 0) {
        try {
          // Use first dominant color for all lights
          const primaryColor = dominantColors[0];
          await setLightColor([0], primaryColor, 100);
          
          // If there are multiple lights and colors, assign different colors to different lights
          if (dominantColors.length > 1) {
            for (let i = 1; i < Math.min(dominantColors.length, 5); i++) {
              await setLightColor([i], dominantColors[i], 100);
            }
          }
        } catch (error) {
          console.error('Error updating light colors:', error);
        }
      }
      // If we have audio data, create colors based on frequency bands
      else if (audioData && audioData.length > 0) {
        try {
          // Split frequency data into segments (bass, mid, high)
          const bassSegment = audioData.slice(0, audioData.length / 3);
          const midSegment = audioData.slice(audioData.length / 3, 2 * audioData.length / 3);
          const highSegment = audioData.slice(2 * audioData.length / 3);
          
          // Calculate average energy for each segment
          const bassEnergy = bassSegment.reduce((sum, val) => sum + val, 0) / bassSegment.length;
          const midEnergy = midSegment.reduce((sum, val) => sum + val, 0) / midSegment.length;
          const highEnergy = highSegment.reduce((sum, val) => sum + val, 0) / highSegment.length;
          
          // Create color from the energy levels
          const color = [
            Math.min(255, bassEnergy * 2),                       // Red (bass)
            Math.min(255, midEnergy * 2),                        // Green (mid)
            Math.min(255, highEnergy * 2)                        // Blue (high)
          ];
          
          await setLightColor([0], color, 100);
        } catch (error) {
          console.error('Error updating light colors from audio:', error);
        }
      }
      
      lastColorUpdateTime.current = now;
    };

    updateLights();
  }, [audioData, dominantColors, isConnected, isStreamingActive]);

  // This component doesn't render anything visually
  return null;
};

export default HueVisualizer;