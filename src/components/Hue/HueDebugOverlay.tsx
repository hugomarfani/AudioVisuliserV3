import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Divider, Button } from '@mui/material';
import PhillipsHueControls from './PhillipsHueControls';

const HueDebugOverlay: React.FC = () => {
  const [lightRids, setLightRids] = useState<string[]>([]);
  const [bridgeInfo, setBridgeInfo] = useState<{ ip: string; username: string } | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const scanBridge = useCallback(async () => {
    try {
      // Invoke discovery via IPC which uses getHueApi internally.
      const discoveredIp: string = await window.electron.ipcRenderer.invoke('hue:discoverBridge');
      setBridgeInfo({ ip: discoveredIp, username: '' }); // You may update username if available.
      setBridgeError(null);
      const rids: string[] = await window.electron.ipcRenderer.invoke('hue:getLightRids');
      setLightRids(rids);
    } catch (error: any) {
      setBridgeError(error.message);
      console.error('Error in HueDebugOverlay:', error);
    }
  }, []);

  useEffect(() => {
    scanBridge();
  }, [scanBridge]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hue Debug Overlay
      </Typography>
      {bridgeInfo ? (
        <>
          <Typography variant="subtitle1">Bridge Info:</Typography>
          <Typography variant="body2">IP: {bridgeInfo.ip}</Typography>
          <Typography variant="body2">Username: {bridgeInfo.username || 'Not Authorized'}</Typography>
        </>
      ) : (
        <Typography variant="body2">Discovering bridge...</Typography>
      )}
      {bridgeError && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="error">
            {bridgeError.includes('link')
              ? 'Please press the link button on your Hue Bridge and then click "Rescan Bridge".'
              : bridgeError}
          </Typography>
          <Button variant="contained" sx={{ mt: 1 }} onClick={scanBridge}>
            Rescan Bridge
          </Button>
        </Box>
      )}
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
