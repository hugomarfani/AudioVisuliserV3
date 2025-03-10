import React, { useEffect, useState } from 'react';
import { SongModel } from '../../database/models/Song';
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import ParticleSelector from './ParticleSelector';
import BackgroundSelector from './BackgroundSelector';
import ImageGallery from './ImageGallery';
import LLMRunner from './LLMRunner';
import WhisperRunner from './WhisperRunner';
import ShaderImageSelector from './ShaderImageSelector';
import DeleteSongButton from './DeleteSongButton';

interface SongDetailsProps {
  onClose: () => void;
  songId: string;
}

const SongDetails: React.FC<SongDetailsProps> = ({ onClose, songId }) => {
  const { songs, refetch } = useSongs();
  const [song, setSong] = useState<SongModel | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [jacketImage, setJacketImage] = useState<string>("");
  const [redownloading, setRedownloading] = useState(false);

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

    const loadJacketImage = async () => {
      if (song) {
        const jacketImagePath = await findImagePath(song.dataValues.jacket);
        setJacketImage(jacketImagePath);
      }
    };

    loadSong();
    loadJacketImage();
  }, [songs, songId]);

  const handleMp3Redownload = async () => {
    // if (!song || !song.dataValues.youtubeUrl) {
    //   alert("No YouTube URL found for this song");
    //   return;
    // }

    try {
      setRedownloading(true);
      await window.electron.ipcRenderer.invoke('redownload-mp3', songId);
      setRedownloading(false);
      alert("MP3 redownloaded successfully!");
      // Refresh song data
      refetch();
    } catch (error) {
      setRedownloading(false);
      console.error("Error redownloading MP3:", error);
      alert(`Failed to redownload MP3: ${error}`);
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
        overflowY: 'auto',
      }}
      onClick={onClose}
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
        onClick={(e) => e.stopPropagation()}
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
          src={jacketImage}
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

        {/* MP3 Redownload component */}
        <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
            Redownload MP3
          </h3>
          <p style={{ fontSize: '0.9rem', color: colors.grey2, marginBottom: '1rem' }}>
            If there was an issue with the original MP3 download, you can redownload it.
          </p>
          <button
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: redownloading ? colors.blue : colors.grey2,
              color: colors.white,
              border: 'none',
              borderRadius: '4px',
              cursor: redownloading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
            onClick={handleMp3Redownload}
            disabled={redownloading}
          >
            {redownloading ? 'Downloading...' : 'Redownload MP3'}
          </button>
        </div>



        {/*

        DEPRECATED WARNING -> WHISPER NOW DELETES THE WAV FILE AFTER PROCESSING SO NO NEED TO RERUN WHISPER
        HOWEVER, LEAVING THIS COMMENTED OUT IN CASE WE NEED TO REVERT BACK TO THIS
        THIS WOULD REQUIRE SD.EXE BEING UPDATED WITH THE NEW WHISPER COMMANDS

        Whisper Runner component - add this before LLM Runner
        <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
          <WhisperRunner
            song={song}
            songId={songId}
            refetch={refetch}
          />
        </div> */}

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

        {/* Shader Image Selector */}
        <ShaderImageSelector
          song={song}
          songId={songId}
          refetch={refetch}
        />

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

        {/* Delete Song Button component */}
        <DeleteSongButton
          songId={songId}
          songTitle={song.dataValues.title}
          onSuccess={onClose}
        />
      </div>
    </div>
  );
};

export default SongDetails;
