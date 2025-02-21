import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <SongSelector
                    onTrackSelect={setSelectedTrackURI}
                    accessToken={accessToken}
                  />
                  <Player
                    track={{
                      title: 'Let It Go',
                      artist: 'Idina Menzel',
                      albumArt: 'https://cdn-images.dzcdn.net/images/cover/f669aa7623ad8af5fbeb5a196346013a/500x500.jpg',
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
