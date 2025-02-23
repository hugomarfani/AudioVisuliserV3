import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, Slider } from '@mui/material';

interface LightDetail {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
  xy: number[];
}

// Helper function to convert RGB to XY
const rgbToXy = (r: number, g: number, b: number): number[] => {
  // Convert RGB to normalized values
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  // Convert to XYZ using sRGB/RGB D65 conversion
  const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;

  // Convert to xy
  const sum = X + Y + Z;
  if (sum === 0) return [0, 0];

  return [X / sum, Y / sum];
};

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string): number[] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Conversion functions
const hueBrightnessToPercent = (brightness: number): number => {
  return Math.round((brightness / 254) * 100);
};

const percentToHueBrightness = (percent: number): number => {
  return Math.round((percent / 100) * 254);
};

const HueControlPanel: React.FC = () => {
  const [lights, setLights] = useState<LightDetail[]>([]);
  const [error, setError] = useState<string>('');
  const updateQueue = useRef<Array<() => Promise<void>>>([]);
  const isProcessing = useRef(false);
  const brightnessDebounceTimer = useRef<NodeJS.Timeout>();
  const [localBrightness, setLocalBrightness] = useState<{[key: string]: number}>({});

  // Fetch light details from main process
  const fetchLights = useCallback(async () => {
    try {
      const lightDetails: LightDetail[] = await window.electron.ipcRenderer.invoke('hue:getLightDetails');
      setLights(lightDetails);
      setError('');
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching light details:', err);
    }
  }, []);

  useEffect(() => {
    fetchLights();
  }, [fetchLights]);

  // Process updates sequentially
  const processUpdateQueue = useCallback(async () => {
    if (isProcessing.current) return;

    isProcessing.current = true;
    while (updateQueue.current.length > 0) {
      const update = updateQueue.current.shift();
      if (update) {
        try {
          await update();
          // Wait 1 second between updates to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error('Error processing update:', err);
        }
      }
    }
    isProcessing.current = false;
  }, []);

  // Queue an update
  const queueUpdate = useCallback((updateFn: () => Promise<void>) => {
    updateQueue.current.push(updateFn);
    processUpdateQueue();
  }, [processUpdateQueue]);

  // Update light state with queuing
  const updateLight = useCallback(async (id: string, newState: Partial<LightDetail>) => {
    // Handle brightness changes with local state and debouncing
    if (newState.brightness !== undefined) {
      // Update local state immediately for smooth slider movement
      setLocalBrightness(prev => ({ ...prev, [id]: newState.brightness as number }));

      // Clear any existing timer
      if (brightnessDebounceTimer.current) {
        clearTimeout(brightnessDebounceTimer.current);
      }

      // Set new timer for actual API call
      brightnessDebounceTimer.current = setTimeout(async () => {
        try {
          await window.electron.ipcRenderer.invoke('hue:setLightState', {
            lightId: id,
            brightness: newState.brightness // Use value directly, no conversion
          });
          // Only fetch lights after successful brightness update
          setTimeout(fetchLights, 100);
        } catch (err: any) {
          console.error(`Failed to update brightness for light ${id}:`, err);
          if (err.toString().includes('429')) {
            setError('Too many requests. Please wait a few seconds before trying again.');
          }
        }
      }, 100); // Small delay for debouncing
      return;
    }

    // Handle other state changes (on/off, color) with existing queue
    const update = async () => {
      try {
        await window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId: id,
          on: newState.on,
          xy: newState.xy
        });
        setTimeout(fetchLights, 100);
      } catch (err: any) {
        console.error(`Failed to update light ${id}:`, err);
        setError(err.message);
      }
    };

    queueUpdate(update);
  }, [fetchLights, queueUpdate]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hue Control Panel
      </Typography>
      {error && <Typography variant="body2" color="error">{error}</Typography>}
      {lights.map(light => (
        <Box key={light.id} sx={{ p: 2, mb: 2, border: '1px solid #ccc', borderRadius: 2 }}>
          <Typography variant="subtitle1">
            {light.name} (ID: {light.id})
          </Typography>
          <Button
            variant="contained"
            color={light.on ? 'error' : 'success'}
            onClick={() => updateLight(light.id, { on: !light.on })}
            sx={{ mb: 1 }}
          >
            Turn {light.on ? 'Off' : 'On'}
          </Button>
          <Typography variant="body2">
            Brightness: {localBrightness[light.id] ?? hueBrightnessToPercent(light.brightness)}%
          </Typography>
          <Slider
            value={localBrightness[light.id] ?? hueBrightnessToPercent(light.brightness)}
            min={0}
            max={100}  // Changed max from 254 to 100
            onChange={(_, value) => updateLight(light.id, { brightness: value as number })}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2">Color:</Typography>
          <input
            type="color"
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              const xy = rgbToXy(rgb[0], rgb[1], rgb[2]);
              // Debounce color updates more aggressively
              if (updateQueue.current.length === 0) {
                updateLight(light.id, { xy });
              }
            }}
            style={{ width: '100%', height: '50px', marginTop: '8px' }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default HueControlPanel;
