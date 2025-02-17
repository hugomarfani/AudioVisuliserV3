import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';

function Hello() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState('');

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Converting to WAV (16kHz)...');
    try {
      const result = await window.electron.ipcRenderer.invoke('download-wav', youtubeUrl);
      setStatus(`Successfully converted to 16kHz WAV! Saved to: ${result}`);
    } catch (error) {
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  return (
    <div>
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <h1>YouTube to WAV Converter (16kHz)</h1>
      
      <div className="converter-container">
        <form onSubmit={handleConvert}>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Enter YouTube URL"
            className="youtube-input"
          />
          <button type="submit" className="convert-button">
            Convert to WAV
          </button>
        </form>
        {status && <p className="status-message">{status}</p>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
