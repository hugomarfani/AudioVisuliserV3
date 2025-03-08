import React from 'react';
import { SongModel } from '../../database/models/Song';
import AIRunner from '../common/AIRunner';

interface LLMRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const LLMRunner: React.FC<LLMRunnerProps> = ({ song, songId, refetch }) => {
  // Progress step display names
  const progressLabels: Record<string, string> = {
    whisper: 'Speech to Text',
    llm: 'Language Model Processing',
    stableDiffusion: 'Image Generation',
    aiSetup: 'AI Setup',
    statusExtraction: 'Extracting Status',
    colourExtraction: 'Extracting Colors',
    particleExtraction: 'Extracting Particles',
    objectExtraction: 'Extracting Objects',
    backgroundExtraction: 'Extracting Backgrounds',
    objectPrompts: 'Generating Object Prompts',
    backgroundPrompts: 'Generating Background Prompts',
    jsonStorage: 'Saving Results'
  };

  // Define the available LLM options
  const llmOptions = [
    { 
      key: 'extractColour',
      label: 'Extract Colors',
      flag: '-c',
      description: 'Extract color themes from song lyrics'
    },
    { 
      key: 'extractParticle',
      label: 'Extract Particles',
      flag: '-p',
      description: 'Extract suitable particle effects from lyrics'
    },
    { 
      key: 'extractObject',
      label: 'Extract Objects',
      flag: '-o',
      description: 'Extract relevant objects from lyrics'
    },
    { 
      key: 'generateObjectPrompts',
      label: 'Generate Object Prompts',
      flag: '--generateObjectPrompts',
      description: 'Generate image prompts for extracted objects',
      dependsOn: 'extractObject',
      disabled: !song.dataValues.objects || song.dataValues.objects.length === 0,
      disabledReason: 'Requires extracted objects'
    },
    { 
      key: 'extractBackground',
      label: 'Extract Backgrounds',
      flag: '-b',
      description: 'Extract background scenes from lyrics'
    },
    { 
      key: 'generateBackgroundPrompts',
      label: 'Generate Background Prompts',
      flag: '--generateBackgroundPrompts',
      description: 'Generate image prompts for backgrounds',
      dependsOn: 'extractBackground',
      disabled: !song.dataValues.backgrounds || song.dataValues.backgrounds.length === 0,
      disabledReason: 'Requires extracted backgrounds'
    },
    { 
      key: 'rerunWhisper',
      label: 'Rerun Lyrics Generation',
      flag: '-w',
      description: 'Rerun Whisper speech-to-text on audio (note: usually does not change output)'
    },
    { 
      key: 'extractStatus',
      label: 'Extract Status',
      flag: '--status',
      description: 'Extract Zone of Regulation status from lyrics'
    },
    { 
      key: 'all',
      label: 'Run All Features',
      flag: '--all',
      description: 'Extract all features using LLM'
    }
  ];

  // Validation function for LLM options
  const validateLLMOptions = (selectedOptions: string[], song: SongModel) => {
    // Special validation for prompt generation options
    const hasObjectPrompts = selectedOptions.includes('generateObjectPrompts');
    const hasBackgroundPrompts = selectedOptions.includes('generateBackgroundPrompts');
    const hasExtractObjects = selectedOptions.includes('extractObject');
    const hasExtractBackgrounds = selectedOptions.includes('extractBackground');
    const existingObjects = song.dataValues.objects && song.dataValues.objects.length > 0;
    const existingBackgrounds = song.dataValues.backgrounds && song.dataValues.backgrounds.length > 0;
    
    // Validate object prompts
    if (hasObjectPrompts && !hasExtractObjects && !existingObjects) {
      return { 
        isValid: false, 
        message: 'Cannot generate object prompts without extracting objects or having existing objects' 
      };
    }
    
    // Validate background prompts
    if (hasBackgroundPrompts && !hasExtractBackgrounds && !existingBackgrounds) {
      return { 
        isValid: false, 
        message: 'Cannot generate background prompts without extracting backgrounds or having existing backgrounds' 
      };
    }

    return { isValid: true };
  };

  // Prepare options for the LLM
  const prepareLLMOptions = (selectedOptions: string[]) => {
    let options: Record<string, boolean> = {};
    
    if (selectedOptions.includes('all')) {
      options = {
        extractColour: true,
        extractParticle: true,
        extractObject: true,
        extractBackground: true,
        generateObjectPrompts: true,
        generateBackgroundPrompts: true,
        extractStatus: true,
        all: true
      };
    } else {
      selectedOptions.forEach(opt => {
        options[opt] = true;
      });
    }
    
    return options;
  };

  return (
    <AIRunner
      song={song}
      songId={songId}
      refetch={refetch}
      title="LLM Features"
      description="Select which features to extract from the song using Gemma LLM"
      options={llmOptions}
      progressLabels={progressLabels}
      invokeChannel="run-gemma-with-options"
      runAllKey="all"
      validateOptions={validateLLMOptions}
      prepareOptions={prepareLLMOptions}
    />
  );
};

export default LLMRunner;
