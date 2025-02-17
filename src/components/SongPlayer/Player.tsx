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
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
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
        minHeight: '10vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* The pill-shaped container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column', // Stack controls on top, progress bar at bottom
          justifyContent: 'center',
          background: '#fff',
          borderRadius: '999px',
          width: '650px',
          height: '100px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top row: album art, track info, skip/play/forward, Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            padding: '0 1.5rem',
          }}
        >
          {/* Album art */}
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              overflow: 'hidden',
              marginRight: '1rem',
            }}
          >
            <img
              src={track.albumArt}
              alt={track.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Title + Artist */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              {track.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#555',
              }}
            >
              {track.artist}
            </p>
          </div>

          {/* Controls on the right */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
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
        </div>

        {/* Bottom row: full-width custom progress bar */}
        <div
          style={{
            width: '100%',
            padding: '0 1.5rem 0.5rem 1.5rem',
          }}
        >
          <div style={{ height: '8px', borderRadius: '4px', background: '#e0e0e0', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'red',
                borderRadius: '4px',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
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
