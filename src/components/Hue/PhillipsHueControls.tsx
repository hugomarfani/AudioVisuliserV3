import React, { useState, useEffect } from 'react';
import { Button, Box, Typography } from '@mui/material';
import { testPheaLibrary } from '../../utils/testPhea';

interface PhillipsHueControlsProps {
  lightId: string;
}

const PhillipsHueControls: React.FC<PhillipsHueControlsProps> = ({ lightId }) => {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    // Run the test when component mounts
    const result = testPheaLibrary();
    console.log('Phea test result:', result);
  }, []);

  const handleToggleLight = async () => {
    try {
      if (isOn) {
        await window.electron.ipcRenderer.invoke('hue:turnOff', lightId);
      } else {
        await window.electron.ipcRenderer.invoke('hue:turnOn', lightId);
      }
      setIsOn(!isOn);
    } catch (error) {
      console.error('Error controlling light:', error);
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, maxWidth: 300 }}>
      <Typography variant="h6" gutterBottom>
        Light Control (ID: {lightId})
      </Typography>
      <Button
        variant="contained"
        onClick={handleToggleLight}
        color={isOn ? 'error' : 'success'}
      >
        {isOn ? 'Turn Off' : 'Turn On'}
      </Button>
    </Box>
  );
};

export default PhillipsHueControls;
