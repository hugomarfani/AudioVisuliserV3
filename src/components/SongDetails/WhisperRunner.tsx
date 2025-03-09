import React from 'react';
import { SongModel } from '../../database/models/Song';
import AIRunner from '../common/AIRunner';

interface WhisperRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const WhisperRunner: React.FC<WhisperRunnerProps> = ({ song, songId, refetch }) => {
  // Progress step display names
  const progressLabels: Record<string, string> = {
    audioPreparation: 'Audio Preparation',
    whisperProcessing: 'Speech Recognition',
    jsonStorage: 'Saving Results'
  };

  // Define the available Whisper options
  const whisperOptions = [
    { 
      key: 'generateTranscript',
      label: 'Generate Transcript',
      flag: '-t',
      description: 'Generate full transcript from audio'
    },
    { 
      key: 'generateLyrics',
      label: 'Generate Lyrics',
      flag: '-l',
      description: 'Extract lyrics from audio'
    },
    { 
      key: 'useHighAccuracy',
      label: 'Use High Accuracy Model',
      flag: '--high-accuracy',
      description: 'Use larger model for better accuracy (slower)'
    },
    { 
      key: 'forceReprocess',
      label: 'Force Reprocessing',
      flag: '--force',
      description: 'Force reprocessing even if transcript exists'
    },
    { 
      key: 'all',
      label: 'Run All Features',
      flag: '--all',
      description: 'Run all Whisper features'
    }
  ];

  // Prepare options for Whisper
  const prepareWhisperOptions = (selectedOptions: string[]) => {
    let options: Record<string, boolean> = {};
    
    if (selectedOptions.includes('all')) {
      options = {
        generateTranscript: true,
        generateLyrics: true,
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
      title="Whisper Speech Recognition"
      description="Process audio to extract transcript and lyrics"
      options={whisperOptions}
      progressLabels={progressLabels}
      invokeChannel="run-whisper-with-options"
      runAllKey="all"
      prepareOptions={prepareWhisperOptions}
    />
  );
};

export default WhisperRunner;
