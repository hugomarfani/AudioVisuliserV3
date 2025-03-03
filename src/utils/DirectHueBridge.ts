/**
 * Direct implementation of Philips Hue Entertainment API using DTLS
 * This class is used as an alternative to the Phea library
 */
import { fixCSPForDTLS } from './CSPFix';
import { safeInvokeIPC } from './DirectHueIPCTest';
import { ensureIPCIsAvailable, verifyIPCReady } from './HueIPCInitializer';

// Make sure CSP allows necessary operations
fixCSPForDTLS();

// Run IPC availability check on import
ensureIPCIsAvailable();

// Configuration type
interface DirectHueBridgeConfig {
  address: string;        // Bridge IP
  username: string;       // Bridge username
  psk: string;           // Pre-shared key (clientKey)
  entertainmentGroupId: string; // UUID of the entertainment group
}

export class DirectHueBridge {
  private config: DirectHueBridgeConfig;
  private connected: boolean = false;
  private throttleTimeout: NodeJS.Timeout | null = null;
  private lastSentColor: [number, number, number] | null = null;
  private lightIndices: number[] = [0]; // Default to just light index 0
  private consecutiveErrors: number = 0;

  constructor(config: DirectHueBridgeConfig) {
    this.config = config;
    console.log('DirectHueBridge created with config:', {
      address: this.config.address,
      username: this.config.username,
      entertainmentGroupId: this.config.entertainmentGroupId,
      hasPsk: !!this.config.psk
    });
  }

  /**
   * Connect to the bridge and activate the entertainment group
   */
  async connect(): Promise<boolean> {
    try {
      console.log('DirectHueBridge connecting...');

      // First make sure IPC is ready
      if (!verifyIPCReady()) {
        throw new Error("IPC is not ready! The Electron preload script may not be configured correctly.");
      }

      console.log(`Activating entertainment group ${this.config.entertainmentGroupId} on bridge ${this.config.address}`);

      // Use our safe invoke function instead of direct invoke
      const activateResult = await safeInvokeIPC('hue:activateEntertainmentGroup', {
        ip: this.config.address,
        username: this.config.username,
        entertainmentGroupId: this.config.entertainmentGroupId
      });

      console.log('Activation result:', activateResult); // Add this for debugging

      if (!activateResult.success) {
        throw new Error(`Failed to activate entertainment group: ${activateResult.error}`);
      }

      console.log('Entertainment group activated successfully');

      // Then start the DTLS stream
      const streamResult = await safeInvokeIPC('hue:startDTLSStream', {
        ip: this.config.address,
        username: this.config.username,
        psk: this.config.psk,
        entertainmentGroupId: this.config.entertainmentGroupId
      });

      if (!streamResult.success) {
        throw new Error(`Failed to start DTLS stream: ${streamResult.error}`);
      }

      console.log('DTLS stream started successfully');

      // Reset error counter on successful connection
      this.consecutiveErrors = 0;

      // Set connected state
      this.connected = true;

      return true;
    } catch (error) {
      console.error('DirectHueBridge connect error:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if we're connected to the bridge
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send color to lights using our direct DTLS implementation
   */
  async sendColor(rgb: [number, number, number], throttleMs: number = 50): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Hue bridge');
    }

    try {
      // Check if we've recently sent the same color
      if (this.lastSentColor) {
        const [r1, g1, b1] = this.lastSentColor;
        const [r2, g2, b2] = rgb;

        // If the color is too similar to the last one and we're not in force mode, skip it
        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        if (diff < 0.05 && this.throttleTimeout !== null) {
          return;
        }
      }

      // Create a throttle mechanism
      if (this.throttleTimeout !== null) {
        clearTimeout(this.throttleTimeout);
      }

      // Store the color
      this.lastSentColor = rgb;

      // Send the color to the bridge
      const result = await safeInvokeIPC('hue:sendDTLSColor', {
        entertainmentGroupId: this.config.entertainmentGroupId,
        rgb
      });

      if (!result.success) {
        throw new Error(`Failed to send color: ${result.error}`);
      }

      // Reset error counter
      this.consecutiveErrors = 0;

      // Set up throttle timeout
      this.throttleTimeout = setTimeout(() => {
        this.throttleTimeout = null;
      }, throttleMs);

    } catch (error) {
      console.error('DirectHueBridge sendColor error:', error);
      this.consecutiveErrors++;

      // If we get too many consecutive errors, disconnect
      if (this.consecutiveErrors > 5) {
        console.warn('Too many consecutive errors, disconnecting');
        this.connected = false;
        throw error;
      }
    }
  }

  /**
   * Disconnect from the bridge
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // First stop the DTLS stream
      await safeInvokeIPC('hue:stopDTLSStream', {
        entertainmentGroupId: this.config.entertainmentGroupId
      });

      // Then deactivate the entertainment group
      await safeInvokeIPC('hue:deactivateEntertainmentGroup', {
        ip: this.config.address,
        username: this.config.username,
        entertainmentGroupId: this.config.entertainmentGroupId
      });

      this.connected = false;
      console.log('DirectHueBridge disconnected');
    } catch (error) {
      console.error('DirectHueBridge disconnect error:', error);
      // Force disconnect even if there was an error
      this.connected = false;
    }
  }

  /**
   * Run a color cycle test
   */
  async testConnection(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Hue bridge');
    }

    const colors: [number, number, number][] = [
      [1, 0, 0],   // Red
      [0, 1, 0],   // Green
      [0, 0, 1],   // Blue
      [1, 1, 0],   // Yellow
      [0, 1, 1],   // Cyan
      [1, 0, 1],   // Magenta
      [1, 1, 1],   // White
      [0, 0, 0]    // Off
    ];

    console.log('Running color cycle test...');

    for (const color of colors) {
      try {
        console.log(`Sending color: RGB(${color.join(', ')})`);
        await this.sendColor(color);
        // Wait 500ms between colors
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error during color cycle test:', error);
      }
    }

    console.log('Color cycle test completed');
  }

  /**
   * Get the light indices for this bridge
   */
  getLightIndices(): number[] {
    return this.lightIndices;
  }

  /**
   * Set the light indices for this bridge
   */
  setLightIndices(indices: number[]): void {
    if (indices.length > 0) {
      this.lightIndices = [...indices];
    }
  }
}
