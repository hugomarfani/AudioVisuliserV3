import React, {
  useState,
  useRef,
  useEffect,
  CSSProperties,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AiOutlineForward, AiOutlineBackward } from 'react-icons/ai';
import { FaPlay, FaPause } from 'react-icons/fa';

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    albumArt: string;
    audioSrc: string;
  };
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const Player = forwardRef<any, PlayerProps>(
  ({ track, autoPlay = false, onTimeUpdate }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);
    const [rotation, setRotation] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      getCurrentTime: () => audioRef.current?.currentTime || 0,
      getDuration: () => audioRef.current?.duration || 0,
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const updateProgress = () => {
        // Avoid NaN by using "|| 0"
        const currentProgress = (audio.currentTime / audio.duration) * 100 || 0;
        setProgress(currentProgress);
        console.log('Audio progress:', currentProgress);
        onTimeUpdate?.(audio.currentTime, audio.duration);
      };

      const handleError = (e: Event) => {
        console.error('Failed to load audio source', e);
        setIsPlaying(false);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('error', handleError);
      audio.addEventListener('loadstart', () =>
        console.log('Audio loading started'),
      );
      audio.addEventListener('canplay', () => console.log('Audio can play'));
      audio.addEventListener('playing', () =>
        console.log('Audio started playing'),
      );
      audio.addEventListener('pause', () => console.log('Audio paused'));
      audio.addEventListener('ended', () => console.log('Audio ended'));

      // Reset player state when audio source changes
      setIsPlaying(false);
      setProgress(0);

      // Log the audio source when it changes
      if (track.audioSrc) {
        console.log('Audio source:', track.audioSrc);
      }

      // Auto-play when track changes
      if (autoPlay && track.audioSrc) {
        audio.play().catch((error) => {
          console.error('Error auto-playing audio:', error);
          setIsPlaying(false);
        });
        setIsPlaying(true); // Set playing state to true when auto-playing
      }

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('error', handleError);
      };
    }, [track.audioSrc, autoPlay, onTimeUpdate]);

    useEffect(() => {
      let animationFrame: number;
      const updateRotation = () => {
        if (isPlaying) {
          setRotation((prev) => prev + 0.5);
          animationFrame = requestAnimationFrame(updateRotation);
        }
      };
      if (isPlaying) {
        animationFrame = requestAnimationFrame(updateRotation);
      }
      return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying]);

    const togglePlayPause = () => {
      if (!audioRef.current || !track.audioSrc) return;

      console.log('Toggle play/pause, current state:', isPlaying);

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
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
          audioRef.current.currentTime - 10,
        );
      }
    };

    const skipForward = () => {
      if (audioRef.current && audioRef.current.duration) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration,
          audioRef.current.currentTime + 10,
        );
      }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
    };

    const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const hoverX = e.clientX - rect.left;
      const hoverPercentage = (hoverX / rect.width) * 100;
      setHoverProgress(hoverPercentage);
    };

    const handleProgressMouseLeave = () => {
      setHoverProgress(0);
    };

    return (
      <div
        style={{
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
              transform: `rotate(${rotation}deg)`,
              transition: isPlaying ? 'none' : 'transform 0.1s linear',
            }}
          >
            <img
              src={track.albumArt}
              alt={track.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Track info and progress bar side by side */}
          <div
            style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}
          >
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
                cursor: 'pointer', // add cursor pointer to indicate interactivity
              }}
              onClick={handleProgressClick} // add onClick event
              onMouseMove={handleProgressMouseMove} // add onMouseMove event
              onMouseLeave={handleProgressMouseLeave} // add onMouseLeave event
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
              {hoverProgress !== null && (
                <div
                  style={{
                    height: '100%',
                    width: `${hoverProgress}%`,
                    background: 'rgba(85, 85, 85, 0.3)', // ghost bar color
                    borderRadius: '4px',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none', // make sure it doesn't interfere with clicks
                    transition: 'width 0.1s linear',
                  }}
                />
              )}
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
  },
);

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  margin: '0 0.5rem',
};

export default Player;
