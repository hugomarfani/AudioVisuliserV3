import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MeshGradientBackground from '../Backgrounds/MeshGradientBackground';
import { HueBridge, HueCredentials, EntertainmentGroup, HueSettings as HueSettingsType } from '../../hooks/useHue';
import { useHue } from '../../hooks/useHue';

// Setup stages for the onboarding flow
type SetupStage = 'discovery' | 'link' | 'groups' | 'complete' | 'test';

const HueSettings: React.FC = () => {
  const navigate = useNavigate();
  const { isConfigured, hueSettings: savedSettings, resetHueSettings, startHueStreaming, stopHueStreaming, setLightColor } = useHue();
  
  const [bridges, setBridges] = useState<HueBridge[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<HueBridge | null>(null);
  const [credentials, setCredentials] = useState<HueCredentials | null>(null);
  const [groups, setGroups] = useState<EntertainmentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [setupStage, setSetupStage] = useState<SetupStage>('discovery');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [linkButtonPressed, setLinkButtonPressed] = useState<boolean>(false);
  const [linkAttempts, setLinkAttempts] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  // Show the complete stage if already configured
  useEffect(() => {
    if (isConfigured && savedSettings) {
      setSelectedBridge(savedSettings.bridge);
      setCredentials(savedSettings.credentials);
      setSelectedGroup(savedSettings.selectedGroup);
      setSetupStage('complete');
    }
  }, [isConfigured, savedSettings]);

  // Discover Hue bridges when on discovery stage
  useEffect(() => {
    if (setupStage === 'discovery') {
      discoverBridges();
    }
  }, [setupStage]);

  // Attempt to register with bridge when link button is pressed
  useEffect(() => {
    if (linkButtonPressed && selectedBridge && setupStage === 'link') {
      const registerInterval = setInterval(async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          const response = await window.electron.hue.registerBridge(selectedBridge.ip);
          
          if (response && response.username && response.clientkey) {
            setCredentials({
              username: response.username,
              psk: response.clientkey
            });
            clearInterval(registerInterval);
            setIsLoading(false);
            setSetupStage('groups');
            
            // Fetch entertainment groups after successful registration
            fetchEntertainmentGroups(selectedBridge.ip, response.username, response.clientkey);
          } else {
            setLinkAttempts(prev => prev + 1);
            if (linkAttempts > 30) { // Try for about 30 seconds
              clearInterval(registerInterval);
              setError('Link button not pressed in time. Please try again.');
              setIsLoading(false);
              setLinkButtonPressed(false);
              setLinkAttempts(0);
            }
          }
        } catch (err) {
          console.error('Registration error:', err);
        }
      }, 1000);
      
      return () => clearInterval(registerInterval);
    }
  }, [linkButtonPressed, selectedBridge, setupStage, linkAttempts]);

  const discoverBridges = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Frontend: Starting bridge discovery...');
      
      console.log('Frontend: Calling window.electron.hue.discoverBridges()');
      const discoveredBridges = await window.electron.hue.discoverBridges() as HueBridge[];
      
      console.log('Frontend: Received bridge discovery response:', discoveredBridges);
      setBridges(discoveredBridges || []);
      
      if (!discoveredBridges || discoveredBridges.length === 0) {
        console.log('Frontend: No bridges found in discovery response');
      }
    } catch (err) {
      console.error('Frontend: Error during bridge discovery:', err);
      setError('Failed to discover Hue bridges');
    } finally {
      console.log('Frontend: Bridge discovery process completed');
      setIsLoading(false);
    }
  };

  const handleBridgeSelect = (bridge: HueBridge) => {
    setSelectedBridge(bridge);
    setSetupStage('link');
  };

  const handleLinkButtonPress = () => {
    setLinkButtonPressed(true);
    setLinkAttempts(0);
  };

  const fetchEntertainmentGroups = async (ip: string, username: string, psk: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedGroups = await window.electron.hue.fetchGroups({ ip, username, psk }) as Record<string, any>;
      
      // Filter for entertainment groups
      const entertainmentGroups = Object.entries(fetchedGroups)
        .filter(([_, group]: [string, any]) => group.type === 'Entertainment')
        .map(([id, group]: [string, any]) => ({
          id,
          name: group.name,
          lights: group.lights,
          type: group.type
        }));
      
      setGroups(entertainmentGroups);
    } catch (err) {
      setError('Failed to fetch entertainment groups');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
    
    // Save complete Hue settings to localStorage
    if (selectedBridge && credentials) {
      const settings: HueSettingsType = {
        bridge: selectedBridge,
        credentials,
        selectedGroup: groupId
      };
      localStorage.setItem('hueSettings', JSON.stringify(settings));
      setSetupStage('complete');
      // Force a reload to update the context with the new settings
      window.location.reload();
    }
  };

  const handleCreateGroup = () => {
    // For demonstration purposes, show a message about creating a group in the Hue app
    alert('Please use the Philips Hue app to create an Entertainment Area, then return here.');
    
    // Deep link examples (could be implemented with platform detection):
    // For Android: hue.settings.ADD_ENTERTAINMENT_AREA with BRIDGEID argument
    // For iOS: hue2sync://entertainment-setup?bridge_id=${bridgeId}
  };

  const handleStartTest = async () => {
    setSetupStage('test');
    setIsStreaming(true);
    await startHueStreaming();
  };

  const handleStopTest = async () => {
    await stopHueStreaming();
    setIsStreaming(false);
    setSetupStage('complete');
  };

  const testLights = async (color: number[]) => {
    if (isStreaming) {
      await setLightColor([0], color, 500);
    }
  };

  const renderStage = () => {
    switch (setupStage) {
      case 'discovery':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Set Up Phillips Hue Integration</h2>
            
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center my-6">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-4">Discovering Hue bridges...</p>
              </div>
            ) : bridges.length > 0 ? (
              <>
                <p className="mb-4">Select your Hue Bridge:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {bridges.map((bridge) => (
                    <button
                      key={bridge.id}
                      onClick={() => handleBridgeSelect(bridge)}
                      className="w-full bg-white bg-opacity-50 hover:bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-lg p-4 flex justify-between items-center transition-colors"
                    >
                      <span>{bridge.name || `Hue Bridge (${bridge.id})`}</span>
                      <span className="text-sm text-gray-600">{bridge.ip}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center mb-4">No Hue Bridges found on your network.</p>
            )}
            
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={discoverBridges}
                className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                disabled={isLoading}
              >
                Refresh
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      
      case 'link':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Link with Hue Bridge</h2>
            
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            {selectedBridge && (
              <div className="text-center mb-6">
                <p className="mb-2">Bridge: {selectedBridge.name || `Hue Bridge (${selectedBridge.id})`}</p>
                <p className="text-sm text-gray-600">{selectedBridge.ip}</p>
              </div>
            )}
            
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 h-32 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
                  <rect width="200" height="200" rx="30" fill="#ffffff" />
                  <circle cx="100" cy="100" r="50" fill="#00a0e9" />
                  <circle cx="100" cy="100" r="30" fill="#ffffff" />
                </svg>
              </div>
              
              {isLoading ? (
                <div className="text-center">
                  <div className="flex justify-center my-6">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                  <p className="text-sm">Waiting for link button to be pressed...</p>
                  <p className="text-xs text-gray-600 mt-2">Attempts: {linkAttempts}/30</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-6">Press the link button on your Hue Bridge, then click below:</p>
                  
                  <button
                    onClick={handleLinkButtonPress}
                    className="px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  >
                    I've Pressed the Link Button
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  setSelectedBridge(null);
                  setSetupStage('discovery');
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        );
      
      case 'groups':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Select Entertainment Area</h2>
            
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            {isLoading ? (
              <div className="flex justify-center my-6">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : groups.length > 0 ? (
              <>
                <p className="mb-4">Select an Entertainment Area:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleGroupSelect(group.id)}
                      className="w-full bg-white bg-opacity-50 hover:bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-lg p-4 flex justify-between items-center transition-colors"
                    >
                      <span>{group.name}</span>
                      <span className="text-sm text-gray-600">{group.lights.length} lights</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center mb-6">
                <p>No Entertainment Areas found.</p>
                <p className="mt-2">You need to create one in the Hue app.</p>
                <div className="mt-4">
                  <button
                    onClick={handleCreateGroup}
                    className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                  >
                    Learn How to Create Area
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={() => {
                  if (selectedBridge && credentials) {
                    fetchEntertainmentGroups(selectedBridge.ip, credentials.username, credentials.psk);
                  }
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                disabled={isLoading}
              >
                Refresh
              </button>
              <button
                onClick={() => setSetupStage('link')}
                className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        );
      
      case 'test':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Test Your Hue Lights</h2>
            
            <div className="space-y-4 mb-6">
              <p className="text-center">Click the colors below to test your lights:</p>
              
              <div className="grid grid-cols-3 gap-4">
                <button 
                  className="w-full h-16 bg-red-500 rounded-lg"
                  onClick={() => testLights([255, 0, 0])}
                />
                <button 
                  className="w-full h-16 bg-green-500 rounded-lg"
                  onClick={() => testLights([0, 255, 0])}
                />
                <button 
                  className="w-full h-16 bg-blue-500 rounded-lg"
                  onClick={() => testLights([0, 0, 255])}
                />
                <button 
                  className="w-full h-16 bg-yellow-400 rounded-lg"
                  onClick={() => testLights([255, 255, 0])}
                />
                <button 
                  className="w-full h-16 bg-purple-600 rounded-lg"
                  onClick={() => testLights([128, 0, 128])}
                />
                <button 
                  className="w-full h-16 bg-pink-400 rounded-lg"
                  onClick={() => testLights([255, 105, 180])}
                />
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handleStopTest}
                className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        );
      
      case 'complete':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
              <p className="mb-6">Your Phillips Hue lights are now ready to sync with your music.</p>
              
              {selectedBridge && (
                <div className="mb-4">
                  <p className="font-semibold">Connected Bridge:</p>
                  <p className="text-sm">{selectedBridge.name || `Hue Bridge (${selectedBridge.id})`}</p>
                </div>
              )}
              
              <div className="mb-6">
                <p className="font-semibold">Selected Entertainment Area:</p>
                <p className="text-sm">{groups.find(g => g.id === selectedGroup)?.name || selectedGroup}</p>
              </div>
              
              <div className="flex flex-col space-y-4">
                <button
                  onClick={handleStartTest}
                  className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                >
                  Test Lights
                </button>
                
                <button
                  onClick={resetHueSettings}
                  className="px-6 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  Reset Configuration
                </button>
                
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                >
                  Back to App
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <MeshGradientBackground>
      <div className="min-h-screen flex items-center justify-center p-4">
        {renderStage()}
      </div>
    </MeshGradientBackground>
  );
};

export default HueSettings;