/**
 * This is a shim to work around CSP restrictions on the binary-data library
 */

export class BufferListShim {
  private buffers: Buffer[] = [];

  constructor() {}

  push(buffer: Buffer): void {
    this.buffers.push(buffer);
  }

  slice(start: number, end: number): Buffer {
    // Implementation that doesn't require eval()
    // Combine buffers and extract the requested slice
    let totalLength = this.buffers.reduce((acc, buf) => acc + buf.length, 0);
    let combinedBuffer = Buffer.alloc(totalLength);

    let offset = 0;
    for (const buf of this.buffers) {
      buf.copy(combinedBuffer, offset);
      offset += buf.length;
    }

    return combinedBuffer.slice(start, end);
  }
}

// Add other shimmed components from binary-data as needed
