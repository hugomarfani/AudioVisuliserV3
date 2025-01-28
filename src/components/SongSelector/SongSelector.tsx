import React, { useState, useEffect } from 'react';
import FilterButton from './FilterButton';
import SongCard from './SongCard';
import { songs } from './SongData';
import colors from '../../theme/colors';
import axios from 'axios';

interface SongSelectorProps {
  onTrackSelect: (uri: string) => void;
  accessToken: string;
}

interface Device {
  id: string;
  name: string;
}

const SongSelector: React.FC<SongSelectorProps> = ({ onTrackSelect, accessToken }) => {
  const [filter, setFilter] = useState<'Blue' | 'Green' | 'Yellow' | 'Red'>('Green');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

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

      {/* Device Selector */}
      <div style={{ marginBottom: '1rem' }}>
        <select
          onChange={(e) => setSelectedDevice(e.target.value)}
          value={selectedDevice || ""}
          style={{
            padding: '0.5rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            width: '100%',
          }}
        >
          <option value="" disabled>
            Select a device
          </option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
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
              uri={song.id}
              onSelect={onTrackSelect}
              accessToken={accessToken}
              selectedDevice={selectedDevice}
            />
          ))}
      </div>
    </div>
  );
};

export default SongSelector;
