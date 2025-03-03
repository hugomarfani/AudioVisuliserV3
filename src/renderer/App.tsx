import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';
import Player from '../components/SongPlayer/Player';
import Login from '../components/Spotify/auth/Login'; // Assuming you have a Login component
import frozenLetItGo from '../../assets/audio/roc_steady.mp3';
import SongDetails from '../components/SongDetails/SongDetails';
import { Song } from '../database/models/Song';
import Particles from '../components/Particles/Particles';
import Aiden from '../components/Aiden/Aiden';
import { Button, Modal, Box } from '@mui/material';
import PhillipsHueControls from '../components/Hue/PhillipsHueControls';
import HueConfigModal from '../components/Hue/HueConfigModal';
import '../styles/hue.css';
import { testPheaLibrary } from '../utils/PheaConnector';

// Run tests on app start
console.log('Testing Phea library on app start...');
testPheaLibrary();

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);
  const [hueModalOpen, setHueModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Define a frozen track to play "Let It Go"
  const frozenTrack = {
    title: "Frozen - Let It Go",
    artist: "Idina Menzel",
    albumArt: "64x64", // using the imported icon as a placeholder album art
    audioSrc: frozenLetItGo,
  };

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%', // Changed from fixed width of 400 to 95% of screen width
    maxWidth: '1400px', // Add a maximum width to prevent excessive stretching
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 0, // Remove padding as the HueConfigModal has its own padding
    py: 5,
    borderRadius: 2,
  };

  const hueButtonStyle = {
    position: 'fixed',
    bottom: 16,
    left: 16,
    zIndex: 1000,
  };

  const settingsButtonStyle = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 1000,
  };

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
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <SongSelector
                      onTrackSelect={setSelectedTrackURI}
                      accessToken={accessToken}
                    />
                    {/* Player instance now stacked vertically */}
                    <Player track={frozenTrack} autoPlay={true} />
                  </div>
                  <Button
                    variant="contained"
                    sx={hueButtonStyle}
                    onClick={() => setHueModalOpen(true)}
                  >
                    Hue Dev Controls
                  </Button>
                  <Button
                    variant="contained"
                    sx={settingsButtonStyle}
                    onClick={() => setSettingsModalOpen(true)}
                  >
                    Settings
                  </Button>
                  <Modal
                    open={hueModalOpen}
                    onClose={() => setHueModalOpen(false)}
                  >
                    <Box sx={modalStyle}>
                      <PhillipsHueControls lightId={'4738d2a5-4b1a-4699-9054-6b1028aa5140'} />
                    </Box>
                  </Modal>
                  <Modal
                    open={settingsModalOpen}
                    onClose={() => setSettingsModalOpen(false)}
                  >
                    <Box sx={modalStyle}>
                      <HueConfigModal onClose={() => setSettingsModalOpen(false)} />
                    </Box>
                  </Modal>
                </>
              )}
            </MeshGradientBackground>
          }
        />
        <Route path="/song-details/:id" element={<SongDetails />} />
        <Route path="/particles/:id" element={<Particles />} />
        <Route path="/aiden/:id" element={<Aiden />} />
      </Routes>
    </Router>
  );
};

export default App;


