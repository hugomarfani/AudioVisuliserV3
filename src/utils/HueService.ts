import * as Phea from 'phea';

// Configuration type for Hue Bridge
interface HueBridgeConfig {
  address: string;
  username: string;
  psk: string;
  entertainmentGroupId: string;
}

class HueService {
  private bridge: any = null; // Phea bridge instance
  private connection: any = null; // DTLS connection
  private isConnected: boolean = false;
  private config: HueBridgeConfig | null = null;

  constructor() {
    // Try to load saved config
    this.loadConfig();
  }

  // Load saved configuration from localStorage
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('hueConfig');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
        console.log('Loaded Hue configuration:', {
          address: this.config.address,
          hasCredentials: !!this.config.username && !!this.config.psk,
          entertainmentGroupId: this.config.entertainmentGroupId
        });
      }
    } catch (error) {
      console.error('Failed to load Hue configuration', error);
    }
  }

  // Save configuration to localStorage
  private saveConfig(config: HueBridgeConfig): void {
    localStorage.setItem('hueConfig', JSON.stringify(config));
    this.config = config;
    console.log('Saved Hue configuration:', {
      address: config.address,
      hasCredentials: !!config.username && !!config.psk,
      entertainmentGroupId: config.entertainmentGroupId
    });
  }

  // Discover Hue bridges on network
  async discoverBridges(): Promise<any[]> {
    try {
      console.log('Starting Hue bridge discovery...');
      const bridges = await Phea.discover();
      console.log("Discovered bridges:", bridges);
      return bridges || [];
    } catch (error) {
      console.error('Failed to discover Hue bridges', error);
      throw new Error(`Bridge discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Register with a Hue bridge (user must press the link button first)
  async registerBridge(ipAddress: string): Promise<any> {
    try {
      console.log(`Attempting to register with bridge at ${ipAddress}`);
      const credentials = await Phea.register(ipAddress);

      if (!credentials || !credentials.username || !credentials.psk) {
        throw new Error("Registration failed - invalid credentials returned from bridge");
      }

      console.log("Registration successful:", credentials);

      // Save partial config (need to add entertainment group later)
      const partialConfig = {
        address: ipAddress,
        username: credentials.username,
        psk: credentials.psk,
        entertainmentGroupId: '1' // Default to first group, can be changed later
      };
      this.saveConfig(partialConfig);
      return credentials;
    } catch (error) {
      console.error('Failed to register with Hue bridge', error);
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Please press the link button and try again'}`);
    }
  }

  // Get all entertainment groups
  async getEntertainmentGroups(): Promise<any[]> {
    if (!this.config) {
      throw new Error('No Hue bridge configuration found');
    }

    try {
      console.log(`Getting entertainment groups from bridge ${this.config.address}`);
      const bridge = Phea.bridge({
        address: this.config.address,
        username: this.config.username,
        psk: this.config.psk,
        dtlsUpdatesPerSecond: 50,
        colorUpdatesPerSecond: 25
      });

      const allGroups = await bridge.getGroup(0);
      console.log("All groups:", allGroups);

      if (!allGroups || typeof allGroups !== 'object') {
        return [];
      }

      const entertainmentGroups = Object.entries(allGroups)
        .filter(([_, group]: [string, any]) => group.type === 'Entertainment')
        .map(([id, details]: [string, any]) => ({ id, ...details }));

      console.log("Entertainment groups:", entertainmentGroups);
      return entertainmentGroups;
    } catch (error) {
      console.error('Failed to get entertainment groups', error);
      throw new Error(`Failed to get entertainment groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Initialize connection to the bridge
  async initialize(): Promise<boolean> {
    if (!this.config) {
      console.error('No Hue configuration found');
      return false;
    }

    try {
      console.log(`Initializing bridge at ${this.config.address}`);
      this.bridge = Phea.bridge({
        address: this.config.address,
        username: this.config.username,
        psk: this.config.psk,
        dtlsUpdatesPerSecond: 50, // Default rate
        colorUpdatesPerSecond: 25 // Default rate
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize Hue bridge', error);
      return false;
    }
  }

  // Start entertainment mode
  async startEntertainmentMode(): Promise<boolean> {
    if (!this.bridge || !this.config) {
      console.error('Bridge not initialized or no config');
      return false;
    }

    try {
      console.log(`Starting entertainment mode for group ${this.config.entertainmentGroupId}`);
      this.connection = await this.bridge.start(this.config.entertainmentGroupId);
      this.isConnected = true;

      this.connection.on("close", () => {
        console.log("Hue connection closed");
        this.isConnected = false;
      });

      return true;
    } catch (error) {
      console.error('Failed to start entertainment mode', error);
      return false;
    }
  }

  // Stop entertainment mode
  async stopEntertainmentMode(): Promise<void> {
    if (this.bridge && this.isConnected) {
      try {
        console.log("Stopping entertainment mode");
        await this.bridge.stop();
        this.isConnected = false;
      } catch (error) {
        console.error('Error stopping entertainment mode', error);
      }
    }
  }

  // Send color transition to lights
  async sendColorTransition(rgb: [number, number, number], transitionTime: number = 200): Promise<void> {
    if (!this.bridge || !this.isConnected) {
      return;
    }

    try {
      // Use group 0 to target all lights in the entertainment group
      await this.bridge.transition([0], rgb, transitionTime);
    } catch (error) {
      console.error('Error sending color transition', error);
    }
  }

  // Set the entertainment group ID
  setEntertainmentGroupId(groupId: string): void {
    if (this.config) {
      const updatedConfig = { ...this.config, entertainmentGroupId: groupId };
      this.saveConfig(updatedConfig);
    }
  }

  // Check if we have a valid configuration
  hasValidConfig(): boolean {
    return !!this.config && !!this.config.username && !!this.config.psk;
  }

  // Clear the configuration (for logging out or resetting)
  clearConfig(): void {
    localStorage.removeItem('hueConfig');
    this.config = null;
    console.log('Hue configuration cleared');
  }
}

// Export as a singleton
export default new HueService();
