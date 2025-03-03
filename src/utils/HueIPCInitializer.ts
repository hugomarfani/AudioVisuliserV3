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

// Helper to fetch actual entertainment group IDs from the bridge
export async function fetchActualEntertainmentGroups(ip: string, username: string): Promise<string[]> {
  try {
    console.log(`Fetching actual entertainment groups from bridge at ${ip}...`);
    
    // Call the bridge API to get entertainment configurations
    const response = await fetch(`https://${ip}/clip/v2/resource/entertainment_configuration`, {
      headers: {
        'hue-application-key': username
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching entertainment groups: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Entertainment groups response:', data);
    
    // Extract the IDs
    if (data.data && Array.isArray(data.data)) {
      const groupIds = data.data.map((group: any) => group.id);
      console.log(`Found ${groupIds.length} entertainment groups:`, groupIds);
      return groupIds;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching entertainment groups:', error);
    return [];
  }
}
