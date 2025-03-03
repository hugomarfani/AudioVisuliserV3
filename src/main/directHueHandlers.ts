/**
 * Direct Hue Bridge IPC Handlers
 *
 * These handlers implement the direct DTLS communication with Philips Hue Entertainment API
 * They're used by the DirectHueBridge class in the renderer process
 */

import { ipcMain } from 'electron';
import axios from 'axios';
import * as dgram from 'dgram';
import https from 'https';

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Initialize a simpler version for testing first
export function initializeDirectHueHandlers() {
  console.log("🔌 Initializing Direct Hue IPC handlers...");

  // Simple test handler for the critical endpoint
  ipcMain.handle('hue:activateEntertainmentGroup', async (_, data) => {
    console.log("➡️ hue:activateEntertainmentGroup called with data:", data);

    try {
      console.log(`Activating entertainment group ${data.entertainmentGroupId} on bridge ${data.ip}`);

      // Call the CLIP v2 API to activate the entertainment group
      const url = `https://${data.ip}/clip/v2/resource/entertainment_configuration/${data.entertainmentGroupId}`;
      const payload = { action: "start" };

      console.log(`PUT ${url} with payload:`, payload);

      const response = await axios.put(url, payload, {
        headers: { 'hue-application-key': data.username },
        httpsAgent
      });

      console.log("Entertainment group activation response:", response.data);

      return {
        success: true,
        message: 'Entertainment group activated successfully',
        data: response.data
      };
    } catch (error) {
      console.error("Error activating entertainment group:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Simplified handler for DTLS streaming
  ipcMain.handle('hue:startDTLSStream', async (_, data) => {
    console.log("➡️ hue:startDTLSStream called with data:", data);

    // For now, just simulate success to test the flow
    return {
      success: true,
      message: 'DTLS stream started successfully (simulated)'
    };
  });

  // Simplified color sending handler
  ipcMain.handle('hue:sendDTLSColor', async (_, data) => {
    console.log("➡️ hue:sendDTLSColor called with data:", data);

    // Just simulate success for now
    return { success: true };
  });

  // Simple deactivation handler
  ipcMain.handle('hue:deactivateEntertainmentGroup', async (_, data) => {
    console.log("➡️ hue:deactivateEntertainmentGroup called with data:", data);

    try {
      const url = `https://${data.ip}/clip/v2/resource/entertainment_configuration/${data.entertainmentGroupId}`;
      const payload = { action: "stop" };

      const response = await axios.put(url, payload, {
        headers: { 'hue-application-key': data.username },
        httpsAgent
      });

      return {
        success: true,
        message: 'Entertainment group deactivated successfully',
        data: response.data
      };
    } catch (error) {
      console.error("Error deactivating entertainment group:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Simple stream stop handler
  ipcMain.handle('hue:stopDTLSStream', async (_, data) => {
    console.log("➡️ hue:stopDTLSStream called with data:", data);
    return { success: true, message: 'DTLS stream stopped successfully (simulated)' };
  });

  // Simple status check handler
  ipcMain.handle('hue:isDTLSStreaming', async (_, data) => {
    console.log("➡️ hue:isDTLSStreaming called with data:", data);
    return { success: true, isStreaming: false };
  });

  console.log("✅ Direct Hue IPC handlers initialized. Checking registrations...");

  // Verify all handlers are registered
  [
    'hue:activateEntertainmentGroup',
    'hue:startDTLSStream',
    'hue:sendDTLSColor',
    'hue:deactivateEntertainmentGroup',
    'hue:stopDTLSStream',
    'hue:isDTLSStreaming'
  ].forEach(channel => {
    const registered = ipcMain.listenerCount(channel) > 0;
    console.log(`${registered ? '✅' : '❌'} ${channel}: ${registered ? 'Registered' : 'NOT REGISTERED!'}`);
  });
}

// Simplified cleanup function
export function cleanupDirectHueHandlers() {
  console.log('🧹 Cleaning up Direct Hue handlers');
  // No active connections to clean up in this simplified version
}
