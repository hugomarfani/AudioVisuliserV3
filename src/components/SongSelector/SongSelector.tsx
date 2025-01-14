import React, { useState } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { songs } from './SongData';
import colors from '../../theme/colors';

const SongSelector: React.FC = () => {
  const [filter, setFilter] = useState<'Blue' | 'Green' | 'Yellow' | 'Red'>(
    'Green',
  );

  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: '24px', // Corner radius
        padding: '1.5rem', // Padding
        // maxWidth: '400px', // Optional: Ensures the panel has a max width
        margin: '0 auto', // Centers the panel horizontally
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
      }}
    >
      {/* Header */}
      <div
        style={{
          color: colors.black,
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Welcome Back</h1>
        <p style={{ fontSize: '1rem', color: '#6B7280' }}>
          Say or search a song to begin
        </p>
      </div>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', justifyContent: 'left', gap: '0.5rem', marginBottom: '1rem' }}>
        {['Blue', 'Green', 'Yellow', 'Red'].map((color) => (
          <FilterButton
            key={color}
            label={color}
            onClick={() =>
              setFilter(color as 'Blue' | 'Green' | 'Yellow' | 'Red')
            }
            isActive={filter === color}
          />
        ))}
      </div>

      {/* Song List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}
      >
        {songs
          .filter((song) => song.status === filter)
          .map((song) => (
            <SongCard
              key={song.id}
              title={song.title}
              artist={song.artist}
              albumArt={song.albumArt}
              status={song.status}
            />
          ))}
      </div>
    </div>
  );
};

export default SongSelector;
