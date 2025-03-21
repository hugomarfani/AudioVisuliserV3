import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { spawn, execSync } from 'child_process';
import fs, { unlink } from 'fs';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import initDatabase from '../database/init';
import { UserDB } from '../database/models/User';
import { db } from '../database/config';
import { Song, saveSongAsJson } from '../database/models/Song';
import {
  downloadYoutubeAudio as downloadYoutubeAudioWav,
  getYoutubeMetadata,
  saveAudio
} from '../youtube/youtubeToWav';
import { mainPaths, getResourcePath } from './paths';
import { registerImageHandlers } from './ipc/imageHandlers';
import HueService from './HueService';
import {v4 as uuidv4} from 'uuid';

const gotTheLock = app.requestSingleInstanceLock();
let windowCreated = false;

if (!gotTheLock) {
  console.log('Another instance is already running - quitting this one');
  app.quit();
} else {
  // Someone tried to run a second instance, focus our window instead
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      console.log('Second instance attempted to start - focusing existing window');
    }
  });
}


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

// Initialise Hue Service
const hueService = new HueService();

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

function trackProgressFromStdout(data: Buffer, sender: Electron.WebContents, operationId: string) {
  const output = data.toString();
  console.log(`📜 stdout: ${output}`);

  Object.entries(progressSteps).forEach(([key, message]) => {
    if (output.includes(message)) {
      const progressData = {
        operationId,
        step: key,
        message: message,
        completed: true
      };
      console.log("Sending progress update:", progressData);
      sender.send('ai-progress-update', progressData);
    }
  });
}


const activeProcesses: { [key: string]: ReturnType<typeof spawn> } = {};


function runAIProcessWithTracking(
  command: string,
  args: string[],
  sender: Electron.WebContents,
  operationId: string,
  expectedSteps: string[]
) {
  expectedSteps.forEach(step => {
    const progressData = {
      operationId,
      step,
      message: `Waiting for ${step}...`,
      completed: false
    };
    console.log("Sending initial step:", progressData);
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

// DEPRECATED - CAN'T SEND SOURCES PROPERLY
// ipcMain.handle('get-sources', async () => {
//   return desktopCapturer.getSources({ types: ['window', 'screen'] });
// });


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
    return songs;
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
});


ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg'] }]
  });
  return result;
});

// Add this handler to open file dialog
ipcMain.handle('select-audio-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'webm'] }
      ],
      title: 'Select Audio File'
    });
    
    if (canceled || filePaths.length === 0) {
      return { cancelled: true };
    }
    
    return { 
      cancelled: false, 
      filePath: filePaths[0]
    };
  } catch (error) {
    console.error('Error selecting audio file:', error);
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

ipcMain.handle('link-new-mp3', async (_, songId, filePath) => {
  const pathToAdd = `audio/${songId}`;
  const mp3Path = getResourcePath('assets',pathToAdd+".mp3");
  const wavPath = getResourcePath('assets',pathToAdd+".wav");
  await saveAudio(filePath, wavPath, mp3Path, false);
  return { mp3Path, wavPath };
});

ipcMain.handle('save-audio-recording', async (_, { blob, fileName }) => {
  try {
    console.log('Saving audio recording:', fileName);
    // Get the path to resources/assets/audio
    const audioDir = getResourcePath('assets', 'audio');
    
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, blob);

    // convert to mp3 and wav
    console.log('Converting to mp3 and wav');
    await saveAudio(filePath, false);
    
    return { success: true};
  } catch (error) {
      console.error('Failed to save audio recording:', error);
      return { success: false, error: error.message };
  }
});

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

ipcMain.handle('save-custom-song', async (_, title: string, artist: string, thumbnailPath: string) => {
  try {
    const id = uuidv4();
    const imageDir = getResourcePath('assets', 'images', id);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    // copy the image
    const imageFileName = `jacket.png`;
    const newImagePath = path.join(imageDir, imageFileName);
    fs.copyFileSync(thumbnailPath, newImagePath);

    const song = await makeNewSong(id, title, artist);
    saveSongAsJson(song);
    return song;
  } catch (error) {
    console.error('Error in save-custom-song handler:', error);
    throw error;
  }
})

