import React, { useEffect, useState } from 'react';

const SpotifyPlayer = ({ token }: { token: string }) => {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const playerInstance = new window.Spotify.Player({
        name: 'My Spotify Player',
        getOAuthToken: (cb) => cb(token),
      });

      setPlayer(playerInstance);

      playerInstance.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      playerInstance.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      playerInstance.connect();
    };

    return () => script.remove();
  }, [token]);

  return <div>Spotify Player</div>;
};

export default SpotifyPlayer;
