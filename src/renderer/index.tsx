import '../utils/process-shim';
import { createRoot } from 'react-dom/client';
import App from './App';
import PlayScene from '../components/SongPlayer/PlayScene';
import { HueProvider } from '../context/HueContext';
import { fixCSPForDTLS } from '../utils/CSPFix'; // Import our CSP fix

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

// Apply CSP fix before mounting React app
fixCSPForDTLS();

root.render(
  <HueProvider>
    <App />
  </HueProvider>
);
// root.render(<PlayScene />);

// Remove loading spinner if it exists
const loader = document.getElementById('js-loader');
if (loader) {
  loader.classList.add('loaded');
}

// Adding specific webpack, create-react-app, and babel configuration overrides
if (process.env.NODE_ENV === 'development') {
  // Further silence webpack warnings about CSP if needed
  // This is just a development environment check
  console.log("Development environment detected - CSP limitations expected");
}

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
