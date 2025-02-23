import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';
import Player from '../components/SongPlayer/Player';
import Login from '../components/Spotify/auth/Login'; // Assuming you have a Login component
import frozenLetItGo from '../../assets/audio/frozen_let_it_go.mp3';

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);

  useEffect(() => {
    async function getToken() {
      const response = await fetch('http://localhost:5001/auth/token');
      const json = await response.json();
      setAccessToken(json.access_token);
    }

    getToken();
  }, []);

  // function Hello() {
  //   // useEffect(() => {
  //   //   // Dynamic import of the sketch to ensure it only runs in the browser
  //   //   import('../particles/sketch').catch(console.error);
  //   // }, []);

  //   const [youtubeUrl, setYoutubeUrl] = useState('');
  //   const [status, setStatus] = useState('');

  //   const handleConvert = async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setStatus('Converting to WAV (16kHz)...');
  //     try {
  //       const result = await window.electron.ipcRenderer.invoke(
  //         'download-wav',
  //         youtubeUrl,
  //       );
  //       setStatus(
  //         `Successfully converted to 16kHz WAV! Saved to: ${result}. Ready for Whisper!`,
  //       );
  //       const whisperResult = window.electron.ipcRenderer.invoke(
  //         'run-whisper',
  //         result,
  //       );
  //       console.log('Whisper result:', whisperResult);
  //       setStatus('Successfully ran Whisper!');
  //     } catch (error) {
  //       setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
  //     }
  //   };

  //   return (
  //     <div>
  //       <div className="Hello">
  //         <img width="200" alt="icon" src={icon} />
  //       </div>
  //       <h1>Group 1</h1>
  //       {/* <div className="particle-container" id="particle-container">
  //       </div> */}
  //       <div className="converter-container">
  //         <form onSubmit={handleConvert}>
  //           <input
  //             type="text"
  //             value={youtubeUrl}
  //             onChange={(e) => setYoutubeUrl(e.target.value)}
  //             placeholder="Enter YouTube URL"
  //             className="youtube-input"
  //           />
  //           <button type="submit" className="convert-button">
  //             Convert to WAV
  //           </button>
  //         </form>
  //         {status && <p className="status-message">{status}</p>}
  //       </div>
  //     </div>
  //   );
  // };

  // export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <MeshGradientBackground>
              {accessToken === '123' ? (
                <Login />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <SongSelector
                    onTrackSelect={setSelectedTrackURI}
                    accessToken={accessToken}
                  />
                  <Player
                    track={{
                      title: 'Let It Go',
                      artist: 'Idina Menzel',
                      albumArt:
                        'https://cdn-images.dzcdn.net/images/cover/f669aa7623ad8af5fbeb5a196346013a/500x500.jpg',
                      audioSrc: frozenLetItGo, // Use the imported MP3 file
                    }}
                  />
                </div>
              )}
            </MeshGradientBackground>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
