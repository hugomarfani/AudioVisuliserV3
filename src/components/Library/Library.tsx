import React from 'react';
import colors from '../../theme/colors';
import AddSongForm from './AddSongForm';
import AddCustomSong from './AddCustomSong';
import ScreenRecorder from '../ScreenRecorder/ScreenRecorder';

interface LibraryProps {
  onClose: () => void;
}

const Library: React.FC<LibraryProps> = ({ onClose }) => {
  const [youtubeMode, setYoutubeMode] = React.useState(true);
  const handleAddSong = (data: {
    url: string;
    prompt: string;
    moods: string[];
  }) => {
    console.log('Submitted:', data);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '24px',
          padding: '2rem',
          width: '80%',
          maxWidth: '600px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          position: 'relative',
        }}
      >
        <button
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'transparent',
            color: colors.grey2,
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
          onClick={onClose}
        >
          &times;
        </button>
        <h2 style={{ marginBottom: '1rem' }}>Search for New Song</h2>
        {/* Visualisation Mode Toggle Slider */}
        <div style={{
          display: 'flex',
          alignItems: 'right',
          marginLeft: '1rem',
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            color: !youtubeMode ? colors.blue : colors.grey3,
            marginRight: '0.5rem',
            fontWeight: !youtubeMode ? 'bold' : 'normal',
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)',
          }}>
            custom
          </span>
          <div
            onClick={() => setYoutubeMode(!youtubeMode)}
            style={{
              width: '48px',
              height: '24px',
              backgroundColor: youtubeMode ? colors.green : colors.blue,
              borderRadius: '12px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
            }}
          >
            <div style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              backgroundColor: colors.white,
              borderRadius: '50%',
              top: '2px',
              left: youtubeMode ? '26px' : '2px',
              transition: 'left 0.3s',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}></div>
          </div>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            color: youtubeMode ? colors.green : colors.grey3,
            marginLeft: '0.5rem',
            fontWeight: youtubeMode ? 'bold' : 'normal',
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)',
          }}>
            youtube
          </span>
        </div>
        {youtubeMode ? ( 
          <AddSongForm onSubmit={handleAddSong} />
        ) : (
          <AddCustomSong onSubmit={handleAddSong} />
        )}

        <ScreenRecorder />
      </div>
    </div>
  );
};

export default Library;
