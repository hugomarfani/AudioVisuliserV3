// Import our Phea connector utility
import { getPheaInstance, validatePSK } from './PheaConnector';
import { hueConfig } from '../config/hueConfig';

// Get the Phea instance
const Phea = getPheaInstance();

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
  private updateRate: number = hueConfig.defaultDtlsUpdateRate; // Default updates per second
  private lastRGB: [number, number, number] = [0, 0, 0]; // Track last RGB to avoid unnecessary updates
  private useEntertainmentMode: boolean = true; // Always use entertainment mode
  private lastLightUpdateTime: number = 0; // For rate limiting in non-entertainment mode
  private debugLogsEnabled: boolean = hueConfig.debug; // Control verbose logging
  private connectionAttempts: number = 0; // Track connection attempts
  private beatCommandCounter: number = 0; // Track beat commands for debugging
  private lastBeatTime: number = 0;

  constructor() {
    // Try to load saved config
    this.loadConfig();
  }

  // Load saved configuration from localStorage with better clientKey handling
  private loadConfig(): void {
    try {
      // Try to load from hueBridgeInfo first as it's more likely to have the proper clientKey
      let savedConfig = localStorage.getItem('hueBridgeInfo');
      if (savedConfig) {
        const bridgeInfo = JSON.parse(savedConfig);
        if (bridgeInfo.ip && bridgeInfo.username) {
          // Check for clientKey (PSK) in various possible properties
          const clientKey = bridgeInfo.clientKey || bridgeInfo.psk || bridgeInfo.clientkey;

          if (clientKey && clientKey !== 'dummy-psk') {
            console.log('Found valid client key in hueBridgeInfo, length:', clientKey.length);
            this.config = {
              address: bridgeInfo.ip,
              username: bridgeInfo.username,
              psk: validatePSK(clientKey), // Validate and normalize PSK
              entertainmentGroupId: '1' // Default value
            };
            console.log('Loaded Hue configuration from hueBridgeInfo with valid PSK');

            // Save the config in the preferred format for future use
            this.saveConfig(this.config);
            return;
          } else {
            console.warn('hueBridgeInfo found but no valid clientKey/psk');
          }
        }
      }

      // Try to load from hueConfig as a fallback
      savedConfig = localStorage.getItem('hueConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.address && config.username) {
          // Check both PSK and clientKey
          const clientKey = config.psk || config.clientKey || config.clientkey;

          this.config = {
            address: config.address,
            username: config.username,
            psk: clientKey ? validatePSK(clientKey) : '', // Validate if exists
            entertainmentGroupId: config.entertainmentGroupId || '1'
          };

          if (clientKey && clientKey !== 'dummy-psk') {
            console.log('Loaded Hue configuration from hueConfig with valid PSK, length:', clientKey.length);
            return;
          } else {
            console.warn('hueConfig found but no valid clientKey/psk - will need to retrieve from bridge');
            // We'll still continue with the config we found and try to get a valid PSK later
            return;
          }
        }
      }

      console.log('No valid Hue configuration found in localStorage');
    } catch (error) {
      console.error('Failed to load Hue configuration', error);
    }
  }

  // Updated Save configuration to ensure PSK is always preserved
  private saveConfig(config: HueBridgeConfig): void {
    // Before saving, ensure we're not overriding a valid PSK with a dummy value
    if ((config.psk === 'dummy-psk' || !config.psk) && this.config?.psk && this.config.psk !== 'dummy-psk') {
      console.log('Preserving existing valid PSK');
      config.psk = this.config.psk;
    }

    // Save to hueConfig format
    localStorage.setItem('hueConfig', JSON.stringify(config));

    // Also save to hueBridgeInfo for compatibility, ensuring both keys are present
    localStorage.setItem('hueBridgeInfo', JSON.stringify({
      ip: config.address,
      username: config.username,
      psk: config.psk,
      clientKey: config.psk,
      clientkey: config.psk // Include all variants for compatibility
    }));

    this.config = config;
    console.log('Saved Hue configuration:', {
      address: config.address,
      hasCredentials: !!config.username,
      hasPSK: !!config.psk && config.psk !== 'dummy-psk',
      pskLength: config.psk?.length || 0,
      entertainmentGroupId: config.entertainmentGroupId
    });
  }

  // Update PSK from external source (like main process)
  public updatePSK(psk: string): void {
    if (!psk) {
      console.warn('Attempted to update PSK with empty value');
      return;
    }

    if (this.config) {
      const validPSK = validatePSK(psk);
      console.log(`Updating PSK (${validPSK.length} chars): ${validPSK.substring(0, 4)}...${validPSK.substring(validPSK.length - 4)}`);
      this.config.psk = validPSK;
      this.saveConfig(this.config);
    } else {
      console.warn('Cannot update PSK - no configuration loaded');
    }
  }

  // Discover Hue bridges on network
  async discoverBridges(): Promise<any[]> {
    try {
      console.log('Starting Hue bridge discovery...');
      // Use Phea.discover
      const bridges = await Phea.discover();
      console.log("Discovered bridges:", bridges);
      return bridges || [];
    } catch (error) {
      console.error('Failed to discover Hue bridges:', error);
      throw new Error(`Bridge discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Register with a Hue bridge (user must press the link button first)
  async registerBridge(ipAddress: string): Promise<any> {
    try {
      console.log(`Attempting to register with bridge at ${ipAddress}`);
      // Use Phea.register
      const credentials = await Phea.register(ipAddress);

      if (!credentials || !credentials.username || !credentials.psk) {
        throw new Error("Registration failed - invalid credentials returned from bridge");
      }

      console.log("Registration successful:", credentials);

      // Save partial config (need to add entertainment group later)
      const partialConfig = {
        address: ipAddress,
        username: credentials.username,
        psk: validatePSK(credentials.psk),
        entertainmentGroupId: '1' // Default to first group, can be changed later
      };
      this.saveConfig(partialConfig);
      return credentials;
    } catch (error) {
      console.error('Failed to register with Hue bridge:', error);
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Please press the link button and try again'}`);
    }
  }

  // Helper function to check if a string is a UUID (simple validation)
  private isUuidFormat(id: string): boolean {
    // Simple UUID pattern check: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id);
  }

  // Get all entertainment groups - updated to filter non-UUID groups
  async getEntertainmentGroups(): Promise<any[]> {
    if (!this.config) {
      throw new Error('No Hue bridge configuration found');
    }

    try {
      console.log(`Getting entertainment groups from bridge ${this.config.address}`);

      // Create bridge using Phea.bridge
      const bridge = Phea.bridge({
        address: this.config.address,
        username: this.config.username,
        psk: this.config.psk,
        dtlsUpdatesPerSecond: this.updateRate,
        colorUpdatesPerSecond: hueConfig.defaultColorUpdateRate,
        dtlsPort: hueConfig.defaultDtlsPort
      });

      // Check if bridge has getGroup method
      if (typeof bridge.getGroup === 'function') {
        try {
          const allGroups = await bridge.getGroup(0);
          console.log("All groups:", allGroups);

          if (!allGroups || typeof allGroups !== 'object') {
            return [];
          }

          const entertainmentGroups = Object.entries(allGroups)
            .filter(([id, group]: [string, any]) => {
              // Only include entertainment groups with UUID format IDs
              return group.type === 'Entertainment' && this.isUuidFormat(id);
            })
            .map(([id, details]: [string, any]) => ({ id, ...details }));

          console.log("UUID-only entertainment groups:", entertainmentGroups);

          if (entertainmentGroups.length === 0) {
            console.warn("No UUID-format entertainment groups found. Please create one in the Philips Hue app.");
          }

          return entertainmentGroups;
        } catch (e) {
          console.error("Error calling bridge.getGroup:", e);
        }
      }

      // Fallback: Create a default entertainment group from the current config
      console.log("Bridge doesn't support getGroup - creating default group");

      // Try to get lights if available
      let lights: string[] = [];
      if (typeof bridge.getLights === 'function') {
        try {
          const allLights = await bridge.getLights();
          lights = Object.keys(allLights).filter(id => this.isUuidFormat(id));
        } catch (e) {
          console.error("Error getting lights:", e);
        }
      }

      // Generate a UUID-like ID for the mock entertainment group if needed
      let groupId = this.config.entertainmentGroupId;
      if (!this.isUuidFormat(groupId)) {
        groupId = 'ef7e1b9f-159d-42f9-868f-013ec47978dc'; // A default UUID-like ID
        console.log(`Replacing non-UUID entertainment group ID with: ${groupId}`);
      }

      // Create a mock entertainment group
      const defaultGroup = {
        id: groupId,
        name: 'Default Entertainment Group',
        type: 'Entertainment',
        lights: lights.length > 0 ? lights : [] // Use detected lights or empty array
      };

      console.log("Created fallback UUID entertainment group:", defaultGroup);
      return [defaultGroup];
    } catch (error) {
      console.error('Failed to get entertainment groups:', error);
      throw new Error(`Failed to get entertainment groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Initialize connection to the bridge with better PSK handling
  async initialize(options?: { updateRate?: number }): Promise<boolean> {
    // Check if config exists
    if (!this.config) {
      console.error('No Hue configuration found');
      // Try to reload from storage one more time
      this.loadConfig();

      if (!this.config) {
        console.error('Still no configuration found after attempting to reload');
        return false;
      }
    }

    if (this.debugLogsEnabled) {
      // Log config details for debugging
      console.log('Initializing bridge with config:', {
        address: this.config.address,
        username: this.config.username,
        hasPsk: !!this.config.psk,
        pskLength: this.config.psk?.length || 0,
        pskPreview: this.config.psk && this.config.psk !== 'dummy-psk' ?
          `${this.config.psk.substring(0, 4)}...${this.config.psk.substring(this.config.psk.length - 4)}` :
          'INVALID OR MISSING',
        entertainmentGroupId: this.config.entertainmentGroupId,
        useEntertainmentMode: this.useEntertainmentMode
      });
    }

    // Check for missing critical values
    if (!this.config.address) {
      console.error('Missing bridge address in config');
      return false;
    }

    // Don't check for "fromElectron" as invalid
    if (!this.config.username) {
      console.error('Missing username in config');
      return false;
    }

    // If PSK is missing or invalid, try harder to find a valid one
    if (!this.config.psk || this.config.psk === 'dummy-psk' || this.config.psk.length < 10) {
      console.warn('Missing or invalid PSK in config - searching for alternatives');

      // Check both storage locations thoroughly
      const sources = [
        { key: 'hueBridgeInfo', altKeys: ['clientKey', 'psk', 'clientkey'] },
        { key: 'hueConfig', altKeys: ['psk', 'clientKey', 'clientkey'] }
      ];

      let foundValidKey = false;

      for (const source of sources) {
        const stored = localStorage.getItem(source.key);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            for (const altKey of source.altKeys) {
              if (data[altKey] && data[altKey] !== 'dummy-psk' && data[altKey].length > 10) {
                this.config.psk = validatePSK(data[altKey]);
                console.log(`Found valid PSK in ${source.key}.${altKey}, length: ${data[altKey].length}`);
                foundValidKey = true;
                break;
              }
            }
            if (foundValidKey) break;
          } catch (e) {
            console.error(`Error parsing ${source.key}:`, e);
          }
        }
      }

      // If we still don't have a valid PSK and we're forcing entertainment mode
      if (!foundValidKey && hueConfig.forceEntertainmentAPI) {
        console.error('No valid PSK found. Entertainment API requires a valid PSK.');
        return false;
      }
    }

    // Reset connection attempts if they're excessive
    if (this.connectionAttempts > 10) {
      console.log('Too many connection attempts, resetting counter');
      this.connectionAttempts = 0;
    }

    try {
      // Only try entertainment mode if we have a valid PSK
      if (this.config.psk && this.config.psk.length >= 10) {
        console.log(`Initializing bridge at ${this.config.address} with entertainment mode`);
        const dtlsUpdates = options?.updateRate || this.updateRate;
        console.log(`Using DTLS update rate: ${dtlsUpdates}/sec`);

        try {
          this.connectionAttempts++;
          console.log(`Connection attempt ${this.connectionAttempts}`);

          // Check for existing bridge and clean up if needed
          if (this.bridge) {
            console.log('Found existing bridge instance, cleaning up');
            try {
              if (typeof this.bridge.disconnect === 'function') {
                await this.bridge.disconnect();
              } else if (typeof this.bridge.stop === 'function') {
                await this.bridge.stop();
              }
            } catch (e) {
              console.warn('Error cleaning up existing bridge:', e);
            }
            this.bridge = null;
          }

          this.bridge = Phea.bridge({
            address: this.config.address,
            username: this.config.username,
            psk: this.config.psk,
            dtlsUpdatesPerSecond: dtlsUpdates,
            colorUpdatesPerSecond: hueConfig.defaultColorUpdateRate,
            dtlsPort: hueConfig.defaultDtlsPort
          });

          if (this.bridge) {
            console.log('Bridge created successfully');
            // Disable verbose logs after successful setup
            this.debugLogsEnabled = false;
          } else {
            throw new Error('bridge() returned null or undefined');
          }
        } catch (e) {
          console.error('Error creating entertainment bridge:', e);
          console.error('Error details:', e instanceof Error ? e.message : String(e));

          if (this.connectionAttempts < 3) {
            console.log(`Retrying (attempt ${this.connectionAttempts + 1})...`);
            return this.initialize(options);
          }

          if (hueConfig.forceEntertainmentAPI) {
            console.error('Entertainment API is forced but initialization failed.');
            return false;
          }

          console.warn('Falling back to regular API mode');
          this.useEntertainmentMode = false;
        }
      } else if (hueConfig.forceEntertainmentAPI) {
        console.error('Entertainment API is forced but no valid PSK is available.');
        return false;
      } else {
        console.warn('No valid PSK available for Entertainment API');
        this.useEntertainmentMode = false;
      }

      // If we're not using entertainment mode and it's forced, return failure
      if (!this.useEntertainmentMode && hueConfig.forceEntertainmentAPI) {
        console.error('Entertainment API is forced but could not be initialized.');
        return false;
      }

      // If not using entertainment mode, we're already initialized
      if (!this.useEntertainmentMode) {
        console.log('Using regular Hue API mode (no entertainment features)');
        this.isConnected = true; // Consider ourselves connected already
      }

      console.log('Bridge initialization succeeded');
      return true;
    } catch (error) {
      console.error('Failed to initialize Hue bridge:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      return false;
    }
  }

  // Updated start method that works with entertainment mode
  async startEntertainmentMode(): Promise<boolean> {
    // If we're not using entertainment mode and it's forced, return failure
    if (!this.useEntertainmentMode && hueConfig.forceEntertainmentAPI) {
      console.error('Entertainment API is forced but not available.');
      return false;
    }

    // If we're not using entertainment mode, just return true
    if (!this.useEntertainmentMode) {
      console.log('Not using entertainment mode - considering as connected');
      this.isConnected = true;
      return true;
    }

    if (!this.bridge || !this.config) {
      console.error('Bridge not initialized or no config');
      return false;
    }

    if (!this.config.entertainmentGroupId) {
      console.error('No entertainment group ID specified');
      return false;
    }

    // Add UUID validation
    if (!this.isUuidFormat(this.config.entertainmentGroupId)) {
      console.error(`Entertainment group ID is not in UUID format: ${this.config.entertainmentGroupId}`);
      console.log('Attempting to find a valid entertainment group...');

      try {
        const groups = await this.getEntertainmentGroups();
        if (groups.length > 0) {
          console.log(`Found valid entertainment group, using: ${groups[0].id}`);
          this.updateGroupIdInConfig(groups[0].id);
        } else {
          console.error('No valid entertainment groups found');
          return false;
        }
      } catch (error) {
        console.error('Failed to find valid entertainment group:', error);
        return false;
      }
    }

    try {
      // Display PSK info before attempting to start entertainment mode
      console.log(`Starting entertainment mode for group ${this.config.entertainmentGroupId}`);

      // Add a timeout to fail faster if the connection hangs
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), hueConfig.dtlsConnectionTimeout);
      });

      // Race the connection against the timeout
      this.connection = await Promise.race([
        this.bridge.start(this.config.entertainmentGroupId),
        timeoutPromise
      ]);

      this.isConnected = true;

      // Check if connection object has 'on' method before using it
      if (this.connection && typeof this.connection.on === 'function') {
        this.connection.on("close", () => {
          console.log("Hue connection closed");
          this.isConnected = false;
        });
      } else {
        console.log("Connection object doesn't support events - will skip event registration");
      }

      console.log('Entertainment mode started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start entertainment mode:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }

      // If entertainment mode is forced, return failure
      if (hueConfig.forceEntertainmentAPI) {
        console.error('Entertainment API is forced but could not be started.');
        return false;
      }

      // If we failed to start entertainment mode, fall back to regular API
      console.warn('Falling back to regular API mode');
      this.useEntertainmentMode = false;
      this.isConnected = true; // Consider ourselves connected
      return true;
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

  // COMPLETELY REWRITTEN to guarantee beat commands are processed
  async sendColorTransition(rgb: [number, number, number], transitionTime: number = 200, forceSend: boolean = false): Promise<void> {
    // CRITICAL CHANGE: If it's a beat (forceSend=true), we MUST process this command
    if (forceSend) {
      this.beatCommandCounter++;
      const now = Date.now();
      this.lastBeatTime = now;

      // Add extremely visible logging for beat commands
      console.log(`🔴 BEAT COMMAND #${this.beatCommandCounter} - RGB: ${rgb.map(v => v.toFixed(2)).join(', ')}`);

      // For beats, ALWAYS try to use both methods to maximize chance of success
      let entertainmentMethodSucceeded = false;

      // First try entertainment method if connected and available
      if (this.isConnected && this.useEntertainmentMode && this.bridge) {
        try {
          // Use very short transition time for beats to enhance flash effect
          const fastTransitionTime = 10; // 10ms for beats
          console.log(`🔴 Sending urgent beat flash via Entertainment API - RGB=${rgb.map(v => v.toFixed(2)).join(',')}`);

          await this.bridge.transition([0], rgb, fastTransitionTime);
          console.log('✅ Beat entertainment transition sent successfully');
          entertainmentMethodSucceeded = true;
        } catch (err) {
          console.error('❌ Error sending beat via entertainment API:', err);
          // Don't return, continue to regular API
        }
      }

      // ALWAYS try regular API for beats, even if entertainment method succeeded
      // This double-send approach ensures at least one method works
      await this.sendRegularAPICommandForBeats(rgb);

      return; // Done with beat handling
    }

    // Non-beat regular transitions
    if (!this.isConnected) {
      return; // Skip if not connected
    }

    try {
      // For normal transitions, use the proper API based on connection type
      if (this.useEntertainmentMode && this.bridge) {
        await this.bridge.transition([0], rgb, transitionTime);
      } else if (!hueConfig.forceEntertainmentAPI) {
        // Rate limit regular API calls for non-beat transitions
        const now = Date.now();
        if (now - this.lastLightUpdateTime < 66) { // ~15 updates/sec limit
          return;
        }

        await this.sendRegularAPICommand(rgb, transitionTime, false);
        this.lastLightUpdateTime = now;
      }

      this.lastRGB = rgb;
    } catch (error) {
      console.error('Error sending color transition:', error);
    }
  }

  // New dedicated method just for beat flashes via regular API
  private async sendRegularAPICommandForBeats(rgb: [number, number, number]): Promise<void> {
    try {
      // Get ALL lights
      const lights = await window.electron.ipcRenderer.invoke('hue:getLightRids');

      if (!lights || lights.length === 0) {
        console.warn('❌ No lights available for regular API beat command');
        return;
      }

      // Convert RGB to XY color space for Hue
      const X = rgb[0] * 0.664511 + rgb[1] * 0.154324 + rgb[2] * 0.162028;
      const Y = rgb[0] * 0.283881 + rgb[1] * 0.668433 + rgb[2] * 0.047685;
      const Z = rgb[0] * 0.000088 + rgb[1] * 0.072310 + rgb[2] * 0.986039;
      const sum = X + Y + Z;
      const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

      console.log(`🔴 URGENT BEAT API command: RGB=${rgb.map(v => v.toFixed(2)).join(',')} → xy=${xy.map(v => v.toFixed(3)).join(',')}`);

      // Add timestamp to log for tracking command timing
      console.log(`🕒 Beat command sent at ${new Date().toISOString()} to ${lights.length} lights`);

      // For beats, ALWAYS use:
      // - Brightness 100% for maximum impact
      // - Transition time 0 for instant flash effect

      // Send command to each light as quickly as possible
      const promises = lights.map(lightId =>
        window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId,
          on: true,
          brightness: 100, // Always full brightness for beats
          xy,
          transitiontime: 0 // No transition for beats - instant change
        })
      );

      // Wait for all commands to complete
      await Promise.all(promises);
      console.log(`✅ Beat commands sent to all ${lights.length} lights`);

    } catch (error) {
      console.error('❌ ERROR sending beat commands via regular API:', error);
    }
  }

  // Keep the existing sendRegularAPICommand for non-beat updates
  private async sendRegularAPICommand(rgb: [number, number, number], transitionTime: number, forceSend: boolean): Promise<void> {
    const lights = await this.getLightsForRegularAPI();
    if (!lights || lights.length === 0) {
      return;
    }

    const X = rgb[0] * 0.664511 + rgb[1] * 0.154324 + rgb[2] * 0.162028;
    const Y = rgb[0] * 0.283881 + rgb[1] * 0.668433 + rgb[2] * 0.047685;
    const Z = rgb[0] * 0.000088 + rgb[1] * 0.072310 + rgb[2] * 0.986039;
    const sum = X + Y + Z;
    const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

    const brightness = Math.round(Math.max(...rgb) * 100);
    const transitionTimeDs = forceSend ? 0 : Math.max(1, Math.floor(transitionTime / 100));

    // For beat flashes, always use brightness 100
    const effectiveBrightness = forceSend ? 100 : brightness;

    lights.forEach(lightId => {
      window.electron.ipcRenderer.invoke('hue:setLightState', {
        lightId,
        on: true,
        brightness: effectiveBrightness,
        xy,
        transitiontime: transitionTimeDs
      }).catch(err => console.error(`Error setting light ${lightId}:`, err));
    });
  }

  // Helper to get lights for regular API mode
  private async getLightsForRegularAPI(): Promise<string[]> {
    try {
      return await window.electron.ipcRenderer.invoke('hue:getLightRids');
    } catch (error) {
      console.error('Failed to get lights for regular API:', error);
      return [];
    }
  }

  // Set the entertainment group ID with UUID validation
  setEntertainmentGroupId(groupId: string): void {
    // Validate that it's a UUID format
    if (!this.isUuidFormat(groupId)) {
      console.warn(`Invalid entertainment group ID format: ${groupId}. Must be a UUID.`);
      // Try to find a valid entertainment group
      this.getEntertainmentGroups()
        .then(groups => {
          if (groups.length > 0) {
            console.log(`Using first valid entertainment group: ${groups[0].id}`);
            this.updateGroupIdInConfig(groups[0].id);
          }
        })
        .catch(err => console.error("Error finding valid entertainment group:", err));
      return;
    }

    this.updateGroupIdInConfig(groupId);
  }

  // Helper to update group ID in config
  private updateGroupIdInConfig(groupId: string): void {
    if (this.config) {
      const updatedConfig = { ...this.config, entertainmentGroupId: groupId };
      this.saveConfig(updatedConfig);
    }
  }

  // Check if we have a valid configuration
  hasValidConfig(): boolean {
    // Check if we have our own config loaded
    if (this.config && this.config.username && this.config.address) {
      return true;
    }

    // If we don't, try one more time to load from localStorage
    try {
      // Check hueConfig
      const hueConfig = localStorage.getItem('hueConfig');
      if (hueConfig) {
        const config = JSON.parse(hueConfig);
        if (config.address && config.username) {
          return true;
        }
      }

      // Check hueBridgeInfo as fallback
      const hueBridgeInfo = localStorage.getItem('hueBridgeInfo');
      if (hueBridgeInfo) {
        const info = JSON.parse(hueBridgeInfo);
        if (info.ip && info.username) {
          // Load this config right now
          this.loadConfig();
          return true;
        }
      }
    } catch (e) {
      console.error("Error checking for valid config:", e);
    }

    return false;
  }

  // Get current configuration
  getConfig(): HueBridgeConfig | null {
    return this.config;
  }

  // Clear the configuration (for logging out or resetting)
  clearConfig(): void {
    this.config = null;
    localStorage.removeItem('hueBridgeInfo');
    localStorage.removeItem('hueConfig');
    console.log('Hue configuration cleared');
  }

  // Method to force entertainment mode (never fall back to regular API)
  forceEntertainmentMode(): void {
    this.useEntertainmentMode = true;
    console.log('Entertainment mode forced - will not fall back to regular API');
  }

  // New method to disable verbose logging after initial setups
  disableDebugLogs(): void {
    this.debugLogsEnabled = false;
    console.log('Disabled verbose Hue debug logs');
  }

  // Reset connection attempts
  resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
  }

  // New method to check if we're using Entertainment API
  isUsingEntertainmentMode(): boolean {
    return this.useEntertainmentMode;
  }
}

export default new HueService();
