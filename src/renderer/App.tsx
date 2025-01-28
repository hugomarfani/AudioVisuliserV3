import React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import MeshGradientBackground from '../components/Backgrounds/MeshGradientBackground';
import SongSelector from '../components/SongSelector/SongSelector';
import SpotifyApp from '../components/Spotify/SpotifyApp';

// eslint-disable-next-line react/function-component-definition
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
      <Route
  path="/auth/callback"
  component={() => {
    // Extract the code and state from the query parameters
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    const state = query.get('state');

    // Send the code and state to your backend for token exchange
    fetch(`http://localhost:5001/auth/callback?code=${code}&state=${state}`)
      .then(response => response.json())
      .then(data => {
        console.log('Token exchanged:', data);
        // Handle token (e.g., store in state or redirect to another page)
      })
      .catch(err => console.error('Error:', err));

    return <div>Processing...</div>; // Show a loading or success message
  }}
/>
        <Route
          path="/"
          element={
            <MeshGradientBackground>
              <SongSelector />
              <SpotifyApp />
            </MeshGradientBackground>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
