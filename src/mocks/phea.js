// Mock for the entire phea library
module.exports = {
  HueBridge: class HueBridge {
    constructor() {
      this.connected = false;
      this.lights = {};
    }

    connect() {
      this.connected = true;
      return Promise.resolve();
    }

    disconnect() {
      this.connected = false;
      return Promise.resolve();
    }

    getLights() {
      return Promise.resolve({});
    }

    setLightState() {
      return Promise.resolve({});
    }
  },

  discover() {
    return Promise.resolve([]);
  },

  PheaEngine: class PheaEngine {
    constructor() {
      this.active = false;
    }

    start() {
      this.active = true;
      return Promise.resolve();
    }

    stop() {
      this.active = false;
      return Promise.resolve();
    }
  }
};
