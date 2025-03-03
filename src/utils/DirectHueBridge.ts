/**
 * DirectHueBridge - A direct implementation of the Philips Hue Entertainment API
 * This bypasses the Phea library and implements the DTLS protocol directly
 */

// Type for configuration
export interface DirectHueConfig {
  address: string;
  username: string;
  psk: string;
  entertainmentGroupId: string;
}

// Main class for direct Hue bridge control
export class DirectHueBridge {
  private config: DirectHueConfig;
  private isConnected: boolean = false;
  private lastCommandTime: number = 0;
  private connected: boolean = false;
  private messageCount: number = 0;
  private lightIDs: string[] = [];
  private lightIndices: number[] = [];

  constructor(config: DirectHueConfig) {
    this.config = config;
  }

  // Connect to the bridge directly through the REST API
  async connect(): Promise<boolean> {
    try {
      // Step 1: Activate the entertainment group via REST API
      console.log(`🚀 DirectHueBridge: Activating entertainment group ${this.config.entertainmentGroupId}`);

      // This will be done through IPC since we can't make HTTPS requests directly
      const result = await window.electron.ipcRenderer.invoke('hue:activateEntertainmentGroup', {
        bridgeIP: this.config.address,
        username: this.config.username,
        groupId: this.config.entertainmentGroupId
      });

      if (!result?.success) {
        throw new Error(`Failed to activate entertainment group: ${result?.error || 'Unknown error'}`);
      }

      console.log('✅ Entertainment group activated via REST API');

      // Step 2: Get the light IDs in this entertainment group
      const lightResponse = await window.electron.ipcRenderer.invoke('hue:getLightRids');

      if (Array.isArray(lightResponse) && lightResponse.length > 0) {
        this.lightIDs = lightResponse;
        this.lightIndices = Array.from({ length: this.lightIDs.length }, (_, i) => i);
        console.log(`📋 Got ${this.lightIDs.length} lights for entertainment group`);
      } else {
        // Default to 3 light indices if we can't determine the actual count
        this.lightIndices = [0, 1, 2];
        console.log('⚠️ Could not get light IDs, using default indices:', this.lightIndices);
      }

      // Step 3: Start the DTLS streaming session
      const streamingResult = await window.electron.ipcRenderer.invoke('hue:startDTLSStream', {
        bridgeIP: this.config.address,
        username: this.config.username,
        psk: this.config.psk,
        groupId: this.config.entertainmentGroupId
      });

      if (!streamingResult?.success) {
        throw new Error(`Failed to start DTLS streaming: ${streamingResult?.error || 'Unknown error'}`);
      }

      console.log('🔌 DTLS streaming session established');
      this.connected = true;
      return true;
    } catch (error) {
      console.error('DirectHueBridge connect error:', error);
      this.connected = false;
      return false;
    }
  }

  // Send color to lights using direct IPC to main process
  async sendColor(rgb: [number, number, number], lightIndices?: number[]): Promise<boolean> {
    if (!this.connected) {
      console.warn('Cannot send color: Not connected');
      return false;
    }

    try {
      const indices = lightIndices || this.lightIndices;
      this.messageCount++;

      // Rate limit logging
      const now = Date.now();
      const quiet = now - this.lastCommandTime < 1000;
      if (!quiet) {
        console.log(`🎨 DirectHueBridge: Sending RGB(${rgb.join(',')}) to indices [${indices.join(',')}]`);
        this.lastCommandTime = now;
      }

      // Send the command via IPC
      const result = await window.electron.ipcRenderer.invoke('hue:sendDTLSColor', {
        rgb,
        indices,
        messageId: this.messageCount
      });

      if (!result?.success) {
        console.error(`Error sending color: ${result?.error || 'Unknown error'}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending color via DirectHueBridge:', error);
      return false;
    }
  }

  // Test if the connection is working correctly
  async testConnection(): Promise<boolean> {
    if (!this.connected) {
      console.warn('Cannot test: Not connected');
      return false;
    }

    try {
      // Send a sequence of colors to test
      const testColors: [number, number, number][] = [
        [1, 0, 0],  // Red
        [0, 1, 0],  // Green
        [0, 0, 1],  // Blue
        [1, 1, 0],  // Yellow
        [1, 0, 1],  // Purple
        [0, 0, 0]   // Off
      ];

      console.log('🧪 Running DirectHueBridge color test');

      for (const color of testColors) {
        await this.sendColor(color);
        // Wait 800ms between colors for visible effect
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      return true;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  // Disconnect from the bridge
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      // Deactivate the entertainment group
      await window.electron.ipcRenderer.invoke('hue:deactivateEntertainmentGroup', {
        bridgeIP: this.config.address,
        username: this.config.username,
        groupId: this.config.entertainmentGroupId
      });

      // Close the DTLS connection
      await window.electron.ipcRenderer.invoke('hue:stopDTLSStream');

      this.connected = false;
      console.log('DirectHueBridge: Disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Return the light indices this bridge controls
  getLightIndices(): number[] {
    return [...this.lightIndices];
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected;
  }
}
