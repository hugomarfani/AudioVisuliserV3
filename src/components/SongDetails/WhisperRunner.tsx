/*

DEPRECATED COMPONENT
Code now works as Whisper running straight after downloading or uploading audio files.
May be useful for future reference, but not needed for current implementation.

*/


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

  // Default options to use (no user selection needed)
  const defaultOptions = {
    generateTranscript: true,
    generateLyrics: true,
    useHighAccuracy: true
  };

  return (
    <AIRunner
      song={song}
      songId={songId}
      refetch={refetch}
      title="Whisper Speech Recognition"
      description="Process audio to extract transcript and lyrics"
      defaultOptions={defaultOptions}
      progressLabels={progressLabels}
      invokeChannel="run-whisper-with-options"
      hideOptions={true}
    />
  );
};

export default WhisperRunner;
