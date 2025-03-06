import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { HueSettings, HueCredentials, EntertainmentGroup } from '../types/HueTypes';
import { ElectronHandler } from '../main/preload';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

// Export the types and interfaces that other components might need
export interface HueContextType {
  isConfigured: boolean;
  hueSettings: HueSettings | null;
  isStreamingActive: boolean;
  registerBridge: (ip: string) => Promise<HueCredentials>;
  fetchGroups: (ip: string, username: string, clientkey: string) => Promise<EntertainmentGroup[]>;
  startHueStreaming: () => Promise<boolean>;
  stopHueStreaming: () => Promise<boolean>;
  setLightColor: (lightIds: number[], rgb: number[], transitionTime: number) => Promise<boolean>;
  saveHueSettings: (settings: HueSettings) => void;
  resetHueSettings: () => void;
}

// Create the context with default values
const HueContext = createContext<HueContextType>({
  isConfigured: false,
  hueSettings: null,
  isStreamingActive: false,
  registerBridge: async () => ({ username: '', clientkey: '' }),
  fetchGroups: async () => [],
  startHueStreaming: async () => false,
  stopHueStreaming: async () => false,
  setLightColor: async () => false,
  saveHueSettings: () => {},
  resetHueSettings: () => {},
});

interface HueProviderProps {
  children: ReactNode;
}

function HueProvider({ children }: HueProviderProps) {
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

  // Register with a bridge by IP address
  const registerBridge = useCallback(async (ip: string): Promise<HueCredentials> => {
    try {
      const credentials = await window.electron.hue.registerBridge(ip);
      return credentials;
    } catch (error) {
      console.error('Failed to register with bridge:', error);
      throw error;
    }
  }, []);

  // Fetch entertainment groups
  const fetchGroups = useCallback(async (ip: string, username: string, clientkey: string): Promise<EntertainmentGroup[]> => {
    try {
      const groups = await window.electron.hue.fetchGroups({ ip, username, psk: clientkey });
      return groups;
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      return [];
    }
  }, []);

  // Start streaming to entertainment group
  const startHueStreaming = useCallback(async (): Promise<boolean> => {
    if (!hueSettings) return false;
    
    try {
      const { bridge, credentials, selectedGroup } = hueSettings;
      const result = await window.electron.hue.startStreaming({
        ip: bridge.ip,
        username: credentials.username,
        psk: credentials.clientkey,
        groupId: selectedGroup
      });
      
      setIsStreamingActive(Boolean(result));
      return Boolean(result);
    } catch (error) {
      console.error('Failed to start Hue streaming:', error);
      setIsStreamingActive(false);
      return false;
    }
  }, [hueSettings]);

  // Stop streaming
  const stopHueStreaming = useCallback(async (): Promise<boolean> => {
    try {
      const result = await window.electron.hue.stopStreaming();
      setIsStreamingActive(false);
      return Boolean(result);
    } catch (error) {
      console.error('Failed to stop Hue streaming:', error);
      return false;
    }
  }, []);

  // Set light colors
  const setLightColor = useCallback(async (lightIds: number[], rgb: number[], transitionTime: number): Promise<boolean> => {
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
  }, [isStreamingActive]);

  // Save Hue settings
  const saveHueSettings = useCallback((settings: HueSettings) => {
    localStorage.setItem('hueSettings', JSON.stringify(settings));
    setHueSettings(settings);
    setIsConfigured(true);
  }, []);

  // Reset Hue settings
  const resetHueSettings = useCallback(() => {
    localStorage.removeItem('hueSettings');
    setHueSettings(null);
    setIsConfigured(false);
    setIsStreamingActive(false);
  }, []);

  return (
    <HueContext.Provider
      value={{
        isConfigured,
        hueSettings,
        isStreamingActive,
        registerBridge,
        fetchGroups,
        startHueStreaming,
        stopHueStreaming,
        setLightColor,
        saveHueSettings,
        resetHueSettings
      }}
    >
      {children}
    </HueContext.Provider>
  );
}

function useHue() {
  const context = useContext(HueContext);
  if (context === undefined) {
    throw new Error('useHue must be used within a HueProvider');
  }
  return context;
}

export { HueProvider, useHue };