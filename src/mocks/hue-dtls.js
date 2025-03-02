// Mock for phea/build/hue-dtls.js
module.exports = {
  HueDtlsTransport: class HueDtlsTransport {
    constructor() {
      this.connected = false;
    }

    connect() {
      this.connected = true;
      return Promise.resolve();
    }

    disconnect() {
      this.connected = false;
      return Promise.resolve();
    }

    send() {
      return Promise.resolve({});
    }
  }
};
