// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent, desktopCapturer } from 'electron';

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
  | 'ai-progress-update'
  | 'ai-error'          
  | 'ai-process-complete' 
  | 'redownload-mp3'
  | 'hue-discover'
  | 'hue-register'
  | 'hue-fetch-groups'
  | 'hue-start-streaming'
  | 'hue-stop-streaming'
  | 'hue-set-color'
  | 'hue-test-lights'
  | 'hue-process-beat'
  | 'hue-get-beat-status'
  | 'hue-save-settings'
  | 'hue-get-settings'
  | 'hue-update-cursor'
  | 'hue-toggle-cursor-control'
  | 'get-sources';

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
    saveAudioRecording: (data: {blob: Blob, fileName: string}) =>
      ipcRenderer.invoke('save-audio-recording', data),

  },
  hue: {
    discoverBridges: () => ipcRenderer.invoke('hue-discover'),
    registerBridge: (ip: string) => ipcRenderer.invoke('hue-register', ip),
    fetchGroups: (data: { ip: string; username: string; psk: string }) =>
      ipcRenderer.invoke('hue-fetch-groups', data),
    startStreaming: (data: {
      ip: string;
      username: string;
      psk: string;
      groupId: string;
      numericGroupId?: string;
    }) =>
      ipcRenderer.invoke('hue-start-streaming', data),
    stopStreaming: () => ipcRenderer.invoke('hue-stop-streaming'),
    setColor: (data: { lightIds: number[]; rgb: number[]; transitionTime: number }) =>
      ipcRenderer.invoke('hue-set-color', data),
    testLights: (data?: { lightIds?: number[] }) =>
      ipcRenderer.invoke('hue-test-lights', data),
    processBeat: (data: {
      isBeat: boolean;
      energy: number;
      bassEnergy: number;
      midEnergy: number;
      highEnergy: number;
      color?: number[];
      vocalEnergy?: number;
      audioData?: Uint8Array;
      brightness?: number;
      vocalActive?: boolean;
    }) =>
      ipcRenderer.invoke('hue-process-beat', data),
    getBeatStatus: () =>
      ipcRenderer.invoke('hue-get-beat-status'),
    saveSettings: (settings: any) =>
      ipcRenderer.invoke('hue-save-settings', settings),
    getSettings: () =>
      ipcRenderer.invoke('hue-get-settings'),
    // New method to update cursor position
    updateCursorPosition: (data: {
      x: number;
      y: number;
      screenWidth: number;
      screenHeight: number;
    }) =>
      ipcRenderer.invoke('hue-update-cursor', data),
    // New method to toggle cursor control
    toggleCursorControl: (enabled: boolean) =>
      ipcRenderer.invoke('hue-toggle-cursor-control', enabled),
    onStreamingStateChanged: (callback) => {
      ipcRenderer.on('hue:streamingStateChanged', callback);
    },
    removeStreamingStateListener: (callback) => {
      ipcRenderer.removeListener('hue:streamingStateChanged', callback);
    },
    onBeatDetected: (callback) => {
      ipcRenderer.on('hue:beatDetected', callback);
    },
    removeBeatListener: (callback) => {
      ipcRenderer.removeListener('hue:beatDetected', callback);
    },
  },
  recorder: {
    sourceIds: () => {ipcRenderer.invoke('get-sources');}
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
