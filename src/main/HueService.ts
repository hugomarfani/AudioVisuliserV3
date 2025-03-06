import { ipcMain } from 'electron';
import * as Phea from 'phea';
import axios from 'axios';

// Debug import verification
console.log('PHEA IMPORT CHECK:', {
  type: typeof Phea,
  keys: Phea ? Object.keys(Phea) : 'undefined',
  discover: typeof Phea?.discover,
  register: typeof Phea?.register,
  bridge: typeof Phea?.bridge
});

/**
 * HueService handles the communication with Phillips Hue bridges and lights
 * using the Entertainment API via the phea package
 */
export default class HueService {
  private bridge: any | null = null;
  private connection: any | null = null;
  private selectedGroup: string | null = null;
  private isStreaming = false;
  private streamInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.registerIpcHandlers();
    console.log('HueService initialized');
  }

  /**
   * Register all IPC handlers for Hue-related functionality
   */
  private registerIpcHandlers(): void {
    ipcMain.handle('hue-discover', this.handleDiscover);
    ipcMain.handle('hue-register', this.handleRegister);
    ipcMain.handle('hue-fetch-groups', this.handleFetchGroups);
    ipcMain.handle('hue-start-streaming', this.handleStartStreaming);
    ipcMain.handle('hue-stop-streaming', this.handleStopStreaming);
    ipcMain.handle('hue-set-color', this.handleSetColor);
    console.log('Registered Hue IPC handlers');
  }

  /**
   * Alternative method to discover Hue bridges using the Hue discovery API
   */
  private async discoverBridgesViaHueApi(): Promise<any[]> {
    try {
      console.log('Attempting discovery via Hue NUPNP API...');
      const response = await axios.get('https://discovery.meethue.com');
      console.log('NUPNP API response:', response.data);
      
      if (Array.isArray(response.data)) {
        return response.data.map(bridge => ({
          name: `Philips Hue Bridge (${bridge.id})`,
          id: bridge.id,
          ip: bridge.internalipaddress,
          mac: undefined
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error using NUPNP discovery:', error);
      return [];
    }
  }

  /**
   * Discovers Hue bridges on the local network
   */
  private handleDiscover = async (): Promise<any[]> => {
    try {
      console.log('Starting Hue bridge discovery...');
      
      // First try using Phea's discovery method
      if (typeof Phea.discover === 'function') {
        console.log('Trying Phea.discover()...');
        try {
          const bridges = await Promise.race([
            Phea.discover(),
            new Promise<any[]>((_, reject) => 
              setTimeout(() => reject(new Error('Phea discovery timeout')), 5000)
            )
          ]) as any[];
          
          console.log('Discovered bridges via Phea:', bridges);
          if (bridges && bridges.length > 0) {
            return bridges;
          }
        } catch (err) {
          console.warn('Phea.discover failed, falling back to API discovery:', err);
        }
      } else {
        console.warn('Phea.discover is not a function, falling back to API discovery');
      }
      
      // If Phea discovery fails or isn't available, fall back to Hue API discovery
      const bridges = await this.discoverBridgesViaHueApi();
      console.log('Discovered bridges via API:', bridges);
      return bridges;
    } catch (error) {
      console.error('Failed to discover bridges. Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      return [];
    }
  };

  /**
   * Registers with a Hue bridge (user must press link button first)
   */
  private handleRegister = async (_: any, ip: string): Promise<any> => {
    try {
      console.log(`Registering with Hue bridge at ${ip}...`);
      
      // First try with Phea's register method
      if (typeof Phea.register === 'function') {
        try {
          const credentials = await Phea.register(ip);
          console.log('Registration successful via Phea:', credentials);
          return credentials;
        } catch (err) {
          console.warn('Phea.register failed, falling back to manual registration:', err);
        }
      }
      
      // If Phea registration fails, implement a basic registration mechanism
      console.log('Attempting manual registration...');
      const response = await axios.post(`http://${ip}/api`, {
        devicetype: "audio_visualizer_app#macos",
        generateclientkey: true
      });
      
      console.log('Manual registration response:', response.data);
      
      if (response.data && response.data[0] && response.data[0].success) {
        return response.data[0].success;
      }
      
      return null;
    } catch (error) {
      console.error('Registration failed:', error);
      return null;
    }
  };

  /**
   * Fetches available entertainment groups from the Hue bridge
   */
  private handleFetchGroups = async (_: any, { ip, username, psk }: { ip: string; username: string; psk: string }): Promise<any> => {
    try {
      console.log(`Fetching groups from Hue bridge at ${ip}...`);
      
      // Create bridge instance
      const options = {
        address: ip,
        username: username,
        psk: psk,
        dtlsUpdatesPerSecond: 50,
        colorUpdatesPerSecond: 25,
      };
      
      this.bridge = await Phea.bridge(options);
      
      // Get all groups
      const groups = await this.bridge.getGroup(0);
      console.log('Fetched groups:', groups);
      return groups;
    } catch (error) {
      console.error('Error fetching groups:', error);
      return {};
    }
  };

  /**
   * Starts streaming to the selected entertainment group
   */
  private handleStartStreaming = async (_: any, { ip, username, psk, groupId }: { ip: string; username: string; psk: string; groupId: string }): Promise<boolean> => {
    try {
      console.log(`Starting Hue streaming to group ${groupId}...`);
      
      if (this.isStreaming) {
        await this.stopStreaming();
      }
      
      // Create bridge instance
      const options = {
        address: ip,
        username: username,
        psk: psk,
        dtlsUpdatesPerSecond: 50,
        colorUpdatesPerSecond: 25,
      };
      
      this.bridge = await Phea.bridge(options);
      
      // Start streaming
      this.connection = await this.bridge.start(groupId);
      this.selectedGroup = groupId;
      this.isStreaming = true;
      
      // Listen for connection close events
      this.connection.on("close", () => {
        console.log("Hue connection closed");
        this.isStreaming = false;
        if (this.streamInterval) {
          clearInterval(this.streamInterval);
          this.streamInterval = null;
        }
      });
      
      // Keep connection alive by sending updates periodically
      this.streamInterval = setInterval(() => {
        if (this.isStreaming && this.bridge) {
          // Just send the current color again to keep connection alive
          this.bridge.transition([0], [0, 0, 0], 0).catch(error => {
            console.error('Error in keepalive:', error);
          });
        }
      }, 5000); // Every 5 seconds
      
      console.log('Streaming started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.isStreaming = false;
      return false;
    }
  };

  /**
   * Stops streaming to the Hue entertainment group
   */
  private handleStopStreaming = async (): Promise<boolean> => {
    try {
      await this.stopStreaming();
      return true;
    } catch (error) {
      console.error('Failed to stop streaming:', error);
      return false;
    }
  };

  /**
   * Sets the color for specific lights or all lights
   */
  private handleSetColor = async (_: any, { lightIds, rgb, transitionTime }: { lightIds: number[]; rgb: number[]; transitionTime: number }): Promise<boolean> => {
    try {
      if (!this.isStreaming || !this.bridge) {
        return false;
      }
      
      await this.bridge.transition(lightIds, rgb, transitionTime);
      return true;
    } catch (error) {
      console.error('Error setting light color:', error);
      return false;
    }
  };

  /**
   * Internal helper to stop streaming and clean up
   */
  private async stopStreaming(): Promise<void> {
    if (this.isStreaming && this.bridge) {
      console.log('Stopping Hue streaming...');
      
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      
      try {
        await this.bridge.stop();
      } catch (error) {
        console.error('Error stopping bridge:', error);
      }
      
      this.isStreaming = false;
      this.connection = null;
      console.log('Streaming stopped');
    }
  }
}