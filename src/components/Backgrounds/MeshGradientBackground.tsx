import React from 'react';
import '../../styles.css';
import WindowControls from '../UI/WindowControls';

const MeshGradientBackground: React.FC = ({ children }) => {
  return (
    <div
      style={{
        position: 'fixed', // Changed from 'relative' to 'fixed'
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Window control buttons */}
      <WindowControls />
      
      {/* Background using ::before pseudo-element */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          backgroundColor: '#ff99df',
          backgroundImage: `
                radial-gradient(circle at 52% 73%, hsla(310, 85%, 67%, 1) 0px, transparent 50%),
                radial-gradient(circle at 0% 30%, hsla(197, 90%, 76%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 26%, hsla(234, 79%, 69%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 51%, hsla(41, 70%, 63%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 88%, hsla(36, 83%, 61%, 1) 0px, transparent 50%),
                radial-gradient(circle at 76% 73%, hsla(346, 69%, 70%, 1) 0px, transparent 50%),
                radial-gradient(circle at 29% 37%, hsla(272, 96%, 64%, 1) 0px, transparent 50%)`,
          backgroundSize: 'cover',
          filter: 'blur(80px)',
        }}
      />
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'auto' // Allow content to be scrollable if necessary, while background remains fixed
      }}>
        {children}
      </div>
    </div>
  );
};

export default MeshGradientBackground;
