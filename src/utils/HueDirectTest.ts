/**
 * HueDirectTest - Utility to directly test Philips Hue Entertainment API without
 * any abstraction layers to identify communication issues
 */
import { getPheaInstance } from './PheaConnector';
import HueService from './HueService';

export async function testEntertainmentConnection(): Promise<{
  success: boolean;
  details: any;
  error?: string;
}> {
  try {
    console.log("🔍 Testing direct entertainment connection...");
    const config = HueService.getConfig();

    if (!config) {
      return {
        success: false,
        details: null,
        error: "No Hue configuration found"
      };
    }

    const Phea = getPheaInstance();
    console.log(`Creating test bridge with address ${config.address} and entertainment group ${config.entertainmentGroupId}`);

    // Create new bridge instance for testing
    const bridge = Phea.bridge({
      address: config.address,
      username: config.username,
      psk: config.psk,
      dtlsUpdatesPerSecond: 20,
      colorUpdatesPerSecond: 20,
      dtlsPort: 2100, // Explicit default port
      dtlsTimeoutMs: 5000
    });

    // Explicitly log available methods
    console.log("Available bridge methods:",
      Object.getOwnPropertyNames(Object.getPrototypeOf(bridge))
        .filter(name => typeof bridge[name] === 'function')
    );

    // Start a fresh connection
    console.log(`Starting test connection to group ${config.entertainmentGroupId}...`);
    const connection = await bridge.start(config.entertainmentGroupId);

    console.log("Test connection successful:", connection);

    // Try to send a simple red flash to ALL possible light indices
    const allIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    console.log(`Sending RED test flash to indices: ${allIndices.join(', ')}`);

    // EXTREMELY BRIGHT RED for visibility
    const brightRed: [number, number, number] = [1, 0, 0];
    await bridge.transition(allIndices, brightRed, 0);

    // Wait a moment and send test green
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("Sending GREEN test flash...");
    const brightGreen: [number, number, number] = [0, 1, 0];
    await bridge.transition(allIndices, brightGreen, 0);

    // Wait a moment and send test blue
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("Sending BLUE test flash...");
    const brightBlue: [number, number, number] = [0, 0, 1];
    await bridge.transition(allIndices, brightBlue, 0);

    // Final test - try with explicit channel method if available
    if (typeof bridge.setChannelRGB === 'function') {
      console.log("Testing direct setChannelRGB method...");
      allIndices.forEach(index => {
        bridge.setChannelRGB(index, 1, 1, 0); // Yellow
      });
    }

    // Clean up
    await bridge.stop();

    return {
      success: true,
      details: {
        connectionEstablished: true,
        methodsAvailable: {
          transition: typeof bridge.transition === 'function',
          setChannelRGB: typeof bridge.setChannelRGB === 'function',
          updateLightState: typeof bridge.updateLightState === 'function'
        }
      }
    };
  } catch (error) {
    console.error("❌ Direct entertainment test failed:", error);
    return {
      success: false,
      details: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runColorSequence(): Promise<boolean> {
  try {
    const config = HueService.getConfig();
    if (!config) return false;

    // Use light indices 0-9 to ensure we hit all lights
    const allIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    // Create a vibrant color sequence
    const colors: Array<[number, number, number]> = [
      [1, 0, 0],   // Red
      [0, 1, 0],   // Green
      [0, 0, 1],   // Blue
      [1, 1, 0],   // Yellow
      [1, 0, 1],   // Purple
      [0, 1, 1],   // Cyan
      [1, 1, 1],   // White
    ];

    console.log("Starting direct color sequence test...");
    const Phea = getPheaInstance();
    const bridge = Phea.bridge({
      address: config.address,
      username: config.username,
      psk: config.psk,
      dtlsUpdatesPerSecond: 10
    });

    console.log("Connecting to entertainment group:", config.entertainmentGroupId);
    const connection = await bridge.start(config.entertainmentGroupId);

    console.log("Running color sequence...");
    for (const color of colors) {
      console.log(`Setting color: ${color.join(', ')}`);
      await bridge.transition(allIndices, color, 0);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Turn lights to dim white before exiting
    await bridge.transition(allIndices, [0.2, 0.2, 0.2], 100);
    await bridge.stop();

    console.log("Color sequence completed");
    return true;
  } catch (error) {
    console.error("Color sequence test failed:", error);
    return false;
  }
}
