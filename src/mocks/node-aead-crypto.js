// Mock implementation of node-aead-crypto

// Create empty implementations of any functions used
module.exports = {
  AEAD_AES_128_GCM: {
    encrypt: () => Buffer.alloc(0),
    decrypt: () => Buffer.alloc(0),
  },
  AEAD_AES_256_GCM: {
    encrypt: () => Buffer.alloc(0),
    decrypt: () => Buffer.alloc(0),
  },
  getOS: () => 'mock',
  getArchitecture: () => 'mock',
  // Add any other functions that might be used
};
