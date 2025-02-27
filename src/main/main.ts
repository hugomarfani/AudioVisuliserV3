/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { exec, spawn } from 'child_process';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import initDatabase from '../database/init';
import { UserDB } from '../database/models/User';
import { db } from '../database/config';
import { Song, saveSongAsJson } from '../database/models/Song';
import { downloadYoutubeAudio } from '../youtube/youtubeToMP3';
import {
  downloadYoutubeAudio as downloadYoutubeAudioWav,
  getYoutubeMetadata,
} from '../youtube/youtubeToWav';
import axios from 'axios';
import https from 'https';
import bonjour from 'bonjour';
import net from 'net';
import * as hueApi from 'node-hue-api'; // Import entire module
const { v3 } = hueApi; // Extract v3

// Change these to mutable variables so they can be updated
let currentHueBridgeIP = process.env.HUE_BRIDGE_IP || ''; // default IP
let currentHueUsername = process.env.HUE_USERNAME || '';

// Create an HTTPS agent that ignores invalid certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const ps1Path = path.join(
  app.getAppPath(),
  'AiResources/openvino_2025/setupvars.ps1',
);
const exePath = path.join(app.getAppPath(), 'test.exe');

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('user:create', async (_, user) => {
  return UserDB.create(user);
});

ipcMain.handle('user:getAll', async () => {
  return UserDB.getAll();
});

ipcMain.handle('user:getById', async (_, id) => {
  return UserDB.getById(id);
});

ipcMain.handle('user:update', async (_, user) => {
  return UserDB.update(user);
});

ipcMain.handle('user:delete', async (_, id) => {
  return UserDB.delete(id);
});

