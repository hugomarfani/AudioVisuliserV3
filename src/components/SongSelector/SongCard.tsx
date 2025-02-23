import React, { JSX } from 'react';
import colors from '../../theme/colors';

// type StatusColor = keyof typeof colors;
import { SongModel } from '../../database/models/Song';

type SongCardProps = {
  uri: string;
  songDetails: SongModel;
  onSelect: (uri: string) => void;
  accessToken: string;
  selectedDevice: string | null;
};

const statusMap: Record<string, string> = {
  blue: colors.blue,
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
};

function SongCard({ uri, songDetails, onSelect }: SongCardProps): JSX.Element {
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
        src={songDetails.jacket}
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
    </div>
  );
}

export default SongCard;
