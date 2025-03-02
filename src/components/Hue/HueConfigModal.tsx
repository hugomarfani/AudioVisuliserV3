import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Stepper, Step, StepLabel,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, TextField, Alert, Paper, AlertTitle,
  Link, Snackbar
} from '@mui/material';

interface HueConfigModalProps {
  onClose: () => void;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  open: boolean;
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

      // Use IPC to register with the bridge
      await window.electron.ipcRenderer.invoke('hue:setManualBridge', bridgeIp);

      showToast("Registration successful! Fetching entertainment groups...", 'success');
      await fetchEntertainmentGroups();

      // Save simplified config to localStorage
      const config = {
        address: bridgeIp,
        username: 'fromElectron', // Actual value managed by main process
        entertainmentGroupId: '1'  // Default, will be updated later
      };
      localStorage.setItem('hueConfig', JSON.stringify(config));

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
  const fetchEntertainmentGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use IPC to get entertainment areas
      const entertainmentAreas = await window.electron.ipcRenderer.invoke('hue:getEntertainmentAreas');

      if (entertainmentAreas && entertainmentAreas.length > 0) {
        setEntertainmentGroups(entertainmentAreas);
        setSelectedGroup(entertainmentAreas[0].id);
        showToast(`Found ${entertainmentAreas.length} entertainment area(s)`, 'success');
      } else {
        const errorMsg = "No entertainment areas found. You need to create an entertainment area in the Philips Hue app first.";
        setError(errorMsg);
        showToast(errorMsg, 'warning', 'No Entertainment Areas');
      }
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      setError(`Error fetching entertainment areas: ${errorMsg}`);
      showToast(`Error fetching entertainment areas: ${errorMsg}`, 'error');
      console.error('Error fetching entertainment areas:', error);
    } finally {
      setIsLoading(false);
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
      <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: '#f8f8f8', border: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
          How to Press the Link Button:
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
      </Paper>
    );
  };

  // Render entertainment area creation instructions
  const renderEntertainmentAreaInstructions = () => {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: '#f8f8f8', border: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
          How to Create an Entertainment Area:
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
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          Note: Only Hue color-capable lights can be added to entertainment areas.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Link
            href="https://www.philips-hue.com/en-us/explore-hue/propositions/entertainment/sync-with-music"
            target="_blank"
            rel="noopener"
            sx={{ fontSize: '0.875rem' }}
          >
            Learn more about Philips Hue Entertainment Areas
          </Link>
        </Box>
      </Paper>
    );
  };

  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0: // Bridge discovery
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              To use Phillips Hue lights with the music visualizer, we need to discover your Hue Bridge on the network.
            </Typography>

            {error && error.includes('link button') && renderLinkButtonInstructions()}

            <Button
              variant="contained"
              color="primary"
              onClick={discoverBridges}
              disabled={isLoading}
              sx={{ mb: 2 }}
            >
              {isLoading ? <><CircularProgress size={24} sx={{ mr: 1, color: 'white' }} /> Discovering...</> : 'Discover Bridges'}
            </Button>

            <Typography variant="body2" sx={{ mb: 2 }}>
              If automatic discovery fails, you can manually enter your bridge IP address.
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="bridge-select-label">Select Bridge</InputLabel>
              <Select
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
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>OR</Typography>

            <TextField
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
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Now you need to register this app with your Hue Bridge.
            </Typography>

            {renderLinkButtonInstructions()}

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                Selected Bridge IP:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {useManualIp ? manualBridgeIp : selectedBridge}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              onClick={registerBridge}
              disabled={isLoading}
            >
              {isLoading ? <><CircularProgress size={24} sx={{ mr: 1, color: 'white' }} /> Registering...</> : 'Register with Bridge'}
            </Button>
          </Box>
        );
      case 2: // Entertainment group selection
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Select an entertainment area to use with the music visualizer.
            </Typography>

            {error && error.includes('entertainment area') && renderEntertainmentAreaInstructions()}

            {entertainmentGroups.length === 0 ? (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No entertainment areas found. You need to create one in the Philips Hue app first.
                </Alert>
                {renderEntertainmentAreaInstructions()}
                <Button
                  variant="contained"
                  onClick={fetchEntertainmentGroups}
                  sx={{ mt: 2 }}
                >
                  Refresh
                </Button>
              </Box>
            ) : (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="group-select-label">Select Entertainment Area</InputLabel>
                <Select
                  labelId="group-select-label"
                  value={selectedGroup}
                  label="Select Entertainment Area"
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  {entertainmentGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 3: // Setup complete
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Phillips Hue Setup Complete!
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
              Your Phillips Hue entertainment area is now configured and ready to sync with your music.
              The lights will respond to the audio frequencies when you play songs.
            </Typography>

            <Button
              variant="outlined"
              color="primary"
              onClick={testLights}
              disabled={isLoading}
              sx={{ mb: 2, mr: 2 }}
            >
              {isLoading ? 'Testing...' : 'Test Lights'}
            </Button>

            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
              sx={{ mb: 2 }}
            >
              Reconfigure
            </Button>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'relative',
        width: '80%', // Set to 80% of screen width
        maxHeight: '90vh',
        overflowY: 'auto',
        mx: 'auto',
        p: 4,
        bgcolor: '#ffffff',
        borderRadius: 1.5
      }}
    >
      <Button
        aria-label="close"
        onClick={onClose}
        sx={{ position: 'absolute', top: 12, right: 12 }}
      >
        Close
      </Button>

      <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
        Phillips Hue Setup
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {getStepContent(activeStep)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0 || isLoading}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={
            isLoading ||
            (activeStep === 0 && !selectedBridge && !manualBridgeIp) ||
            (activeStep === 2 && !selectedGroup)
          }
        >
          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </Box>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.type}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {toast.title && (
            <AlertTitle>{toast.title}</AlertTitle>
          )}
          {toast.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default HueConfigModal;