ipcMain.handle('fetch-songs', async () => {
  try {
    const songs = await Song.findAll({
      order: [['createdAt', 'DESC']],
    });
    console.log('Fetched songs:', JSON.stringify(songs, null, 2));
    return songs;
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
});

ipcMain.handle('add-song', async (_event, songData) => {
  try {
    const song = await Song.create(songData);
    return song;
  } catch (error) {
    console.error('Error adding song:', error);
    throw error;
  }
});

ipcMain.handle('merge-asset-path', async (_, pathToAdd) => {
  return path.join(app.getAppPath(), 'assets', pathToAdd);
});

ipcMain.handle('reload-songs', async () => {
  try {
    initDatabase();
    const songs = await Song.findAll({
      order: [['createdAt', 'DESC']],
    });
    console.log('Reloaded songs:', JSON.stringify(songs, null, 2));
    return songs;
  } catch (error) {
    console.error('Error reloading songs:', error);
    throw error;
  }
});

// ipcMain.handle("download-mp3", async (event, url) => {
//   try {
//     const result = await downloadYoutubeAudio(url);
//     return result;
//   } catch (error) {
//     console.error("Error in download-mp3 handler:", error);
//     throw error;
//   }
// });

ipcMain.handle('download-wav', async (_, url) => {
  try {
    const id = await downloadYoutubeAudioWav(url);
    const { title, artist } = await getYoutubeMetadata(url);
    console.log(
      `Downloaded WAV with id: ${id}, title: ${title}, artist: ${artist}`,
    );
    // create song entry in database
    // temporarily assign random status
    const statuses = ['Blue', 'Yellow', 'Red', 'Green'];
    const randomStatus: 'Blue' | 'Yellow' | 'Red' | 'Green' = statuses[
      Math.floor(Math.random() * statuses.length)
    ] as 'Blue' | 'Yellow' | 'Red' | 'Green';

    const song = await Song.create({
      id: id,
      title: title,
      uploader: artist,
      audioPath: 'audio/' + id + '.wav',
      jacket: 'assets/icon.png',
      images: [],
      moods: [],
      status: randomStatus,
      colours: [],
      colours_reason: [],
      objects: [],
      object_prompts: [],
      backgrounds: [],
      background_prompts: [],
      particles: [],
    });
    saveSongAsJson(song);
    console.log('Song entry created:', song);
    return id;
  } catch (error) {
    console.error('Error in download-wav handler:', error);
    throw error;
  }
});

ipcMain.handle('run-whisper', (event, songId) => {
  console.log('Running whisper with songId:', songId);
  const process = spawn('powershell', [
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `& { . '${ps1Path}'; & ${exePath} -w --song ${songId}; }`,
  ]);
  process.stdout.on('data', (data) => {
    console.log(`📜 stdout: ${data.toString()}`);
  });
  process.stderr.on('data', (data) => {
    console.error(`⚠️ stderr: ${data.toString()}`);
    throw new Error(data.toString());
  });
  process.on('close', (code) => {
    console.log(`✅ Process exited with code ${code}`);
    return code;
  });
});

ipcMain.handle('run-gemma', (event, songId: string) => {
  console.log('Running Gemma with songId:', songId);
  const process = spawn('powershell', [
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `& { . '${ps1Path}'; & ${exePath} -l -s ${songId} --all; }`,
  ]);
  process.stdout.on('data', (data) => {
    console.log(`📜 stdout: ${data.toString()}`);
  });
  process.stderr.on('data', (data) => {
    console.error(`⚠️ stderr: ${data.toString()}`);
  });
  process.on('close', (code) => {
    console.log(`✅ Process exited with code ${code}`);
    return code;
  });
});

ipcMain.on('run-gemma-test', (event) => {
  console.log(`Running Gemma test with ${ps1Path} and ${exePath}`);

  const gemmaCommand = `${exePath} -l --all `;

  // running using spawn -> real time output
  const process = spawn('powershell', [
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `& { . '${ps1Path}'; & ${gemmaCommand} ;}`,
  ]);

  process.stdout.on('data', (data) => {
    console.log(`📜 stdout: ${data.toString()}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`⚠️ stderr: ${data.toString()}`);
  });

  process.on('close', (code) => {
    console.log(`✅ Process exited with code ${code}`);
    event.reply('run-gemma-test-reply', `Process exited with code ${code}`);
  });
});


// Phillips Hue Controls

// Updated Handler to turn on a specified light by ID
ipcMain.handle('hue:turnOn', async (_event, lightId: string) => {
  const url = `https://${currentHueBridgeIP}/clip/v2/resource/light/${lightId}`;
  const payload = { on: { on: true } };
  // Log details for manual testing in Postman
  console.log("POSTMAN TEST - Turn On Light:");
  console.log("Method: PUT");
  console.log("URL:", url);
  console.log("Headers:", { 'hue-application-key': currentHueUsername });
  console.log("Payload:", payload);

  try {
    const response = await axios.put(url, payload, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent,
    });
    console.log(`Turned on light ${lightId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error turning on light ${lightId}:`, error);
    throw error;
  }
});

// Updated Handler to turn off a specified light by ID
ipcMain.handle('hue:turnOff', async (_event, lightId: string) => {
  const url = `https://${currentHueBridgeIP}/clip/v2/resource/light/${lightId}`;
  const payload = { on: { on: false } };
  // Log details for manual testing in Postman
  console.log("POSTMAN TEST - Turn Off Light:");
  console.log("Method: PUT");
  console.log("URL:", url);
  console.log("Headers:", { 'hue-application-key': currentHueUsername });
  console.log("Payload:", payload);

  try {
    const response = await axios.put(url, payload, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent,
    });
    console.log(`Turned off light ${lightId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error turning off light ${lightId}:`, error);
    throw error;
  }
});

// Update the getLightRids function to use CLIP v2 API
async function getLightRids(): Promise<string[]> {
  try {
    // Use CLIP v2 API to get lights
    const response = await axios.get(`https://${currentHueBridgeIP}/clip/v2/resource/light`, {
      headers: {
        'hue-application-key': currentHueUsername
      },
      httpsAgent
    });

    // Extract the UUIDs from the response
    const lights = response.data.data || [];
    return lights.map((light: any) => light.id);
  } catch (error) {
    console.error('Error getting light RIDs:', error);
    throw error;
  }
}

// Add a function to validate credentials
async function validateStoredCredentials(): Promise<boolean> {
  if (!currentHueBridgeIP || !currentHueUsername) return false;

  try {
    const api = await v3.api.createLocal(currentHueBridgeIP).connect(currentHueUsername);
    await api.configuration.getConfiguration();
    return true;
  } catch (error) {
    console.error('Stored credentials validation failed:', error);
    return false;
  }
}

// Updated IPC handler to retrieve light RIDs using getHueApi helper function
ipcMain.handle('hue:getLightRids', async () => {
  try {
    const api = await getHueApi();
    const lights = await api.lights.getAll();
    let rids = lights.map(light => light.id);
    // If all IDs are numeric, fall back to CLIP v2 API
    if (rids.every(id => /^\d+$/.test(String(id)))) {
      console.warn("V3 API returned numeric IDs, falling back to CLIP v2 API");
      rids = await getLightRids();
    }
    console.log('Light RIDs:', rids);
    return rids;
  } catch (error) {
    console.error('Error retrieving light RIDs:', error);
    // Return an empty array so the renderer does not crash
    return [];
  }
});

// Function to get an authorization key by calling /api on the bridge
async function getAuthorizationKey(bridgeIp: string): Promise<string> {
  // Post a devicetype; user must press the link button on the bridge first
  const url = `http://${bridgeIp}/api`;
  const payload = { devicetype: 'my_hue_app#electron' };
  const response = await axios.post(url, payload);
  // Expecting a response array, e.g. [{ success: { username: "newusername" } }]
  const result = response.data;
  if (Array.isArray(result) && result[0]?.success?.username) {
    return result[0].success.username;
  }
  throw new Error('Failed to obtain authorization key from the Hue Bridge.');
}

// mDNS discovery for Hue Bridge
async function discoverBridge(): Promise<string | null> {
  return new Promise((resolve) => {
    const b = bonjour();
    console.log('Starting bonjour discovery for service type: _hue._tcp');

    // Start looking for _hue._tcp services
    const browser = b.find({ type: '_hue._tcp' });

    let found = false;

    // When a service goes "up", it has been discovered
    browser.on('up', (service) => {
      console.log('Service found:', service);

      // We can look for an IPv4 address explicitly
      if (service.addresses && service.addresses.length > 0) {
        const ipv4 = service.addresses.find((addr) => net.isIPv4(addr));
        if (ipv4) {
          console.log('Using IPv4 address:', ipv4);
          found = true;
          browser.stop();
          b.destroy();
          resolve(ipv4);
        }
      }
    });

    // Fallback if no service is discovered within 10 seconds
    setTimeout(() => {
      if (!found) {
        console.warn('Timeout reached, no bridge discovered');
        browser.stop();
        b.destroy();
        resolve(null);
      }
    }, 10000);
  });
}

// Updated helper function to get a connected Hue API instance
async function getHueApi() {
  if (currentHueBridgeIP && currentHueUsername) {
    try {
      const api = await v3.api.createLocal(currentHueBridgeIP).connect(currentHueUsername);
      await api.configuration.getConfiguration();
      return api;
    } catch (error) {
      // If stored credentials fail, fall through to discovery
      console.error('Stored credentials failed:', error);
    }
  }

  // Only perform discovery if we don't have working credentials
  const discoveredBridges = await v3.discovery.nupnpSearch();
  if (discoveredBridges.length === 0) {
    throw new Error('No Hue Bridge found');
  }
  console.log("Discovered Bridges:", discoveredBridges);
  console.log("Discovered Bridge IPs:", discoveredBridges.map(bridge => bridge.ipaddress));

  const errors: string[] = [];
  for (const bridge of discoveredBridges) {
    try {
      currentHueBridgeIP = bridge.ipaddress;
      let api;
      if (!currentHueUsername) {
        api = await v3.api.createLocal(currentHueBridgeIP).connect();
        const createdUser = await api.users.createUser('my_hue_app', 'electron');
        currentHueUsername = createdUser.username;
      }
      api = await v3.api.createLocal(currentHueBridgeIP).connect(currentHueUsername);
      await api.configuration.getConfiguration();
      return api;
    } catch (err: any) {
      // Check if error indicates a rate limit (HTTP 429)
      if ((err.response && err.response.status === 429) || err.message.includes("429")) {
        throw new Error("Too many requests - please wait a few minutes before trying again.");
      }
      errors.push(`Bridge ${bridge.ipaddress}: ${err.message}`);
    }
  }
  throw new Error(`All discovered bridges failed: ${errors.join(', ')}`);
}

// Update the discover bridge handler to check credentials first
ipcMain.handle('hue:discoverBridge', async () => {
  // If we have valid credentials, return the current IP without discovery
  if (await validateStoredCredentials()) {
    console.log('Using existing credentials, skipping discovery');
    return currentHueBridgeIP;
  }

  // Only perform discovery if validation failed
  try {
    const api = await getHueApi();
    console.log('New bridge discovered and connected. Bridge IP:', currentHueBridgeIP);
    return currentHueBridgeIP;
  } catch (error) {
    console.error('Error in hue:discoverBridge:', error);
    throw error;
  }
});

ipcMain.handle('hue:setManualBridge', async (_event, manualIp: string) => {
  try {
    currentHueBridgeIP = manualIp;
    // Always create a new user when manually setting the bridge
    let api = await v3.api.createLocal(manualIp).connect();
    const createdUser = await api.users.createUser('my_hue_app', 'electron');
    currentHueUsername = createdUser.username;
    // Reconnect using the new username
    api = await v3.api.createLocal(manualIp).connect(currentHueUsername);
    await api.configuration.getConfiguration();
    console.log("Manual bridge set successfully. Bridge IP:", currentHueBridgeIP, "Username:", currentHueUsername);
    return { ip: currentHueBridgeIP, username: currentHueUsername };
  } catch (error) {
    console.error('Error setting manual bridge IP:', error);
    throw error;
  }
});

ipcMain.handle('hue:setCredentials', async (_, credentials: { ip: string; username: string }) => {
  try {
    currentHueBridgeIP = credentials.ip;
    currentHueUsername = credentials.username;

    // Validate the credentials immediately
    const isValid = await validateStoredCredentials();
    if (!isValid) {
      // If validation fails, clear the credentials
      currentHueBridgeIP = '';
      currentHueUsername = '';
      throw new Error('Invalid credentials');
    }

    console.log('Credentials set successfully:', { ip: currentHueBridgeIP, username: currentHueUsername });
    return true;
  } catch (error) {
    console.error('Error setting credentials:', error);
    throw error;
  }
});

// Updated IPC handler to get light details using the CLIP v2 API
ipcMain.handle('hue:getLightDetails', async () => {
  try {
    const response = await axios.get(`https://${currentHueBridgeIP}/clip/v2/resource/light`, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent,
      timeout: 5000
    });
    const lights = response.data.data || [];
    return lights.map((light: any) => ({
      id: light.id,
      name: light.metadata?.name || 'Unknown',
      on: light.on?.on || false,
      brightness: light.dimming?.brightness || 0,
      xy: (light.color && light.color.xy) ? light.color.xy : [0, 0]
    }));
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error("403 Unauthorized: Check your Hue Bridge App Key.");
      throw new Error("Unauthorized: Please ensure your Hue Bridge App Key is correct.");
    }
    console.error('Error in hue:getLightDetails handler:', error.message);
    throw error;
  }
});

