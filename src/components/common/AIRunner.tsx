import React, { useState, useEffect } from 'react';
import { FaPlay, FaList, FaCheckSquare, FaSpinner } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import AIProgressTracker from './AIProgressTracker';

interface AIOption {
  key: string;
  label: string;
  flag: string;
  description: string;
  dependsOn?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
}

export interface AIRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
  title: string;
  description: string;
  options: AIOption[];
  progressLabels: Record<string, string>;
  invokeChannel: string;
  runAllKey?: string;
  validateOptions?: (selectedOptions: string[], song: SongModel) => { isValid: boolean; message?: string };
  prepareOptions?: (selectedOptions: string[]) => Record<string, boolean>;
}

const AIRunner: React.FC<AIRunnerProps> = ({
  song,
  songId,
  refetch,
  title,
  description,
  options,
  progressLabels,
  invokeChannel,
  runAllKey = 'all',
  validateOptions,
  prepareOptions,
}) => {
  const [status, setStatus] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  // Set up listeners for AI progress events
  useEffect(() => {
    // Create references to store removal functions
    let removeProgressListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    let removeCompleteListener: (() => void) | undefined;
    
    const progressListener = (data: any) => {
      console.log("Progress update received in component:", data);
      if (data && data.operationId === currentOperationId) {
        // Force a more direct state update by creating a completely new array each time
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
          
          console.log("Updating progress steps:", newSteps);
          return newSteps;
        });
      }
    };

    const errorListener = (data: any) => {
      console.log("Error received in component:", data);
      if (data && data.operationId === currentOperationId) {
        setStatus(`Error: ${data.error}`);
        setIsProcessing(false);
        
        // Clean up listeners when error occurs
        console.log("Cleaning up event listeners due to error");
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    const completeListener = (data: any) => {
      console.log("Process complete received in component:", data);
      if (data && data.operationId === currentOperationId) {
        setIsProcessing(false);
        setStatus(`Process completed with code: ${data.exitCode}`);
        refetch();
        
        // Clean up listeners when process completes
        console.log("Cleaning up event listeners due to completion");
        if (removeProgressListener) removeProgressListener();
        if (removeErrorListener) removeErrorListener();
        if (removeCompleteListener) removeCompleteListener();
      }
    };

    // Set up listeners
    console.log("Setting up event listeners for operation:", currentOperationId);
    removeProgressListener = window.electron.ipcRenderer.on('ai-progress-update', progressListener);
    removeErrorListener = window.electron.ipcRenderer.on('ai-error', errorListener);
    removeCompleteListener = window.electron.ipcRenderer.on('ai-process-complete', completeListener);

    return () => {
      // This cleanup function will run when the component unmounts or when currentOperationId changes
      console.log("Cleaning up event listeners on unmount/change");
      if (removeProgressListener) removeProgressListener();
      if (removeErrorListener) removeErrorListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [currentOperationId, refetch, progressLabels]);

  const toggleOption = (optionKey: string) => {
    setSelectedOptions(prev => {
      const isSelected = prev.includes(optionKey);
      
      // If "all" is selected, clear all other options
      if (optionKey === runAllKey && !isSelected) {
        return [runAllKey];
      }
      
      // If another option is selected while "all" is active, remove "all"
      const newOptions = prev.filter(key => key !== runAllKey && key !== optionKey);
      
      if (!isSelected) {
        newOptions.push(optionKey);
      }
      
      return newOptions;
    });
  };

  const handleRunAI = async () => {
    if (selectedOptions.length === 0) {
      setStatus('Please select at least one option');
      return;
    }

    // Validate options if validation function is provided
    if (validateOptions) {
      const validation = validateOptions(selectedOptions, song);
      if (!validation.isValid) {
        setStatus(validation.message || 'Invalid options selected');
        return;
      }
    }

    // Generate operation ID locally
    const operationId = `ai-${songId}-${Date.now()}`;
    
    // Clear any previous progress steps and set processing state first
    setProgressSteps([]);
    setIsProcessing(true);
    setStatus('Processing...');
    
    // Set operation ID after clearing progress steps to ensure clean state
    setCurrentOperationId(operationId);
    
    try {
      // Prepare the options to send to main process
      let options: Record<string, boolean>;
      
      if (prepareOptions) {
        options = prepareOptions(selectedOptions);
      } else {
        options = {};
        if (selectedOptions.includes(runAllKey)) {
          options[runAllKey] = true;
        } else {
          selectedOptions.forEach(opt => {
            options[opt] = true;
          });
        }
      }
      
      // Send operationId to main process
      await window.electron.ipcRenderer.invoke(
        invokeChannel,
        {
          songId,
          options,
          operationId
        }
      );
      
      setStatus(`Processing with operation ID: ${operationId}`);
    } catch (error) {
      setIsProcessing(false);
      setCurrentOperationId(null); // Clear operation ID on error
      setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const isOptionDisabled = (option: AIOption): boolean => {
    // If "all" is selected, disable all other options
    if (selectedOptions.includes(runAllKey) && option.key !== runAllKey) {
      return true;
    }
    
    // Check option's own disabled status
    if (option.disabled) {
      return true;
    }
    
    // If option depends on another option
    if (option.dependsOn && !selectedOptions.includes(option.dependsOn)) {
      return true;
    }
    
    return false;
  };

  const getOptionTooltip = (option: AIOption): string => {
    if (selectedOptions.includes(runAllKey) && option.key !== runAllKey) {
      return `Disabled when "${options.find(o => o.key === runAllKey)?.label}" is selected`;
    }
    
    if (option.disabled && option.disabledReason) {
      return option.disabledReason;
    }
    
    if (option.dependsOn && !selectedOptions.includes(option.dependsOn)) {
      return `Requires "${options.find(o => o.key === option.dependsOn)?.label}" to be selected`;
    }
    
    return option.description;
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
        <FaList style={{ marginRight: '0.5rem' }} />
        {title}
      </h3>
      
      <p style={{ fontSize: '1rem', color: colors.grey2, marginBottom: '1rem' }}>
        {description}
      </p>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={isProcessing}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.7 : 1,
            fontSize: '0.9rem',
          }}
        >
          <FaCheckSquare style={{ marginRight: '0.5rem' }} />
          {showOptions ? 'Hide Options' : 'Show Options'}
        </button>
        
        <button
          onClick={handleRunAI}
          disabled={isProcessing || selectedOptions.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: selectedOptions.length > 0 && !isProcessing ? colors.blue : colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: (selectedOptions.length > 0 && !isProcessing) ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
          }}
        >
          {isProcessing ? (
            <FaSpinner style={{ marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
          ) : (
            <FaPlay style={{ marginRight: '0.5rem' }} />
          )}
          {isProcessing ? 'Processing...' : 'Run Selected Features'}
        </button>
      </div>
      
      {/* Options Selection */}
      {showOptions && !isProcessing && (
        <div style={{ 
          backgroundColor: colors.grey5, 
          borderRadius: '12px', 
          padding: '1rem', 
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {options.map((option) => (
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
      
      {/* Use AIProgressTracker component */}
      <AIProgressTracker 
        isProcessing={isProcessing}
        progressSteps={progressSteps}
        statusMessage={status}
      />
      
      {/* Add keyframe animation for spinner */}
      <style >{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIRunner;
