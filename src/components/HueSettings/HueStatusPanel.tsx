import React, { useState, useRef, useEffect } from 'react';
import { FaCog, FaLightbulb, FaPlay, FaPause, FaMicrophone } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { useHue } from '../../hooks/useHue';

interface HueStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullSettings: () => void;
}

const HueStatusPanel: React.FC<HueStatusPanelProps> = ({
  isOpen,
  onClose,
  onOpenFullSettings,
}) => {
  const {
    isConfigured,
    hueSettings,
    isStreamingActive,
    beatStatus,
    startHueStreaming,
    stopHueStreaming,
    testLights,
  } = useHue();

  const [isTestingLights, setIsTestingLights] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);
  const [spectrumData, setSpectrumData] = useState<number[]>(Array(15).fill(0)); // For the mini spectrum analyzer

  // Beat animation reference
  const beatRef = useRef<HTMLDivElement>(null);
  const vocalRef = useRef<HTMLDivElement>(null);

  // Effect for beat animation
  useEffect(() => {
    if (beatRef.current && beatStatus.isDetected) {
      // Add and remove animation class
      beatRef.current.classList.add('beat-pulse');
      const timer = setTimeout(() => {
        if (beatRef.current) {
          beatRef.current.classList.remove('beat-pulse');
        }
      }, 300); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [beatStatus.isDetected]);

  // Effect for vocal animation
  useEffect(() => {
    if (vocalRef.current && beatStatus.vocalActive) {
      vocalRef.current.classList.add('vocal-active');
      if (!vocalRef.current.classList.contains('sustaining') && beatStatus.vocalEnergy > 80) {
        vocalRef.current.classList.add('sustaining');
      }

      return () => {
        if (vocalRef.current) {
          vocalRef.current.classList.remove('vocal-active');
          // Only remove sustaining if vocal is no longer active
          if (!beatStatus.vocalActive) {
            vocalRef.current.classList.remove('sustaining');
          }
        }
      };
    }
  }, [beatStatus.vocalActive, beatStatus.vocalEnergy]);

  // Update spectrum visualization data
  useEffect(() => {
    if (isStreamingActive && beatStatus.audioData && beatStatus.audioData.length > 0) {
      // Sample the frequency data for visualization
      const sampledData = [];
      const step = Math.floor(beatStatus.audioData.length / 15);
      for (let i = 0; i < 15; i++) {
        sampledData.push(beatStatus.audioData[i * step] || 0);
      }
      setSpectrumData(sampledData);
    } else {
      // Reset when not streaming
      setSpectrumData(Array(15).fill(0));
    }
  }, [isStreamingActive, beatStatus.audioData]);

  // If the panel isn't open, don't render anything
  if (!isOpen) return null;

  // Handle light test
  const handleTestLights = async () => {
    if (isTestingLights) return;

    setIsTestingLights(true);
    setLastTestResult(null);

    try {
      // Start the test sequence
      const success = await testLights();

      if (success) {
        setLastTestResult('success');
      } else {
        setLastTestResult('error');
      }
    } catch (error) {
      console.error('Error testing lights:', error);
      setLastTestResult('error');
    } finally {
      setIsTestingLights(false);
    }
  };

  // Handle toggling streaming state
  const toggleStreaming = async () => {
    if (isStreamingActive) {
      await stopHueStreaming();
    } else {
      await startHueStreaming();
    }
  };

  // Format RGB color to CSS
  const formatRGB = (rgb: number[] | undefined) => {
    if (!rgb || rgb.length !== 3) return 'rgb(255, 255, 255)';
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '120px',
        right: '20px',
        width: '320px', // Slightly wider to accommodate more info
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        zIndex: 100,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Header with close button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          Hue Light Control
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#777',
          }}
        >
          <IoMdClose />
        </button>
      </div>

      {!isConfigured ? (
        // Not configured state
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <FaLightbulb style={{ fontSize: '24px', color: '#ccc', marginBottom: '12px' }} />
          <p style={{ margin: '0 0 16px 0', color: '#666' }}>
            Phillips Hue is not set up yet.
          </p>
          <button
            onClick={onOpenFullSettings}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '999px',
              backgroundColor: '#007AFF',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Set Up Hue
          </button>
        </div>
      ) : (
        // Configured state
        <>
          {/* Status indicator */}
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#555', fontWeight: '500' }}>Connection Status:</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isStreamingActive ? '#4ade80' : '#f87171',
                  marginRight: '6px',
                  boxShadow: isStreamingActive ? '0 0 6px rgba(74, 222, 128, 0.6)' : 'none',
                }}></span>
                <span style={{ color: isStreamingActive ? '#16a34a' : '#ef4444', fontSize: '14px' }}>
                  {isStreamingActive ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              Bridge: {hueSettings?.bridge?.name || hueSettings?.bridge?.ip || 'Unknown'}
            </div>

            {hueSettings?.selectedGroup && (
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                Entertainment Group: {hueSettings?.selectedGroup.name || 'Active'}
              </div>
            )}

            {/* Audio Visualization Section */}
            {isStreamingActive && (
              <div style={{ marginTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '12px' }}>
                <div style={{ fontSize: '14px', color: '#555', fontWeight: '500', marginBottom: '8px' }}>
                  Audio Analysis:
                </div>

                {/* Mini spectrum analyzer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  height: '40px',
                  marginBottom: '12px',
                  padding: '0 2px'
                }}>
                  {spectrumData.map((value, index) => (
                    <div
                      key={index}
                      style={{
                        width: '4px',
                        height: `${Math.max(4, (value / 255) * 100)}%`,
                        backgroundColor: `hsl(${200 + (index * 10)}, 70%, 60%)`,
                        borderRadius: '1px',
                        transition: 'height 0.1s ease'
                      }}
                    />
                  ))}
                </div>

                {/* Music detection indicators */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Beat detection indicator */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#555', fontWeight: '500', fontSize: '14px' }}>Beat:</span>
                    <div
                      ref={beatRef}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: beatStatus.isDetected ? '#3b82f6' : '#d1d5db',
                        transition: 'all 0.1s ease',
                        boxShadow: beatStatus.isDetected ? '0 0 8px rgba(59, 130, 246, 0.7)' : 'none',
                      }}></div>
                      <span style={{
                        color: beatStatus.isDetected ? '#3b82f6' : '#6b7280',
                        fontSize: '14px',
                        fontWeight: beatStatus.isDetected ? '500' : 'normal',
                        transition: 'all 0.1s ease',
                      }}>
                        {beatStatus.isDetected ? 'Beat!' : 'Monitoring...'}
                      </span>
                    </div>
                  </div>

                  {/* Vocal detection indicator */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#555', fontWeight: '500', fontSize: '14px' }}>Vocals:</span>
                    <div
                      ref={vocalRef}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FaMicrophone style={{
                        fontSize: '14px',
                        color: beatStatus.vocalActive ? '#ec4899' : '#d1d5db',
                        transition: 'all 0.2s ease',
                      }} />
                      <span style={{
                        color: beatStatus.vocalActive ? '#ec4899' : '#6b7280',
                        fontSize: '14px',
                        fontWeight: beatStatus.vocalActive ? '500' : 'normal',
                        transition: 'all 0.1s ease',
                      }}>
                        {beatStatus.vocalActive
                          ? beatStatus.vocalEnergy > 80
                            ? 'Strong Vocal!'
                            : 'Vocal Detected'
                          : 'Monitoring...'}
                      </span>
                    </div>
                  </div>

                  {/* Energy levels - Bass and Mid */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#555' }}>
                    <div>Bass: <strong>{beatStatus.bassEnergy?.toFixed(0) || 0}</strong></div>
                    <div>Mid: <strong>{beatStatus.midEnergy?.toFixed(0) || 0}</strong></div>
                    <div>High: <strong>{beatStatus.highEnergy?.toFixed(0) || 0}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Current light settings */}
            {isStreamingActive && (
              <div style={{
                marginTop: '12px',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#555', fontWeight: '500', fontSize: '14px' }}>Current Color:</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: formatRGB(beatStatus.currentColor),
                    boxShadow: '0 0 5px rgba(0,0,0,0.2)',
                    border: '2px solid white',
                  }} />
                  <span style={{ fontSize: '13px', color: '#555' }}>
                    Brightness: <strong>{((beatStatus.brightness || 0) * 100).toFixed(0)}%</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={toggleStreaming}
              style={{
                flex: '1',
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: isStreamingActive ? '#f87171' : '#4ade80',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isStreamingActive ? <FaPause /> : <FaPlay />}
              {isStreamingActive ? 'Stop Sync' : 'Start Sync'}
            </button>

            <button
              onClick={handleTestLights}
              disabled={isTestingLights}
              style={{
                flex: '1',
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: isTestingLights ? 'default' : 'pointer',
                fontWeight: '500',
                opacity: isTestingLights ? 0.7 : 1,
              }}
            >
              {isTestingLights ? 'Testing...' : 'Test Lights'}
            </button>
          </div>

          {/* Test result message */}
          {lastTestResult && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: lastTestResult === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
              marginBottom: '16px',
              color: lastTestResult === 'success' ? '#16a34a' : '#ef4444',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {lastTestResult === 'success'
                ? 'Light test completed successfully!'
                : 'Light test failed. Check bridge connection.'}
            </div>
          )}

          {/* Advanced settings link */}
          <button
            onClick={onOpenFullSettings}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <FaCog style={{ fontSize: '14px' }} />
            <span>Advanced Settings</span>
          </button>
        </>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes beatPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .beat-pulse {
          animation: beatPulse 0.3s ease-in-out;
        }
        @keyframes vocalPulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .vocal-active {
          color: #ec4899 !important;
          text-shadow: 0 0 3px rgba(236, 72, 153, 0.4);
        }
        .sustaining {
          animation: vocalPulse 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default HueStatusPanel;
