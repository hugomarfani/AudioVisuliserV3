import React, { useEffect, useState, useRef } from 'react';
import { useHue } from '../../hooks/useHue';

interface HueVisualizerProps {
  audioData?: Uint8Array;
  dominantColors: number[][];
  isPlaying: boolean;
  particleDistribution?: {
    left: number;
    right: number;
  };
}

// Interface for light with position information
interface LightWithPosition {
  id: number;
  x: number; // Normalized x position (0-1)
  y: number; // Normalized y position (0-1)
  z: number; // Normalized z position (0-1)
}

/**
 * Component that controls Hue lights based on audio and particle positions
 */
const HueVisualizer: React.FC<HueVisualizerProps> = ({
  audioData,
  dominantColors,
  isPlaying,
  particleDistribution
}) => {
  // Using the correct function names from useHue hook
  const {
    isConfigured,
    isStreamingActive,
    startHueStreaming,
    stopHueStreaming,
    setLightColor,
    hueSettings
  } = useHue();

  const [lightIds, setLightIds] = useState<number[]>([]);
  const [leftLights, setLeftLights] = useState<number[]>([]);
  const [rightLights, setRightLights] = useState<number[]>([]);
  const [centerLights, setCenterLights] = useState<number[]>([]);
  const [lightsWithPosition, setLightsWithPosition] = useState<LightWithPosition[]>([]);

  const frameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [isVisualizerActive, setIsVisualizerActive] = useState(false);

  // Beat detection state with improved sensitivity and smoother transitions
  const [isBeat, setIsBeat] = useState(false);
  const [beatIntensity, setBeatIntensity] = useState(0);
  const energyHistory = useRef<number[]>([]);
  const beatThreshold = useRef(0.8);
  const lastBeatTime = useRef(0);

  // Smoothing states for transitions
  const leftIntensityRef = useRef(0);
  const rightIntensityRef = useRef(0);
  const centerIntensityRef = useRef(0);
  const smoothingFactor = 0.15; // Lower = smoother but slower transitions
  const idleDefaultIntensity = 0.3; // Default intensity when no beat is detected

  // Amplitude tracking for general volume response
  const volumeLevel = useRef(0);
  const baselineVolume = useRef(0.1);

  // Fetch light information including positions from entertainment setup
  useEffect(() => {
    const fetchLightPositions = async () => {
      if (!isConfigured || !hueSettings) return;

      try {
        console.log('Fetching light positions from entertainment configuration');

        // Use bridge API to get entertainment configuration with light positions
        const entertainmentConfig = await window.electron.hue.getEntertainmentSetup({
          ip: hueSettings.bridge.ip,
          username: hueSettings.credentials.username,
          groupId: hueSettings.selectedGroup
        });

        if (entertainmentConfig && entertainmentConfig.lights) {
          // Map lights with their positions
          const lightsPositions = entertainmentConfig.lights.map((light: any) => ({
            id: parseInt(light.id, 10),
            x: light.position?.x || 0,
            y: light.position?.y || 0,
            z: light.position?.z || 0
          }));

          setLightsWithPosition(lightsPositions);
          console.log('Retrieved light positions:', lightsPositions);

          // Set all light IDs
          const allIds = lightsPositions.map(light => light.id);
          setLightIds(allIds);

          // Split lights into left, center, and right based on their x positions
          // X coordinate in Hue is -1 (left) to 1 (right)
          const left = lightsPositions.filter(light => light.x < -0.3).map(light => light.id);
          const center = lightsPositions.filter(light => light.x >= -0.3 && light.x <= 0.3).map(light => light.id);
          const right = lightsPositions.filter(light => light.x > 0.3).map(light => light.id);

          setLeftLights(left);
          setCenterLights(center);
          setRightLights(right);

          console.log('Light groups organized by position:', {
            left: left.join(','),
            center: center.join(','),
            right: right.join(',')
          });
        } else {
          console.warn('No entertainment configuration found or no lights in configuration');

          // Fallback to default light IDs if we can't get position data
          const defaultLightCount = 5; // Assume 5 lights by default
          const allIds = Array.from({ length: defaultLightCount }, (_, i) => i);

          setLightIds(allIds);

          // Simple fallback division: first half left, second half right
          const midpoint = Math.floor(allIds.length / 2);
          setLeftLights(allIds.slice(0, midpoint));
          setRightLights(allIds.slice(midpoint));
          setCenterLights([]);

          console.log('Using fallback light groups:', {
            left: allIds.slice(0, midpoint).join(','),
            right: allIds.slice(midpoint).join(',')
          });
        }
      } catch (error) {
        console.error('Error fetching light positions:', error);

        // Handle error with default light setup
        const defaultIds = [0, 1, 2, 3, 4];
        setLightIds(defaultIds);
        setLeftLights([0, 1]);
        setRightLights([3, 4]);
        setCenterLights([2]);
      }
    };

    fetchLightPositions();
  }, [isConfigured, hueSettings]);

  // Initialize streaming when component mounts
  useEffect(() => {
    if (isConfigured && isPlaying && !isStreamingActive) {
      console.log('Starting Hue streaming from visualizer');
      startHueStreaming();
      setIsVisualizerActive(true);
    }

    // Clean up when unmounting
    return () => {
      if (isStreamingActive) {
        console.log('Stopping Hue streaming from visualizer');
        stopHueStreaming();
        setIsVisualizerActive(false);
      }

      // Cancel animation frame
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isConfigured, isPlaying, isStreamingActive, startHueStreaming, stopHueStreaming]);

  // Detect when streaming stops - might need to restart
  useEffect(() => {
    if (isPlaying && !isStreamingActive && isConfigured && isVisualizerActive) {
      console.log('Restarting streaming because it stopped');
      startHueStreaming();
    }
  }, [isStreamingActive, isPlaying, isConfigured, isVisualizerActive, startHueStreaming]);

  // Analyze audio to detect beats and overall volume level
  const analyzeAudio = (audioDataArray: Uint8Array): {
    isBeat: boolean,
    intensity: number,
    volume: number
  } => {
    if (!audioDataArray || audioDataArray.length === 0) {
      return { isBeat: false, intensity: 0, volume: 0 };
    }

    // Calculate overall volume first (average of all frequencies)
    let overallVolume = 0;
    for (let i = 0; i < audioDataArray.length; i++) {
      overallVolume += audioDataArray[i] / 255;
    }
    overallVolume = overallVolume / audioDataArray.length;

    // Update the volume level with some smoothing
    volumeLevel.current = volumeLevel.current * 0.7 + overallVolume * 0.3;

    // For beat detection, focus on bass frequencies (first 15-20% of spectrum)
    const bassRange = Math.floor(audioDataArray.length * 0.2);
    let bassEnergy = 0;

    for (let i = 0; i < bassRange; i++) {
      // Weight lower frequencies more heavily
      const weight = 1 - (i / bassRange);
      bassEnergy += (audioDataArray[i] / 255) * weight;
    }

    // Normalize bass energy to a 0-1 scale
    bassEnergy = bassEnergy / bassRange;

    // Add to history
    energyHistory.current.push(bassEnergy);

    // Keep history at a reasonable size
    if (energyHistory.current.length > 60) {
      energyHistory.current.shift();
    }

    // Calculate average energy and variance over recent history
    const avgEnergy = energyHistory.current.reduce((sum, e) => sum + e, 0) / energyHistory.current.length;

    // Calculate variance to help with dynamic thresholds
    let variance = 0;
    for (const energy of energyHistory.current) {
      variance += Math.pow(energy - avgEnergy, 2);
    }
    variance /= energyHistory.current.length;

    // Dynamically adjust threshold based on variance and recent history
    if (energyHistory.current.length > 20) {
      // Higher variance = more dynamic audio = higher threshold
      // Lower variance = more steady audio = lower threshold
      const dynamicFactor = Math.min(1.5, Math.max(1.05, 1.1 + variance * 2));
      beatThreshold.current = avgEnergy * dynamicFactor;
    }

    // Detect beat - energy must exceed threshold and must have been at least 100ms since last beat
    const now = Date.now();
    const timeSinceLastBeat = now - lastBeatTime.current;
    const beatDetected = bassEnergy > beatThreshold.current && bassEnergy > avgEnergy * 1.2 && timeSinceLastBeat > 180;

    // Calculate beat intensity - how much the current energy exceeds the threshold
    const intensity = beatDetected
      ? Math.min(1, (bassEnergy - beatThreshold.current) / beatThreshold.current * 2)
      : 0;

    if (beatDetected) {
      lastBeatTime.current = now;
      console.log(`Beat detected! Energy: ${bassEnergy.toFixed(2)}, Threshold: ${beatThreshold.current.toFixed(2)}, Intensity: ${intensity.toFixed(2)}, Volume: ${volumeLevel.current.toFixed(2)}`);
    }

    // Update baseline volume estimation (slowly)
    baselineVolume.current = baselineVolume.current * 0.99 + volumeLevel.current * 0.01;

    // Return beat detection, intensity, and volume level
    return {
      isBeat: beatDetected,
      intensity,
      volume: Math.max(0, (volumeLevel.current - baselineVolume.current) * 3)  // Scale volume relative to baseline
    };
  };

  // Calculate smoothed light intensity based on multiple factors
  const calculateLightIntensities = (
    audioInfo: { isBeat: boolean, intensity: number, volume: number },
    distribution: { left: number, right: number } | undefined
  ): { left: number, center: number, right: number } => {
    // Start with a base intensity that responds to volume
    const baseIntensity = idleDefaultIntensity + audioInfo.volume * 0.4;

    // Distribution factors - default to even if no distribution data
    const leftFactor = distribution ? distribution.left * 3 : 1;
    const rightFactor = distribution ? distribution.right * 3 : 1;
    const centerFactor = distribution ? (distribution.left + distribution.right) / 2 : 1;

    // Target intensities based on beat, volume and particle distribution
    let targetLeft = baseIntensity * leftFactor;
    let targetRight = baseIntensity * rightFactor;
    let targetCenter = baseIntensity * centerFactor;

    // Make the lights pulse more dramatically when a beat is detected
    if (audioInfo.isBeat) {
      // Apply beat boost, scaled by the intensity
      const beatBoost = 0.3 + audioInfo.intensity * 0.7;

      // Apply particle-sensitive beat effect
      targetLeft += beatBoost * leftFactor;
      targetRight += beatBoost * rightFactor;
      targetCenter += beatBoost * centerFactor;
    }

    // Apply smoothing to create more natural transitions
    leftIntensityRef.current = leftIntensityRef.current * (1 - smoothingFactor) + targetLeft * smoothingFactor;
    rightIntensityRef.current = rightIntensityRef.current * (1 - smoothingFactor) + targetRight * smoothingFactor;
    centerIntensityRef.current = centerIntensityRef.current * (1 - smoothingFactor) + targetCenter * smoothingFactor;

    // Ensure we stay in a reasonable range (0-2)
    return {
      left: Math.min(2.0, Math.max(0, leftIntensityRef.current)),
      center: Math.min(2.0, Math.max(0, centerIntensityRef.current)),
      right: Math.min(2.0, Math.max(0, rightIntensityRef.current))
    };
  };

  // Update lights based on particle distribution, colors, and audio data
  useEffect(() => {
    if (!isStreamingActive || !isPlaying || lightIds.length === 0) return;

    // Function to visualize the current frame
    const visualizeFrame = () => {
      const now = Date.now();

      // Process frames at a steady rate (30fps is smooth enough for lights)
      if (now - lastUpdateRef.current >= 33) { // ~30fps
        lastUpdateRef.current = now;

        // Process audio data for beat detection and volume
        let audioInfo = { isBeat: false, intensity: 0, volume: 0 };

        if (audioData && audioData.length > 0) {
          audioInfo = analyzeAudio(audioData);
          setIsBeat(audioInfo.isBeat);
          setBeatIntensity(audioInfo.intensity);
        }

        // Get base colors from dominant colors or default
        const baseColor = dominantColors[0] || [255, 255, 255];

        // Calculate smoother light intensities
        const intensities = calculateLightIntensities(audioInfo, particleDistribution);

        // Scale colors based on intensity
        const leftColor = baseColor.map(val => Math.min(255, Math.round(val * intensities.left)));
        const rightColor = baseColor.map(val => Math.min(255, Math.round(val * intensities.right)));
        const centerColor = baseColor.map(val => Math.min(255, Math.round(val * intensities.center)));

        // Adaptive transition times based on whether we're on a beat
        const transitionTime = audioInfo.isBeat ? 50 : 200;

        // Apply different intensities based on particle distribution and beat
        if (leftLights.length > 0 && intensities.left > 0.05) {
          setLightColor(leftLights, leftColor, transitionTime);
        }

        if (rightLights.length > 0 && intensities.right > 0.05) {
          setLightColor(rightLights, rightColor, transitionTime);
        }

        if (centerLights.length > 0 && intensities.center > 0.05) {
          setLightColor(centerLights, centerColor, transitionTime);
        }
      }

      // Continue animation loop
      frameRef.current = requestAnimationFrame(visualizeFrame);
    };

    // Start animation frame
    frameRef.current = requestAnimationFrame(visualizeFrame);

    // Cleanup
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isStreamingActive, isPlaying, particleDistribution, dominantColors, audioData, lightIds, leftLights, rightLights, centerLights, setLightColor]);

  // No visible UI component
  return null;
};

export default HueVisualizer;
