contextBridge.exposeInMainWorld('electron', {
  // ...existing handlers...
  ipcRenderer: {
    // ...existing methods...
    invoke: (channel: string, ...args: any[]) => {












});  },    },      throw new Error(`Invalid channel: ${channel}`);      }        return ipcRenderer.invoke(channel, ...args);      if (validChannels.includes(channel)) {      ];        'hue:setCredentials',  // Add this line        // ...existing channels...      const validChannels = [
