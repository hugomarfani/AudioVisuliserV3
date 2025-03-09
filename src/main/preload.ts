// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'run-gemma-test'
  | 'run-gemma-test-reply'
  | 'download-wav'
  | 'download-mp3'
  | 'run-whisper'
  | 'run-gemma'
  | 'run-gemma-with-options'
  | 'run-gemma-reply'
  | 'run-stable-diffusion'
  | 'update-song'
  | 'save-song-as-json'
  | 'save-image'
  | 'open-file-dialog'
  | 'delete-image'
  | 'ai-progress-update'  // New channel for progress updates
  | 'ai-error'           // New channel for error reporting
  | 'ai-process-complete' // New channel for process completion
  | 'redownload-mp3';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]): void {
      ipcRenderer.send(channel, ...args);
    },
    on(
      channel: Channels,
      func: (...args: unknown[]) => void,
    ): (() => void) | undefined {
      // Fix: Create a subscription function that properly passes data
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
        // Make sure we're logging the data that comes from the main process
        console.log("Received in preload:", channel, args);
        func(...args);
      };
      
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void): void {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    runGemmaTest() {
      ipcRenderer.send('run-gemma-test');
    },
    // Add the invoke method
    invoke(channel: Channels, ...args: unknown[]): Promise<unknown> {
      return ipcRenderer.invoke(channel, ...args);
    },
    // Add explicit methods for handling AI progress tracking
    off(channel: Channels, func: (...args: unknown[]) => void): void {
      // We need to create a similar function reference here as the one we used in 'on'
      // Otherwise the event listener won't be properly removed
      const validChannels: Channels[] = [
        'ai-progress-update',
        'ai-error',
        'ai-process-complete',
        'window-control',
      ] as Channels[];
      
      if (validChannels.includes(channel)) {
        console.log("Removing listener for:", channel);
        // The key issue is that we need to use a stored reference to the original subscription
        // but since we don't have that, we'll directly call removeAllListeners
        ipcRenderer.removeAllListeners(channel);
      }
    }
  },
  database: {
    fetchSongs: () => ipcRenderer.invoke('fetch-songs'),
    addSong: (data: any) => ipcRenderer.invoke('add-song', data),
    reloadSongs: () => ipcRenderer.invoke('reload-songs'),
  },
  fileSystem: {
    mergeAssetPath: (path: string) =>
      ipcRenderer.invoke('merge-asset-path', path),
    downloadWav: (url: string) => ipcRenderer.invoke('download-wav', url),
    downloadMp3: (url: string) => ipcRenderer.invoke('download-mp3', url),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
