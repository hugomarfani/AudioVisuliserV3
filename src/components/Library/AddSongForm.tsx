import React, { useState } from 'react';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';
import { FaSpinner } from 'react-icons/fa';
import {useAIProcessTracking} from '../../hooks/useAIProcessTracking';

interface AddSongFormProps {
  onSubmit: (data: { url: string; prompt: string; moods: string[] }) => void;
}

const AddSongForm: React.FC<AddSongFormProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);

  const handleComplete = (data: any) => {
    // Continue with form submission or other actions
    onSubmit({ url, prompt: selectedPrompt, moods: selectedMoods });
    setUrl('');
    setSelectedPrompt('');
    setSelectedMoods([]);
  };

  const {
    isProcessing,
    status,
    progressSteps,
    startProcessing,
    setStatus,
    updateStep
  } = useAIProcessTracking({
    operationId: currentOperationId,
    onComplete: handleComplete
  });

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidYouTubeUrl(url)) {
      setStatus('Invalid YouTube URL');
      return;
    }
    
    // Generate operation ID
    const operationId = `add-song-${Date.now()}`;
    setCurrentOperationId(operationId);
    
    // Initialize processing state with initial steps
    startProcessing([
      { key: 'download', label: 'Downloading YouTube Audio', completed: false },
      { key: 'aiSetup', label: 'Preparing AI Environment', completed: false },
      { key: 'whisper', label: 'Running Speech Recognition', completed: false }
    ]);
    
    setStatus('Downloading and processing...');
    
    try {
      const resultID = await window.electron.ipcRenderer.invoke(
        'download-wav',
        url,
      );
      
      // Mark download as complete
      updateStep('download', true);
      
      setStatus(`Successfully downloaded! Processing with Whisper...`);
      
      // Run whisper with our operation ID
      await window.electron.ipcRenderer.invoke(
        'run-whisper',
        resultID,
        operationId
      );
      
      // The rest of the process will be handled by the listeners in the hook
    } catch (error) {
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setCurrentOperationId(null);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter YouTube URL"
        pattern="^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+"
        onInvalid={(e: React.InvalidEvent<HTMLInputElement>) => {
          e.target.setCustomValidity('Please enter a valid YouTube URL');
        }}
        onInput={(e: React.FormEvent<HTMLInputElement>) => {
          e.currentTarget.setCustomValidity('');
        }}
        style={{
          padding: '0.5rem',
          borderRadius: '8px',
          border: `1px solid ${colors.grey2}`,
          fontSize: '1rem',
        }}
        required
      />

      <button
        type="submit"
        disabled={isProcessing}
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: isProcessing ? colors.grey3 : colors.blue,
          color: colors.white,
          border: 'none',
          borderRadius: '999px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          marginTop: '1rem',
          width: 'fit-content',
          alignSelf: 'center',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {isProcessing && <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />}
        {isProcessing ? 'Processing...' : 'Add Song'}
      </button>

      <AIProgressTracker 
        isProcessing={isProcessing}
        progressSteps={progressSteps}
        statusMessage={status}
      />
    </form>
  );
};

export default AddSongForm;
