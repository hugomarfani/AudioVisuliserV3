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
  private maxRequestsPerSecond: number = 8; // Reduced from 10 to prevent 429 errors
  private requestQueue: Array<{rgb: [number, number, number], transitionTime: number, forceSend: boolean}> = [];
  private processingQueue: boolean = false;
  private connectionRetryDelay: number = 1000; // Starting delay (1 second)
  private maxRetryDelay: number = 30000; // Maximum delay (30 seconds)
  private isShuttingDown: boolean = false;
  private lastApiCommandTime: number = 0;
  private pendingRegularApiCommands: Array<{lightId: string, state: any}> = [];
  private processingRegularApiCommands: boolean = false;
  private lightStates: Map<string, any> = new Map(); // Track light states

  // Add monitoring properties
  private entertainmentApiCount: number = 0;
  private regularApiCount: number = 0;
  private entertainmentApiErrors: number = 0;
  private regularApiErrors: number = 0;
  private lastMetricsReset: number = Date.now();
  private isEmergencyClearing: boolean = false;
  private lastPerformanceLog: number = 0;
  private performanceLogInterval: number = 30000; // 30 seconds between performance logs

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
      // Add retry logic with exponential backoff for connection timeouts
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: any = null;

      while (retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            // Use exponential backoff for retries
            const delay = Math.min(this.connectionRetryDelay * Math.pow(2, retryCount - 1), this.maxRetryDelay);
            console.log(`Connection attempt ${this.connectionAttempts + 1} (Retry ${retryCount}). Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // Only try entertainment mode if we have a valid PSK
          if (this.config.psk && this.config.psk.length >= 10) {
            console.log(`Initializing bridge at ${this.config.address} with entertainment mode`);
            const dtlsUpdates = options?.updateRate || this.updateRate;
            console.log(`Using DTLS update rate: ${dtlsUpdates}/sec`);

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

            // Add a timeout for the bridge creation to prevent hanging
            const bridgeCreationPromise = new Promise((resolve, reject) => {
              try {
                const bridge = Phea.bridge({
                  address: this.config!.address,
                  username: this.config!.username,
                  psk: this.config!.psk,
                  dtlsUpdatesPerSecond: dtlsUpdates,
                  colorUpdatesPerSecond: hueConfig.defaultColorUpdateRate,
                  dtlsPort: hueConfig.defaultDtlsPort,
                  dtlsTimeoutMs: 5000 // Add explicit DTLS timeout of 5 seconds
                });
                resolve(bridge);
              } catch (e) {
                reject(e);
              }
            });

            // Add a timeout for the bridge creation
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Bridge creation timed out')), 10000);
            });

            // Race the promises to handle potential timeouts
            this.bridge = await Promise.race([bridgeCreationPromise, timeoutPromise]);

            if (this.bridge) {
              console.log('Bridge created successfully');
              // Disable verbose logs after successful setup
              this.debugLogsEnabled = false;

              // If we succeeded after a retry, reset the retry delay
              this.connectionRetryDelay = 1000;
              break;
            }
          } else if (hueConfig.forceEntertainmentAPI) {
            console.error('Entertainment API is forced but no valid PSK is available.');
            return false;
          } else {
            console.warn('No valid PSK available for Entertainment API');
            this.useEntertainmentMode = false;
            break; // No need to retry for non-entertainment mode
          }
        } catch (e) {
          console.error(`Error creating entertainment bridge (Attempt ${retryCount + 1}/${maxRetries}):`, e);
          lastError = e;
          retryCount++;

          // If it's the last retry and entertainment mode is required, fail
          if (retryCount >= maxRetries) {
            if (hueConfig.forceEntertainmentAPI) {
              console.error('Entertainment API is forced but initialization failed after retries.');
              throw e;
            }

            // Otherwise, fall back to regular API on last retry
            console.warn('Falling back to regular API mode after failed retries');
            this.useEntertainmentMode = false;
          }
        }
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
    console.log("🛑 Stopping all Hue operations");

    // Mark as shutting down to prevent new commands
    this.isShuttingDown = true;

    try {
      // 1. Clear all request queues
      this.requestQueue = [];
      this.pendingRegularApiCommands = [];
      this.processingQueue = false;
      this.processingRegularApiCommands = false;

      // 2. If using entertainment mode, properly disconnect
      if (this.bridge && this.isConnected) {
        try {
          console.log("Stopping entertainment mode");
          await this.bridge.stop();
        } catch (error) {
          console.error('Error stopping entertainment mode', error);
        }
      }

      // 3. Send a final dim command to each light we've controlled
      const dimLights = Array.from(this.lightStates.keys());
      if (dimLights.length > 0) {
        console.log(`Sending dimming commands to ${dimLights.length} lights`);

        // Send commands sequentially to avoid rate limiting
        for (const lightId of dimLights) {
          try {
            // Set lights to a dim state (20% brightness) to signify "off" mode
            await window.electron.ipcRenderer.invoke('hue:setLightState', {
              lightId,
              on: true,
              brightness: 20,
              transitiontime: 2 // Smooth transition
            });
            // Wait 100ms between commands
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err) {
            console.warn(`Could not dim light ${lightId}:`, err);
          }
        }
      }

      this.isConnected = false;
      console.log('Successfully disconnected from Hue');
    } finally {
      // Reset the shutdown flag
      this.isShuttingDown = false;
    }
  }

  // COMPLETELY REWRITTEN to guarantee beat commands are processed and FIX DUAL-SENDING
  async sendColorTransition(rgb: [number, number, number], transitionTime: number = 200, forceSend: boolean = false): Promise<void> {
    // Check if we're in emergency clearing mode
    if (this.isEmergencyClearing) {
      return; // Drop all commands during emergency clearing
    }

    // Always prioritize beat commands (forceSend=true)
    if (forceSend) {
      this.beatCommandCounter++;
      const now = Date.now();
      this.lastBeatTime = now;
      console.log(`🔴 BEAT COMMAND #${this.beatCommandCounter} - RGB: ${rgb.map(v => v.toFixed(2)).join(', ')}`);

      // Enhanced beat color logic
      const dramaticColor: [number, number, number] = [
        Math.min(1, rgb[0] * 2.0),
        Math.min(1, rgb[1] * 2.0),
        Math.min(1, rgb[2] * 2.0)
      ];

      // For beats, bypass the queue and send immediately
      if (this.isConnected && this.useEntertainmentMode && this.bridge) {
        try {
          // NEW: Enhanced direct communication approach
          const fastTransitionTime = 0;
          const indicesForCommand = this.getIndicesForCommand();

          console.log(`🔴 Sending URGENT beat flash via Entertainment API - RGB=${dramaticColor.map(v => v.toFixed(2)).join(',')}`);

          // Try multiple methods to ensure command gets through
          let success = false;

          // First try standard transition method
          if (typeof this.bridge.transition === 'function') {
            try {
              await this.bridge.transition(indicesForCommand, dramaticColor, fastTransitionTime);
              success = true;
            } catch (err) {
              console.warn('Standard transition failed:', err);
            }
          }

          // If standard approach failed, try direct channel RGB update
          if (!success && typeof this.bridge.setChannelRGB === 'function') {
            try {
              console.log('Falling back to direct setChannelRGB');
              for (const idx of indicesForCommand) {
                this.bridge.setChannelRGB(idx, dramaticColor[0], dramaticColor[1], dramaticColor[2]);
              }
              success = true;
            } catch (err) {
              console.warn('setChannelRGB failed:', err);
            }
          }

          // If both methods failed, try updateLightState if available
          if (!success && typeof this.bridge.updateLightState === 'function') {
            try {
              console.log('Falling back to updateLightState');
              for (const idx of indicesForCommand) {
                this.bridge.updateLightState(idx, dramaticColor);
              }
              success = true;
            } catch (err) {
              console.warn('updateLightState failed:', err);
            }
          }

          if (success) {
            // Track success and don't fall back to regular API
            this.entertainmentApiCount++;
            this.entertainmentAPIWorking = true;
            this.logPerformanceMetrics();
            return; // Exit early - we're done!
          } else {
            throw new Error('All entertainment API methods failed');
          }
        } catch (err) {
          console.error('❌ Error sending beat via Entertainment API:', err);
          this.entertainmentApiErrors++;

          // Only fallback to regular API on failure
          await this.sendRegularAPICommandForBeats(dramaticColor);
          this.entertainmentAPIWorking = false;
        }
      } else {
        // If not using entertainment API, send direct regular API command
        console.log('Entertainment API not available, using regular API for beat');
        await this.sendRegularAPICommandForBeats(dramaticColor);
        return;
      }
    }

    // For non-beat commands, add to the queue
    this.queueColorTransition(rgb, transitionTime, forceSend);
  }

  // New dedicated method just for beat flashes via regular API - enhanced for more dramatic effects
  private async sendRegularAPICommandForBeats(rgb: [number, number, number]): Promise<void> {
    try {
      this.regularApiCount++;

      // If we're shutting down, don't send any more commands
      if (this.isShuttingDown || this.isEmergencyClearing) {
        console.log('⚠️ Shutting down or emergency clearing - skipping beat command');
        return;
      }

      // Use cached lights first if available
      let lights: string[] = [];
      if (this.cachedLightIds.length > 0) {
        console.log('🔄 Using cached light IDs for beat command:', this.cachedLightIds);

        // IMPORTANT: Limit to max 3 lights to prevent rate limiting
        lights = this.cachedLightIds.slice(0, 3);
        console.log(`Limiting to ${lights.length} lights to prevent rate limiting`);
      }
      // Only fetch lights if we have none cached
      else {
        try {
          console.log(`🔍 Attempting to discover lights for beat command`);

          // Try to get lights from electron IPC
          const allLights = await window.electron.ipcRenderer.invoke('hue:getLightRids');

          if (allLights && allLights.length > 0) {
            // IMPORTANT: Limit to max 3 lights
            lights = allLights.slice(0, 3);
            console.log(`✅ Found lights, limited to ${lights.length} for beat command:`, lights);

            this.cachedLightIds = [...allLights]; // Cache all lights but use limited set
            this.lastSuccessfulLightFetchTime = Date.now();

            // Update indices as well
            const indices = Array.from({ length: allLights.length }, (_, i) => i);
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

      console.log(`🔴 RATE-LIMITED BEAT API command: RGB=${rgb.map(v => v.toFixed(2)).join(',')} → xy=${xy.map(v => v.toFixed(3)).join(',')}`);

      // Queue commands instead of sending them all at once
      // First command - immediate flash to full brightness
      for (const lightId of lights) {
        this.queueRegularApiCommand(lightId, {
          on: true,
          brightness: 100,
          xy,
          transitiontime: 0
        }, true);  // true = high priority
      }

      // Start processing the queue if not already processing
      this.processRegularApiQueue();
    } catch (error) {
      this.regularApiErrors++;
      console.error('❌ ERROR setting up beat commands via regular API:', error);
    }
  }

  // New method to queue regular API commands
  private queueRegularApiCommand(lightId: string, state: any, highPriority: boolean = false): void {
    // Store the latest state for this light to track it
    this.lightStates.set(lightId, {...state});

    // Add to queue (at beginning if high priority)
    const command = {lightId, state};
    if (highPriority) {
      this.pendingRegularApiCommands.unshift(command);
    } else {
      this.pendingRegularApiCommands.push(command);
    }

    // If not already processing and not shutting down, start processing
    if (!this.processingRegularApiCommands && !this.isShuttingDown) {
      this.processRegularApiQueue();
    }
  }

  // Process regular API commands sequentially with rate limiting
  private async processRegularApiQueue(): Promise<void> {
    // Already processing or queue is empty or shutting down
    if (this.processingRegularApiCommands || this.pendingRegularApiCommands.length === 0 ||
        this.isShuttingDown || this.isEmergencyClearing) {
      return;
    }

    // Emergency check: If queue gets too large, clear it
    if (this.pendingRegularApiCommands.length > 150) {
      console.warn(`⚠️ Regular API queue too large (${this.pendingRegularApiCommands.length}), emergency clearing!`);
      this.emergencyClearQueues();
      return;
    }

    this.processingRegularApiCommands = true;

    try {
      // Get next command from queue
      const command = this.pendingRegularApiCommands.shift();
      if (!command) {
        return;
      }

      // Rate limit: ensure at least 100ms since last command
      const now = Date.now();
      const timeSinceLastCommand = now - this.lastApiCommandTime;
      if (timeSinceLastCommand < 100) {
        await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastCommand));
      }

      // Send command with error handling
      try {
        console.log(`Sending to light ${command.lightId}: ${JSON.stringify(command.state)}`);
        await window.electron.ipcRenderer.invoke('hue:setLightState', {
          lightId: command.lightId,
          ...command.state
        });

        // Update last command time and increment counter
        this.lastApiCommandTime = Date.now();
      } catch (error) {
        this.regularApiErrors++;
        // If we get a 429, wait longer before continuing
        if (error.toString().includes('429')) {
          console.warn(`⚠️ Rate limit hit (429) - pausing API commands for 1 second`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.error(`Error setting light ${command.lightId}:`, error);
      }
    } finally {
      // Always mark as not processing when done
      this.processingRegularApiCommands = false;

      // If more commands and not shutting down, continue processing with a delay
      if (this.pendingRegularApiCommands.length > 0 && !this.isShuttingDown) {
        setTimeout(() => this.processRegularApiQueue(), 100);
      }
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

  // ADD NEW: Reset sync method to clear all queues and reset internal state
  public resetSync(): void {
    console.log("Resetting Hue sync: clearing queues and resetting internal state...");
    this.requestQueue = [];
    this.pendingRegularApiCommands = [];
    this.processingQueue = false;
    this.processingRegularApiCommands = false;
    this.lightStates.clear();
    this.connectionAttempts = 0;
    this.lastApiCommandTime = 0;
    this.beatCommandCounter = 0;
    this.lastBeatTime = 0;

    // Reset metrics counters as well
    this.entertainmentApiCount = 0;
    this.regularApiCount = 0;
    this.entertainmentApiErrors = 0;
    this.regularApiErrors = 0;
    this.lastMetricsReset = Date.now();
    this.lastPerformanceLog = 0;

    console.log('✅ HueService reset complete');
  }

  // ADD a new public testFlash method with dramatic animation
  public async testFlash(color: [number, number, number] = [1, 0, 0]): Promise<boolean> {
    console.log('🔍 TEST FLASH REQUESTED with color:', color);
    try {
      // Force recreation of entertainment indices if needed
      if (this.entertainmentLightIds.length === 0 && this.cachedLightIds.length > 0) {
        const indices = Array.from({ length: this.cachedLightIds.length }, (_, i) => i);
        this.entertainmentLightIds = indices;
        this.stable_entertainmentLightIndices = [...indices];
        console.log('Created entertainment indices for test flash:', indices);
      }

      // Boost the color for more dramatic effect
      const dramaticColor: [number, number, number] = [
        Math.min(1, color[0] * 1.5),
        Math.min(1, color[1] * 1.5),
        Math.min(1, color[2] * 1.5)
      ];

      // First try entertainment API for immediate flash - ENHANCED with animation
      if (this.isConnected && this.useEntertainmentMode && this.bridge) {
        try {
          // Get all possible indices to maximize chance of success
          const allIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

          console.log('🔴 SENDING ANIMATED TEST FLASH SEQUENCE via Entertainment API');

          // First flash - bright
          await this.bridge.transition(allIndices, dramaticColor, 0);

          // Wait 100ms
          await new Promise(r => setTimeout(r, 100));

          // Second flash - dimmer
          const dimmedColor: [number, number, number] = [
            color[0] * 0.6, color[1] * 0.6, color[2] * 0.6
          ];
          await this.bridge.transition(allIndices, dimmedColor, 0);

          // Wait 100ms
          await new Promise(r => setTimeout(r, 100));

          // Third flash - brightest
          const brightestColor: [number, number, number] = [
            Math.min(1, color[0] * 2.0),
            Math.min(1, color[1] * 2.0),
            Math.min(1, color[2] * 2.0)
          ];
          await this.bridge.transition(allIndices, brightestColor, 0);

          // Send another test command with specific indices if we have them
          if (this.entertainmentLightIds.length > 0) {
            console.log('🔴 Sending follow-up animated flash to specific indices:', this.entertainmentLightIds);
            await this.bridge.transition(this.entertainmentLightIds, dramaticColor, 0);
          }

          console.log('✅ Entertainment API test flash animation sent');
        } catch (e) {
          console.error('❌ Error with Entertainment API test flash:', e);
        }
      }

      // ALWAYS also try regular API as backup with enhanced animation
      try {
        if (this.cachedLightIds.length === 0) {
          // Try to get lights
          const lights = await this.getLightsForRegularAPI();
          if (lights && lights.length > 0) {
            this.cachedLightIds = [...lights];
          }
        }

        if (this.cachedLightIds.length > 0) {
          console.log('🔴 SENDING ANIMATED TEST FLASH via Regular API to', this.cachedLightIds.length, 'lights');

          // Convert RGB to XY
          const X = dramaticColor[0] * 0.664511 + dramaticColor[1] * 0.154324 + dramaticColor[2] * 0.162028;
          const Y = dramaticColor[0] * 0.283881 + dramaticColor[1] * 0.668433 + dramaticColor[2] * 0.047685;
          const Z = dramaticColor[0] * 0.000088 + dramaticColor[1] * 0.072310 + dramaticColor[2] * 0.986039;
          const sum = X + Y + Z;
          const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

          // First flash - full brightness
          for (const lightId of this.cachedLightIds) {
            await window.electron.ipcRenderer.invoke('hue:setLightState', {
              lightId,
              on: true,
              brightness: 100,
              xy,
              transitiontime: 0
            });
          }

          // Add a second flash after a brief delay for animation
          setTimeout(async () => {
            // Create a second flash with slight color variation
            const dimmedColor: [number, number, number] = [
              color[0] * 0.5, color[1] * 0.5, color[2] * 0.5
            ];
            const X2 = dimmedColor[0] * 0.664511 + dimmedColor[1] * 0.154324 + dimmedColor[2] * 0.162028;
            const Y2 = dimmedColor[0] * 0.283881 + dimmedColor[1] * 0.668433 + dimmedColor[2] * 0.047685;
            const Z2 = dimmedColor[0] * 0.000088 + dimmedColor[1] * 0.072310 + dimmedColor[2] * 0.986039;
            const sum2 = X2 + Y2 + Z2;
            const xy2 = sum2 === 0 ? [0.33, 0.33] : [X2 / sum2, Y2 / sum2];

            for (const lightId of this.cachedLightIds) {
              window.electron.ipcRenderer.invoke('hue:setLightState', {
                lightId,
                on: true,
                brightness: 60, // Lower brightness for contrast
                xy: xy2,
                transitiontime: 0
              });
            }

            // Add a third flash back to full color after another short delay
            setTimeout(async () => {
              for (const lightId of this.cachedLightIds) {
                window.electron.ipcRenderer.invoke('hue:setLightState', {
                  lightId,
                  on: true,
                  brightness: 100, // Back to full brightness
                  xy,
                  transitiontime: 0
                });
              }

              console.log('✅ Regular API animated test flash sequence completed');
            }, 150); // Third flash delay
          }, 150); // Second flash delay
        } else {
          console.warn('⚠️ No light IDs available for regular API test');
        }
      } catch (e) {
        console.error('❌ Error with regular API test flash:', e);
      }

      return true;
    } catch (error) {
      console.error('❌ Test flash failed completely:', error);
      return false;
    }
  }

  // Add new queue-based processing methods

  // Helper method to get valid indices for commands
  private getIndicesForCommand(): number[] {
    if (this.entertainmentLightIds.length > 0) {
      return [...this.entertainmentLightIds];
    } else if (this.stable_entertainmentLightIndices.length > 0) {
      return [...this.stable_entertainmentLightIndices];
    } else if (this.cachedLightIds.length > 0) {
      return Array.from({ length: this.cachedLightIds.length }, (_, i) => i);
    } else {
      return [0, 1, 2]; // Default to first three indices
    }
  }

  // Queue color transitions with rate limiting
  private queueColorTransition(rgb: [number, number, number], transitionTime: number, forceSend: boolean): void {
    // Skip if emergency clearing
    if (this.isEmergencyClearing) return;

    // Emergency check: If queue gets too large, clear it
    if (this.requestQueue.length > 150) {
      console.warn(`⚠️ Entertainment API queue too large (${this.requestQueue.length}), emergency clearing!`);
      this.emergencyClearQueues();
      return;
    }

    // Add to queue
    this.requestQueue.push({ rgb, transitionTime, forceSend });

    // If not already processing, start
    if (!this.processingQueue) {
      this.processQueue();
    }
  }

  // Add an emergency queue clearing mechanism
  public emergencyClearQueues(): void {
    // Store queue sizes for logging
    const regularQueueSize = this.pendingRegularApiCommands.length;
    const requestQueueSize = this.requestQueue.length;

    // Clear all queues immediately
    this.requestQueue = [];
    this.pendingRegularApiCommands = [];
    this.processingQueue = false;
    this.processingRegularApiCommands = false;

    // Block new commands temporarily
    this.isEmergencyClearing = true;
    setTimeout(() => {
      this.isEmergencyClearing = false;
      console.log('✅ Emergency clearing complete, accepting new commands');
    }, 1000);

    console.log(`⚠️ EMERGENCY QUEUE CLEAR - Discarded ${regularQueueSize} regular and ${requestQueueSize} entertainment commands`);
  }

  // Add diagnostic metrics reporting
  public getApiStats(reset: boolean = false): {
    entertainment: number,
    regular: number,
    errors: { entertainment: number, regular: number },
    queueSizes: { regular: number, entertainment: number },
    uptime: number // seconds since last reset
  } {
    const now = Date.now();
    const stats = {
      entertainment: this.entertainmentApiCount,
      regular: this.regularApiCount,
      errors: {
        entertainment: this.entertainmentApiErrors,
        regular: this.regularApiErrors
      },
      queueSizes: {
        regular: this.pendingRegularApiCommands.length,
        entertainment: this.requestQueue.length
      },
      uptime: Math.round((now - this.lastMetricsReset) / 1000)
    };

    if (reset) {
      this.entertainmentApiCount = 0;
      this.regularApiCount = 0;
      this.entertainmentApiErrors = 0;
      this.regularApiErrors = 0;
      this.lastMetricsReset = now;
    }

    return stats;
  }

  // Log performance metrics periodically
  private logPerformanceMetrics(): void {
    const now = Date.now();
    if (now - this.lastPerformanceLog > this.performanceLogInterval) {
      this.lastPerformanceLog = now;
      const stats = this.getApiStats();
      console.log('📊 Hue API Performance Metrics:', {
        entertainmentCalls: stats.entertainment,
        regularCalls: stats.regular,
        errors: stats.errors,
        queueSizes: stats.queueSizes,
        uptime: `${Math.floor(stats.uptime / 60)}m ${stats.uptime % 60}s`
      });
    }
  }

}

export default new HueService();
