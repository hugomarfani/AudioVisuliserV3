import React, { useState, useEffect } from 'react';
import { FaPlay, FaSpinner, FaFileAlt } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';

interface WhisperRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
}

const WhisperRunner: React.FC<WhisperRunnerProps> = ({ song, songId, refetch }) => {
  const [whisperStatus, setWhisperStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  // Progress step display names
  const progressLabels: Record<string, string> = {
    aiSetup: 'AI Setup',
    whisper: 'Speech to Text Processing'
  };

  // Set up listeners for Whisper progress events
  useEffect(() => {
    // Create references to store removal functions
    let removeProgressListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    let removeCompleteListener: (() => void) | undefined;
    
    const progressListener = (data: any) => {
      console.log("Whisper progress update received:", data);
      if (data && data.operationId === currentOperationId) {
        setProgressSteps(prevSteps => {
          const stepIndex = prevSteps.findIndex(step => step.key === data.step);
          
          let newSteps;
          if (stepIndex >= 0) {
            // Create a new array with the updated step
            newSteps = [...prevSteps];
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              completed: data.completed
            };
          } else {
            // Add new step to the array
            newSteps = [
              ...prevSteps,
              {
                key: data.step,
                label: progressLabels[data.step] || data.step,
                completed: data.completed
              }
            ];
          }
          
          return newSteps;
        });
      }
    };

    const errorListener = (data: any) => {
      console.log("Whisper error received:", data);
      if (data && data.operationId === currentOperationId) {
        setWhisperStatus(`Error: ${data.error}`);
        setIsProcessing(false);
        
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    const completeListener = (data: any) => {
      console.log("Whisper process complete:", data);
      if (data && data.operationId === currentOperationId) {
        setIsProcessing(false);
        setWhisperStatus('Transcription completed successfully!');
        refetch();
        
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    // Set up listeners
    if (currentOperationId) {
      console.log("Setting up Whisper event listeners for operation:", currentOperationId);
      removeProgressListener = window.electron.ipcRenderer.on('ai-progress-update', progressListener);
      removeErrorListener = window.electron.ipcRenderer.on('ai-error', errorListener);
      removeCompleteListener = window.electron.ipcRenderer.on('ai-process-complete', completeListener);
    }

    return () => {
      // Cleanup function
      console.log("Cleaning up Whisper event listeners");
      if (removeProgressListener) removeProgressListener();
      if (removeErrorListener) removeErrorListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [currentOperationId, refetch, progressLabels]);

  const handleRunWhisper = async () => {
    // Generate operation ID locally
    const operationId = `whisper-${songId}-${Date.now()}`;
    
    // Clear any previous progress steps and set processing state
    setProgressSteps([]);
    setIsProcessing(true);
    setWhisperStatus('Running speech-to-text transcription...');
    
    // Set operation ID
    setCurrentOperationId(operationId);
    
    try {
      await window.electron.ipcRenderer.invoke(
        'run-whisper',
        songId,
        operationId
      );
      
      setWhisperStatus(`Whisper running with operation ID: ${operationId}`);
    } catch (error) {
      setIsProcessing(false);
      setCurrentOperationId(null);
      setWhisperStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
        <FaFileAlt style={{ marginRight: '0.5rem' }} />
        Speech to Text
      </h3>
      
      <p style={{ fontSize: '1rem', color: colors.grey2, marginBottom: '1rem' }}>
        Generate or update the lyrics transcription using Whisper
      </p>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
        <button
          onClick={handleRunWhisper}
          disabled={isProcessing}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: !isProcessing ? colors.blue : colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: !isProcessing ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
          }}
        >
          {isProcessing ? (
            <FaSpinner style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
          ) : (
            <FaPlay style={{ marginRight: '0.5rem' }} />
          )}
          {isProcessing ? 'Processing...' : 'Run Whisper Transcription'}
        </button>
      </div>
      
      {/* Use AIProgressTracker component */}
      <AIProgressTracker 
        isProcessing={isProcessing}
        progressSteps={progressSteps}
        statusMessage={whisperStatus}
      />
    </div>
  );
};

export default WhisperRunner;
