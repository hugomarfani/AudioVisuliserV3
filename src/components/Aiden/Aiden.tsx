import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import Player from '../SongPlayer/Player';

const Aiden: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const songDetails = location.state?.songDetails as SongModel;
  const [fullAudioPath, setFullAudioPath] = useState('');
  const [fullJacketPath, setFullJacketPath] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      if (songDetails) {
        const audioPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.audioPath
        );
        const jacketPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.jacket
        );
        setFullAudioPath(audioPath);
        setFullJacketPath(jacketPath);
      }
    };
    loadAssets();
  }, [songDetails]);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle leaving the page
  const handleBack = () => {
    setIsVisible(false);
    setTimeout(() => navigate('/'), 300);
  };

  if (!songDetails) return null;

  return (
    <div className={`page-transition ${isVisible ? 'visible' : ''}`}
      style={{ 
        width: '100vw', 
        height: '100vh', 
        background: '#000',
        color: 'white',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    }}>
      <button
        onClick={handleBack}
        style={{
          padding: '8px 16px',
          borderRadius: '20px',
          background: 'white',
          border: 'none',
          cursor: 'pointer',
          width: 'fit-content',
          color: 'black'
        }}
      >
        Back
      </button>

      <div className={`visualization-title ${isVisible ? 'visible' : ''}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <h1>{songDetails.title} - Aiden Visualization</h1>
        <h2>Visualization Goes Here</h2>
      </div>

      {fullAudioPath && (
        <div className={`player-wrapper ${isVisible ? 'visible' : ''}`}>
          <Player
            track={{
              title: songDetails.title,
              artist: songDetails.uploader,
              albumArt: fullJacketPath,
              audioSrc: fullAudioPath,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Aiden;
