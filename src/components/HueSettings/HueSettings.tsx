import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MeshGradientBackground from '../Backgrounds/MeshGradientBackground';
import { HueBridge, HueCredentials, EntertainmentGroup } from '../../types/HueTypes';
import { useHue } from '../../hooks/useHue';

type SetupStage = 'connect' | 'link' | 'groups' | 'complete' | 'test';

const HueSettings: React.FC = () => {
  const navigate = useNavigate();
  const { isConfigured, hueSettings, registerBridge, fetchGroups, startHueStreaming, stopHueStreaming, setLightColor, saveHueSettings, resetHueSettings } = useHue();
  
  const [ipAddress, setIpAddress] = useState<string>('');
  const [isIpValid, setIsIpValid] = useState<boolean>(false);
  const [setupStage, setSetupStage] = useState<SetupStage>('connect');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [bridge, setBridge] = useState<HueBridge | null>(null);
  const [credentials, setCredentials] = useState<HueCredentials | null>(null);
  const [groups, setGroups] = useState<EntertainmentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Show the complete stage if already configured
  useEffect(() => {
    if (isConfigured && hueSettings) {
      setBridge(hueSettings.bridge);
      setCredentials(hueSettings.credentials);
      setSelectedGroup(hueSettings.selectedGroup);
      setSetupStage('complete');
    }
  }, [isConfigured, hueSettings]);

  // Validate IP address format
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

  // Update IP validation state when IP changes
  useEffect(() => {
    setIsIpValid(validateIpAddress(ipAddress));
  }, [ipAddress]);

  const handleBridgeConnect = async () => {
    if (!isIpValid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create bridge object
      const newBridge: HueBridge = {
        id: `manual_${Date.now()}`,
        ip: ipAddress,
        name: 'Hue Bridge (Manual)',
      };
      
      setBridge(newBridge);
      setSetupStage('link');
    } catch (err) {
      setError('Failed to connect to bridge');
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
      const newCredentials = await registerBridge(bridge.ip);
      setCredentials(newCredentials);
      
      // Fetch entertainment groups
      const groups = await fetchGroups(bridge.ip, newCredentials.username, newCredentials.clientkey);
      setGroups(groups);
      
      setSetupStage('groups');
    } catch (err: any) {
      setError(err.message || 'Failed to register with bridge');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupSelect = async (groupId: string) => {
    if (!bridge || !credentials) return;
    
    setSelectedGroup(groupId);
    
    const settings = {
      bridge,
      credentials,
      selectedGroup: groupId
    };
    
    saveHueSettings(settings);
    setSetupStage('complete');
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
      case 'connect':
        return (
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Set Up Phillips Hue Integration</h2>
            
            <div className="mb-6">
              <p className="text-sm mb-4">
                Enter your Hue Bridge's IP address. You can find this in the Hue app under Settings → Hue Bridges.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">IP Address</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.1.2"
                  className="w-full p-2 border rounded-md bg-white bg-opacity-80"
                />
                {ipAddress && !isIpValid && (
                  <p className="text-red-500 text-sm mt-1">Please enter a valid IP address</p>
                )}
              </div>
            </div>
            
            {error && <div className="text-red-500 mb-4">{error}</div>}
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleBridgeConnect}
                className={`px-6 py-2 text-white rounded-full transition-colors ${
                  isIpValid && !isLoading
                    ? "bg-blue-500 hover:bg-blue-600" 
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                disabled={!isIpValid || isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect'}
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
            
            {bridge && (
              <div className="text-center mb-6">
                <p className="mb-2">Bridge: {bridge.name}</p>
                <p className="text-sm text-gray-600">{bridge.ip}</p>
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
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                  <p>Waiting for link button press...</p>
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
                onClick={() => setSetupStage('connect')}
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
                <p className="mt-2">You need to create one in the Hue app first.</p>
              </div>
            )}
            
            <div className="mt-6 flex justify-center">
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
              
              {bridge && (
                <div className="mb-4">
                  <p className="font-semibold">Connected Bridge:</p>
                  <p className="text-sm">{bridge.name}</p>
                  <p className="text-sm text-gray-600">{bridge.ip}</p>
                </div>
              )}
              
              {selectedGroup && groups.length > 0 && (
                <div className="mb-6">
                  <p className="font-semibold">Selected Entertainment Area:</p>
                  <p className="text-sm">{groups.find(g => g.id === selectedGroup)?.name || selectedGroup}</p>
                </div>
              )}
              
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