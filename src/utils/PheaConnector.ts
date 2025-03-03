/**
 * This utility manages the connection to the Phea library for Philips Hue Entertainment API.
 * It handles the initialization of the correct Phea module based on how the library is structured.
 */
import PheaMock from './PheaMock';

// Constructor parameters for Phea bridge
interface PheaOptions {
  address: string;
  username: string;
  psk: string;
  dtlsUpdatesPerSecond?: number;
  colorUpdatesPerSecond?: number;
  dtlsPort?: number;
  dtlsTimeoutMs?: number;
}

// Phea interface based on documentation
interface PheaInterface {
  discover: () => Promise<any[]>;
  register: (ipAddress: string) => Promise<any>;
  bridge: (options: PheaOptions) => any;
}

// Return a properly initialized Phea instance or mock
export function getPheaInstance(): PheaInterface {
  // Try to load the real Phea module with improved error logging
  try {
    console.log('Importing phea module...');
    const pheaModule = require('phea');

    // Debug what we got
    console.log('Phea imported successfully. Module structure:', {
      type: typeof pheaModule,
      hasDiscover: typeof pheaModule.discover === 'function',
      hasBridge: typeof pheaModule.bridge === 'function',
      hasHueBridge: typeof pheaModule.HueBridge === 'function',
      hasRegister: typeof pheaModule.register === 'function',
      moduleKeys: Object.keys(pheaModule)
    });

    // Create an adapter that maps the actual module structure to our expected interface
    const pheaAdapter: PheaInterface = {
      discover: pheaModule.discover, // This function exists directly

      // The library uses HueBridge instead of bridge
      bridge: (options: PheaOptions) => {
        console.log('Creating Hue bridge with options:', {
          address: options.address,
          username: options.username,
          pskLength: options.psk?.length || 0,
          dtlsUpdatesPerSecond: options.dtlsUpdatesPerSecond,
          colorUpdatesPerSecond: options.colorUpdatesPerSecond
        });

        try {
          let bridgeInstance;

          if (typeof pheaModule.HueBridge === 'function') {
            console.log('Using HueBridge constructor');
            bridgeInstance = new pheaModule.HueBridge(options);

            // Log the methods that actually exist for debugging
            console.log('Available bridge methods:', Object.getOwnPropertyNames(
              Object.getPrototypeOf(bridgeInstance)
            ));

            // IMPORTANT: Make sure connect/disconnect methods are explicity wrapped as start/stop
            // Define our own start method that uses connect if it exists
            bridgeInstance.start = function(groupId: string) {
              console.log('Custom start method called with groupId:', groupId);

              // Ensure the groupId is a string (important for compatibility)
              const safeGroupId = String(groupId);

              if (typeof this.connect === 'function') {
                console.log('Delegating to connect() method with groupId:', safeGroupId);
                return this.connect(safeGroupId);
              } else {
                console.error('Neither start nor connect method available');
                throw new Error('Bridge API incompatible - no start/connect method');
              }
            };

            // Define our own stop method that uses disconnect if it exists
            bridgeInstance.stop = function() {
              console.log('Custom stop method called');
              if (typeof this.disconnect === 'function') {
                console.log('Delegating to disconnect() method');
                return this.disconnect();
              } else {
                console.warn('No disconnect method found, stop is a no-op');
                return Promise.resolve();
              }
            };

            // Create a transition method if needed
            if (!bridgeInstance.transition && bridgeInstance.setLightState) {
              console.log('Adding transition method based on setLightState');

              // IMPORTANT UPDATE: Fixed transition method to ensure it works correctly
              bridgeInstance.transition = function(lightIds: (string|number)[],
                                              rgb: [number, number, number],
                                              transitionTime: number) {
                // Ensure RGB values are in proper 0-1 range
                const normalizedRgb = rgb.map(v => Math.max(0, Math.min(1, v))) as [number, number, number];

                console.log('Custom transition called:', {
                  lightIds,
                  rgb: normalizedRgb.map(v => v.toFixed(2)),
                  transitionTime
                });

                // NEW APPROACH: Try to access the raw DTLS connection directly if available
                // This is the most direct approach and should work if the connection is valid
                if (this._connection && typeof this._connection.write === 'function') {
                  try {
                    console.log('Using direct DTLS connection write method');
                    // For each light, build a packet using the Hue Entertainment protocol
                    const packets = [];

                    // Convert RGB values to 16-bit integers (0-65535 range)
                    const r = Math.max(0, Math.min(65535, Math.round(normalizedRgb[0] * 65535)));
                    const g = Math.max(0, Math.min(65535, Math.round(normalizedRgb[1] * 65535)));
                    const b = Math.max(0, Math.min(65535, Math.round(normalizedRgb[2] * 65535)));

                    for (const lightId of lightIds) {
                      // Format: ID + R-high + R-low + G-high + G-low + B-high + B-low
                      const channelId = typeof lightId === 'number' ? lightId : 0;
                      const buffer = Buffer.alloc(7);
                      buffer[0] = channelId;
                      buffer[1] = (r >> 8) & 0xff; // R high byte
                      buffer[2] = r & 0xff;        // R low byte
                      buffer[3] = (g >> 8) & 0xff; // G high byte
                      buffer[4] = g & 0xff;        // G low byte
                      buffer[5] = (b >> 8) & 0xff; // B high byte
                      buffer[6] = b & 0xff;        // B low byte
                      packets.push(buffer);
                    }

                    // Concatenate all the packets
                    const message = Buffer.concat(packets);

                    // Add protocol header for entertainment API
                    const header = Buffer.from([0x48, 0x45, 0x49]); // "HEI" header
                    const fullMessage = Buffer.concat([header, message]);

                    console.log(`Sending raw DTLS packet (${fullMessage.length} bytes)`);
                    this._connection.write(fullMessage);
                    return Promise.resolve();
                  } catch (err) {
                    console.error('Error with direct DTLS write:', err);
                  }
                }

                // If the direct DTLS approach fails, try each method in sequence

                // Try setChannelRGB first if available
                if (typeof this.setChannelRGB === 'function') {
                  try {
                    console.log('Using setChannelRGB for Entertainment API');
                    const promises = lightIds.map(id => {
                      const channelId = typeof id === 'number' ? id : 0;
                      console.log(`Setting channel ${channelId} RGB: ${normalizedRgb.join(', ')}`);
                      return this.setChannelRGB(channelId, normalizedRgb[0], normalizedRgb[1], normalizedRgb[2]);
                    });
                    return Promise.all(promises);
                  } catch (err) {
                    console.error('Error using setChannelRGB:', err);
                  }
                }

                // Try updateLightState next
                if (typeof this.updateLightState === 'function') {
                  try {
                    console.log('Using updateLightState for Entertainment API');
                    const promises = lightIds.map(id => {
                      const channelId = typeof id === 'number' ? id : 0;
                      return this.updateLightState(channelId, normalizedRgb);
                    });
                    return Promise.all(promises);
                  } catch (err) {
                    console.error('Error using updateLightState:', err);
                  }
                }

                // Try the REST API as a last resort
                if (typeof this.setLightState === 'function') {
                  try {
                    console.log('Falling back to REST API (will be slower)');
                    // Convert RGB to XY color space for Hue REST API
                    const r = normalizedRgb[0], g = normalizedRgb[1], b = normalizedRgb[2];
                    const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
                    const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
                    const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;
                    const sum = X + Y + Z;
                    const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

                    // Calculate brightness from RGB max (0-254 range for Hue API)
                    const brightness = Math.max(1, Math.min(254, Math.round(Math.max(...normalizedRgb) * 254)));

                    const promises = lightIds.map(lightId => {
                      // For REST API, we need string IDs (UUIDs)
                      const stringId = typeof lightId === 'string' ? lightId : '';
                      if (!stringId) {
                        console.warn(`Cannot use numeric ID ${lightId} with REST API - need UUID`);
                        return Promise.resolve();
                      }

                      const lightState = {
                        on: true,
                        bri: brightness,
                        xy: xy,
                        transitiontime: Math.max(0, Math.round(transitionTime / 100))
                      };

                      console.log(`Setting light ${stringId} to:`, lightState);
                      return this.setLightState(stringId, lightState);
                    });

                    return Promise.all(promises);
                  } catch (err) {
                    console.error('Error using REST API:', err);
                  }
                }

                console.error('No compatible method found to control lights');
                return Promise.reject(new Error('No compatible method found to control lights'));
              };
            }

            // IMPORTANT: Add direct RGB streaming for entertainment API if needed
            if (!bridgeInstance.updateLightState) {
              console.log('Adding direct RGB updateLightState method');

              bridgeInstance.updateLightState = function(channelId: number, rgb: [number, number, number]) {
                // Implementation depends on the library's specific requirements
                console.log(`Direct update for channel ${channelId} with RGB ${rgb.map(v => v.toFixed(2)).join()}`);

                // This is where the fix is needed - the current implementation doesn't actually send anything to the device
                // Instead, try to use the native functions from the Phea library

                // First try - if there's a native setChannelRGB function
                if (typeof this.setChannelRGB === 'function') {
                  try {
                    console.log(`Using native setChannelRGB for channel ${channelId}`);
                    return this.setChannelRGB(channelId, rgb[0], rgb[1], rgb[2]);
                  } catch (err) {
                    console.error(`Error with setChannelRGB for channel ${channelId}:`, err);
                  }
                }

                // Second attempt - try to use the raw streaming API if available
                if (typeof this.stream === 'function' || this.stream) {
                  try {
                    console.log(`Attempting raw stream command for channel ${channelId}`);
                    // Format the RGB values as required by the streaming protocol
                    const r = Math.max(0, Math.min(65535, Math.round(rgb[0] * 65535)));
                    const g = Math.max(0, Math.min(65535, Math.round(rgb[1] * 65535)));
                    const b = Math.max(0, Math.min(65535, Math.round(rgb[2] * 65535)));

                    // Create command buffer for this light
                    // Format: Light ID (1 byte) | R-high | R-low | G-high | G-low | B-high | B-low
                    const buffer = Buffer.alloc(7);
                    buffer[0] = channelId;
                    buffer[1] = (r >> 8) & 0xff; // R high byte
                    buffer[2] = r & 0xff;        // R low byte
                    buffer[3] = (g >> 8) & 0xff; // G high byte
                    buffer[4] = g & 0xff;        // G low byte
                    buffer[5] = (b >> 8) & 0xff; // B high byte
                    buffer[6] = b & 0xff;        // B low byte

                    // Some implementations use different methods to send the data
                    if (typeof this.stream === 'function') {
                      return this.stream(buffer);
                    } else if (this.stream && typeof this.stream.write === 'function') {
                      return this.stream.write(buffer);
                    } else if (this._stream && typeof this._stream.write === 'function') {
                      return this._stream.write(buffer);
                    }
                  } catch (e) {
                    console.error(`Error with raw streaming for channel ${channelId}:`, e);
                  }
                }

                // Third attempt - try setLights method if available (used in some newer versions)
                if (typeof this.setLights === 'function') {
                  try {
                    console.log(`Trying setLights method for channel ${channelId}`);
                    const lightState = {
                      rgb: rgb,
                      id: channelId
                    };
                    return this.setLights([lightState]);
                  } catch (e) {
                    console.error('Error using setLights method:', e);
                  }
                }

                console.warn(`❗ No suitable method found to update light ${channelId} - LIGHTS WILL NOT CHANGE!`);
                return Promise.resolve(); // Still resolve to not break the chain
              };
            }

            // Verify that our methods were added correctly
            console.log('Bridge methods after enhancement:', {
              hasStart: typeof bridgeInstance.start === 'function',
              hasStop: typeof bridgeInstance.stop === 'function',
              hasTransition: typeof bridgeInstance.transition === 'function',
              hasUpdateLightState: typeof bridgeInstance.updateLightState === 'function'
            });

            return bridgeInstance;
          } else if (typeof pheaModule.bridge === 'function') {
            console.log('Using bridge function');
            return pheaModule.bridge(options);
          } else {
            console.error('No compatible bridge constructor found in phea module');
            return PheaMock.bridge(options);
          }
        } catch (error) {
          console.error('Error creating bridge:', error);
          return PheaMock.bridge(options);
        }
      },

      // Create a register function if missing (or use the existing one)
      register: async (ipAddress: string) => {
        if (typeof pheaModule.register === 'function') {
          return pheaModule.register(ipAddress);
        }

        // If no register function exists, try to create one using PheaEngine or HueBridge
        console.log('No direct register function found, trying to implement one...');

        try {
          if (typeof pheaModule.PheaEngine === 'function') {
            console.log('Using PheaEngine for registration');
            const engine = new pheaModule.PheaEngine();
            return engine.register(ipAddress);
          } else if (typeof pheaModule.HueBridge === 'function') {
            console.log('Attempting registration using HueBridge class');
            // Some implementations might support registration through the bridge class
            const tempBridge = new pheaModule.HueBridge({ address: ipAddress });
            return tempBridge.register();
          } else {
            throw new Error('No registration mechanism found in Phea module');
          }
        } catch (error) {
          console.error('Failed to implement registration:', error);
          return PheaMock.register(ipAddress);
        }
      }
    };

    console.log('Phea adapter created successfully');
    return pheaAdapter;
  } catch (error) {
    console.error('Failed to load real Phea module:', error);

    // Try to load it again with require.resolve to see detailed errors
    try {
      const pheaPath = require.resolve('phea');
      console.error(`Phea module path: ${pheaPath}, but loading failed`);
    } catch (resolveError) {
      console.error('Phea module cannot be resolved:', resolveError);
      console.error('Make sure the phea package is installed with: npm install phea');
    }

    console.warn('Falling back to mock implementation - ENTERTAINMENT API WILL NOT WORK PROPERLY');
    return PheaMock;
  }
}

