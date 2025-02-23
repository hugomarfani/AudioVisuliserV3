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

const HUE_BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.37'; // change to your actual IP
const HUE_USERNAME = process.env.HUE_USERNAME || '-nUQmRphqf5UBxZswMQIqiUH912baNXN9fhtAYc8';

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
  const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light/${lightId}`;
  try {
    const response = await axios.put(url, {
      on: { on: true }
    }, {
      headers: { 'hue-application-key': HUE_USERNAME },
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
  const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light/${lightId}`;
  try {
    const response = await axios.put(url, {
      on: { on: false }
    }, {
      headers: { 'hue-application-key': HUE_USERNAME },
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
  const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/device`;
  const response = await axios.get(url, { headers: { 'hue-application-key': HUE_USERNAME }, httpsAgent });
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
