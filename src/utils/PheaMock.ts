/**
 * Mock implementation of the Phea library that provides fallback functionality
 * when the real library doesn't work or isn't available.
 */

export class PheaConnection {
  private callbacks: Record<string, Function[]> = {};

  constructor() {
    console.log('Created mock Phea connection');
  }

  on(event: string, callback: Function): this {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
    console.log(`Registered event listener for "${event}"`);
    return this;
  }

  triggerEvent(event: string, ...args: any[]): void {
    const eventCallbacks = this.callbacks[event] || [];
    eventCallbacks.forEach(callback => callback(...args));
  }
}

export class PheaBridge {
  private options: any;

  constructor(options: any) {
    this.options = options;
    console.log('Created mock Phea bridge with options:', options);
  }

  async getGroup(id: number | string): Promise<any> {
    console.log(`Mock getGroup called with ID: ${id}`);
    // Return mock data with at least one entertainment group
    if (id === 0) {
      return {
        '1': {
          type: 'Entertainment',
          name: 'Mock Entertainment Group',
          lights: ['1', '2', '3']
        }
      };
    }
    return {};
  }

  async start(groupId: string): Promise<PheaConnection> {
    console.log(`Mock start called with entertainment group ID: ${groupId}`);
    return new PheaConnection();
  }

  async stop(): Promise<void> {
    console.log('Mock stop called');
    return;
  }

  async transition(lightIds: (number|string)[], rgb: [number, number, number], transitionTime: number): Promise<void> {
    // No need to log every transition, as it would spam the console
    return;
  }
}

const PheaMock = {
  discover: async (): Promise<any[]> => {
    console.log('Mock discover called');
    return [{ id: 'mock-bridge-id', name: 'Mock Bridge', ipaddress: '192.168.1.100' }];
  },

  register: async (ipAddress: string): Promise<any> => {
    console.log(`Mock register called with IP: ${ipAddress}`);
    return {
      username: 'mock-username',
      psk: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      clientkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    };
  },

  bridge: (options: any): PheaBridge => {
    return new PheaBridge(options);
  }
};

export default PheaMock;
