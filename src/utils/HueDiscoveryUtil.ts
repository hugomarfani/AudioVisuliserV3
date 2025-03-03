/**
 * Utility for discovering and testing Hue bridge capabilities
 */
import HueService from './HueService';

/**
 * Function to discover and print all entertainment groups on the Hue bridge
 */
export async function discoverEntertainmentGroups(): Promise<void> {
  try {
    console.log('🔍 Starting Hue entertainment group discovery...');

    // Check if we have a valid configuration
    const config = HueService.getConfig();
    if (!config) {
      console.error('No Hue configuration found. Please set up Hue first.');
      return;
    }

    console.log('Using configuration:', {
      address: config.address,
      username: config.username?.substring(0, 5) + '...',
      pskLength: config.psk?.length || 0
    });

    // Try direct API call first
    try {
      const response = await fetch(`https://${config.address}/clip/v2/resource/entertainment_configuration`, {
        headers: {
          'hue-application-key': config.username
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Direct API call result:', data);

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        console.log(`✅ Found ${data.data.length} entertainment groups:`);
        data.data.forEach((group: any, i: number) => {
          console.log(`  [${i+1}] ID: ${group.id}`);
          console.log(`      Name: ${group.metadata?.name || 'Unnamed'}`);
          console.log(`      Status: ${group.status?.active ? 'Active' : 'Inactive'}`);
          if (group.locations && Object.keys(group.locations).length > 0) {
            console.log(`      Light Locations: ${Object.keys(group.locations).length}`);
          }
          console.log('---');
        });

        // Suggest which ID to use
        const recommendedGroup = data.data[0];
        console.log(`👉 Recommended entertainment group ID to use: "${recommendedGroup.id}"`);
      } else {
        console.log('❌ No entertainment groups found via direct API');
      }
    } catch (directError) {
      console.error('Direct API call failed:', directError);
    }

    // Also try using our HueService
    try {
      console.log('\nNow trying with HueService.getEntertainmentGroups()...');
      const groups = await HueService.getEntertainmentGroups();
      console.log(`Found ${groups.length} entertainment groups via HueService:`, groups);
    } catch (serviceError) {
      console.error('HueService.getEntertainmentGroups failed:', serviceError);
    }

    // Also get any actual groups via electron IPC
    try {
      console.log('\nNow trying with electron IPC hue:getEntertainmentAreas...');
      const groups = await window.electron.ipcRenderer.invoke('hue:getEntertainmentAreas');
      console.log('Entertainment areas via IPC:', groups);
    } catch (ipcError) {
      console.error('IPC hue:getEntertainmentAreas failed:', ipcError);
    }

    console.log('\n🔍 Discovery complete!');
  } catch (error) {
    console.error('Error in entertainment group discovery:', error);
  }
}

// Make this function easy to call from the console
(window as any).discoverHueGroups = discoverEntertainmentGroups;

export async function testDTLSConnection(): Promise<void> {
  try {
    console.log('🔌 Testing DTLS connection...');

    // Get current configuration
    const config = HueService.getConfig();
    if (!config) {
      console.error('No Hue configuration found. Please set up Hue first.');
      return;
    }

    console.log('Will send a test color sequence via both implementations');

    // Test via DirectHueBridge
    console.log('\n1️⃣ Testing via DirectHueBridge...');
    await HueService.testDirectImplementation();

    // Test via Phea library
    console.log('\n2️⃣ Testing via Phea library...');
    await HueService.testColorCycle();

    console.log('\n✅ Tests completed. Check if lights changed colors.');
  } catch (error) {
    console.error('Error in DTLS connection test:', error);
  }
}

// Make this function easy to call from the console
(window as any).testHueDTLS = testDTLSConnection;
