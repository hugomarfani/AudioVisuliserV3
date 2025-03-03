/**
 * IPC handlers for Hue DTLS communication
 * This enables direct DTLS communication with the Hue Bridge from Electron's main process
 */

import { ipcMain } from 'electron';
import * as dgram from 'dgram';
import * as dtls from 'node-dtls-client';
import * as crypto from 'crypto';

// Store the DTLS socket globally so it can be shared across calls
let dtlsSocket: any = null;
let isConnected = false;
let currentGroupId: string | null = null;

export function initializeHueDTLSHandlers() {
  /**
   * Set configuration for DTLS connection
   */
  ipcMain.handle('hue:dtls-set-config', async (event, config) => {
    try {
      console.log('Setting DTLS config:', {
        address: config.address,
        username: config.username,
        hasClientKey: !!config.clientKey
      });

      // Just store the config for now, don't connect yet
      return { success: true };
    } catch (error) {
      console.error('Error setting DTLS config:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Check if we have a valid configuration for DTLS
   */
  ipcMain.handle('hue:dtls-has-valid-config', async (event, config) => {
    // Simple validation of required fields
    const valid = !!(config?.address && config?.username && config?.clientKey);
    return { valid };
  });

  /**
   * Connect to the bridge via DTLS and activate the entertainment group
   */
  ipcMain.handle('hue:dtls-connect', async (event, config) => {
    try {
      if (dtlsSocket) {
        // Close existing connection first
        try {
          dtlsSocket.close();
        } catch (e) {
          console.warn('Error closing existing socket:', e);
        }
        dtlsSocket = null;
      }

      console.log('Connecting to Hue bridge via DTLS:', {
        address: config.address,
        port: 2100,
        groupId: config.groupId
      });

      // First, activate the entertainment group using REST API
      try {
        console.log('Activating entertainment group...');
        // Set group to active
        const activateResponse = await fetch(
          `https://${config.address}/clip/v2/resource/entertainment_configuration/${config.groupId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'hue-application-key': config.username
            },
            body: JSON.stringify({
              action: 'start'
            })
          }
        );

        if (!activateResponse.ok) {
          throw new Error(`Failed to activate group: ${activateResponse.status}`);
        }

        console.log('Entertainment group activated successfully');
        currentGroupId = config.groupId;
      } catch (err) {
        console.error('Error activating entertainment group:', err);
        // Continue anyway, the DTLS connection might still work
      }

      // Set up DTLS connection
      // NOTE: This is a simplified implementation - in reality, you would use a proper DTLS library
      console.log('Setting up DTLS connection');

      // Basic success response for testing
      return {
        success: true,
        message: 'DTLS connection established (mock implementation)'
      };
    } catch (error) {
      console.error('Error connecting via DTLS:', error);
      isConnected = false;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * Disconnect from the bridge
   */
  ipcMain.handle('hue:dtls-disconnect', async (event) => {
    try {
      if (dtlsSocket) {
        console.log('Closing DTLS connection');
        dtlsSocket.close();
        dtlsSocket = null;
      }

      // Deactivate the entertainment group if we have one active
      if (currentGroupId) {
        // Implementation for deactivating the group would go here
        currentGroupId = null;
      }

      isConnected = false;
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting DTLS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * Check if we're connected
   */
  ipcMain.handle('hue:dtls-is-connected', async (event) => {
    return { connected: isConnected };
  });

  /**
   * Send colors to the bridge
   */
  ipcMain.handle('hue:dtls-send-colors', async (event, data) => {
    try {
      if (!dtlsSocket || !isConnected) {
        return { success: false, error: 'Not connected' };
      }

      const { indices, rgb } = data;

      console.log(`Sending RGB ${rgb.join(',')} to indices ${indices.join(',')}`);

      // This would be replaced with actual DTLS message sending
      return { success: true };
    } catch (error) {
      console.error('Error sending colors via DTLS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * Run a test sequence of colors
   */
  ipcMain.handle('hue:dtls-test-sequence', async (event) => {
    try {
      if (!dtlsSocket || !isConnected) {
        return { success: false, error: 'Not connected' };
      }

      console.log('Running test sequence...');

      const colors: [number, number, number][] = [
        [1, 0, 0],   // Red
        [0, 1, 0],   // Green
        [0, 0, 1],   // Blue
        [1, 1, 0],   // Yellow
        [0, 1, 1],   // Cyan
        [1, 0, 1],   // Magenta
        [1, 1, 1],   // White
        [0, 0, 0]    // Black/Off
      ];

      // This would be replaced with actual color sending

      return { success: true };
    } catch (error) {
      console.error('Error running test sequence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
}
