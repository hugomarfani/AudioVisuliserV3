import React, { useState } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { songs, Song } from './SongData';

const SongSelector: React.FC = () => {
  const [filter, setFilter] = useState<'Blue' | 'Green' | 'Yellow' | 'Red'>('Green');

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">Welcome Back</h1>
        <p className="text-gray-600">Say or search a song to begin</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex justify-center space-x-2 mb-4">
        {['Blue', 'Green', 'Yellow', 'Red'].map((color) => (
          <FilterButton
            key={color}
            label={color}
            isActive={filter === color}
            onClick={() => setFilter(color as 'Blue' | 'Green' | 'Yellow' | 'Red')}
          />
        ))}
      </div>

      {/* Song List */}
      <div className="grid grid-cols-2 gap-4">
        {songs
          .filter((song) => song.status === filter)
          .map((song, index) => (
            <SongCard key={index} {...song} />
          ))}
      </div>
    </div>
  );
};

export default SongSelector;