// New IPC handler to set light state using CLIP v2 API directly
ipcMain.handle('hue:setLightState', async (_event, { lightId, on, brightness, xy }: { lightId: string, on?: boolean, brightness?: number, xy?: number[] }) => {
  const url = `https://${currentHueBridgeIP}/clip/v2/resource/light/${lightId}`;
  const state: any = {};
  if (on !== undefined) state.on = { on };
  if (brightness !== undefined) state.dimming = { brightness };
  if (xy && xy.length === 2) {
    state.color = {
      xy: { x: xy[0], y: xy[1] },
      mode: 'xy'
    };
    console.log(`🖌️ Setting light ${lightId} color to: x=${xy[0]}, y=${xy[1]} with mode "xy"`);
  }
  // Log details for manual testing in Postman:
  console.log("POSTMAN TEST - Set Light State:");
  console.log("Method: PUT");
  console.log("URL:", url);
  console.log("Headers:", { 'hue-application-key': currentHueUsername });
  console.log("Payload:", state);
  console.log("POSTMAN REQUEST BODY:", JSON.stringify(state, null, 2));

  try {
    const response = await axios.put(url, state, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent
    });
    console.log(`✅ Light ${lightId} updated successfully. Response:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error setting state for light ${lightId}:`, error);
    if (error.response && error.response.data) {
      console.error(`💥 Bridge response:`, error.response.data);
    }
    throw error;
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    title: 'App (Database: Initializing...)',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      webSecurity: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    try {
      await initDatabase();
      console.log('✨ Database system ready!');
      if (mainWindow) {
        mainWindow.setTitle('App (Database: Connected)');
      }
    } catch (error) {
      console.error('💥 Failed to initialize database:', error);
      if (mainWindow) {
        mainWindow.setTitle('App (Database: Error)');
      }
    }

    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

app.on('before-quit', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
});
