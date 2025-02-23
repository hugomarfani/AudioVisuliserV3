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
import DYWBAS from '../../assets/audio/TeQ_TTyLGMs.wav';

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [selectedTrackURI, setSelectedTrackURI] = useState<string | null>(null);

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
                  {/* <Player
                    track={{
                      title: 'Let It Go',
                      artist: 'Idina Menzel',
                      albumArt:
                        'https://cdn-images.dzcdn.net/images/cover/f669aa7623ad8af5fbeb5a196346013a/500x500.jpg',
                      audioSrc: frozenLetItGo, // Use the imported MP3 file
                    }}
                  /> */}
                  <Player
                    track={{
                      title: 'Do You Want To Build A Snowman',
                      artist: 'Kristen Bell, Agatha Lee Monn, and Katie Lopez',
                      albumArt:
                        'https://i.scdn.co/image/ab67616d0000b273c9b5b9c6f0b6b1c9c4c3e1d1',
                      audioSrc: DYWBAS, // Use the imported wav file
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
