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
        console.log('Creating Hue bridge with options:', options);

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
              if (typeof this.connect === 'function') {
                console.log('Delegating to connect() method');
                return this.connect(groupId);
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

              bridgeInstance.transition = function(lightIds: (string|number)[],
                                              rgb: [number, number, number],
                                              transitionTime: number) {
                console.log('Custom transition called:', { lightIds, rgb, transitionTime });
                // Convert RGB to XY color space
                const r = rgb[0], g = rgb[1], b = rgb[2];
                const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
                const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
                const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;
                const sum = X + Y + Z;
                const xy = sum === 0 ? [0.33, 0.33] : [X / sum, Y / sum];

                // Apply to all lights
                const promises = lightIds.map(lightId =>
                  this.setLightState(lightId, {
                    on: true,
                    bri: Math.round(Math.max(...rgb) * 254),
                    xy: xy,
                    transitiontime: Math.round(transitionTime / 100)
                  })
                );

                return Promise.all(promises);
              };
            }

            // Verify that our methods were added correctly
            console.log('Bridge methods after enhancement:', {
              hasStart: typeof bridgeInstance.start === 'function',
              hasStop: typeof bridgeInstance.stop === 'function',
              hasTransition: typeof bridgeInstance.transition === 'function'
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