// Helper function to parse the PSK into correct format if needed
export function validatePSK(psk: string): string {
  if (!psk) return '';

  // Remove any non-hex characters
  const cleanedPSK = psk.replace(/[^0-9a-fA-F]/g, '');

  // Check if the PSK is a valid hex string with expected length (32 bytes = 64 hex chars)
  if (!/^[0-9a-fA-F]{64}$/.test(cleanedPSK)) {
    console.warn('PSK does not match expected format. Expected 64 hex characters.');
  }

  return cleanedPSK;
}

// Add this enhanced function to the PheaConnector.ts file
export function testPheaLibrary() {
  try {
    const pheaModule = require('phea');

    console.log('====== PHEA LIBRARY DIAGNOSTIC TEST ======');
    console.log('Module type:', typeof pheaModule);
    console.log('Available properties:', Object.keys(pheaModule));

    // Check for critical methods
    const hasBridge = typeof pheaModule.bridge === 'function' || typeof pheaModule.HueBridge === 'function';
    const hasDiscover = typeof pheaModule.discover === 'function';
    const hasRegister = typeof pheaModule.register === 'function';

    console.log('Has bridge function:', hasBridge);
    console.log('Has discover function:', hasDiscover);
    console.log('Has register function:', hasRegister);

    // If the library has HueBridge constructor, check its prototype
    if (typeof pheaModule.HueBridge === 'function') {
      console.log('HueBridge prototype methods:',
        Object.getOwnPropertyNames(pheaModule.HueBridge.prototype)
          .filter(name => name !== 'constructor')
      );

      // Create a test instance to check available methods
      try {
        const testBridge = new pheaModule.HueBridge({
          address: '192.168.1.100', // Dummy address
          username: 'test',
          psk: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' // Dummy PSK
        });

        console.log('Bridge instance methods:',
          Object.getOwnPropertyNames(Object.getPrototypeOf(testBridge))
        );

        // Check for critical methods
        console.log('Has connect method:', typeof testBridge.connect === 'function');
        console.log('Has disconnect method:', typeof testBridge.disconnect === 'function');
        console.log('Has transition method:', typeof testBridge.transition === 'function');
        console.log('Has setChannelRGB method:', typeof testBridge.setChannelRGB === 'function');

      } catch (err) {
        console.error('Error creating test bridge instance:', err);
      }
    }

    console.log('====== END PHEA LIBRARY TEST ======');
    return true;
  } catch (error) {
    console.error('PHEA LIBRARY NOT AVAILABLE:', error);
    return false;
  }
}
