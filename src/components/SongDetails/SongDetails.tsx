import React, { useEffect, useState } from 'react';
import { SongModel } from '../../database/models/Song';
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import ParticleSelector from './ParticleSelector';
import BackgroundSelector from './BackgroundSelector';
import ImageGallery from './ImageGallery';
import LLMRunner from './LLMRunner';

interface SongDetailsProps {
  onClose: () => void;
  songId: string;
}

const SongDetails: React.FC<SongDetailsProps> = ({ onClose, songId }) => {
  const { songs, refetch } = useSongs();
  const [song, setSong] = useState<SongModel | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const findImagePath = async (P: string) => {
    const response = await window.electron.fileSystem.mergeAssetPath(P);
    return response;
  };

  useEffect(() => {
    const loadSong = async () => {
      if (songs) {
        const song = songs.find((s) => s.dataValues.id === songId);
        setSong(song || null);
        if (song && song.dataValues.images) {
          const imagePaths = song.dataValues.images;
          const resolvedImagePaths = await Promise.all(
            imagePaths.map(async (imagePath) => {
              return await findImagePath(imagePath);
            })
          );
          console.log('Song Images:', resolvedImagePaths);
          setUploadedImages(resolvedImagePaths);
        }
      }
    };

    loadSong();
  }, [songs, songId]);

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
        overflowY: 'auto',
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
          maxHeight: '90vh',
          overflowY: 'auto',
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
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          {song.dataValues.title}
        </h1>
        <p style={{ fontSize: '0.9rem', color: colors.grey2, marginBottom: '1rem' }}>
          ID: {songId}
        </p>
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
        
        {/* LLM Runner component - add this before BackgroundSelector */}
        <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
          <LLMRunner 
            song={song} 
            songId={songId} 
            refetch={refetch}
          />
        </div>
        
        {/* Background selection component */}
        <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
            Background Generation
          </h3>
          <BackgroundSelector 
            song={song} 
            songId={songId} 
            refetch={refetch}
          />
        </div>
        
        {/* Particle selection component */}
        <ParticleSelector 
          song={song} 
          songId={songId} 
          refetch={refetch}
        />
        
        {/* Image Gallery component */}
        <ImageGallery
          song={song}
          songId={songId}
          uploadedImages={uploadedImages}
          setUploadedImages={setUploadedImages}
          refetch={refetch}
        />
      </div>
    </div>
  );
};

export default SongDetails;
