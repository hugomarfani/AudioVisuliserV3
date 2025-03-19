import React from 'react';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';

interface SongSelectionItemProps {
  song: SongModel;
  isSelected: boolean;
  onToggle: () => void;
  isDisabled: boolean;
}

const SongSelectionItem: React.FC<SongSelectionItemProps> = ({ 
  song, 
  isSelected, 
  onToggle,
  isDisabled
}) => {
  const [imagePath, setImagePath] = React.useState<string>('');

  React.useEffect(() => {
    const findImagePath = async () => {
      const response = await window.electron.fileSystem.mergeAssetPath(
        song.jacket,
      );
      setImagePath(response);
    };
    findImagePath();
  }, [song.jacket]);

  return (
    <div 
      onClick={!isDisabled ? onToggle : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem',
        backgroundColor: isSelected ? `${colors.blue}20` : colors.grey5,
        borderRadius: '12px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        marginBottom: '0.5rem',
        transition: 'background-color 0.2s',
        border: isSelected ? `1px solid ${colors.blue}` : '1px solid transparent',
      }}
    >
      <input 
        type="checkbox" 
        checked={isSelected}
        onChange={onToggle}
        disabled={isDisabled}
        style={{ 
          marginRight: '0.75rem',
          width: '18px',
          height: '18px'
        }}
        onClick={(e) => e.stopPropagation()}
      />
      
      <img
        src={imagePath}
        alt={song.title}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          marginRight: '0.75rem',
          objectFit: 'cover'
        }}
      />
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          fontWeight: 'bold',
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {song.title}
        </div>
        <div style={{ 
          fontSize: '0.8rem',
          color: colors.grey2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {song.uploader}
        </div>
      </div>
    </div>
  );
};

export default SongSelectionItem;
