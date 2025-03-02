import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import Player from '../SongPlayer/Player';
import { initializeSketch } from '../../particles/sketch';
import p5 from 'p5';

// Added conversion helpers from particles.ts
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([A-Fa-f0-9]{2})([A-Fa-f0-9]{2})([A-Fa-f0-9]{2})$/.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToXy(r: number, g: number, b: number): number[] {
  const red = r / 255, green = g / 255, blue = b / 255;
  const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;
  const sum = X + Y + Z;
  return sum === 0 ? [0, 0] : [X / sum, Y / sum];
}

const Particles: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const songDetails = location.state?.songDetails as SongModel;
  const [fullAudioPath, setFullAudioPath] = useState('');
  const [fullJacketPath, setFullJacketPath] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [p5Instance, setP5Instance] = useState<p5 | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(true);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const [hueLights, setHueLights] = useState<string[]>([]);
  const [autoFlashEnabled, setAutoFlashEnabled] = useState<boolean>(false); // Add this state to control flashing

  useEffect(() => {
    const loadAssets = async () => {
      if (songDetails) {
        // console.log('Loading assets for song:', songDetails.title);
        // console.log('Available images:', songDetails.images);

        const audioPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.audioPath
        );
        const jacketPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.jacket
        );

        // Load all image paths with logging
        try {
          const imagePaths = await Promise.all(
            songDetails.images.map(async (imagePath: string) => {
              // console.log('Processing image path:', imagePath);
              const fullPath = await window.electron.fileSystem.mergeAssetPath(imagePath);
              // console.log('Resolved full path:', fullPath);
              return fullPath;
            })
          );
          // console.log('Successfully loaded image paths:', imagePaths);
          setBackgroundImages(imagePaths);
        } catch (error) {
          // console.error('Error loading image paths:', error);
        }

        setFullAudioPath(audioPath);
        setFullJacketPath(jacketPath);
      }
    };
    loadAssets();
  }, [songDetails]);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (songDetails && containerRef.current && isActive) {
      if (p5Instance) {
        p5Instance.remove();
      }

      // Ensure particles array exists and is not empty
      const particleTypes = songDetails.particles && songDetails.particles.length > 0
        ? songDetails.particles
        : ['musicNote'];

      // Initialize sketch with song's particle types
      const sketch = initializeSketch(particleTypes, isActive); // Pass isActive to sketch
      const newP5 = new p5(sketch, containerRef.current);
      setP5Instance(newP5);
    }

    return () => {
      if (p5Instance) {
        p5Instance.remove();
      }
    };
  }, [songDetails, isActive]);

  // Add effect to set initial image when images are loaded
  useEffect(() => {
    if (backgroundImages.length > 0) {
      // console.log('Setting initial background image:', backgroundImages[0]);
      setCurrentImageIndex(0);
    }
  }, [backgroundImages]);

  // New effect: Ensure Hue credentials are set by reading localStorage before fetching RIDs
  useEffect(() => {
    const stored = localStorage.getItem('hueBridgeInfo');
    if (stored) {
      const credentials = JSON.parse(stored);
      if (credentials?.ip && credentials?.username) {
        console.log('🔑 Found stored Hue credentials, setting them');
        window.electron.ipcRenderer.invoke('hue:setCredentials', credentials)
          .catch(err => console.error('Error setting stored Hue credentials:', err));
      }
    } else {
      console.warn('⚠️ No stored Hue credentials found. HueDebugOverlay must be used first.');
    }
  }, []);

  // New effect: Log stored Hue credentials from localStorage for debugging
  useEffect(() => {
    const stored = localStorage.getItem('hueBridgeInfo');
    console.log("📝 Stored Hue credentials in Particles:", stored);
  }, []);

  // Update Hue lights fetching effect to filter out legacy numeric IDs.
  useEffect(() => {
    window.electron.ipcRenderer.invoke('hue:getLightRids')
      .then((ids: string[]) => {
        console.log('Retrieved Hue lights:', ids);
        const validIds = ids.filter(id => !/^\d+$/.test(id));
        if (validIds.length < ids.length) {
          console.warn('Some legacy numeric light IDs were filtered out; using only UUIDs:', validIds);
        }
        setHueLights(validIds);
      })
      // .catch((err: any) => console.error('Error fetching Hue lights:', err));
  }, []);

  // Modified flash lights effect: only flash if autoFlashEnabled is true
  useEffect(() => {
    if (!isActive || hueLights.length === 0 || !songDetails || !autoFlashEnabled) return; // Add autoFlashEnabled check

    let flashIndex = 0;
    const flashInterval = setInterval(() => {
      const toggle = flashIndex % 2 === 0;
      const currentColorHex = songDetails.colours && songDetails.colours.length > 0
        ? songDetails.colours[flashIndex % songDetails.colours.length]
        : "#FFFFFF";
      const rgb = hexToRgb(currentColorHex);
      const xy = rgb ? rgbToXy(rgb.r, rgb.g, rgb.b) : [0.5, 0.5];

      console.log(`Flashing lights: toggle=${toggle}, color=${currentColorHex}, xy=[${xy}]`);
      hueLights.forEach(lightId => {
        if (toggle) {
          // Turn light on with normalized brightness (1 = full brightness) & color
          window.electron.ipcRenderer.invoke('hue:setLightState', {
            lightId,
            on: true,
            brightness: 100,
            xy
          }).catch((err: any) => console.error(`Error updating light ON ${lightId}:`, err));
        } else {
          // Turn light off by sending only "on: false"
          window.electron.ipcRenderer.invoke('hue:setLightState', {
            lightId,
            on: false
          }).catch((err: any) => console.error(`Error updating light OFF ${lightId}:`, err));
        }
      });
      flashIndex++;
    }, 1000);
    return () => clearInterval(flashInterval);
  }, [isActive, hueLights, songDetails, autoFlashEnabled]); // Add autoFlashEnabled to the dependency array

  // New effect: Refresh Hue lights periodically if none are present
  useEffect(() => {
    if (isActive && hueLights.length === 0) {
      console.log("🔄 Hue lights empty; starting periodic refresh");
      const refreshInterval = setInterval(() => {
        window.electron.ipcRenderer.invoke('hue:getLightRids')
          .then((ids: string[]) => {
            const validIds = ids.filter(id => !/^\d+$/.test(id));
            if (validIds.length > 0) {
              console.log("🌟 Refreshed Hue lights:", validIds);
              setHueLights(validIds);
              clearInterval(refreshInterval);
            } else {
              console.warn("⚠️ Still no valid Hue lights found");
            }
          })
          .catch((err: any) => console.error("❌ Error refreshing Hue lights:", err));
      }, 5000);
      return () => clearInterval(refreshInterval);
    }
  }, [isActive, hueLights]);

  // Handle leaving the page
  const handleBack = () => {
    setIsActive(false); // Stop particle generation
    setIsVisible(false);
    if (p5Instance) {
      p5Instance.remove(); // Remove p5 instance immediately
    }
    setTimeout(() => navigate('/'), 300);
  };

  // Handle image rotation based on current time
  const handleTimeUpdate = (currentTime: number, duration: number) => {
    if (backgroundImages.length === 0) {
      // console.log('No background images available');
      return;
    }

    if (duration !== songDuration) {
      setSongDuration(duration);
      // console.log('Song duration:', duration);
      // console.log('Time per image:', duration / backgroundImages.length);
    }

    const intervalDuration = duration / backgroundImages.length;
    const newIndex = Math.min(
      Math.floor(currentTime / intervalDuration),
      backgroundImages.length - 1
    );

    if (newIndex !== currentImageIndex) {
      // console.log('Switching to image index:', newIndex);
      // console.log('Current image path:', backgroundImages[newIndex]);
      setCurrentImageIndex(newIndex);
    }
  };

  // Handler for the auto flash toggle
  const handleAutoFlashToggle = (isEnabled: boolean) => {
    setAutoFlashEnabled(isEnabled);
  };

  if (!songDetails) return null;

  return (
    <div className={`page-transition ${isVisible ? 'visible' : ''}`}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        background: 'transparent', // Change to transparent
    }}>
      {/* Replace background div with full-screen image */}
      {backgroundImages.length > 0 && (
        <img
          src={backgroundImages[currentImageIndex]}
          alt="Background"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.95,
            zIndex: 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
      )}

      {/* Particle container on top of background */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          background: 'transparent',
        }}
      />

      {/* Back button and player with highest z-index */}
      <button
        onClick={handleBack}
        style={{
          position: 'fixed', // Change to fixed
          top: 20,
          left: 20,
          zIndex: 10,
          padding: '8px 16px',
          borderRadius: '20px',
          background: 'white',
          border: 'none',
          cursor: 'pointer',
          width: 'fit-content',
          color: 'black'
        }}
      >
        Back
      </button>

      {fullAudioPath && (
        <div
          className={`player-wrapper ${isVisible ? 'visible' : ''}`}
          style={{
            position: 'fixed', // Change to fixed
            bottom: 20,
            left: 0,
            right: 0,
            zIndex: 10
          }}
        >
          <Player
            ref={playerRef}
            track={{
              title: songDetails.title,
              artist: songDetails.uploader,
              albumArt: fullJacketPath,
              audioSrc: fullAudioPath,
            }}
            autoPlay={true}
            onTimeUpdate={handleTimeUpdate}
            onAutoFlashToggle={handleAutoFlashToggle} // Add this prop to receive the toggle state
          />
        </div>
      )}

      {/* Force image preloading */}
      <div style={{ display: 'none', position: 'absolute' }}>
        {backgroundImages.map((imagePath, index) => (
          <img
            key={index}
            src={imagePath}
            alt=""
            // onLoad={() => console.log(`Preloaded image ${index} loaded successfully:`, imagePath)}
            // onError={(e) => console.error(`Error loading image ${index}:`, e)}
          />
        ))}
      </div>
    </div>
  );
};

export default Particles;
