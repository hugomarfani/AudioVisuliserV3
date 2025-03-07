import React, { useState } from 'react';
import { FaPlay, FaList, FaCheckSquare } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';

interface LLMRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

interface LLMOptionType {
  key: string;
  label: string;
  flag: string;
  description: string;
  dependsOn?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const LLMRunner: React.FC<LLMRunnerProps> = ({ song, songId, refetch }) => {
  const [gemmaStatus, setGemmaStatus] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState<boolean>(false);

  // Define the available LLM options
  const llmOptions: LLMOptionType[] = [
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
      key: 'all',
      label: 'Run All Features',
      flag: '--all',
      description: 'Extract all features using LLM'
    }
  ];

  const toggleOption = (optionKey: string) => {
    setSelectedOptions(prev => {
      const isSelected = prev.includes(optionKey);
      
      // If "all" is selected, clear all other options
      if (optionKey === 'all' && !isSelected) {
        return ['all'];
      }
      
      // If another option is selected while "all" is active, remove "all"
      const newOptions = prev.filter(key => key !== 'all' && key !== optionKey);
      
      if (!isSelected) {
        newOptions.push(optionKey);
      }
      
      return newOptions;
    });
  };

  const handleRunGemma = async () => {
    if (selectedOptions.length === 0) {
      setGemmaStatus('Please select at least one option');
      return;
    }

    // Special validation for prompt generation options
    const hasObjectPrompts = selectedOptions.includes('generateObjectPrompts');
    const hasBackgroundPrompts = selectedOptions.includes('generateBackgroundPrompts');
    const hasExtractObjects = selectedOptions.includes('extractObject');
    const hasExtractBackgrounds = selectedOptions.includes('extractBackground');
    const existingObjects = song.dataValues.objects && song.dataValues.objects.length > 0;
    const existingBackgrounds = song.dataValues.backgrounds && song.dataValues.backgrounds.length > 0;
    
    // Validate object prompts
    if (hasObjectPrompts && !hasExtractObjects && !existingObjects) {
      setGemmaStatus('Cannot generate object prompts without extracting objects or having existing objects');
      return;
    }
    
    // Validate background prompts
    if (hasBackgroundPrompts && !hasExtractBackgrounds && !existingBackgrounds) {
      setGemmaStatus('Cannot generate background prompts without extracting backgrounds or having existing backgrounds');
      return;
    }

    setGemmaStatus('Running Gemma...');
    
    try {
      // Prepare the options to send to main process
      let options: Record<string, boolean> = {};
      
      if (selectedOptions.includes('all')) {
        options = {
          extractColour: true,
          extractParticle: true,
          extractObject: true,
          extractBackground: true,
          generateObjectPrompts: true,
          generateBackgroundPrompts: true,
          all: true
        };
      } else {
        selectedOptions.forEach(opt => {
          options[opt] = true;
        });
      }
      
      const result = await window.electron.ipcRenderer.invoke(
        'run-gemma-with-options',
        {
          songId,
          options
        }
      );
      
      setGemmaStatus(`Gemma running... ${result}`);
      refetch();
    } catch (error) {
      setGemmaStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const isOptionDisabled = (option: LLMOptionType): boolean => {
    // If "all" is selected, disable all other options
    if (selectedOptions.includes('all') && option.key !== 'all') {
      return true;
    }
    
    // Check option's own disabled status
    if (option.disabled) {
      return true;
    }
    
    // If option depends on another option
    if (option.dependsOn && !selectedOptions.includes(option.dependsOn)) {
      // Check if the data already exists in the song
      if (option.key === 'generateObjectPrompts' && song.dataValues.objects && song.dataValues.objects.length > 0) {
        return false;
      }
      if (option.key === 'generateBackgroundPrompts' && song.dataValues.backgrounds && song.dataValues.backgrounds.length > 0) {
        return false;
      }
      return true;
    }
    
    return false;
  };

  const getOptionTooltip = (option: LLMOptionType): string => {
    if (selectedOptions.includes('all') && option.key !== 'all') {
      return 'Disabled when "Run All Features" is selected';
    }
    
    if (option.disabled && option.disabledReason) {
      return option.disabledReason;
    }
    
    if (option.dependsOn && !selectedOptions.includes(option.dependsOn)) {
      if (option.key === 'generateObjectPrompts' || option.key === 'generateBackgroundPrompts') {
        const hasData = option.key === 'generateObjectPrompts' 
          ? (song.dataValues.objects && song.dataValues.objects.length > 0)
          : (song.dataValues.backgrounds && song.dataValues.backgrounds.length > 0);
          
        if (hasData) {
          return option.description;
        }
        return `Requires "${llmOptions.find(o => o.key === option.dependsOn)?.label}" to be selected`;
      }
    }
    
    return option.description;
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
        <FaList style={{ marginRight: '0.5rem' }} />
        LLM Features
      </h3>
      
      <p style={{ fontSize: '1rem', color: colors.grey2, marginBottom: '1rem' }}>
        Select which features to extract from the song using Gemma LLM
      </p>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowOptions(!showOptions)}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FaCheckSquare style={{ marginRight: '0.5rem' }} />
          {showOptions ? 'Hide Options' : 'Show Options'}
        </button>
        
        <button
          onClick={handleRunGemma}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: selectedOptions.length > 0 ? colors.blue : colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
          }}
        >
          <FaPlay style={{ marginRight: '0.5rem' }} />
          Run Selected Features
        </button>
      </div>
      
      {showOptions && (
        <div style={{ 
          backgroundColor: colors.grey5, 
          borderRadius: '12px', 
          padding: '1rem', 
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {llmOptions.map((option) => (
              <div 
                key={option.key} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                }}
                title={getOptionTooltip(option)}
              >
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    opacity: isOptionDisabled(option) ? 0.5 : 1,
                    cursor: isOptionDisabled(option) ? 'not-allowed' : 'pointer' 
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option.key)}
                    onChange={() => !isOptionDisabled(option) && toggleOption(option.key)}
                    disabled={isOptionDisabled(option)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {option.label}
                </label>
                <span style={{ 
                  marginLeft: '0.5rem', 
                  fontSize: '0.8rem', 
                  color: colors.grey2,
                  opacity: isOptionDisabled(option) ? 0.5 : 0.8,
                }}>
                  {option.flag}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {gemmaStatus && (
        <p
          style={{ 
            fontSize: '1rem', 
            color: gemmaStatus.includes('Error') || gemmaStatus.includes('Cannot')
              ? '#FF3B30' 
              : colors.grey2,
            marginTop: '1rem' 
          }}
        >
          {gemmaStatus}
        </p>
      )}
    </div>
  );
};

export default LLMRunner;
