import '../utils/process-shim';
import { createRoot } from 'react-dom/client';
import App from './App';
import PlayScene from '../components/SongPlayer/PlayScene';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);
// root.render(<PlayScene />);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);

window.electron.ipcRenderer.on('run-gemma-test', () => {
  console.log('Gemma text triggered from menu!');
  window.electron.ipcRenderer.runGemmaTest();
});

window.electron.ipcRenderer.on('run-gemma-test-reply', (response) => {
  console.log('Gemma test response:', response);
});
