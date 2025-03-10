import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { FC, useEffect, useState } from 'react';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';
import Player from '../components/SongPlayer/Player';
import Login from '../components/Spotify/auth/Login';
import SongDetails from '../components/SongDetails/SongDetails';
import Particles from '../components/Particles/Particles';
import ShaderVisuals from '../shader/ShaderVisuals';
import PlayScene from '../shader/PlayScene';
import { HueProvider } from '../hooks/useHue';

const AppContent: FC = () => {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);
  const [useShader, setUseShader] = useState(false);
  const [track, setTrack] = useState({
    title: 'Let It Go',
    artist: 'Idina Menzel',
    albumArt:
      'https://cdn-images.dzcdn.net/images/cover/f669aa7623ad8af5fbeb5a196346013a/500x500.jpg',
  });

  return (
    <div>
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
                    useShader={useShader}
                    onTrackSelect={setSelectedTrackURI}
                    accessToken={accessToken}
                  />
                </div>
              )}
            </MeshGradientBackground>
          }
        />
        <Route
          path="/song-details/:id"
          element={
            <SongDetails
              onClose={() => navigate('/')}
              songId={selectedTrackURI || ''}
            />
          }
        />
        <Route path="/particles/:id" element={<Particles />} />
        <Route path="/aiden/:id" element={<PlayScene />} />
      </Routes>
    </div>
  );
};

const App: FC = () => {
  return (
    <HueProvider>
      <Router>
        <AppContent />
      </Router>
    </HueProvider>
  );
};

export default App;
