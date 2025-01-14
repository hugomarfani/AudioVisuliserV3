import React, { JSX } from 'react';
import colors from '../../theme/colors';

type SongCardProps = {
  title: string;
  artist: string;
  albumArt: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

function SongCard({
  title,
  artist,
  albumArt,
  status,
}: SongCardProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: colors.grey5,
        padding: '1rem',
        borderRadius: '24px',
        width: '200px', // Fixed width
        height: '48px', // Fixed height
        margin: '0 auto 1rem',
        overflow: 'hidden', // Ensures no content overflows the card boundaries
      }}
    >
      {/* Album Art */}
      <img
        src={albumArt}
        alt={title}
        style={{
          borderRadius: '8px',
          width: '48px',
          height: '48px',
          objectFit: 'cover',
        }}
      />
      {/* Song Details */}
      <div style={{ flex: 1, marginLeft: '1rem', overflow: 'hidden' }}>
        <h2
          style={{
            fontSize: '1rem',
            margin: '0 0 0.25rem',
            fontWeight: 'bold',
            color: '#000',
            whiteSpace: 'nowrap', // Prevents text wrapping
            overflow: 'hidden', // Hides overflowing text
            textOverflow: 'ellipsis', // Adds "..." for truncated text
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            margin: 0,
            color: '#6B7280', // Grey tone
            whiteSpace: 'nowrap', // Prevents text wrapping
            overflow: 'hidden', // Hides overflowing text
            textOverflow: 'ellipsis', // Adds "..." for truncated text
          }}
        >
          {artist}
        </p>
      </div>
      {/* Status Indicator */}
      <div>
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: colors[status.toLowerCase()],
          }}
        />
      </div>
    </div>
  );
}

export default SongCard;
