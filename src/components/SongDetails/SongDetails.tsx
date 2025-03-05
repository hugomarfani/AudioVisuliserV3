import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { SongModel, saveSongAsJson } from '../../database/models/Song';
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import { FaPlay, FaArrowLeft, FaUpload } from 'react-icons/fa'; // Added FaUpload icon

interface SongDetailsProps {
  onClose: () => void;
  songId: string;
}

const SongDetails: React.FC<SongDetailsProps> = ({ onClose, songId }) => {
  const { songs, refetch } = useSongs();
  const [song, setSong] = useState<SongModel | null>(null);
  const [gemmaStatus, setGemmaStatus] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !song) {
      return;
    }

    const file = e.target.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    if (!validTypes.includes(file.type)) {
      setUploadStatus('Error: Please select a PNG, JPG, or GIF file.');
      return;
    }

    setUploadStatus('Uploading image...');
    
    try {
      // Use electron to save the file to the correct location
      const result = await window.electron.ipcRenderer.invoke(
        'save-image',
        {
          songId: songId,
          filePath: file.path,
          fileName: file.name
        }
      );

      if (result.success) {
        // Update the song's images array
        const updatedSong = { ...song };
        const images = [...(updatedSong.dataValues.images || [])];
        images.push(result.savedPath);
        updatedSong.dataValues.images = images;
        
        // Update the song in the database
        await window.electron.ipcRenderer.invoke(
          'update-song',
          updatedSong.dataValues
        );
        
        // Save song as JSON
        await window.electron.ipcRenderer.invoke(
          'save-song-as-json',
          updatedSong.dataValues
        );
        
        setSong(updatedSong);
        setUploadStatus(`Image uploaded successfully!`);
        refetch();
      } else {
        setUploadStatus(`Error: ${result.error || 'Failed to save image'}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".jpg,.jpeg,.png,.gif"
          onChange={handleFileChange}
        />
        
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
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
            }}
          >
            <FaPlay style={{ marginRight: '0.5rem' }} />
            Run Gemma
          </button>
          
          <button
            onClick={triggerFileInput}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: colors.green,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            <FaUpload style={{ marginRight: '0.5rem' }} />
            Add Image
          </button>
        </div>
        
        {gemmaStatus && (
          <p style={{ fontSize: '1rem', color: colors.grey2, marginTop: '1rem' }}>
            {gemmaStatus}
          </p>
        )}
        
        {uploadStatus && (
          <p style={{ fontSize: '1rem', color: colors.grey2, marginTop: '1rem' }}>
            {uploadStatus}
          </p>
        )}
        
        {/* Display uploaded images */}
        {song.dataValues.images && song.dataValues.images.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Uploaded Images:</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {song.dataValues.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Custom image ${index + 1}`}
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongDetails;
