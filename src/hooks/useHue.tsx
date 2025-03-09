import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Type definitions from both files
export interface HueBridgeInfo {
  id: string;
  internalIpAddress: string;
  name?: string;
  ip?: string;
}

export interface HueEntertainmentGroup {
  id: string;
  name: string;
  lights: string[];
}

export interface HueCredentials {
  username: string;
  clientkey: string;
}

// Combined HueSettings interface from both files
export interface HueSettings {
  username?: string;
  clientKey?: string;
  bridge?: HueBridgeInfo;
  selectedGroup?: HueEntertainmentGroup;
  availableGroups?: HueEntertainmentGroup[];
  credentials?: HueCredentials;
  selectedGroup?: string;
  numericGroupId?: string;
}

// Combined BeatData and BeatStatus interfaces
export interface BeatData {
  isBeat: boolean;
  energy: number;
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  vocalEnergy?: number;
  vocalActive?: boolean;
  color?: number[];
  brightness?: number;
  audioData?: Uint8Array;
}

export interface BeatStatus {
  isDetected: boolean;
  energy: number;
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  vocalEnergy: number;
  vocalActive: boolean;
  currentColor?: number[];
  brightness?: number;
  audioData?: Uint8Array;
  lastTime?: number;
}

// Global declaration for window.electron
declare global {
  interface Window {
    electron: {
      hue: {
        registerBridge: (ip: string) => Promise<HueCredentials>;
        getSettings: () => Promise<HueSettings>;
        fetchGroups: (params: { ip: string; username: string; clientkey: string }) => Promise<HueEntertainmentGroup[]>;
        onStreamingStateChanged: (callback: (event: any, isActive: boolean) => void) => void;
        removeStreamingStateListener: (callback: (event: any, isActive: boolean) => void) => void;
        onBeatDetected: (callback: (event: any, data: any) => void) => void;
        removeBeatListener: (callback: (event: any, data: any) => void) => void;
        startStreaming: (params: { ip: string; username: string; psk: string; groupId: string; numericGroupId?: string }) => Promise<boolean>;
        stopStreaming: () => Promise<void>;
        setColor: (params: { lightIds: number[]; rgb: number[]; transitionTime: number }) => Promise<boolean>;
        testLights: (params?: { lightIds?: number[] }) => Promise<boolean>;
        processBeat: (beatData: BeatData) => Promise<boolean>;
        getBeatStatus: () => Promise<BeatStatus>;
      };
    };
  }
}

// Combined context type with all methods from both files
export interface HueContextType {
  isConfigured: boolean;
  isStreamingActive: boolean;
  hueSettings: HueSettings | null;
  beatStatus: BeatStatus;
  registerBridge: (ip: string) => Promise<HueCredentials>;
  fetchGroups: (ip: string, username: string, clientkey: string) => Promise<HueEntertainmentGroup[]>;
  startHueStreaming: () => Promise<boolean>;
  stopHueStreaming: () => Promise<boolean>;
  setLightColor: (lightIds: number[], rgb: number[], transitionTime: number) => Promise<boolean>;
  saveHueSettings: (settings: HueSettings, numericId?: string) => void;
  resetHueSettings: () => void;
  testLights: (lightIds?: number[]) => Promise<boolean>;
  processBeat: (beatData: BeatData) => Promise<boolean>;
  refreshBeatStatus: () => Promise<BeatStatus>;
}

// Local storage key for Hue settings
const HUE_SETTINGS_KEY = 'hue_settings';

// Create the context with default values
const HueContext = createContext<HueContextType | undefined>(undefined);

