import React, { useState, useEffect } from 'react';
import { FaPlay, FaTimes } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';
import SongSelectionItem from './SongSelectionItem';
import { useAIProcessTracking} from '../../hooks/useAIProcessTracking';

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
  // { 
  //   key: 'rerunWhisper',
  //   label: 'Rerun Lyrics Generation',
  //   flag: '-w',
  //   description: 'Rerun Whisper speech-to-text on audio'
  // },
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

const BatchLLMRunner: React.FC<BatchLLMRunnerProps> = ({ onClose, songs, refetch }) => {
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [showOptions, setShowOptions] = useState(true);
  
  // Use the AI process tracking hook
  const handleComplete = (data: any) => {
    // Move to the next song
    processSongs(currentSongIndex + 1);
  };
  
  const handleError = (error: string) => {
    // Log the error and move to the next song despite the error
    console.error(`Error processing song ${currentSongIndex + 1}:`, error);
    processSongs(currentSongIndex + 1);
  };
  
  const {
    isProcessing,
    status: statusMessage,
    progressSteps,
    startProcessing: startAIProcessing,
    setIsProcessing,
    setStatus: setStatusMessage,
  } = useAIProcessTracking({
    operationId: currentOperationId,
    onComplete: handleComplete,
    onError: handleError
  });

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
      refetch();
      return;
    }

    // Update the current song index
    setCurrentSongIndex(index);
    
    // Get the current song ID
    const songId = selectedSongIds[index];
    
    // Create a unique operation ID for this song
    const operationId = `batch-${songId}-${Date.now()}`;
    setCurrentOperationId(operationId);
    
    setStatusMessage(`Processing song ${index + 1}/${selectedSongIds.length}: ${
      songs.find(s => s.id === songId)?.title || songId
    }`);
    
    // Initialize processing state with initial steps for this song
    startAIProcessing([]);
    
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
      
      // The process will continue via the hook's event listeners
    } catch (error) {
      setStatusMessage(`Error starting process for song ${index + 1}: ${error.message || 'Unknown error'}`);
      processSongs(index + 1);
    }
  };

  const cancelProcessing = () => {
    setIsProcessing(false);
    setCurrentSongIndex(-1);
    setStatusMessage('Processing cancelled');
    setCurrentOperationId(null);
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
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
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
        borderRadius: '28px',
        padding: '2.5rem',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15), 0 12px 24px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: colors.white,
          zIndex: 1,
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              borderRadius: '50%',
              fontSize: '1.1rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              color: colors.grey2,
              opacity: isProcessing ? 0.5 : 1,
              transition: 'background-color 0.2s, transform 0.2s',
              transform: 'scale(1)',
            }}
            onMouseOver={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            &times;
          </button>
          <h2 style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.8rem', 
            fontWeight: 600,
            color: '#1d1d1f'
          }}>Batch LLM Processing</h2>
        </div>
        
        {/* Content */}
        <div style={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          paddingRight: '0.75rem',
        }}>
          {/* Song Selection */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 500, color: '#1d1d1f' }}>Select Songs</h3>
              <div>
                <button
                  onClick={selectAllSongs}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.blue,
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    marginRight: '0.75rem',
                    transition: 'opacity 0.2s',
                    opacity: isProcessing ? 0.5 : 1,
                    padding: '0.25rem 0.5rem',
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
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                    opacity: isProcessing ? 0.5 : 1,
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div style={{
              maxHeight: '250px',
              overflowY: 'auto',
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              borderRadius: '16px',
              border: '1px solid rgba(0, 0, 0, 0.06)',
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
                <div style={{ 
                  padding: '1.5rem', 
                  textAlign: 'center', 
                  color: colors.grey2,
                  fontWeight: 500
                }}>
                  No songs available
                </div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              color: colors.grey2,
              fontWeight: 500,
              padding: '0 0.25rem'
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
              marginBottom: '0.75rem',
            }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 500, color: '#1d1d1f' }}>LLM Features</h3>
              <button
                onClick={() => setShowOptions(!showOptions)}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                  color: colors.blue,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  opacity: isProcessing ? 0.5 : 1,
                  padding: '0.25rem 0.5rem',
                }}
              >
                {showOptions ? 'Hide Options' : 'Show Options'}
              </button>
            </div>
            
            {showOptions && (
              <div style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: '16px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                padding: '0.75rem', 
                marginBottom: '1.5rem'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.75rem' 
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
                          fontWeight: 400,
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          flexShrink: 0,
                          borderRadius: '4px',
                          border: `1px solid ${selectedOptions.includes(option.key) ? colors.blue : 'rgba(0, 0, 0, 0.2)'}`,
                          backgroundColor: selectedOptions.includes(option.key) ? colors.blue : 'transparent',
                          marginRight: '8px',
                          position: 'relative',
                          transition: 'all 0.2s',
                        }}>
                          {selectedOptions.includes(option.key) && (
                            <span style={{
                              position: 'absolute',
                              width: '10px',
                              height: '6px',
                              borderLeft: '2px solid white',
                              borderBottom: '2px solid white',
                              transform: 'rotate(-45deg)',
                              top: '5px',
                            }}></span>
                          )}
                          <input
                            type="checkbox"
                            checked={selectedOptions.includes(option.key)}
                            onChange={() => !isProcessing && toggleOption(option.key)}
                            disabled={isProcessing || (selectedOptions.includes('all') && option.key !== 'all')}
                            style={{ 
                              opacity: 0, 
                              position: 'absolute', 
                              width: '100%',
                              height: '100%',
                              margin: 0,
                              cursor: 'pointer' 
                            }}
                          />
                        </span>
                        {option.label}
                      </label>
                      <span style={{ 
                        marginLeft: '0.25rem', 
                        fontSize: '0.75rem', 
                        color: 'rgba(0, 0, 0, 0.4)',
                        opacity: isProcessing ? 0.5 : 0.8,
                        fontWeight: 500,
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
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem 0', fontWeight: 500, color: '#1d1d1f' }}>
                  Overall Progress: {currentSongIndex + 1}/{selectedSongIds.length} Songs
                </h3>
                <div style={{
                  height: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
                <div style={{ marginBottom: '0.75rem', padding: '0 0.25rem' }}>
                  <h4 style={{ 
                    fontSize: '1rem', 
                    margin: '0 0 0.5rem 0',
                    fontWeight: 500,
                    color: '#1d1d1f'
                  }}>
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
          marginTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(0, 0, 0, 0.05)',
        }}>
          <div>
            {statusMessage && !isProcessing && (
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem',
                fontWeight: 500,
                color: statusMessage.includes('Error') ? colors.red : 'rgba(0, 0, 0, 0.5)'
              }}>
                {statusMessage}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isProcessing ? (
              <button
                onClick={cancelProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 59, 48, 0.1)',
                  color: '#FF3B30',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
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
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    color: 'rgba(0, 0, 0, 0.7)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
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
                    justifyContent: 'center',
                    backgroundColor: selectedSongIds.length > 0 && selectedOptions.length > 0 
                      ? colors.blue 
                      : 'rgba(0, 0, 0, 0.1)',
                    color: selectedSongIds.length > 0 && selectedOptions.length > 0 
                      ? colors.white 
                      : 'rgba(0, 0, 0, 0.4)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '0.75rem 1.5rem',
                    cursor: selectedSongIds.length > 0 && selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: selectedSongIds.length > 0 && selectedOptions.length > 0 
                      ? '0 2px 8px rgba(0, 122, 255, 0.3)' 
                      : 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (selectedSongIds.length > 0 && selectedOptions.length > 0) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedSongIds.length > 0 && selectedOptions.length > 0) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 122, 255, 0.3)';
                    }
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
