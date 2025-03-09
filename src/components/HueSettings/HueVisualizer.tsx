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
  const beatThreshold = useRef(1.2); // More sensitive threshold
  const beatHoldTime = useRef(100); // How long to hold a beat (ms)
  const lastBeatTime = useRef(0);

  // Animation frame reference to maintain continuous analysis
  const animationFrameRef = useRef<number | null>(null);

  // Debug counters and state
  const debugCounter = useRef(0);
  const lastLogTime = useRef(0);
  const receivingAudioData = useRef(false);

  // Keep a reference to the latest audioData
  const audioDataRef = useRef<Uint8Array | undefined>(audioData);

  // Update the ref whenever new audioData comes in
  useEffect(() => {
    audioDataRef.current = audioData;
  }, [audioData]);

  // Start/stop streaming based on playback state
  useEffect(() => {
    const connectToHue = async () => {
      if (isPlaying && isConfigured && !isStreamingActive) {
        const success = await startHueStreaming();
        setIsConnected(success);
        console.log("🔌 Hue connection attempt:", success ? "Connected!" : "Failed");
      } else if (!isPlaying && isStreamingActive) {
        await stopHueStreaming();
        setIsConnected(false);
        console.log("🔌 Hue disconnected");
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

  // Set up continuous analysis loop with RAF instead of depending on audioData changes
  useEffect(() => {
    // Define the animation loop for continuous beat detection
    const analyzeAudio = async () => {
      const now = Date.now();

      // Log status every 3 seconds for debugging
      if (now - lastLogTime.current > 3000) {
        console.log(`🎧 Continuous analysis running - isPlaying: ${isPlaying}, audioData available: ${!!audioDataRef.current}`);
        lastLogTime.current = now;
      }

      // Only process if we have audio data and enough time has passed since last update
      if (audioDataRef.current && audioDataRef.current.length > 0 && isPlaying) {
        if (!receivingAudioData.current) {
          console.log('🎵 Started receiving audio data!');
          receivingAudioData.current = true;
        }

        // Only process at our update interval rate
        if (now - lastUpdateTime.current >= updateIntervalMs.current) {
          try {
            await processBeatDetection(audioDataRef.current, now);
            lastUpdateTime.current = now;
          } catch (error) {
            console.error('Error in beat detection:', error);
          }
        }
      } else if (receivingAudioData.current && (!audioDataRef.current || !isPlaying)) {
        console.log('🔇 Audio data stopped coming in or playback paused');
        receivingAudioData.current = false;
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };

    // Start the continuous analysis loop
    console.log("🚀 Starting continuous audio analysis loop");
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);

    // Clean up on unmount or when isPlaying changes
    return () => {
      if (animationFrameRef.current) {
        console.log("⏹️ Stopping continuous audio analysis loop");
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]); // Only re-create the loop when play state changes

  // Process beat detection - separated to its own function for clarity
  const processBeatDetection = async (data: Uint8Array, now: number) => {
    debugCounter.current += 1;

    // Split frequency data into segments - focus more on bass frequencies
    const bassRange = Math.floor(data.length * 0.15); // Increased bass range
    const bassSegment = data.slice(0, bassRange);
    const midSegment = data.slice(bassRange, Math.floor(data.length * 0.6));
    const highSegment = data.slice(Math.floor(data.length * 0.6));

    // Calculate energy levels
    const bassEnergy = bassSegment.reduce((sum, val) => sum + val, 0) / bassSegment.length;
    const midEnergy = midSegment.reduce((sum, val) => sum + val, 0) / midSegment.length;
    const highEnergy = highSegment.reduce((sum, val) => sum + val, 0) / highSegment.length;

    // Calculate total energy with higher emphasis on bass
    const totalEnergy = (bassEnergy * 4 + midEnergy + highEnergy) / 6;

    // Update energy history (keep last 20 samples)
    energyHistory.current.push(totalEnergy);
    if (energyHistory.current.length > 20) {
      energyHistory.current.shift();
    }

    // Calculate average energy from history
    const avgEnergy = energyHistory.current.reduce((sum, e) => sum + e, 0) /
                      Math.max(1, energyHistory.current.length);

    // Dynamic threshold based on recent history to adapt to song
    const dynamicThreshold = Math.max(1.1, avgEnergy > 50 ? 1.2 : 1.4);

    // Beat detection
    const isBeat = totalEnergy > avgEnergy * dynamicThreshold &&
                   now - lastBeatTime.current > beatHoldTime.current &&
                   bassEnergy > 15; // Ensure bass is significant

    // Log energy levels every 20 iterations for debugging
    if (debugCounter.current % 20 === 0) {
      console.log(
        `🔊 Energy levels - Bass: ${bassEnergy.toFixed(1)}, ` +
        `Mid: ${midEnergy.toFixed(1)}, ` +
        `High: ${highEnergy.toFixed(1)}, ` +
        `Total: ${totalEnergy.toFixed(1)}, ` +
        `Avg: ${avgEnergy.toFixed(1)}, ` +
        `Threshold: ${(avgEnergy * dynamicThreshold).toFixed(1)}`
      );
    }

    if (isBeat) {
      lastBeatTime.current = now;
      console.log(`🥁 BEAT DETECTED! 🎵 Energy: ${totalEnergy.toFixed(1)} vs Threshold: ${(avgEnergy * dynamicThreshold).toFixed(1)}`);
      console.log(`   Bass: ${bassEnergy.toFixed(1)}, Mid: ${midEnergy.toFixed(1)}, High: ${highEnergy.toFixed(1)}`);
    }

    // Scale energy values for better visualization (0-255 range)
    const scaledBassEnergy = Math.min(255, bassEnergy * 2);
    const scaledMidEnergy = Math.min(255, midEnergy * 2);
    const scaledHighEnergy = Math.min(255, highEnergy * 2);

    // Send beat data to HueService
    if (isConnected && isStreamingActive) {
      await window.electron.hue.processBeat({
        isBeat,
        energy: totalEnergy,
        bassEnergy: scaledBassEnergy,
        midEnergy: scaledMidEnergy,
        highEnergy: scaledHighEnergy
      });
    }
  };

  return null; // This component doesn't render any UI
};

export default HueVisualizer;
