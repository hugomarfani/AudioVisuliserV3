import React, { useState } from 'react';
import colors from '../../theme/colors';

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
    setStatus('Downloading and converting to WAV...');
    try {
      const resultID = await window.electron.ipcRenderer.invoke(
        'download-wav',
        url,
      );
      setStatus(`Successfully converted to WAV! Saved to: ${resultID}`);
      const whisperResult = await window.electron.ipcRenderer.invoke(
        'run-whisper',
        resultID,
      );
      console.log('Whisper result:', whisperResult);
      setStatus('Successfully ran Whisper!');
      onSubmit({ url, prompt: selectedPrompt, moods: selectedMoods });
      setUrl('');
      setSelectedPrompt('');
      setSelectedMoods([]);
    } catch (error) {
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
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

      <select
        value={selectedPrompt}
        onChange={(e) => setSelectedPrompt(e.target.value)}
        style={{
          padding: '0.5rem',
          borderRadius: '8px',
          border: `1px solid ${colors.grey2}`,
          fontSize: '1rem',
          backgroundColor: colors.white,
        }}
        required
      >
        <option value="">Select Gemma Prompt</option>
        {GEMMA_PROMPTS.map((prompt) => (
          <option key={prompt.id} value={prompt.id}>
            {prompt.label}
          </option>
        ))}
      </select>

      <div>
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
      </div>

      <button
        type="submit"
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: colors.blue,
          color: colors.white,
          border: 'none',
          borderRadius: '999px',
          cursor: 'pointer',
          fontSize: '1rem',
          marginTop: '1rem',
          width: 'fit-content',
          alignSelf: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        Add Song
      </button>

      {status && (
        <p style={{ color: colors.grey2, textAlign: 'center' }}>{status}</p>
      )}
    </form>
  );
};

export default AddSongForm;
