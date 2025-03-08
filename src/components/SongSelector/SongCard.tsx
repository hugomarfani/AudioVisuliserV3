import React, { useState, useRef, useEffect } from 'react';
import { FaInfoCircle, FaStar } from 'react-icons/fa';
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
  useShader: boolean; // Whether to use shader or particles
  onParticleClick?: (songId: string) => void;
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
    ? titleWidth - containerWidth + 20 // Add some padding
    : 0;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(uri)}
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: colors.grey5,
        padding: 'clamp(0.75rem, 1.5vw, 1.5rem)',
        borderRadius: '24px',
        width: '95%',
        height: 'clamp(70px, 12vh, 100px)',
        margin: '0 auto',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 10px 15px rgba(0, 0, 0, 0.1)'
          : '0 2px 5px rgba(0, 0, 0, 0.05)',
        border: isHovered ? `1px solid ${colors.grey4}` : '1px solid transparent',
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
          boxShadow: isHovered ? '0 4px 8px rgba(0, 0, 0, 0.15)' : 'none',
        }}
      />
      <div style={{ flex: 1, marginLeft: 'clamp(0.8rem, 1.5vw, 1.5rem)', overflow: 'hidden' }}>
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
              display: 'inline-block', // Important for proper width measurement
              position: 'relative', // Needed for animation
              transition: 'transform 0.3s ease',
              overflow: 'visible', // Allow text to flow outside during animation
              transform: isHovered && isTitleOverflowing 
                ? `translateX(-${translateDistance}px)` // Use dynamic translation based on calculated overflow
                : 'translateX(0)',
              transitionDelay: isHovered ? '0.2s' : '0s', // Delay before scrolling starts
              transitionDuration: isHovered ? `${animationDuration}s` : '0.3s', // Slower for scrolling, faster for reset
              transitionTimingFunction: isHovered ? 'linear' : 'ease', // Linear for smoother scrolling
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
