import React, { useState, useRef, useEffect } from 'react';
import colors from '../../theme/colors';
import { Progress } from "flowbite-react";

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    albumArt: string;
    audioSrc: string;  // Changed from String to string (proper TypeScript syntax)
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minWidth: '800px',
        background: '#fff',
        paddingLeft: '100px',
        borderRadius: '500px',
        position: 'relative',
        height: '100px',
        overflow: 'hidden',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '80px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={track.albumArt}
            alt={track.title}
            style={{ width: '90%', height: '90%', borderRadius: '50%' }}
          />
        </div>
        <div style={{ flexGrow: 1, paddingLeft: '10px', display: 'flex', flexDirection: 'column' }}>
          <div className="track-info" style={{ flexGrow: 1 }}>
            <h3 style={{ margin: '0' }}>{track.title}</h3>
            <p style={{ margin: '0', paddingTop: '5px', color: colors.grey }}>{track.artist}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <button
              onClick={togglePlayPause}
              className="play-pause"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '10px',
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              className="options"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '10px',
              }}
            >
              Options
            </button>
            <div style={{ width: 'calc(100% - 140px)', marginLeft: '10px', height: '10px', backgroundColor: '#e0e0e0' }}>
              <Progress progress={progress} />
            </div>
          </div>
        </div>
      </div>
      <audio ref={audioRef} controls src={track.audioSrc} />
    </div>
  );
};

export default Player;
