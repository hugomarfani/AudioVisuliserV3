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
  const [useDirectDTLS, setUseDirectDTLS] = useState<boolean>(true);

  // Use a state for config so that dependency changes trigger refetch
  const [config, setConfig] = useState(HueService.getConfig());

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

    // Disconnect from Hue if necessary
    if (connected) {
      HueService.stopEntertainmentMode().catch(console.error);
      setConnected(false);
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

  // Disconnect from Hue
  const disconnectFromHue = async () => {
    try {
      await HueService.stopEntertainmentMode();
      setConnected(false);
      console.log('Disconnected from Hue bridge');
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

    const beatThreshold = 1.35 - (sensitivity - 5) * 0.05;
    const isBeat = detectBeat(dataArray, beatThreshold);

    // Check if beat state changed
    if (isBeat !== beatDetected) {
      setBeatDetected(isBeat);

      // If new beat detected, send to lights immediately!
      if (isBeat) {
        const energy = calculateBassEnergy(dataArray);
        console.log('🥁 BEAT DETECTED! Energy:', energy);

        // On beat detection, immediately flash the lights
        if (connected || hueConnected) {
          // Generate vibrant color for beat flash
          const beatColor = generateBeatColor(dataArray);
          // Send direct command for immediate response
          console.log('🔴 BEAT DETECTED - Sending immediate flash command');
          HueService.sendColorTransition(beatColor, 0, true);
          setLastLightCommand(`Beat Flash: ${beatColor.map(v => v.toFixed(2)).join(', ')}`);
        }
      }
    }

    if (connected) {
      // Continue regular light updates
      updateLights(dataArray, isBeat);
    }

    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  };

  // Add this new helper function to generate vibrant colors for beats
  const generateBeatColor = (dataArray: Uint8Array): [number, number, number] => {
    const { bass, mid, treble } = calculateFrequencyBands(dataArray);

    // Determine dominant frequency range
    if (bass > mid && bass > treble) {
      // Bass-heavy beat - use red/orange
      return [1, 0.3 + Math.random() * 0.3, 0];
    } else if (mid > treble) {
      // Mid-heavy beat - use green/cyan
      return [0, 0.8 + Math.random() * 0.2, 0.5 + Math.random() * 0.5];
    } else {
      // Treble-heavy beat - use blue/purple
      return [0.5 + Math.random() * 0.5, 0, 1];
    }
  };

  // Update the updateLights function to make beat handling more aggressive
  const updateLights = (dataArray: Uint8Array, isBeat: boolean) => {
    const bufferLength = dataArray.length;

    // Calculate audio characteristics based on sensitivity and color mode
    let rgb: [number, number, number] = [0, 0, 0];
    let transitionTime = 100; // ms

    // If a beat is detected, create a more dramatic effect
    if (isBeat) {
      // Log prominently
      console.log('🎵 STRONG BEAT → FLASH MODE');

      // For beats, use much more vivid colors
      switch (colorMode) {
        case 'spectrum': {
          // On beat, use more vibrant version of spectrum colors
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = (sensitivity / 5) * 2.0; // Higher boost for beats

          // Use more saturated colors for beats
          const r = Math.min(1, mapRange(bass * sensitivityFactor, 0, 255, 0.2, 1) * 1.5);
          const g = Math.min(1, mapRange(mid * sensitivityFactor, 0, 255, 0.2, 1) * 1.5);
          const b = Math.min(1, mapRange(treble * sensitivityFactor, 0, 255, 0.2, 1) * 1.5);

          rgb = [r, g, b];
          break;
        }

        case 'intensity':
        case 'pulse': {
          // For both these modes on a beat, use a very bright flash
          const volumeLevel = averageFrequency(dataArray, 0, bufferLength);
          const hue = mapRange(volumeLevel, 0, 255, 0, 360);
          rgb = hsvToRgb(hue / 360, 1, 1); // Full saturation and brightness
          break;
        }
      }

      // NEW: Add subtle variation to prevent command filtering
      rgb = [
        Math.min(1, rgb[0] + (Math.random() * 0.05)),
        Math.min(1, rgb[1] + (Math.random() * 0.05)),
        Math.min(1, rgb[2] + (Math.random() * 0.05))
      ] as [number, number, number];

      // Use VERY fast transitions for beats
      transitionTime = 20; // Much faster than before
    } else {
      // Between beats logic stays the same...
      switch (colorMode) {
        case 'spectrum': {
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = sensitivity / 5;
          const r = mapRange(bass * sensitivityFactor, 0, 255, 0.05, 0.8);
          const g = mapRange(mid * sensitivityFactor, 0, 255, 0.05, 0.8);
          const b = mapRange(treble * sensitivityFactor, 0, 255, 0.05, 0.8);
          const overallLevel = (bass + mid + treble) / 3;
          const brightness = overallLevel < 20 ? 0.1 : 0.7;
          rgb = [Math.min(1, r * brightness), Math.min(1, g * brightness), Math.min(1, b * brightness)];
          transitionTime = 300;
          break;
        }
        // Other cases remain unchanged...
        case 'intensity': {
          const volumeLevel = averageFrequency(dataArray, 0, bufferLength);
          const scaledVolume = volumeLevel * (sensitivity / 5);
          const intensity = mapRange(scaledVolume, 0, 255, 0, 0.7);
          const hue = mapRange(intensity, 0, 1, 30, 260);
          const sat = mapRange(intensity, 0, 1, 0.3, 0.8);
          const val = mapRange(intensity, 0, 1, 0.05, 0.7);
          rgb = hsvToRgb(hue / 360, sat, val);
          transitionTime = 400;
          break;
        }
        case 'pulse': {
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = sensitivity / 10;
          const baseLevel = Math.max(bass, mid, treble) * sensitivityFactor;
          const dimBrightness = mapRange(baseLevel, 0, 255, 0.05, 0.2);
          if (baseLevel < 30) {
            rgb = [dimBrightness, dimBrightness, dimBrightness];
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
    setEnabled(newEnabled);

    // Update in HueContext too if available
    hueContext?.setEnabled(newEnabled);
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

  const flashLights = () => {
    if (!hueConnected || selectedLights.length === 0) return;

    // Use a more dynamic color selection
    const hue = Math.random() * 360;
    const rgb = hsvToRgb(hue / 360, 1, 1); // Full saturation and brightness

    sendDirectLightCommand(rgb, 100); // 100% brightness for manual flash
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
      </Box>
    );
  };

  // Add these test functions
  const testEntertainmentAPI = async () => {
    try {
      // First verify connection
      if (!connected) {
        console.log("Not connected. Attempting to connect to Hue...");
        await connectToHue();
      }

      if (!connected) {
        setError("Could not connect to Hue bridge");
        return;
      }

      console.log("🧪 TESTING ENTERTAINMENT API");

      // Test sequence to flash several colors via entertainment API
      const colors: [number, number, number][] = [
        [1, 0, 0], // Red
        [0, 1, 0], // Green
        [0, 0, 1], // Blue
        [1, 1, 0], // Yellow
        [1, 0, 1], // Magenta
      ];

      // Using direct test function in HueService
      const testResult = await HueService.testTransition();

      if (testResult) {
        setLastLightCommand("Entertainment API test successful!");

        // Now send a sequence of colors
        for (const color of colors) {
          await HueService.sendColorTransition(color, 0, true); // Use forceSend=true for immediate effect
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms between colors
        }
      } else {
        setLastLightCommand("Entertainment API test failed - check console");
        setError("Entertainment API test failed. See debug console for details.");
      }
    } catch (error) {
      console.error("Test error:", error);
      setError(`Test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const verifyAndFixEntertainmentSetup = async () => {
    try {
      setError(null);
      setLastLightCommand("Verifying entertainment setup...");

      // First, check if we're connected
      if (!connected) {
        await connectToHue();
      }

      if (!connected) {
        setError("Could not connect to Hue bridge");
        return;
      }

      // Run the verification function
      const isValid = await HueService.verifyEntertainmentSetup();

      if (isValid) {
        setLastLightCommand("Entertainment setup is valid! Running color cycle test.");
        // Let's also run the test color cycle again for good measure
        await HueService.testColorCycle();
      } else {
        setLastLightCommand("Entertainment setup has issues. See console log for details.");
        setError("Entertainment setup verification failed. Check the console for diagnostic information.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testDirectImplementation = async () => {
    try {
      setError(null);
      setLastLightCommand("Testing direct DTLS implementation...");

      // First, ensure we have a config
      if (!HueService.hasValidConfig()) {
        setError("No Hue bridge configuration found. Please go to Settings to set up your Hue Bridge.");
        return;
      }

      // Run the test implementation
      const result = await HueService.testDirectImplementation();

      if (result) {
        setLastLightCommand("Direct DTLS implementation test successful! Check the lights for the test color sequence.");
      } else {
        setLastLightCommand("Direct DTLS implementation test failed. See console for details.");
        setError("Direct DTLS implementation test failed. Check the console for diagnostic information.");
      }
    } catch (error) {
      console.error("Direct implementation test error:", error);
      setError(`Test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleImplementation = async () => {
    try {
      setUseDirectDTLS(!useDirectDTLS);
      setLastLightCommand(`Switching to ${!useDirectDTLS ? 'Direct DTLS' : 'Phea Library'} implementation`);

      // Disconnect current implementation first
      if (connected) {
        await disconnectFromHue();
      }

      // Set which implementation to use
      HueService.setUseDirectImplementation(!useDirectDTLS);

      // Try to reconnect
      if (enabled) {
        await connectToHue();
      }
    } catch (error) {
      console.error("Error toggling implementation:", error);
      setError(`Toggle error: ${error instanceof Error ? error.message : String(error)}`);
    }
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            <Button
              onClick={flashLights}
              color="primary"
              variant="contained"
            >
              Flash Lights Manually
            </Button>
            <Button
              onClick={testEntertainmentAPI}
              color="secondary"
              variant="contained"
              disabled={!HueService.hasValidConfig()}
            >
              Test Entertainment API
            </Button>
            <Button
              onClick={verifyAndFixEntertainmentSetup}
              color="warning"
              variant="contained"
              disabled={!HueService.hasValidConfig()}
            >
              Verify & Fix Setup
            </Button>
            <Button
              onClick={testDirectImplementation}
              color="success"
              variant="contained"
              disabled={!HueService.hasValidConfig()}
              sx={{ mt: 1 }}
            >
              Test Direct DTLS Implementation
            </Button>
          </Box>
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
        sx={{ mb: 1, display: 'block' }}
      />

      <FormControlLabel
        control={
          <Switch
            checked={useDirectDTLS}
            onChange={toggleImplementation}
            color="secondary"
          />
        }
        label="Use Direct DTLS Implementation"
        sx={{ mb: 1, display: 'block' }}
      />
    </Paper>
  );
};

export default HueMusicSync;
