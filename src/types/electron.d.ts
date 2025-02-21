export interface IElectronHandler {
  ipcRenderer: {
    sendMessage(channel: string, ...args: unknown[]): void;
    on(channel: string, func: (...args: unknown[]) => void): void;
    once(channel: string, func: (...args: unknown[]) => void): void;
  };
  database: {
    fetchSongs(): Promise<any[]>;
    addSong(data: any): Promise<any>;
  };
}

declare global {
  interface Window {
    electron: IElectronHandler;
  }
}
