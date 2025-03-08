import React, { useState } from 'react';

const WindowControls: React.FC = () => {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Use the electron IPC functions exposed through the window object
  const handleClose = () => {
    window.electron.ipcRenderer.sendMessage('window-control', 'close');
  };

  const handleMinimize = () => {
    window.electron.ipcRenderer.sendMessage('window-control', 'minimize');
  };

  const handleToggleFullscreen = () => {
    window.electron.ipcRenderer.sendMessage('window-control', 'toggle-fullscreen');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        display: 'flex',
        gap: '6px', // Reduced gap to match macOS
        zIndex: 1000,
      }}
    >
      <button
        onClick={handleClose}
        onMouseEnter={() => setHoveredButton('close')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#FF5F57',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '9px',
          padding: 0,
          boxShadow: hoveredButton === 'close' ? 'inset 0 0 0 1px rgba(0, 0, 0, 0.2)' : 'none',
        }}
        title="Close"
      >
        {hoveredButton === 'close' && (
          <span style={{ fontWeight: 'bold', lineHeight: 1, color: '#4D0000' }}>×</span>
        )}
      </button>
      <button
        onClick={handleMinimize}
        onMouseEnter={() => setHoveredButton('minimize')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#FFBD2E',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '9px',
          padding: 0,
          boxShadow: hoveredButton === 'minimize' ? 'inset 0 0 0 1px rgba(0, 0, 0, 0.2)' : 'none',
        }}
        title="Minimize"
      >
        {hoveredButton === 'minimize' && (
          <span style={{ fontWeight: 'bold', lineHeight: 0, marginBottom: '1px', color: '#995700' }}>−</span>
        )}
      </button>
      <button
        onClick={handleToggleFullscreen}
        onMouseEnter={() => setHoveredButton('fullscreen')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#28C940',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 0,
          boxShadow: hoveredButton === 'fullscreen' ? 'inset 0 0 0 1px rgba(0, 0, 0, 0.2)' : 'none',
        }}
        title="Toggle Fullscreen"
      >
        {hoveredButton === 'fullscreen' && (
          <div style={{
            position: 'relative',
            width: '6px',
            height: '6px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <svg width="6" height="6" viewBox="0 0 6 6" style={{ fill: '#006400' }}>
              <path d="M0.5,2.5 L2.5,0.5 M0.5,0.5 L2.5,0.5 L0.5,2.5 M5.5,3.5 L3.5,5.5 M5.5,5.5 L3.5,5.5 L5.5,3.5" 
                    stroke="#006400" 
                    strokeWidth="1" 
                    fill="none" />
            </svg>
          </div>
        )}
      </button>
    </div>
  );
};

export default WindowControls;