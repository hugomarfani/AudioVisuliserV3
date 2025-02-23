import React, { useEffect, useState } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import PhillipsHueControls from './PhillipsHueControls';

const HueDebugOverlay: React.FC = () => {
  const [lightRids, setLightRids] = useState<string[]>([]);
  // You may replace the bridge info below with dynamic data if available.
  const bridgeInfo = { ip: '192.168.1.37', username: '-nUQmRphqf5UBxZswMQIqiUH912baNXN9fhtAYc8' };

  useEffect(() => {
    (async () => {
      try {
        const rids: string[] = await window.electron.ipcRenderer.invoke('hue:getLightRids');
        setLightRids(rids);
      } catch (error) {
        console.error('Error fetching light RIDs in DebugOverlay:', error);
      }
    })();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hue Debug Overlay
      </Typography>
      <Typography variant="subtitle1">Bridge Info:</Typography>
      <Typography variant="body2">IP: {bridgeInfo.ip}</Typography>
      <Typography variant="body2">Username: {bridgeInfo.username}</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        Lights:
      </Typography>
      {lightRids.length === 0 ? (
        <Typography variant="body2">No lights found.</Typography>
      ) : (
        lightRids.map((rid) => (
          <Box key={rid} sx={{ mb: 2 }}>
            <PhillipsHueControls lightId={rid} />
          </Box>
        ))
      )}
    </Box>
  );
};

export default HueDebugOverlay;
