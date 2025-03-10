import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import SongDetails from '../SongDetails/SongDetails';
import Library from '../Library/Library';
import Database from '../Database/Database'; // (Optional: currently not rendered)
import HueSettings from '../HueSettings/HueSettings';
import { SongModel } from '../../database/models/Song'; // Import Song type if needed
import { useSongs } from '../../hooks/useSongs';
import { useHue } from '../../hooks/useHue';
import colors from '../../theme/colors';
import axios from 'axios';
import {
  FaMusic,
  FaDatabase,
  FaSync,
  FaChevronLeft,
  FaChevronRight,
  FaCog,
} from 'react-icons/fa';

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
  onTrackSelect,
  accessToken,
  useShader,
}) => {
  const navigate = useNavigate();
  const { songs, loading, error, refetch } = useSongs();
  const { isConfigured } = useHue();

  // States for filters, search and devices
  const [selectedFilters, setSelectedFilters] = useState<
    Array<'Blue' | 'Green' | 'Yellow' | 'Red'>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // States for modals/popups
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false); // (Optional)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSongDetailsOpen, setIsSongDetailsOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isHueSettingsOpen, setIsHueSettingsOpen] = useState(false);

  // Additional states from file A
  const [visualMode, setVisualMode] = useState(() => {
    const savedMode = localStorage.getItem('visualizationMode');
    return savedMode !== null ? savedMode === 'true' : useShader;
  });
  const [showParticleManager, setShowParticleManager] = useState<boolean>(false);
  const [selectedParticleSong, setSelectedParticleSong] = useState<string | null>(null);
  const [showShaderWarning, setShowShaderWarning] = useState(false);
  const [selectedInvalidSong, setSelectedInvalidSong] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const songsPerPage = 8;

  // Fetch devices from Spotify API
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

  // Filter songs based on colour filters and search term
  const filteredSongs = songs.filter((song) => {
    const matchesFilter =
      selectedFilters.length === 0 ||
      selectedFilters.includes(
        song.dataValues.status as 'Blue' | 'Green' | 'Yellow' | 'Red',
      );
    const matchesSearch =
      searchTerm === '' ||
      song.dataValues.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.dataValues.uploader.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Toggle a filter colour
  const toggleFilter = (color: 'Blue' | 'Green' | 'Yellow' | 'Red') => {
    setSelectedFilters((prevFilters) => {
      if (prevFilters.includes(color)) {
        return prevFilters.filter((f) => f !== color);
      } else {
        return [...prevFilters, color];
      }
    });
  };

  // Open song details modal
  const handleSongDetailsOpen = (songId: string) => {
    setSelectedSongId(songId);
    setIsSongDetailsOpen(true);
  };

  // Reload songs via electron and refresh the list
  const reloadSongs = async () => {
    try {
      await window.electron.database.reloadSongs();
      refetch();
    } catch (error) {
      console.error('Error reloading songs:', error);
    }
  };

  // Function to reload the window
  function reload() {
    window.electron.ipcRenderer.sendMessage('reload-window');
  }

  // Open particle manager for a specific song (if applicable)
  const openParticleManager = (songId: string) => {
    setSelectedParticleSong(songId);
    setIsSongDetailsOpen(true);
    // Additional logic for particle management can be added here
  };

  // Pagination calculations
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

  // Save visualisation mode in localStorage
  useEffect(() => {
    localStorage.setItem('visualizationMode', visualMode.toString());
  }, [visualMode]);

  // Check if a song is missing required shader files in shader mode
  const isMissingShaderFiles = (song: any) => {
    return visualMode && (
      !song.dataValues.shaderBackground ||
      !song.dataValues.shaderTexture ||
      song.dataValues.shaderBackground === "" ||
      song.dataValues.shaderTexture === ""
    );
  };

  // Handle song selection with shader file check and navigation
  const handleSongSelect = (uri: string) => {
    const selectedSong = songs.find(song => song.dataValues.id === uri);
    if (selectedSong) {
      const songWithAudio = {
        ...selectedSong.dataValues,
        audioSrc: selectedSong.dataValues.audioPath || '',
      };
      if (visualMode && (
          !songWithAudio.shaderBackground ||
          !songWithAudio.shaderTexture ||
          songWithAudio.shaderBackground === "" ||
          songWithAudio.shaderTexture === ""
        )) {
        setSelectedInvalidSong(songWithAudio.title);
        setShowShaderWarning(true);
        return;
      }
      // Navigate based on the visualisation mode
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

  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: '24px',
        padding: '1.5rem',
        margin: '2vh auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        width: 'clamp(300px, 90%, 1200px)',
        maxHeight: '90vh',
        overflow: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Top-right button bar */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={() => { reload(); reloadSongs(); }}
          style={{
            backgroundColor: colors.grey2,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(0.75rem, 1vw, 1rem)',
          }}
        >
          <FaSync />
          <span style={{ marginLeft: '0.5rem' }}>Reload</span>
        </button>
        <button
          onClick={() => setIsHueSettingsOpen(true)}
          style={{
            backgroundColor: isConfigured ? colors.blue : colors.grey2,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            fontSize: 'clamp(0.75rem, 1vw, 1rem)',
          }}
        >
          <FaCog />
          <span style={{ marginLeft: '0.5rem' }}>Hue Settings</span>
          {isConfigured && (
            <div
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                backgroundColor: '#4ade80',
                borderRadius: '50%',
              }}
            />
          )}
        </button>
        <button
          onClick={() => setIsLibraryOpen(true)}
          style={{
            backgroundColor: colors.grey2,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(0.75rem, 1vw, 1rem)',
          }}
        >
          <FaMusic />
          <span style={{ marginLeft: '0.5rem' }}>New Song</span>
        </button>
      </div>

      {/* Header with search */}
      <div style={{ color: colors.black, marginBottom: '1.5rem', marginTop: 0 }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 'bold', marginTop: 0 }}>
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

      {/* Filter buttons and visualisation mode toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['Blue', 'Green', 'Yellow', 'Red'].map((color) => (
            <FilterButton
              key={color}
              label={color}
              onClick={() =>
                toggleFilter(color as 'Blue' | 'Green' | 'Yellow' | 'Red')
              }
              isActive={selectedFilters.includes(
                color as 'Blue' | 'Green' | 'Yellow' | 'Red'
              )}
            />
          ))}
        </div>
        {/* Visualisation Mode Toggle Slider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginLeft: '1rem',
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            color: !visualMode ? colors.blue : colors.grey3,
            marginRight: '0.5rem',
            fontWeight: !visualMode ? 'bold' : 'normal',
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)',
          }}>
            Particles
          </span>
          <div
            onClick={() => setVisualMode(!visualMode)}
            style={{
              width: '48px',
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
            fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)',
          }}>
            Shader
          </span>
        </div>
      </div>

      {/* Song list grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(min(100%, 250px), 1fr))',
          gap: '2rem',
          minHeight: '500px',
          alignContent: currentSongs.length < 1 ? 'space-between' : 'flex-start',
          paddingTop: '1rem',
          paddingBottom: '1rem',
        }}
      >
        {currentSongs.length > 0 ? (
          currentSongs.map((song) => (
            <SongCard
              useShader={visualMode}
              key={song.dataValues.id}
              uri={song.dataValues.id}
              songDetails={song.dataValues}
              onSelect={handleSongSelect}
              accessToken={accessToken}
              selectedDevice={selectedDevice}
              onDetailsClick={handleSongDetailsOpen}
              onParticleClick={() => openParticleManager(song.dataValues.id)}
              disabled={isMissingShaderFiles(song)}
            />
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem',
              color: '#6B7280',
              fontSize: '1.2rem',
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
              To use Shader mode, please ensure the song has both a background and a texture shader.
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
          songId={selectedSongId}
        />
      )}

      {/* Library Popup */}
      {isLibraryOpen && (
        <Library
          onClose={() => {
            setIsLibraryOpen(false);
            refetch();
          }}
        />
      )}

      {/* Hue Settings Modal */}
      {isHueSettingsOpen && (
        <HueSettings onClose={() => setIsHueSettingsOpen(false)} />
      )}
    </div>
  );
};

export default SongSelector;
