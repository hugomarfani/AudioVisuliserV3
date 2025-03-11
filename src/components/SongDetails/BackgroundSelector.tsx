import React, { useState } from 'react';
import { FaPaintBrush, FaPlay } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';

interface BackgroundSelectorProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({ song, songId, refetch }) => {
//   const [gemmaStatus, setGemmaStatus] = useState<string>('');
  const [sdStatus, setSDStatus] = useState<string>('');

//   const handleRunGemma = async () => {
//     setGemmaStatus('Running Gemma...');
//     try {
//       const result = await window.electron.ipcRenderer.invoke(
//         'run-gemma',
//         songId,
//       );
//       setGemmaStatus(`Gemma running ... ${result}`);
//       refetch();
//     } catch (error) {
//       setGemmaStatus(`Error: ${error.message || 'Unknown error occurred'}`);
//     }
//   };

  const handleRunStableDiffusion = async () => {
    // Check if backgrounds are empty
    if (!song || !song.dataValues.backgrounds || song.dataValues.backgrounds.length === 0) {
      setSDStatus('Please run Gemma first to generate backgrounds');
      return;
    }
    
    setSDStatus('Running Stable Diffusion...');
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'run-stable-diffusion',
        songId,
      );
      setSDStatus(`Stable Diffusion running ... ${result}`);
      if (result){
        //update the databse with the new images
        const pathBefore = "images/"+songId+"/";
        let new_images = ["background_prompts_0.png", "background_prompts_1.png", "background_prompts_2.png",
          "object_prompts_0.png", "object_prompts_1.png", "object_prompts_2.png"];
        new_images = new_images.map((image) => pathBefore + image);
        new_images = new_images.concat(song.dataValues.images.filter((image) => !image.includes("background_prompts") && !image.includes("object_prompts")));
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          images: new_images
        });
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
      }
      refetch();
    } catch (error) {
      setSDStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

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
      
      {/* Background generation controls */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginTop: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* <button
          onClick={handleRunGemma}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.blue,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          <FaPlay style={{ marginRight: '0.5rem' }} />
          Run Gemma
        </button> */}
        
        <button
          onClick={handleRunStableDiffusion}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: song?.dataValues.backgrounds?.length ? colors.mint : colors.grey3, // Apple purple for active, grey for disabled
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: song?.dataValues.backgrounds?.length ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
          }}
        >
          <FaPaintBrush style={{ marginRight: '0.5rem' }} />
          Generate Images
        </button>
      </div>
      
      {/* {gemmaStatus && (
        <p
          style={{ fontSize: '1rem', color: colors.grey2, marginTop: '1rem' }}
        >
          {gemmaStatus}
        </p>
      )} */}
      
      {sdStatus && (
        <p
          style={{ 
            fontSize: '1rem', 
            color: sdStatus.includes('Error') || sdStatus.includes('Please run Gemma') ? '#FF3B30' : colors.grey2,
            marginTop: '0.5rem' 
          }}
        >
          {sdStatus}
        </p>
      )}
    </div>
  );
};

export default BackgroundSelector;
