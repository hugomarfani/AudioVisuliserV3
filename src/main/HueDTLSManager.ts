import dgram from 'dgram';
import * as dtls from 'node-dtls-client';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Constants for the protocol
const PROTOCOL_NAME = Buffer.from('HueStream');
const PROTOCOL_VERSION = Buffer.from([0x02, 0x00]); // Version 2.0
const COLOR_MODE_RGB = 0x00;
const HUE_STREAMING_PORT = 2100;

// Configuration interface for DTLS connection
interface HueDTLSConfig {
  bridgeIp: string;
  username: string;
  psk: string;  // PSK in ASCII hex format
  applicationId?: string;  // Optional PSK identity
}

// RGB color structure
interface RGBColor {
  r: number;  // 0.0 - 1.0
  g: number;  // 0.0 - 1.0
  b: number;  // 0.0 - 1.0
}

// Channel data for light control
interface ChannelData {
  id: number;
  color: RGBColor;
}

// Log wrapper for better debugging
function log(message: string, ...args: any[]) {
  console.log(`[HueDTLSManager] ${message}`, ...args);
}

// Error logger
function logError(message: string, ...args: any[]) {
  console.error(`[HueDTLSManager] ERROR: ${message}`, ...args);
}

// Main DTLS Manager class
class HueDTLSManager {
  private config: HueDTLSConfig | null = null;
  private socket: dtls.Socket | null = null;
  private isConnected = false;
  private sequenceNumber = 0;
  private entertainmentConfigId: string = '';
  private lastError: Error | null = null;
  private connectionPromise: Promise<boolean> | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // Store a list of registered message handlers
  private messageHandlers: Array<(message: Buffer) => void> = [];
  private connectionHandlers: Array<(isConnected: boolean) => void> = [];

  constructor() {
    log('HueDTLSManager initialized');
  }

  // Set the configuration for the DTLS connection
  public setConfig(config: HueDTLSConfig): void {
    this.config = config;
    log('Configuration set', {
      bridgeIp: config.bridgeIp,
      username: config.username,
      hasPsk: !!config.psk,
      pskLength: config.psk?.length || 0
    });
  }

  // Check if configuration is valid
  public hasValidConfig(): boolean {
    if (!this.config) return false;
    return !!(this.config.bridgeIp && this.config.username && this.config.psk);
  }

  // Get the current error if any
  public getLastError(): Error | null {
    return this.lastError;
  }

  // Connect to the Hue bridge
  public async connect(entertainmentConfigId: string): Promise<boolean> {
    if (this.connectionPromise) {
      log('Connection already in progress, returning existing promise');
      return this.connectionPromise;
    }

    this.entertainmentConfigId = entertainmentConfigId;

    this.connectionPromise = this._connect();
    const result = await this.connectionPromise;
    this.connectionPromise = null;
    return result;
  }

