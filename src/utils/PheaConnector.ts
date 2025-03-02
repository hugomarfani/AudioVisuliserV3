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
  // Try to load the real Phea module
  try {
    console.log('Importing phea module...');
    const pheaModule = require('phea');

    // Debug what we got
    console.log('Phea imported successfully. Module structure:', {
      type: typeof pheaModule,
      hasDiscover: typeof pheaModule.discover === 'function',
      hasBridge: typeof pheaModule.bridge === 'function',
      hasRegister: typeof pheaModule.register === 'function',
      moduleKeys: Object.keys(pheaModule)
    });

    // Check if module is usable
    const hasRequiredFunctions = (
      typeof pheaModule.discover === 'function' ||
      (pheaModule.default && typeof pheaModule.default.discover === 'function')
    ) && (
      typeof pheaModule.bridge === 'function' ||
      (pheaModule.default && typeof pheaModule.default.bridge === 'function')
    );

    if (!hasRequiredFunctions) {
      console.warn('Phea module does not have required functions - using mock instead');
      return PheaMock;
    }

    // Create a wrapper that has the expected API structure
    const pheaWrapper: PheaInterface = {
      discover: async () => {
        try {
          if (typeof pheaModule.discover === 'function') {
            return await pheaModule.discover();
          } else if (pheaModule.default && typeof pheaModule.default.discover === 'function') {
            return await pheaModule.default.discover();
          } else {
            console.error('No discover method found on phea module - falling back to mock');
            return PheaMock.discover();
          }
        } catch (error) {
          console.error('Error in phea discover - falling back to mock:', error);
          return PheaMock.discover();
        }
      },

      register: async (ipAddress: string) => {
        try {
          if (typeof pheaModule.register === 'function') {
            return await pheaModule.register(ipAddress);
          } else if (pheaModule.default && typeof pheaModule.default.register === 'function') {
            return await pheaModule.default.register(ipAddress);
          } else {
            console.error('No register method found on phea module - falling back to mock');
            return PheaMock.register(ipAddress);
          }
        } catch (error) {
          console.error('Error in phea register - falling back to mock:', error);
          return PheaMock.register(ipAddress);
        }
      },

      bridge: (options: PheaOptions) => {
        try {
          console.log('Creating bridge with options:', options);

          if (typeof pheaModule.bridge === 'function') {
            console.log('Using pheaModule.bridge function');
            return pheaModule.bridge(options);
          } else if (pheaModule.default && typeof pheaModule.default.bridge === 'function') {
            console.log('Using pheaModule.default.bridge function');
            return pheaModule.default.bridge(options);
          } else {
            console.error('No bridge method found on phea module - falling back to mock');
            return PheaMock.bridge(options);
          }
        } catch (error) {
          console.error('Error creating Phea bridge - falling back to mock:', error);
          return PheaMock.bridge(options);
        }
      }
    };

    return pheaWrapper;
  } catch (error) {
    console.error('Error importing Phea module - using mock:', error);
    return PheaMock;
  }
}

// Helper function to check if we're in a development environment
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
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
