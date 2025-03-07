import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Stepper, Step, StepLabel,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, TextField, Paper, Link, Snackbar,
  styled
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/Close';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForward';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBack';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/Error';
import InfoRoundedIcon from '@mui/icons-material/Info';
import WarningRoundedIcon from '@mui/icons-material/Warning';
import RefreshRoundedIcon from '@mui/icons-material/Refresh';
import LightModeRoundedIcon from '@mui/icons-material/LightMode';
import SettingsRoundedIcon from '@mui/icons-material/Settings';
import WifiRoundedIcon from '@mui/icons-material/Wifi';
import LinkRoundedIcon from '@mui/icons-material/Link';
import GroupRoundedIcon from '@mui/icons-material/Group';
import { HueBridge, HueCredentials, EntertainmentGroup } from '../../types/HueTypes';
import { useHue } from '../../hooks/useHue';

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
  const { 
    isConfigured, 
    hueSettings, 
    registerBridge, 
    fetchGroups, 
    startHueStreaming, 
    stopHueStreaming, 
    setLightColor, 
    saveHueSettings, 
    resetHueSettings,
    testLights // Use the new testLights function
  } = useHue();
  
  const [activeStep, setActiveStep] = useState(isConfigured ? 3 : 0);
  const [ipAddress, setIpAddress] = useState<string>('');
  const [isIpValid, setIsIpValid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [bridge, setBridge] = useState<HueBridge | null>(null);
  const [credentials, setCredentials] = useState<HueCredentials | null>(null);
  const [groups, setGroups] = useState<EntertainmentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage>({
    message: '',
    type: 'info',
    open: false
  });

  // The steps array defines the setup process
  const steps = [
    'Discover Bridge',
    'Register with Bridge',
    'Select Entertainment Group',
    'Complete Setup'
  ];

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

  // Validate IP address
  const validateIpAddress = (ip: string): boolean => {
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipPattern);
    if (!match) return false;
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(match[i], 10);
      if (octet < 0 || octet > 255) return false;
    }
    return true;
  };

  useEffect(() => {
    setIsIpValid(validateIpAddress(ipAddress));
  }, [ipAddress]);

  useEffect(() => {
    if (isConfigured && hueSettings) {
      setBridge(hueSettings.bridge);
      setCredentials(hueSettings.credentials);
      setSelectedGroup(hueSettings.selectedGroup);
      setActiveStep(3);
      
      // Fetch the entertainment groups when the modal opens if already configured
      if (hueSettings.bridge && hueSettings.credentials) {
        // Load the entertainment groups to ensure we have the data for the test function
        fetchGroups(
          hueSettings.bridge.ip,
          hueSettings.credentials.username,
          hueSettings.credentials.clientkey
        ).then(fetchedGroups => {
          setGroups(fetchedGroups);
          console.log('Loaded entertainment groups for configured bridge:', fetchedGroups);
        }).catch(err => {
          console.error('Failed to load entertainment groups:', err);
        });
      }
    }
  }, [isConfigured, hueSettings, fetchGroups]);

  const handleBridgeConnect = async () => {
    if (!isIpValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const newBridge: HueBridge = {
        id: `manual_${Date.now()}`,
        ip: ipAddress,
        name: 'Hue Bridge (Manual)',
      };
      setBridge(newBridge);
      setActiveStep(1);
      showToast('Bridge found successfully!', 'success');
    } catch (err) {
      setError('Failed to connect to bridge');
      showToast('Failed to connect to bridge', 'error', 'Connection Error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkButtonPress = async () => {
    if (!bridge) return;
    setIsLoading(true);
    setError(null);
    try {
      showToast("Press the link button on your Hue Bridge now...", 'info');
      
      // Wait 2 seconds to give user time to read the message
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newCredentials = await registerBridge(bridge.ip);
      setCredentials(newCredentials);
      const groups = await fetchGroups(bridge.ip, newCredentials.username, newCredentials.clientkey);
      setGroups(groups);
      setActiveStep(2);
      showToast('Successfully registered with bridge!', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to register with bridge');
      showToast('Failed to register. Make sure to press the link button first.', 'error', 'Registration Failed');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupSelect = async (groupId: string) => {
    if (!bridge || !credentials) return;
    setSelectedGroup(groupId);
    
    // Find the selected group to get its numeric ID
    const selectedGroupObj = groups.find(group => group.id === groupId);
    const numericId = selectedGroupObj?.numericId;
    
    const settings = {
      bridge,
      credentials,
      selectedGroup: groupId,
      numericGroupId: numericId // Store numeric ID
    };
    saveHueSettings(settings);
    setActiveStep(3);
    showToast('Entertainment area selected successfully!', 'success');
  };

  // Simplified function to handle light testing
  const handleStartTest = async () => {
    setIsLoading(true);
    
    try {
      // Get actual light IDs from the selected group
      const selectedGroupObj = groups.find(group => group.id === selectedGroup);
      
      if (!selectedGroupObj || !selectedGroupObj.lights || selectedGroupObj.lights.length === 0) {
        // If no group is found in loaded groups, try to reload them
        if (bridge && credentials) {
          console.log('No group found - attempting to reload entertainment groups');
          const reloadedGroups = await fetchGroups(bridge.ip, credentials.username, credentials.clientkey);
          setGroups(reloadedGroups);
          
          // Find the group in the newly loaded list
          const reloadedGroup = reloadedGroups.find(group => group.id === selectedGroup);
          
          if (!reloadedGroup || !reloadedGroup.lights || reloadedGroup.lights.length === 0) {
            showToast('No lights found in the selected entertainment area', 'error');
            setIsLoading(false);
            return;
          }
          
          // Continue with the reloaded group
          const lightIndices = Array.from({ length: reloadedGroup.lights.length }, (_, i) => i);
          console.log(`Testing entertainment area "${reloadedGroup.name}" with ${lightIndices.length} lights`);
          showToast(`Testing ${lightIndices.length} lights...`, 'info');
          
          const success = await testLights(lightIndices);
          
          if (success) {
            showToast('Light test completed successfully', 'success');
          } else {
            showToast('Light test failed', 'error', 'Test Failed');
          }
          
          setIsLoading(false);
          return;
        } else {
          showToast('No lights found in the selected entertainment area', 'error');
          setIsLoading(false);
          return;
        }
      }
      
      // Convert light IDs - in Hue Entertainment API, lights are typically indexed from 0
      // We'll simply use indices 0 to N-1 where N is the number of lights
      const lightIndices = Array.from({ length: selectedGroupObj.lights.length }, (_, i) => i);
      
      console.log(`Testing entertainment area "${selectedGroupObj.name}" with ${lightIndices.length} lights`);
      showToast(`Testing ${lightIndices.length} lights...`, 'info');
      
      // Call the testLights function with the specific light indices
      const success = await testLights(lightIndices);
      
      if (success) {
        showToast('Light test completed successfully', 'success');
      } else {
        showToast('Light test failed', 'error', 'Test Failed');
      }
    } catch (error) {
      console.error('Error during light test:', error);
      showToast('Error testing lights', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    resetHueSettings();
    setActiveStep(0);
    showToast('Configuration reset successfully', 'info');
  };

  // Handle next button
  const handleNext = () => {
    switch (activeStep) {
      case 0: // After bridge discovery
        handleBridgeConnect();
        break;
      case 1: // After registration
        handleLinkButtonPress();
        break;
      case 2: // After entertainment group selection
        if (selectedGroup) handleGroupSelect(selectedGroup);
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
            After pressing, quickly click "Register" below within 30 seconds
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
              To use Phillips Hue lights with the music visualizer, we need to connect to your Hue Bridge first.
              Enter your bridge's IP address below.
            </Typography>

            {error && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(255, 59, 48, 0.1)',
                p: 2,
                borderRadius: 3,
                mb: 3
              }}>
                <ErrorRoundedIcon sx={{ mr: 2, color: '#FF3B30' }} />
                <Typography variant="body2" color="#8A0000">
                  {error}
                </Typography>
              </Box>
            )}

            <AppleTextField
              label="Bridge IP Address"
              variant="outlined"
              fullWidth
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.2"
              error={ipAddress !== '' && !isIpValid}
              helperText={ipAddress !== '' && !isIpValid ? "Please enter a valid IP address" : ""}
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
                {bridge?.ip || ''}
              </Typography>
            </Box>
            
            {error && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(255, 59, 48, 0.1)',
                p: 2,
                borderRadius: 3,
                mb: 3
              }}>
                <ErrorRoundedIcon sx={{ mr: 2, color: '#FF3B30' }} />
                <Typography variant="body2" color="#8A0000">
                  {error}
                </Typography>
              </Box>
            )}
          </Box>
        );
      case 2: // Entertainment group selection
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              Select an entertainment area to use with the music visualizer.
            </Typography>

            {groups.length === 0 ? (
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
                  onClick={() => {
                    if (bridge && credentials) {
                      fetchGroups(bridge.ip, credentials.username, credentials.clientkey);
                    }
                  }}
                  sx={{ mt: 2 }}
                  startIcon={<RefreshRoundedIcon />}
                >
                  Refresh
                </AppleButton>
              </Box>
            ) : (
              <FormControl fullWidth margin="normal">
                <InputLabel id="entertainment-group-label">Entertainment Area</InputLabel>
                <AppleSelect
                  labelId="entertainment-group-label"
                  id="entertainment-group"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  label="Entertainment Area"
                >
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} ({group.lights.length} lights)
                    </MenuItem>
                  ))}
                </AppleSelect>
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
            
            {bridge && (
              <Box sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: 2, 
                backgroundColor: 'rgba(142, 142, 147, 0.1)',
                textAlign: 'left'
              }}>
                <Typography variant="subtitle2" color="#666">
                  Connected Bridge:
                </Typography>
                <Typography variant="body1">
                  {bridge.name}
                </Typography>
                <Typography variant="body2" color="#666">
                  {bridge.ip}
                </Typography>
              </Box>
            )}
            
            {/* Display Entertainment Area Details */}
            {selectedGroup && (
              <Box sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: 2, 
                backgroundColor: 'rgba(142, 142, 147, 0.1)',
                textAlign: 'left'
              }}>
                <Typography variant="subtitle2" color="#666">
                  Selected Entertainment Area:
                </Typography>
                {groups.map(group => {
                  if (group.id === selectedGroup) {
                    return (
                      <Box key={group.id}>
                        <Typography variant="body1">
                          {group.name}
                        </Typography>
                        <Typography variant="body2" color="#666">
                          {group.lights.length} lights
                        </Typography>
                        {group.numericId && (
                          <Typography variant="body2" color="#666">
                            Group ID: {group.numericId}
                          </Typography>
                        )}
                      </Box>
                    );
                  }
                  return null;
                })}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
              <AppleButton
                variant="outlined"
                onClick={handleStartTest}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={16} /> : <LightModeRoundedIcon />}
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
            
            <AppleButton
              variant="contained"
              color="error"
              onClick={handleReset}
              sx={{ backgroundColor: '#FF3B30', mt: 2, '&:hover': { backgroundColor: '#D93128' } }}
            >
              Reset Configuration
            </AppleButton>
          </Box>
        );
      default:
        return null;
    }
  };

  // Modal backdrop
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        zIndex: 1300,
      }}
    >
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
              (activeStep === 0 && !isIpValid) ||
              (activeStep === 2 && !selectedGroup && groups.length > 0)
            }
            endIcon={activeStep !== steps.length - 1 ? <ArrowForwardRoundedIcon /> : undefined}
          >
            {
              isLoading ? 
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={20} sx={{ color: 'white', mr: 1 }} /> 
                  {activeStep === 0 ? 'Connecting...' : activeStep === 1 ? 'Registering...' : 'Processing...'}
                </Box> : 
                (activeStep === steps.length - 1 ? 'Finish' : 'Next')
            }
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
    </Box>
  );
};

export default HueConfigModal;