import React, { useState, useEffect } from 'react';
import WebPlayback from './auth/WebPlayback';
import Login from './auth/Login';
import './SpotifyApp.css';
import Player from '../SongSelector/Player';

function SpotifyApp() {
  const [token, setToken] = useState('');

  useEffect(() => {
    async function getToken() {
      const response = await fetch('http://localhost:5001/auth/token');
      const json = await response.json();
      setToken(json.access_token);
    }

    getToken();
  }, []);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{token === '' ? <Login /> : <Player accessToken={token} trackURI={"spotify:track:5M2lX0ZAYSAzCs1xPPi9BX"} />}</>;
}

export default SpotifyApp;
