import React, { useState } from 'react';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';
import { FaSpinner } from 'react-icons/fa';

const GEMMA_PROMPTS = [
  { id: 'emotions', label: 'Detect Emotions' },
  { id: 'instruments', label: 'Identify Instruments' },
  { id: 'genre', label: 'Analyze Genre' },
  { id: 'structure', label: 'Analyze Song Structure' },
];

const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'sad', label: 'Sad' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'calm', label: 'Calm' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'mysterious', label: 'Mysterious' },
];

interface AddSongFormProps {
  onSubmit: (data: { url: string; prompt: string; moods: string[] }) => void;
}

const AddSongForm: React.FC<AddSongFormProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<{ key: string; label: string; completed: boolean }[]>([]);

  // Progress step display names
  const progressLabels: Record<string, string> = {
    download: 'Downloading YouTube Audio',
    converting: 'Converting to WAV Format',
    aiSetup: 'Preparing AI Environment',
    whisper: 'Running Speech Recognition'
  };

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  // Set up listeners for Whisper progress events when component mounts
  React.useEffect(() => {
    let removeProgressListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    let removeCompleteListener: (() => void) | undefined;
    
    const progressListener = (data: any) => {
      if (data && data.operationId === currentOperationId) {
        console.log("Progress update received:", data);
        setProgressSteps(prevSteps => {
          const stepIndex = prevSteps.findIndex(step => step.key === data.step);
          
          let newSteps;
          if (stepIndex >= 0) {
            newSteps = [...prevSteps];
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              completed: data.completed
            };
          } else {
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
      if (data && data.operationId === currentOperationId) {
        setStatus(`Error: ${data.error}`);
        setIsProcessing(false);
        
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    const completeListener = (data: any) => {
      if (data && data.operationId === currentOperationId) {
        setIsProcessing(false);
        setStatus('Processing completed successfully!');
        
        // Continue with form submission or other actions
        onSubmit({ url, prompt: selectedPrompt, moods: selectedMoods });
        setUrl('');
        setSelectedPrompt('');
        setSelectedMoods([]);
        
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    // Set up listeners
    if (currentOperationId) {
      removeProgressListener = window.electron.ipcRenderer.on('ai-progress-update', progressListener);
      removeErrorListener = window.electron.ipcRenderer.on('ai-error', errorListener);
      removeCompleteListener = window.electron.ipcRenderer.on('ai-process-complete', completeListener);
    }

    return () => {
      // Cleanup function
      if (removeProgressListener) removeProgressListener();
      if (removeErrorListener) removeErrorListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [currentOperationId, onSubmit, url, selectedPrompt, selectedMoods, progressLabels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidYouTubeUrl(url)) {
      setStatus('Invalid YouTube URL');
      return;
    }
    
    // Generate operation ID
    const operationId = `add-song-${Date.now()}`;
    setCurrentOperationId(operationId);
    
    // Initialize processing state
    setIsProcessing(true);
    setProgressSteps([
      { key: 'download', label: 'Downloading YouTube Audio', completed: false },
      // { key: 'converting', label: 'Converting to WAV Format', completed: false }
    ]);
    setStatus('Downloading and processing...');
    
    try {
      // Update download step
      setProgressSteps(prev => {
        return prev.map(step => 
          step.key === 'download' ? { ...step, completed: false } : step
        );
      });
      
      const resultID = await window.electron.ipcRenderer.invoke(
        'download-wav',
        url,
      );
      
      // Mark download as complete
      setProgressSteps(prev => {
        return prev.map(step => 
          step.key === 'download' ? { ...step, completed: true } : step
        );
      });
      
      setStatus(`Successfully downloaded! Processing with Whisper...`);
      
      // Run whisper with our operation ID
      await window.electron.ipcRenderer.invoke(
        'run-whisper',
        resultID,
        operationId
      );
      
      // The rest of the process will be handled by the listeners set up in useEffect
    } catch (error) {
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setIsProcessing(false);
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

      {/* Gemma Prompt Selection for Mood -*/}
      {/* <div>
        <p style={{ marginBottom: '0.5rem', color: colors.grey2 }}>
          Select Moods (Optional)
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {MOOD_OPTIONS.map((mood) => (
            <label
              key={mood.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                backgroundColor: selectedMoods.includes(mood.id)
                  ? colors.blue
                  : colors.grey5,
                color: selectedMoods.includes(mood.id)
                  ? colors.white
                  : colors.black,
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="checkbox"
                value={mood.id}
                checked={selectedMoods.includes(mood.id)}
                onChange={(e) => {
                  setSelectedMoods(
                    e.target.checked
                      ? [...selectedMoods, mood.id]
                      : selectedMoods.filter((id) => id !== mood.id),
                  );
                }}
                style={{ display: 'none' }}
              />
              {mood.label}
            </label>
          ))}
        </div>
      </div> */}

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

      {/* Use AIProgressTracker component */}
      <AIProgressTracker 
        isProcessing={isProcessing}
        progressSteps={progressSteps}
        statusMessage={status}
      />
    </form>
  );
};

export default AddSongForm;
