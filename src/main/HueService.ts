import { ipcMain } from 'electron';
import * as Phea from 'phea';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Updated interface to include all required Phea options
interface PheaOptions {
  address: string;
  username: string;
  psk: string;
  dtlsPort: number;
  dtlsTimeoutMs: number;
  dtlsUpdatesPerSecond: number;  // Made required
  colorUpdatesPerSecond: number; // Made required
}

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
  private groupIdMap: Map<string, string> = new Map(); // Map to store UUID to numeric ID mapping

  constructor() {
    this.registerIpcHandlers();
    console.log('HueService initialized');
  }

  /**
   * Register all IPC handlers for Hue-related functionality
   */
  private registerIpcHandlers(): void {
    ipcMain.handle('hue-register', this.handleRegister);
    ipcMain.handle('hue-fetch-groups', this.handleFetchGroups);
    ipcMain.handle('hue-start-streaming', this.handleStartStreaming);
    ipcMain.handle('hue-stop-streaming', this.handleStopStreaming);
    ipcMain.handle('hue-set-color', this.handleSetColor);
    console.log('Registered Hue IPC handlers');
  }

  /**
   * Registers with a Hue bridge (user must press link button first)
   */
  private handleRegister = async (_: any, ip: string): Promise<any> => {
    try {
      console.log(`Attempting to register with bridge at ${ip}`);
      
      // Try to register and get credentials
      const response = await axios.post(`http://${ip}/api`, {
        devicetype: "audio_visualizer#app",
        generateclientkey: true
      });
      
      console.log('Registration response:', response.data);
      
      if (Array.isArray(response.data) && response.data[0]) {
        if (response.data[0].error) {
          // If there's an error (like button not pressed)
          console.error('Registration error:', response.data[0].error);
          throw new Error(response.data[0].error.description);
        }
        
        if (response.data[0].success) {
          const credentials = {
            username: response.data[0].success.username,
            clientkey: response.data[0].success.clientkey
          };
          
          console.log('Registration successful, credentials obtained');
          return credentials;
        }
      }
      
      throw new Error('Invalid response from bridge');
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  /**
   * Extracts numeric ID from v1 API path (e.g., '/groups/200' -> '200')
   */
  private extractNumericId(idV1Path: string): string | null {
    if (!idV1Path) return null;
    const match = idV1Path.match(/\/groups\/(\d+)$/);
    return match ? match[1] : null;
  }

  /**
   * Fetches available entertainment groups from the Hue bridge using CLIP v2 API
   */
  private handleFetchGroups = async (_: any, { ip, username }: { ip: string; username: string }): Promise<any> => {
    try {
      console.log(`Fetching entertainment groups from bridge at ${ip}`);
      
      const url = `https://${ip}/clip/v2/resource/entertainment_configuration`;
      const response = await axios.get(url, {
        headers: { 'hue-application-key': username },
        httpsAgent
      });
      
      console.log('Entertainment groups response:', response.data);
      this.groupIdMap.clear(); // Clear previous mappings
      
      if (response.data && Array.isArray(response.data.data)) {
        const groups = response.data.data.map((group: any) => {
          // Extract the numeric ID from the v1 API path
          const numericId = this.extractNumericId(group.id_v1);
          console.log(`Group ID: ${group.id}, Numeric ID: ${numericId}`);
          if (numericId) {
            // Store mapping of UUID to numeric ID
            this.groupIdMap.set(group.id, numericId);
          }
          
          return {
            id: group.id, // Keep using UUID for frontend
            name: group.metadata?.name || 'Unknown',
            lights: group.light_services?.map((light: any) => light.rid) || [],
            numericId: numericId // Add numeric ID to response
          };
        });
        
        console.log('Processed entertainment groups with numeric IDs:', this.groupIdMap);
        return groups;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching entertainment groups:', error);
      return [];
    }
  };

  /**
   * Gets information about the specified entertainment group
   */
  private async getGroupInfo(bridge: any, groupId: number): Promise<any> {
    try {
      console.log(`Fetching info for entertainment group ${groupId}`);
      const groupInfo = await bridge.getGroup(groupId);
      console.log(`Group ${groupId} info:`, groupInfo);
      console.log(`Number of lights in group: ${groupInfo.lights?.length || 'unknown'}`);
      return groupInfo;
    } catch (error) {
      console.error(`Failed to get group ${groupId} info:`, error);
      return null;
    }
  }

  /**
   * Starts streaming to the selected entertainment group
   */
  private handleStartStreaming = async (_: any, { 
    ip, 
    username, 
    psk, 
    groupId, 
    numericGroupId 
  }: { 
    ip: string; 
    username: string; 
    psk: string; 
    groupId: string;
    numericGroupId?: string;
  }): Promise<boolean> => {
    try {
      console.log(`Starting streaming to group ${groupId}`);
      
      // Use provided numeric ID if available, otherwise look it up
      let numericId = numericGroupId;
      if (!numericId) {
        numericId = this.groupIdMap.get(groupId);
        if (!numericId) {
          console.error(`No numeric ID found for group ${groupId}`);
          return false;
        }
      }
      
      console.log(`Using numeric group ID: ${numericId}`);
      
      if (this.isStreaming) {
        await this.stopStreaming();
      }
      
      // Create bridge instance with Phea
      const options: PheaOptions = {
        address: ip,
        username: username,
        psk: psk,
        dtlsPort: 2100,
        dtlsTimeoutMs: 1000,
        dtlsUpdatesPerSecond: 50,
        colorUpdatesPerSecond: 25,
      };
      
      console.log('Creating bridge instance with options:', JSON.stringify(options, null, 2));
      this.bridge = await Phea.bridge(options);
      
      // Get group info for debugging purposes
      const groupIdInt = parseInt(numericId, 10);
      await this.getGroupInfo(this.bridge, groupIdInt);
      
      // Try various approaches to start streaming
      try {
        console.log(`First attempt: Starting streaming with integer group ID: ${groupIdInt}`);
        this.connection = await this.bridge.start(groupIdInt);
      } catch (error) {
        console.log('First attempt failed, trying with alternative group ID');
        
        // Try with a small number (1) which is typically the first entertainment group
        try {
          console.log('Second attempt: Starting streaming with group ID: 1');
          this.connection = await this.bridge.start(1);
        } catch (error2) {
          // Last resort - try with empty string (let Phea select the first available group)
          console.log('Second attempt failed, trying with empty string group ID');
          this.connection = await this.bridge.start("");
        }
      }
      
      // Check if connection was established
      if (!this.connection) {
        throw new Error('Failed to establish connection');
      }
      
      console.log('Connection established successfully');
      this.selectedGroup = groupId;
      this.isStreaming = true;
      
      // Set up event handlers and interval safely
      if (typeof this.connection.on === 'function') {
        this.connection.on("close", () => {
          console.log("Hue connection closed");
          this.isStreaming = false;
          if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
          }
        });
      } else {
        console.warn("Connection object doesn't have expected 'on' method");
      }
      
      // Keep connection alive with type-safe error handling
      this.streamInterval = setInterval(() => {
        if (this.isStreaming && this.bridge) {
          this.bridge.transition([0], [0, 0, 0], 0).catch((error: Error) => {
            console.error('Error in keepalive:', error);
          });
        }
      }, 5000);
      
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