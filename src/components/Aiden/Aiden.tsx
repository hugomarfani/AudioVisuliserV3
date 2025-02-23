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

  useEffect(() => {
    setIsCurtainOpen(true);
    setTimeout(() => setIsVisible(true), 1000);
    
    return () => {
      setIsCurtainOpen(false);
      setIsVisible(false);
    };
  }, []);

  const handleBack = () => {
    setIsVisible(false);
    setIsCurtainOpen(false);
    setTimeout(() => navigate('/'), 1500);
  };

  // Construct the full audio path
  const fullAudioPath = songDetails.audioPath ? `../../${songDetails.audioPath}` : '';

  if (!songDetails) {
    return <div>No song details available</div>;
  }

  return (
    <>
      <div className={`curtain curtain-left${isCurtainOpen ? ' open' : ''}`} />
      <div className={`curtain curtain-right${isCurtainOpen ? ' open' : ''}`} />
      <div className={`visualization-page${isVisible ? ' visible' : ''}`}>
        <div style={{ position: 'absolute', top: 20, left: 20 }}>
          <button 
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
            }}
          >
            Back
          </button>
        </div>
        
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          width: '100%',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}>
          <Player
            track={{
              title: songDetails.title,
              artist: songDetails.uploader,
              albumArt: songDetails.jacket,
              audioSrc: fullAudioPath,  // Use the constructed audio path
            }}
          />
        </div>
        
        <div style={{ 
          padding: '60px 20px',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}>
          <h1 style={{ color: 'white' }}>{songDetails.title} - Aiden Visualization</h1>
          {/* Add your Aiden visualization here */}
        </div>
      </div>
    </>
  );
};

export default Aiden;