  // Internal connect implementation
  private async _connect(): Promise<boolean> {
    if (!this.config) {
      this.lastError = new Error('No configuration set');
      return false;
    }

    if (this.isConnected) {
      log('Already connected');
      return true;
    }

    try {
      log('Starting DTLS connection to Hue bridge:', this.config.bridgeIp);

      const options: dtls.Options = {
        type: 'udp4',
        address: this.config.bridgeIp,
        port: HUE_STREAMING_PORT,
        psk: {
          identity: this.config.applicationId || this.config.username,
          key: Buffer.from(this.config.psk, 'hex')
        },
        timeout: 10000,
        cipherSuites: ['TLS_PSK_WITH_AES_128_GCM_SHA256']
      };

      log('Creating DTLS socket with options:', options);

      // Return a promise that resolves when connected
      return new Promise<boolean>((resolve, reject) => {
        try {
          // Create the DTLS socket
          this.socket = dtls.createSocket(options);

          // Set up event handlers
          this.socket.on('connected', () => {
            log('DTLS connection established successfully');
            this.isConnected = true;
            this.startKeepAlive();
            this.notifyConnectionHandlers(true);
            resolve(true);
          });

          this.socket.on('error', (error) => {
            logError('DTLS socket error:', error);
            this.lastError = error;
            // Only reject if we haven't resolved yet
            reject(error);
          });

          this.socket.on('message', (message) => {
            // Notify all message handlers
            this.messageHandlers.forEach(handler => handler(message));
          });

          this.socket.on('close', () => {
            log('DTLS connection closed');
            this.isConnected = false;
            this.notifyConnectionHandlers(false);
            if (this.pingInterval) {
              clearInterval(this.pingInterval);
              this.pingInterval = null;
            }
          });

        } catch (error) {
          logError('Failed to create DTLS socket:', error);
          this.lastError = error instanceof Error ? error : new Error(String(error));
          reject(this.lastError);
        }
      });
    } catch (error) {
      logError('Failed to establish DTLS connection:', error);
      this.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  // Send a keep-alive message periodically
  private startKeepAlive(): void {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Send a small keepalive every 10 seconds
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        // Just send a dummy RGB update to light 0 with low intensity
        this.sendLightData([{
          id: 0,
          color: { r: 0.01, g: 0.01, b: 0.01 }
        }]);
      }
    }, 10000);
  }

  // Disconnect from the Hue bridge
  public disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.socket) {
      try {
        this.socket.close();
        log('DTLS connection closed');
      } catch (error) {
        logError('Error closing DTLS connection:', error);
      }
      this.socket = null;
    }

    this.isConnected = false;
    this.notifyConnectionHandlers(false);
  }

  // Send RGB data to lights
  public sendLightData(channelsData: ChannelData[]): boolean {
    if (!this.isConnected || !this.socket) {
      logError('Cannot send data: not connected to Hue bridge');
      return false;
    }

    try {
      const message = this.formatLightMessage(channelsData);
      this.socket.send(message);
      this.sequenceNumber = (this.sequenceNumber + 1) % 256;
      return true;
    } catch (error) {
      logError('Error sending light data:', error);
      return false;
    }
  }

  // Format the Hue Entertainment API message
  private formatLightMessage(channelsData: ChannelData[]): Buffer {
    // Create header (16 bytes)
    const header = Buffer.alloc(16);
    PROTOCOL_NAME.copy(header, 0); // First 9 bytes: "HueStream"
    PROTOCOL_VERSION.copy(header, 9); // Next 2 bytes: version 2.0
    header[11] = this.sequenceNumber; // 1 byte sequence number
    // Skip reserved bytes 12-13
    header[14] = COLOR_MODE_RGB; // Color mode: RGB
    // Skip reserved byte 15

    // Add UUID of entertainment configuration (36 bytes)
    const configIdBuffer = Buffer.from(this.entertainmentConfigId);

    // Create channel data buffers (7 bytes per channel)
    const channelBuffers = channelsData.map(channel => {
      const buffer = Buffer.alloc(7);
      buffer[0] = channel.id; // Channel ID (1 byte)

      // Convert 0-1 RGB values to 16-bit integers (0-65535)
      const r = Math.floor(channel.color.r * 65535);
      const g = Math.floor(channel.color.g * 65535);
      const b = Math.floor(channel.color.b * 65535);

      // Write as big-endian 16-bit values
      buffer.writeUInt16BE(r, 1);
      buffer.writeUInt16BE(g, 3);
      buffer.writeUInt16BE(b, 5);

      return buffer;
    });

    // Combine all buffers
    return Buffer.concat([header, configIdBuffer, ...channelBuffers]);
  }

  // Check if connected to bridge
  public isConnectedToBridge(): boolean {
    return this.isConnected;
  }

  // Add a message handler
  public addMessageHandler(handler: (message: Buffer) => void): void {
    this.messageHandlers.push(handler);
  }

  // Remove a message handler
  public removeMessageHandler(handler: (message: Buffer) => void): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index >= 0) {
      this.messageHandlers.splice(index, 1);
    }
  }

  // Add a connection handler
  public addConnectionHandler(handler: (isConnected: boolean) => void): void {
    this.connectionHandlers.push(handler);
    // Immediately notify with the current state
    if (this.isConnected) {
      handler(true);
    }
  }

  // Remove a connection handler
  public removeConnectionHandler(handler: (isConnected: boolean) => void): void {
    const index = this.connectionHandlers.indexOf(handler);
    if (index >= 0) {
      this.connectionHandlers.splice(index, 1);
    }
  }

  // Notify all connection handlers of a change
  private notifyConnectionHandlers(isConnected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(isConnected));
  }

  // Run a test sequence (red, green, blue)
  public async runTestSequence(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    // Define basic test colors
    const colors: [string, RGBColor][] = [
      ['red', { r: 1, g: 0, b: 0 }],
      ['green', { r: 0, g: 1, b: 0 }],
      ['blue', { r: 0, g: 0, b: 1 }],
      ['white', { r: 1, g: 1, b: 1 }],
      ['off', { r: 0, g: 0, b: 0 }],
    ];

    // Send each color with a delay
    for (const [name, color] of colors) {
      log(`Test: Setting all channels to ${name}`);
      // Set first 10 channels to this color
      const channels = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        color
      }));

      const success = this.sendLightData(channels);
      if (!success) {
        return false;
      }

      // Wait before next color
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return true;
  }
}

// Export a singleton instance
export const hueDTLSManager = new HueDTLSManager();
