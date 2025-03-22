import React, { useState } from 'react';
import { FaCheck, FaPlay, FaSpinner } from 'react-icons/fa';
import colors from '../../theme/colors';
import AIProgressTracker from './AIProgressTracker';
import { useAIProcessTracking } from '../../hooks/useAIProcessTracking';
import { SongModel } from '../../database/models/Song';

interface AIOption {
  key: string;
  label: string;
  flag?: string;
  description?: string;
  dependsOn?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface AIRunnerProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
  title: string;
  description?: string;
  options: AIOption[];
  progressLabels: Record<string, string>;
  invokeChannel: string;
  runAllKey?: string;
  validateOptions?: (selectedOptions: string[], song: SongModel) => { isValid: boolean; message?: string };
  prepareOptions?: (selectedOptions: string[]) => Record<string, any>;
  expectedSteps?: string[];
  onComplete?: (data: any) => void;
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
  runAllKey,
  validateOptions,
  prepareOptions,
  expectedSteps,
  onComplete
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  
  // Use the AI process tracking hook
  const handleComplete = (data: any) => {
    if (onComplete) {
      onComplete(data);
    }
    refetch();
  };
  
  const {
    isProcessing,
    status,
    progressSteps,
    startProcessing,
    setStatus
  } = useAIProcessTracking({
    operationId: currentOperationId,
    onComplete: handleComplete
  });

  const toggleOption = (optionKey: string) => {
    setSelectedOptions(prev => {
      setValidationError(null);
      
      // If this is the "run all" option
      if (runAllKey && optionKey === runAllKey) {
        if (prev.includes(optionKey)) {
          return prev.filter(key => key !== optionKey);
        } else {
          return [optionKey];
        }
      }
      
      // If "run all" is selected and we're selecting another option
      if (runAllKey && prev.includes(runAllKey)) {
        return prev.filter(key => key !== runAllKey).concat(optionKey);
      }
      
      // Normal toggle behavior
      const isSelected = prev.includes(optionKey);
      if (isSelected) {
        return prev.filter(key => key !== optionKey);
      } else {
        return [...prev, optionKey];
      }
    });
  };

  const runSelectedOptions = async () => {
    // Validate selected options if validator provided
    if (validateOptions) {
      const validation = validateOptions(selectedOptions, song);
      if (!validation.isValid) {
        setValidationError(validation.message || 'Invalid options selected');
        return;
      }
    }
    
    // Create unique operation ID
    const operationId = `${invokeChannel}-${Date.now()}`;
    setCurrentOperationId(operationId);
    
    // Prepare options payload
    let optionsPayload = {};
    if (prepareOptions) {
      optionsPayload = prepareOptions(selectedOptions);
    } else {
      // Default behavior: create an object with selected options as true
      selectedOptions.forEach(opt => {
        optionsPayload[opt] = true;
      });
    }
    
    // Prepare initial progress steps if expected steps are provided
    const initialSteps = expectedSteps ? expectedSteps.map(step => ({
      key: step,
      label: progressLabels[step] || step,
      completed: false
    })) : [];
    
    startProcessing(initialSteps);
    setStatus('Starting process...');
    
    try {
      await window.electron.ipcRenderer.invoke(
        invokeChannel,
        {
          songId,
          options: optionsPayload,
          operationId
        }
      );
      
      setStatus('Process started successfully');
    } catch (error) {
      setStatus(`Error: ${error.message || 'Failed to start process'}`);
    }
  };

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: colors.grey6, borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 0.5rem 0' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '0.9rem', color: colors.grey2, margin: '0 0 1rem 0' }}>
          {description}
        </p>
      )}
      
      {/* Options Selection */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem' 
      }}>
        {options.map((option) => {
          const isSelected = selectedOptions.includes(option.key);
          const isDisabled = isProcessing || option.disabled || 
            (runAllKey && selectedOptions.includes(runAllKey) && option.key !== runAllKey);
          
          return (
            <div
              key={option.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem',
                backgroundColor: isSelected ? colors.blue + '20' : colors.grey5,
                borderRadius: '4px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.6 : 1,
                border: isSelected ? `1px solid ${colors.blue}` : '1px solid transparent'
              }}
              onClick={() => !isDisabled && toggleOption(option.key)}
              title={option.disabled ? option.disabledReason : option.description}
            >
              <div style={{ 
                width: '20px', 
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '0.5rem' 
              }}>
                {isSelected ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: colors.blue,
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FaCheck size={10} color={colors.white} />
                  </div>
                ) : (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: `1px solid ${colors.grey3}`,
                    borderRadius: '2px'
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem' }}>{option.label}</div>
                {option.flag && (
                  <div style={{ fontSize: '0.75rem', color: colors.grey2 }}>{option.flag}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Validation Error */}
      {validationError && (
        <div style={{ 
          padding: '0.5rem',
          backgroundColor: colors.red + '20',
          color: colors.red,
          borderRadius: '4px',
          fontSize: '0.9rem',
          marginBottom: '1rem'
        }}>
          {validationError}
        </div>
      )}
      
      {/* Run Button */}
      <button
        onClick={runSelectedOptions}
        disabled={isProcessing || selectedOptions.length === 0}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isProcessing || selectedOptions.length === 0 ? colors.grey3 : colors.blue,
          color: colors.white,
          border: 'none',
          borderRadius: '4px',
          cursor: isProcessing || selectedOptions.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {isProcessing ? (
          <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <FaPlay />
        )}
        {isProcessing ? 'Processing...' : 'Run Selected Features'}
      </button>
      
      {/* Progress Tracker */}
      <AIProgressTracker
        isProcessing={isProcessing}
        progressSteps={progressSteps}
        statusMessage={status}
      />
    </div>
  );
};

export default AIRunner;
