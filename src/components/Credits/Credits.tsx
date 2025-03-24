import React, { useState, useEffect } from 'react';
import colors from '../../theme/colors';

interface CreditsProps {
  onClose: () => void;
}

interface LogoData {
  src: string;
  alt: string;
  width: string;
}

const Credits: React.FC<CreditsProps> = ({ onClose }) => {
  const [logos, setLogos] = useState<Record<string, LogoData>>({
    mi: { src: '', alt: 'Motion Input Logo', width: '160px' },
    ucl: { src: '', alt: 'University College London Logo', width: '180px' },
    nas: { src: '', alt: 'National Autistic Society Logo', width: '140px' },
    intel: { src: '', alt: 'Intel Logo', width: '120px' },
  });

  useEffect(() => {
    const loadLogos = async () => {
      try {
        const miLogoPath = await window.electron.fileSystem.mergeAssetPath('MILogo.png');
        const uclLogoPath = await window.electron.fileSystem.mergeAssetPath('UCLLogo.png');
        const nasLogoPath = await window.electron.fileSystem.mergeAssetPath('NASLogo.png');
        const intelLogoPath = await window.electron.fileSystem.mergeAssetPath('IntelLogo.png');
        
        setLogos({
          mi: { ...logos.mi, src: miLogoPath },
          ucl: { ...logos.ucl, src: uclLogoPath },
          nas: { ...logos.nas, src: nasLogoPath },
          intel: { ...logos.intel, src: intelLogoPath },
        });
      } catch (error) {
        console.error('Failed to load logo images:', error);
      }
    };
    
    loadLogos();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '24px',
          padding: '2rem',
          width: '80%',
          maxWidth: '600px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '1rem',
            backgroundColor: 'transparent',
            color: colors.grey2,
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
          onClick={onClose}
        >
          &times;
        </button>
        
        <h2 style={{ 
          marginBottom: '1.5rem', 
          color: colors.black,
          textAlign: 'center',
          fontSize: '1.75rem'
        }}>Credits</h2>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '2rem'
        }}>
          {/* Primary institution */}
          <section>
            <h3 style={{ 
              fontSize: '1.2rem', 
              color: colors.grey1,
              marginBottom: '0.75rem',
              textAlign: 'center',
            }}>
              A project by
            </h3>
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1.5rem',
              marginBottom: '0.5rem'
            }}>
              <img 
                src={logos.mi.src} 
                alt={logos.mi.alt}
                style={{ 
                  maxWidth: logos.mi.width,
                  objectFit: 'contain',
                  height: 'auto'
                }}
              />
              <img 
                src={logos.ucl.src} 
                alt={logos.ucl.alt}
                style={{ 
                  maxWidth: logos.ucl.width,
                  objectFit: 'contain',
                  height: 'auto'
                }}
              />
            </div>
          </section>
          
          {/* Sponsors */}
          <section>
            <h3 style={{ 
              fontSize: '1.2rem', 
              color: colors.grey1,
              marginBottom: '0.75rem',
              textAlign: 'center',
            }}>
              Sponsored by
            </h3>
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '2rem',
              marginBottom: '1rem'
            }}>
              <img 
                src={logos.nas.src} 
                alt={logos.nas.alt}
                style={{ 
                  maxWidth: logos.nas.width,
                  objectFit: 'contain',
                  height: 'auto'
                }}
              />
              <img 
                src={logos.intel.src} 
                alt={logos.intel.alt}
                style={{ 
                  maxWidth: logos.intel.width,
                  objectFit: 'contain',
                  height: 'auto'
                }}
              />
            </div>
          </section>
          
          {/* Creators */}
          <section>
            <h3 style={{ 
              fontSize: '1.2rem', 
              color: colors.grey1,
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              Creators
            </h3>
            <div style={{
              textAlign: 'center',
              color: colors.grey2,
              lineHeight: '1.6'
            }}>
              <p>Horesh Lopian • Hugo Marfani • Runze Cheng • Kiminao Usami</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Credits;
