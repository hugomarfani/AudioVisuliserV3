import React, { JSX } from 'react';
import colors from '../../theme/colors';
import { songs } from './SongData';

type SongCardProps = {
  uri: string;
  onSelect: (uri: string) => void;
  accessToken: string;
  selectedDevice: string | null;
};

function SongCard({ uri, onSelect }: SongCardProps): JSX.Element {
  const songDetails = songs.find(song => song.id === uri);

  if (!songDetails) {
    return <div>Song not found</div>;
  }

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
      }}
    >
      <img
        src={songDetails.image}
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
          {songDetails.artist}
        </p>
      </div>
      <div>
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: colors[songDetails.status.toLowerCase()],
          }}
        />
      </div>
    </div>
  );
}

export default SongCard;
