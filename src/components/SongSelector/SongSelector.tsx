import React, { useState, useEffect } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { songs } from './SongData';
import colors from '../../theme/colors';
import axios from 'axios';
import { FaMusic, FaDatabase } from 'react-icons/fa'; // Import music notes icon
import Database from '../Database/Database'; // Import Database component
import Library from '../Library/Library'; // Import Library component

interface SongSelectorProps {
  onTrackSelect: (uri: string) => void;
  accessToken: string;
}

interface Device {
  id: string;
  name: string;
}

const SongSelector: React.FC<SongSelectorProps> = ({ onTrackSelect, accessToken }) => {
  const [selectedFilters, setSelectedFilters] = useState<Array<'Blue' | 'Green' | 'Yellow' | 'Red'>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false); // State to manage database popup
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); // State to manage library popup

  const toggleFilter = (color: 'Blue' | 'Green' | 'Yellow' | 'Red') => {
    setSelectedFilters(prevFilters => {
      if (prevFilters.includes(color)) {
        return prevFilters.filter(f => f !== color);
      } else {
        return [...prevFilters, color];
      }
    });
  };

  useEffect(() => {
    async function fetchDevices() {
      try {
        const response = await axios.get("https://api.spotify.com/v1/me/player/devices", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setDevices(response.data.devices);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    }

    if (accessToken) {
      fetchDevices();
    }
  }, [accessToken]);

  // Filter songs based on both color filters and search term
  const filteredSongs = songs.filter((song) => {
    const matchesFilter = selectedFilters.length === 0 || selectedFilters.includes(song.status);
    const matchesSearch = searchTerm === '' || 
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: '24px', // Corner radius
        padding: '1.5rem', // Padding
        // maxWidth: '400px', // Optional: Ensures the panel has a max width
        margin: '0 auto', // Centers the panel horizontally
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
        position: 'relative', // Add position relative for absolute positioning of the button
      }}
    >
      {/* Database Button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: '7rem',
          backgroundColor: colors.grey2,
          color: colors.white,
          border: 'none',
          borderRadius: '9999px', // Change to pill shape
          padding: '0.5rem 1rem', // Adjust padding for pill shape
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setIsDatabaseOpen(true)} // Open library popup on click
      >
        <FaDatabase />
        <span style={{ marginLeft: '0.5rem' }}>Database</span>
      </button>

      {/* Database Popup */}
      {isDatabaseOpen && <Database onClose={() => setIsDatabaseOpen(false)} />} {/* Render Database component when isDatabaseOpen
      
      {/* Library Button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          backgroundColor: colors.grey2,
          color: colors.white,
          border: 'none',
          borderRadius: '9999px', // Change to pill shape
          padding: '0.5rem 1rem', // Adjust padding for pill shape
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setIsLibraryOpen(true)} // Open library popup on click
      >
        <FaMusic />
        <span style={{ marginLeft: '0.5rem' }}>Library</span>
      </button>

      {/* Library Popup */}
      {isLibraryOpen && <Library onClose={() => setIsLibraryOpen(false)} />} {/* Render Library component when isLibraryOpen is true */}

      {/* Header with Search */}
      <div
        style={{
          color: colors.black,
          marginBottom: '1.5rem',
          marginTop: 0, // Remove margin above
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: 0 }}>Welcome Back</h1>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Say or search a song to begin"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '95%',
              padding: '0.75rem',
              fontSize: '1rem',
              color: '#6B7280',
              backgroundColor: colors.grey5,
              border: 'none',
              borderRadius: '12px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Filter Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'left',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {['Blue', 'Green', 'Yellow', 'Red'].map((color) => (
          <FilterButton
            key={color}
            label={color}
            onClick={() => toggleFilter(color as 'Blue' | 'Green' | 'Yellow' | 'Red')}
            isActive={selectedFilters.includes(color as 'Blue' | 'Green' | 'Yellow' | 'Red')}
          />
        ))}
      </div>

      {/* Song List with No Results Message */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}
      >
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <SongCard
              key={song.id}
              uri={song.id}
              onSelect={onTrackSelect}
              accessToken={accessToken}
              selectedDevice={selectedDevice}
            />
          ))
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '2rem',
            color: '#6B7280',
          }}>
            No songs found
          </div>
        )}
      </div>
    </div>
  );
};

export default SongSelector;
