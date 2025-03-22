import React, {
  useState,
  useRef,
  useEffect,
  CSSProperties,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AiOutlineForward, AiOutlineBackward } from 'react-icons/ai';
import { FaPlay, FaPause, FaCog } from 'react-icons/fa';
import HueStatusPanel from '../HueSettings/HueStatusPanel';
import HueSettings from '../HueSettings/HueSettings';
import { useHue } from '../../hooks/useHue';
import { useSongs } from '../../hooks/useSongs';

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    albumArt: string;
    audioSrc: string;
    id?: string;
  };
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean, audioData?: Uint8Array) => void;
}

const Player = forwardRef<any, PlayerProps>(
  ({ track, autoPlay = false, onTimeUpdate, onPlayStateChange }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);
    const [rotation, setRotation] = useState(0);
    const [isHueStatusOpen, setIsHueStatusOpen] = useState(false);
    const [isHueSettingsOpen, setIsHueSettingsOpen] = useState(false);
    const [isHueConnected, setIsHueConnected] = useState(false);
    const [colorsLoaded, setColorsLoaded] = useState(false);

    // Get songs from database to access their colors
    const { songs, loading, refetch } = useSongs();

    // Debug: Log the track ID we received
    // console.log('🔍 Track ID received in Player:', track.id);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    // Beat detection and reactive lighting refs
    const energyHistory = useRef<number[]>([]);
    const vocalEnergyHistory = useRef<number[]>([]);
    const beatThreshold = useRef(1.15);
    const beatHoldTime = useRef(100);
    const lastBeatTime = useRef(0);
    const debugCounter = useRef(0);
    const lastUpdateTime = useRef(0);
    const updateIntervalMs = useRef(33);

    const vocalEnergyThreshold = useRef(80);
    const vocalEnergyReleaseThreshold = useRef(60);
    const isHighVocalEnergy = useRef(false);
    const vocalEnergyDuration = useRef(0);
    const vocalDetectionCounter = useRef(0);
    const vocalDropoutTolerance = useRef(3);

    const currentColorIndex = useRef(0);
    const colorChangeCount = useRef(0);
    const colorChangeThreshold = useRef(8);
    const baseColors = useRef<number[][]>([
      [255, 0, 0],
      [255, 165, 0],
      [255, 255, 0],
      [0, 255, 0],
      [0, 0, 255],
      [128, 0, 128],
      [255, 105, 180],
    ]);
    const lastColorChangeTime = useRef(0);
    const minTimeBetweenColorChanges = useRef(5000);

    // Hue hook to manage Philips Hue integration
    const {
      isConfigured,
      isStreamingActive,
      startHueStreaming,
      stopHueStreaming,
      processBeat,
      updateBeatStatusDirectly,
    } = useHue();

    // Load colors from the database for the current track
    useEffect(() => {
      if (!track.id) {
        console.log('⚠️ No track ID provided, cannot load colors');
        return;
      }

      // Always log the current state
      console.log('🔍 Song data status:', { 
        trackId: track.id, 
        loading, 
        songsCount: songs.length,
        songsLoaded: songs.length > 0 && songs[0] && !!songs[0].dataValues
      });
      
      if (loading) {
        console.log('⏳ Songs are still loading, waiting...');
        return;
      }

      // If songs array is empty after loading is complete, trigger a refetch
      if (!loading && songs.length === 0) {
        console.log('⚠️ Songs array is empty after loading completed, triggering refetch...');
        refetch();
        return;
      }

      console.log('🔍 Trying to find song with ID:', track.id);
      
      // Check if songs are properly loaded with dataValues
      const validSongs = songs.filter(song => song && song.dataValues);
      
      if (validSongs.length === 0) {
        console.log('⚠️ No valid songs loaded yet, retrying...');
        refetch();
        return;
      }
      
      console.log('🔍 Available songs:', validSongs.map(song => ({
        id: song.dataValues.id,
        title: song.dataValues.title,
        hasColors: song.dataValues.colours && song.dataValues.colours.length > 0
      })));

      // Try to find the song by exact ID match first
      let currentSong = validSongs.find(song => song.dataValues.id === track.id);
      
      // If not found, try case-insensitive comparison as fallback
      if (!currentSong && typeof track.id === 'string') {
        currentSong = validSongs.find(song => 
          typeof song.dataValues.id === 'string' && 
          song.dataValues.id.toLowerCase() === track.id.toLowerCase()
        );
        
        // If still not found, try partial matching as last resort
        if (!currentSong) {
          currentSong = validSongs.find(song => 
            typeof song.dataValues.id === 'string' && 
            typeof track.id === 'string' && 
            (song.dataValues.id.includes(track.id) || track.id.includes(song.dataValues.id))
          );
        }
      }

      console.log('🔍 Found song:', currentSong ? {
        id: currentSong.dataValues.id,
        title: currentSong.dataValues.title,
        colours: currentSong.dataValues.colours
      } : 'Not found');

      if (currentSong && currentSong.dataValues.colours && currentSong.dataValues.colours.length > 0) {
        try {
          // Convert hex colors to RGB arrays
          const rgbColors: number[][] = currentSong.dataValues.colours.map((hexColor: string) => {
            // Remove '#' if present
            const hex = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;

            // Parse RGB components
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            // Validate the RGB values
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
              console.warn(`⚠️ Invalid hex color found: ${hexColor}`);
              return [255, 255, 255]; // Default to white
            }

            return [r, g, b];
          });

          if (rgbColors.length > 0) {
            baseColors.current = rgbColors;
            console.log('🎨 Loaded colors from database:', rgbColors);
            setColorsLoaded(true);
          }
        } catch (error) {
          console.error('❌ Error parsing colors:', error);
          // Keep default colors
        }
      } else {
        console.log('⚠️ No colors found for this song or song not found, using default colors');
        if (currentSong) {
          console.log('🔍 Song found but no colors:',
            currentSong.dataValues.id,
            currentSong.dataValues.title,
            'Has colours property:', !!currentSong.dataValues.colours,
            'Colours length:', currentSong.dataValues.colours ? currentSong.dataValues.colours.length : 0
          );
        }
      }
    }, [track.id, songs, loading, refetch]);

    // Add additional aggressive retry at startup
    useEffect(() => {
      // If songs haven't loaded yet or there's an issue, try to fetch them again
      if (track.id && !loading) {
        if (songs.length === 0) {
          console.log('🔄 No songs loaded, triggering refetch...');
          refetch();
        } else if (!songs.some(song => song && song.dataValues && song.dataValues.id === track.id)) {
          console.log('🔄 Track not found in songs, requesting fresh data...');
          setTimeout(() => refetch(), 1000); // Add slight delay before retry
        }
      }
    }, [songs, loading, track.id, refetch]);

    useImperativeHandle(ref, () => ({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      getCurrentTime: () => audioRef.current?.currentTime || 0,
      getDuration: () => audioRef.current?.duration || 0,
      getAudioData: () => dataArrayRef.current,
    }));

    // Initialise AudioContext and analyser for beat detection
    useEffect(() => {
      if (!audioRef.current) return;

      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
          analyzerRef.current = audioContextRef.current.createAnalyser();
          analyzerRef.current.fftSize = 2048;
          analyzerRef.current.smoothingTimeConstant = 0.85;

          const bufferLength = analyzerRef.current.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLength);

          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
            audioRef.current
          );
          sourceNodeRef.current.connect(analyzerRef.current);
          analyzerRef.current.connect(audioContextRef.current.destination);

          console.log('🎵 Audio analyser setup successfully, bufferLength:', bufferLength);
        } catch (error) {
          console.error('Failed to initialise Web Audio API:', error);
        }
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []);

    // Connect to Hue bridge when configured
    useEffect(() => {
      const connectToHue = async () => {
        if (isConfigured && !isStreamingActive) {
          console.log('🔄 Attempting to connect to Hue bridge...');
          const success = await startHueStreaming();
          setIsHueConnected(success);
          console.log('🔌 Hue connection attempt:', success ? 'Connected!' : 'Failed');
        }
      };

      connectToHue();

      return () => {
        if (isStreamingActive) {
          stopHueStreaming();
          setIsHueConnected(false);
          console.log('🔌 Hue disconnected on cleanup');
        }
      };
    }, [isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming]);

    // Resume AudioContext if needed (required by some browsers)
    useEffect(() => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch((err) => {
          console.error('Failed to resume audio context:', err);
        });
      }
    }, [track.audioSrc]);

    // Beat detection and audio analysis loop
    const analyzeAudioAndDetectBeats = async () => {
      if (!analyzerRef.current || !dataArrayRef.current) return;

      analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
      onPlayStateChange?.(isPlaying, dataArrayRef.current);

      const now = Date.now();
      if (now - lastUpdateTime.current >= updateIntervalMs.current) {
        try {
          debugCounter.current += 1;
          const data = dataArrayRef.current;

          const bassRange = Math.floor(data.length * 0.08);
          const bassSegment = data.slice(0, bassRange);
          const midLowRange = Math.floor(data.length * 0.25);
          const midLowSegment = data.slice(bassRange, midLowRange);
          const midHighRange = Math.floor(data.length * 0.60);
          const midHighSegment = data.slice(midLowRange, midHighRange);
          const highSegment = data.slice(midHighRange);

          const bassEnergy = Math.min(
            255,
            (bassSegment.reduce((sum, val) => sum + val, 0) / bassSegment.length) * 1.2
          );
          const midLowEnergy =
            midLowSegment.reduce((sum, val) => sum + val, 0) / midLowSegment.length;
          const midHighEnergy =
            midHighSegment.reduce((sum, val) => sum + val, 0) / midHighSegment.length;
          const highEnergy =
            highSegment.reduce((sum, val) => sum + val, 0) / highSegment.length;

          // Vocal energy estimation
          const vocalEnergy = (midHighEnergy * 1.5 + highEnergy * 0.5) / 2;
          const decayFactor = 0.7;
          vocalEnergyHistory.current.push(vocalEnergy);
          if (vocalEnergyHistory.current.length > 30) {
            vocalEnergyHistory.current = vocalEnergyHistory.current
              .slice(-30)
              .map((e, i) => e * Math.pow(decayFactor, 30 - i));
          }
          const recentVocalAvg =
            vocalEnergyHistory.current.slice(-10).reduce((sum, e) => sum + e, 0) / 10;
          const longTermVocalAvg =
            vocalEnergyHistory.current.reduce((sum, e) => sum + e, 0) /
            vocalEnergyHistory.current.length;

          if (isHighVocalEnergy.current) {
            if (
              vocalEnergy < vocalEnergyReleaseThreshold.current ||
              vocalEnergy < longTermVocalAvg * 1.3
            ) {
              vocalDetectionCounter.current++;
              if (vocalDetectionCounter.current >= vocalDropoutTolerance.current) {
                isHighVocalEnergy.current = false;
                vocalDetectionCounter.current = 0;
                vocalEnergyDuration.current = 0;
              }
            } else {
              vocalDetectionCounter.current = Math.max(0, vocalDetectionCounter.current - 1);
            }
          } else {
            isHighVocalEnergy.current =
              vocalEnergy > vocalEnergyThreshold.current &&
              vocalEnergy > recentVocalAvg * 1.8 &&
              vocalEnergy > longTermVocalAvg * 1.5;
          }

          if (isHighVocalEnergy.current) {
            vocalEnergyDuration.current += updateIntervalMs.current;
            if (vocalEnergyDuration.current % 500 === 0) {
              console.log(
                `🎵 Sustained vocal energy: ${vocalEnergyDuration.current}ms at energy level ${vocalEnergy.toFixed(
                  1
                )}`
              );
            }
          } else if (isHighVocalEnergy.current) {
            console.log(`🎤 Vocal energy ended. Duration: ${vocalEnergyDuration.current}ms`);
            vocalEnergyDuration.current = 0;
          }

          // Total energy for beat detection
          const totalEnergy =
            (bassEnergy * 4 + midLowEnergy + midHighEnergy + highEnergy) / 7;
          energyHistory.current.push(totalEnergy);
          if (energyHistory.current.length > 20) {
            energyHistory.current.shift();
          }
          const avgEnergy =
            energyHistory.current.reduce((sum, e) => sum + e, 0) /
            Math.max(1, energyHistory.current.length);
          const dynamicThreshold = Math.max(1.1, avgEnergy > 50 ? 1.2 : 1.4);
          const isBeat =
            totalEnergy > avgEnergy * dynamicThreshold &&
            now - lastBeatTime.current > beatHoldTime.current &&
            bassEnergy > 15;

          if (debugCounter.current % 20 === 0) {
            console.log(
              `🔊 Energy - Bass: ${bassEnergy.toFixed(
                1
              )}, Mid-Low: ${midLowEnergy.toFixed(
                1
              )}, Mid-High: ${midHighEnergy.toFixed(
                1
              )}, High: ${highEnergy.toFixed(1)}, Vocal: ${vocalEnergy.toFixed(1)}`
            );
          }

          if (isBeat) {
            colorChangeCount.current++;
            if (
              colorChangeCount.current >= colorChangeThreshold.current &&
              now - lastColorChangeTime.current > minTimeBetweenColorChanges.current
            ) {
              colorChangeCount.current = 0;
              lastColorChangeTime.current = now;
              currentColorIndex.current =
                (currentColorIndex.current + 1) % baseColors.current.length;
              console.log(`🎨 Changing to new colour: ${currentColorIndex.current}`);
            }
            lastBeatTime.current = now;
            console.log(
              `🥁 BEAT DETECTED! 🎵 Energy: ${totalEnergy.toFixed(
                1
              )} vs Threshold: ${(avgEnergy * dynamicThreshold).toFixed(1)}`
            );
          }

          const currentColor = baseColors.current[currentColorIndex.current];
          let brightness = 0.5;
          if (isBeat) {
            brightness = Math.min(1.0, 0.7 + (totalEnergy / 256) * 0.3);
          }
          if (isHighVocalEnergy.current) {
            const vocalBrightnessFactor = Math.min(1.0, 0.85 + (vocalEnergyDuration.current / 1500) * 0.15);
            const energyBoost = Math.max(0, (vocalEnergy - vocalEnergyThreshold.current) / 100);
            const totalBrightness = Math.min(1.0, vocalBrightnessFactor + energyBoost);
            brightness = Math.max(brightness, totalBrightness);
          }
          const finalColor = currentColor.map((c) => Math.round(c * brightness));

          const scaledBassEnergy = Math.min(255, bassEnergy * 2);
          const scaledMidEnergy = Math.min(255, ((midLowEnergy + midHighEnergy) / 2) * 2);
          const scaledHighEnergy = Math.min(255, highEnergy * 2);

          if (isStreamingActive) {
            const visualizationData = new Uint8Array(dataArrayRef.current.length);
            dataArrayRef.current.forEach((value, index) => {
              visualizationData[index] = value;
            });

            const beatData = {
              isBeat,
              energy: totalEnergy,
              bassEnergy: scaledBassEnergy,
              midEnergy: scaledMidEnergy,
              highEnergy: scaledHighEnergy,
              color: finalColor,
              vocalEnergy: vocalEnergy,
              audioData: visualizationData,
              brightness: brightness,
              vocalActive: isHighVocalEnergy.current,
            };

            updateBeatStatusDirectly({
              isDetected: isBeat,
              energy: totalEnergy,
              bassEnergy: scaledBassEnergy,
              midEnergy: scaledMidEnergy,
              highEnergy: scaledHighEnergy,
              vocalEnergy: vocalEnergy,
              currentColor: finalColor,
              brightness: brightness,
              vocalActive: isHighVocalEnergy.current,
              audioData: visualizationData,
            });

            await processBeat(beatData);

            if (debugCounter.current % 10 === 0) {
              console.log('Audio data sent to Hue:', {
                beat: isBeat,
                bass: scaledBassEnergy.toFixed(0),
                mid: scaledMidEnergy.toFixed(0),
                high: scaledHighEnergy.toFixed(0),
                vocal: vocalEnergy.toFixed(0),
                active: isHighVocalEnergy.current,
              });
            }
          }

          lastUpdateTime.current = now;
        } catch (error) {
          console.error('Error in beat detection:', error);
        }
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(analyzeAudioAndDetectBeats);
      }
    };

    // Set up or cancel the audio analysis loop based on play state
    useEffect(() => {
      if (isPlaying) {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        console.log('▶️ Starting audio analysis loop');
        animationFrameRef.current = requestAnimationFrame(analyzeAudioAndDetectBeats);
      } else {
        if (animationFrameRef.current) {
          console.log('⏹️ Stopping audio analysis loop');
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (isStreamingActive && isHueConnected) {
          window.electron.hue.processBeat({
            isBeat: false,
            energy: 0,
            bassEnergy: 0,
            midEnergy: 0,
            highEnergy: 0,
            color: baseColors.current[currentColorIndex.current],
            vocalEnergy: 0,
            audioData: new Uint8Array(analyzerRef.current?.frequencyBinCount || 0),
            brightness: 0.5,
            vocalActive: false,
          });
        }
        onPlayStateChange?.(false);
      }
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }, [isPlaying, isStreamingActive, isHueConnected, onPlayStateChange]);

    // Update progress, handle errors and ended events
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const updateProgress = () => {
        const currentProgress = (audio.currentTime / audio.duration) * 100 || 0;
        setProgress(currentProgress);
        onTimeUpdate?.(audio.currentTime, audio.duration);
      };

      const handleError = (e: Event) => {
        console.error('Failed to load audio source', e);
        setIsPlaying(false);
        onPlayStateChange?.(false);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        onPlayStateChange?.(false);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('error', handleError);
      audio.addEventListener('ended', handleEnded);

      if (autoPlay && track.audioSrc) {
        audio.play().catch((error) => {
          console.error('Error auto-playing audio:', error);
          setIsPlaying(false);
          onPlayStateChange?.(false);
        });
        setIsPlaying(true);
        onPlayStateChange?.(true);
      }

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('ended', handleEnded);
      };
    }, [track.audioSrc, autoPlay, onTimeUpdate, onPlayStateChange]);

    // Rotate album art when playing
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

    // Playback control handlers
    const togglePlayPause = () => {
      if (!audioRef.current || !track.audioSrc) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        audioRef.current.play().catch((error) => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
          onPlayStateChange?.(false);
        });
      }
      const newPlayState = !isPlaying;
      setIsPlaying(newPlayState);
      onPlayStateChange?.(newPlayState);
    };

    const skipBackward = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
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

    const toggleHueStatusPanel = () => {
      setIsHueStatusOpen(!isHueStatusOpen);
    };

    const openFullSettings = () => {
      setIsHueStatusOpen(false);
      setIsHueSettingsOpen(true);
    };

    return (
      <div
        style={{
          minHeight: '10vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem 0',
          position: 'relative',
        }}
      >
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
            paddingLeft: '100px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              overflow: 'hidden',
              marginRight: '1rem',
              position: 'absolute',
              top: '10px',
              left: '10px',
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

          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                {track.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#555' }}>
                {track.artist}
              </p>
            </div>
            <div
              style={{
                height: '8px',
                borderRadius: '4px',
                background: '#e0e0e0',
                position: 'relative',
                cursor: 'pointer',
              }}
              onClick={handleProgressClick}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: '#000',
                  borderRadius: '4px',
                  transition: 'width 0.1s linear',
                }}
              />
              {hoverProgress !== null && (
                <div
                  style={{
                    height: '100%',
                    width: `${hoverProgress}%`,
                    background: 'rgba(85, 85, 85, 0.3)',
                    borderRadius: '4px',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    transition: 'width 0.1s linear',
                  }}
                />
              )}
            </div>
          </div>

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
            <button
              onClick={toggleHueStatusPanel}
              style={{
                ...iconButtonStyle,
                position: 'relative',
                color: isHueStatusOpen ? '#007AFF' : undefined,
                backgroundColor: isHueStatusOpen ? 'rgba(0, 122, 255, 0.1)' : 'transparent',
                borderRadius: '50%',
                width: '35px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <FaCog style={{ fontSize: '1.1rem' }} />
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  right: '3px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isHueConnected && isStreamingActive ? '#00FF00' : '#007AFF',
                  display: 'block',
                }}
              />
            </button>
          </div>
          <audio ref={audioRef} src={track.audioSrc} />
        </div>

        <HueStatusPanel
          isOpen={isHueStatusOpen}
          onClose={() => setIsHueStatusOpen(false)}
          onOpenFullSettings={openFullSettings}
        />

        {isHueSettingsOpen && <HueSettings onClose={() => setIsHueSettingsOpen(false)} />}
      </div>
    );
  }
);

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  margin: '0 0.5rem',
};

export default Player;
