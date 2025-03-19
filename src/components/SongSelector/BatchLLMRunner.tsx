import React, { useState, useEffect } from 'react';
import { FaCheckSquare, FaPlay, FaTimes, FaList } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';
import SongSelectionItem from './SongSelectionItem';

interface BatchLLMRunnerProps {
  onClose: () => void;
  songs: SongModel[];
  refetch: () => void;
}

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
    description: 'Generate image prompts for extracted objects'
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
    description: 'Generate image prompts for backgrounds'
  },
  { 
    key: 'rerunWhisper',
    label: 'Rerun Lyrics Generation',
    flag: '-w',
    description: 'Rerun Whisper speech-to-text on audio'
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

const BatchLLMRunner: React.FC<BatchLLMRunnerProps> = ({ onClose, songs, refetch }) => {
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<{ key: string, label: string, completed: boolean }[]>([]);
  const [showOptions, setShowOptions] = useState(true);
  const [overallProgress, setOverallProgress] = useState(0);

  // Set up listeners for AI progress events
  useEffect(() => {
    let removeProgressListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    let removeCompleteListener: (() => void) | undefined;
    
    const progressListener = (data: any) => {
      if (data && data.operationId === currentOperationId) {
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
        setStatusMessage(`Error processing song ${currentSongIndex + 1}/${selectedSongIds.length}: ${data.error}`);
        
        // Move to the next song despite the error
        processSongs(currentSongIndex + 1);
        
        // Clean up current listeners
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    const completeListener = (data: any) => {
      if (data && data.operationId === currentOperationId) {
        setStatusMessage(`Completed song ${currentSongIndex + 1}/${selectedSongIds.length}`);
        
        // Move to the next song
        processSongs(currentSongIndex + 1);
        
        // Clean up current listeners
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    // Set up listeners if we're processing a song
    if (currentOperationId) {
      removeProgressListener = window.electron.ipcRenderer.on('ai-progress-update', progressListener);
      removeErrorListener = window.electron.ipcRenderer.on('ai-error', errorListener);
      removeCompleteListener = window.electron.ipcRenderer.on('ai-process-complete', completeListener);
    }

    return () => {
      if (removeProgressListener) removeProgressListener();
      if (removeErrorListener) removeErrorListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [currentOperationId, currentSongIndex, selectedSongIds.length]);

  // Track and update the overall progress
  useEffect(() => {
    if (selectedSongIds.length > 0 && currentSongIndex >= 0) {
      const percentComplete = ((currentSongIndex) / selectedSongIds.length) * 100;
      setOverallProgress(percentComplete);
    } else {
      setOverallProgress(0);
    }
  }, [currentSongIndex, selectedSongIds.length]);

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId) 
        : [...prev, songId]
    );
  };

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

  const prepareOptions = (selectedOptions: string[]) => {
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

  const validateSongAndOptionSelection = (): boolean => {
    if (selectedSongIds.length === 0) {
      setStatusMessage('Please select at least one song');
      return false;
    }

    if (selectedOptions.length === 0) {
      setStatusMessage('Please select at least one LLM feature');
      return false;
    }

    return true;
  };

  const startProcessing = async () => {
    if (!validateSongAndOptionSelection()) return;
    
    setIsProcessing(true);
    setStatusMessage('Starting batch processing...');
    setCurrentSongIndex(0);
    
    // Begin processing with the first song
    await processSongs(0);
  };

  const processSongs = async (index: number) => {
    // If we've processed all songs, we're done
    if (index >= selectedSongIds.length) {
      setIsProcessing(false);
      setCurrentSongIndex(-1);
      setStatusMessage(`Batch processing complete. Processed ${selectedSongIds.length} songs.`);
      setCurrentOperationId(null);
      setProgressSteps([]);
      refetch();
      return;
    }

    // Update the current song index
    setCurrentSongIndex(index);
    
    // Reset progress steps for the new song
    setProgressSteps([]);
    
    // Get the current song ID
    const songId = selectedSongIds[index];
    
    // Create a unique operation ID for this song
    const operationId = `batch-${songId}-${Date.now()}`;
    setCurrentOperationId(operationId);
    
    setStatusMessage(`Processing song ${index + 1}/${selectedSongIds.length}: ${
      songs.find(s => s.id === songId)?.title || songId
    }`);
    
    try {
      // Prepare options
      const options = prepareOptions(selectedOptions);
      
      // Invoke the IPC call for this song
      await window.electron.ipcRenderer.invoke(
        'run-gemma-with-options',
        {
          songId,
          options,
          operationId
        }
      );
      
      // Note: We don't update anything here as the process will run asynchronously
      // and we'll receive progress updates via the event listeners
      
    } catch (error) {
      setStatusMessage(`Error starting process for song ${index + 1}: ${error.message || 'Unknown error'}`);
      
      // Move to the next song despite the error
      processSongs(index + 1);
    }
  };

  const cancelProcessing = () => {
    setIsProcessing(false);
    setCurrentSongIndex(-1);
    setStatusMessage('Processing cancelled');
    setCurrentOperationId(null);
    setProgressSteps([]);
  };

  const selectAllSongs = () => {
    setSelectedSongIds(songs.map(song => song.dataValues.id));
  };

  const deselectAllSongs = () => {
    setSelectedSongIds([]);
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
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div style={{
        backgroundColor: colors.white,
        borderRadius: '16px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: `1px solid ${colors.grey4}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Batch LLM Processing</h2>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              color: colors.grey2,
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            <FaTimes />
          </button>
        </div>
        
        {/* Content */}
        <div style={{
          padding: '1rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {/* Song Selection */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Select Songs</h3>
              <div>
                <button
                  onClick={selectAllSongs}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.blue,
                    fontSize: '0.8rem',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    marginRight: '0.5rem',
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllSongs}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.grey2,
                    fontSize: '0.8rem',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div style={{
              maxHeight: '250px',
              overflowY: 'auto',
              padding: '0.5rem',
              backgroundColor: colors.grey5,
              borderRadius: '8px',
            }}>
              {songs.length > 0 ? (
                songs.map((song) => (
                  <SongSelectionItem
                    key={song.dataValues.id}
                    song={song.dataValues}
                    isSelected={selectedSongIds.includes(song.dataValues.id)}
                    onToggle={() => toggleSongSelection(song.dataValues.id)}
                    isDisabled={isProcessing}
                  />
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: colors.grey2 }}>
                  No songs available
                </div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: colors.grey2,
            }}>
              <span>Selected: {selectedSongIds.length} / {songs.length}</span>
            </div>
          </div>
          
          {/* LLM Options */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>LLM Features</h3>
              <button
                onClick={() => setShowOptions(!showOptions)}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                  color: colors.blue,
                  border: 'none',
                  fontSize: '0.8rem',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {showOptions ? 'Hide Options' : 'Show Options'}
              </button>
            </div>
            
            {showOptions && (
              <div style={{ 
                backgroundColor: colors.grey5, 
                borderRadius: '8px', 
                padding: '0.5rem', 
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.5rem' 
                }}>
                  {llmOptions.map((option) => (
                    <div 
                      key={option.key} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                      }}
                      title={option.description}
                    >
                      <label 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          opacity: isProcessing || (selectedOptions.includes('all') && option.key !== 'all') ? 0.5 : 1,
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option.key)}
                          onChange={() => !isProcessing && toggleOption(option.key)}
                          disabled={isProcessing || (selectedOptions.includes('all') && option.key !== 'all')}
                          style={{ marginRight: '0.5rem' }}
                        />
                        {option.label}
                      </label>
                      <span style={{ 
                        marginLeft: '0.25rem', 
                        fontSize: '0.75rem', 
                        color: colors.grey2,
                        opacity: isProcessing ? 0.5 : 0.8,
                      }}>
                        {option.flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Current Progress */}
          {isProcessing && (
            <>
              {/* Overall progress bar */}
              <div>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>
                  Overall Progress: {currentSongIndex + 1}/{selectedSongIds.length} Songs
                </h3>
                <div style={{
                  height: '8px',
                  backgroundColor: colors.grey5,
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${overallProgress}%`,
                    backgroundColor: colors.blue,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
              
              {/* Current song info */}
              {currentSongIndex >= 0 && currentSongIndex < selectedSongIds.length && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
                    Currently Processing: {
                      songs.find(s => s.id === selectedSongIds[currentSongIndex])?.title || 
                      selectedSongIds[currentSongIndex]
                    }
                  </h4>
                </div>
              )}
              
              {/* Individual song progress */}
              <AIProgressTracker 
                isProcessing={isProcessing}
                progressSteps={progressSteps}
                statusMessage={statusMessage}
              />
            </>
          )}
        </div>
        
        {/* Footer with buttons */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${colors.grey4}`,
          display: 'flex',
          justifyContent: 'space-between',
          backgroundColor: colors.grey5,
        }}>
          <div>
            {statusMessage && !isProcessing && (
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem',
                color: statusMessage.includes('Error') ? colors.red : colors.grey2 
              }}>
                {statusMessage}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isProcessing ? (
              <button
                onClick={cancelProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: colors.red,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                }}
              >
                <FaTimes style={{ marginRight: '0.5rem' }} />
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  style={{
                    backgroundColor: 'transparent',
                    color: colors.grey2,
                    border: `1px solid ${colors.grey3}`,
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={startProcessing}
                  disabled={selectedSongIds.length === 0 || selectedOptions.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedSongIds.length > 0 && selectedOptions.length > 0 ? colors.blue : colors.grey3,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    cursor: selectedSongIds.length > 0 && selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  <FaPlay style={{ marginRight: '0.5rem' }} />
                  Start Processing ({selectedSongIds.length} songs)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchLLMRunner;
