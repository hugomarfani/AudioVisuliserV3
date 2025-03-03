/**
 * This file provides a simple test for IPC communication with Hue
 * It helps verify if IPC channels are properly registered and working
 */

// Function to test IPC connections in renderer process
export async function testIPCConnections() {
  try {
    console.log("🧪 Testing IPC connections for Hue DTLS...");

    // List of IPC channels we should be able to access
    const channels = [
      'hue:activateEntertainmentGroup',
      'hue:startDTLSStream',
      'hue:sendDTLSColor',
      'hue:deactivateEntertainmentGroup',
      'hue:stopDTLSStream',
      'hue:isDTLSStreaming'
    ];

    // Test each channel by checking if we get a proper error
    // (rather than "No handler registered")
    for (const channel of channels) {
      try {
        console.log(`Testing channel: ${channel}`);
        // Try to invoke with invalid params - should fail with "expected error"
        // but not with "No handler registered"
        await window.electron.ipcRenderer.invoke(channel, { test: true });
        console.log(`✓ Channel ${channel} exists (responded)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('No handler registered')) {
          console.error(`✗ Channel ${channel} NOT REGISTERED`);
        } else {
          console.log(`✓ Channel ${channel} exists (failed with expected error: ${errorMsg})`);
        }
      }
    }

    console.log("🧪 IPC connection test complete");
  } catch (error) {
    console.error("❌ IPC test failed:", error);
  }
}

// For debugging, test if handler exists before calling it
export async function safeInvokeIPC(channel: string, data: any) {
  try {
    console.log(`🔄 Safely invoking ${channel} with:`, data);
    return await window.electron.ipcRenderer.invoke(channel, data);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if this is a "No handler registered" error
    if (errorMsg.includes('No handler registered')) {
      console.error(`❌ IPC ERROR: No handler registered for ${channel}`);
      throw new Error(`IPC handler '${channel}' is not available. The Electron main process may not have initialized it correctly.`);
    }

    // Otherwise, it's a regular error from the handler
    console.error(`❌ IPC ERROR in ${channel}:`, errorMsg);
    throw error;
  }
}
