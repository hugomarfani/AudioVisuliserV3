import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import { FaPlay, FaArrowLeft } from 'react-icons/fa'; // Import the play and arrow icons from react-icons

interface SongDetailsProps {
  onClose: () => void;
  songId: string;
}

const SongDetails: React.FC<SongDetailsProps> = ({ onClose, songId }) => {
  const { songs, refetch } = useSongs();
  const [song, setSong] = useState<SongModel | null>(null);
  const [gemmaStatus, setGemmaStatus] = useState<string>('');

  useEffect(() => {
    if (songs) {
      const song = songs.find((s) => s.dataValues.id === songId);
      setSong(song || null);
    }
  }, [songs, songId]);

  const handleRunGemma = async () => {
    setGemmaStatus('Running Gemma...');
    try {
      // Replace with your actual Gemma run logic
      const result = await window.electron.ipcRenderer.invoke(
        'run-gemma',
        songId,
      );
      setGemmaStatus(`Gemma running ... ${result}`);
      refetch();
    } catch (error) {
      setGemmaStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  if (song === null) {
    return <div>Song not found</div>;
  }

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
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          {song.dataValues.title}
        </h1>
        <h2
          style={{
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: colors.grey2,
          }}
        >
          {song.dataValues.uploader}
        </h2>
        <img
          src={song.dataValues.jacket}
          alt={song.dataValues.title}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '15px',
            marginBottom: '1rem',
          }}
        />
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Status: {song.dataValues.status}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Moods: {song.dataValues.moods.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Colors: {song.dataValues.colours.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Objects: {song.dataValues.objects.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Backgrounds: {song.dataValues.backgrounds.join(', ')}
        </p>
        <button
          onClick={handleRunGemma}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.blue,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '1rem',
            marginTop: '1rem',
          }}
        >
          <FaPlay style={{ marginRight: '0.5rem' }} />
          Run Gemma
        </button>
        {gemmaStatus && (
          <p
            style={{ fontSize: '1rem', color: colors.grey2, marginTop: '1rem' }}
          >
            {gemmaStatus}
          </p>
        )}
      </div>
    </div>
  );
};

export default SongDetails;
