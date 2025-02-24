import { useState, useEffect } from 'react';
import { SongModel } from '../database/models/Song';

export const useSongs = () => {
  const [songs, setSongs] = useState<SongModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const fetchedSongs = await window.electron.database.fetchSongs();
      setSongs(fetchedSongs);
    } catch (err) {
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
