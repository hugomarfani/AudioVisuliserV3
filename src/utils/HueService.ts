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
  private cachedLightIds: string[] = []; // Cache of light IDs for fallback
  private lightDiscoveryAttempts: number = 0;
  private entertainmentAPIWorking: boolean = false; // Track if entertainment API is working
  private lastSuccessfulLightFetchTime: number = 0;
  private entertainmentLightIds: number[] = [0]; // Add this property to store entertainment light indices
  private entertainmentGroupLights: string[] = []; // Add a property to track entertainment group light IDs directly
  private stable_entertainmentLightIndices: number[] = [0]; // More persistent storage for indices
  private requestsInLastMinute: number = 0;
  private lastRequestTimestamp: number = 0;
  private lastRequestReset: number = 0;
  private entertainmentGroupConfigured: boolean = false;
  private lastPerformanceLog: number = 0;
  private performanceLogInterval: number = 30000;

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

      // Always initialize with stable indices if available
      if (this.stable_entertainmentLightIndices.length > 0) {
        this.entertainmentLightIds = [...this.stable_entertainmentLightIndices];
        console.log('Using stable entertainment light indices:', this.entertainmentLightIds);
      }
      // Fallback to initialized indices based on cached lights
      else if (this.cachedLightIds.length > 0) {
        this.entertainmentLightIds = Array.from(
          { length: this.cachedLightIds.length },
          (_, i) => i
        );
        // Update stable storage too
        this.stable_entertainmentLightIndices = [...this.entertainmentLightIds];
        console.log('Initialized entertainment light indices:', this.entertainmentLightIds);
      } else {
        // Default to [0] if no known lights, but keep any existing indices
        if (this.entertainmentLightIds.length === 0) {
          this.entertainmentLightIds = [0];
          this.stable_entertainmentLightIndices = [0];
          console.log('No cached lights, defaulting to light index [0]');
        }
      }

      // Check if connection object has 'on' method before using it
      if (this.connection && typeof this.connection.on === 'function') {
        this.connection.on("close", () => {
          console.log("Hue connection closed");
          this.isConnected = false;
        });
      } else {
        console.log("Connection object doesn't support events - will skip event registration");
      }

      // 🔴 NEW: Fetch light IDs immediately to ensure we have them
      try {
        const lightIds = await this.getLightsForRegularAPI();
        if (lightIds && lightIds.length > 0) {
          console.log(`Got ${lightIds.length} lights before starting entertainment mode`);
          this.cachedLightIds = [...lightIds];

          // Create matching numerical indices
          const indices = Array.from({ length: lightIds.length }, (_, i) => i);
          this.entertainmentLightIds = indices;
          this.stable_entertainmentLightIndices = [...indices];
        }
      } catch (err) {
        console.warn('Could not prefetch lights before entertainment mode:', err);
      }

      // 🔴 NEW: Always try to configure the entertainment group
      await this.ensureEntertainmentGroupSetup();

      // CRITICAL CHANGE: Force entertainment indices to match number of lights
      // Even if the configuration didn't work above, we'll try to use the right indices
      if (this.cachedLightIds.length > 0) {
        const forceIndices = Array.from({ length: this.cachedLightIds.length }, (_, i) => i);
        console.log('🔴 FORCE SETTING ENTERTAINMENT INDICES:', forceIndices);
        this.entertainmentLightIds = forceIndices;
        this.stable_entertainmentLightIndices = [...forceIndices];
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
    if (forceSend) {
      this.beatCommandCounter++;
      const now = Date.now();
      this.lastBeatTime = now;
      console.log(`🔴 BEAT COMMAND #${this.beatCommandCounter} - RGB: ${rgb.map(v => v.toFixed(2)).join(', ')}`);

      // Force immediate update using Entertainment API if available
      if (this.isConnected && this.useEntertainmentMode && this.bridge) {
        try {
          const fastTransitionTime = 50; // 50ms transition for flash effect
          // Choose indices from cached lights or default to [0,1,2]
          let indicesForCommand: number[] = (this.cachedLightIds.length > 0)
            ? Array.from({ length: this.cachedLightIds.length }, (_, i) => i)
            : (this.stable_entertainmentLightIndices.length > 0)
              ? [...this.stable_entertainmentLightIndices]
              : [0, 1, 2];
          console.log(`🔴 Sending urgent beat flash via Entertainment API - RGB=${rgb.map(v => v.toFixed(2)).join(',')} to indices:`, indicesForCommand);
          await this.bridge.transition(indicesForCommand, rgb, fastTransitionTime);
          console.log('✅ Beat entertainment transition sent successfully');
          this.entertainmentAPIWorking = true;
        } catch (err) {
          console.error('❌ Error sending beat via Entertainment API:', err);
          this.entertainmentAPIWorking = false;
        }
      } else {
        console.error('❌ Entertainment API not available for beat command');
      }
      return;
    }

    // Non-beat transitions:
    if (!this.isConnected) {
      return;
    }

    try {
      // For normal transitions, remove or reduce strict rate-limiting
      // (if needed, comment out the checkRateLimit call to allow continuous updates)
      if (!this.checkRateLimit()) {
        return;
      }

      if (this.useEntertainmentMode && this.bridge) {
        const indicesForCommand = (this.entertainmentLightIds.length > 0)
          ? this.entertainmentLightIds
          : (this.stable_entertainmentLightIndices.length > 0)
            ? this.stable_entertainmentLightIndices
            : [0];
        await this.bridge.transition(indicesForCommand, rgb, transitionTime);
      } else if (!hueConfig.forceEntertainmentAPI) {
        await this.sendRegularAPICommand(rgb, transitionTime, false);
      }
      this.lastRGB = rgb;
    } catch (error) {
      console.error('Error sending color transition:', error);
    }
  }

  // New dedicated method just for beat flashes via regular API
  private async sendRegularAPICommandForBeats(rgb: [number, number, number]): Promise<void> {
    try {
      // If entertainment API is working, we don't need to worry about the regular API
      // This prevents unnecessary logging of warnings
      if (this.entertainmentAPIWorking) {
        // Entertainment API seems to be working fine
        this.lightDiscoveryAttempts++; // Just increment this for statistics
        return;
      }

      // Use cached lights first if available
      let lights: string[] = [];
      if (this.cachedLightIds.length > 0) {
        console.log('🔄 Using cached light IDs for beat command:', this.cachedLightIds);
        lights = this.cachedLightIds;
      }
      // Only fetch lights if we have none cached
      else {
        try {
          console.log(`🔍 Attempting to discover lights for beat command`);

          // Try to get lights from electron IPC
          lights = await window.electron.ipcRenderer.invoke('hue:getLightRids');

          if (lights && lights.length > 0) {
            console.log(`✅ Found ${lights.length} lights for beat command`, lights);
            this.cachedLightIds = [...lights]; // Cache for future use
            this.lastSuccessfulLightFetchTime = Date.now();

            // Update indices as well
            const indices = Array.from({ length: lights.length }, (_, i) => i);
            this.entertainmentLightIds = indices;
            this.stable_entertainmentLightIndices = [...indices];
          } else {
            console.warn('⚠️ No lights returned from regular API for beat command');
          }
        } catch (err) {
          console.error('🚫 Error fetching lights for beat command:', err);
        }
      }

      // Still no lights? Use a fallback
      if (lights.length === 0) {
        const fallbackId = this.generateFallbackLightId();
        console.log(`🚨 No lights found for beat command - using fallback ID: ${fallbackId}`);
        lights = [fallbackId];
      }

      // Convert RGB to XY color space for Hue
      const X = rgb[0] * 0.664511 + rgb[1] * 0.154324 + rgb[2] * 0.162028;
      const Y = rgb[0] * 0.283881 + rgb[1] * 0.668433 + rgb[2] * 0.047685;
      const Z = rgb[0] * 0.000088 + rgb[1] * 0.072310 + rgb[2] * 0.986039;
      const sum = X + Y + Z;
      const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

      console.log(`🔴 URGENT BEAT API command: RGB=${rgb.map(v => v.toFixed(2)).join(',')} → xy=${xy.map(v => v.toFixed(3)).join(',')}`);
      console.log(`🕒 Beat command sent at ${new Date().toISOString()} to ${lights.length} lights`);

      // Send command to each light as quickly as possible
      const promises = lights.map(lightId =>
        window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId,
          on: true,
          brightness: 100, // Always full brightness for beats
          xy,
          transitiontime: 0 // No transition for beats - instant change
        }).catch(err => console.error(`Error setting light ${lightId}:`, err))
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

  // Add a method to update light IDs
  updateLightIds(lightIds: string[]): void {
    // Don't update if the provided array is empty but we already have cached IDs
    if (!lightIds?.length && this.cachedLightIds.length > 0) {
      console.log('⚠️ Ignoring empty light IDs update - keeping existing cached IDs');
      return;
    }

    try {
      console.log('Updating available light IDs:', lightIds);

      // Store for regular API use
      this.cachedLightIds = [...lightIds];

      // For entertainment API, we update indices
      if (lightIds?.length > 0) {
        // Entertainment API actually uses indices (0, 1, 2) rather than UUIDs
        const indices = Array.from({ length: lightIds.length }, (_, i) => i);
        console.log('Using entertainment light indices:', indices);
        this.entertainmentLightIds = indices;

        // Also store in the stable storage
        this.stable_entertainmentLightIndices = [...indices];
      } else {
        console.log('No valid lights to update');
      }
    } catch (err) {
      console.error('Error updating light IDs:', err);
    }
  }

  // Add a method to check if service is initialized
  isInitialized(): boolean {
    return !!this.bridge && !!this.config;
  }

  // Add a method to generate a fallback light ID based on the entertainment group
  private generateFallbackLightId(): string {
    // If we have a valid entertainment group, use a derived ID
    if (this.config?.entertainmentGroupId && this.isUuidFormat(this.config.entertainmentGroupId)) {
      // Use the first part of the entertainment group ID to create a light ID
      return this.config.entertainmentGroupId.split('-')[0] + '-' +
             Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }

    // Otherwise use a default format like the Hue light IDs
    return '00:17:88:01:03:' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
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

  // Add a method to get the current cached lights - useful for debugging
  getCachedLightIds(): string[] {
    return this.cachedLightIds;
  }

  // Add a method to get entertainment light indices - useful for debugging
  getEntertainmentLightIndices(): number[] {
    return this.entertainmentLightIds;
  }

  // Add a method to manually set entertainment light indices
  setEntertainmentLightIndices(indices: number[]): void {
    if (indices && indices.length > 0) {
      console.log('Manually setting entertainment light indices:', indices);
      this.entertainmentLightIds = [...indices];
      this.stable_entertainmentLightIndices = [...indices];
    }
  }

  // Add method to handle rate limiting
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if it's been more than a minute
    if (now - this.lastRequestReset > 60000) {
      this.requestsInLastMinute = 0;
      this.lastRequestReset = now;
    }

    // Limit to 10 requests per second (600 per minute)
    if (this.requestsInLastMinute >= 600) {
      console.warn('⚠️ Rate limit reached - delaying request');
      return false;
    }

    // Ensure at least 100ms between requests
    if (now - this.lastRequestTimestamp < 100) {
      return false;
    }

    this.requestsInLastMinute++;
    this.lastRequestTimestamp = now;
    return true;
  }

  // Add a new method to manually force light indices for entertainment group
  async forceEntertainmentLightIndices(count: number): Promise<void> {
    if (!count || count <= 0) count = 3; // Default to 3 lights if no count provided

    const indices = Array.from({ length: count }, (_, i) => i);
    console.log(`🔴 MANUALLY FORCING ENTERTAINMENT INDICES FOR ${count} LIGHTS:`, indices);

    this.entertainmentLightIds = [...indices];
    this.stable_entertainmentLightIndices = [...indices];

    // If we're already connected, try to apply these settings
    if (this.isConnected && this.useEntertainmentMode && this.bridge) {
      try {
        // Send a dummy command to all indices to test
        const testRgb: [number, number, number] = [1, 1, 1];
        await this.bridge.transition(indices, testRgb, 10);
        console.log('✅ Successfully tested forcibly set indices');
      } catch (e) {
        console.error('Failed to test forced indices:', e);
      }
    }
  }

  // Modified method to check if the entertainment group is properly configured
  private async ensureEntertainmentGroupSetup(): Promise<boolean> {
    if (!this.config?.entertainmentGroupId || !this.isConnected || !this.bridge) {
      return false;
    }

    try {
      // Get the current entertainment group configuration
      const groupId = this.config.entertainmentGroupId;
      console.log(`Configuring entertainment group ${groupId}...`);

      // Try to get group details if possible
      let groupDetails;
      try {
        if (typeof this.bridge.getGroup === 'function') {
          groupDetails = await this.bridge.getGroup(groupId);
          console.log('Entertainment group details:', groupDetails);
        }
      } catch (e) {
        console.warn('Could not get entertainment group details:', e);
      }

      // If we have lights identified, try to ensure they're in the entertainment group
      if (this.cachedLightIds.length > 0) {
        console.log(`Ensuring ${this.cachedLightIds.length} lights are configured for entertainment...`);

        // Create indices based on the number of lights
        const indices = Array.from({ length: this.cachedLightIds.length }, (_, i) => i);
        console.log('Setting entertainment indices:', indices);

        // Always update both sets of indices
        this.entertainmentLightIds = [...indices];
        this.stable_entertainmentLightIndices = [...indices];

        // Store the actual UUIDs for reference
        this.entertainmentGroupLights = [...this.cachedLightIds];

        // Try to use the setLights method if available
        try {
          if (typeof this.bridge.setLights === 'function') {
            await this.bridge.setLights(groupId, this.cachedLightIds);
            console.log('☑️ Successfully configured entertainment group lights');
          }
        } catch (e) {
          console.warn('Could not set entertainment group lights:', e);
        }

        this.entertainmentGroupConfigured = true;
        return true;
      } else {
        console.warn('No lights available to configure entertainment group');
      }

      return false;
    } catch (error) {
      console.error('Failed to configure entertainment group:', error);
      return false;
    }
  }

  // Add this method to verify the PSK is correctly formatted
  verifyEntertainmentApiCredentials(): boolean {
    if (!this.config) {
      console.error('No configuration available to verify');
      return false;
    }

    // Check IP address format
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipPattern.test(this.config.address)) {
      console.error('Invalid IP address format:', this.config.address);
      return false;
    }

    // Check username is reasonably formatted (not empty)
    if (!this.config.username || this.config.username.length < 5) {
      console.error('Username looks invalid:', this.config.username);
      return false;
    }

    // Check PSK format (should be 64 hex characters)
    const pskPattern = /^[0-9a-fA-F]{64}$/;
    if (!pskPattern.test(this.config.psk)) {
      console.error('PSK invalid format - should be 64 hex characters:',
        this.config.psk ? `${this.config.psk.substring(0, 4)}...` : 'missing');
      return false;
    }

    // Check entertainment group ID is a UUID
    if (!this.isUuidFormat(this.config.entertainmentGroupId)) {
      console.error('Entertainment group ID is not a valid UUID:', this.config.entertainmentGroupId);
      return false;
    }

    console.log('✅ Entertainment API credentials look valid');
    return true;
  }

  // DEBUGGING FUNCTION: Add this method to test the transition function directly
  async testTransition(): Promise<boolean> {
    if (!this.bridge || !this.isConnected) {
      console.error('Cannot test transition: bridge not connected');
      return false;
    }

    try {
      console.log('🧪 TESTING ENTERTAINMENT API TRANSITION');
      console.log('Bridge methods available:', Object.keys(this.bridge).filter(key => typeof this.bridge[key] === 'function'));

      // Get light indices to use
      const indices = this.entertainmentLightIds.length > 0 ?
        this.entertainmentLightIds :
        [0, 1, 2]; // Default to first three indices

      console.log(`Using light indices: ${indices.join(', ')}`);

      // Test with a bright red color
      const testColor: [number, number, number] = [1, 0, 0];

      // Check if transition method exists and is a function
      if (typeof this.bridge.transition !== 'function') {
        console.error('Bridge does not have a "transition" method!');

        // Try alternative methods
        if (typeof this.bridge.setChannelRGB === 'function') {
          console.log('Trying setChannelRGB method instead...');
          for (const idx of indices) {
            this.bridge.setChannelRGB(idx, testColor[0], testColor[1], testColor[2]);
          }
          return true;
        }

        if (typeof this.bridge.updateLightState === 'function') {
          console.log('Trying updateLightState method instead...');
          for (const idx of indices) {
            this.bridge.updateLightState(idx, testColor);
          }
          return true;
        }

        return false;
      }

      // If transition exists, use it
      console.log('Calling bridge.transition()...');
      await this.bridge.transition(indices, testColor, 0);
      console.log('✅ Entertainment API transition test successful!');
      return true;
    } catch (error) {
      console.error('❌ Entertainment API transition test failed:', error);
      return false;
    }
  }

  // Helper method to get valid indices for commands
  private getIndicesForCommand(): number[] {
    // Try multiple sources to ensure we get valid indices
    if (this.entertainmentLightIds.length > 0) {
      return [...this.entertainmentLightIds];
    }
    if (this.stable_entertainmentLightIndices.length > 0) {
      return [...this.stable_entertainmentLightIndices];
    }
    if (this.cachedLightIds.length > 0) {
      return Array.from({ length: this.cachedLightIds.length }, (_, i) => i);
    }
    // Default to these indices if nothing else is available
    return [0, 1, 2, 3, 4];
  }

  // Add metrics tracking method that was missing (causing errors)
  public getApiStats(): {
    entertainmentApiCount: number;
    regularApiCount: number;
    entertainmentApiErrors: number;
    regularApiErrors: number;
    lastMetricsReset: number;
  } {
    return {
      entertainmentApiCount: this.entertainmentApiCount || 0,
      regularApiCount: this.regularApiCount || 0,
      entertainmentApiErrors: this.entertainmentApiErrors || 0,
      regularApiErrors: this.regularApiErrors || 0,
      lastMetricsReset: this.lastMetricsReset || Date.now()
    };
  }

  // Add method to log performance metrics
  private logPerformanceMetrics(): void {
    const now = Date.now();
    if (now - this.lastPerformanceLog > this.performanceLogInterval) {
      console.log('Hue API Performance Metrics:', {
        entertainmentApiCount: this.entertainmentApiCount,
        regularApiCount: this.regularApiCount,
        entertainmentApiErrors: this.entertainmentApiErrors,
        regularApiErrors: this.regularApiErrors,
        timeSinceReset: Math.floor((now - this.lastMetricsReset) / 1000) + 's',
      });
      this.lastPerformanceLog = now;
    }
  }

  // Add method to reset metrics
  public resetApiStats(): void {
    this.entertainmentApiCount = 0;
    this.regularApiCount = 0;
    this.entertainmentApiErrors = 0;
    this.regularApiErrors = 0;
    this.lastMetricsReset = Date.now();
    console.log('Hue API metrics reset');
  }

  // Add method for emergency clearing of queues
  public emergencyClearQueues(): void {
    console.warn('⚠️ EMERGENCY CLEARING QUEUES');
    this.isEmergencyClearing = true;
    setTimeout(() => {
      console.log('Emergency clearing completed');
      this.isEmergencyClearing = false;
    }, 2000);
  }

  // Missing properties that need to be initialized
  private entertainmentApiCount: number = 0;
  private regularApiCount: number = 0;
  private entertainmentApiErrors: number = 0;
  private regularApiErrors: number = 0;
  private lastMetricsReset: number = Date.now();
  private isEmergencyClearing: boolean = false;

  // Add to HueService class
  async verifyEntertainmentSetup(): Promise<boolean> {
    console.log('🔍 Verifying entertainment setup...');

    if (!this.config) {
      console.error('No configuration available');
      return false;
    }

    try {
      console.log('1. Checking entertainment group ID format...');
      if (!this.isUuidFormat(this.config.entertainmentGroupId)) {
        console.error(`Entertainment group ID is not in UUID format: ${this.config.entertainmentGroupId}`);
        return false;
      }

      // Make a REST API call to check if this is a real entertainment group
      console.log(`2. Checking if group ${this.config.entertainmentGroupId} exists...`);
      try {
        const entertainmentGroups = await window.electron.ipcRenderer.invoke(
          'hue:getEntertainmentAreas'
        );
        console.log('Retrieved entertainment areas:', entertainmentGroups);

        const matchingGroup = entertainmentGroups.find(
          (group: any) => group.id === this.config.entertainmentGroupId
        );

        if (!matchingGroup) {
          console.error(`Entertainment group ${this.config.entertainmentGroupId} not found`);
          return false;
        }

        console.log('Found matching group:', matchingGroup);
      } catch (err) {
        console.warn('Could not verify group via REST API:', err);
        // Continue anyway as this might be due to permissions
      }

      console.log('3. Checking bridge connection status...');
      if (!this.bridge) {
        console.error('No bridge object available');
        return false;
      }

      if (!this.isConnected) {
        console.error('Not connected to bridge');
        return false;
      }

      // Check if we can directly access the underlying connection
      console.log('4. Checking DTLS connection...');
      const hasConnection = !!(
        this.bridge._connection ||
        this.connection ||
        this.bridge.connection
      );

      console.log(`DTLS connection available: ${hasConnection}`);

      // Run a test flash
      console.log('5. Running test flash cycle...');
      await this.testColorCycle();

      return true;
    } catch (err) {
      console.error('Error verifying entertainment setup:', err);
      return false;
    }
  }

  // Add a test color cycle method
  async testColorCycle(): Promise<void> {
    if (!this.isConnected || !this.bridge) {
      console.error('Cannot run test - not connected');
      return;
    }

    const colors: [number, number, number][] = [
      [1, 0, 0], // Red
      [0, 1, 0], // Green
      [0, 0, 1], // Blue
      [1, 1, 1], // White
      [0, 0, 0]  // Black/Off
    ];

    // Get indices to update
    const indices = this.getIndicesForCommand();
    console.log(`Running color cycle test on indices: ${indices.join(', ')}`);

    for (const color of colors) {
      try {
        console.log(`Testing color: RGB(${color.join(', ')})`);
        // Use different approach depending on what's available
        if (typeof this.bridge._connection?.write === 'function') {
          // Format for raw DTLS streaming
          const r = Math.round(color[0] * 65535);
          const g = Math.round(color[1] * 65535);
          const b = Math.round(color[2] * 65535);

          // Build message for each light
          const messages = indices.map(idx => {
            const buffer = Buffer.alloc(7);
            buffer[0] = idx;
            buffer[1] = (r >> 8) & 0xFF;
            buffer[2] = r & 0xFF;
            buffer[3] = (g >> 8) & 0xFF;
            buffer[4] = g & 0xFF;
            buffer[5] = (b >> 8) & 0xFF;
            buffer[6] = b & 0xFF;
            return buffer;
          });

          // Combine and send with header
          const message = Buffer.concat([
            Buffer.from([0x48, 0x45, 0x49]), // HEI header
            ...messages
          ]);

          this.bridge._connection.write(message);
        } else {
          // Fall back to transition method
          await this.bridge.transition(indices, color, 0);
        }

        // Wait half a second between colors
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error testing color ${color}:`, err);
      }
    }
  }
}

export default new HueService();
