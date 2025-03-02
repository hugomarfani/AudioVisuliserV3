// Mock implementation of node-dtls-client

module.exports = {
  createSocket: () => ({
    connect: () => Promise.resolve({}),
    send: () => Promise.resolve({}),
    close: () => Promise.resolve({}),
    on: () => {},
    removeListener: () => {}
  }),
  DtlsSocket: function() {
    this.connect = () => Promise.resolve({});
    this.send = () => Promise.resolve({});
    this.close = () => Promise.resolve({});
    this.on = () => {};
    this.removeListener = () => {};
  }
};
