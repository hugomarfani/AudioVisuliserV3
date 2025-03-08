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
  | 'run-gemma-reply'
  | 'hue-discover'
  | 'hue-register'
  | 'hue-fetch-groups'
  | 'hue-start-streaming'
  | 'hue-stop-streaming'
  | 'hue-set-color'
  | 'hue-test-lights'
  | 'hue-get-entertainment-setup'; // Add the new channel

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]): void {
      ipcRenderer.send(channel, ...args);
    },
    on(
      channel: Channels,
      func: (...args: unknown[]) => void,
    ): (() => void) | undefined {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
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
      numericGroupId?: string; // Add numeric group ID parameter
    }) =>
      ipcRenderer.invoke('hue-start-streaming', data),
    stopStreaming: () => ipcRenderer.invoke('hue-stop-streaming'),
    setColor: (data: { lightIds: number[]; rgb: number[]; transitionTime: number }) =>
      ipcRenderer.invoke('hue-set-color', data),
    testLights: (data?: { lightIds?: number[] }) =>
      ipcRenderer.invoke('hue-test-lights', data), // Updated to accept lightIds
    getEntertainmentSetup: (data: { ip: string; username: string; groupId: string }) =>
      ipcRenderer.invoke('hue-get-entertainment-setup', data), // Add new method
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
