import React, { useState } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { songs, Song } from './SongData';
import colors from '../../theme/colors';

const SongSelector: React.FC = () => {
  const [filter, setFilter] = useState<'Blue' | 'Green' | 'Yellow' | 'Red'>(
    'Green',
  );

  return (
    <div
      className="p-4 max-w-md mx-auto rounded-lg shadow-md"
      style={{
        backgroundColor: colors.white,
      }}
    >
      {/* Header */}
      <div
        className="text-center mb-4"
        style={{
          color: colors.black,
        }}
      >
        <h1 className="text-xl font-bold">Welcome Back</h1>
        <p className="text-gray-600">Say or search a song to begin</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex justify-center space-x-2 mb-4">
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
        className="grid grid-cols-2 gap-4"
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
