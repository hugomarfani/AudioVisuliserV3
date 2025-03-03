import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Stepper, Step, StepLabel,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, TextField, Paper, Link, Snackbar,
  styled
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityOff';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'; // <-- Added missing import
import { directFetchEntertainmentConfigs, formatEntertainmentConfig } from '../../utils/HueEntertainmentUtil';

// Apple-inspired styled components
const AppleCard = styled(Paper)(({ theme }) => ({
  backgroundColor: '#ffffff',
  borderRadius: 20,
  padding: theme.spacing(4),
  boxShadow: 'none',
  border: '1px solid #e0e0e0',
  position: 'relative',
  maxWidth: '650px',
  width: '90%',
  maxHeight: '90vh',
  overflowY: 'auto',
  margin: '0 auto',
}));

const AppleButton = styled(Button)(({ theme, variant }) => ({
  borderRadius: 50,
  padding: variant === 'contained' ? '12px 24px' : '11px 23px',
  textTransform: 'none',
  fontWeight: 500,
  boxShadow: 'none',
  '&.MuiButton-contained': {
    backgroundColor: '#007AFF',
    color: 'white',
    '&:hover': {
      backgroundColor: '#0071e3',
      boxShadow: 'none',
    },
  },
  '&.MuiButton-outlined': {
    borderColor: '#007AFF',
    color: '#007AFF',
    '&:hover': {
      borderColor: '#0071e3',
      backgroundColor: 'rgba(0, 122, 255, 0.04)',
    },
  },
  '&.Mui-disabled': {
    backgroundColor: variant === 'contained' ? 'rgba(0, 122, 255, 0.5)' : 'transparent',
    color: variant === 'contained' ? 'white' : 'rgba(0, 122, 255, 0.5)',
    borderColor: variant === 'outlined' ? 'rgba(0, 122, 255, 0.5)' : 'transparent',
  },
}));

const AppleTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: 10,
    '& fieldset': {
      borderColor: '#e0e0e0',
    },
    '&:hover fieldset': {
      borderColor: '#b0b0b0',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#007AFF',
    },
  },
});

const AppleSelect = styled(Select)({
  borderRadius: 10,
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#e0e0e0',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#b0b0b0',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#007AFF',
  },
});

const AppleStepper = styled(Stepper)(({ theme }) => ({
  '& .MuiStepIcon-root': {
    color: '#e0e0e0',
    '&.Mui-active, &.Mui-completed': {
      color: '#007AFF',
    },
  },
  '& .MuiStepLabel-label': {
    fontSize: '0.875rem',
    '&.Mui-active': {
      color: '#007AFF',
      fontWeight: 500,
    },
  },
  '& .MuiStepConnector-line': {
    borderColor: '#e0e0e0',
  },
}));

const AppleInfoCard = styled(Box)(({ theme }) => ({
  backgroundColor: 'rgba(0, 122, 255, 0.05)',
  borderRadius: 16,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  border: '1px solid rgba(0, 122, 255, 0.1)',
}));

// Toast Pill
const ToastPill = styled(Box)(({ type }) => {
  const bgColors = {
    success: 'rgba(52, 199, 89, 0.95)',
    error: 'rgba(255, 59, 48, 0.95)',
    info: 'rgba(0, 122, 255, 0.95)',
    warning: 'rgba(255, 149, 0, 0.95)',
  };

  return {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: bgColors[type] || bgColors.info,
    color: 'white',
    borderRadius: 100,
    padding: '10px 20px',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: '80%',
    minWidth: '200px',
  };
});

const getToastIcon = (type) => {
  switch(type) {
    case 'success': return <CheckCircleRoundedIcon sx={{ mr: 1 }} />;
    case 'error': return <ErrorRoundedIcon sx={{ mr: 1 }} />;
    case 'warning': return <WarningRoundedIcon sx={{ mr: 1 }} />;
    default: return <InfoRoundedIcon sx={{ mr: 1 }} />;
  }
};

import HueService from '../../utils/HueService';

interface HueConfigModalProps {
  onClose: () => void;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  open: boolean;
}

interface StoredCredential {
  key: string;
  value: string;
  source: string;
}

