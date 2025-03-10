import { useState, useEffect } from 'react';
import { SongModel } from '../database/models/Song';

export const useSongs = () => {
  const [songs, setSongs] = useState<SongModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSongs = async () => {
    try {
      console.log('🔄 Fetching songs from database...');
      setLoading(true);
      const fetchedSongs = await window.electron.database.fetchSongs();
      console.log('✅ Fetched songs count:', fetchedSongs.length);

      // Debug: Log the structure of the first song (if available)
      if (fetchedSongs.length > 0) {
        console.log('📝 First song structure:', {
          id: fetchedSongs[0].dataValues.id,
          title: fetchedSongs[0].dataValues.title,
          hasColours: !!fetchedSongs[0].dataValues.colours,
          coloursLength: fetchedSongs[0].dataValues.colours ? fetchedSongs[0].dataValues.colours.length : 0
        });
      }

      setSongs(fetchedSongs);
    } catch (err) {
      console.error('❌ Error fetching songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch songs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  return { songs, loading, error, refetch: fetchSongs };
};
