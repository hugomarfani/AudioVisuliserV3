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
import SongDetails from '../components/SongDetails/SongDetails';
import { Song } from '../database/models/Song';
import Particles from '../components/Particles/Particles';
import Aiden from '../components/Aiden/Aiden';
import { Button, Modal, Box } from '@mui/material';
import PhillipsHueControls from '../components/Hue/PhillipsHueControls';
import HueDebugOverlay from '../components/Hue/HueDebugOverlay';

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);
  const [hueModalOpen, setHueModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // useEffect(() => {
  //   async function getToken() {
  //     const response = await fetch('http://localhost:5001/auth/token');
  //     const json = await response.json();
  //     setAccessToken(json.access_token);
  //   }

  //   getToken();
  // }, []);

  // function Hello() {
  //   // useEffect(() => {
  //   //   // Dynamic import of the sketch to ensure it only runs in the browser
  //   //   import('../particles/sketch').catch(console.error);
  //   // }, []);
  //     <div>
  //       <div className="Hello">
  //         <img width="200" alt="icon" src={icon} />
  //       </div>
  //       <h1>Group 1</h1>
  //       {/* <div className="particle-container" id="particle-container">
  //       </div> */}


  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
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
                    <Modal
                      open={settingsModalOpen}
                      onClose={() => setSettingsModalOpen(false)}
                    >
                      <Box sx={modalStyle}>
                        <HueDebugOverlay />
                      </Box>
                    </Modal>
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


