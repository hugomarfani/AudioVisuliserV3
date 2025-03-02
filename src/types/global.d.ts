
interface Window {
  electron: {
    ipcRenderer: {
      sendMessage(channel: string, ...args: any[]): void;
      on(channel: string, func: (...args: any[]) => void): (() => void) | undefined;
      once(channel: string, func: (...args: any[]) => void): void;
      invoke(channel: string, ...args: any[]): Promise<any>;
      runGemmaTest(): void;
    };
    database: {
      fetchSongs: () => Promise<any>;
      addSong: (data: any) => Promise<any>;
      reloadSongs: () => Promise<any>;
    };
    fileSystem: {
      mergeAssetPath: (path: string) => Promise<string>;
      downloadWav: (url: string) => Promise<string>;
      downloadMp3: (url: string) => Promise<string>;
    };
  };
}

interface HTMLAudioElement {
  webkitAudioContext: AudioContext;
}

interface Window {
  webkitAudioContext: AudioContext;
}
