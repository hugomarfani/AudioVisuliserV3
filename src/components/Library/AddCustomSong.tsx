import React, { useState } from 'react';
import colors from '../../theme/colors';
import AIProgressTracker from '../common/AIProgressTracker';
import { FaSpinner } from 'react-icons/fa';
import { useAIProcessTracking } from '../../hooks/useAIProcessTracking';

interface AddSongFormProps {
    onSubmit: (data: { url: string; prompt: string; moods: string[] }) => void;
}

const AddCustomSong: React.FC<AddSongFormProps> = ({ onSubmit }) => {
    const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
    const [filePath, setFilePath] = useState<string | null>('');
    
    // New state variables for song metadata
    const [songName, setSongName] = useState<string>('');
    const [artistName, setArtistName] = useState<string>('');
    const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
    const [selectingThumbnail, setSelectingThumbnail] = useState(false);

    // Handle completion of AI processing
    const handleComplete = (data: any) => {
        setSongName('');
        setArtistName('');
        setThumbnailPath(null);
        setFilePath('');
        
        onSubmit({ url: '', prompt: '', moods: [] });
    };
    
    const {
        isProcessing,
        status,
        progressSteps,
        startProcessing,
        setStatus,
        updateStep
    } = useAIProcessTracking({
        operationId: currentOperationId,
        onComplete: handleComplete
    });

    // Function to select a thumbnail image
    const handleSelectThumbnail = async () => {
        try {
            setSelectingThumbnail(true);
            
            // Open file dialog and get selected path
            const result = await window.electron.ipcRenderer.invoke('open-file-dialog');
            
            if (result.canceled || result.filePaths.length === 0) {
                setSelectingThumbnail(false);
                return;
            }
            
            setThumbnailPath(result.filePaths[0]);
            setSelectingThumbnail(false);
        } catch (error) {
            setSelectingThumbnail(false);
            console.error("Error selecting thumbnail:", error);
            alert(`Failed to select thumbnail: ${error}`);
        }
    };

    const handleLinkAudioFile = async () => {
        try {

            // Open file dialog and get selected path
            const result = await window.electron.fileSystem.selectAudioFile();


            if (result.cancelled) {
                return;
            }
            setFilePath(result.filePath);

            // // Link the selected file to this song
            // await window.electron.fileSystem.linkNewMp3(songId, result.filePath);

            // setLinkingFile(false);
            // alert("Audio file linked successfully!");

        } catch (error) {
            console.error("Error linking audio file:", error);
            alert(`Failed to link audio file: ${error}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required fields
        if (!filePath) {
            setStatus('Please select an audio file');
            return;
        }
        
        if (!songName.trim()) {
            setStatus('Please enter a song name');
            return;
        }
        
        if (!artistName.trim()) {
            setStatus('Please enter an artist name');
            return;
        }
        
        if (!thumbnailPath) {
            setStatus('Please select a thumbnail image');
            return;
        }

        // Generate operation ID
        const operationId = `add-song-${Date.now()}`;
        setCurrentOperationId(operationId);

        // Initialize processing state
        startProcessing([
            { key: 'processing', label: 'Processing Audio File', completed: false },
        ]);
        setStatus('Processing audio file...');

        try {
            // Save custom song with provided metadata
            const result = await window.electron.ipcRenderer.invoke(
                'save-custom-song', 
                songName, 
                artistName, 
                thumbnailPath
            );

            const resultId = result.dataValues.id;
            
            // Link the audio file to the song
            await window.electron.ipcRenderer.invoke(
                'link-new-mp3',
                resultId,
                filePath
            );
            
            // Mark processing complete
            updateStep('processing', true);

            setStatus(`Song added successfully! Processing with Whisper...`);
      
            // Run whisper with our operation ID
            await window.electron.ipcRenderer.invoke(
              'run-whisper',
              resultId,
              operationId
            );
            

        } catch (error) {
            setStatus(`Error: ${error.message || 'Unknown error occurred'}`);
            setCurrentOperationId(null);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
            {/* Song Metadata Section */}
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                    Song Information
                </h3>
                
                {/* Song Name Field */}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="songName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Song Name *
                    </label>
                    <input
                        id="songName"
                        type="text"
                        value={songName}
                        onChange={(e) => setSongName(e.target.value)}
                        placeholder="Enter song name"
                        style={{
                            width: '95%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: `1px solid ${colors.grey4}`,
                            backgroundColor: colors.white,
                            color: colors.black
                        }}
                        required
                    />
                </div>
                
                {/* Artist Name Field */}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="artistName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Artist Name *
                    </label>
                    <input
                        id="artistName"
                        type="text"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        placeholder="Enter artist name"
                        style={{
                            width: '95%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: `1px solid ${colors.grey4}`,
                            backgroundColor: colors.white,
                            color: colors.black
                        }}
                        required
                    />
                </div>
                
                {/* Thumbnail Selection */}
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="thumbnail" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Song Thumbnail *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={handleSelectThumbnail}
                            disabled={selectingThumbnail}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: colors.purple,
                                color: colors.white,
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectingThumbnail ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                            }}
                        >
                            {selectingThumbnail ? 'Selecting...' : 'Select Thumbnail'}
                        </button>
                        {thumbnailPath && (
                            <span style={{ color: colors.green }}>✓ Thumbnail selected</span>
                        )}
                    </div>
                    {thumbnailPath && (
                        <div style={{ marginTop: '0.5rem', maxWidth: '200px' }}>
                            <img 
                                src={`file://${thumbnailPath}`} 
                                alt="Selected thumbnail" 
                                style={{ width: '100%', borderRadius: '4px' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Link New Audio File section */}
            <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                    Link Local Audio File
                </h3>
                <p style={{ fontSize: '0.9rem', color: colors.grey2, marginBottom: '1rem' }}>
                    Select a local audio file to use with this song instead of downloading from YouTube.
                </p>
                <button
                    type="button"
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: colors.green,
                        color: colors.white,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginRight: '10px'
                    }}
                    onClick={handleLinkAudioFile}
                >
                    Select Audio File
                </button>
                {filePath && (
                    <span style={{ color: colors.green, marginLeft: '0.5rem' }}>
                        ✓ Audio file selected
                    </span>
                )}
            </div>

            <button
                type="submit"
                disabled={isProcessing || !songName || !artistName || !thumbnailPath || !filePath}
                style={{
                    padding: '0.75rem 2rem',
                    backgroundColor: isProcessing || !songName || !artistName || !thumbnailPath || !filePath ? colors.grey3 : colors.blue,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '999px',
                    cursor: isProcessing || !songName || !artistName || !thumbnailPath || !filePath ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    marginTop: '1rem',
                    width: 'fit-content',
                    alignSelf: 'center',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                {isProcessing && <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />}
                {isProcessing ? 'Processing...' : 'Add Song'}
            </button>

            {/* Use AIProgressTracker component */}
            <AIProgressTracker
                isProcessing={isProcessing}
                progressSteps={progressSteps}
                statusMessage={status}
            />
        </form>
    );
};

export default AddCustomSong;
