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
    } catch (e) {
      console.error('❌ Cannot resolve phea module path:', e);
    }

    // Test module content
    try {
      const pheaModule = require('phea');
      console.log('Module type:', typeof pheaModule);
      console.log('Module keys:', Object.keys(pheaModule));
      console.log('Module structure:', pheaModule);
    } catch (e) {
      console.error('❌ Error importing phea module:', e);
    }

    // Run basic test
    console.log('\nRunning standard test:');
    testPheaLibrary();

    return 'Detailed diagnostics completed';
  } catch (error) {
    console.error('Error in detailed diagnostics:', error);
    return 'Detailed diagnostics failed';
  }
}
