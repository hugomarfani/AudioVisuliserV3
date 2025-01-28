import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';
import Player from '../components/SongSelector/Player';
import Login from '../components/Spotify/auth/Login'; // Assuming you have a Login component

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
        <Route path="/" element={
          <MeshGradientBackground>
            {accessToken === '' ? (
              <Login />
            ) : (
              <>
                <SongSelector
                  onTrackSelect={setSelectedTrackURI}
                  accessToken={accessToken}
                />
                <Player
                  accessToken={accessToken}
                  trackURI={selectedTrackURI}
                />
              </>
            )}
          </MeshGradientBackground>
        } />
      </Routes>
    </Router>
  );
};

export default App;
