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
    const song = await Song.create({
      id: id,
      title: title,
      uploader: 'assets',
      audioPath: 'assets/' + id + '.wav',
      images: [],
      moods: [],
      colours: [],
      colours_reason: [],
      objects: [],
      objects_prompts: [],
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

  // // Run PowerShell and execute both commands in the same session
  // const command = `powershell -ExecutionPolicy Bypass -NoExit -Command "& { . '${ps1Path}'; & '${exePath}' }"`;

  // exec(command, (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`Error running script: ${error.message}`);
  //     event.reply('run-gemma-test-reply', `Error: ${error.message}`);
  //     return;
  //   }
  //   if (stderr) {
  //     console.error(`PowerShell Stderr: ${stderr}`);
  //     event.reply('run-gemma-test-reply', `Stderr: ${stderr}`);
  //     return;
  //   }

  //   console.log(`PowerShell Output: ${stdout}`);
  //   event.reply('run-gemma-test-reply', stdout);
  // });
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
