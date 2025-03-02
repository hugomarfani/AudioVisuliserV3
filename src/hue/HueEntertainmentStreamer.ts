import dtls from 'node-dtls-client';
import { Buffer } from 'buffer';

class HueEntertainmentStreamer {
  client: any;
  streamingInterval: NodeJS.Timer | null = null;
  entertainmentConfigId: string;
  sequence: number = 0;

  constructor(entertainmentConfigId: string, psk: string, pskIdentity: string, bridgeIp: string) {
    this.entertainmentConfigId = entertainmentConfigId;
    // Initialize DTLS client connection on port 2100 with PSK options
    this.client = dtls.connect(2100, bridgeIp, {
      psk: Buffer.from(psk, 'hex'),
      pskIdentity: pskIdentity,
      cipherSuites: ['TLS_PSK_WITH_AES_128_GCM_SHA256']
    });
    this.client.on('connected', () => {
      console.log('Hue Entertainment DTLS connection established');
    });
    this.client.on('error', (err: any) => {
      console.error('DTLS error:', err);
    });
  }

  // Build a frame that flashes white on beat (on/off toggle based on current time)
  buildFrame(): Buffer {
    const isOn = (Date.now() % 2000) < 1000; // toggles every second
    // Frame format: 16-byte header + 36-byte configID + two channels (7 bytes each)
    const frameSize = 16 + 36 + (7 * 2);
    const frame = Buffer.alloc(frameSize);
    let offset = 0;
    // 9 bytes protocol name
    frame.write('HueStream', offset, 'ascii');
    offset += 9;
    // Version: 0x02, 0x00
    frame.writeUInt8(0x02, offset++);
    frame.writeUInt8(0x00, offset++);
    // Sequence id (1 byte)
    frame.writeUInt8(this.sequence++ & 0xff, offset++);
    // Reserved 2 bytes
    frame.writeUInt16BE(0, offset);
    offset += 2;
    // Color space: RGB = 0x00
    frame.writeUInt8(0x00, offset++);
    // Reserved 1 byte
    frame.writeUInt8(0, offset++);
    // Write entertainment configuration id (36 bytes)
    frame.write(this.entertainmentConfigId.padEnd(36, ' '), offset, 'ascii');
    offset += 36;
    // Channel 0: fill 7 bytes: id + R,G,B (16-bit each)
    frame.writeUInt8(0, offset++);
    const value = isOn ? 0xffff : 0;
    frame.writeUInt16BE(value, offset); offset += 2;
    frame.writeUInt16BE(value, offset); offset += 2;
    frame.writeUInt16BE(value, offset); offset += 2;
    // Channel 1:
    frame.writeUInt8(1, offset++);
    frame.writeUInt16BE(value, offset); offset += 2;
    frame.writeUInt16BE(value, offset); offset += 2;
    frame.writeUInt16BE(value, offset); offset += 2;
    return frame;
  }

  startStreaming(fps: number = 60) {
    this.streamingInterval = setInterval(() => {
      const frame = this.buildFrame();
      this.client.send(frame);
    }, 1000 / fps);
  }

  stopStreaming() {
    if (this.streamingInterval) clearInterval(this.streamingInterval);
    this.client.close();
  }
}

export default HueEntertainmentStreamer;
