import React, { useState, useRef, useEffect } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import colors from '../../theme/colors';
import { SongModel } from '../../database/models/Song';
import { useNavigate } from 'react-router-dom';

type SongCardProps = {
  uri: string;
  songDetails: SongModel;
  onSelect: (uri: string) => void;
  accessToken: string;
  selectedDevice: string | null;
  onDetailsClick: (songID: string) => void;
  useShader: boolean;
  onParticleClick?: (songId: string) => void;
  disabled?: boolean;
};

const statusMap: Record<string, string> = {
  blue: colors.blue,
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
};

function SongCard({
  uri,
  songDetails,
  onSelect,
  onDetailsClick,
  useShader,
  onParticleClick,
  disabled = false, // Default to not disabled
}: SongCardProps): JSX.Element {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const [titleWidth, setTitleWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if title is overflowing its container
  useEffect(() => {
    if (titleRef.current && containerRef.current) {
      const titleElement = titleRef.current;
      const containerElement = containerRef.current;
      
      // Get actual widths
      const titleElementWidth = titleElement.scrollWidth;
      const containerElementWidth = containerElement.clientWidth;
      
      // Update state with measured widths
      setTitleWidth(titleElementWidth);
      setContainerWidth(containerElementWidth);
      
      // Set overflow flag
      setIsTitleOverflowing(titleElementWidth > containerElementWidth);
    }
  }, [songDetails.title]);

  if (!songDetails) {
    return <div>Song not found</div>;
  }

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDetailsClick(uri);
  };
  
  const [imagePath, setImagePath] = React.useState<string>('');

  React.useEffect(() => {
    const findImagePath = async () => {
      const response = await window.electron.fileSystem.mergeAssetPath(
        songDetails.jacket,
      );
      setImagePath(response);
    };
    findImagePath();
  }, [songDetails.jacket]);

  // Calculate animation duration based on title length - longer titles need more time to scroll
  const animationDuration = Math.max(2, Math.min(6, songDetails.title.length * 0.15));
  
  // Calculate how far the text needs to translate to show all content
  const translateDistance = titleWidth > 0 && containerWidth > 0 
    ? titleWidth - containerWidth + 20 
    : 0;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !disabled && onSelect(uri)}
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: disabled ? `${colors.grey5}90` : colors.grey5,
        padding: 'clamp(0.75rem, 1.5vw, 1.5rem)',
        borderRadius: '24px',
        width: '95%',
        height: 'clamp(70px, 12vh, 100px)',
        margin: '0 auto',
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease',
        transform: isHovered && !disabled ? 'translateY(-3px)' : 'translateY(0)', 
        boxShadow: isHovered && !disabled 
          ? '0 10px 15px rgba(0, 0, 0, 0.1)'
          : '0 2px 5px rgba(0, 0, 0, 0.05)',
        border: isHovered && !disabled ? `1px solid ${colors.grey4}` : '1px solid transparent',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <img
        src={imagePath}
        alt={songDetails.title}
        style={{
          borderRadius: '15px',
          width: 'clamp(50px, 8vh, 70px)',
          height: 'clamp(50px, 8vh, 70px)',
          objectFit: 'cover',
          transition: 'all 0.3s ease',
          boxShadow: isHovered && !disabled ? '0 4px 8px rgba(0, 0, 0, 0.15)' : 'none',
          filter: disabled ? 'grayscale(50%)' : 'none', 
        }}
      />
      
      {/* Warning icon for disabled songs */}
      {disabled && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.red,
          zIndex: 2,
        }}>
          !
        </div>
      )}
      
      <div style={{ flex: 1, marginLeft: 'clamp(0.8rem, 1.5vw, 1.5rem)', overflow: 'hidden', opacity: disabled ? 0.7 : 1 }}>
        <div 
          ref={containerRef}
          style={{ 
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <h2
            ref={titleRef}
            style={{
              fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
              margin: '0 0 0.5rem',
              fontWeight: 'bold',
              color: '#000',
              whiteSpace: 'nowrap',
              display: 'inline-block', 
              position: 'relative', 
              transition: 'transform 0.3s ease',
              overflow: 'visible', 
              transform: isHovered && isTitleOverflowing 
                ? `translateX(-${translateDistance}px)` 
                : 'translateX(0)',
              transitionDelay: isHovered ? '0.2s' : '0s', 
              transitionDuration: isHovered ? `${animationDuration}s` : '0.3s', 
              transitionTimingFunction: isHovered ? 'linear' : 'ease', 
            }}
          >
            {songDetails.title}
          </h2>
        </div>
        <p
          style={{
            fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
            margin: 0,
            color: '#6B7280',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {songDetails.uploader}
        </p>
      </div>
      
      {/* Status indicator */}
      <div>
        <span
          style={{
            display: 'inline-block',
            width: 'clamp(12px, 2vw, 18px)',
            height: 'clamp(12px, 2vw, 18px)',
            backgroundColor: statusMap[songDetails.status.toLowerCase()],
            borderRadius: '50%',
            transition: 'transform 0.3s ease',
            transform: isHovered ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      </div>
      
      {/* Info button */}
      <button
        onClick={handleDetailsClick}
        style={{
          position: 'absolute',
          top: 'clamp(0.5rem, 1.2vw, 0.8rem)',
          right: 'clamp(0.8rem, 1.5vw, 1.0rem)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isHovered ? colors.grey1 : colors.grey2,
          transition: 'all 0.3s ease',
          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        <FaInfoCircle size={Math.min(20, Math.max(16, window.innerWidth / 70))} />
      </button>
      
      {/* Remove the keyframe animation style tag since we're using CSS transitions instead */}
    </div>
  );
}

export default SongCard;
