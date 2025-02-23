import React, { useEffect, useState, useCallback } from 'react';
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

const HueControlPanel: React.FC = () => {
  const [lights, setLights] = useState<LightDetail[]>([]);
  const [error, setError] = useState<string>('');

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

  // Debounced update function
  const debouncedUpdate = useCallback((id: string, newState: Partial<LightDetail>) => {
    // Set a timeout to prevent too many rapid requests
    setTimeout(async () => {
      try {
        let brightnessValue = newState.brightness;
        if (brightnessValue !== undefined) {
          brightnessValue = Math.round((brightnessValue * 254) / 100);
        }

        await window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId: id,
          on: newState.on,
          brightness: brightnessValue,
          xy: newState.xy
        });

        // Wait a bit before refreshing the light states
        setTimeout(fetchLights, 500);
      } catch (err) {
        console.error(`Failed to update light ${id}:`, err);
        if (err.toString().includes('429')) {
          setError('Too many requests. Please wait a few seconds before trying again.');
        }
      }
    }, 250); // Add a small delay before sending the update
  }, [fetchLights]);

  // Update light state with debouncing
  const updateLight = async (id: string, newState: Partial<LightDetail>) => {
    // For on/off states, update immediately
    if (newState.on !== undefined) {
      try {
        await window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId: id,
          on: newState.on
        });
        setTimeout(fetchLights, 500);
      } catch (err) {
        console.error(`Failed to update light ${id}:`, err);
      }
      return;
    }

    // For brightness and color changes, use debounced update
    debouncedUpdate(id, newState);
  };

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
          <Typography variant="body2">Brightness: {Math.round((light.brightness * 100) / 254)}%</Typography>
          <Slider
            value={(light.brightness * 100) / 254}
            min={0}
            max={100}
            onChange={(_, value) => updateLight(light.id, { brightness: value as number })}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2">Color:</Typography>
          <input
            type="color"
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              const xy = rgbToXy(rgb[0], rgb[1], rgb[2]);
              updateLight(light.id, { xy });
            }}
            style={{ width: '100%', height: '50px', marginTop: '8px' }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default HueControlPanel;