async function makeNewSong(id: string, title: string, artist: string, ytId?: string) {
  // create song entry in database
  // temporarily assign random status
  const statuses = ['Blue', 'Yellow', 'Red', 'Green'];
  const randomStatus: 'Blue' | 'Yellow' | 'Red' | 'Green' = statuses[
    Math.floor(Math.random() * statuses.length)
  ] as 'Blue' | 'Yellow' | 'Red' | 'Green';
  let jacket = 'images/' + id + '/jacket.png';
  // if (ytId) {
  //   jacket = 'images/' + ytId + '/jacket.png';
  // }
  let audioPath = 'audio/' + id + '.mp3';
  // if (ytId) {
  //   audioPath = 'audio/' + ytId + '.mp3';
  // }

  const song = await Song.create({
    id: id,
    title: title,
    uploader: artist,
    audioPath: audioPath,
    jacket: jacket, 
    images: [jacket],
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
    youtubeId: ytId || "",
    shaderBackground: '',
    shaderTexture: ''
  });
  return song;
}


ipcMain.handle('download-wav', async (_, url) => {
  try {
    const songId = uuidv4();
    const Ytid = await downloadYoutubeAudioWav(songId, url, false);
    const { title, artist, thumbnailPath } = await getYoutubeMetadata(songId, url);
    console.log(
      `Downloaded WAV with id: ${Ytid}, title: ${title}, artist: ${artist}, thumbnail: ${thumbnailPath}`,
    );
    const song = await makeNewSong(songId, title, artist, Ytid);
    saveSongAsJson(song);
    console.log('Song entry created:', song);
    // return Ytid;
    return songId;
  } catch (error) {
    console.error('Error in download-wav handler:', error);
    throw error;
  }
});

ipcMain.handle('update-particle-settings', async (event, args) => {
  try {
    const { particles } = args;
    
    // Path to the particle list JSON file - adjust the path according to your project structure
    const particleListPath = path.join(__dirname, '../../src/particles/particleList.json');
    
    // Create the new JSON content
    const newContent = {
      particles: particles
    };
    
    // Write the updated JSON to the file
    await fs.promises.writeFile(
      particleListPath,
      JSON.stringify(newContent, null, 2),
      'utf-8'
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error updating particle settings:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update particle settings'
    };
  }
});

// Get all images for a particle type
ipcMain.handle('get-particle-images', async (event, args) => {
  try {
    const { particleDir } = args;
    
    // Use getResourcePath to get the correct path to the particles directory
    const particlesBasePath = getResourcePath('assets', `particles/${particleDir}`);
    console.log(`Looking for particle images in: ${particlesBasePath}`);
    
    // Check if directory exists, create it if it doesn't
    if (!fs.existsSync(particlesBasePath)) {
      console.log(`Directory not found, creating: ${particlesBasePath}`);
      fs.mkdirSync(particlesBasePath, { recursive: true });
      return { 
        success: true, 
        images: [], 
        message: 'Directory was created but contains no images yet' 
      };
    }
    
    // Read all files in the directory
    const files = fs.readdirSync(particlesBasePath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
    });
    
    console.log(`Found ${imageFiles.length} images in ${particlesBasePath}`);
    
    if (imageFiles.length === 0) {
      return { 
        success: true, 
        images: [], 
        message: 'Directory exists but contains no images' 
      };
    }
    
    // Create paths for each image
    const images = imageFiles.map(file => {
      const fullPath = path.join(particlesBasePath, file);
      const urlPath = `file://${fullPath.replace(/\\/g, '/')}`;
      return {
        name: file,
        path: urlPath
      };
    });
    
    return { success: true, images };
  } catch (error) {
    console.error('Error getting particle images:', error);
    return { success: false, error: error.message || 'Failed to get images' };
  }
});

