import React from 'react';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import StableDiffusionRunner from './StableDiffusionRunner';

interface BackgroundSelectorProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({ song, songId, refetch }) => {
  return (
    <div>
      {/* Display background_prompts if available */}
      {song.dataValues.background_prompts && song.dataValues.background_prompts.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            Background Prompts:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {song.dataValues.background_prompts.map((prompt, index) => (
              <li key={`bg-${index}`} style={{ color: colors.grey2, marginBottom: '0.25rem' }}>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Display object_prompts if available */}
      {song.dataValues.object_prompts && song.dataValues.object_prompts.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            Object Prompts:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {song.dataValues.object_prompts.map((prompt, index) => (
              <li key={`obj-${index}`} style={{ color: colors.grey2, marginBottom: '0.25rem' }}>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Replace the old buttons with the new StableDiffusionRunner */}
      <StableDiffusionRunner 
        song={song} 
        songId={songId} 
        refetch={refetch} 
      />
    </div>
  );
};

export default BackgroundSelector;
