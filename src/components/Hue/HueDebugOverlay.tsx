import React, { useState, useCallback } from 'react';
import { Box, Typography, Divider, Button, TextField } from '@mui/material';
import HueControlPanel from './HueControlPanel';

const HueDebugOverlay: React.FC = () => {
  const [bridgeInfo, setBridgeInfo] = useState<{ ip: string; username: string } | null>(() => {
    const stored = localStorage.getItem("hueBridgeInfo");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.ip && parsed?.username) {
        // Send credentials to main process
        window.electron.ipcRenderer.invoke('hue:setCredentials', parsed);
        return parsed;
      }
    }
    return null;
  });
  const [lightRids, setLightRids] = useState<string[]>([]);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState<string>('');

  // Only fetch light RIDs if we have valid credentials
  const fetchLightRids = useCallback(async () => {
    if (!bridgeInfo?.username) return;

    try {
      const rids = await window.electron.ipcRenderer.invoke('hue:getLightRids');
      setLightRids(rids);
      setBridgeError(null);
    } catch (error: any) {
      setBridgeError(error.message);
      // If credentials are invalid, clear them
      if (error.message === 'No valid credentials') {
        localStorage.removeItem("hueBridgeInfo");
        setBridgeInfo(null);
      }
      console.error('Error fetching light RIDs:', error);
    }
  }, [bridgeInfo?.username]);

  // Only attempt to fetch RIDs once when component mounts if we have credentials
  React.useEffect(() => {
    if (bridgeInfo?.username) {
      fetchLightRids();
    }
  }, []); // Empty dependency array - only run once on mount

  const scanBridge = useCallback(async () => {
    if (!bridgeInfo?.username) {
      try {
        const discoveredIp: string = await window.electron.ipcRenderer.invoke('hue:discoverBridge');
        setBridgeInfo({ ip: discoveredIp, username: '' });
        setBridgeError(null);
      } catch (error: any) {
        setBridgeError(error.message);
        console.error('Error in HueDebugOverlay:', error);
      }
    }
  }, [bridgeInfo]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hue Debug Overlay
      </Typography>
      {/* Show bridge info and scan button if no credentials, otherwise display control panel */}
      {!bridgeInfo?.username ? (
        <>
          <Button variant="contained" onClick={scanBridge}>
            Start Bridge Discovery
          </Button>
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
                        localStorage.setItem("hueBridgeInfo", JSON.stringify(result));
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
        </>
      ) : (
        <>
          <Typography variant="subtitle1">Bridge Info:</Typography>
          <Typography variant="body2">IP: {bridgeInfo.ip}</Typography>
          <Typography variant="body2">Username: {bridgeInfo.username || 'Not Authorized'}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Lights:
          </Typography>
          <HueControlPanel />
        </>
      )}
    </Box>
  );
};

export default HueDebugOverlay;