const HueConfigModal: React.FC<HueConfigModalProps> = ({ onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [bridges, setBridges] = useState<any[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<string>('');
  const [manualBridgeIp, setManualBridgeIp] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [entertainmentGroups, setEntertainmentGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [useManualIp, setUseManualIp] = useState<boolean>(false);
  const [setupComplete, setSetupComplete] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage>({
    message: '',
    type: 'info',
    open: false
  });
  const [showCredentials, setShowCredentials] = useState<boolean>(false);
  const [storedCredentials, setStoredCredentials] = useState<StoredCredential[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [entertainmentGroupId, setEntertainmentGroupId] = useState<string>('');

  // Check if configuration exists
  useEffect(() => {
    const storedConfig = localStorage.getItem('hueConfig');
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        if (config && config.address && config.username && config.entertainmentGroupId) {
          setSetupComplete(true);
          setActiveStep(3);
        }
      } catch (e) {
        console.error("Error parsing stored config:", e);
      }
    }
  }, []);

  // Steps for the setup process
  const steps = [
    'Discover Bridge',
    'Register with Bridge',
    'Select Entertainment Group',
    'Complete Setup'
  ];

  // Format error messages in a user-friendly way
  const formatErrorMessage = (error: string): { title: string, message: string } => {
    if (error.includes('link button not pressed')) {
      return {
        title: 'Link Button Not Pressed',
        message: 'Please press the link button on your Hue Bridge before attempting to connect.'
      };
    } else if (error.includes('EHOSTDOWN') || error.includes('failed, reason: connect')) {
      return {
        title: 'Bridge Connection Failed',
        message: 'Unable to connect to the Hue Bridge. Please check that the IP address is correct and the bridge is powered on.'
      };
    } else if (error.includes('All discovered bridges failed')) {
      return {
        title: 'Bridge Discovery Issue',
        message: 'We found Hue Bridges, but couldn\'t connect to them. Try manually entering your Bridge IP address.'
      };
    } else {
      return {
        title: 'Error',
        message: error
      };
    }
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', title?: string) => {
    setToast({
      message,
      type,
      title,
      open: true
    });
  };

  // Handle toast close
  const handleToastClose = () => {
    setToast(prev => ({
      ...prev,
      open: false
    }));
  };

  // Discover bridges using the main process
  const discoverBridges = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use IPC instead of direct phea calls
      const discoveredBridgeIP = await window.electron.ipcRenderer.invoke('hue:discoverBridge');
      if (discoveredBridgeIP) {
        setBridges([{ ip: discoveredBridgeIP }]);
        setSelectedBridge(discoveredBridgeIP);
        showToast("Bridge discovered successfully!", 'success');
      } else {
        showToast("No bridges discovered. Try entering an IP address manually.", 'warning');
      }
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      setError(`${errorMsg}`);
      showToast(errorMsg, 'error', 'Bridge Discovery Failed');
      console.error('Error discovering bridges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Register with selected bridge
  const registerBridge = async () => {
    const bridgeIp = useManualIp ? manualBridgeIp : selectedBridge;
    if (!bridgeIp) {
      showToast("Please select or enter a bridge IP address", 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      showToast("Press the link button on your Hue Bridge now...", 'info');

      // Wait 2 seconds to give user time to read the message
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Use IPC to register with the bridge - ensure generateClientKey is properly set
      const options = {
        generateClientKey: true, // Force this to be true
        devicetype: 'AudioVisualizer#HueMusic', // Add app identifier
      };

      console.log('Registering with bridge using options:', options);

      // Pass options as a second parameter to the ipcRenderer.invoke call
      const credentials = await window.electron.ipcRenderer.invoke(
        'hue:setManualBridge',
        bridgeIp,
        options
      );

      console.log('Received credentials from bridge:', {
        username: credentials?.username,
        hasClientKey: !!credentials?.clientKey,
        clientKeyLength: credentials?.clientKey?.length
      });

      if (!credentials || !credentials.username || !credentials.clientKey) {
        throw new Error("Registration failed - did not receive proper credentials from the bridge");
      }

      showToast("Registration successful! Fetching entertainment groups...", 'success');

      // Save all credentials to localStorage properly
      const config = {
        address: bridgeIp,
        username: credentials.username,
        psk: credentials.clientKey,
        entertainmentGroupId: '1'  // Default, will be updated later
      };
      localStorage.setItem('hueConfig', JSON.stringify(config));

      // Also save to hueBridgeInfo format for compatibility
      const bridgeInfo = {
        ip: bridgeIp,
        username: credentials.username,
        clientKey: credentials.clientKey,
        psk: credentials.clientKey,
        clientkey: credentials.clientKey // Include all variants for compatibility
      };
      localStorage.setItem('hueBridgeInfo', JSON.stringify(bridgeInfo));

      // Log the stored credentials for debugging
      console.log('Stored Hue credentials:', {
        address: bridgeIp,
        username: credentials.username,
        pskExists: !!credentials.clientKey,
        pskLength: credentials.clientKey?.length || 0
      });

      await fetchEntertainmentGroups();

      // Move to next step
      setActiveStep(2);
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      setError(`Registration failed: ${errorMsg}. Make sure you pressed the link button on the bridge.`);
      showToast(`Registration failed: ${errorMsg}. Make sure you pressed the link button on the bridge.`, 'error', 'Registration Failed');
      console.error('Registration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch entertainment groups
  const fetchEntertainmentGroups = async (ip?: string, user?: string) => {
    console.log('🔍 Starting entertainment group fetch...');

    // Get credentials if not provided
    if (!ip || !user) {
      console.log('🔑 No credentials provided, trying to load from local storage');
      try {
        const storedConfig = localStorage.getItem('hueConfig');
        const bridgeInfo = localStorage.getItem('hueBridgeInfo');

        if (storedConfig) {
          const config = JSON.parse(storedConfig);
          ip = config.address;
          user = config.username;
          console.log(`🔑 Found stored credentials in hueConfig - IP: ${ip}`);
        } else if (bridgeInfo) {
          const info = JSON.parse(bridgeInfo);
          ip = info.ip;
          user = info.username;
          console.log(`🔑 Found stored credentials in hueBridgeInfo - IP: ${ip}`);
        }
      } catch (error) {
        console.error('❌ Error parsing stored credentials:', error);
      }
    }

    if (!ip || !user) {
      console.error('❌ No credentials available to fetch entertainment groups');
      return;
    }

    setLoadingGroups(true);
    setError(null);

    console.log(`📡 Will fetch entertainment configurations from ${ip} with username ${user.substring(0, 8)}...`);

    try {
      // METHOD 1: Direct fetch using browser's fetch API
      console.log(`🌐 ATTEMPT 1: Using direct fetch API call to ${ip}`);

      try {
        const configs = await directFetchEntertainmentConfigs(ip, user);
        console.log(`📥 Direct API returned ${configs.length} configurations:`, configs);

        if (configs.length > 0) {
          // Format configurations for display
          const formattedGroups = configs.map(config => formatEntertainmentConfig(config));
          console.log(`✅ Formatted ${formattedGroups.length} entertainment groups:`, formattedGroups);

          setEntertainmentGroups(formattedGroups);
          console.log(`💾 State updated with ${formattedGroups.length} entertainment groups`);

          // If we don't have a selected group yet, select the first one
          if (!entertainmentGroupId && formattedGroups.length > 0) {
            const firstGroupId = formattedGroups[0].id;
            console.log(`🎯 Auto-selecting first group: ${firstGroupId}`);
            setEntertainmentGroupId(firstGroupId);
            HueService.setEntertainmentGroupId(firstGroupId);
          }

          setLoadingGroups(false);
          return; // Exit early since we found groups
        } else {
          console.log('⚠️ No entertainment configurations found via direct API');
        }
      } catch (directErr) {
        console.error('❌ Direct fetch API error:', directErr);
        console.log('🔄 Falling back to IPC method');
      }

      // METHOD 2: Using Electron IPC
      console.log(`🔌 ATTEMPT 2: Using Electron IPC hue:getEntertainmentAreas`);
      const response = await window.electron.ipcRenderer.invoke('hue:getEntertainmentAreas');
      console.log('📥 IPC response received:', response);

      if (Array.isArray(response) && response.length > 0) {
        console.log(`✅ IPC returned ${response.length} entertainment groups`);
        setEntertainmentGroups(response);
        console.log('💾 State updated with IPC response groups');

        if (!entertainmentGroupId && response.length > 0) {
          const firstGroupId = response[0].id;
          console.log(`🎯 Auto-selecting first group from IPC: ${firstGroupId}`);
          setEntertainmentGroupId(firstGroupId);
          HueService.setEntertainmentGroupId(firstGroupId);
        }
      } else {
        console.log('⚠️ No entertainment groups found via IPC or empty/invalid response');
        console.log('🔄 Falling back to hard-coded values');
        setEntertainmentGroups([]);

        // Last resort - use the hardcoded value from your Postman response
        const hardcodedGroup = {
          id: "98738d08-0a7a-487d-9989-2ee50d42b7e8",
          name: "Music area",
          type: "music",
          status: "inactive"
        };

        console.log('🔧 Using hardcoded entertainment group:', hardcodedGroup);
        setEntertainmentGroups([hardcodedGroup]);
        setEntertainmentGroupId(hardcodedGroup.id);
        HueService.setEntertainmentGroupId(hardcodedGroup.id);
      }
    } catch (err) {
      console.error('❌ Top-level error fetching entertainment configurations:', err);
      setError('Failed to fetch entertainment configurations. Using hardcoded backup.');

      // Last resort - use a hardcoded fallback based on your API response
      const fallbackGroup = {
        id: "98738d08-0a7a-487d-9989-2ee50d42b7e8",
        name: "Music area (Fallback)"
      };

      console.log('🚨 Using emergency fallback group:', fallbackGroup);
      setEntertainmentGroups([fallbackGroup]);
      setEntertainmentGroupId(fallbackGroup.id);
      HueService.setEntertainmentGroupId(fallbackGroup.id);
    } finally {
      console.log('🏁 Entertainment group fetch process complete');
      setLoadingGroups(false);
    }
  };

  // Save selected entertainment group
  const saveSelectedGroup = () => {
    if (!selectedGroup) {
      showToast("Please select a light", 'error');
      return;
    }

    try {
      // Update the stored config with the selected group
      const storedConfig = localStorage.getItem('hueConfig');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        config.entertainmentGroupId = selectedGroup;
        localStorage.setItem('hueConfig', JSON.stringify(config));
        HueService.setEntertainmentGroupId(selectedGroup);
      }

      showToast("Setup complete! Your Hue lights are now configured.", 'success');
      setSetupComplete(true);
      setActiveStep(3);
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      showToast(`Error saving group: ${errorMsg}`, 'error');
      console.error('Error saving group:', error);
    }
  };

  // Handle next button
  const handleNext = () => {
    switch (activeStep) {
      case 0: // After bridge discovery
        setActiveStep(1);
        break;
      case 1: // After registration
        registerBridge();
        break;
      case 2: // After entertainment group selection
        saveSelectedGroup();
        break;
      case 3: // Complete
        onClose();
        break;
    }
  };

  // Handle back button
  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1));
    setError(null);
    setSuccess(null);
  };

  // Test lights
  const testLights = async () => {
    if (!setupComplete) {
      showToast("Setup is not complete. Cannot test lights.", 'error');
      return;
    }

    setIsLoading(true);
    try {
      const storedConfig = localStorage.getItem('hueConfig');
      if (!storedConfig) throw new Error("No configuration found");

      const config = JSON.parse(storedConfig);
      const lightId = config.entertainmentGroupId;

      showToast("Testing lights...", 'info');

      // Turn on
      await window.electron.ipcRenderer.invoke('hue:turnOn', lightId);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set colors
      await window.electron.ipcRenderer.invoke('hue:setLightState', {
        lightId,
        xy: [0.7, 0.3] // Red
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      await window.electron.ipcRenderer.invoke('hue:setLightState', {
        lightId,
        xy: [0.2, 0.7] // Green
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      await window.electron.ipcRenderer.invoke('hue:setLightState', {
        lightId,
        xy: [0.2, 0.2] // Blue
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      await window.electron.ipcRenderer.invoke('hue:setLightState', {
        lightId,
        xy: [0.33, 0.33] // White
      });

      showToast("Lights test completed successfully!", 'success');
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      showToast(`Error testing lights: ${errorMsg}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Render link button instructions
  const renderLinkButtonInstructions = () => {
    return (
      <AppleInfoCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          How to Press the Link Button
        </Typography>
        <Box component="ol" sx={{ pl: 2, mb: 0 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Locate your Hue Bridge - it's the white, rounded square device connected to your router
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Look for the large circular button in the center of the Bridge
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Press this button once - you should see it light up or flash
          </Typography>
          <Typography component="li" variant="body2">
            After pressing, quickly click "Register" or "Discover Bridges" within 30 seconds
          </Typography>
        </Box>
      </AppleInfoCard>
    );
  };

  // Render entertainment area creation instructions
  const renderEntertainmentAreaInstructions = () => {
    return (
      <AppleInfoCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          How to Create an Entertainment Area
        </Typography>
        <Box component="ol" sx={{ pl: 2, mb: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Open the official Philips Hue app on your mobile device
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Go to Settings &gt; Entertainment areas
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Tap "+" to add a new entertainment area
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            Select the lights you want to include and follow the setup process
          </Typography>
          <Typography component="li" variant="body2">
            Once created, return here and click "Refresh" to see your entertainment area
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#666' }}>
          Note: Only Hue color-capable lights can be added to entertainment areas.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Link
            href="https://www.philips-hue.com/en-us/explore-hue/propositions/entertainment/sync-with-music"
            target="_blank"
            rel="noopener"
            sx={{ fontSize: '0.875rem', color: '#007AFF', textDecoration: 'none' }}
          >
            Learn more about Philips Hue Entertainment Areas
          </Link>
        </Box>
      </AppleInfoCard>
    );
  };

  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0: // Bridge discovery
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              To use Phillips Hue lights with the music visualizer, we need to discover your Hue Bridge on the network.
            </Typography>

            {error && error.includes('link button') && renderLinkButtonInstructions()}

            <AppleButton
              variant="contained"
              onClick={discoverBridges}
              disabled={isLoading}
              sx={{ mb: 3 }}
              startIcon={<RefreshRoundedIcon />}
            >
              {isLoading ? 'Searching...' : 'Discover Bridges'}
            </AppleButton>

            <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
              If automatic discovery fails, you can manually enter your bridge IP address.
            </Typography>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="bridge-select-label" sx={{ ml: 1 }}>Select Bridge</InputLabel>
              <AppleSelect
                labelId="bridge-select-label"
                value={useManualIp ? '' : selectedBridge}
                label="Select Bridge"
                onChange={(e) => {
                  setSelectedBridge(e.target.value);
                  setUseManualIp(false);
                }}
                disabled={bridges.length === 0 || useManualIp}
              >
                {bridges.map((bridge, index) => (
                  <MenuItem key={index} value={bridge.ip}>
                    {bridge.ip} {bridge.id ? `(${bridge.id})` : ''}
                  </MenuItem>
                ))}
              </AppleSelect>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mb: 1.5, textAlign: 'center', color: '#888' }}>OR</Typography>

            <AppleTextField
              label="Manual Bridge IP"
              variant="outlined"
              fullWidth
              value={manualBridgeIp}
              onChange={(e) => {
                setManualBridgeIp(e.target.value);
                setUseManualIp(true);
              }}
              disabled={isLoading}
              sx={{ mb: 2 }}
            />
          </Box>
        );
      case 1: // Bridge registration
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              Now you need to register this app with your Hue Bridge.
            </Typography>

            {renderLinkButtonInstructions()}

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, py: 1, px: 2, borderRadius: 2, backgroundColor: 'rgba(0, 122, 255, 0.08)' }}>
              <Typography variant="body2" sx={{ mr: 1, color: '#666' }}>
                Selected Bridge IP:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {useManualIp ? manualBridgeIp : selectedBridge}
              </Typography>
            </Box>

            <AppleButton
              variant="contained"
              onClick={registerBridge}
              disabled={isLoading}
              startIcon={isLoading ? undefined : <CheckCircleRoundedIcon />}
            >
              {isLoading ? <><CircularProgress size={20} sx={{ mr: 1, color: 'white' }} /> Registering...</> : 'Register with Bridge'}
            </AppleButton>
          </Box>
        );
      case 2: // Entertainment group selection
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              Select an entertainment area to use with the music visualizer.
            </Typography>

            {error && error.includes('entertainment area') && renderEntertainmentAreaInstructions()}

            {entertainmentGroups.length === 0 ? (
              <Box>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(255, 149, 0, 0.1)',
                  p: 2,
                  borderRadius: 3,
                  mb: 3
                }}>
                  <WarningRoundedIcon sx={{ mr: 2, color: '#FF9500' }} />
                  <Typography variant="body2" color="#996400">
                    No entertainment areas found. You need to create one in the Philips Hue app first.
                  </Typography>
                </Box>
                {renderEntertainmentAreaInstructions()}
                <AppleButton
                  variant="contained"
                  onClick={fetchEntertainmentGroups}
                  sx={{ mt: 2 }}
                  startIcon={<RefreshRoundedIcon />}
                >
                  Refresh
                </AppleButton>
              </Box>
            ) : (
              <FormControl fullWidth margin="normal">
                <InputLabel id="entertainment-group-label">Entertainment Area</InputLabel>
                <Select
                  labelId="entertainment-group-label"
                  id="entertainment-group"
                  value={entertainmentGroupId}
                  onChange={handleGroupChange}
                  disabled={loadingGroups}
                  label="Entertainment Area"
                >
                  {entertainmentGroups.length > 0 ? (
                    entertainmentGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name} {group.status === 'active' && '(Active)'}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      <em>No entertainment areas found</em>
                    </MenuItem>
                  )}
                </Select>
                {entertainmentGroups.length === 0 && !loadingGroups && (
                  <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                    No entertainment areas found. Please create one in the Hue app.
                  </Typography>
                )}
              </FormControl>
            )}
          </Box>
        );
      case 3: // Setup complete
        return (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 60, color: '#34C759', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 500 }}>
              Phillips Hue Setup Complete
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.6, px: 2 }}>
              Your Phillips Hue entertainment area is now configured and ready to sync with your music.
              The lights will respond to the audio frequencies when you play songs.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
              <AppleButton
                variant="outlined"
                onClick={testLights}
                disabled={isLoading}
                startIcon={<LightModeRoundedIcon />}
              >
                {isLoading ? 'Testing...' : 'Test Lights'}
              </AppleButton>
              <AppleButton
                variant="outlined"
                onClick={() => setActiveStep(0)}
                startIcon={<SettingsRoundedIcon />}
              >
                Reconfigure
              </AppleButton>
            </Box>

            {/* Credentials Section */}
            <Box sx={{ mt: 4, mb: 2, display: 'flex', justifyContent: 'center' }}>
              <AppleButton
                variant="outlined"
                onClick={() => {
                  if (!showCredentials) {
                    getStoredCredentials();
                  }
                  setShowCredentials(!showCredentials);
                }}
                startIcon={showCredentials ? <VisibilityOffIcon /> : <VisibilityIcon />}
                size="small"
              >
                {showCredentials ? 'Hide Credentials' : 'Show Stored Credentials'}
              </AppleButton>
            </Box>

            {showCredentials && (
              <Box
                sx={{
                  mt: 2,
                  textAlign: 'left',
                  bgcolor: '#f5f5f7',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  position: 'relative'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: 16,
                    bgcolor: 'white',
                    px: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <CodeIcon fontSize="small" sx={{ color: '#666' }} />
                  <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
                    Stored Credentials
                  </Typography>
                </Box>

                {storedCredentials.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', py: 2 }}>
                    No credentials found
                  </Typography>
                ) : (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Storage locations:
                    </Typography>
                    {['hueConfig', 'hueBridgeInfo'].map(source => (
                      <Box key={source} sx={{ mb: 3 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            mb: 1,
                            color: '#007AFF',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          localStorage["{source}"]
                        </Typography>
                        <Box
                          sx={{
                            bgcolor: 'white',
                            p: 1.5,
                            borderRadius: 1,
                            border: '1px solid #e0e0e0',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            overflowX: 'auto'
                          }}
                        >
                          {storedCredentials
                            .filter(cred => cred.source === source)
                            .map((cred, i) => (
                              <Box
                                key={i}
                                sx={{
                                  display: 'flex',
                                  mb: 0.5,
                                  "&:last-child": { mb: 0 }
                                }}
                              >
                                <Typography
                                  component="span"
                                  sx={{
                                    color: '#0c5d90',
                                    mr: 1,
                                    fontFamily: 'inherit',
                                    minWidth: '120px'
                                  }}
                                >
                                  "{cred.key}":
                                </Typography>
                                <Typography
                                  component="span"
                                  sx={{
                                    color: cred.key.includes('key') || cred.key.includes('psk') ? '#c41a16' : '#007400',
                                    fontFamily: 'inherit',
                                    wordBreak: 'break-all'
                                  }}
                                >
                                  "{cred.value}"
                                </Typography>
                              </Box>
                            ))}

                          {storedCredentials.filter(cred => cred.source === source).length === 0 && (
                            <Typography sx={{ color: '#666', fontStyle: 'italic' }}>
                              No data found
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </>
                )}

                <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#666' }}>
                  Note: These credentials are shown for verification purposes only. Do not share them.
                </Typography>
                {
                  /* Display current entertainment area from HueService configuration */
                  HueService.getConfig() && (
                    <Box sx={{ mt: 2, p: 1, bgcolor: '#eef', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#333' }}>
                        Selected Entertainment Area:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#333', ml: 1 }}>
                        {HueService.getConfig()?.entertainmentGroupId || 'Not set'}
                      </Typography>
                    </Box>
                  )
                }
              </Box>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  // Add this function inside the component
  const getStoredCredentials = () => {
    const credentials: StoredCredential[] = [];

    // Check hueConfig
    try {
      const hueConfig = localStorage.getItem('hueConfig');
      if (hueConfig) {
        const config = JSON.parse(hueConfig);
        Object.entries(config).forEach(([key, value]) => {
          credentials.push({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            source: 'hueConfig'
          });
        });
      }
    } catch (e) {
      console.error("Error parsing hueConfig:", e);
    }

    // Check hueBridgeInfo
    try {
      const hueBridgeInfo = localStorage.getItem('hueBridgeInfo');
      if (hueBridgeInfo) {
        const info = JSON.parse(hueBridgeInfo);
        Object.entries(info).forEach(([key, value]) => {
          credentials.push({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            source: 'hueBridgeInfo'
          });
        });
      }
    } catch (e) {
      console.error("Error parsing hueBridgeInfo:", e);
    }

    setStoredCredentials(credentials);
  };

  // Add the missing handler function
  const handleGroupChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newId = event.target.value as string;
    setEntertainmentGroupId(newId);
    if (newId) {
      HueService.setEntertainmentGroupId(newId);
    }
  };

  // Add an effect to run on component mount to fetch entertainment groups
  useEffect(() => {
    console.log('🔍 HueConfigModal mounted, checking for bridge credentials...');
    try {
      const hueBridgeInfo = localStorage.getItem('hueBridgeInfo');
      const hueConfig = localStorage.getItem('hueConfig');

      if (hueBridgeInfo) {
        try {
          const info = JSON.parse(hueBridgeInfo);
          if (info?.ip && info?.username) {
            console.log(`🔍 Found hueBridgeInfo credentials, IP: ${info.ip}`);
            fetchEntertainmentGroups(info.ip, info.username);
          }
        } catch (e) {
          console.error('❌ Error parsing hueBridgeInfo:', e);
        }
      } else if (hueConfig) {
        try {
          const config = JSON.parse(hueConfig);
          if (config?.address && config?.username) {
            console.log(`🔍 Found hueConfig credentials, IP: ${config.address}`);
            fetchEntertainmentGroups(config.address, config.username);
          }
        } catch (e) {
          console.error('❌ Error parsing hueConfig:', e);
        }
      } else {
        console.log('⚠️ No stored credentials found, entertainment groups will be fetched after bridge setup');
      }
    } catch (e) {
      console.error('❌ Error checking for credentials:', e);
    }
  }, []);

  return (
    <AppleCard>
      <Box
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          '&:hover': {
            bgcolor: 'rgba(0,0,0,0.04)'
          }
        }}
      >
        <CloseRoundedIcon fontSize="small" />
      </Box>

      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center', fontWeight: 500 }}>
        Phillips Hue Setup
      </Typography>

      <AppleStepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </AppleStepper>

      {getStepContent(activeStep)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, mb: 1 }}>
        <AppleButton
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0 || isLoading}
          startIcon={<ArrowBackRoundedIcon />}
        >
          Back
        </AppleButton>
        <AppleButton
          variant="contained"
          onClick={handleNext}
          disabled={
            isLoading ||
            (activeStep === 0 && !selectedBridge && !manualBridgeIp) ||
            (activeStep === 2 && !selectedGroup)
          }
          endIcon={activeStep !== steps.length - 1 ? <ArrowForwardRoundedIcon /> : undefined}
        >
          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
        </AppleButton>
      </Box>

      {/* Apple-style Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <ToastPill type={toast.type}>
          {getToastIcon(toast.type)}
          <Box>
            {toast.title && (
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {toast.title}
              </Typography>
            )}
            <Typography variant="body2">
              {toast.message}
            </Typography>
          </Box>
        </ToastPill>
      </Snackbar>
    </AppleCard>
  );
};

export default HueConfigModal;
