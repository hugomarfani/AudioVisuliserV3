import React from 'react';
import AIRunner from '../common/AIRunner';
import { SongModel } from '../../database/models/Song';
import { progressLabels } from '../../hooks/useAIProcessTracking';

interface StableDiffusionRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const StableDiffusionRunner: React.FC<StableDiffusionRunnerProps> = ({
  song,
  songId,
  refetch
}) => {
  // Define the options for the stable diffusion process
  const stableDiffusionOptions = [
    {
      key: 'generateImages',
      label: 'Generate All Images',
      description: 'Generate all background and object images'
    }
  ];

  // Validation function to ensure backgrounds exist
  const validateOptions = (selectedOptions: string[], song: SongModel) => {
    if (!song || !song.dataValues.backgrounds || song.dataValues.backgrounds.length === 0) {
      return { 
        isValid: false, 
        message: 'Please run Gemma first to generate backgrounds' 
      };
    }
    return { isValid: true };
  };

  // Handler for when the process completes
  const handleComplete = async (data: any) => {
    if (data) {
      //update the database with the new images
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
      refetch();
    }
  };

  return (
    <AIRunner
      song={song}
      songId={songId}
      refetch={refetch}
      title="Image Generation"
      description="Generate images using Stable Diffusion based on the background and object prompts"
      options={stableDiffusionOptions}
      progressLabels={progressLabels}
      invokeChannel="run-stable-diffusion"
      validateOptions={validateOptions}
      onComplete={handleComplete}
      expectedSteps={[
        'aiSetup', 
        'stableDiffusion', 
        'imageBack1', 
        'imageBack2', 
        'imageBack3', 
        'imageObj1', 
        'imageObj2', 
        'imageObj3'
      ]}
    />
  );
};

export default StableDiffusionRunner;
