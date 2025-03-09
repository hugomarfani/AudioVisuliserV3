import React from 'react';
import { FaSpinner, FaCheck } from 'react-icons/fa';
import colors from '../../theme/colors';

interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
}

interface AIProgressTrackerProps {
  isProcessing: boolean;
  progressSteps: ProgressStep[];
  statusMessage: string;
}

const AIProgressTracker: React.FC<AIProgressTrackerProps> = ({
  isProcessing,
  progressSteps,
  statusMessage
}) => {
  return (
    <>
      {/* Progress Checklist */}
      {isProcessing && (
        <div style={{ 
          backgroundColor: colors.grey5, 
          borderRadius: '12px', 
          padding: '1rem', 
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Processing Status:</h4>
          
          {progressSteps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {progressSteps.map((step) => (
                <div 
                  key={step.key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    backgroundColor: step.completed ? 'rgba(52, 199, 89, 0.1)' : 'transparent'
                  }}
                >
                  {step.completed ? (
                    <FaCheck style={{ marginRight: '0.5rem', color: '#34C759' }} />
                  ) : (
                    <FaSpinner 
                      style={{ 
                        marginRight: '0.5rem', 
                        color: colors.blue,
                        animation: 'spin 1s linear infinite'
                      }} 
                    />
                  )}
                  <span style={{ 
                    color: step.completed ? '#34C759' : colors.white,
                  }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.5rem' }}>
              <FaSpinner 
                style={{ 
                  marginRight: '0.5rem', 
                  color: colors.blue,
                  animation: 'spin 1s linear infinite'
                }} 
              />
              <span>Initializing process...</span>
            </div>
          )}
        </div>
      )}
      
      {/* Status Message */}
      {statusMessage && (
        <p
          style={{ 
            fontSize: '1rem', 
            color: statusMessage.includes('Error') || statusMessage.includes('Cannot')
              ? '#FF3B30' 
              : colors.grey2,
            marginTop: '1rem' 
          }}
        >
          {statusMessage}
        </p>
      )}
      
      {/* Add keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default AIProgressTracker;
