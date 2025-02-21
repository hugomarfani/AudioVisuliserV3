import React, { useState, useEffect } from 'react';
import colors from '../../theme/colors';

interface Song {
  id: string;
  title: string;
  audioPath: string;
  images: string;  // Keep as string since it comes as JSON string
  moods: string;   // Keep as string since it comes as JSON string
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

interface SongTableProps {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
}

const SongTable: React.FC<SongTableProps> = ({ songs, loading, error }) => {
  const [sortField, setSortField] = useState<keyof Song>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  useEffect(() => {
    console.log('Songs in SongTable:', songs);
  }, [songs]);

  if (loading) {
    return <div>Loading songs...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!Array.isArray(songs)) {
    console.error('Songs is not an array:', songs);
    return <div>Invalid songs data</div>;
  }

  if (songs.length === 0) {
    return <div>No songs found</div>;
  }

  const handleSort = (field: keyof Song) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const parseMoods = (moodsString: string): string[] => {
    try {
      return typeof moodsString === 'string' ? JSON.parse(moodsString) : [];
    } catch (e) {
      console.error('Error parsing moods:', e, 'Raw value:', moodsString);
      return [];
    }
  };

  const sortedSongs = [...songs].sort((a, b) => {
    if (sortField === 'moods') {
      const moodsA = parseMoods(a.moods);
      const moodsB = parseMoods(b.moods);
      return sortDirection === 'asc'
        ? moodsA.length - moodsB.length
        : moodsB.length - moodsA.length;
    }
    if (sortField === 'createdAt') {
      return sortDirection === 'asc'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return sortDirection === 'asc'
      ? String(a[sortField]).localeCompare(String(b[sortField]))
      : String(b[sortField]).localeCompare(String(a[sortField]));
  });

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: colors.grey5 }}>
              <th style={tableHeaderStyle} onClick={() => handleSort('title')}>Title</th>
              <th style={tableHeaderStyle} onClick={() => handleSort('moods')}>Moods</th>
              <th style={tableHeaderStyle} onClick={() => handleSort('createdAt')}>Date Added</th>
            </tr>
          </thead>
          <tbody>
            {sortedSongs.map((song) => {
              console.log('Rendering song:', song); // Add this debug line
              const moods = parseMoods(song.moods);
              
              return (
                <tr
                  key={song.id}
                  onClick={() => setSelectedSong(selectedSong?.id === song.id ? null : song)}
                  style={{
                    borderBottom: `1px solid ${colors.grey5}`,
                    cursor: 'pointer',
                    backgroundColor: selectedSong?.id === song.id ? colors.grey5 : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.grey5;
                  }}
                  onMouseLeave={(e) => {
                    if (selectedSong?.id !== song.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td style={tableCellStyle}>{song.title}</td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {moods.map((mood, index) => (
                        <span
                          key={`${song.id}-mood-${index}`}
                          style={{
                            backgroundColor: colors.blue,
                            color: colors.white,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.8rem',
                          }}
                        >
                          {mood}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    {new Date(song.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedSong && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: colors.grey5,
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Selected song: {selectedSong.title}</span>
          <button
            onClick={() => setSelectedSong(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: colors.grey2,
              padding: '0 0.5rem'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

const tableHeaderStyle = {
  padding: '1rem',
  textAlign: 'left' as const,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const tableCellStyle = {
  padding: '1rem',
  textAlign: 'left' as const,
};

export default SongTable;
