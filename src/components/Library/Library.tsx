import React, { useState } from 'react';
import colors from '../../theme/colors';

interface LibraryProps {
  onClose: () => void;
}

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

const Library: React.FC<LibraryProps> = ({ onClose }) => {
  const [url, setUrl] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidYouTubeUrl(url)) {
      return;
    }
    console.log('Submitted:', { url, selectedPrompt, selectedMoods });
    setUrl('');
    setSelectedPrompt('');
    setSelectedMoods([]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '24px',
          padding: '2rem',
          width: '80%',
          maxWidth: '600px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          position: 'relative',
        }}
      >
        <button
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'transparent',
            color: colors.grey2,
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
          onClick={onClose}
        >
          &times;
        </button>
        <h2 style={{ marginBottom: '1rem' }}>Library</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <p style={{ marginBottom: '0.5rem', color: colors.grey2 }}>Select Moods (Optional)</p>
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
                    backgroundColor: selectedMoods.includes(mood.id) ? colors.blue : colors.grey5,
                    color: selectedMoods.includes(mood.id) ? colors.white : colors.black,
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
                          : selectedMoods.filter(id => id !== mood.id)
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
        </form>
      </div>
    </div>
  );
};

export default Library;
