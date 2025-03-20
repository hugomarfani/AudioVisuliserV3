import React, { useState, useEffect, useRef } from 'react';
import colors from '../../theme/colors';

const ScreenRecorder = () => {
    const [recording, setRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]); // Use ref instead of state for chunks
    
    // Keep the state for UI updates if needed
    const [recordedChunks, setRecordedChunks] = useState([]);
    
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
            // mediaRecorder.onstop = () => {
            //     console.log('Media Recorder Stopped');
            //     console.log('Recorded Chunks:', recordedChunks);
            //     setTimeout(() => {
            //         saveRecording();
            //         const tracks = videoRef.current.srcObject.getTracks();
            //         tracks.forEach(track => track.stop());
            //         videoRef.current.pause();
            //         setRecording(false);
            //     }, 300);
            // }
            mediaRecorder.start();
            setLoading(false);
        }
    }


    const getResource = async () => {
        try {
            // const sourceId = await window.electron.ipcRenderer.invoke('get-sources');
            // const sourceList = await window.recorder.getSources();
            // const sourceList = await window.electron.ipcRenderer.invoke('get-sources');
            // console.log('Source List:', sourceList);
            // const source = sourceList.find(source => source.name === 'Entire screen');
            // const sourceId = source.id;
            // console.log('Source ID:', sourceId);
            // const stream = await navigator.mediaDevices.getUserMedia({
            //     audio: true,
            //     video: {
            //         mandatory: {
            //             chromeMediaSource: 'desktop',
            //             chromeMediaSourceId: sourceId,
            //             minWidth: 1280,
            //             maxWidth: 1280,
            //             minHeight: 720,
            //             maxHeight: 720
            //         }
            //     }
            // });
            // console.log('Stream:', stream);
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

        // Save to file
        // const reader = new FileReader();
        // reader.onload = async () => {
        //     if (reader.result) {
        //         try {
        //             const result = await window.electron.fileSystem.saveAudioRecording({
        //                 buffer: reader.result,
        //                 fileName: fileName
        //             });
        //             if (result) {
        //                 console.log('File saved successfully');
        //             }
        //         } catch (e) {
        //             console.error(e);
        //             setError('Failed to save recording');
        //         }
        //     }
        //     setRecordedChunks([]);
        // };
        // reader.readAsArrayBuffer(blob);
        // const result = await window.electron.fileSystem.saveAudioRecording({ blob, fileName });

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reset recorded chunks
        chunksRef.current = [];
        setRecordedChunks([]);
    };

    const stopRecording = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            // Stop media recorder first
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                
                //Add a small delay to ensure data is collected
                // setTimeout(() => {
                    // saveRecording();
                    
                // Then stop tracks
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.pause();
                setRecording(false);
                    // saveRecording();
                // }, 300);
                // setTimeout(() => {
                //     saveRecording();
                // }, 1000);
            }
        }
    };

    return (
        <div className="screen-recorder">
            <h2>Audio Recorder</h2>
            <div className="video-container">
                <video ref={videoRef} style={{ width: '100%', maxWidth: '320px' }} />
            </div>
            <div className="controls">
                <button 
                    onClick={startRecording} 
                    disabled={recording || loading}
                    style={{ 
                        padding: '8px 16px',
                        margin: '8px',
                        backgroundColor: colors.green,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                    }}
                >
                    {loading ? 'Starting...' : 'Start Recording'}
                </button>
                <button 
                    onClick={stopRecording} 
                    disabled={!recording}
                    style={{ 
                        padding: '8px 16px',
                        margin: '8px',
                        backgroundColor: colors.red,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                    }}
                >
                    Stop Recording
                </button>
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default ScreenRecorder;
