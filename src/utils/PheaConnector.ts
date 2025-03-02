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
      hasRegister: typeof pheaModule.register === 'function',
      moduleKeys: Object.keys(pheaModule)
    });

    // First check if the module is a direct export with the required functions
    if (typeof pheaModule.discover === 'function' &&
        typeof pheaModule.bridge === 'function' &&
        typeof pheaModule.register === 'function') {
      console.log('Using direct phea exports - this is the preferred mode');
      return pheaModule as PheaInterface;
    }

    // Then check if it's exported as default
    if (pheaModule.default &&
        typeof pheaModule.default.discover === 'function' &&
        typeof pheaModule.default.bridge === 'function' &&
        typeof pheaModule.default.register === 'function') {
      console.log('Using phea.default exports');
      return pheaModule.default as PheaInterface;
    }

    // If we reach here, the module doesn't have the expected structure
    console.error('Phea module loaded but does not have the expected API structure:', pheaModule);
    throw new Error('Phea module has invalid structure');
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
