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

  // Beat detection state
  const [isBeat, setIsBeat] = useState(false);
  const [beatIntensity, setBeatIntensity] = useState(0);
  const energyHistory = useRef<number[]>([]);
  const beatThreshold = useRef(0.8);
  const lastBeatTime = useRef(0);

  // Fetch light information including positions from entertainment setup
  useEffect(() => {
    const fetchLightPositions = async () => {
      if (!isConfigured || !hueSettings) return;

      try {
        console.log('Fetching light positions from entertainment configuration');

        // Use bridge API to get entertainment configuration with light positions
        // This should ideally come from the actual Hue bridge data
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

  // Beat detection function
  const detectBeat = (audioDataArray: Uint8Array): { isBeat: boolean, intensity: number } => {
    if (!audioDataArray || audioDataArray.length === 0) {
      return { isBeat: false, intensity: 0 };
    }

    // Calculate energy from lower frequency bands (bass frequencies)
    // Use only the first 30% of frequency bands which contain most of the bass
    const bassRange = Math.floor(audioDataArray.length * 0.3);
    let energy = 0;

    for (let i = 0; i < bassRange; i++) {
      // Weight lower frequencies more heavily
      const weight = 1 - (i / bassRange);
      energy += (audioDataArray[i] / 255) * weight;
    }

    // Normalize energy to a 0-1 scale
    energy = energy / bassRange;

    // Add to history
    energyHistory.current.push(energy);

    // Keep history at a reasonable size
    if (energyHistory.current.length > 50) {
      energyHistory.current.shift();
    }

    // Calculate average energy
    const avgEnergy = energyHistory.current.reduce((sum, e) => sum + e, 0) / energyHistory.current.length;

    // Dynamically adjust threshold based on recent history
    if (energyHistory.current.length > 20) {
      // Adjust threshold to be slightly above average
      beatThreshold.current = avgEnergy * 1.15;
    }

    // Detect beat - energy must exceed threshold and must have been at least 100ms since last beat
    const now = Date.now();
    const timeSinceLastBeat = now - lastBeatTime.current;
    const beatDetected = energy > beatThreshold.current && energy > avgEnergy * 1.2 && timeSinceLastBeat > 100;

    // Calculate beat intensity - how much the current energy exceeds the threshold
    const intensity = beatDetected
      ? Math.min(1, (energy - beatThreshold.current) / beatThreshold.current * 2)
      : 0;

    if (beatDetected) {
      lastBeatTime.current = now;
      console.log(`Beat detected! Energy: ${energy.toFixed(2)}, Threshold: ${beatThreshold.current.toFixed(2)}, Intensity: ${intensity.toFixed(2)}`);
    }

    return { isBeat: beatDetected, intensity };
  };

  // Update lights based on particle distribution, colors, and audio data
  useEffect(() => {
    if (!isStreamingActive || !isPlaying || lightIds.length === 0) return;

    // Function to visualize the current frame
    const visualizeFrame = () => {
      const now = Date.now();

      // Limit updates to 20 per second to avoid overwhelming the Hue bridge
      if (now - lastUpdateRef.current >= 50) {
        lastUpdateRef.current = now;

        // Process audio data for beat detection
        let beatInfo = { isBeat: false, intensity: 0 };

        if (audioData && audioData.length > 0) {
          beatInfo = detectBeat(audioData);
          setIsBeat(beatInfo.isBeat);
          setBeatIntensity(beatInfo.intensity);
        }

        // Get base colors from dominant colors or default white
        const baseColor = dominantColors[0] || [255, 255, 255];

        // If we have particle distribution data, use it to control left/right light balance
        if (particleDistribution) {
          // Scale intensities by beat if detected
          let beatMultiplier = beatInfo.isBeat ? 1.2 + beatInfo.intensity : 1;

          // Calculate intensities based on particle distribution
          let leftIntensity = Math.min(1, particleDistribution.left * 3) * beatMultiplier;
          let rightIntensity = Math.min(1, particleDistribution.right * 3) * beatMultiplier;

          // Center intensity is average of left and right
          let centerIntensity = ((particleDistribution.left + particleDistribution.right) / 2) * beatMultiplier;

          // Increase intensity on beat
          if (beatInfo.isBeat) {
            // Flash brighter on beats
            leftIntensity = Math.min(2.0, leftIntensity + beatInfo.intensity);
            rightIntensity = Math.min(2.0, rightIntensity + beatInfo.intensity);
            centerIntensity = Math.min(2.0, centerIntensity + beatInfo.intensity);
          }

          // Scale colors based on intensity
          const leftColor = baseColor.map(val => Math.min(255, Math.round(val * leftIntensity)));
          const rightColor = baseColor.map(val => Math.min(255, Math.round(val * rightIntensity)));
          const centerColor = baseColor.map(val => Math.min(255, Math.round(val * centerIntensity)));

          // Use shorter transition times on beats for more responsiveness
          const transitionTime = beatInfo.isBeat ? 50 : 200;

          // Send colors to lights
          if (leftLights.length > 0) {
            setLightColor(leftLights, leftColor, transitionTime);
          }

          if (rightLights.length > 0) {
            setLightColor(rightLights, rightColor, transitionTime);
          }

          if (centerLights.length > 0) {
            setLightColor(centerLights, centerColor, transitionTime);
          }
        }
        // If no particle distribution, just use beat detection for all lights
        else if (audioData) {
          // Make all lights pulse with the beat
          const intensity = beatInfo.isBeat ? 1 + beatInfo.intensity : 0.7;
          const color = baseColor.map(val => Math.min(255, Math.round(val * intensity)));

          // Use shorter transition on beats
          const transitionTime = beatInfo.isBeat ? 50 : 200;

          // Apply to all lights
          setLightColor(lightIds, color, transitionTime);
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
