import { ipcMain } from 'electron';
import axios from 'axios';
import https from 'https';
import dgram from 'dgram';
// Fixed import for node-dtls-client
var dtls = require("node-dtls-client");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Interface for DTLS connection options
interface DtlsOptions {
  type: string;
  address: string;
  port: number;
  psk: { [key: string]: Buffer };
  timeout: number;
  ciphers: string[];
}

/**
 * HueService handles the communication with Phillips Hue bridges and lights
 * using the Entertainment API via direct DTLS communication
 */
export default class HueService {
  private socket: any | null = null;
  private selectedGroup: string | null = null;
  private isStreaming = false;
  private streamInterval: NodeJS.Timeout | null = null;
  private groupIdMap: Map<string, string> = new Map(); // Map to store UUID to numeric ID mapping
  private entertainmentId: string | null = null;
  private sequenceNumber = 1;

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
    ipcMain.handle('hue-test-lights', this.handleTestLights); // Add new handler
    console.log('Registered Hue IPC handlers');
  }

  /**
   * Discover available Hue bridges on the network
   */
  private handleDiscover = async (): Promise<any[]> => {
    try {
      console.log('Discovering Hue bridges...');
      // Using the Hue discovery endpoint
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
   * Starts the entertainment group for streaming
   * This needs to be done before establishing the DTLS connection
   */
  private async startEntertainmentGroup(ip: string, username: string, entertainmentId: string): Promise<boolean> {
    try {
      console.log(`Starting entertainment group ${entertainmentId}...`);
      const response = await axios.put(
        `https://${ip}/clip/v2/resource/entertainment_configuration/${entertainmentId}`,
        { action: "start" },
        {
          headers: { 'hue-application-key': username },
          httpsAgent
        }
      );
      console.log('Start entertainment response:', response.status);
      return true;
    } catch (error) {
      console.error('Failed to start entertainment group:', error);
      return false;
    }
  }

  /**
   * Stops the entertainment group streaming
   */
  private async stopEntertainmentGroup(ip: string, username: string, entertainmentId: string): Promise<boolean> {
    if (!entertainmentId) return false;
    
    try {
      console.log(`Stopping entertainment group ${entertainmentId}...`);
      const response = await axios.put(
        `https://${ip}/clip/v2/resource/entertainment_configuration/${entertainmentId}`,
        { action: "stop" },
        {
          headers: { 'hue-application-key': username },
          httpsAgent
        }
      );
      console.log('Stop entertainment response:', response.status);
      return true;
    } catch (error) {
      console.error('Failed to stop entertainment group:', error);
      return false;
    }
  }

  /**
   * Creates a DTLS connection to the Hue bridge
   */
  private createDtlsSocket(ip: string, username: string, clientkey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Creating DTLS connection to ${ip}:2100`);

        // Convert clientkey from hex to Buffer
        const pskBuffer = Buffer.from(clientkey, 'hex');
        
        // Create PSK lookup object - use Buffer value as specified in the documentation
        const pskLookup = {};
        pskLookup[username] = pskBuffer; // Use Buffer for PSK value instead of hex string
        
        // Debug output for PSK values
        console.log(`Debug - PSK Username: ${username}`);
        console.log(`Debug - PSK Value (hex): ${clientkey}`);
        console.log(`Debug - PSK Buffer:`, pskBuffer);

        // Create options object for DTLS connection
        const options = {
          type: "udp4",
          address: ip,
          port: 2100,
          psk: pskLookup,
          timeout: 10000,
          // Specify cipher suite as per the docs
          ciphers: ["TLS_PSK_WITH_AES_128_GCM_SHA256"]
        };

        console.log("DTLS options (full debug):", {
          ...options,
          psk: { [username]: `Buffer(${pskBuffer.length})` } // Show buffer length for readability
        });
        
        // Check if the module structure exists
        console.log("DTLS module structure:", Object.keys(dtls));
        
        // Attempt to create the socket with the proper structure
        let client;
        
        if (dtls.dtls && typeof dtls.dtls.createSocket === 'function') {
          console.log("Using dtls.dtls.createSocket");
          client = dtls.dtls.createSocket(options);
        } else if (typeof dtls.createSocket === 'function') {
          console.log("Using dtls.createSocket");
          client = dtls.createSocket(options);
        } else {
          throw new Error("Could not find createSocket method in the DTLS module");
        }
        
        client.on("connected", () => {
          console.log("DTLS connection established successfully");
          resolve(client);
        });
        
        client.on("error", (error) => {
          console.error("DTLS connection error:", error);
          reject(error);
        });
        
        client.on("close", () => {
          console.log("DTLS connection closed");
          this.isStreaming = false;
        });
        
        client.on("message", (message) => {
          console.log("Received message from bridge:", message);
        });
        
        // Note: connection should happen automatically with createSocket
        
      } catch (error) {
        console.error("Error creating DTLS socket:", error);
        reject(error);
      }
    });
  }

  /**
   * Creates a command buffer to send to the Hue bridge via DTLS
   */
  private createCommandBuffer(entertainmentId: string, lightCommands: { id: number, rgb: number[] }[]): Buffer {
    // Detailed logging of light commands
    console.log(`Creating command for entertainment ID: ${entertainmentId}`);
    console.log(`Light commands (${lightCommands.length} lights):`);
    lightCommands.forEach(cmd => {
      console.log(`  Light ID: ${cmd.id}, Color: RGB(${cmd.rgb.join(',')})`);
    });
    
    // Static protocol name used by the API
    const protocolName = Buffer.from("HueStream", "ascii");

    // Format the header fields correctly (big-endian format)
    const restOfHeader = Buffer.from([
      0x02, 0x00, // Streaming API version 2.0
      this.sequenceNumber & 0xFF, // sequence number (0-255)
      0x00, 0x00, // Reserved - just fill with 0's
      0x00, // specifies RGB color (set 0x01 for xy + brightness)
      0x00, // Reserved - just fill with 0's
    ]);

    // Log sequence number for debugging
    console.log(`Using sequence number: ${this.sequenceNumber}`);
    
    // Increment sequence number for next command
    this.sequenceNumber = (this.sequenceNumber + 1) % 256;

    // Entertainment area ID (36 bytes as a UUID)
    const entertainmentConfigurationId = Buffer.from(entertainmentId, "ascii");

    // Create light commands (7 bytes per light)
    const lightBuffers = lightCommands.map(light => {
      // Scale RGB values from 0-255 to 0-65535 for the Hue protocol
      const r = Math.min(65535, Math.round((light.rgb[0] / 255) * 65535));
      const g = Math.min(65535, Math.round((light.rgb[1] / 255) * 65535));
      const b = Math.min(65535, Math.round((light.rgb[2] / 255) * 65535));

      // Create buffer for this light channel
      return Buffer.from([
        light.id, // channel id (light id)
        // For each color component, we need to convert to a 16-bit value (big-endian)
        (r >> 8) & 0xFF, r & 0xFF, // red (16-bit)
        (g >> 8) & 0xFF, g & 0xFF, // green (16-bit)
        (b >> 8) & 0xFF, b & 0xFF, // blue (16-bit)
      ]);
    });

    // Concat everything together to build the command
    const finalBuffer = Buffer.concat([protocolName, restOfHeader, entertainmentConfigurationId, ...lightBuffers]);
    console.log(`Command buffer created, total length: ${finalBuffer.length} bytes`);
    
    return finalBuffer;
  }

  /**
   * Starts streaming to the selected entertainment group using direct DTLS
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
      
      // Store the entertainment UUID for later use
      this.entertainmentId = groupId;
      this.selectedGroup = groupId;
      
      // First, start the entertainment group
      const startSuccess = await this.startEntertainmentGroup(ip, username, groupId);
      if (!startSuccess) {
        console.error('Failed to start entertainment group');
        return false;
      }
      
      // Create a DTLS socket
      try {
        this.socket = await this.createDtlsSocket(ip, username, psk);
      } catch (error) {
        console.error('Failed to create DTLS socket:', error);
        // Stop entertainment group that we started
        await this.stopEntertainmentGroup(ip, username, groupId);
        return false;
      }
      
      // Connection was established successfully
      this.isStreaming = true;
      
      // Start a keepalive interval to keep the connection alive
      this.streamInterval = setInterval(() => {
        if (this.isStreaming && this.socket && this.entertainmentId) {
          try {
            // Send a black color to all lights as a keepalive
            const keepaliveCommand = this.createCommandBuffer(
              this.entertainmentId,
              [{ id: 0, rgb: [0, 0, 0] }]
            );
            
            this.socket.send(keepaliveCommand, (error) => {
              if (error) console.error('Error sending keepalive:', error);
            });
          } catch (error) {
            console.error('Error in keepalive interval:', error);
          }
        }
      }, 5000);
      
      // Send a test color to verify the connection
      if (this.socket && this.entertainmentId) {
        const testCommand = this.createCommandBuffer(
          this.entertainmentId,
          [{ id: 0, rgb: [255, 0, 0] }] // Red color
        );
        
        this.socket.send(testCommand, (error) => {
          if (error) {
            console.error('Failed to send test color:', error);
          } else {
            console.log('Successfully sent test color to lights');
          }
        });
      }
      
      console.log('Streaming started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.isStreaming = false;
      this.socket = null;
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
      if (!this.isStreaming || !this.socket || !this.entertainmentId) {
        console.log('Cannot set color - not streaming or no socket connection');
        return false;
      }
      
      // Validate RGB values to ensure they're within range
      const validRgb = rgb.map(val => Math.max(0, Math.min(255, Math.round(val))));
      
      // Add more debugging
      console.log(`Setting colors for lights ${lightIds.join(', ')}: RGB(${validRgb.join(', ')}), transition: ${transitionTime}ms`);
      
      // Create commands for each light
      const lightCommands = lightIds.map(id => ({ id, rgb: validRgb }));
      
      // Create and send the command buffer
      const commandBuffer = this.createCommandBuffer(this.entertainmentId, lightCommands);
      
      return new Promise((resolve) => {
        this.socket!.send(commandBuffer, (error) => {
          if (error) {
            console.error('Error setting light color:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error setting light color:', error);
      return false;
    }
  };

  /**
   * Performs a test sequence on all lights in the entertainment group
   * Shows a sequence of colors to verify the setup is working
   * Uses high-frequency streaming to ensure commands are not lost
   */
  private handleTestLights = async (_: any, { lightCount = 10 }: { lightCount?: number }): Promise<boolean> => {
    try {
      if (!this.isStreaming || !this.socket || !this.entertainmentId) {
        console.log('Cannot test lights - not streaming');
        return false;
      }

      console.log(`====== STARTING LIGHT TEST SEQUENCE ======`);
      console.log(`Target light count: ${lightCount}`);
      console.log(`Entertainment ID: ${this.entertainmentId}`);
      console.log(`Socket connected: ${!!this.socket}`);
      
      // Define test colors
      const colors = [
        [255, 0, 0],    // Red
        [0, 255, 0],    // Green
        [0, 0, 255],    // Blue
        [255, 255, 0],  // Yellow
        [255, 0, 255],  // Purple
        [0, 255, 255],  // Cyan
        [255, 255, 255] // White
      ];

      // Create an array of all possible light IDs (0 to lightCount-1)
      const allLightIds = Array.from({ length: lightCount }, (_, i) => i);
      console.log(`Testing lights with IDs: ${allLightIds.join(', ')}`);
      
      // Make sure all lights are initially set to black/off for clean start
      console.log('Setting all lights to black for clean start');
      await this.streamColorWithHighFrequency([0, 0, 0], allLightIds, 500, 30);
      
      // Test individual lights first - try each light with red color
      console.log('Testing each light individually with red color');
      for (const lightId of allLightIds) {
        console.log(`Testing light ${lightId} with RED color individually`);
        await this.streamColorWithHighFrequency([255, 0, 0], [lightId], 500, 30);
        // Short pause between lights
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Test each color with all lights together
      console.log('Testing all lights together with each color');
      for (const color of colors) {
        console.log(`Testing all lights with color: RGB(${color.join(', ')})`);
        await this.streamColorWithHighFrequency(color, allLightIds, 1500, 50);
      }
      
      // Final cleanup - set all lights to black/off
      console.log('Final cleanup - setting lights to black');
      await this.streamColorWithHighFrequency([0, 0, 0], allLightIds, 500, 30);
      
      console.log('====== LIGHT TEST SEQUENCE COMPLETED ======');
      return true;
    } catch (error) {
      console.error('Error during light test sequence:', error);
      return false;
    }
  };
  
  /**
   * Stream a single color to all specified lights with high frequency 
   * to ensure commands are not lost due to UDP packet loss
   */
  private async streamColorWithHighFrequency(
    rgb: number[], 
    lightIds: number[], 
    durationMs: number = 1000, 
    frequencyHz: number = 50
  ): Promise<void> {
    if (!this.isStreaming || !this.socket || !this.entertainmentId) {
      throw new Error('Streaming not active');
    }
    
    console.log(`==== STARTING HIGH FREQUENCY COLOR STREAM ====`);
    console.log(`Color: RGB(${rgb.join(',')})`);
    console.log(`Target Light IDs (${lightIds.length}): ${lightIds.join(', ')}`);
    console.log(`Duration: ${durationMs}ms at ${frequencyHz}Hz`);
    
    // Try an experimental approach - send each light individually first
    try {
      for (const lightId of lightIds) {
        const singleLightCmd = this.createCommandBuffer(
          this.entertainmentId, 
          [{ id: lightId, rgb }]
        );
        await new Promise<void>((resolve, reject) => {
          this.socket!.send(singleLightCmd, (error) => {
            if (error) {
              console.error(`Error setting individual light ${lightId}:`, error);
              reject(error);
            } else {
              console.log(`Successfully sent command to light ${lightId}`);
              resolve();
            }
          });
        });
        // Small delay between individual light commands
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log("Finished individual light setup, proceeding to group streaming");
    } catch (err) {
      console.warn("Error during individual light setup:", err);
      // Continue with group streaming regardless
    }
    
    return new Promise((resolve, reject) => {
      // Calculate interval time based on frequency (ms)
      const intervalMs = Math.floor(1000 / frequencyHz);
      
      // Create light commands once
      const lightCommands = lightIds.map(id => ({ id, rgb }));
      
      console.log(`Creating command buffer for all ${lightIds.length} lights...`);
      // Create command buffer once
      const commandBuffer = this.createCommandBuffer(this.entertainmentId!, lightCommands);
      
      let elapsedTime = 0;
      let errorOccurred = false;
      let commandsSent = 0;
      let commandsSucceeded = 0;
      
      console.log(`Starting ${frequencyHz}Hz streaming interval...`);
      
      // Create interval to send commands at specified frequency
      const interval = setInterval(() => {
        elapsedTime += intervalMs;
        commandsSent++;
        
        // Send the command
        this.socket!.send(commandBuffer, (error) => {
          if (error) {
            console.error('Error sending color command:', error);
            errorOccurred = true;
            clearInterval(interval);
            reject(error);
          } else {
            commandsSucceeded++;
          }
        });
        
        // Every 10 commands, log progress
        if (commandsSent % 10 === 0) {
          console.log(`Streaming progress: ${elapsedTime}/${durationMs}ms, ${commandsSucceeded}/${commandsSent} commands succeeded`);
        }
        
        // Check if we've reached the duration
        if (elapsedTime >= durationMs && !errorOccurred) {
          clearInterval(interval);
          console.log(`==== COMPLETED COLOR STREAM ====`);
          console.log(`Streamed RGB(${rgb.join(',')}) for ${durationMs}ms at ${frequencyHz}Hz`);
          console.log(`Sent ${commandsSent} commands, ${commandsSucceeded} succeeded`);
          resolve();
        }
      }, intervalMs);
      
      // Safety timeout to ensure the promise resolves
      setTimeout(() => {
        clearInterval(interval);
        if (!errorOccurred) {
          console.log(`Safety timeout reached after ${durationMs + 200}ms`);
          resolve();
        }
      }, durationMs + 200);
    });
  }

  /**
   * Internal helper to stop streaming and clean up
   */
  private async stopStreaming(): Promise<void> {
    if (this.isStreaming && this.socket) {
      console.log('Stopping Hue streaming...');
      
      // Clear keepalive interval
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      
      // Close the DTLS connection
      try {
        if (typeof this.socket.close === 'function') {
          this.socket.close();
          console.log('DTLS connection closed successfully');
        } else if (typeof this.socket.end === 'function') {
          this.socket.end();
          console.log('DTLS connection ended successfully');
        } else {
          console.warn('Could not find appropriate method to close DTLS connection');
        }
      } catch (error) {
        console.error('Error closing DTLS connection:', error);
      }
      
      // Stop the entertainment group if we have an ID and it's still active
      if (this.entertainmentId) {
        // Get the IP and username from the socket options if available
        const socketAny = this.socket as any;
        const options = socketAny.options || {};
        const ip = options.address;
        const username = Object.keys(options.psk || {})[0];
        
        if (ip && username) {
          try {
            await this.stopEntertainmentGroup(ip, username, this.entertainmentId);
          } catch (error) {
            console.error('Failed to stop entertainment group:', error);
          }
        }
      }
      
      // Reset state
      this.isStreaming = false;
      this.socket = null;
      console.log('Streaming stopped and resources cleaned up');
    }
  }
}