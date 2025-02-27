import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Divider, Button, TextField } from '@mui/material';
import HueControlPanel from './HueControlPanel';

const HueDebugOverlay: React.FC = () => {
  // Store discovered bridge info using phea credentials
  const [bridgeInfo, setBridgeInfo] = useState<{ ip: string } | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  // State for manual IP entry
  const [manualIp, setManualIp] = useState<string>('');
  const [manualUsername, setManualUsername] = useState<string>(''); // for App Key
  const [manualPSK, setManualPSK] = useState<string>(''); // NEW state for PSK
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // NEW: Check for valid stored credentials on mount
  useEffect(() => {
    const stored = localStorage.getItem("hueBridgeInfo");
    if (stored) {
      const creds = JSON.parse(stored);
      if (creds?.ip && creds?.username && creds?.psk) {
        console.log("Found stored Hue credentials, verifying...");
        window.electron.ipcRenderer.invoke('hue:setCredentials', creds)
          .then(() => {
            setBridgeInfo({ ip: creds.ip });
            setBridgeError(null);
          })
          .catch(err => {
            console.error("Stored Hue credentials invalid:", err);
            localStorage.removeItem("hueBridgeInfo");
            setBridgeInfo(null);
          });
      }
    }
  }, []);

  // Discovery function remains available
  const scanBridge = useCallback(async () => {
    try {
      const discoveredIp: string = await window.electron.ipcRenderer.invoke('hue:discoverBridge');
      console.log('Discovered Hue Bridge IP:', discoveredIp);
      // Set credentials via the discovery path (using dummy credentials here so that IPC call works)
      await window.electron.ipcRenderer.invoke('hue:setCredentials', { ip: discoveredIp, username: 'fromPhea', psk: 'fromPhea' });
      setBridgeInfo({ ip: discoveredIp });
      setBridgeError(null);
    } catch (error: any) {
      setBridgeError(error.message);
      console.error('Error in auto discovery:', error);
    }
  }, []);

  // Allow manual connection when user enters an IP address
  const connectManually = useCallback(async () => {
    try {
      let result;
      if (manualUsername.trim() && manualPSK.trim()) {
        result = await window.electron.ipcRenderer.invoke('hue:setCredentials', {
          ip: manualIp,
          username: manualUsername,
          psk: manualPSK
        });
      } else {
        result = await window.electron.ipcRenderer.invoke('hue:connectToBridges', [manualIp]);
      }
      setBridgeInfo({ ip: manualIp });
      localStorage.setItem("hueBridgeInfo", JSON.stringify({ ip: manualIp, ...result }));
      setBridgeError(null);
    } catch (error: any) {
      setBridgeError(error.message);
      console.error('Error in manual connection:', error);
    }
  }, [manualIp, manualUsername, manualPSK]);

  // Automatically run discovery on mount if no manual credentials exist
  useEffect(() => {
    if (!bridgeInfo) {
      scanBridge();
    }
  }, [bridgeInfo, scanBridge]);

  // Save updated bridge info persistently.
  useEffect(() => {
    if (bridgeInfo) {
      localStorage.setItem("hueBridgeInfo", JSON.stringify(bridgeInfo));
      console.log("💾 Stored Hue Bridge info:", bridgeInfo);
    }
  }, [bridgeInfo]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hue Debug Overlay
      </Typography>
      {bridgeError && (
        <Typography variant="body2" color="error">
          {bridgeError}
        </Typography>
      )}
      {!bridgeInfo ? (
        <>
          <Button variant="contained" onClick={scanBridge} sx={{ mr: 2 }}>
            Start Discovery
          </Button>
          <Button variant="contained" onClick={() => setShowManualInput(true)}>
            Connect Manually
          </Button>
          {showManualInput && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Enter Hue Bridge IP"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                fullWidth
              />
              <TextField
                label="Enter Hue Bridge App Key (Username)"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                fullWidth
                sx={{ mt: 1 }}
              />
              <TextField
                label="Enter Hue Bridge PSK"
                value={manualPSK}
                onChange={(e) => setManualPSK(e.target.value)}
                fullWidth
                sx={{ mt: 1 }}
              />
              <Button variant="contained" sx={{ mt: 1 }} onClick={connectManually}>
                Connect
              </Button>
            </Box>
          )}
        </>
      ) : (
        <>
          <Typography variant="subtitle1">Bridge Info:</Typography>
          <Typography variant="body2">IP: {bridgeInfo.ip}</Typography>
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
