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

// Hook to use the Hue context
export const useHue = () => useContext(HueContext);

// Local storage key for Hue settings
const HUE_SETTINGS_KEY = 'hue_settings';

// Provider component that wraps app and provides Hue context
export const HueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hueSettings, setHueSettings] = useState<HueSettings | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false);

  // Load saved settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(HUE_SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setHueSettings(parsed);
        setIsConfigured(true);
      } catch (error) {
        console.error('Failed to parse saved Hue settings:', error);
        localStorage.removeItem(HUE_SETTINGS_KEY);
      }
    }
  }, []);

  // Register with Hue bridge
  const registerBridge = useCallback(async (ip: string): Promise<HueCredentials> => {
    try {
      const credentials = await window.electron.hue.registerBridge(ip);
      console.log('Registered with bridge:', credentials);
      return credentials as HueCredentials;
    } catch (error) {
      console.error('Failed to register with bridge:', error);
      throw error;
    }
  }, []);

  // Fetch entertainment groups
  const fetchGroups = useCallback(async (
    ip: string,
    username: string,
    clientkey: string
  ): Promise<EntertainmentGroup[]> => {
    try {
      const groups = await window.electron.hue.fetchGroups({
        ip,
        username,
        clientkey
      });
      console.log('Fetched entertainment groups:', groups);
      return groups;
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      return [];
    }
  }, []);

  // Start streaming to Hue lights
  const startHueStreaming = useCallback(async (): Promise<boolean> => {
    if (!hueSettings) return false;

    try {
      const success = await window.electron.hue.startStreaming({
        ip: hueSettings.bridge.ip,
        username: hueSettings.credentials.username,
        psk: hueSettings.credentials.clientkey,
        groupId: hueSettings.selectedGroup
      });
      
      setIsStreamingActive(success);
      return success;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      return false;
    }
  }, [hueSettings]);

  // Stop streaming
  const stopHueStreaming = useCallback(async (): Promise<boolean> => {
    try {
      const success = await window.electron.hue.stopStreaming();
      setIsStreamingActive(false);
      return success;
    } catch (error) {
      console.error('Failed to stop streaming:', error);
      setIsStreamingActive(false);
      return false;
    }
  }, []);

  // Set light color
  const setLightColor = useCallback(async (
    lightIds: number[],
    rgb: number[],
    transitionTime: number
  ): Promise<boolean> => {
    if (!isStreamingActive) return false;

    try {
      return await window.electron.hue.setColor({
        lightIds,
        rgb,
        transitionTime
      });
    } catch (error) {
      console.error('Failed to set light color:', error);
      return false;
    }
  }, [isStreamingActive]);

  // Save Hue settings to local storage
  const saveHueSettings = useCallback((settings: HueSettings) => {
    try {
      localStorage.setItem(HUE_SETTINGS_KEY, JSON.stringify(settings));
      setHueSettings(settings);
      setIsConfigured(true);
    } catch (error) {
      console.error('Failed to save Hue settings:', error);
    }
  }, []);

  // Reset Hue settings
  const resetHueSettings = useCallback(() => {
    localStorage.removeItem(HUE_SETTINGS_KEY);
    setHueSettings(null);
    setIsConfigured(false);
    setIsStreamingActive(false);
  }, []);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (isStreamingActive) {
        window.electron.hue.stopStreaming().catch(console.error);
      }
    };
  }, [isStreamingActive]);

  // Create context value object with all functions and state
  const value = {
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
  };

  return <HueContext.Provider value={value}>{children}</HueContext.Provider>;
};