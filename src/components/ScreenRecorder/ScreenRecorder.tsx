import React, { useState, useEffect, useRef } from 'react';
import colors from '../../theme/colors';
import { FaMicrophone, FaStop, FaExclamationTriangle } from 'react-icons/fa';

const ScreenRecorder = () => {
    const [recording, setRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const [duration, setDuration] = useState(0);
    const [timerInterval, setTimerInterval] = useState(null);
    // max 30 min
    const MAX_DURATION = 30 * 60;
    
    // Keep the state for UI updates if needed
    const [recordedChunks, setRecordedChunks] = useState([]);

    useEffect(() => {
        // Clean up timer when component unmounts
        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [timerInterval]);
    
    const handleStream = (stream) => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => videoRef.current.play();
            
            // Set up media recorder
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
            mediaRecorderRef.current = mediaRecorder;
            console.log('Media Recorder:', mediaRecorder);
            
            mediaRecorder.ondataavailable = (event) => {
                console.log('Data Available:', event.data);
                setRecordedChunks((prev) => [...prev, event.data]);
            };

            mediaRecorder.start();
            setLoading(false);
        }
    }


    const getResource = async () => {
        try {
            navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true
            }).then(stream => {
            // video.srcObject = stream
            // video.onloadedmetadata = (e) => video.play()
                console.log('Stream:', stream);
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length === 0) {
                    setError('No audio track available');
                    setRecording(false);
                    setLoading(false);
                    return;
                }
                console.log('Audio Tracks:', audioTracks);
                const audioStream = new MediaStream(audioTracks);

                handleAudioStream(audioStream, stream);
            }).catch(e => console.log(e))

            // handleStream(stream);
            console.log('Recording started');
        } catch (e) {
            console.error(e);
            setError('Failed to start recording');
            setRecording(false);
            setLoading(false);
        }
    }

    const handleAudioStream = (audioStream, fullStream) => {
        // Clear previous chunks
        chunksRef.current = [];
        
        if (videoRef.current) {
            videoRef.current.srcObject = fullStream;
            videoRef.current.onloadedmetadata = () => videoRef.current.play();
            videoRef.current.muted = true;
        }
        
        const mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Add directly to ref
                chunksRef.current.push(event.data);
                // Also update state for UI if needed
                setRecordedChunks([...chunksRef.current]);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Media Recorder Stopped');
            console.log('Recorded Chunks:', chunksRef.current);
            saveRecording(chunksRef.current); // Pass the ref value directly
        }
        
        // Request data more frequently (every 1 second)
        mediaRecorder.start();
        setLoading(false);
    }

    const startRecording = async () => {
        setRecording(true);
        setLoading(true);
        setError('');
        setDuration(0);

        const interval = setInterval(() => {
            setDuration(prev => {
                const newDuration = prev + 1;
                if (newDuration >= MAX_DURATION) {
                    clearInterval(interval);
                    setTimeout(() => stopRecording)
                    stopRecording();
                    return MAX_DURATION
                }
                return newDuration;
            })
        }, 1000);
        setTimerInterval(interval);
        await getResource();
    };

    const saveRecording = async (chunks = chunksRef.current) => {
        if (chunks.length === 0) {
            setError('No recording data available');
            setLoading(false);
            return;
        }

        const blob = new Blob(chunks, {
            type: 'audio/webm'
        });

        // Create a timestamp for filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `audio-recording-${timestamp}.webm`;

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reset recorded chunks
        chunksRef.current = [];
        setRecordedChunks([]);
    };

    const stopRecording = () => {
        if (timerInterval){
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
        if (videoRef.current && videoRef.current.srcObject) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.pause();
                setRecording(false);
            }
        }
    };

    // Format seconds to MM:SS
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            className="screen-recorder"
            style={{
                backgroundColor: colors.white,
                borderRadius: '24px',
                padding: '1rem',
                margin: '1.5vh auto',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                width: '100%', /* Changed from 95% to 100% */
                maxWidth: '100%', /* Changed from fixed 600px */
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxSizing: 'border-box',
                overflowX: 'hidden',
                position: 'relative',
            }}
        >
            <h2 style={{ 
                color: colors.grey1, 
                fontSize: 'clamp(1.1rem, 2.5vw, 1.3rem)', 
                fontWeight: 'bold',
                margin: '0 0 0.75rem 0',
                alignSelf: 'flex-start',
                width: '100%',
                boxSizing: 'border-box',
            }}>
                Audio Recorder
            </h2>
            
            <div className="video-container" style={{ 
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: colors.grey5,
                marginBottom: '1rem',
                boxShadow: recording ? `0 0 0 2px ${colors.blue}` : 'none',
                transition: 'box-shadow 0.3s ease',
                boxSizing: 'border-box',
            }}>
                <video 
                    ref={videoRef} 
                    style={{ 
                        width: '100%', 
                        borderRadius: '16px',
                        display: 'block',
                        maxHeight: '200px', /* Reduced from 240px */
                        objectFit: 'cover',
                    }} 
                />
            </div>
            
            {/* Timer Component */}
            {recording && (
                <div className="timer" style={{
                    margin: '0 0 1rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    backgroundColor: colors.grey5,
                    fontSize: 'clamp(0.8rem, 1.2vw, 1rem)',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'fit-content',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    flexWrap: 'wrap',
                }}>
                    <span style={{ 
                        color: duration > MAX_DURATION - 60 ? colors.red : colors.blue
                    }}>
                        {formatTime(duration)}
                    </span>
                    <span style={{ margin: '0 0.5rem', color: colors.grey2 }}>/</span>
                    <span style={{ color: colors.grey2 }}>{formatTime(MAX_DURATION)}</span>
                    {duration > MAX_DURATION - 60 && (
                        <span style={{ 
                            display: 'flex',
                            alignItems: 'center', 
                            marginLeft: '0.5rem', 
                            color: colors.red,
                            fontSize: 'clamp(0.65rem, 0.8vw, 0.75rem)'
                        }}>
                            <FaExclamationTriangle style={{ marginRight: '4px' }} /> 
                            Almost done
                        </span>
                    )}
                </div>
            )}
            
            {/* Control Buttons */}
            <div className="controls" style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.5rem',
                justifyContent: 'center',
                width: '100%',
                boxSizing: 'border-box',
                flexWrap: 'wrap',
            }}>
                <button 
                    onClick={startRecording} 
                    disabled={recording || loading}
                    style={{ 
                        padding: '0.6rem 1rem',
                        backgroundColor: recording || loading ? colors.grey4 : colors.green,
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: recording || loading ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)',
                        fontWeight: '500',
                        flex: '1',
                        minWidth: '0', /* Allow buttons to shrink below minWidth */
                        maxWidth: '160px',
                        opacity: recording || loading ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <FaMicrophone style={{ marginRight: '6px', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {loading ? 'Starting...' : 'Start Recording'}
                    </span>
                </button>
                <button 
                    onClick={stopRecording} 
                    disabled={!recording}
                    style={{ 
                        padding: '0.6rem 1rem',
                        backgroundColor: !recording ? colors.grey4 : colors.red,
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: !recording ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'clamp(0.8rem, 0.9vw, 0.9rem)',
                        fontWeight: '500',
                        flex: '1',
                        minWidth: '0', /* Allow buttons to shrink below minWidth */
                        maxWidth: '160px',
                        opacity: !recording ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <FaStop style={{ marginRight: '6px', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Stop Recording</span>
                </button>
            </div>
            
            {error && (
                <div style={{ 
                    marginTop: '1rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderLeft: `4px solid ${colors.red}`,
                    color: colors.red,
                    borderRadius: '4px',
                    fontSize: 'clamp(0.7rem, 0.9vw, 0.85rem)',
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    wordBreak: 'break-word',
                    textOverflow: 'ellipsis',
                }}>
                    <FaExclamationTriangle style={{ marginRight: '6px', flexShrink: 0 }} />
                    <span>{error}</span>
                </div>
            )}
            
            <div style={{
                fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)',
                color: colors.grey3,
                marginTop: '1rem',
                textAlign: 'center',
                width: '100%',
                boxSizing: 'border-box',
            }}>
                Recording will automatically save to downloads folder
            </div>
        </div>
    );
};

export default ScreenRecorder;
