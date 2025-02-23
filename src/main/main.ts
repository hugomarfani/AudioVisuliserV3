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
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import initDatabase from '../database/init';
import { UserDB } from '../database/models/User';
import { db } from '../database/config';
import Song from '../database/models/Song';
import axios from 'axios';
import https from 'https';
import bonjour from 'bonjour';
import net from 'net';
import { v3, LightState } from 'node-hue-api';

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
      order: [['createdAt', 'DESC']]
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


// Phillips Hue Controls

// Updated Handler to turn on a specified light by ID
ipcMain.handle('hue:turnOn', async (_event, lightId: string) => {
  const url = `https://${currentHueBridgeIP}/clip/v2/resource/light/${lightId}`;
  try {
    const response = await axios.put(url, {
      on: { on: true }
    }, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent, // use custom agent
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
  try {
    const response = await axios.put(url, {
      on: { on: false }
    }, {
      headers: { 'hue-application-key': currentHueUsername },
      httpsAgent, // use custom agent
    });
    console.log(`Turned off light ${lightId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error turning off light ${lightId}:`, error);
    throw error;
  }
});

// Function to get light RIDs from Hue devices
async function getLightRids(): Promise<string[]> {
  const url = `https://${currentHueBridgeIP}/clip/v2/resource/device`;
  const response = await axios.get(url, { headers: { 'hue-application-key': currentHueUsername }, httpsAgent });
  const lightRids: string[] = [];
  for (const device of response.data.data) {
    // Check each service for rtype "light"
    for (const service of device.services) {
      if (service.rtype === 'light') {
        lightRids.push(service.rid);
      }
    }
  }
  return lightRids;
}

// IPC handler to retrieve light RIDs
ipcMain.handle('hue:getLightRids', async () => {
  try {
    const rids = await getLightRids();
    console.log('Light RIDs:', rids);
    return rids;
  } catch (error) {
    console.error('Error retrieving light RIDs:', error);
    throw error;
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

// Updated helper function to get a connected Hue API instance with extra logging
async function getHueApi() {
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

ipcMain.handle('hue:discoverBridge', async () => {
  try {
    // Use the getHueApi function to perform discovery and connection
    const api = await getHueApi();
    console.log('getHueApi successfully connected. Bridge IP:', currentHueBridgeIP);
    return currentHueBridgeIP;
  } catch (error) {
    console.error('Error in hue:discoverBridge via getHueApi:', error);
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
