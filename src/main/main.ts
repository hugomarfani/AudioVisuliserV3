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
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { exec, spawn, execSync } from 'child_process';
import os from 'os';
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
import { mainPaths, getResourcePath } from './paths';
import { registerImageHandlers } from './ipc/imageHandlers';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const ps1Path = mainPaths.ps1Path;
const exePath = mainPaths.llmWhisperPath;
const SDPath = mainPaths.SDPath;

registerImageHandlers();

// Define the possible progress steps for tracking
const progressSteps = {
  whisper: 'Finished Whisper',
  llm: 'Finished LLM',
  stableDiffusion: 'Finished Stable Diffusion',
  aiSetup: 'Finished AI Setup',
  statusExtraction: 'Finished Status Extraction',
  colourExtraction: 'Finished Colour Extraction',
  particleExtraction: 'Finished Particle Extraction',
  objectExtraction: 'Finished Object Extraction',
  backgroundExtraction: 'Finished Background Extraction',
  objectPrompts: 'Finished Object Prompts',
  backgroundPrompts: 'Finished Background Prompts',
  jsonStorage: 'Finished Json Storage',
  imageBack1: 'Finished background_prompts_1',
  imageBack2: 'Finished background_prompts_2',
  imageBack3: 'Finished background_prompts_3',
  imageObj1: 'Finished object_prompts_1',
  imageObj2: 'Finished object_prompts_2',
  imageObj3: 'Finished object_prompts_3',
};

// Helper function to parse stdout and track progress
function trackProgressFromStdout(data: Buffer, sender: Electron.WebContents, operationId: string) {
  const output = data.toString();
  console.log(`📜 stdout: ${output}`);
  
  // Check for each progress step
  Object.entries(progressSteps).forEach(([key, message]) => {
    if (output.includes(message)) {
      const progressData = { 
        operationId,
        step: key,
        message: message,
        completed: true
      };
      console.log("Sending progress update:", progressData);
      // Send with explicit event name
      sender.send('ai-progress-update', progressData);
    }
  });
}

// Track active child processes
const activeProcesses: { [key: string]: ReturnType<typeof spawn> } = {};

// General purpose function to run AI processes with tracking
function runAIProcessWithTracking(
  command: string,
  args: string[],
  sender: Electron.WebContents,
  operationId: string,
  expectedSteps: string[]
) {
  // Initialize all expected steps as not completed
  expectedSteps.forEach(step => {
    const progressData = {
      operationId,
      step,
      message: `Waiting for ${step}...`,
      completed: false
    };
    console.log("Sending initial step:", progressData);
    // Use explicit event name
    sender.send('ai-progress-update', progressData);
  });

  // Start the process
  const process = spawn(command, args);
  
  // Store the process with its operationId
  activeProcesses[operationId] = process;
  
  process.stdout.on('data', (data) => {
    trackProgressFromStdout(data, sender, operationId);
  });
  
  process.stderr.on('data', (data) => {
    const errorMessage = data.toString();
    console.error(`⚠️ stderr: ${errorMessage}`);
    const errorData = {
      operationId,
      error: errorMessage
    };
    console.log("Sending error:", errorData);
    sender.send('ai-error', errorData);
  });
  
  process.on('close', (code) => {
    console.log(`✅ Process exited with code ${code}`);
    const completeData = {
      operationId,
      exitCode: code
    };
    console.log("Sending process complete:", completeData);
    sender.send('ai-process-complete', completeData);
    
    // Remove from active processes when done
    delete activeProcesses[operationId];
    
    return code;
  });
}

ipcMain.on('reload-window', (event) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.reload();
});

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
    // console.log('Fetched songs:', JSON.stringify(songs, null, 2));
    return songs;
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
});

// In your main.ts or preload.ts
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg'] }]
  });
  return result;
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
  return getResourcePath('assets',pathToAdd);
});

