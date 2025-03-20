import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import Player from '../SongPlayer/Player';
import { initializeSketch } from '../../particles/sketch';
import p5 from 'p5';

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

  // Add state for cursor control
  const [cursorControlActive, setCursorControlActive] = useState(false);

  // Add state for color sampling control
  const [colorSamplingActive, setColorSamplingActive] = useState(true);

  // Add a ref to track the dominant colors of the current displayed image
  const dominantColorsRef = useRef<number[][]>([]);

  useEffect(() => {
    const loadAssets = async () => {
      if (songDetails) {
        console.log('Loading assets for song:', songDetails.title);
        console.log('Available images:', songDetails.images);

        const audioPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.audioPath
        );
        const jacketPath = await window.electron.fileSystem.mergeAssetPath(
          songDetails.jacket
        );

        console.log("path test")
        console.log(jacketPath, songDetails.jacket);

        // Load all image paths with logging
        try {
          const imagePaths = await Promise.all(
            songDetails.images.map(async (imagePath: string) => {
              console.log('Processing image path:', imagePath);
              const fullPath = await window.electron.fileSystem.mergeAssetPath(imagePath);
              console.log('Resolved full path:', fullPath);
              return fullPath;
            })
          );
          console.log('Successfully loaded image paths:', imagePaths);
          setBackgroundImages(imagePaths);
        } catch (error) {
          console.error('Error loading image paths:', error);
        }

        setFullAudioPath(audioPath);
        setFullJacketPath(jacketPath);
        console.log(fullAudioPath, fullJacketPath);
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
      console.log('Setting initial background image:', backgroundImages[0]);
      setCurrentImageIndex(0);

      // Extract colors from the initial image
      extractDominantColors(backgroundImages[0]);
    }
  }, [backgroundImages]);

  // Function to extract dominant colors from an image
  const extractDominantColors = useCallback((imageSrc: string) => {
    try {
      // Create a temporary canvas for image analysis
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      // Create a temporary image
      const img = new Image();

      // Set CORS policy to allow loading the image
      img.crossOrigin = 'Anonymous';

      // Once the image loads, analyze it
      img.onload = () => {
        // Resize canvas to match image (scaled down for performance)
        const maxSize = 150;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw the image onto the canvas
        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Define regions to sample (left, center, right)
        const regions = [
          { name: 'left', x: canvas.width * 0.2, y: canvas.height * 0.5 },
          { name: 'center', x: canvas.width * 0.5, y: canvas.height * 0.5 },
          { name: 'right', x: canvas.width * 0.8, y: canvas.height * 0.5 }
        ];

        // Sample colors from each region
        const colors = regions.map(region => {
          const pixelData = context.getImageData(
            region.x, region.y, 1, 1
          ).data;
          return [pixelData[0], pixelData[1], pixelData[2]];
        });

        // Store the dominant colors for use with Hue lights
        dominantColorsRef.current = colors;
        console.log('Extracted dominant colors:', colors);
      };

      // Set the image source to start loading
      img.src = imageSrc;

      // Handle errors
      img.onerror = (err) => {
        console.error('Error loading image for color extraction:', err);
        dominantColorsRef.current = [[255, 255, 255], [255, 255, 255], [255, 255, 255]];
      };
    } catch (error) {
      console.error('Color extraction error:', error);
      dominantColorsRef.current = [[255, 255, 255], [255, 255, 255], [255, 255, 255]];
    }
  }, []);

  // Add cursor tracking effect
  useEffect(() => {
    // Only track cursor position if cursor control is active
    if (!cursorControlActive) return;

    // Function to track mouse/cursor position and send to the Hue service
    const handleMouseMove = (e: MouseEvent) => {
      // Get screen dimensions
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Send position to HueService
      window.electron.hue.updateCursorPosition({
        x: e.clientX,
        y: e.clientY,
        screenWidth,
        screenHeight
      });
    };

    // Add event listener for mouse movement
    window.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [cursorControlActive]);

  // Toggle cursor control on/off
  const toggleCursorControl = () => {
    const newState = !cursorControlActive;
    setCursorControlActive(newState);

    // Update HueService
    window.electron.hue.toggleCursorControl(newState);

    // Log status for debugging
    console.log(`Cursor control ${newState ? 'enabled' : 'disabled'}`);
  };

  // Toggle color sampling on/off
  const toggleColorSampling = () => {
    const newState = !colorSamplingActive;
    setColorSamplingActive(newState);
    console.log(`Color sampling ${newState ? 'enabled' : 'disabled'}`);
  };

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
      console.log('No background images available');
      return;
    }

    if (duration !== songDuration) {
      setSongDuration(duration);
      console.log('Song duration:', duration);
      console.log('Time per image:', duration / backgroundImages.length);
    }

    const intervalDuration = duration / backgroundImages.length;
    const newIndex = Math.min(
      Math.floor(currentTime / intervalDuration),
      backgroundImages.length - 1
    );

    if (newIndex !== currentImageIndex) {
      console.log('Switching to image index:', newIndex);
      console.log('Current image path:', backgroundImages[newIndex]);
      setCurrentImageIndex(newIndex);

      // Extract colors from the new image
      extractDominantColors(backgroundImages[newIndex]);
    }
  };

  // Handle player playback state changes
  const handlePlayStateChange = (isPlaying: boolean, audioData?: Uint8Array) => {
    // When playing and we have dominant colors extracted from the current image,
    // send them to the Hue lights for synchronized coloring
    if (isPlaying && colorSamplingActive && dominantColorsRef.current.length > 0) {
      // Define the zones based on our extracted colors
      const colorZones = {
        left: dominantColorsRef.current[0],
        center: dominantColorsRef.current[1],
        right: dominantColorsRef.current[2],
      };

      // If we have a player reference, use our new method to send colors to the Hue lights
      if (playerRef.current && typeof playerRef.current.processBeatWithColors === 'function') {
        playerRef.current.processBeatWithColors(colorZones);
      } else if (window.electron?.hue?.processBeat) {
        // Fallback: Send directly to electron IPC if player ref isn't available
        window.electron.hue.processBeat({
          isBeat: false, // Not a beat event, just color update
          energy: audioData ? (Array.from(audioData).reduce((sum, val) => sum + val, 0) / audioData.length) : 0,
          bassEnergy: 0,
          midEnergy: 0,
          highEnergy: 0,
          colorZones: colorZones, // Pass our zone-based colors
          screenColors: dominantColorsRef.current, // Also pass as array
        });
      }
    }
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

      {/* Cursor Control Toggle Button */}
      <button
        onClick={toggleCursorControl}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 10,
          background: cursorControlActive ? 'rgba(0,255,128,0.4)' : 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: cursorControlActive ? '2px solid rgba(0,255,128,0.8)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        title="Toggle cursor-based lighting"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill={cursorControlActive ? "rgb(0,255,128)" : "white"}>
          <path d="M13 6v15h-2V6H5l7-5 7 5h-6z" />
        </svg>
      </button>

      {/* Color Sampling Toggle Button */}
      <button
        onClick={toggleColorSampling}
        style={{
          position: 'fixed',
          top: 20,
          right: 70,
          zIndex: 10,
          background: colorSamplingActive ? 'rgba(128,0,255,0.4)' : 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: colorSamplingActive ? '2px solid rgba(128,0,255,0.8)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        title="Toggle screen color sampling"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill={colorSamplingActive ? "rgb(128,0,255)" : "white"}>
          <path d="M12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,11A1,1 0 0,1 13,12A1,1 0 0,1 12,13A1,1 0 0,1 11,12A1,1 0 0,1 12,11M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z" />
        </svg>
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
              id: songDetails.id, // Add the song ID here
            }}
            autoPlay={true}
            onTimeUpdate={handleTimeUpdate}
            onPlayStateChange={handlePlayStateChange}
          />
        </div>
      )}

      {/* Color preview indicators to show detected colors */}
      {colorSamplingActive && dominantColorsRef.current.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 130,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            zIndex: 10,
            padding: '5px 10px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '15px',
          }}
        >
          {dominantColorsRef.current.map((color, index) => (
            <div
              key={index}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                border: '1px solid white',
              }}
              title={`Zone ${index + 1}: RGB(${color.join(', ')})`}
            />
          ))}
        </div>
      )}

      {/* Force image preloading */}
      <div style={{ display: 'none', position: 'absolute' }}>
        {backgroundImages.map((imagePath, index) => (
          <img
            key={index}
            src={imagePath}
            alt=""
            onLoad={() => console.log(`Preloaded image ${index} loaded successfully:`, imagePath)}
            onError={(e) => console.error(`Error loading image ${index}:`, e)}
          />
        ))}
      </div>
    </div>
  );
};

export default Particles;
