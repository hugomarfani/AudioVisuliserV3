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
        if (typeof pheaModule.HueBridge === 'function') {
          return new pheaModule.HueBridge(options);
        } else if (typeof pheaModule.bridge === 'function') {
          return pheaModule.bridge(options);
        } else {
          console.error('No compatible bridge constructor found in phea module');
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
