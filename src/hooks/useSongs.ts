import { useState, useEffect, useCallback, useRef } from 'react';
import { SongModel } from '../database/models/Song';

export const useSongs = () => {
  const [songs, setSongs] = useState<SongModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const maxRetries = useRef(3);
  const currentRetry = useRef(0);

  const fetchSongs = useCallback(async (isRetry = false) => {
    try {
      if (isRetry) {
        console.log(`🔄 Retrying song fetch (attempt ${currentRetry.current + 1}/${maxRetries.current})...`);
      } else {
        console.log('🔄 Fetching songs from database...');
        currentRetry.current = 0;
      }
      
      setLoading(true);
      setError(null);
      
      if (!window.electron?.database?.fetchSongs) {
        throw new Error('Database API not available');
      }
      
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
        
        // Successfully got songs, reset retry counter
        currentRetry.current = 0;
        setSongs(fetchedSongs);
      } else {
        console.warn('⚠️ No songs returned from database');
        
        // If we got an empty array but the API call succeeded, we should still set the songs
        // to an empty array so the component knows we tried
        setSongs([]);
        
        // Check if we should retry
        if (currentRetry.current < maxRetries.current) {
          currentRetry.current++;
          const retryDelay = currentRetry.current * 1000; 
          console.log(`⏱️ Will retry in ${retryDelay}ms...`);
          
          setTimeout(() => {
            fetchSongs(true);
          }, retryDelay);
        }
      }
      
      setFetchCount(prevCount => prevCount + 1);
    } catch (err) {
      console.error('❌ Error fetching songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch songs');
      setSongs([]);
      
      // Check if we should retry after error
      if (currentRetry.current < maxRetries.current) {
        currentRetry.current++;
        const retryDelay = currentRetry.current * 1000;
        console.log(`⏱️ Error encountered, will retry in ${retryDelay}ms...`);
        
        setTimeout(() => {
          fetchSongs(true);
        }, retryDelay);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // If we've only fetched once and got no songs, try again after a shorter delay
  useEffect(() => {
    if (fetchCount === 1 && songs.length === 0 && !loading && currentRetry.current === 0) {
      const timer = setTimeout(() => {
        console.log('🔄 Automatic retry after empty first fetch...');
        fetchSongs(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [fetchCount, songs.length, loading, fetchSongs]);

  return { songs, loading, error, refetch: fetchSongs };
};