ipcMain.handle('reload-songs', async () => {
  try {
    await initDatabase();
    // const songs = await Song.findAll({
    //   order: [['createdAt', 'DESC']],
    // });
    // console.log('Reloaded songs:', JSON.stringify(songs, null, 2));
    // return songs;
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

ipcMain.handle('redownload-mp3', async (_, songId) => {
  try {
    const url = "https://www.youtube.com/watch?v=" + songId;
    const id = await downloadYoutubeAudioWav(url, true);
    // const { title, artist, thumbnailPath } = await getYoutubeMetadata(url);
    // console.log(
    //   `Redownloaded WAV with id: ${id}, title: ${title}, artist: ${artist}, thumbnail: ${thumbnailPath}`,
    // );
    return id;
  } catch (error) {
    console.error('Error in redownload-wav handler:', error);
    throw error;
  }
});

ipcMain.handle('download-wav', async (_, url) => {
  try {
    const id = await downloadYoutubeAudioWav(url, false);
    const { title, artist, thumbnailPath } = await getYoutubeMetadata(url);
    console.log(
      `Downloaded WAV with id: ${id}, title: ${title}, artist: ${artist}, thumbnail: ${thumbnailPath}`,
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
      audioPath: 'audio/' + id + '.mp3',
      jacket: thumbnailPath, // Use the downloaded thumbnail path instead of icon.png
      images: [thumbnailPath],
      moods: [],
      status: randomStatus,
      colours: [],
      colours_reason: [],
      objects: [],
      object_prompts: [],
      backgrounds: [],
      background_prompts: [],
      particles: [],
      particleColour: ["255", "255", "255"],
      shaderBackground: '',
      shaderTexture: '',
      // shaderBackground: 'shader/background/'+ id + '.jpg',
      // shaderTexture: 'shader/texture/'+ id + '.jpg',
    });
    saveSongAsJson(song);
    console.log('Song entry created:', song);
    return id;
  } catch (error) {
    console.error('Error in download-wav handler:', error);
    throw error;
  }
});

// Replace existing run-whisper handler
ipcMain.handle('run-whisper', (event, songId, operationId = null) => {
  console.log('Running whisper with songId:', songId, "with exePath:", exePath);
  
  // Use the provided operationId or generate one if not provided
  const actualOperationId = operationId || `whisper-${songId}-${Date.now()}`;
  console.log(`Using operationId: ${actualOperationId}`);
  
  const expectedSteps = ['aiSetup', 'whisper'];
  
  runAIProcessWithTracking(
    'powershell',
    [
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { . '${ps1Path}'; & ${exePath} -e -w --song ${songId}; }`,
    ],
    event.sender,
    actualOperationId,
    expectedSteps
  );
  
  return actualOperationId;
});

// Add the function to build Gemma command with options
function buildGemmaCommand(songId: string, options: Record<string, boolean>) {
  let command = `${exePath} -e -l -s ${songId}`;
  
  // Add flags based on options
  if (options.extractColour) command += ' -c';
  if (options.extractParticle) command += ' -p';
  if (options.extractObject) command += ' -o';
  if (options.extractBackground) command += ' -b';
  if (options.generateObjectPrompts) command += ' --generateObjectPrompts';
  if (options.generateBackgroundPrompts) command += ' --generateBackgroundPrompts';
  if (options.extractStatus) command += ' --status';
  if (options.all) command += ' --all';
  
  if (options.rerunWhisper) command = `${exePath} -e -w -s ${songId}`;
  return command;
}

// Keep the existing simple Gemma handler (without options) for backward compatibility
ipcMain.handle('run-gemma', (event, songId, operationId = null) => {
  console.log('Running Gemma with songId:', songId);
  
  // Use the provided operationId or generate one if not provided
  const actualOperationId = operationId || `gemma-${songId}-${Date.now()}`;
  console.log(`Using operationId: ${actualOperationId}`);
  
  const expectedSteps = [
    'aiSetup', 
    'statusExtraction', 'colourExtraction', 'particleExtraction', 
    'objectExtraction', 'backgroundExtraction', 
    'objectPrompts', 'backgroundPrompts', 
    'jsonStorage', 'llm'
  ];
  
  runAIProcessWithTracking(
    'powershell',
    [
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { . '${ps1Path}'; & ${exePath} -e -l -s ${songId} --all; }`,
    ],
    event.sender,
    actualOperationId,
    expectedSteps
  );
  
  return actualOperationId;
});

// Add new handler with options
ipcMain.handle('run-gemma-with-options', (event, { songId, options, operationId = null }) => {
  console.log('Running Gemma with options:', songId, options);
  
  const command = buildGemmaCommand(songId, options);
  
  // Use the provided operationId or generate one if not provided
  const actualOperationId = operationId || `gemma-options-${songId}-${Date.now()}`;
  console.log(`Using operationId: ${actualOperationId}`);
  
  // Determine which steps to expect based on the options
  const expectedSteps = ['aiSetup'];
  
  if (options.rerunWhisper) {
    expectedSteps.push('whisper');
  }
  if (options.extractColour || options.all) {
    expectedSteps.push('colourExtraction');
  }
  if (options.extractParticle || options.all) {
    expectedSteps.push('particleExtraction');
  }
  if (options.extractObject || options.all) {
    expectedSteps.push('objectExtraction');
  }
  if (options.extractBackground || options.all) {
    expectedSteps.push('backgroundExtraction');
  }
  if (options.generateObjectPrompts || options.all) {
    expectedSteps.push('objectPrompts');
  }
  if (options.generateBackgroundPrompts || options.all) {
    expectedSteps.push('backgroundPrompts');
  }
  if (options.extractStatus || options.all) {
    expectedSteps.push('statusExtraction');
  }

  expectedSteps.push('jsonStorage');
  expectedSteps.push('llm');
  
  runAIProcessWithTracking(
    'powershell',
    [
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { . '${ps1Path}'; & ${command}; }`,
    ],
    event.sender,
    actualOperationId,
    expectedSteps
  );
  
  return actualOperationId;
});

// Add the Stable Diffusion handler
ipcMain.handle('run-stable-diffusion', (event, songId: string, operationId = null) => {
  console.log('Running Stable Diffusion with songId:', songId);
  
  const sdPathStr = SDPath.toString();
  
  // Use the provided operationId or generate one if not provided
  const actualOperationId = operationId || `sd-${songId}-${Date.now()}`;
  console.log(`Using operationId: ${actualOperationId}`);
  
  // const expectedSteps = ['stableDiffusion', 'jsonStorage'];
  const expectedSteps = ['aiSetup', 'imageBack1', 'imageBack2', 'imageBack3', 
    'imageObj1', 'imageObj2', 'imageObj3', 'stableDiffusion'];
  
  runAIProcessWithTracking(
    'powershell',
    [
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { . '${ps1Path}'; & ${sdPathStr} -e --songId ${songId}; }`,
    ],
    event.sender,
    actualOperationId,
    expectedSteps
  );
  
  return actualOperationId;
});

ipcMain.on('run-gemma-test', (event) => {
  console.log(`Running Gemma test with ${ps1Path} and ${exePath}`);

  const gemmaCommand = `${exePath} -e -l --all `;

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

// Common ports used by the application
const appPorts = [
  1212 
];

// Function to terminate all active processes
function terminateAllProcesses() {
  // First kill all tracked child processes
  Object.entries(activeProcesses).forEach(([id, process]) => {
    console.log(`Terminating process: ${id}`);
    try {
      if (process.killed === false) {
        // Force kill to ensure termination
        if (process.platform === 'win32') {
          // On Windows, use taskkill to forcefully terminate
          try {
            execSync(`taskkill /pid ${process.pid} /T /F`, { stdio: 'ignore' });
          } catch (e) {
            // If taskkill fails, try the standard kill
            process.kill('SIGKILL');
          }
        } else {
          // On Unix-like systems
          process.kill('SIGKILL');
        }
      }
    } catch (err) {
      console.error(`Error killing process ${id}:`, err);
    }
  });
  
  // Clean up ports used by the application
  cleanupPorts();
}

// Function to clean up ports
function cleanupPorts() {
  console.log('Cleaning up ports...');
  
  try {
    if (process.platform === 'win32') {
      // Windows
      appPorts.forEach(port => {
        try {
          console.log(`Checking port ${port}...`);
          // Find process using this port
          const findCmd = `netstat -ano | findstr :${port}`;
          let output;
          
          try {
            output = execSync(findCmd, { encoding: 'utf8' });
          } catch (e) {
            // No process using this port, which is fine
            return;
          }
          
          if (output) {
            const lines = output.split('\n');
            const pids = new Set();
            
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 4) {
                const pid = parts[4];
                if (/^\d+$/.test(pid)) {
                  pids.add(pid);
                }
              }
            });
            
            // Kill each process found
            pids.forEach(pid => {
              console.log(`Killing process ${pid} using port ${port}`);
              try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                console.log(`Successfully terminated PID ${pid}`);
              } catch (killError) {
                console.error(`Failed to kill process ${pid}:`, killError);
              }
            });
          }
        } catch (error) {
          console.error(`Error checking port ${port}:`, error);
        }
      });
    } else if (process.platform === 'darwin') {
      // macOS
      appPorts.forEach(port => {
        try {
          console.log(`Checking port ${port}...`);
          // Find process using this port
          const cmd = `lsof -i :${port} -t`;
          let pids;
          
          try {
            pids = execSync(cmd, { encoding: 'utf8' }).trim();
          } catch (e) {
            // No process using this port
            return;
          }
          
          if (pids) {
            pids.split('\n').forEach(pid => {
              if (pid) {
                console.log(`Killing process ${pid} using port ${port}`);
                try {
                  execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                  console.log(`Successfully terminated PID ${pid}`);
                } catch (killError) {
                  console.error(`Failed to kill process ${pid}:`, killError);
                }
              }
            });
          }
        } catch (error) {
          console.error(`Error checking port ${port}:`, error);
        }
      });
    } else {
      // Linux
      appPorts.forEach(port => {
        try {
          console.log(`Checking port ${port}...`);
          // Find process using this port
          const cmd = `fuser -n tcp ${port} 2>/dev/null`;
          let pids;
          
          try {
            pids = execSync(cmd, { encoding: 'utf8' }).trim();
          } catch (e) {
            // No process using this port
            return;
          }
          
          if (pids) {
            pids.split(' ').forEach(pid => {
              if (pid) {
                console.log(`Killing process ${pid} using port ${port}`);
                try {
                  execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                  console.log(`Successfully terminated PID ${pid}`);
                } catch (killError) {
                  console.error(`Failed to kill process ${pid}:`, killError);
                }
              }
            });
          }
        } catch (error) {
          console.error(`Error checking port ${port}:`, error);
        }
      });
    }
    
    console.log('Port cleanup completed.');
  } catch (error) {
    console.error('Error in port cleanup:', error);
  }
}

// Add window control handlers
ipcMain.on('window-control', (_, command) => {
  if (!mainWindow) return;

  switch (command) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'toggle-fullscreen':
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      } else {
        mainWindow.setFullScreen(true);
      }
      break;
    case 'close':
      console.log('Close button clicked. Beginning shutdown sequence...');
      
      // Terminate all processes and release ports
      terminateAllProcesses();
      
      // Close database connections
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
        
        setTimeout(() => {
          // Force exit after a short delay to ensure cleanup completes
          console.log('Forcing application exit...');
          app.exit(0);
        }, 500);
      });
      break;
    default:
      console.log(`Unknown window command: ${command}`);
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')({ showDevTools: false }); // this is to not show dev tools when app starts
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
    fullscreen: true, // set to fullscreen
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
  console.log('Application is about to quit...');
  // Make sure to terminate any running processes and release ports
  terminateAllProcesses();
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
});
