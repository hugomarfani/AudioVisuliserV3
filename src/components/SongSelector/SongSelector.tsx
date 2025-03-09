import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { SongModel } from '../../database/models/Song'; // Import Song type
import { useSongs } from '../../hooks/useSongs';
import { useHue } from '../../hooks/useHue';
import colors from '../../theme/colors';
import axios from 'axios';
import { FaMusic, FaDatabase, FaSync, FaChevronLeft, FaChevronRight, FaParticle, FaCog } from 'react-icons/fa'; // Added FaCog
import { GiParticleAccelerator } from 'react-icons/gi'; // Import particle icon
import { SiGLTF } from 'react-icons/si'; // Import shader-like icon
import Database from '../Database/Database'; // Import Database component
import Library from '../Library/Library'; // Import Library component
import SongDetails from '../SongDetails/SongDetails'; // Import SongDetails component
import { useNavigate } from 'react-router-dom';
import HueSettings from '../HueSettings/HueSettings'; // Import HueSettings component

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
  const navigate = useNavigate();
  const { isConfigured } = useHue();
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
  const [isHueSettingsOpen, setIsHueSettingsOpen] = useState(false); // State to manage Hue settings modal
  const { songs, loading, error, refetch } = useSongs();
  const [currentPage, setCurrentPage] = useState(1);
  const songsPerPage = 8;
  const navigate = useNavigate(); // Add navigation hook
  const [showParticleManager, setShowParticleManager] = useState<boolean>(false);
  const [selectedParticleSong, setSelectedParticleSong] = useState<string | null>(null);
  const [showShaderWarning, setShowShaderWarning] = useState(false);
  const [selectedInvalidSong, setSelectedInvalidSong] = useState<string | null>(null);

  // Initialize visualMode from localStorage or fall back to the prop
  const [visualMode, setVisualMode] = useState(() => {
    const savedMode = localStorage.getItem('visualizationMode');
    return savedMode !== null ? savedMode === 'true' : useShader;
  });

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

  // Save visualization mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('visualizationMode', visualMode.toString());
  }, [visualMode]);

  // Modified song selection handler to navigate based on the visual mode
  const handleSongSelect = (uri: string) => {
    // Find the song details
    const selectedSong = songs.find(song => song.dataValues.id === uri);

    if (selectedSong) {
      const songWithAudio = {
        ...selectedSong.dataValues,
        audioSrc: selectedSong.dataValues.audioPath || '',
      };

      // Check if in shader mode and missing shader files
      if (visualMode && (!songWithAudio.shaderBackground || !songWithAudio.shaderTexture ||
          songWithAudio.shaderBackground === "" || songWithAudio.shaderTexture === "")) {
        // Show warning popup instead of navigating
        setSelectedInvalidSong(songWithAudio.title);
        setShowShaderWarning(true);
        return;
      }

      // Navigate to the appropriate page based on the visualMode
      if (visualMode) {
        navigate(`/aiden/${encodeURIComponent(uri)}`, {
          state: { songDetails: songWithAudio },
        });
      } else {
        navigate(`/particles/${encodeURIComponent(uri)}`, {
          state: { songDetails: songWithAudio },
        });
      }
    }
  };

  // Helper function to check if a song is missing shader files
  const isMissingShaderFiles = (song: any) => {
    return visualMode && (!song.dataValues.shaderBackground || !song.dataValues.shaderTexture ||
            song.dataValues.shaderBackground === "" || song.dataValues.shaderTexture === "");
  };

  // Replace this function
  function reload() {
    // Don't directly require electron
    window.electron.ipcRenderer.sendMessage('reload-window');
  }

  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: '24px', // Corner radius
        padding: '1.5rem', // Padding
        // maxWidth: '400px', // Optional: Ensures the panel has a max width
        margin: '2vh auto',  // Use vh units for responsive vertical spacing
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
        position: 'relative', // Add position relative for absolute positioning of the button
        width: 'clamp(300px, 90%, 1200px)', // Responsive width that grows with screen size but has min/max
        maxHeight: '90vh',                  // Limit height to 90% of viewport
        overflow: 'auto',                   // Allow scrolling within the component if needed
        overflowX: 'hidden', // Explicitly prevent horizontal scrolling
      }}
    >
      {/* Settings Button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: isLibraryOpen ? '13rem' : '13rem',
          backgroundColor: isConfigured ? colors.blue : colors.grey2,
          color: colors.white,
          border: 'none',
          borderRadius: '9999px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setIsHueSettingsOpen(true)}
      >
        <FaCog />
        <span style={{ marginLeft: '0.5rem' }}>Hue Settings</span>
        {isConfigured && (
          <div
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#4ade80',
              borderRadius: '50%',
              marginLeft: '6px'
            }}
          />
        )}
      </button>

      {/* Hue Settings Modal */}
      {isHueSettingsOpen && (
        <HueSettings onClose={() => setIsHueSettingsOpen(false)} />
      )}

      {/* Library Button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          right: '12rem',
          backgroundColor: colors.grey2,
          color: colors.white,
          border: 'none',
          borderRadius: '9999px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(0.75rem, 1vw, 1rem)', // Responsive font size
        }}
        onClick={reload} // Changed from setIsLibraryOpen(true) to reload
      >
        <span style={{ marginLeft: '0.5rem' }}>Reload</span>
      </button>
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
          fontSize: 'clamp(0.75rem, 1vw, 1rem)', // Responsive font size
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
        <h1 style={{
          fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
          fontWeight: 'bold',
          marginTop: 0
        }}>
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
              fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
              color: '#6B7280',
              backgroundColor: colors.grey5,
              border: 'none',
              borderRadius: '12px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Filter Buttons and Mode Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap', // Allow wrapping on small screens
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

        {/* Visualization Mode Toggle Slider - moved to be inline with filters */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginLeft: '1rem', // Add some space from the filters if they wrap
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            color: !visualMode ? colors.blue : colors.grey3,
            marginRight: '0.5rem',
            fontWeight: !visualMode ? 'bold' : 'normal',
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)', // Slightly smaller for inline presentation
          }}>
            Particles
          </span>

          <div
            onClick={() => setVisualMode(!visualMode)}
            style={{
              width: '48px', // Slightly smaller for inline presentation
              height: '24px',
              backgroundColor: visualMode ? colors.green : colors.blue,
              borderRadius: '12px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
            }}
          >
            <div style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              backgroundColor: colors.white,
              borderRadius: '50%',
              top: '2px',
              left: visualMode ? '26px' : '2px',
              transition: 'left 0.3s',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}></div>
          </div>

          <span style={{
            display: 'flex',
            alignItems: 'center',
            color: visualMode ? colors.green : colors.grey3,
            marginLeft: '0.5rem',
            fontWeight: visualMode ? 'bold' : 'normal',
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)', // Slightly smaller for inline presentation
          }}>
            Shader
          </span>
        </div>
      </div>

      {/* Song List with No Results Message */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(min(100%, 250px), 1fr))', // Fixed 2-column layout
          gap: '2rem', // Increased gap for better spacing with larger cards
          minHeight: '500px', // Increased minimum height
          alignContent: currentSongs.length < 1 ? 'space-between' : 'flex-start',
          paddingTop: '1rem',
          paddingBottom: '1rem',
        }}
      >
        {currentSongs.length > 0 ? (
          currentSongs.map((song) => (
            <SongCard
              useShader = {visualMode}
              key={song.dataValues.id}
              uri={song.dataValues.id}
              songDetails={song.dataValues}
              onSelect={handleSongSelect}
              accessToken={accessToken}
              selectedDevice={selectedDevice}
              onDetailsClick={handleSongDetailsOpen} // Pass the handleSongDetailsOpen function
              // Add particle management button
              onParticleClick={() => openParticleManager(song.dataValues.id)}
              // Add disabled state for songs missing shader files in shader mode
              disabled={isMissingShaderFiles(song)}
            />
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem', // Increased padding
              color: '#6B7280',
              fontSize: '1.2rem', // Larger font for empty state
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
      {/* Shader Warning Popup */}
      {showShaderWarning && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setShowShaderWarning(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: colors.white,
              padding: '2rem',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              zIndex: 1001,
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: colors.red }}>Missing Shader Files</h3>
            <p style={{ color: colors.grey1, lineHeight: '1.5' }}>
              The song "{selectedInvalidSong}" is missing required shader files.
              To use Shader mode, please make sure this song has both a background shader and a texture shader assigned.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button
                style={{
                  backgroundColor: colors.grey5,
                  color: colors.grey1,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setShowShaderWarning(false)}
              >
                Close
              </button>
              <button
                style={{
                  backgroundColor: colors.blue,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  // Find the song ID and open the song details
                  const song = songs.find(s => s.dataValues.title === selectedInvalidSong);
                  if (song) {
                    setShowShaderWarning(false);
                    handleSongDetailsOpen(song.dataValues.id);
                  }
                }}
              >
                Edit Song Details
              </button>
            </div>
          </div>
        </>
      )}
      {/* Song Details Popup */}
      {isSongDetailsOpen && selectedSongId && (

            <SongDetails
              onClose={() => {
                setIsSongDetailsOpen(false);
                setSelectedSongId(null);
              }}
              songId={selectedSongId} />
      )}
    </div>
  );
};

export default SongSelector;
