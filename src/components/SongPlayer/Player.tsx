import React, { useState, useRef, useEffect, CSSProperties, forwardRef, useImperativeHandle } from 'react';
import { AiOutlineForward, AiOutlineBackward } from 'react-icons/ai';
import { FaPlay, FaPause, FaCog } from 'react-icons/fa';
import HueStatusPanel from '../HueSettings/HueStatusPanel';
import HueSettings from '../HueSettings/HueSettings';
import { useHue } from '../../hooks/useHue'; // Import the useHue hook directly

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    albumArt: string;
    audioSrc: string;
  };
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean, audioData?: Uint8Array) => void; // New prop for Hue integration
}

const Player = forwardRef<any, PlayerProps>(({
  track,
  autoPlay = false,
  onTimeUpdate,
  onPlayStateChange
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isHueStatusOpen, setIsHueStatusOpen] = useState(false);
  const [isHueSettingsOpen, setIsHueSettingsOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Beat detection state (moved from HueVisualizer)
  const energyHistory = useRef<number[]>([]);
  const vocalEnergyHistory = useRef<number[]>([]);
  const beatThreshold = useRef(1.2); // More sensitive threshold
  const beatHoldTime = useRef(100); // How long to hold a beat (ms)
  const lastBeatTime = useRef(0);
  const debugCounter = useRef(0);
  const lastUpdateTime = useRef(0);
  const updateIntervalMs = useRef(50); // Milliseconds between updates

  // Enhanced music reactive lighting
  const currentColorIndex = useRef(0); // Current color index
  const colorChangeCount = useRef(0); // Count beats before changing color
  const colorChangeThreshold = useRef(8); // Change color every X beats
  const baseColors = useRef<number[][]>([
    [255, 0, 0],     // Red
    [255, 165, 0],   // Orange
    [255, 255, 0],   // Yellow
    [0, 255, 0],     // Green
    [0, 0, 255],     // Blue
    [128, 0, 128],   // Purple
    [255, 105, 180], // Pink
  ]);
  const lastColorChangeTime = useRef(0); // Time of last color change
  const minTimeBetweenColorChanges = useRef(5000); // Minimum 5 seconds between color changes

  // Vocal/energy detection - MODIFIED for better tracking
  const vocalEnergyThreshold = useRef(60); // Threshold for identifying high vocal energy
  const vocalEnergyReleaseThreshold = useRef(40); // Lower threshold to maintain vocal state (hysteresis)
  const isHighVocalEnergy = useRef(false);
  const vocalEnergyDuration = useRef(0); // How long high vocal energy has been sustained
  const vocalDetectionCounter = useRef(0); // Counter to ignore brief drops in vocal energy
  const vocalDropoutTolerance = useRef(3); // Number of frames to maintain vocal state despite energy drop

  // Get Hue services directly in the Player component
  const { isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming } = useHue();
  const [isHueConnected, setIsHueConnected] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    getCurrentTime: () => audioRef.current?.currentTime || 0,
    getDuration: () => audioRef.current?.duration || 0,
    getAudioData: () => dataArrayRef.current,
  }));

  // Initialize audio context and analyzer
  useEffect(() => {
    if (!audioRef.current) return;

    // Create audio context and analyzer on mount
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 512; // Increased for better frequency resolution
        analyzerRef.current.smoothingTimeConstant = 0.5; // Smoothing for more stable beat detection

        const bufferLength = analyzerRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceNodeRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(audioContextRef.current.destination);

        console.log('🎵 Audio analyzer setup successfully, bufferLength:', bufferLength);
      } catch (error) {
        console.error("Failed to initialize Web Audio API:", error);
      }
    }

    return () => {
      // Cleanup animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Connect to Hue when the component mounts or isConfigured changes
  useEffect(() => {
    const connectToHue = async () => {
      if (isConfigured && !isStreamingActive) {
        console.log("🔄 Attempting to connect to Hue bridge...");
        const success = await startHueStreaming();
        setIsHueConnected(success);
        console.log("🔌 Hue connection attempt:", success ? "Connected!" : "Failed");
      }
    };

    connectToHue();

    // Cleanup on unmount
    return () => {
      if (isStreamingActive) {
        stopHueStreaming();
        setIsHueConnected(false);
        console.log("🔌 Hue disconnected on cleanup");
      }
    };
  }, [isConfigured, isStreamingActive, startHueStreaming, stopHueStreaming]);

  // AudioContext state in case it needs to be resumed after user interaction
  useEffect(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(err => {
        console.error("Failed to resume audio context:", err);
      });
    }
  }, [track.audioSrc]);

  // Combined audio analysis and beat detection function
  const analyzeAudioAndDetectBeats = async () => {
    if (!analyzerRef.current || !dataArrayRef.current) return;

    // Get frequency data
    analyzerRef.current.getByteFrequencyData(dataArrayRef.current);

    // Notify callback with current play state and audio data
    onPlayStateChange?.(isPlaying, dataArrayRef.current);

    // Only process beat detection at the specified interval
    const now = Date.now();
    if (now - lastUpdateTime.current >= updateIntervalMs.current) {
      try {
        debugCounter.current += 1;

        const data = dataArrayRef.current;

        // Split frequency data into segments with focus on different frequency ranges
        const bassRange = Math.floor(data.length * 0.15); // Lower frequencies (bass)
        const bassSegment = data.slice(0, bassRange);

        const midLowRange = Math.floor(data.length * 0.3); // Lower mid frequencies
        const midLowSegment = data.slice(bassRange, midLowRange);

        const midHighRange = Math.floor(data.length * 0.6); // Higher mid frequencies (where vocals often are)
        const midHighSegment = data.slice(midLowRange, midHighRange);

        const highSegment = data.slice(midHighRange); // High frequencies

        // Calculate energy levels
        const bassEnergy = bassSegment.reduce((sum, val) => sum + val, 0) / bassSegment.length;
        const midLowEnergy = midLowSegment.reduce((sum, val) => sum + val, 0) / midLowSegment.length;
        const midHighEnergy = midHighSegment.reduce((sum, val) => sum + val, 0) / midHighSegment.length;
        const highEnergy = highSegment.reduce((sum, val) => sum + val, 0) / highSegment.length;

        // Specific detection for vocal range (mid-high frequencies)
        const vocalEnergy = midHighEnergy * 1.2; // Emphasize vocal range

        // Update vocal energy history with longer history for stability
        vocalEnergyHistory.current.push(vocalEnergy);
        if (vocalEnergyHistory.current.length > 40) { // Increased from 30 for more stability
          vocalEnergyHistory.current.shift();
        }

        // Calculate average vocal energy from history
        const avgVocalEnergy = vocalEnergyHistory.current.reduce((sum, e) => sum + e, 0) /
                              Math.max(1, vocalEnergyHistory.current.length);

        // Modified vocal energy detection with hysteresis
        const previousHighVocalEnergy = isHighVocalEnergy.current;

        if (isHighVocalEnergy.current) {
          // If already in high vocal state, use lower threshold to maintain it (hysteresis)
          if (vocalEnergy < vocalEnergyReleaseThreshold.current) {
            vocalDetectionCounter.current++;
            // Only exit vocal state if energy stays low for multiple consecutive frames
            if (vocalDetectionCounter.current >= vocalDropoutTolerance.current) {
              isHighVocalEnergy.current = false;
              vocalDetectionCounter.current = 0;
            }
          } else {
            // Reset dropout counter if energy is above threshold
            vocalDetectionCounter.current = 0;
          }
        } else {
          // If not in high vocal state, need higher threshold to enter
          isHighVocalEnergy.current = vocalEnergy > (avgVocalEnergy * 1.4) && vocalEnergy > vocalEnergyThreshold.current;
          if (isHighVocalEnergy.current) {
            // Reset counter when entering vocal state
            vocalDetectionCounter.current = 0;
          }
        }

        // Track duration of high vocal energy for sustained notes
        if (isHighVocalEnergy.current) {
          vocalEnergyDuration.current += updateIntervalMs.current;

          // Add additional logging for long sustained notes
          if (vocalEnergyDuration.current % 500 === 0) {
            console.log(`🎵 Sustained vocal energy: ${vocalEnergyDuration.current}ms at energy level ${vocalEnergy.toFixed(1)}`);
          }
        } else if (previousHighVocalEnergy) {
          // Only log when state changes from high to low
          console.log(`🎤 Vocal energy ended. Duration: ${vocalEnergyDuration.current}ms`);
          vocalEnergyDuration.current = 0;
        }

        // Log when vocal energy state changes from low to high
        if (isHighVocalEnergy.current && !previousHighVocalEnergy) {
          console.log(`🎤 VOCAL ENERGY DETECTED! Energy: ${vocalEnergy.toFixed(1)}, Threshold: ${(avgVocalEnergy * 1.4).toFixed(1)}`);
        }

        // Calculate total energy with higher emphasis on bass for beat detection
        const totalEnergy = (bassEnergy * 4 + midLowEnergy + midHighEnergy + highEnergy) / 7;

        // Update energy history (keep last 20 samples)
        energyHistory.current.push(totalEnergy);
        if (energyHistory.current.length > 20) {
          energyHistory.current.shift();
        }

        // Calculate average energy from history
        const avgEnergy = energyHistory.current.reduce((sum, e) => sum + e, 0) /
                          Math.max(1, energyHistory.current.length);

        // Dynamic threshold based on recent history to adapt to song
        const dynamicThreshold = Math.max(1.1, avgEnergy > 50 ? 1.2 : 1.4);

        // Beat detection
        const isBeat = totalEnergy > avgEnergy * dynamicThreshold &&
                      now - lastBeatTime.current > beatHoldTime.current &&
                      bassEnergy > 15; // Ensure bass is significant

        // Log energy levels every 20 iterations for debugging
        if (debugCounter.current % 20 === 0) {
          console.log(
            `🔊 Energy - Bass: ${bassEnergy.toFixed(1)}, ` +
            `Mid-Low: ${midLowEnergy.toFixed(1)}, ` +
            `Mid-High: ${midHighEnergy.toFixed(1)}, ` +
            `High: ${highEnergy.toFixed(1)}, ` +
            `Vocal: ${vocalEnergy.toFixed(1)}`
          );
        }

        // Determine if we should change the active color
        let shouldChangeColor = false;

        // Change color if:
        // 1. We've detected enough beats since the last change, AND
        // 2. Enough time has passed since the last change
        if (isBeat) {
          colorChangeCount.current++;

          if (colorChangeCount.current >= colorChangeThreshold.current &&
              now - lastColorChangeTime.current > minTimeBetweenColorChanges.current) {
            shouldChangeColor = true;
            colorChangeCount.current = 0;
            lastColorChangeTime.current = now;

            // Choose next color
            currentColorIndex.current = (currentColorIndex.current + 1) % baseColors.current.length;
            console.log(`🎨 Changing to new color: ${currentColorIndex.current}`);
          }
        }

        if (isBeat) {
          lastBeatTime.current = now;
          console.log(`🥁 BEAT DETECTED! 🎵 Energy: ${totalEnergy.toFixed(1)} vs Threshold: ${(avgEnergy * dynamicThreshold).toFixed(1)}`);
        }

        // Current color based on the current index
        const currentColor = baseColors.current[currentColorIndex.current];

        // Calculate brightness based on beat or vocal intensity
        let brightness = 0.5; // Base brightness

        if (isBeat) {
          // Pulse brightness higher on beat
          brightness = Math.min(1.0, 0.7 + (totalEnergy / 256) * 0.3);
        }

        // Enhanced vocal brightness calculation - smoother ramp-up
        if (isHighVocalEnergy.current) {
          // More dramatic brightness increase for longer sustained notes
          const vocalBrightnessFactor = Math.min(1.0, 0.85 + (vocalEnergyDuration.current / 1500) * 0.15);
          // Add extra boost for very high vocal energy
          const energyBoost = Math.max(0, (vocalEnergy - vocalEnergyThreshold.current) / 100);
          const totalBrightness = Math.min(1.0, vocalBrightnessFactor + energyBoost);
          brightness = Math.max(brightness, totalBrightness);
        }

        // Apply brightness to the current color
        const finalColor = currentColor.map(c => Math.round(c * brightness));

        // Scale energy values for the Hue API
        const scaledBassEnergy = Math.min(255, bassEnergy * 2);
        const scaledMidEnergy = Math.min(255, (midLowEnergy + midHighEnergy) / 2 * 2);
        const scaledHighEnergy = Math.min(255, highEnergy * 2);

        // Send beat and color data to HueService if connected
        if (isHueConnected && isStreamingActive) {
          // Create a streamlined version of the frequency data for visualization
          const visualizationData = new Uint8Array(dataArrayRef.current.length);
          dataArrayRef.current.forEach((value, index) => {
            visualizationData[index] = value;
          });

          await window.electron.hue.processBeat({
            isBeat,
            energy: totalEnergy,
            bassEnergy: scaledBassEnergy,
            midEnergy: scaledMidEnergy,
            highEnergy: scaledHighEnergy,
            // Add additional data for enhanced lighting
            color: finalColor,
            vocalEnergy: vocalEnergy,
            audioData: visualizationData, // Send the frequency data for visualization
            brightness: brightness,
            vocalActive: isHighVocalEnergy.current
          });
        }

        lastUpdateTime.current = now;
      } catch (error) {
        console.error('Error in beat detection:', error);
      }
    }

    // Continue the loop if still playing
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudioAndDetectBeats);
    }
  };

  // Set up audio analysis and animation loop
  useEffect(() => {
    if (isPlaying) {
      // Resume audio context if needed (browsers require user interaction)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      console.log("▶️ Starting audio analysis loop");
      animationFrameRef.current = requestAnimationFrame(analyzeAudioAndDetectBeats);
    } else {
      // Cancel animation when not playing
      if (animationFrameRef.current) {
        console.log("⏹️ Stopping audio analysis loop");
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Still notify about paused state and send empty audio data to reset visualizations
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
          vocalActive: false
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      // Avoid NaN by using "|| 0"
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

    // Auto-play when track changes
    if (autoPlay && track.audioSrc) {
      audio.play().catch(error => {
        console.error('Error auto-playing audio:', error);
        setIsPlaying(false);
        onPlayStateChange?.(false);
      });
      setIsPlaying(true); // Set playing state to true when auto-playing
      onPlayStateChange?.(true);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [track.audioSrc, autoPlay, onTimeUpdate, onPlayStateChange]);

  useEffect(() => {
    let animationFrame: number;
    const updateRotation = () => {
      if (isPlaying) {
        setRotation(prev => prev + 0.5);
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

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Resume audio context if it's suspended (browser policy requires user interaction)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      audioRef.current.play().catch(error => {
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

  // Toggle Hue status panel
  const toggleHueStatusPanel = () => {
    setIsHueStatusOpen(!isHueStatusOpen);
  };

  // Open full Hue settings
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
            <FaCog style={{fontSize: '1.1rem'}} />
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

        {/* Hidden audio element */}
        <audio ref={audioRef} src={track.audioSrc} />
      </div>

      {/* Hue Status Panel (only shown when isHueStatusOpen is true) */}
      <HueStatusPanel
        isOpen={isHueStatusOpen}
        onClose={() => setIsHueStatusOpen(false)}
        onOpenFullSettings={openFullSettings}
      />

      {/* Full Hue Settings Modal (only shown when isHueSettingsOpen is true) */}
      {isHueSettingsOpen && (
        <HueSettings onClose={() => setIsHueSettingsOpen(false)} />
      )}
    </div>
  );
});

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  margin: '0 0.5rem',
};

export default Player;
