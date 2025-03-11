import React, { useState, useEffect } from 'react';
import colors from '../../theme/colors';
import AddSongForm from './databaseForm';
import SongTable from './SongTable';
import { useSongs } from '../../hooks/useSongs';

interface DatabaseProps {
  onClose: () => void;
}

const Database: React.FC<DatabaseProps> = ({ onClose }) => {
  const [isAddingMode, setIsAddingMode] = useState(false);
  const { songs, loading, error, refetch } = useSongs();

  useEffect(() => {
    console.log('Songs in Database component:', songs);
  }, [songs]);

  const handleAddSong = async (data: { title: string; prompt: string; moods: string[] }) => {
    try {
      await window.electron.database.addSong(data);
      await refetch();
      setIsAddingMode(false);
    } catch (err) {
      console.error('Failed to add song:', err);
    }
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
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          overflow: 'auto',
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
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: colors.grey2,
          }}
          onClick={onClose}
        >
          &times;
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Database</h2>
          <button
            onClick={() => setIsAddingMode(!isAddingMode)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: colors.blue,
              color: colors.white,
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
            }}
          >
            {isAddingMode ? 'View Songs' : 'Add New Song'}
          </button>
        </div>

        {isAddingMode ? (
          <AddSongForm onSubmit={handleAddSong} />
        ) : (
          <SongTable songs={songs} loading={loading} error={error} />
        )}
      </div>
    </div>
  );
};

export default Database;
