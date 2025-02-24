import React, { useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import colors from '../../theme/colors';
import { SongModel } from '../../database/models/Song';
import { useNavigate } from 'react-router-dom';

type SongCardProps = {
  uri: string;
  songDetails: SongModel;
  onSelect: (uri: string) => void;
  accessToken: string;
  selectedDevice: string | null;
  onDetailsClick: (songID: string) => void;
};

const statusMap: Record<string, string> = {
  blue: colors.blue,
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
};

function SongCard({
  uri,
  songDetails,
  onSelect,
  onDetailsClick,
}: SongCardProps): JSX.Element {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  if (!songDetails) {
    return <div>Song not found</div>;
  }

  const handleParticlesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Particles clicked - Song Details:', songDetails);
    const songWithAudio = {
      ...songDetails,
      audioSrc: songDetails.audioSrc || '',
    };
    console.log('Navigating to particles with data:', songWithAudio);
    navigate(`/particles/${encodeURIComponent(uri)}`, { 
      state: { songDetails: songWithAudio } 
    });
  };

  const handleAidenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Aiden clicked - Song Details:', songDetails);
    const songWithAudio = {
      ...songDetails,
      audioSrc: songDetails.audioSrc || '',
    };
    console.log('Navigating to aiden with data:', songWithAudio);
    navigate(`/aiden/${encodeURIComponent(uri)}`, { 
      state: { songDetails: songWithAudio } 
    });
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDetailsClick(uri);
  };
  const [imagePath, setImagePath] = React.useState<string>('');

  React.useEffect(() => {
    const findImagePath = async () => {
      const response = await window.electron.fileSystem.mergeAssetPath(
        songDetails.jacket,
      );
      setImagePath(response);
    };
    findImagePath();
  }, [songDetails.jacket]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(uri)}
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: colors.grey5,
        padding: '1rem',
        borderRadius: '24px',
        width: '200px',
        height: '48px',
        margin: '0 auto 1rem',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <img
        src={imagePath}
        alt={songDetails.title}
        style={{
          borderRadius: '15px',
          width: '48px',
          height: '48px',
          objectFit: 'cover',
        }}
      />
      <div style={{ flex: 1, marginLeft: '1rem', overflow: 'hidden' }}>
        <h2
          style={{
            fontSize: '1rem',
            margin: '0 0 0.25rem',
            fontWeight: 'bold',
            color: '#000',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {songDetails.title}
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            margin: 0,
            color: '#6B7280',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {songDetails.uploader}
        </p>
      </div>
      <div>
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            backgroundColor: statusMap[songDetails.status.toLowerCase()],
            borderRadius: '50%',
          }}
        />
      </div>
      <button
        onClick={handleDetailsClick}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: colors.grey2,
        }}
      >
        <FaInfoCircle size={16} />
      </button>
      <div
        style={{
          position: 'absolute',
          right: isHovered ? '0' : '-120px',
          top: 0,
          height: '100%',
          width: '120px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          transition: 'right 0.3s ease-in-out',
          borderTopRightRadius: '24px',
          borderBottomRightRadius: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={{
            padding: '4px 8px',
            backgroundColor: colors.blue,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
          onClick={handleParticlesClick}
        >
          Particles
        </button>
        <button
          style={{
            padding: '4px 8px',
            backgroundColor: colors.green,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
          onClick={handleAidenClick}
        >
          Aiden
        </button>
      </div>
    </div>
  );
}

export default SongCard;
