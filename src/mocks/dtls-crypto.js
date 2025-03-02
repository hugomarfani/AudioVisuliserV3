// Mock implementation for node-dtls-client/build/lib/AEADCrypto

module.exports = {
  createAEADEncryptor: () => ({
    encrypt: () => Buffer.alloc(0),
    decrypt: () => Buffer.alloc(0),
    dispose: () => {}
  }),
  // Add any other functions that might be used
};
