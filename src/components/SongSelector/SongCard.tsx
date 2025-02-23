import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import colors from '../../theme/colors';
import { SongModel } from '../../database/models/Song';

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
  if (!songDetails) {
    return <div>Song not found</div>;
  }

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
    </div>
  );
}

export default SongCard;
