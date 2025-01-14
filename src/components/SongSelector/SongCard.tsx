import React from 'react';

type SongCardProps = {
  title: string;
  artist: string;
  albumArt: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

const SongCard: React.FC<SongCardProps> = ({
  title,
  artist,
  albumArt,
  status,
}) => (
  <div className="flex items-center space-x-4">
    <img
      src={albumArt}
      alt={title}
      className="w-12 h-12 rounded-lg object-cover"
    />
    <div className="flex-1">
      <h2 className="font-medium text-sm">{title}</h2>
      <p className="text-xs text-gray-500">{artist}</p>
    </div>
    <div>
      <span
        className={`inline-block w-3 h-3 rounded-full bg-${status.toLowerCase()}-500`}
      ></span>
    </div>
  </div>
);

export default SongCard;
