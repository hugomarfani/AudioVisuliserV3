import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import HueService from '../utils/HueService';

interface HueContextType {
  isConfigured: boolean;
  isConnected: boolean;
  isEnabled: boolean;
  bridgeIP: string | null;
  entertainmentGroup: string | null;
  setEnabled: (enabled: boolean) => void;
  connectToHue: () => Promise<boolean>;
  disconnectFromHue: () => Promise<void>;
  clearConfiguration: () => void;
}

const HueContext = createContext<HueContextType | undefined>(undefined);

interface HueProviderProps {
  children: ReactNode;
}

export const HueProvider: React.FC<HueProviderProps> = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [bridgeIP, setBridgeIP] = useState<string | null>(null);
  const [entertainmentGroup, setEntertainmentGroup] = useState<string | null>(null);

  // Load configuration on mount
  useEffect(() => {
    try {
      const config = localStorage.getItem('hueConfig');
      if (config) {
        const parsedConfig = JSON.parse(config);
        if (parsedConfig.address && parsedConfig.username && parsedConfig.entertainmentGroupId) {
          setIsConfigured(true);
          setBridgeIP(parsedConfig.address);
          setEntertainmentGroup(parsedConfig.entertainmentGroupId);

          // Restore enabled state from localStorage if available
          const savedSettings = localStorage.getItem('hueMusicSyncSettings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            setIsEnabled(settings.enabled || false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading Hue configuration:', error);
    }
  }, []);

  // Connect to Hue bridge
  const connectToHue = async (): Promise<boolean> => {
    if (!isConfigured) return false;

    try {
      const initialized = await HueService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize Hue bridge');
      }

      const connected = await HueService.startEntertainmentMode();
      if (!connected) {
        throw new Error('Failed to start entertainment mode');
      }

      setIsConnected(true);
      return true;
    } catch (error) {
      console.error('Error connecting to Hue:', error);
      setIsConnected(false);
      return false;
    }
  };

  // Disconnect from Hue bridge
  const disconnectFromHue = async (): Promise<void> => {
    if (isConnected) {
      try {
        await HueService.stopEntertainmentMode();
        setIsConnected(false);
      } catch (error) {
        console.error('Error disconnecting from Hue:', error);
      }
    }
  };

  // Clear configuration
  const clearConfiguration = (): void => {
    HueService.clearConfig();
    setIsConfigured(false);
    setBridgeIP(null);
    setEntertainmentGroup(null);
    setIsConnected(false);
    setIsEnabled(false);
  };

  // Toggle enabled state
  const toggleEnabled = async (enabled: boolean): Promise<void> => {
    setIsEnabled(enabled);

    if (enabled && isConfigured && !isConnected) {
      await connectToHue();
    } else if (!enabled && isConnected) {
      await disconnectFromHue();
    }
  };

  const contextValue: HueContextType = {
    isConfigured,
    isConnected,
    isEnabled,
    bridgeIP,
    entertainmentGroup,
    setEnabled: toggleEnabled,
    connectToHue,
    disconnectFromHue,
    clearConfiguration
  };

  return (
    <HueContext.Provider value={contextValue}>
      {children}
    </HueContext.Provider>
  );
};

// Hook to use the Hue context
export const useHue = (): HueContextType => {
  const context = useContext(HueContext);
  if (context === undefined) {
    throw new Error('useHue must be used within a HueProvider');
  }
  return context;
};

export default HueContext;
