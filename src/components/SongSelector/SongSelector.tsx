import React, { useState, useEffect } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { SongModel } from '../../database/models/Song'; // Import Song type
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import axios from 'axios';
import { FaMusic, FaDatabase, FaSync, FaChevronLeft, FaChevronRight } from 'react-icons/fa'; // Import music notes icon
import Database from '../Database/Database'; // Import Database component
import Library from '../Library/Library'; // Import Library component
import SongDetails from '../SongDetails/SongDetails'; // Import SongDetails component

interface SongSelectorProps {
  onTrackSelect: (uri: string) => void;
  accessToken: string;
  useShader: boolean;
}

interface Device {
  id: string;
  name: string;
}

const SongSelector: React.FC<SongSelectorProps> = ({
  useShader,
  onTrackSelect,
  accessToken,
}) => {
  const [selectedFilters, setSelectedFilters] = useState<
    Array<'Blue' | 'Green' | 'Yellow' | 'Red'>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false); // State to manage database popup
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); // State to manage library popup
  const [isSongDetailsOpen, setIsSongDetailsOpen] = useState(false); // State to manage song details popup
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null); // State to store selected song ID
  const { songs, loading, error, refetch } = useSongs();
  const [currentPage, setCurrentPage] = useState(1);
  const songsPerPage = 8;
  const [showParticleManager, setShowParticleManager] = useState<boolean>(false);
  const [selectedParticleSong, setSelectedParticleSong] = useState<string | null>(null);

  const toggleFilter = (color: 'Blue' | 'Green' | 'Yellow' | 'Red') => {
    setSelectedFilters((prevFilters) => {
      if (prevFilters.includes(color)) {
        return prevFilters.filter((f) => f !== color);
      } else {
        return [...prevFilters, color];
      }
    });
  };

  useEffect(() => {
    async function fetchDevices() {
      try {
        const response = await axios.get(
          'https://api.spotify.com/v1/me/player/devices',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        setDevices(response.data.devices);
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    }

    if (accessToken) {
      fetchDevices();
    }
  }, [accessToken]);

  // Filter songs based on both color filters and search term
  const filteredSongs = songs.filter((song) => {
    const matchesFilter =
      selectedFilters.length === 0 ||
      selectedFilters.includes(
        song.dataValues.status as 'Blue' | 'Green' | 'Yellow' | 'Red',
      );
    // console.log('Matches filter:', matchesFilter);
    const matchesSearch =
      searchTerm === '' ||
      song.dataValues.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.dataValues.uploader.toLowerCase().includes(searchTerm.toLowerCase());
    // console.log('Matches search:', matchesSearch);
    return matchesFilter && matchesSearch;
  });

  const handleSongDetailsOpen = (songId: string) => {
    setSelectedSongId(songId);
    setIsSongDetailsOpen(true);
  };

  const reloadSongs = async () => {
    try {
      await window.electron.database.reloadSongs();
      refetch();
    } catch (error) {
      console.error('Error reloading songs:', error);
    }
  };

  // Add function to open particle manager
  const openParticleManager = (songId: string) => {
    setSelectedParticleSong(songId);
    setIsSongDetailsOpen(true);
    // You could add a flag to auto-open the particle section here
  };

  // Calculate pagination values
  const indexOfLastSong = currentPage * songsPerPage;
  const indexOfFirstSong = indexOfLastSong - songsPerPage;
  const currentSongs = filteredSongs.slice(indexOfFirstSong, indexOfLastSong);
  const totalPages = Math.ceil(filteredSongs.length / songsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Reset to first page when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilters, searchTerm]);

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
      {/* Database Button
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
      {/* {isDatabaseOpen && (
        <Database onClose={() => setIsDatabaseOpen(false)} />
      )}{' '} */}
      {/* Render Database component when isDatabaseOpen */}
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
        <span style={{ marginLeft: '0.5rem' }}>New Song</span>
      </button>
      {/* Library Popup */}
      {isLibraryOpen && (
        <Library
          onClose={() => {
            setIsLibraryOpen(false);
            refetch();
          }}
        />
      )}{' '}
      {/* Render Library component when isLibraryOpen is true */}
      {/* Reload Button */}
      {/* <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: '13rem',
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
        onClick={reloadSongs} // Call fetchSongs on click
      >
        <FaSync />
        <span style={{ marginLeft: '0.5rem' }}>Reload</span>
      </button> */}
      {/* Header with Search */}
      <div
        style={{
          color: colors.black,
          marginBottom: '1.5rem',
          marginTop: 0, // Remove margin above
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: 0 }}>
          Welcome Back
        </h1>
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
            onClick={() =>
              toggleFilter(color as 'Blue' | 'Green' | 'Yellow' | 'Red')
            }
            isActive={selectedFilters.includes(
              color as 'Blue' | 'Green' | 'Yellow' | 'Red',
            )}
          />
        ))}
      </div>
      {/* Song List with No Results Message */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          minHeight: '400px', // Fixed height to prevent layout shift
        }}
      >
        {currentSongs.length > 0 ? (
          currentSongs.map((song) => (
            <SongCard
              useShader = {useShader}
              key={song.dataValues.id}
              uri={song.dataValues.id}
              songDetails={song.dataValues}
              onSelect={onTrackSelect}
              accessToken={accessToken}
              selectedDevice={selectedDevice}
              onDetailsClick={handleSongDetailsOpen} // Pass the handleSongDetailsOpen function
              // Add particle management button
              onParticleClick={() => openParticleManager(song.dataValues.id)}
            />
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '2rem',
              color: '#6B7280',
            }}
          >
            No songs found
          </div>
        )}
      </div>
      {/* Pagination Controls */}
      {filteredSongs.length > songsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '1rem',
          gap: '1rem',
        }}>
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{
              backgroundColor: currentPage === 1 ? colors.grey5 : colors.grey2,
              color: currentPage === 1 ? colors.grey3 : colors.white,
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPage === 1 ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <FaChevronLeft />
          </button>
          <span style={{ color: colors.grey2 }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              backgroundColor: currentPage === totalPages ? colors.grey5 : colors.grey2,
              color: currentPage === totalPages ? colors.grey3 : colors.white,
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentPage === totalPages ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <FaChevronRight />
          </button>
        </div>
      )}
      {/* Song Details Popup */}
      {isSongDetailsOpen && selectedSongId && (
        <SongDetails
          onClose={() => setIsSongDetailsOpen(false)}
          songId={selectedSongId}
        />
      )}
    </div>
  );
};

export default SongSelector;
