// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'run-gemma-test'
  | 'run-gemma-test-reply'
  | 'download-wav'
  | 'download-mp3'
  | 'run-whisper';

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
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
