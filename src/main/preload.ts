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
  | 'run-gemma-reply';

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
    invoke: (channel: string, ...args: any[]): Promise<any> => {
      const validChannels = [
        'user:create',
        'user:getAll',
        'user:getById',
        'user:update',
        'user:delete',
        'fetch-songs',
        'add-song',
        'merge-asset-path',
        'reload-songs',
        'download-wav',
        'run-whisper',
        'run-gemma',
        'hue:turnOn',
        'hue:turnOff',
        'hue:getLightRids',
        'hue:discoverBridge',
        'hue:setManualBridge',
        'hue:setCredentials',
        'hue:getLightDetails',
        'hue:setLightState',
        'hue:getEntertainmentAreas',
        'hue:setLights',
        'hue:dtls-set-config',
        'hue:dtls-has-valid-config',
        'hue:dtls-connect',
        'hue:dtls-disconnect',
        'hue:dtls-is-connected',
        'hue:dtls-send-colors',
        'hue:dtls-test-sequence',
        // New Direct Hue channels
        'hue:activateEntertainmentGroup',
        'hue:startDTLSStream',
        'hue:sendDTLSColor',
        'hue:deactivateEntertainmentGroup',
        'hue:stopDTLSStream',
        'hue:isDTLSStreaming'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
    },
    send: (channel: string, ...args: any[]): void => {
      const validChannels = ['ipc-example', 'run-gemma-test'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
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
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

// Fix the incomplete DOMContentLoaded event handler
window.addEventListener('DOMContentLoaded', () => {
  // Override CSP if not in production
  if (process.env.NODE_ENV !== 'production') {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.spotify.com wss://*.spotify.com https://api.spotify.com; img-src 'self' data: https://*.scdn.co";
    document.head.appendChild(meta);
  }
});