// Provider component that wraps app and provides Hue context
export const HueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hueSettings, setHueSettings] = useState<HueSettings | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false);

  // Initialize default beatStatus with all properties from both implementations
  const [beatStatus, setBeatStatus] = useState<BeatStatus>({
    isDetected: false,
    energy: 0,
    bassEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    vocalEnergy: 0,
    vocalActive: false,
    brightness: 0.5,
    currentColor: [255, 255, 255],
    lastTime: 0
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to load from local storage first
        const savedSettings = localStorage.getItem(HUE_SETTINGS_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setHueSettings(parsed);
          setIsConfigured(!!parsed && !!parsed.credentials?.username && !!parsed.selectedGroup);
          return;
        }

        // Fall back to loading from electron if local storage is empty
        const settings = await window.electron.hue.getSettings();
        if (settings) {
          setHueSettings(settings);
          setIsConfigured(!!settings && !!settings.username && !!settings.clientKey && !!settings.selectedGroup);
        }
      } catch (error) {
        console.error('Error loading Hue settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Listen for streaming state changes from the main process
  useEffect(() => {
    // Check if the API exists before trying to use it
    if (!window.electron?.hue?.onStreamingStateChanged) {
      console.warn('Streaming state change API not available');
      return;
    }

    const handleStreamingStateChange = (_: any, isActive: boolean) => {
      setIsStreamingActive(isActive);
    };

    // Subscribe to streaming state updates
    window.electron.hue.onStreamingStateChanged(handleStreamingStateChange);

    // Clean up listener on component unmount
    return () => {
      if (window.electron?.hue?.removeStreamingStateListener) {
        window.electron.hue.removeStreamingStateListener(handleStreamingStateChange);
      }
    };
  }, []);

  // Listen for beat detection updates from the main process
  useEffect(() => {
    // Check if the API exists before trying to use it
    if (!window.electron?.hue?.onBeatDetected) {
      console.warn('Beat detection API not available');
      return;
    }

    // This handles the data coming back from the main process
    const handleBeatUpdate = (_: any, data: any) => {
      setBeatStatus({
        isDetected: data.isBeat || false,
        energy: data.energy || 0,
        bassEnergy: data.bassEnergy || 0,
        midEnergy: data.midEnergy || 0,
        highEnergy: data.highEnergy || 0,
        vocalEnergy: data.vocalEnergy || 0,
        vocalActive: data.vocalActive || false,
        currentColor: data.color || [255, 255, 255],
        brightness: data.brightness || 0.5,
        audioData: data.audioData,
        lastTime: Date.now()
      });
    };

    // Subscribe to beat detection updates
    window.electron.hue.onBeatDetected(handleBeatUpdate);

    // Clean up listener on component unmount
    return () => {
      if (window.electron?.hue?.removeBeatListener) {
        window.electron.hue.removeBeatListener(handleBeatUpdate);
      }
    };
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

  // Fetch entertainment groups with numeric IDs
  const fetchGroups = useCallback(async (
    ip: string,
    username: string,
    clientkey: string
  ): Promise<HueEntertainmentGroup[]> => {
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
      const { bridge, username, clientKey, selectedGroup, credentials } = hueSettings;

      // Support both API formats
      const ip = bridge?.internalIpAddress || bridge?.ip;
      const user = username || credentials?.username;
      const psk = clientKey || credentials?.clientkey || '';
      const groupId = typeof selectedGroup === 'string' ?
        selectedGroup :
        (selectedGroup as HueEntertainmentGroup)?.id;

      if (!ip || !user || !groupId) {
        console.error('Incomplete Hue settings');
        return false;
      }

      const success = await window.electron.hue.startStreaming({
        ip: ip,
        username: user,
        psk: psk,
        groupId: groupId,
        numericGroupId: hueSettings.numericGroupId
      });

      setIsStreamingActive(success);
      return success;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setIsStreamingActive(false);
      return false;
    }
  }, [hueSettings]);

  // Stop streaming
  const stopHueStreaming = useCallback(async (): Promise<boolean> => {
    try {
      await window.electron.hue.stopStreaming();
      setIsStreamingActive(false);

      // Reset beat status when stopping
      setBeatStatus({
        isDetected: false,
        energy: 0,
        bassEnergy: 0,
        midEnergy: 0,
        highEnergy: 0,
        vocalEnergy: 0,
        vocalActive: false,
        brightness: 0.5,
        currentColor: [255, 255, 255],
        lastTime: 0
      });

      return true;
    } catch (error) {
      console.error('Failed to stop streaming:', error);
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
  const saveHueSettings = useCallback((settings: HueSettings, numericId?: string) => {
    try {
      // Include the numeric ID in settings if provided
      const settingsToSave = numericId ?
        { ...settings, numericGroupId: numericId } :
        settings;

      localStorage.setItem(HUE_SETTINGS_KEY, JSON.stringify(settingsToSave));
      setHueSettings(settingsToSave);
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

  // Modified test lights function to accept specific light IDs
  const testLights = useCallback(async (lightIds?: number[]): Promise<boolean> => {
    try {
      return await window.electron.hue.testLights({ lightIds });
    } catch (error) {
      console.error('Error during light test:', error);
      return false;
    }
  }, []);

  // Process beat data
  const processBeat = useCallback(async (beatData: BeatData): Promise<boolean> => {
    if (!isStreamingActive) return false;

    try {
      const result = await window.electron.hue.processBeat(beatData);
      // After processing beat, refresh the beat status
      refreshBeatStatus();
      return result;
    } catch (error) {
      console.error('Failed to process beat data:', error);
      return false;
    }
  }, [isStreamingActive]);

  // Refresh beat detection status
  const refreshBeatStatus = useCallback(async (): Promise<BeatStatus> => {
    if (!isStreamingActive) {
      const defaultStatus = {
        isDetected: false,
        energy: 0,
        bassEnergy: 0,
        midEnergy: 0,
        highEnergy: 0,
        vocalEnergy: 0,
        vocalActive: false,
        lastTime: 0
      };
      setBeatStatus(defaultStatus);
      return defaultStatus;
    }

    try {
      // Check if the API exists before trying to use it
      if (!window.electron?.hue?.getBeatStatus) {
        console.warn('Get beat status API not available');
        return beatStatus; // Return current state instead of failing
      }

      const status = await window.electron.hue.getBeatStatus() as BeatStatus;
      setBeatStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to get beat status:', error);
      // Return current state instead of a new default
      return beatStatus;
    }
  }, [isStreamingActive, beatStatus]);

  // Setup a periodic polling for beat status - but only if the API exists
  useEffect(() => {
    if (!isStreamingActive || !window.electron?.hue?.getBeatStatus) return;

    // Poll beat status every 100ms
    const interval = setInterval(refreshBeatStatus, 100);

    return () => {
      clearInterval(interval);
    };
  }, [isStreamingActive, refreshBeatStatus]);

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
    isStreamingActive,
    hueSettings,
    beatStatus,
    registerBridge,
    fetchGroups,
    startHueStreaming,
    stopHueStreaming,
    setLightColor,
    saveHueSettings,
    resetHueSettings,
    testLights,
    processBeat,
    refreshBeatStatus
  };

  return <HueContext.Provider value={value}>{children}</HueContext.Provider>;
};

// Hook for components to consume the Hue context
export function useHue(): HueContextType {
  const context = useContext(HueContext);
  if (context === undefined) {
    throw new Error('useHue must be used within a HueProvider');
  }
  return context;
}
