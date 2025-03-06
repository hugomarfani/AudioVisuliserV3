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
    ipcMain.handle('hue-discover', this.handleDiscover);
    ipcMain.handle('hue-register', this.handleRegister);
    ipcMain.handle('hue-fetch-groups', this.handleFetchGroups);
    ipcMain.handle('hue-start-streaming', this.handleStartStreaming);
    ipcMain.handle('hue-stop-streaming', this.handleStopStreaming);
    ipcMain.handle('hue-set-color', this.handleSetColor);
    console.log('Registered Hue IPC handlers');
  }

  /**
   * Discover available Hue bridges on the network
   */
  private handleDiscover = async (): Promise<any[]> => {
    try {
      console.log('Discovering Hue bridges...');
      // Using mDNS discovery would be better, but for now we'll just use the Hue discovery endpoint
      const response = await axios.get('https://discovery.meethue.com/');
      console.log('Discovery response:', response.data);
      return response.data.map((bridge: any) => ({
        id: bridge.id,
        ip: bridge.internalipaddress,
        name: 'Hue Bridge'
      }));
    } catch (error) {
      console.error('Bridge discovery failed:', error);
      return [];
    }
  };

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
  private handleFetchGroups = async (_: any, { ip, username, psk }: { ip: string; username: string; psk: string }): Promise<any> => {
    try {
      console.log(`Fetching entertainment groups from bridge at ${ip}`);
      
      // Try the CLIP v2 API first
      try {
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
      } catch (error) {
        console.warn('CLIP v2 API failed, falling back to v1:', error);
      }
      
      // Fallback to CLIP v1 API
      const v1Url = `http://${ip}/api/${username}/groups`;
      const v1Response = await axios.get(v1Url);
      console.log('V1 Groups response:', v1Response.data);
      
      const groups = [];
      for (const [id, group] of Object.entries(v1Response.data)) {
        const groupData = group as any;
        if (groupData.type === 'Entertainment') {
          console.log(`Found v1 entertainment group: ${id}, ${groupData.name}`);
          groups.push({
            id: id,
            name: groupData.name,
            lights: groupData.lights || [],
            numericId: id // In v1, the id is already numeric
          });
          
          // Also store in our map
          this.groupIdMap.set(id, id);
        }
      }
      
      return groups;
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
      
      // Make sure previous connections are closed
      await this.stopStreaming();
      
      // Use provided numeric ID if available, otherwise look it up
      let numericId = numericGroupId;
      if (!numericId) {
        numericId = this.groupIdMap.get(groupId);
        if (!numericId) {
          console.error(`No numeric ID found for group ${groupId}`);
          
          // Attempt to fetch groups to update our mapping
          try {
            await this.handleFetchGroups(null, { ip, username, psk });
            numericId = this.groupIdMap.get(groupId);
            if (!numericId) {
              throw new Error(`Still no numeric ID for group ${groupId}`);
            }
          } catch (e) {
            console.error('Could not fetch groups to find numeric ID:', e);
            return false;
          }
        }
      }
      
      console.log(`Using numeric group ID: ${numericId}`);
      
      // Create bridge instance with Phea
      const options: PheaOptions = {
        address: ip,
        username: username,
        psk: psk,
        dtlsPort: 2100,
        dtlsTimeoutMs: 1500, // Increase timeout a bit
        dtlsUpdatesPerSecond: 50,
        colorUpdatesPerSecond: 25,
      };
      
      console.log('Creating bridge instance with options:', JSON.stringify(options, null, 2));
      
      // Create a clean bridge instance each time
      try {
        this.bridge = await Phea.bridge(options);
      } catch (error) {
        console.error('Failed to create bridge instance:', error);
        return false;
      }
      
      // Convert numeric ID to integer
      const groupIdInt = parseInt(numericId, 10);
      if (isNaN(groupIdInt)) {
        console.error(`Invalid numeric group ID: ${numericId}`);
        return false;
      }
      
      // Get group info for validation
      const groupInfo = await this.getGroupInfo(this.bridge, groupIdInt);
      if (!groupInfo) {
        console.error(`Could not get information for group ${groupIdInt}`);
        return false;
      }
      
      if (groupInfo.type !== 'Entertainment') {
        console.error(`Group ${groupIdInt} is not an entertainment group`);
        return false;
      }
      
      if (!groupInfo.lights || groupInfo.lights.length === 0) {
        console.error(`Group ${groupIdInt} has no lights`);
        return false;
      }
      
      // Prepare the entertainment group for streaming
      try {
        // First, ensure the entertainment group is not already active
        const prepareUrl = `http://${ip}/api/${username}/groups/${groupIdInt}`;
        await axios.put(prepareUrl, {
          stream: { active: false }
        });
        
        console.log(`Entertainment group ${groupIdInt} prepared for streaming`);
      } catch (error) {
        console.warn('Failed to prepare entertainment group:', error);
        // Continue anyway as this might still work
      }
      
      // Try starting the streaming session with various approaches
      try {
        console.log(`First attempt: Starting streaming with integer group ID: ${groupIdInt}`);
        this.connection = await this.bridge.start(groupIdInt);
      } catch (error) {
        console.error('First attempt failed:', error);
        
        try {
          console.log('Second attempt: Starting streaming with string group ID');
          this.connection = await this.bridge.start(numericId);
        } catch (error2) {
          console.error('Second attempt failed:', error2);
          
          try {
            console.log('Third attempt: Starting streaming with group ID 0');
            this.connection = await this.bridge.start(0);
          } catch (error3) {
            console.error('Third attempt failed:', error3);
            
            try {
              console.log('Final attempt: Starting streaming with empty string');
              this.connection = await this.bridge.start('');
            } catch (error4) {
              console.error('All attempts failed:', error4);
              throw new Error('Could not start streaming after multiple attempts');
            }
          }
        }
      }
      
      // Check if we got a connection object
      if (!this.connection) {
        console.error('Connection is null after start attempts');
        throw new Error('Failed to establish connection');
      }
      
      console.log('Connection established successfully:', this.connection);
      this.selectedGroup = groupId;
      this.isStreaming = true;
      
      // Set up event handlers for the connection
      if (typeof this.connection.on === 'function') {
        this.connection.on("close", () => {
          console.log("Hue connection closed");
          this.isStreaming = false;
          if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
          }
        });
        
        this.connection.on("error", (err: Error) => {
          console.error("Hue connection error:", err);
        });
      } else {
        console.log("Connection object doesn't have expected 'on' method, assuming connection is still good");
      }
      
      // Keep the connection alive with periodic updates
      this.streamInterval = setInterval(() => {
        if (this.isStreaming && this.bridge) {
          try {
            // Send a black color to light 0 as a keepalive
            this.bridge.transition([0], [0, 0, 0], 0).catch((error: Error) => {
              console.error('Error in keepalive:', error);
            });
          } catch (error) {
            console.error('Error in keepalive interval:', error);
          }
        }
      }, 5000);
      
      // Verify the streaming is active by sending a test color
      try {
        await this.bridge.transition([0], [255, 0, 0], 100);
        console.log('Successfully sent test color to lights');
      } catch (error) {
        console.error('Failed to send test color:', error);
        // Don't fail here, the connection might still be working
      }
      
      console.log('Streaming started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.isStreaming = false;
      this.connection = null;
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
        console.log('Cannot set color - not streaming or no bridge');
        return false;
      }
      
      // Validate RGB values to ensure they're within range
      const validRgb = rgb.map(val => Math.max(0, Math.min(255, Math.round(val))));
      
      // Add more debugging
      console.log(`Setting colors for lights ${lightIds.join(', ')}: RGB(${validRgb.join(', ')}), transition: ${transitionTime}ms`);
      
      await this.bridge.transition(lightIds, validRgb, transitionTime);
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
      
      // Clear keepalive interval
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      
      // Try to gracefully stop the bridge
      try {
        await this.bridge.stop();
        console.log('Bridge stopped successfully');
      } catch (error) {
        console.error('Error stopping bridge:', error);
      }
      
      // Reset state
      this.isStreaming = false;
      this.connection = null;
      this.bridge = null;
      console.log('Streaming stopped and resources cleaned up');
    }
  }
}