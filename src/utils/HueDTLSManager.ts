import hueDTLSRenderer from './HueDTLSRenderer';

// Configuration type for DTLS connection
interface HueConfig {
  address: string;
  username: string;
  psk: string;
  entertainmentGroupId: string;
}

// Class to manage the DTLS connection through the renderer API
export class HueDTLSManager {
  private config: HueConfig | null = null;
  private activeGroupId: string = '';
  private lightChannels: Map<number, { x: number, y: number, z: number }> = new Map();
  private lastColors: Map<number, [number, number, number]> = new Map();

  constructor(config: HueConfig | null = null) {
    if (config) {
      this.setConfig(config);
    }
  }

  // Set the configuration
  public setConfig(config: HueConfig): void {
    this.config = config;
    this.activeGroupId = config.entertainmentGroupId;

    // Update the renderer config
    hueDTLSRenderer.setConfig({
      bridgeIp: config.address,
      username: config.username,
      psk: config.psk
    }).catch(console.error);
  }

  // Check if config is valid
  public hasValidConfig(): boolean {
    return !!(this.config?.address &&
      this.config.username &&
      this.config.psk &&
      this.config.entertainmentGroupId);
  }

  // Start streaming
  public async startStreaming(groupId?: string): Promise<boolean> {
    if (!this.config) {
      console.error('No configuration loaded');
      return false;
    }

    // Use provided group ID or default from config
    const targetGroupId = groupId || this.config.entertainmentGroupId;
    this.activeGroupId = targetGroupId;

    try {
      // Connect to the DTLS server
      const connected = await hueDTLSRenderer.connect(targetGroupId);
      if (!connected) {
        throw new Error('Failed to establish DTLS connection');
      }

      console.log('Successfully connected to bridge via DTLS');
      return true;
    } catch (error) {
      console.error('Error starting DTLS streaming:', error);
      return false;
    }
  }

  // Stop streaming
  public async stopStreaming(): Promise<void> {
    await hueDTLSRenderer.disconnect();
    this.lastColors.clear();
  }

  // Send colors to the lights
  public sendColors(colors: Map<number, [number, number, number]>): boolean {
    try {
      // Update last colors
      colors.forEach((color, id) => {
        this.lastColors.set(id, color);
      });

      // Send to the renderer
      hueDTLSRenderer.sendColors(colors);
      return true;
    } catch (error) {
      console.error('Error sending colors:', error);
      return false;
    }
  }

  // Flash all lights with a specific color
  public async flashAll(color: [number, number, number]): Promise<boolean> {
    try {
      return await hueDTLSRenderer.sendColorToAll(color);
    } catch (error) {
      console.error('Error flashing lights:', error);
      return false;
    }
  }

  // Test the connection
  public async testConnection(): Promise<boolean> {
    try {
      return await hueDTLSRenderer.runTestSequence();
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  }

  // Check if connected
  public async isConnectedToBridge(): Promise<boolean> {
    return await hueDTLSRenderer.isConnectedToBridge();
  }
}

// Create and export a singleton instance
export default new HueDTLSManager();
