/**
 * DirectHue - Direct implementation of Philips Hue Entertainment API
 * This bypasses the Phea library and provides a minimal implementation
 * to address potential compatibility issues
 */

import * as dgram from 'dgram';
import * as tls from 'tls';
import * as fs from 'fs';

interface DirectHueConfig {
  address: string;
  username: string;
  clientKey: string;
  port?: number;
  timeout?: number;
}

export class DirectHue {
  private config: DirectHueConfig;
  private socket: any | null = null;
  private connected: boolean = false;
  private sequence: number = 0;

  constructor(config: DirectHueConfig) {
    this.config = {
      ...config,
      port: config.port || 2100,
      timeout: config.timeout || 10000
    };
  }

  /**
   * Connect to the Hue bridge using DTLS
   * @param groupId The entertainment group ID to activate
   */
  async connect(groupId: string): Promise<boolean> {
    try {
      console.log(`Connecting directly to Hue bridge at ${this.config.address}:${this.config.port}`);

      // This is just a placeholder for the implementation
      // In a browser environment, we'll need to use the IPC renderer to call Main process
      const result = await window.electron.ipcRenderer.invoke('hue:dtls-connect', {
        address: this.config.address,
        username: this.config.username,
        clientKey: this.config.clientKey,
        groupId: groupId
      });

      this.connected = result.success;
      return this.connected;
    } catch (err) {
      console.error('Direct DTLS connection failed:', err);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from the bridge
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await window.electron.ipcRenderer.invoke('hue:dtls-disconnect');
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      this.connected = false;
    }
  }

  /**
   * Send RGB values to specified light indices
   */
  async setColors(lightIndices: number[], rgb: [number, number, number]): Promise<boolean> {
    if (!this.connected) {
      console.error('Not connected to bridge');
      return false;
    }

    try {
      return await window.electron.ipcRenderer.invoke('hue:dtls-send-colors', {
        indices: lightIndices,
        rgb: rgb
      });
    } catch (err) {
      console.error('Error sending colors:', err);
      return false;
    }
  }

  /**
   * Run a test sequence of colors on all lights
   */
  async runTestSequence(): Promise<boolean> {
    try {
      if (!this.connected) {
        console.error('Cannot run test sequence - not connected');
        return false;
      }

      return await window.electron.ipcRenderer.invoke('hue:dtls-test-sequence');
    } catch (err) {
      console.error('Error running test sequence:', err);
      return false;
    }
  }

  /**
   * Check if the connection is active
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export async function createDirectHueFromConfig(): Promise<DirectHue | null> {
  try {
    // Get saved config
    const hueConfig = localStorage.getItem('hueConfig');
    if (!hueConfig) return null;

    const config = JSON.parse(hueConfig);
    if (!config.address || !config.username || !config.psk) {
      console.error('Invalid Hue config in localStorage');
      return null;
    }

    return new DirectHue({
      address: config.address,
      username: config.username,
      clientKey: config.psk
    });
  } catch (err) {
    console.error('Error creating DirectHue:', err);
    return null;
  }
}
