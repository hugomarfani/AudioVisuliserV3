/**
 * Test file to verify Phea is working properly
 */
import { getPheaInstance } from './PheaConnector';

// Run this function to test if Phea is properly loaded
export function testPheaLibrary() {
  console.log('----- TESTING PHEA LIBRARY -----');

  try {
    // This should load the real library
    const Phea = getPheaInstance();

    console.log('Phea instance obtained:', {
      hasDiscover: typeof Phea.discover === 'function',
      hasBridge: typeof Phea.bridge === 'function',
      hasRegister: typeof Phea.register === 'function',
    });

    // Log which version we're using
    if (Phea === require('./PheaMock').default) {
      console.error('❌ Using MOCK implementation - Entertainment API will not work properly');
    } else {
      console.log('✅ Using REAL Phea implementation - Entertainment API should work');
    }

    // Try to use the discover function to verify it's working
    console.log('Testing discover function...');
    Phea.discover()
      .then(bridges => {
        console.log(`Found ${bridges.length} bridges:`, bridges);
      })
      .catch(err => {
        console.error('Error discovering bridges:', err);
      });

    return 'Phea test started';
  } catch (error) {
    console.error('Error testing Phea:', error);
    return 'Phea test failed';
  }
}

// Export the test function
export default testPheaLibrary;

export function runDetailedPheaTest() {
  console.log('----- DETAILED PHEA DIAGNOSTICS -----');

  try {
    // Test Node.js version
    console.log('Node.js version:', process.versions.node);
    console.log('Electron version:', process.versions.electron);

    // Test module path resolution
    try {
      const pheaPath = require.resolve('phea');
      console.log('✅ Phea module found at:', pheaPath);

      // Load the actual module content
      const pheaModule = require('phea');
      console.log('Module type:', typeof pheaModule);
      console.log('Module keys:', Object.keys(pheaModule));

      // Inspect important functions
      console.log('Function details:');
      if (typeof pheaModule.discover === 'function') {
        console.log('- discover: Function exists directly');
      }

      if (typeof pheaModule.HueBridge === 'function') {
        console.log('- HueBridge: Constructor function exists');
        // Examine HueBridge prototype methods
        const methods = Object.getOwnPropertyNames(pheaModule.HueBridge.prototype);
        console.log('  HueBridge prototype methods:', methods);
      }

      if (typeof pheaModule.PheaEngine === 'function') {
        console.log('- PheaEngine: Constructor function exists');
        // Examine PheaEngine prototype methods
        const methods = Object.getOwnPropertyNames(pheaModule.PheaEngine.prototype);
        console.log('  PheaEngine prototype methods:', methods);
      }

      if (typeof pheaModule.bridge === 'function') {
        console.log('- bridge: Function exists directly');
      }

      if (typeof pheaModule.register === 'function') {
        console.log('- register: Function exists directly');
      }
    } catch (e) {
      console.error('❌ Phea module error:', e);
    }

    // Create test Phea instance using our adapter
    console.log('\nTesting adapted Phea instance:');
    const Phea = getPheaInstance();

    // Test each method separately
    console.log('Testing discover()...');
    try {
      Phea.discover().then(bridges => {
        console.log(`Found ${bridges.length} bridges:`, bridges);
      }).catch(err => console.error('Discover error:', err));
    } catch (e) {
      console.error('Discover execution error:', e);
    }

    console.log('Testing bridge() construction...');
    try {
      const testBridge = Phea.bridge({
        address: '192.168.1.100', // Test IP
        username: 'testuser',
        psk: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
      console.log('Bridge instance created:', !!testBridge);
      console.log('Bridge methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testBridge)));
    } catch (e) {
      console.error('Bridge construction error:', e);
    }

    return 'Detailed diagnostics completed';
  } catch (error) {
    console.error('Error in detailed diagnostics:', error);
    return 'Detailed diagnostics failed';
  }
}

export { runDetailedPheaTest };
