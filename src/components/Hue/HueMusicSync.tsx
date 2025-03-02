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
  hsvToRgb
} from '../../utils/AudioAnalysisUtils';
import { useHue } from '../../context/HueContext';
import HueMusicVisualizer from './HueMusicVisualizer';
import './HueMusicVisualStyles.css';

interface HueMusicSyncProps {
  audioRef?: React.RefObject<HTMLAudioElement>;
  isPlaying?: boolean;
  autoFlashEnabled?: boolean; // New prop to control auto flashing
  onAutoFlashToggle?: (isEnabled: boolean) => void; // Add callback for toggle
}

const HueMusicSync: React.FC<HueMusicSyncProps> = ({
  audioRef,
  isPlaying = false,
  autoFlashEnabled = false,
  onAutoFlashToggle
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

  // Refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const hueContext = useHue();

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

    return () => cleanup();
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
    // First check if we have a valid configuration according to HueService
    if (HueService.hasValidConfig()) {
      setHueConnected(true);
    }

    // Then retrieve light RIDs to confirm actual lights are available
    window.electron.ipcRenderer.invoke('hue:getLightRids')
      .then((rids: string[]) => {
        if (rids && rids.length > 0) {
          setSelectedLights(rids);
          setHueConnected(true);
          console.log(`HueMusicSync: Found ${rids.length} Hue lights`);
        } else {
          console.log('HueMusicSync: No Hue lights found');
        }
      })
      .catch(err => {
        console.error('HueMusicSync: Error getting lights:', err);
        // Don't set hueConnected to false here in case we already determined it's true via config
      });
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

  // Cleanup function
  const cleanup = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect audio nodes
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
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
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create analyzer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // Power of 2, determines frequency bin count
      analyser.smoothingTimeConstant = 0.8; // How smooth the frequency data is (0-1)
      analyserRef.current = analyser;

      // Buffer to store frequency data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      // Connect audio element to analyzer if we have one
      if (audioRef?.current) {
        // Resume audio context if it's suspended (browser policy may require user interaction)
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(console.error);
        }

        const source = audioContext.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        sourceNodeRef.current = source;

        console.log('Audio analyzer setup complete:', {
          bufferLength,
          fftSize: analyser.fftSize,
          state: audioContext.state
        });
      } else {
        console.error('No audio element reference available');
      }
    } catch (error) {
      console.error('Error setting up audio analyzer:', error);
      setError('Failed to set up audio analysis. Please check browser permissions.');
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

      // Try forcing regular API mode if entertainment mode doesn't work
      let initialized = false;
      let useFallbackMode = false;

      // First try with entertainment mode
      initialized = await HueService.initialize({
        updateRate: colorMode === 'pulse' ? 30 : 20
      });

      if (!initialized) {
        // If initialization failed, try with regular API mode
        console.log('First attempt failed, trying with regular API mode');
        HueService.useRegularAPIMode();
        initialized = await HueService.initialize();
        useFallbackMode = true;
      }

      if (!initialized) {
        throw new Error('Failed to initialize Hue bridge connection. Check console for details.');
      }

      // Start entertainment mode
      console.log('Starting entertainment mode...');
      const started = await HueService.startEntertainmentMode();
      if (!started) {
        throw new Error('Failed to start entertainment mode. Check console for details.');
      }

      console.log('Connected to Hue bridge successfully' + (useFallbackMode ? ' using regular API mode' : ''));
      setConnected(true);

      // Show a different message if we're using regular API mode
      if (useFallbackMode) {
        setError('Using simplified light mode - some features may be limited. See console for details.');
      }
    } catch (error: any) {
      console.error('Error connecting to Hue:', error);

      // Try one more time with regular API mode
      try {
        console.log('Error encountered, trying with regular API mode...');
        HueService.useRegularAPIMode();
        const initialized = await HueService.initialize();
        if (initialized) {
          const started = await HueService.startEntertainmentMode();
          if (started) {
            console.log('Connected to Hue bridge successfully using regular API mode');
            setConnected(true);
            setError('Using simplified light mode - some features may be limited. See console for details.');
            return;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }

      // More descriptive error message
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('initialize')) {
        errorMessage += '. Verify your Hue bridge is connected and try reconfiguring in Settings.';
      }

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
      // If we don't have the analyzer ready yet, try again in the next frame
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
      return;
    }

    // Get frequency data
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    analyser.getByteFrequencyData(dataArray);

    // Check for beats
    const isBeat = detectBeat(dataArray, 1.35);
    if (isBeat !== beatDetected) {
      setBeatDetected(isBeat);
    }

    // Update lights if connected (rate limiting to avoid overwhelming the bridge)
    const now = performance.now();
    if (connected && now - lastUpdateTimeRef.current > 40) { // ~25 updates per second
      updateLights(dataArray, isBeat);
      lastUpdateTimeRef.current = now;
    }

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  };

  // Update Hue lights based on audio data
  const updateLights = (dataArray: Uint8Array, isBeat: boolean) => {
    const bufferLength = dataArray.length;

    // Calculate audio characteristics based on sensitivity and color mode
    let rgb: [number, number, number] = [0, 0, 0];
    let transitionTime = 100; // ms

    switch (colorMode) {
      case 'spectrum': {
        // Divide frequency spectrum into low, mid, high
        const { bass, mid, treble } = calculateFrequencyBands(dataArray);

        // Apply sensitivity
        const sensitivityFactor = sensitivity / 5;

        // Map frequency levels to RGB components
        const r = mapRange(bass * sensitivityFactor, 0, 255, 0.05, 1);
        const g = mapRange(mid * sensitivityFactor, 0, 255, 0.05, 1);
        const b = mapRange(treble * sensitivityFactor, 0, 255, 0.05, 1);

        // If overall level is very low, dim the lights
        const overallLevel = (bass + mid + treble) / 3;
        const brightness = overallLevel < 20 ? 0.1 : 1;

        rgb = [
          Math.min(1, r * brightness),
          Math.min(1, g * brightness),
          Math.min(1, b * brightness)
        ];

        transitionTime = 200; // Smooth transitions for spectrum mode
        break;
      }

      case 'intensity': {
        // Calculate overall volume level
        const volumeLevel = averageFrequency(dataArray, 0, bufferLength);
        const scaledVolume = volumeLevel * (sensitivity / 5);

        // Map volume to brightness
        const intensity = mapRange(scaledVolume, 0, 255, 0, 1);

        // Create a color based on intensity
        // Low intensity = warm (red/orange), high intensity = cool (blue/purple)
        const hue = mapRange(intensity, 0, 1, 30, 260);
        const sat = mapRange(intensity, 0, 1, 0.3, 1);
        const val = mapRange(intensity, 0, 1, 0.05, 1);

        // Convert HSV to RGB
        rgb = hsvToRgb(hue / 360, sat, val);

        transitionTime = 300; // Slower transitions for intensity mode
        break;
      }

      case 'pulse': {
        // If a beat is detected, pulse with a bright color
        if (isBeat) {
          // Use dominant frequency for hue
          let dominantIndex = 0;
          let maxEnergy = 0;
          for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > maxEnergy) {
              maxEnergy = dataArray[i];
              dominantIndex = i;
            }
          }

          // Map to hue (higher frequencies = cooler colors)
          const hue = mapRange(dominantIndex, 0, bufferLength, 0, 330);

          // Bright saturated color on beat
          rgb = hsvToRgb(hue / 360, 1, 1);
          transitionTime = 50; // Fast transition for beat
        } else {
          // Between beats, use a dimmer complementary color or neutral
          const { bass, mid, treble } = calculateFrequencyBands(dataArray);
          const sensitivityFactor = sensitivity / 10;

          // Create a subtle base color
          const baseLevel = Math.max(bass, mid, treble) * sensitivityFactor;
          const brightness = mapRange(baseLevel, 0, 255, 0.05, 0.3);

          // Either use neutral light or subtle colored light
          if (baseLevel < 30) {
            // Low energy, use neutral light
            rgb = [brightness, brightness, brightness];
          } else {
            // Some energy, use subtle colored light
            const hue = mid > bass ? 240 : 40; // Blue if more mid, orange if more bass
            rgb = hsvToRgb(hue / 360, 0.6, brightness);
          }

          transitionTime = 200; // Slower transition between beats
        }
        break;
      }
    }

    // Ensure RGB values are in 0-1 range
    rgb = rgb.map(v => Math.max(0, Math.min(1, v))) as [number, number, number];

    // Send color to lights
    HueService.sendColorTransition(rgb, transitionTime).catch(err => {
      console.error('Error sending color to Hue:', err);
      // If we get frequent errors, disconnect
      if (connected) {
        disconnectFromHue();
        setError('Connection to Hue Bridge lost. Please check your network.');
        setEnabled(false);
      }
    });
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

    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
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
    } catch (error) {
      console.error('Error flashing lights:', error);
    }
  };

  const handleDebugFlashToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = event.target.checked;
    onAutoFlashToggle?.(isEnabled);
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isConnecting && <CircularProgress size={20} color="primary" sx={{ ml: 2 }} />}
          <Box
            className={`status-indicator ${connected ? 'connected' : ''}`}
            sx={{ ml: 1 }}
          />
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
            className: 'visualizer-container' + (connected ? ' active' : '')
          }}
        >
          <HueMusicVisualizer
            audioData={getCurrentAudioData()}
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

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#333333', fontWeight: 500 }}>
          Philips Hue Control
        </Typography>

        {/* Debug flash toggle - Always show this */}
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

        {/* Update this conditional to also check HueService.hasValidConfig() as a fallback */}
        {(hueConnected || selectedLights.length > 0 || HueService.hasValidConfig()) ? (
          <Box>
            <Typography sx={{ color: '#555555' }}>Connected to Hue Bridge</Typography>
            <Typography sx={{ color: '#555555' }}>Selected Lights: {selectedLights.length || "(Detecting...)"}</Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={flashLights}
              sx={{ mt: 2 }}
            >
              Flash Lights Manually
            </Button>
          </Box>
        ) : (
          <Typography sx={{ color: '#555555' }}>No Hue lights configured. Go to settings to set up Philips Hue.</Typography>
        )}
      </Box>
    </Paper>
  );
};

export default HueMusicSync;

