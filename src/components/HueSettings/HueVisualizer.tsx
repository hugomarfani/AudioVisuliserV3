import React, { useEffect, useState, useRef } from 'react';
import { useHue } from '../../hooks/useHue';

interface HueVisualizerProps {
  audioData?: Uint8Array;
  dominantColors?: number[][];
  isPlaying: boolean;
}

/**
 * Component that syncs Phillips Hue lights with audio visualization
 * Detects beats and sends data to HueService for processing
 */
const HueVisualizer: React.FC<HueVisualizerProps> = ({
  audioData,
  dominantColors,
  isPlaying
}) => {
  const { isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming } = useHue();
  const [isConnected, setIsConnected] = useState(false);
  const lastUpdateTime = useRef(0);
  const updateIntervalMs = useRef(50); // Milliseconds between updates

  // Beat detection state
  const energyHistory = useRef<number[]>([]);
  const beatThreshold = useRef(1.5); // Multiplier for beat detection
  const beatHoldTime = useRef(100); // How long to hold a beat (ms)
  const lastBeatTime = useRef(0);

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

  // Process audio data and detect beats
  useEffect(() => {
    if (!isConnected || !isStreamingActive || !audioData || audioData.length === 0) return;

    const now = Date.now();
    if (now - lastUpdateTime.current < updateIntervalMs.current) return;

    const processBeatDetection = async () => {
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
        const isBeat = totalEnergy > avgEnergy * beatThreshold.current &&
                       now - lastBeatTime.current > beatHoldTime.current;

        // If beat detected, update the last beat time
        if (isBeat) {
          lastBeatTime.current = now;
        }

        // Scale energy values for better visualization (0-255 range)
        const scaledBassEnergy = Math.min(255, bassEnergy * 2);
        const scaledMidEnergy = Math.min(255, midEnergy * 2);
        const scaledHighEnergy = Math.min(255, highEnergy * 2);

        // Instead of controlling lights directly, send beat data to HueService
        await window.electron.hue.processBeat({
          isBeat,
          energy: totalEnergy,
          bassEnergy: scaledBassEnergy,
          midEnergy: scaledMidEnergy,
          highEnergy: scaledHighEnergy
        });

      } catch (error) {
        console.error('Error processing beat data:', error);
      }

      lastUpdateTime.current = now;
    };

    processBeatDetection();
  }, [audioData, isConnected, isStreamingActive]);

  return null; // This component doesn't render any UI
};

export default HueVisualizer;
