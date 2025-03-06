import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define interfaces for Hue types
export interface HueBridge {
  name?: string;
  id: string;
  ip: string;
  mac?: string;
}

export interface HueCredentials {
  username: string;
  psk: string;
}

export interface EntertainmentGroup {
  id: string;
  name: string;
  lights: string[];
  type: string;
}

export interface HueSettings {
  bridge: HueBridge;
  credentials: HueCredentials;
  selectedGroup: string;
}

interface HueContextType {
  isConfigured: boolean;
  hueSettings: HueSettings | null;
  isStreamingActive: boolean;
  startHueStreaming: () => Promise<boolean>;
  stopHueStreaming: () => Promise<boolean>;
  setLightColor: (lightIds: number[], rgb: number[], transitionTime: number) => Promise<boolean>;
  resetHueSettings: () => void;
}

// Create the context with default values
const HueContext = createContext<HueContextType>({
  isConfigured: false,
  hueSettings: null,
  isStreamingActive: false,
  startHueStreaming: async () => false,
  stopHueStreaming: async () => false,
  setLightColor: async () => false,
  resetHueSettings: () => {},
});

// Custom hook for using the Hue context
export const useHue = () => useContext(HueContext);

interface HueProviderProps {
  children: ReactNode;
}

export const HueProvider: React.FC<HueProviderProps> = ({ children }) => {
  const [hueSettings, setHueSettings] = useState<HueSettings | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false);

  // Load saved Hue settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('hueSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings.bridge && parsedSettings.credentials && parsedSettings.selectedGroup) {
          setHueSettings(parsedSettings);
          setIsConfigured(true);
        }
      } catch (e) {
        console.error('Failed to parse saved Hue settings', e);
      }
    }
  }, []);

  // Start streaming to Hue lights
  const startHueStreaming = async (): Promise<boolean> => {
    if (!hueSettings) return false;
    
    try {
      const { bridge, credentials, selectedGroup } = hueSettings;
      
      const result = await window.electron.hue.startStreaming({
        ip: bridge.ip,
        username: credentials.username,
        psk: credentials.psk,
        groupId: selectedGroup
      });
      
      setIsStreamingActive(Boolean(result));
      return Boolean(result);
    } catch (error) {
      console.error('Failed to start Hue streaming:', error);
      setIsStreamingActive(false);
      return false;
    }
  };

  // Stop streaming to Hue lights
  const stopHueStreaming = async (): Promise<boolean> => {
    try {
      const result = await window.electron.hue.stopStreaming();
      setIsStreamingActive(false);
      return Boolean(result);
    } catch (error) {
      console.error('Failed to stop Hue streaming:', error);
      return false;
    }
  };

  // Set color of specific lights or all lights
  const setLightColor = async (lightIds: number[], rgb: number[], transitionTime: number): Promise<boolean> => {
    if (!isStreamingActive) return false;
    
    try {
      const result = await window.electron.hue.setColor({
        lightIds,
        rgb,
        transitionTime
      });
      
      return Boolean(result);
    } catch (error) {
      console.error('Failed to set light color:', error);
      return false;
    }
  };

  // Reset Hue settings
  const resetHueSettings = () => {
    localStorage.removeItem('hueSettings');
    setHueSettings(null);
    setIsConfigured(false);
    setIsStreamingActive(false);
  };

  return (
    <HueContext.Provider
      value={{
        isConfigured,
        hueSettings,
        isStreamingActive,
        startHueStreaming,
        stopHueStreaming,
        setLightColor,
        resetHueSettings
      }}
    >
      {children}
    </HueContext.Provider>
  );
};

export default HueContext;