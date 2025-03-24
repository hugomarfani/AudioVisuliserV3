import React, { useEffect, useState, useRef } from 'react';
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
        console.log(jacketPath, songDetails.jacket);''

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

      // Initialise sketch with song's particle types
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
    }
  }, [backgroundImages]);

  // Add cursor tracking effect
  useEffect(() => {
    // Only track cursor position if cursor control is active
    if (!cursorControlActive) return;

    // Function to track mouse/cursor position and send to the Hue service
    const handleMouseMove = (e: MouseEvent) => {
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

  // Handle leaving the page
  const handleBack = () => {
    setIsActive(false); 
    setIsVisible(false);
    if (p5Instance) {
      p5Instance.remove(); 
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
        background: 'transparent', 
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
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill={cursorControlActive ? "rgb(0,255,128)" : "white"}>
          <path d="M13 6v15h-2V6H5l7-5 7 5h-6z" />
        </svg>
      </button>

      {fullAudioPath && (
        <div
          className={`player-wrapper ${isVisible ? 'visible' : ''}`}
          style={{
            position: 'fixed', 
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
              id: songDetails.id, 
            }}
            autoPlay={true}
            onTimeUpdate={handleTimeUpdate}
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
            onLoad={() => console.log(`Preloaded image ${index} loaded successfully:`, imagePath)}
            onError={(e) => console.error(`Error loading image ${index}:`, e)}
          />
        ))}
      </div>
    </div>
  );
};

export default Particles;
