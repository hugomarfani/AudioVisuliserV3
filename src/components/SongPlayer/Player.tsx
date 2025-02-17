import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { AiOutlineForward, AiOutlineBackward } from 'react-icons/ai';
import { FaPlay, FaPause } from 'react-icons/fa';

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    albumArt: string;
    audioSrc: string;
  };
}

const Player: React.FC<PlayerProps> = ({ track }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      // Avoid NaN by using "|| 0"
      const currentProgress = (audio.currentTime / audio.duration) * 100 || 0;
      setProgress(currentProgress);
    };

    const handleError = (e: Event) => {
      console.error('Failed to load audio source', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime - 10
      );
    }
  };

  const skipForward = () => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration,
        audioRef.current.currentTime + 10
      );
    }
  };

  return (
    <div
      style={{
        /* Minimal outer container – no gradient */
        minHeight: '10vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem 0',
      }}
    >
      {/* Pill-shaped player container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          borderRadius: '999px',
          width: '650px',
          height: '100px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
          padding: '0 1.5rem',
          paddingLeft: '100px', // add padding to the left to accommodate album art
        }}
      >
        {/* Album art */}
        <div
          style={{
            width: '80px', // increased width
            height: '80px', // increased height
            borderRadius: '50%',
            overflow: 'hidden',
            marginRight: '1rem',
            position: 'absolute', // position absolute to fill the corner
            top: '10px', // adjust top position
            left: '10px', // adjust left position
          }}
        >
          <img
            src={track.albumArt}
            alt={track.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Track info and progress bar side by side */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          {/* Title + Artist (top) */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
              {track.title}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#555' }}>
              {track.artist}
            </p>
          </div>

          {/* Progress bar (bottom) */}
          <div
            style={{
              height: '8px',
              borderRadius: '4px',
              background: '#e0e0e0',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: '#000', // pick any colour you like
                borderRadius: '4px',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>

        {/* Playback controls */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            marginRight: '0.5rem',
          }}
        >
          <button onClick={skipBackward} style={iconButtonStyle}>
            <AiOutlineBackward />
          </button>
          <button onClick={togglePlayPause} style={iconButtonStyle}>
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>
          <button onClick={skipForward} style={iconButtonStyle}>
            <AiOutlineForward />
          </button>
          <button style={iconButtonStyle}>Options</button>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} src={track.audioSrc} />
      </div>
    </div>
  );
};

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  margin: '0 0.5rem',
};

export default Player;