// Delete a particle image
ipcMain.handle('delete-particle-image', async (event, args) => {
  try {
    const { particleDir, imageName } = args;
    const imagePath = getResourcePath('assets', `particles/${particleDir}/${imageName}`);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return { success: false, error: 'Image not found' };
    }
    
    // Delete the file
    fs.unlinkSync(imagePath);
    console.log(`Deleted particle image: ${imagePath}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting particle image:', error);
    return { success: false, error: error.message || 'Failed to delete image' };
  }
});

// Add a new particle image
ipcMain.handle('add-particle-image', async (event, args) => {
  try {
    const { particleDir, particleName, currentCount } = args;
    
    // Show file dialog to select image
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
      ],
      title: 'Select Particle Image'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No file selected' };
    }
    
    const sourceFilePath = result.filePaths[0];
    const fileName = `${particleName}${currentCount + 1}${path.extname(sourceFilePath)}`;
    const destFolderPath = getResourcePath('assets', `particles/${particleDir}`);
    const destFilePath = path.join(destFolderPath, fileName);
    
    // Ensure destination directory exists
    if (!fs.existsSync(destFolderPath)) {
      fs.mkdirSync(destFolderPath, { recursive: true });
      console.log(`Created directory: ${destFolderPath}`);
    }
    
    // Copy the file
    fs.copyFileSync(sourceFilePath, destFilePath);
    console.log(`Copied file to: ${destFilePath}`);
    
    return { success: true, fileName, path: `file://${destFilePath.replace(/\\/g, '/')}` };
  } catch (error) {
    console.error('Error adding particle image:', error);
    return { success: false, error: error.message || 'Failed to add image' };
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

// Add the delete-song IPC handler
ipcMain.handle('delete-song', async (_, songId) => {
  console.log(`Attempting to delete song with ID: ${songId}`);
  try {
    // 1. Delete the song from database
    const deletedSong = await Song.destroy({
      where: { id: songId }
    });

    if (!deletedSong) {
      console.error(`Song with ID ${songId} not found in database`);
      return { success: false, error: `Song with ID ${songId} not found` };
    }

    // 2. Delete all associated files
    const filesToDelete = [
      `audio/${songId}.mp3`,
      `lyrics/${songId}.txt`,
      `songData/${songId}.json`,
      `shader/background/${songId}.jpg`,
      `shader/texture/${songId}.jpg`
    ];

    // Handle file deletions
    for (const filePath of filesToDelete) {
      try {
        const fullPath = getResourcePath('assets', filePath);
        // Check if file exists before attempting to delete
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          console.log(`Deleted file: ${fullPath}`);
        }
      } catch (error) {
        console.warn(`Could not delete file ${filePath}:`, error);
        // Continue with other deletions even if one fails
      }
    }

    // 3. Delete the images directory if it exists
    const imagesDir = getResourcePath('assets', `images/${songId}`);
    try {
      if (fs.existsSync(imagesDir)) {
        // Recursive directory deletion
        await fs.promises.rm(imagesDir, { recursive: true, force: true });
        console.log(`Deleted directory: ${imagesDir}`);
      }
    } catch (error) {
      console.warn(`Could not delete directory ${imagesDir}:`, error);
    }

    console.log(`Successfully deleted song with ID: ${songId} and all associated files`);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting song with ID ${songId}:`, error);
    return { success: false, error: `Failed to delete song: ${error instanceof Error ? error.message : String(error)}` };
  }
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
                // Make sure the PID is valid (a positive number)
                if (/^[1-9]\d*$/.test(pid)) {
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
              // Make sure the PID is valid (not empty and a number > 0)
              if (pid && /^[1-9]\d*$/.test(pid)) {
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
              // Make sure the PID is valid (not empty and a number > 0)
              if (pid && /^[1-9]\d*$/.test(pid)) {
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

// Handler for get-particle-list
ipcMain.handle('get-particle-list', async () => {
  try {
    // Path to the particle list JSON file
    const particleListPath = path.join(__dirname, '../../src/particles/particleList.json');
    
    // Read the current particle list
    const data = await fs.promises.readFile(particleListPath, 'utf-8');
    const particleList = JSON.parse(data);
    
    return { 
      success: true, 
      particles: particleList.particles 
    };
  } catch (error) {
    console.error('Error reading particle list:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to read particle list',
      particles: [] 
    };
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
  // Only create a window if one doesn't already exist
  if (mainWindow !== null || windowCreated) {
    console.log('Window already exists or is being created, skipping creation');
    return;
  }

  console.log('Creating application window...');
  windowCreated = true;

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
    windowCreated = false;
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

// Move the activate handler registration outside of app.whenReady() to avoid duplicate registrations
app.removeAllListeners('activate');
app.on('activate', () => {
  console.log('App activated, checking if we need a new window');
  if (mainWindow === null && !windowCreated) createWindow();
});

app
  .whenReady()
  .then(async () => {
    try {
      await initDatabase();
      // await db.sync();
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

    // Only create a window if one doesn't already exist
    if (mainWindow === null && !windowCreated) {
      console.log('App ready - creating initial window');
      createWindow();
    }

    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        // Grant access to the first screen found.
        callback({ video: sources[0], audio: 'loopback' })
      })
      // If true, use the system picker if available.
      // Note: this is currently experimental. If the system picker
      // is available, it will be used and the media request handler
      // will not be invoked.
    }, { useSystemPicker: true }) 
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
