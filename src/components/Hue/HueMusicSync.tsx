import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Switch, FormControlLabel, Slider,
  FormControl, InputLabel, MenuItem, Select,
  Button, CircularProgress, Alert, Paper, Grid,
  ToggleButtonGroup, ToggleButton, Divider
} from '@mui/material';
import HueService from '../../utils/HueService';
import {
  colorFromFrequency,
  mapRange,
  averageFrequency,
  detectBeat,
  calculateFrequencyBands,
  hsvToRgb,
  calculateBassEnergy  // Add this import
} from '../../utils/AudioAnalysisUtils';
import { useHue } from '../../context/HueContext';
import HueMusicVisualizer from './HueMusicVisualizer';
import './HueMusicVisualStyles.css';
import HueAnimations from '../../utils/HueAnimations';

interface HueMusicSyncProps {
  audioRef?: React.RefObject<HTMLAudioElement>;
  isPlaying?: boolean;
  autoFlashEnabled?: boolean; // New prop to control auto flashing
  onAutoFlashToggle?: (isEnabled: boolean) => void; // Add callback for toggle
  isVisible?: boolean; // Add prop for visibility
}

const HueMusicSync: React.FC<HueMusicSyncProps> = ({
  audioRef,
  isPlaying = false,
  autoFlashEnabled = false,
  onAutoFlashToggle,
  isVisible = true // Default to true
}) => {
  // State variables
  const [enabled, setEnabled] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(5);
  const [colorMode, setColorMode] = useState<'spectrum' | 'intensity' | 'pulse'>('spectrum');
  const [visualizer, setVisualizer] = useState<boolean>(true);
  const [beatDetected, setBeatDetected] = useState<boolean>(false);
  const [hueConnected, setHueConnected] = useState(false);
  const [selectedLights, setSelectedLights] = useState<string[]>([]);
  // Add new state to track which API mode is being used
  const [isEntertainmentAPI, setIsEntertainmentAPI] = useState<boolean>(true);
  const [selectedGroup, setSelectedGroup] = useState<string>(HueService.getConfig()?.entertainmentGroupId || '');
  const [audioElementConnected, setAudioElementConnected] = useState(false);
  // Add missing availableGroups state here
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  // Add debug state to show more info
  const [lastLightCommand, setLastLightCommand] = useState<string>("");

  // Add new state variables for additional debug options
  const [lastFlashTime, setLastFlashTime] = useState<string>('');
  const [flashColor, setFlashColor] = useState<[number, number, number]>([1, 0, 0]); // Default red

  // Use a state for config so that dependency changes trigger refetch
  const [config, setConfig] = useState(HueService.getConfig());

  // Add state for API stats
  const [apiStats, setApiStats] = useState<any>(null);

  useEffect(() => {
    setConfig(HueService.getConfig());
  }, []);

  // Add a UUID validator function
  const isValidUuid = (id: string): boolean => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id);
  };

  // Updated effect to handle error cases better and ensure UUID entertainment groups
  useEffect(() => {
    if (!config) return;
    async function fetchGroups() {
      try {
        if (HueService.hasValidConfig()) {
          const groups = await HueService.getEntertainmentGroups();

          // Filter to only include UUID format group IDs
          const validGroups = groups.filter(group => isValidUuid(group.id));

          if (validGroups.length > 0) {
            // Convert to expected format if necessary
            const formattedGroups = validGroups.map(group => {
              return {
                id: group.id,
                name: group.name || `Group ${group.id.substring(0, 8)}`
              };
            });

            setAvailableGroups(formattedGroups);

            // If current selected group not found or not a UUID, default to first group
            if (!isValidUuid(selectedGroup) || !formattedGroups.find(g => g.id === selectedGroup)) {
              const newGroupId = formattedGroups[0].id;
              console.log(`Selecting UUID entertainment group: ${newGroupId}`);
              setSelectedGroup(newGroupId);
              HueService.setEntertainmentGroupId(newGroupId);
            }
          } else {
            console.warn("No valid UUID entertainment groups found");
            // Create a fallback UUID entertainment group
            const defaultUuid = 'ef7e1b9f-159d-42f9-868f-013ec47978dc';
            setAvailableGroups([
              { id: defaultUuid, name: `Default Group (${defaultUuid.substring(0, 8)}...)` }
            ]);
            setSelectedGroup(defaultUuid);
            HueService.setEntertainmentGroupId(defaultUuid);
          }
        }
      } catch (error) {
        console.error("Error fetching entertainment groups", error);
        // Create a fallback option with UUID even when there's an error
        const defaultUuid = 'ef7e1b9f-159d-42f9-868f-013ec47978dc';
        setAvailableGroups([
          { id: defaultUuid, name: `Default Group (${defaultUuid.substring(0, 8)}...)` }
        ]);
        setSelectedGroup(defaultUuid);
        HueService.setEntertainmentGroupId(defaultUuid);
      }
    }
    fetchGroups();
  }, [config?.address]); // re-run if config becomes available

  // Refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const hueContext = useHue();

  // Track previous visibility
  const prevVisibleRef = useRef<boolean>(isVisible);

  // Load the saved settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('hueMusicSyncSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEnabled(settings.enabled || false);
      setSensitivity(settings.sensitivity || 5);
      setColorMode(settings.colorMode || 'spectrum');
      setVisualizer(settings.visualizer !== false);
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('hueMusicSyncSettings', JSON.stringify({
      enabled,
      sensitivity,
      colorMode,
      visualizer
    }));
  }, [enabled, sensitivity, colorMode, visualizer]);

  // Setup audio context and analyzer when enabled changes
  useEffect(() => {
    if (enabled && audioRef?.current) {
      if (!audioContextRef.current) {
        setupAudioAnalyzer();
      }

      if (!connected && HueService.hasValidConfig()) {
        connectToHue();
      }
    } else {
      // Disconnect from Hue if we're disabling
      if (connected) {
        disconnectFromHue();
      }
    }

    // Removed cleanup call to avoid closing the shared audio context
    return () => {};
  }, [enabled, audioRef]);

  // Watch for changes in isPlaying to start/stop analysis
  useEffect(() => {
    if (enabled && isPlaying && audioRef?.current) {
      if (!audioContextRef.current) {
        setupAudioAnalyzer();
      }

      if (!connected && HueService.hasValidConfig()) {
        connectToHue();
      }

      // Start visualization and light control
      if (!animationFrameRef.current && audioContextRef.current) {
        updateVisualization();
      }
    } else if (!isPlaying && animationFrameRef.current) {
      // Stop visualization when not playing
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPlaying, enabled]);

  // Check if we have any Hue lights configured
  useEffect(() => {
    // First check if we have a valid configuration according to HueServicess
    if (HueService.hasValidConfig()) {
      setHueConnected(true);
    }

    // Function to fetch lights that can be called multiple times
    const fetchLights = async () => {
      try {
        console.log('Attempting to fetch Hue lights...');
        const rids = await window.electron.ipcRenderer.invoke('hue:getLightRids');
        if (rids && rids.length > 0) {
          setSelectedLights(rids);
          setHueConnected(true);
          console.log(`HueMusicSync: Found ${rids.length} Hue lights:`, rids);
        } else {
          console.log('HueMusicSync: No Hue lights found via regular API');
          // Still consider Hue connected if we have a valid config
          if (HueService.hasValidConfig()) {
            console.log('HueMusicSync: Using entertainment mode only (no regular API lights found)');
            setHueConnected(true);
          }
        }
      } catch (err) {
        console.error('HueMusicSync: Error getting lights:', err);
        // Don't set hueConnected to false here in case we already determined it's true via config
      }
    };

    // Try to fetch lights right away
    fetchLights();

    // Set up a periodic refresh to try to find lights
    const lightRefreshInterval = setInterval(() => {
      if (selectedLights.length === 0 && HueService.hasValidConfig()) {
        console.log('Retrying light discovery...');
        fetchLights();
      }
    }, 5000); // Try every 5 seconds

    return () => {
      clearInterval(lightRefreshInterval);
    };
  }, []);

  // This effect controls the automatic flashing
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying && autoFlashEnabled && hueConnected && selectedLights.length > 0) {
      // Only set up the interval if auto flash is enabled
      intervalId = setInterval(() => {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // Use setLightState directly for each light as a workaround
        selectedLights.forEach(async (lightId) => {
          // Parse the hex color to RGB
          const hex = randomColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;

          // Convert RGB to XY color space
          const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
          const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
          const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;

          const sum = X + Y + Z;
          const x = sum > 0 ? X / sum : 0.33;
          const y = sum > 0 ? Y / sum : 0.33;

          await window.electron.ipcRenderer.invoke('hue:setLightState', {
            lightId,
            on: true,
            brightness: 100,
            xy: [x, y]
          });
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPlaying, hueConnected, selectedLights, autoFlashEnabled]);

  // New effect to fetch available entertainment groups on mount
  useEffect(() => {
    async function fetchGroups() {
      try {
        if (HueService.hasValidConfig()) {
          const groups = await HueService.getEntertainmentGroups();
          setAvailableGroups(groups);
          // If current selected group is not in fetched groups, update state
          if (groups.length > 0 && !groups.find(g => g.id === selectedGroup)) {
            setSelectedGroup(groups[0].id);
            HueService.setEntertainmentGroupId(groups[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching entertainment groups", error);
      }
    }
    fetchGroups();
  }, []);

  // New useEffect to re-trigger visualization when HueMusicSync is re-enabled
  useEffect(() => {
    if (enabled && isPlaying && audioRef?.current && !animationFrameRef.current) {
      updateVisualization();
    }
  }, [enabled, isPlaying]);

  // Add effect to handle visibility changes
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      console.log('HueMusicSync became visible');
      // Force analyzer setup if playing
      if (isPlaying && audioRef?.current) {
        if (!audioContextRef.current) {
          setupAudioAnalyzer();
        }

        // Ensure visualization is running
        if (enabled && !animationFrameRef.current && audioContextRef.current) {
          updateVisualization();
        }
      }
    }

    // Update the ref
    prevVisibleRef.current = isVisible;
  }, [isVisible, isPlaying]);

  // Add a function to fetch API stats periodically
  useEffect(() => {
    if (enabled && connected) {
      const statsInterval = setInterval(() => {
        const stats = HueService.getApiStats();
        setApiStats(stats);

        // Auto emergency clear if queues are too large
        if (stats.queueSizes.regular > 100 || stats.queueSizes.entertainment > 100) {
          console.warn("Queue sizes extremely large, triggering emergency clear");
          handleEmergencyClear();
        }
      }, 2000);

      return () => clearInterval(statsInterval);
    }
  }, [enabled, connected]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Properly disconnect audio nodes
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.log('Error disconnecting source node:', e);
      }
      sourceNodeRef.current = null;
      setAudioElementConnected(false); // Reset the connected flag
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        console.log('Error disconnecting analyzer:', e);
      }
      analyserRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Disconnect from Hue if necessary - now this handles cleaning up properly
    if (connected) {
      HueService.stopEntertainmentMode().catch(console.error);
      setConnected(false);
      setBeatDetected(false);
    }
  }, [connected]);

  // Setup audio analyzer
  const setupAudioAnalyzer = () => {
    if (!audioRef?.current) {
      console.warn('No audio element available. Ensure the audio element is mounted and playback is triggered by user interaction.');
      return;
    }
    try {
      // Clean up any existing connections first
      if (sourceNodeRef.current || analyserRef.current || audioContextRef.current) {
        cleanup();
      }
      // Create an audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create an analyzer node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create a buffer array for frequency data
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      // Resume context if needed (triggered by user gesture)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log("Audio context resumed");
        }).catch(err => {
          console.error("Failed to resume AudioContext:", err);
        });
      }

      // Connect the audio element to the analyzer and to the destination
      const source = audioContext.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      sourceNodeRef.current = source;
      setAudioElementConnected(true);

      console.log('Audio analyzer setup complete:', {
        bufferLength,
        fftSize: analyser.fftSize,
        state: audioContext.state
      });
    } catch (error) {
      console.error('Error setting up audio analyzer:', error);
      setError('Failed to set up audio analysis. Please click play to allow audio context initialization.');
    }
  };

  // Connect to Hue bridge with better error handling and fallback
  const connectToHue = async () => {
    if (!HueService.hasValidConfig()) {
      setError('Hue bridge not configured. Please go to Settings to set up your Hue Bridge.');
      setEnabled(false);
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('Connecting to Hue bridge...');

      // Reset connection attempts counter in HueService
      HueService.resetConnectionAttempts();

      // Force entertainment mode
      HueService.forceEntertainmentMode();

      // Try initialization with entertainment mode
      let initialized = await HueService.initialize({
        updateRate: colorMode === 'pulse' ? 30 : 20
      });

      if (!initialized) {
        console.log('First attempt failed, retrying...');
        initialized = await HueService.initialize();
      }

      if (!initialized) {
        throw new Error('Failed to initialize Hue bridge connection.');
      }

      // Start entertainment mode
      console.log('Starting entertainment mode...');
      const started = await HueService.startEntertainmentMode();

      if (!started) {
        throw new Error('Failed to start entertainment mode.');
      }

      console.log('Connected to Hue bridge successfully');
      setConnected(true);
      setIsEntertainmentAPI(HueService.isUsingEntertainmentMode());

    } catch (error: any) {
      console.error('Error connecting to Hue:', error);
      let errorMessage = error.message || 'Unknown error';
      setError(`Failed to connect to Hue: ${errorMessage}`);
      setEnabled(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from Hue with improved cleanup
  const disconnectFromHue = async () => {
    try {
      console.log('🛑 Disconnecting from Hue...');

      // Cancel animation frame first
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Stop all Hue operations
      await HueService.stopEntertainmentMode();

      setConnected(false);
      setBeatDetected(false);
      console.log('Disconnected from Hue bridge and cleaned up');

      // Send a clear notification to the UI
      setLastLightCommand('Lights dimmed and sync stopped');
    } catch (error) {
      console.error('Error disconnecting from Hue:', error);
    }
  };

  // Update visualization and control lights
  const updateVisualization = () => {
    if (!analyserRef.current || !dataArrayRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    analyser.getByteFrequencyData(dataArray);

    // IMPROVED: Make beat detection more sensitive by lowering the threshold
    const beatThreshold = 1.25 - (sensitivity / 10); // More sensitive calculation
    const isBeat = detectBeat(dataArray, beatThreshold);

    // Check if beat state changed
    if (isBeat !== beatDetected) {
      setBeatDetected(isBeat);

      // If new beat detected, send to lights immediately with enhanced animation!
      if (isBeat) {
        const energy = calculateBassEnergy(dataArray);
        console.log(`🥁 BEAT DETECTED! Energy: ${energy.toFixed(2)}`);

        // On beat detection, immediately flash the lights with animation
        if (connected || hueConnected) {
          // Generate vibrant color for beat flash
          const beatColor = generateBeatColor(dataArray);

          // ENHANCED: Make colors super vibrant
          const superBoostedColor: [number, number, number] = [
            Math.min(1, beatColor[0] * 2.0), // Double the intensity
            Math.min(1, beatColor[1] * 2.0),
            Math.min(1, beatColor[2] * 2.0)
          ];

          // Use the animation utility for beats
          HueAnimations.createBeatAnimation(superBoostedColor, energy / 100);

          setLastLightCommand(`Super Flash: ${superBoostedColor.map(v => v.toFixed(2)).join(', ')}`);
          setLastFlashTime(new Date().toLocaleTimeString());
        }
      }
    }

    if (connected) {
      // Continue regular light updates
      updateLights(dataArray, isBeat);
    }

    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  };

  // Add this improved helper function to generate super vibrant colors for beats
  // UPDATED to create more dramatic color contrasts
  const generateBeatColor = (dataArray: Uint8Array): [number, number, number] => {
    const { bass, mid, treble } = calculateFrequencyBands(dataArray);

    // Determine dominant frequency range - ENHANCED for much more vibrant colors with higher contrast
    if (bass > mid && bass > treble) {
      // Bass-heavy beat - intense red with almost no other components
      return [1, Math.random() * 0.15, 0]; // Pure intense red
    } else if (mid > treble) {
      // Mid-heavy beat - pure green/cyan with minimal red
      return [0, 1, 0.8 + Math.random() * 0.2]; // Bright green/cyan
    } else {
      // Treble-heavy beat - intense purple/blue with no green
      return [0.8 + Math.random() * 0.2, 0, 1]; // Vibrant purple/blue
    }
  };

  // Update the updateLights function for more dramatic contrast between beats and non-beats
  const updateLights = (dataArray: Uint8Array, isBeat: boolean) => {
    const bufferLength = dataArray.length;

    // Calculate audio characteristics based on sensitivity and color mode
    let rgb: [number, number, number] = [0, 0, 0];
    let transitionTime = 100; // ms

    // If a beat is detected, create a MUCH more dramatic effect
    if (isBeat) {
      // Log prominently
      console.log('🎵 STRONG BEAT → DRAMATIC FLASH MODE');

      // For beats, use extremely vivid colors with max saturation
      switch (colorMode) {
        case 'spectrum': {
          // On beat, use ULTRA vibrant version of spectrum colors
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = (sensitivity / 5) * 4.0; // Even higher boost for beats

          // Max out the colors for extreme saturation
          const r = Math.min(1, mapRange(bass * sensitivityFactor, 0, 255, 0.3, 1) * 2.5);
          const g = Math.min(1, mapRange(mid * sensitivityFactor, 0, 255, 0.3, 1) * 2.5);
          const b = Math.min(1, mapRange(treble * sensitivityFactor, 0, 255, 0.3, 1) * 2.5);

          rgb = [r, g, b];
          break;
        }

        case 'intensity':
        case 'pulse': {
          // For both these modes on a beat, use a SUPER bright flash
          const volumeLevel = averageFrequency(dataArray, 0, bufferLength);
          const hue = mapRange(volumeLevel, 0, 255, 0, 360);
          // Max saturation and brightness - completely saturated
          rgb = hsvToRgb(hue / 360, 1, 1);
          break;
        }
      }

      // NEW: Add more randomization for even more dramatic variation
      rgb = [
        Math.min(1, rgb[0] + (Math.random() * 0.2)),
        Math.min(1, rgb[1] + (Math.random() * 0.2)),
        Math.min(1, rgb[2] + (Math.random() * 0.2))
      ] as [number, number, number];

      // Use INSTANT transitions for beats
      transitionTime = 0; // Immediate for maximum impact
    } else {
      // Between beats - MAKE MUCH DIMMER for extreme contrast
      switch (colorMode) {
        case 'spectrum': {
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = sensitivity / 5;

          // Get normal color values but make them MUCH dimmer
          const r = mapRange(bass * sensitivityFactor, 0, 255, 0.02, 0.2); // Much lower range
          const g = mapRange(mid * sensitivityFactor, 0, 255, 0.02, 0.2);  // Much lower range
          const b = mapRange(treble * sensitivityFactor, 0, 255, 0.02, 0.2); // Much lower range

          // Make them extremely dim between beats for more contrast - almost off
          const overallLevel = (bass + mid + treble) / 3;
          const brightness = overallLevel < 40 ? 0.05 : 0.15; // Much dimmer

          rgb = [Math.min(1, r * brightness), Math.min(1, g * brightness), Math.min(1, b * brightness)];
          transitionTime = 400; // Slower transition to dimness
          break;
        }

        case 'intensity': {
          const volumeLevel = averageFrequency(dataArray, 0, bufferLength);
          const scaledVolume = volumeLevel * (sensitivity / 5);
          const intensity = mapRange(scaledVolume, 0, 255, 0, 0.3); // Reduced maximum intensity
          const hue = mapRange(intensity, 0, 1, 30, 260);
          const sat = mapRange(intensity, 0, 1, 0.2, 0.6);
          const val = mapRange(intensity, 0, 1, 0.02, 0.2); // Much lower brightness
          rgb = hsvToRgb(hue / 360, sat, val);
          transitionTime = 400;
          break;
        }

        case 'pulse': {
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = sensitivity / 10;
          const baseLevel = Math.max(bass, mid, treble) * sensitivityFactor;
          // Make it much dimmer between pulses
          const dimBrightness = mapRange(baseLevel, 0, 255, 0.02, 0.1); // Much lower brightness

          if (baseLevel < 30) {
            // Almost off when quiet
            rgb = [0.02, 0.02, 0.02]; // Nearly off
          } else {
            const hue = mid > bass ? 240 : 40;
            rgb = hsvToRgb(hue / 360, 0.5, dimBrightness);
          }
          transitionTime = 300;
          break;
        }
      }
    }

    // Ensure RGB values are in 0-1 range
    rgb = rgb.map(v => Math.max(0, Math.min(1, v))) as [number, number, number];

    // Send color to lights with better logging
    if (isBeat) {
      console.log(`🔴 Sending BEAT color to lights:`, {
        rgb: rgb.map(v => v.toFixed(2)),
        transitionTime,
        isBeat
      });
    }

    setLastLightCommand(`RGB: ${rgb[0].toFixed(2)}, ${rgb[1].toFixed(2)}, ${rgb[2].toFixed(2)}, Beat: ${isBeat}`);

    // Send via HueService - pass isBeat as forceSend parameter to ensure beats get priority
    HueService.sendColorTransition(rgb, transitionTime, isBeat).catch(err => {
      console.error('Error sending color to Hue:', err);
      setLastLightCommand(`Error: ${err.message}`);
      if (connected) {
        disconnectFromHue();
        setError('Connection to Hue Bridge lost. Please check your network.');
        setEnabled(false);
      }
    });

    // Also try direct command for beats
    if (isBeat && selectedLights.length > 0) {
      console.log('Sending additional direct beat command to ensure delivery');
      sendDirectLightCommand(rgb, 100); // 100% brightness on beats
    }
  };

  // Add the missing sendDirectLightCommand function
  const sendDirectLightCommand = (rgb: [number, number, number], brightness: number) => {
    if (!hueConnected || selectedLights.length === 0) return;

    try {
      // Convert RGB to XY color space for Hue
      const r = rgb[0], g = rgb[1], b = rgb[2];
      const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
      const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
      const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;

      const sum = X + Y + Z;
      const x = sum > 0 ? X / sum : 0.33;
      const y = sum > 0 ? Y / sum : 0.33;

      // Enhanced logging
      console.log('Direct light command:', {
        rgb,
        xy: [x, y],
        brightness,
        lights: selectedLights
      });

      // Add timestamp to log for tracking command timing
      console.log(`Light command sent at ${new Date().toISOString()}`);

      // Send to all selected lights with minimal transition time for flash effect
      selectedLights.forEach(async (lightId) => {
        await window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId,
          on: true,
          brightness: brightness,
          xy: [x, y],
          transitiontime: 0 // Immediate change for flash effect
        }).catch(err => console.error(`Error sending to light ${lightId}:`, err));
      });
    } catch (error) {
      console.error('Error sending direct light command:', error);
      setLastLightCommand(`Direct Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Toggle the enabled state
  const handleToggleEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEnabled = event.target.checked;

    // If turning off, make sure we disconnect properly first
    if (!newEnabled && connected) {
      disconnectFromHue().then(() => {
        setEnabled(false);
        // Update in HueContext too if available
        hueContext?.setEnabled(false);
      });
    } else {
      setEnabled(newEnabled);
      // Update in HueContext too if available
      hueContext?.setEnabled(newEnabled);
    }
  };

  // Handle color mode change
  const handleColorModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: 'spectrum' | 'intensity' | 'pulse' | null
  ) => {
    if (newMode !== null) {
      setColorMode(newMode);
    }
  };

  // Get current audio data for visualization
  const getCurrentAudioData = (): Uint8Array | null => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      return dataArrayRef.current;
    }
    return null;
  };

  // Update the flash lights function to use advanced animations
  const flashLights = async () => {
    if (!hueConnected) {
      alert('Please connect to Hue bridge first');
      return;
    }

    setLastFlashTime(new Date().toLocaleTimeString());
    console.log('🎮 Manual DRAMATIC flash sequence requested');

    // Use our new animation utilities for a more dramatic effect
    try {
      // First try a standard test flash using HueService
      const success = await HueAnimations.testFlash(flashColor);

      if (!success) {
        alert('Failed to flash lights. Check console for details.');
      }
    } catch (err) {
      console.error('Error during animated flash sequence:', err);
      alert('Error during animation sequence');
    }
  };

  // Add a new function for rotating flash colors
  const rotateFlashColor = () => {
    // Cycle between red, green, blue, white, purple
    if (flashColor[0] === 1 && flashColor[1] === 0 && flashColor[2] === 0) {
      // Red -> Green
      setFlashColor([0, 1, 0]);
    } else if (flashColor[0] === 0 && flashColor[1] === 1 && flashColor[2] === 0) {
      // Green -> Blue
      setFlashColor([0, 0, 1]);
    } else if (flashColor[0] === 0 && flashColor[1] === 0 && flashColor[2] === 1) {
      // Blue -> White
      setFlashColor([1, 1, 1]);
    } else if (flashColor[0] === 1 && flashColor[1] === 1 && flashColor[2] === 1) {
      // White -> Purple
      setFlashColor([1, 0, 1]);
    } else {
      // Any -> Red
      setFlashColor([1, 0, 0]);
    }
  };

  const handleDebugFlashToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = event.target.checked;
    onAutoFlashToggle?.(isEnabled);
  };

  // Add UUID info to the debug display
  const renderDebugInfo = () => {
    if (!enabled) return null;

    const currentGroupId = HueService.getConfig()?.entertainmentGroupId || 'None';
    const isUuid = isValidUuid(currentGroupId);

    return (
      <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: '#f5f5f7', fontSize: '0.75rem' }}>
        <Typography variant="subtitle2">Debug Info:</Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          <li>Connection: {connected ? 'Connected' : 'Disconnected'}</li>
          <li>API Mode: {isEntertainmentAPI ? 'Entertainment' : 'Regular'}</li>
          <li>Selected Group: {currentGroupId}</li>
          <li>Is UUID Format: {isUuid ? 'Yes' : 'No'}</li>
          <li>Lights: {selectedLights.join(', ') || 'None'}</li>
          <li>Last Command: {lastLightCommand || 'None'}</li>
        </Box>

        {/* New API stats section */}
        {apiStats && (
          <Box sx={{ mt: 1, borderTop: '1px dashed #ccc', pt: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#1565C0' }}>API Usage Stats:</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Entertainment API: {apiStats.entertainment} calls ({apiStats.errors.entertainment} errors)</li>
              <li>Regular API: {apiStats.regular} calls ({apiStats.errors.regular} errors)</li>
              <li>Queue sizes: Entertainment: {apiStats.queueSizes.entertainment}, Regular: {apiStats.queueSizes.regular}</li>
              <li>Uptime: {Math.floor(apiStats.uptime / 60)}m {apiStats.uptime % 60}s</li>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // Add new button for a dramatic color cycle animation
  const runColorCycleAnimation = async () => {
    if (!hueConnected) {
      alert('Please connect to Hue bridge first');
      return;
    }

    setLastFlashTime(new Date().toLocaleTimeString());
    console.log('🌈 Color cycle animation requested');

    // Run a 1.5 second color cycle animation with 5 steps
    await HueAnimations.createColorCycleAnimation(1500, 5);
  };

  // Add new reset handler with improved feedback
  const handleReset = () => {
    HueService.resetSync();
    setApiStats(HueService.getApiStats(true)); // Reset stats too
    setLastLightCommand("Sync reset - all queues cleared");
    console.log("Hue sync has been reset completely.");
  };

  // Add new function for emergency clear button
  const handleEmergencyReset = () => {
    handleEmergencyClear();
    // Wait a bit then reset stats
    setTimeout(() => {
      setApiStats(HueService.getApiStats(true));
    }, 500);
  };

  // Add function to trigger emergency queue clearing
  const handleEmergencyClear = () => {
    HueService.emergencyClearQueues();
    setLastLightCommand("Emergency queue clear executed");
  };

  return (
    <Paper
      sx={{
        p: 3,
        width: '400px',
        maxWidth: '100%',
        borderRadius: 3,
        backgroundColor: '#ffffff', // Changed to white for light mode
        color: '#333333' // Changed to dark text
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ color: '#333333', fontWeight: 500 }}>
        Phillips Hue Music Sync
      </Typography>

      {/* Replace dropdown with static display of current entertainment group */}
      <Box sx={{ mb: 2, p: 2, borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)' }}>
        <Typography variant="body2" sx={{ color: '#555', mb: 0.5 }}>
          Current Entertainment Group:
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          {HueService.getConfig()?.entertainmentGroupId || 'Not set'}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#666' }}>
          To change, use the Hue Setup in Settings
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
          }}
        >
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'rgba(0, 0, 0, 0.05)', // Light gray background
          p: 1,
          borderRadius: 2
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={handleToggleEnabled}
              disabled={isConnecting || !HueService.hasValidConfig()}
              color="primary"
            />
          }
          label={
            <Typography sx={{ color: '#333333' }}>
              {isConnecting ? 'Connecting...' : connected ? 'Music Sync On' : 'Enable Light Sync'}
            </Typography>
          }
        />
        <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 1 }}>
          {isConnecting && <CircularProgress size={20} color="primary" sx={{ mr: 1 }} />}
          <Box
            className={`status-indicator ${connected ? (isEntertainmentAPI ? 'entertainment-api' : 'regular-api') : ''}`}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: connected
                ? (isEntertainmentAPI ? '#4CAF50' : '#FF9800')  // Green for entertainment, orange for regular
                : '#ccc',
              transition: 'background-color 0.3s',
              animation: connected ? 'pulse 2s infinite' : 'none',
              boxShadow: connected ? '0 0 8px 0px rgba(0, 0, 0, 0.2)' : 'none'
            }}
          />
          <Box sx={{ ml: 1, fontSize: '0.75rem', color: '#666' }}>
            {connected ? (isEntertainmentAPI ? 'Entertainment API' : 'Regular API') : 'Disconnected'}
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography id="sensitivity-slider" gutterBottom sx={{ color: '#555555' }}>
            Sensitivity: {sensitivity}
          </Typography>
          <Slider
            value={sensitivity}
            onChange={(_, value) => setSensitivity(value as number)}
            min={1}
            max={10}
            step={1}
            aria-labelledby="sensitivity-slider"
            disabled={!enabled}
            className="control-slider"
            color="primary"
          />
        </Grid>

        <Grid item xs={12}>
          <Typography gutterBottom sx={{ color: '#555555', mb: 1 }}>
            Color Mode
          </Typography>
          <ToggleButtonGroup
            value={colorMode}
            exclusive
            onChange={handleColorModeChange}
            aria-label="color mode"
            disabled={!enabled}
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                color: '#555555',
                borderColor: 'rgba(0, 0, 0, 0.1)',
                textTransform: 'none',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  color: '#1976d2',
                  borderColor: '#1976d2'
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.05)'
                }
              }
            }}
          >
            <ToggleButton value="spectrum">
              Spectrum
            </ToggleButton>
            <ToggleButton value="intensity">
              Intensity
            </ToggleButton>
            <ToggleButton value="pulse">
              Pulse
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>

        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <div className={`beat-indicator ${beatDetected ? 'active' : ''}`} />
              <Typography variant="body2" sx={{ color: '#555555' }}>
                Beat Detection
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={visualizer}
                  onChange={(e) => setVisualizer(e.target.checked)}
                  disabled={!enabled}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: '#555555' }}>
                  Visualizer
                </Typography>
              }
              labelPlacement="start"
            />
          </Box>
        </Grid>
      </Grid>

      {visualizer && enabled && (
        <Box
          sx={{
            mt: 2,
            height: 150,
            width: '100%',
            borderRadius: 2,
            overflow: 'hidden',
          }}
          className={`visualizer-container${connected ? ' active' : ''}`}
        >
          <HueMusicVisualizer
            getAudioData={getCurrentAudioData}
            colorMode={colorMode}
            sensitivity={sensitivity}
          />
        </Box>
      )}

      {!HueService.hasValidConfig() && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="info"
          >
            Phillips Hue is not configured. Please go to Settings to set up your Hue Bridge.
          </Alert>
        </Box>
      )}

      {/* Add debug info component before the divider */}
      {renderDebugInfo()}

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mt: 2 }}></Box>

      {(hueConnected || selectedLights.length > 0 || HueService.hasValidConfig()) ? (
        <Box>
          <Typography sx={{ color: '#555555' }}>Connected to Hue Bridge</Typography>
          <Typography sx={{ color: '#555555' }}>
            Selected Lights: {selectedLights.length || "(Detecting...)"}
          </Typography>

          {/* Updated button row with emergency clear option */}
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              onClick={flashLights}
              color="primary"
              variant="contained"
            >
              Flash Lights
            </Button>

            <Button
              onClick={rotateFlashColor}
              variant="outlined"
            >
              Change Color
            </Button>

            <Button
              onClick={runColorCycleAnimation}
              color="secondary"
              variant="outlined"
            >
              Color Cycle
            </Button>

            {/* Reset Sync button */}
            <Button onClick={handleReset} variant="outlined" color="error">
              Reset Sync
            </Button>

            {/* New Emergency Clear button - only show if queues > 10 */}
            {apiStats && (apiStats.queueSizes.entertainment > 10 || apiStats.queueSizes.regular > 10) && (
              <Button
                onClick={handleEmergencyReset}
                variant="contained"
                color="error"
                sx={{ fontWeight: 'bold' }}
              >
                EMERGENCY CLEAR
              </Button>
            )}
          </Box>

          {lastFlashTime && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
              Last animation: {lastFlashTime}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography sx={{ color: '#555555' }}>
          No Hue lights configured. Go to settings to set up Philips Hue.
        </Typography>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={autoFlashEnabled}
            onChange={handleDebugFlashToggle}
            color="primary"
          />
        }
        label="Enable Debug Light Flashing"
        sx={{ mb: 1, display: 'block', mt: 2 }}
      />
    </Paper>
  );
};

export default HueMusicSync;
