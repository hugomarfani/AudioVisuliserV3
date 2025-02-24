import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import Player from '../SongPlayer/Player';

const Aiden: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const songDetails = location.state?.songDetails as SongModel;

  const [isVisible, setIsVisible] = useState(false);
  const [isCurtainOpen, setIsCurtainOpen] = useState(false);
  const [fullAudioPath, setFullAudioPath] = useState<string>('');
  const [fullJacketPath, setFullJacketPath] = useState<string>('');

  useEffect(() => {
    setIsCurtainOpen(true);
    setTimeout(() => setIsVisible(true), 1000);
    
    return () => {
      setIsCurtainOpen(false);
      setIsVisible(false);
    };
  }, []);

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
        console.log('Audio path:', audioPath);
        console.log('Jacket path:', jacketPath);
      }
    };
    loadAssets();
  }, [songDetails]);

  const handleBack = () => {
    setIsVisible(false);
    setIsCurtainOpen(false);
    setTimeout(() => navigate('/'), 1500);
  };

  if (!songDetails) {
    return <div>No song details available</div>;
  }

  return (
    <div style={{ 
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
        onClick={() => navigate('/')}
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

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px'
      }}>
        <h1>{songDetails?.title} - Aiden Visualization</h1>
        <h2>Visualization Goes Here</h2>
      </div>

      {fullAudioPath && (
        <Player
          track={{
            title: songDetails.title,
            artist: songDetails.uploader,
            albumArt: fullJacketPath,
            audioSrc: fullAudioPath,
          }}
        />
      )}
    </div>
  );
};

export default Aiden;
