import React from 'react';
import colors from '../../theme/colors';
import AddSongForm from './AddSongForm';

interface LibraryProps {
  onClose: () => void;
}

const Library: React.FC<LibraryProps> = ({ onClose }) => {
  const handleAddSong = (data: { url: string; prompt: string; moods: string[] }) => {
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
        <h2 style={{ marginBottom: '1rem' }}>Library</h2>
        <AddSongForm onSubmit={handleAddSong} />
      </div>
    </div>
  );
};

export default Library;
