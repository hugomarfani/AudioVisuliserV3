import dgram from 'dgram';
import { DTLSClient, DTLSClientSocket } from 'nodejs-dtls';
import { Buffer } from 'buffer';

// Constants for the protocol
const PROTOCOL_NAME = Buffer.from('HueStream');
const PROTOCOL_VERSION = Buffer.from([0x02, 0x00]); // Version 2.0
const COLOR_MODE_RGB = 0x00;
const COLOR_MODE_XY = 0x01;
const HUE_STREAMING_PORT = 2100;

interface HueDTLSConfig {
  bridgeIp: string;
  username: string;
  clientKey: string;  // PSK in ASCII hex format
  applicationId: string;  // PSK identity (hue-application-id)
}

interface RGBColor {
  r: number;  // 0.0 - 1.0
  g: number;  // 0.0 - 1.0
  b: number;  // 0.0 - 1.0
}

interface ChannelData {
  id: number;
  color: RGBColor;
}

export class HueDTLS {
  private config: HueDTLSConfig;
  private dtlsSocket: DTLSClientSocket | null = null;
  private isConnected = false;
  private sequenceNumber = 0;
  private entertainmentConfigId: string = '';

  constructor(config: HueDTLSConfig) {
    this.config = config;
  }

  /**
   * Connect to the Hue bridge via DTLS
   */
  public async connect(entertainmentConfigId: string): Promise<boolean> {
    this.entertainmentConfigId = entertainmentConfigId;

    try {
      console.log('Starting DTLS connection to Hue bridge:', this.config.bridgeIp);

      // Convert clientKey from hex string to binary buffer
      const psk = Buffer.from(this.config.clientKey, 'hex');

      // Create DTLS client with PSK settings
      const client = new DTLSClient({
        address: this.config.bridgeIp,
        port: HUE_STREAMING_PORT,
        psk: {
          identity: this.config.applicationId,
          key: psk
        },
        timeout: 10000, // 10 seconds timeout
        cipherSuites: ['TLS_PSK_WITH_AES_128_GCM_SHA256']
      });

      // Connect socket
      this.dtlsSocket = await client.connect();

      // Register message handler
      this.dtlsSocket.on('message', (message) => {
        console.log('Received message from Hue bridge:', message.toString('hex'));
      });

      // Register close handler
      this.dtlsSocket.on('close', () => {
        console.log('DTLS connection closed');
        this.isConnected = false;
        this.dtlsSocket = null;
      });

      this.isConnected = true;
      console.log('DTLS connection established successfully');
      return true;
    } catch (error) {
      console.error('Failed to establish DTLS connection:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from the Hue bridge
   */
  public disconnect(): void {
    if (this.dtlsSocket) {
      try {
        this.dtlsSocket.close();
        console.log('DTLS connection closed');
      } catch (error) {
        console.error('Error closing DTLS connection:', error);
      }
      this.dtlsSocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Send RGB data to lights
   */
  public sendLightData(channelsData: ChannelData[]): boolean {
    if (!this.isConnected || !this.dtlsSocket) {
      console.error('Cannot send data: not connected to Hue bridge');
      return false;
    }

    // Limit to 20 channels as per API documentation
    if (channelsData.length > 20) {
      channelsData = channelsData.slice(0, 20);
      console.warn('Too many channels provided, limiting to 20');
    }

    try {
      const message = this.formatLightMessage(channelsData);
      this.dtlsSocket.send(message);
      this.sequenceNumber = (this.sequenceNumber + 1) % 256; // Keep sequence within byte range
      return true;
    } catch (error) {
      console.error('Error sending light data:', error);
      return false;
    }
  }

  /**
   * Format the message according to the Hue Entertainment API protocol
   */
  private formatLightMessage(channelsData: ChannelData[]): Buffer {
    // Create header (16 bytes)
    const header = Buffer.alloc(16);
    PROTOCOL_NAME.copy(header, 0); // 9 bytes
    PROTOCOL_VERSION.copy(header, 9); // 2 bytes
    header[11] = this.sequenceNumber; // 1 byte
    // Skip reserved bytes 12-13 (already zeroed)
    header[14] = COLOR_MODE_RGB; // 1 byte
    // Skip reserved byte 15 (already zeroed)

    // Entertainment configuration ID (36 bytes)
    const configIdBuffer = Buffer.from(this.entertainmentConfigId);

    // Create channel data (7 bytes per channel)
    const channelBuffers = channelsData.map(channel => {
      const buffer = Buffer.alloc(7);
      buffer[0] = channel.id; // Channel ID (1 byte)

      // RGB values - 16 bits per component (2 bytes each)
      const r = Math.floor(channel.color.r * 65535); // Convert 0-1 to 0-65535
      const g = Math.floor(channel.color.g * 65535);
      const b = Math.floor(channel.color.b * 65535);

      // Write RGB values in big-endian format
      buffer.writeUInt16BE(r, 1);
      buffer.writeUInt16BE(g, 3);
      buffer.writeUInt16BE(b, 5);

      return buffer;
    });

    // Combine all buffers
    return Buffer.concat([header, configIdBuffer, ...channelBuffers]);
  }

  /**
   * Check if connected to bridge
   */
  public isConnectedToBridge(): boolean {
    return this.isConnected;
  }
}
