import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import Player from '../SongPlayer/Player';

const Particles: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const songDetails = location.state?.songDetails as SongModel;

  const [isVisible, setIsVisible] = useState(false);
  const [isCurtainOpen, setIsCurtainOpen] = useState(false);

  useEffect(() => {
    if (!songDetails) {
      navigate('/');
      return;
    }

    // Start the entrance animation sequence
    const timeline = async () => {
      setIsCurtainOpen(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsVisible(true);
    };
    
    timeline();

    return () => {
      setIsCurtainOpen(false);
      setIsVisible(false);
    };
  }, [songDetails, navigate]);

  const handleBack = async () => {
    setIsVisible(false);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsCurtainOpen(false);
    await new Promise(resolve => setTimeout(resolve, 1000));
    navigate('/');
  };

  if (!songDetails) {
    return null;
  }

  // Construct the full audio path
  const fullAudioPath = songDetails.audioPath ? `../../${songDetails.audioPath}` : '';

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
          <h1 style={{ color: 'white' }}>{songDetails.title} - Particles Visualization</h1>
          {/* Add your particles visualization here */}
        </div>
      </div>
    </>
  );
};

export default Particles;
