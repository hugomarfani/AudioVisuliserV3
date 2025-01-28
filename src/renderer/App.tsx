import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';
import Player from '../components/SongSelector/Player';

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're on the callback URL
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
      }

    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <MeshGradientBackground>
            <SongSelector
              onTrackSelect={setSelectedTrackURI}
              accessToken={accessToken}
            />
            <Player
              accessToken={accessToken}
              trackURI={selectedTrackURI}
            />
            {/* <SpotifyApp /> */}
          </MeshGradientBackground>
        } />
      </Routes>
    </Router>
  );
};

export default App;
