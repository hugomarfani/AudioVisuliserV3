import React from 'react';
import '../../styles.css';

const MeshGradientBackground: React.FC = ({ children }) => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw', // Full width of the viewport
        height: '100vh', // Full height of the viewport
        display: 'flex', // Flexbox for centring
        justifyContent: 'center', // Horizontally centre children
        alignItems: 'center', // Vertically centre children
        overflow: 'hidden', // Prevents content overflow
      }}
    >
      {/* Background using ::before pseudo-element */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1, // Ensure background is behind content
          backgroundColor: '#ff99df',
          backgroundImage: `
                radial-gradient(circle at 52% 73%, hsla(310, 85%, 67%, 1) 0px, transparent 50%),
                radial-gradient(circle at 0% 30%, hsla(197, 90%, 76%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 26%, hsla(234, 79%, 69%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 51%, hsla(41, 70%, 63%, 1) 0px, transparent 50%),
                radial-gradient(circle at 41% 88%, hsla(36, 83%, 61%, 1) 0px, transparent 50%),
                radial-gradient(circle at 76% 73%, hsla(346, 69%, 70%, 1) 0px, transparent 50%),
                radial-gradient(circle at 29% 37%, hsla(272, 96%, 64%, 1) 0px, transparent 50%)`,
          backgroundSize: 'cover', // Covers the entire viewport
          filter: 'blur(80px)', // Adds blur effect
        }}
      />
      {children}
    </div>
  );
};

export default MeshGradientBackground;
