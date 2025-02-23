import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Divider, Button, TextField } from '@mui/material';
import PhillipsHueControls from './PhillipsHueControls';

const HueDebugOverlay: React.FC = () => {
  const [lightRids, setLightRids] = useState<string[]>([]);
  const [bridgeInfo, setBridgeInfo] = useState<{ ip: string; username: string } | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState<string>('');

  const scanBridge = useCallback(async () => {
    try {
      const discoveredIp: string = await window.electron.ipcRenderer.invoke('hue:discoverBridge');
      // Only update bridgeInfo if current info is absent or incomplete.
      setBridgeInfo(prev => (prev && prev.username ? prev : { ip: discoveredIp, username: '' }));
      setBridgeError(null);
      const rids: string[] = await window.electron.ipcRenderer.invoke('hue:getLightRids');
      setLightRids(rids);
    } catch (error: any) {
      setBridgeError(error.message);
      console.error('Error in HueDebugOverlay:', error);
    }
  }, []);

  useEffect(() => {
    // Attempt to load stored credentials
    const stored = localStorage.getItem("hueBridgeInfo");
    if (stored) {
      const info = JSON.parse(stored);
      if (info && info.username) {
        setBridgeInfo(info);
        window.electron.ipcRenderer.invoke('hue:getLightRids').then((rids: string[]) => setLightRids(rids));
        return;
      }
    }
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
            {bridgeError.includes('429')
              ? 'Too many requests - please wait a few minutes or enter your bridge IP manually:'
              : bridgeError.includes('link')
              ? 'Please press the link button on your Hue Bridge and then click "Rescan Bridge".'
              : bridgeError}
          </Typography>
          {bridgeError.includes('429') && !bridgeInfo && (
            <Box sx={{ mt: 1 }}>
              <TextField
                label="Manual Bridge IP"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                sx={{ mt: 1 }}
                onClick={async () => {
                  try {
                    const result = await window.electron.ipcRenderer.invoke('hue:setManualBridge', manualIp);
                    setBridgeInfo(result);
                    localStorage.setItem("hueBridgeInfo", JSON.stringify(result)); // persist credentials
                    const rids: string[] = await window.electron.ipcRenderer.invoke('hue:getLightRids');
                    setLightRids(rids);
                    setBridgeError('');
                  } catch (err: any) {
                    setBridgeError(err.message);
                    console.error('Error setting manual IP:', err);
                  }
                }}
              >
                Set Bridge IP
              </Button>
            </Box>
          )}
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
