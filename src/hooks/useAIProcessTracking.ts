import { useEffect, useState } from 'react';

export interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
}

interface UseAIProcessTrackingOptions {
  operationId: string | null;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
  initialSteps?: ProgressStep[];
}

const progressLabels = {
    download: 'Downloading YouTube Audio',
    aiSetup: 'Preparing AI Environment',
    whisper: 'Running Speech Recognition',
    llm: "Running LLM",
    stableDiffusion: "Running Stable Diffusion",
    statusExtraction: "Running Status Extraction",
    colourExtraction: "Running Colour Extraction",
    particleExtraction: "Running Particle Extraction",
    objectExtraction: "Running Object Extraction",
    backgroundExtraction: "Running Background Extraction",
    objectPrompts: "Running Object Prompts",
    backgroundPrompts: "Running Background Prompts",
    jsonStorage: "Running Json Storage",
    imageBack1: "Running background_prompts_1",
    imageBack2: "Running background_prompts_2",
    imageBack3: "Running background_prompts_3",
    imageObj1: "Running object_prompts_1",
    imageObj2: "Running object_prompts_2",
    imageObj3: "Running object_prompts_3",
}

const useAIProcessTracking = ({
  operationId,
  onComplete,
  onError,
  initialSteps = []
}: UseAIProcessTrackingOptions) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>(initialSteps);

  // Set up listeners for AI progress events
  useEffect(() => {
    let removeProgressListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    let removeCompleteListener: (() => void) | undefined;
    
    const progressListener = (data: any) => {
      if (data && data.operationId === operationId) {
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
      if (data && data.operationId === operationId) {
        setStatus(`Error: ${data.error}`);
        setIsProcessing(false);
        
        // Call the error callback if provided
        if (onError) {
          onError(data.error);
        }
      }
    };

    const completeListener = (data: any) => {
      if (data && data.operationId === operationId) {
        setIsProcessing(false);
        setStatus('Processing completed successfully!');
        
        // Call the completion callback if provided
        if (onComplete) {
          onComplete(data);
        }
      }
    };

    // Set up listeners only if we have an operation ID
    if (operationId) {
      removeProgressListener = window.electron.ipcRenderer.on('ai-progress-update', progressListener);
      removeErrorListener = window.electron.ipcRenderer.on('ai-error', errorListener);
      removeCompleteListener = window.electron.ipcRenderer.on('ai-process-complete', completeListener);
    }

    return () => {
      // Clean up listeners when the component unmounts or when operationId changes
      if (removeProgressListener) removeProgressListener();
      if (removeErrorListener) removeErrorListener();
      if (removeCompleteListener) removeCompleteListener();
    };
  }, [operationId, onComplete, onError]);

  const startProcessing = (steps?: ProgressStep[]) => {
    setIsProcessing(true);
    if (steps) {
      setProgressSteps(steps);
    }
  };

  const updateStep = (key: string, completed: boolean) => {
    setProgressSteps(prev => {
      return prev.map(step => 
        step.key === key ? { ...step, completed } : step
      );
    });
  };

  return {
    isProcessing,
    setIsProcessing,
    status,
    setStatus,
    progressSteps,
    setProgressSteps,
    startProcessing,
    updateStep
  };
};

export  {useAIProcessTracking, progressLabels};