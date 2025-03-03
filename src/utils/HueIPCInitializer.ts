/**
 * Helper for initializing and testing the Hue IPC communication
 */

import { testIPCConnections } from './DirectHueIPCTest';

// Run the test when this module is imported
let ipcTestRun = false;

export function ensureIPCIsAvailable() {
  if (!ipcTestRun) {
    console.log("🚀 Running IPC availability check...");
    testIPCConnections()
      .then(() => {
        console.log("✅ IPC availability check complete");
      })
      .catch(err => {
        console.error("❌ IPC availability check failed:", err);
      });
    ipcTestRun = true;
  }
  return ipcTestRun;
}

// Export a function to verify if IPC is ready
export function verifyIPCReady(): boolean {
  // Check if the IPC channels we need are available in window.electron
  const validChannels = [
    'hue:activateEntertainmentGroup',
    'hue:startDTLSStream',
    'hue:sendDTLSColor'
  ];

  // Simple check that window.electron exists
  if (!window.electron || !window.electron.ipcRenderer || !window.electron.ipcRenderer.invoke) {
    console.error("❌ window.electron.ipcRenderer.invoke is not available!");
    return false;
  }

  return true;
}
