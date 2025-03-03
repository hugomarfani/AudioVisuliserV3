/**
 * Renderer-side API for DTLS communication via IPC with the main process
 * This avoids CSP restrictions by moving DTLS functionality to the main process
 */

// Type for RGB color
type RGB = [number, number, number];

// Interface for DTLS configuration
interface HueDTLSConfig {
  bridgeIp: string;
  username: string;
  psk: string;
  applicationId?: string;
}

// Interface for DTLS channel colors
interface ChannelColor {
  id: number;
  rgb: RGB;
}

// Main DTLS API class
export class HueDTLSRenderer {
  private static instance: HueDTLSRenderer;
  private isConnected = false;
  private config: HueDTLSConfig | null = null;
  private entertainmentConfigId = '';

  private constructor() {
    // Private constructor for singleton
  }

  // Get singleton instance
  public static getInstance(): HueDTLSRenderer {
    if (!HueDTLSRenderer.instance) {
      HueDTLSRenderer.instance = new HueDTLSRenderer();
    }
    return HueDTLSRenderer.instance;
  }

  // Set configuration
  public async setConfig(config: HueDTLSConfig): Promise<boolean> {
    this.config = config;
    const result = await window.electron.ipcRenderer.invoke('hue:dtls-set-config', config);
    return result.success;
  }

  // Check if configuration is valid
  public async hasValidConfig(): Promise<boolean> {
    return await window.electron.ipcRenderer.invoke('hue:dtls-has-valid-config');
  }

  // Connect to the bridge
  public async connect(entertainmentConfigId: string): Promise<boolean> {
    try {
      this.entertainmentConfigId = entertainmentConfigId;
      const result = await window.electron.ipcRenderer.invoke('hue:dtls-connect', entertainmentConfigId);
      this.isConnected = result.success;
      return result.success;
    } catch (error) {
      console.error('Error connecting to DTLS:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Disconnect from the bridge
  public async disconnect(): Promise<void> {
    await window.electron.ipcRenderer.invoke('hue:dtls-disconnect');
    this.isConnected = false;
  }

  // Check if connected
  public async isConnectedToBridge(): Promise<boolean> {
    try {
      this.isConnected = await window.electron.ipcRenderer.invoke('hue:dtls-is-connected');
      return this.isConnected;
    } catch (error) {
      console.error('Error checking connection status:', error);
      return false;
    }
  }

  // Send colors to lights
  public async sendColors(colors: Map<number, RGB>): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      // Convert Map to array of objects
      const channelColors: ChannelColor[] = [];
      colors.forEach((rgb, id) => {
        channelColors.push({ id, rgb });
      });

      const result = await window.electron.ipcRenderer.invoke('hue:dtls-send-colors', channelColors);
      return result.success;
    } catch (error) {
      console.error('Error sending colors:', error);
      return false;
    }
  }

  // Convenience method to send the same color to all lights
  public async sendColorToAll(rgb: RGB, channelCount: number = 10): Promise<boolean> {
    const colors = new Map<number, RGB>();
    for (let i = 0; i < channelCount; i++) {
      colors.set(i, rgb);
    }
    return this.sendColors(colors);
  }

  // Run a test sequence
  public async runTestSequence(): Promise<boolean> {
    try {
      const result = await window.electron.ipcRenderer.invoke('hue:dtls-test-sequence');
      return result.success;
    } catch (error) {
      console.error('Error running test sequence:', error);
      return false;
    }
  }
}

// Export singleton instance
export default HueDTLSRenderer.getInstance();
