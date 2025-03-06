import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SongModel } from '../../database/models/Song';
import { useSongs } from '../../hooks/useSongs';
import colors from '../../theme/colors';
import { FaPlay, FaArrowLeft, FaUpload, FaImage, FaTrash, FaPaintBrush } from 'react-icons/fa'; // Added FaPaintBrush

interface SongDetailsProps {
  onClose: () => void;
  songId: string;
}

const SongDetails: React.FC<SongDetailsProps> = ({ onClose, songId }) => {
  const { songs, refetch } = useSongs();
  const [song, setSong] = useState<SongModel | null>(null);
  const [gemmaStatus, setGemmaStatus] = useState<string>('');
  const [sdStatus, setSDStatus] = useState<string>(''); // New state for Stable Diffusion status
  const [selectedImage, setSelectedImage] = useState<{name: string, path: string} | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedImageView, setSelectedImageView] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const findImagePath = async (P: string) => {
    const response = await window.electron.fileSystem.mergeAssetPath(P);
    return response;
  };

  useEffect(() => {
    const loadSong = async () => {
      if (songs) {
        const song = songs.find((s) => s.dataValues.id === songId);
        setSong(song || null);
        if (song && song.dataValues.images) {
          const imagePaths = song.dataValues.images;
          const resolvedImagePaths = await Promise.all(
            imagePaths.map(async (imagePath) => {
              return await findImagePath(imagePath);
            })
          );
          console.log('Song Images:', resolvedImagePaths);
          setUploadedImages(resolvedImagePaths);
        }
      }
    };

    loadSong();
  }, [songs, songId]);

  const handleRunGemma = async () => {
    setGemmaStatus('Running Gemma...');
    try {
      // Replace with your actual Gemma run logic
      const result = await window.electron.ipcRenderer.invoke(
        'run-gemma',
        songId,
      );
      setGemmaStatus(`Gemma running ... ${result}`);
      refetch();
    } catch (error) {
      setGemmaStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  // New handler for Stable Diffusion
  const handleRunStableDiffusion = async () => {
    // Check if backgrounds are empty
    if (!song || !song.dataValues.backgrounds || song.dataValues.backgrounds.length === 0) {
      setSDStatus('Please run Gemma first to generate backgrounds');
      return;
    }
    
    setSDStatus('Running Stable Diffusion...');
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'run-stable-diffusion',
        songId,
      );
      setSDStatus(`Stable Diffusion running ... ${result}`);
      if (result){
        //update the databse with the new images
        const new_images = ["background_prompts_1.png", "background_prompts_2.png", "background_prompts_3.png",
          "object_prompts_1.png", "object_prompts_2.png", "object_prompts_3.png"];
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          images: new_images
        });
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
      }
      refetch();
    } catch (error) {
      setSDStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const openFileDialog = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('open-file-dialog');
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split('\\').pop().split('/').pop(); // Extract filename
        
        setSelectedImage({
          name: fileName,
          path: filePath
        });
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImage || !song) return;

    setUploadStatus('Uploading...');
    try {
      const result = await window.electron.ipcRenderer.invoke('save-image', {
        songId: songId,
        filePath: selectedImage.path,
        fileName: selectedImage.name
      });

      if (result.success) {
        setUploadStatus('Upload successful!');
        
        // Update the song with the new image path
        const updatedImages = [...(song.dataValues.images || []), result.savedPath];
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          images: updatedImages
        });
        
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
        
        setUploadedImages([...uploadedImages, await findImagePath(result.savedPath)]);
        setSelectedImage(null);
        
        // Refresh the song data
        refetch();
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const handleDeleteClick = (imagePath: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent image click (expand) when clicking delete
    setImageToDelete(imagePath);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirm = async () => {
    if (!imageToDelete || !song) {
      setShowDeleteConfirmation(false);
      return;
    }

    try {
      // Extract relative path from full path
      let relativePath = imageToDelete.split('\\assets\\')[1];
      if (!relativePath) {
        relativePath = imageToDelete.split('/assets/')[1];
      }
      let imageName = relativePath.split('\\').pop();
      if (!imageName) {
        imageName = relativePath.split('/').pop();
      }
      
      const result = await window.electron.ipcRenderer.invoke('delete-image', {
        songId: songId,
        imagePath: relativePath
      });

      if (result.success) {
        // Update the song with the new images list
        const updatedImages = song.dataValues.images.filter(img => !img.includes(imageName ? imageName : 'NaN'));
        console.log('Updated Images:', updatedImages);
        console.log("relativePath", relativePath);
        
        // Update song in database (same pattern as image upload)
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          images: updatedImages
        });
        
        // Save the updated song as JSON (same pattern as image upload)
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
        
        // Remove image from the UI
        setUploadedImages(uploadedImages.filter(img => img !== imageToDelete));
        setUploadStatus('Image deleted successfully');
        
        // Refresh the song data
        refetch();
      } else {
        setUploadStatus(`Deletion failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setShowDeleteConfirmation(false);
      setImageToDelete(null);
    }
  };

  const isGif = (path: string): boolean => {
    return path.toLowerCase().endsWith('.gif');
  };

  const handleImageClick = (imagePath: string) => {
    setSelectedImageView(imagePath);
  };

  const closeImageView = () => {
    setSelectedImageView(null);
  };

  if (song === null) {
    return <div>Song not found</div>;
  }

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
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: '24px',
          padding: '2rem',
          width: '80%',
          maxWidth: '600px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'transparent',
            color: colors.grey2,
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
          onClick={onClose}
        >
          &times;
        </button>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          {song.dataValues.title}
        </h1>
        <p style={{ fontSize: '0.9rem', color: colors.grey2, marginBottom: '1rem' }}>
          ID: {songId}
        </p>
        <h2
          style={{
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: colors.grey2,
          }}
        >
          {song.dataValues.uploader}
        </h2>
        <img
          src={song.dataValues.jacket}
          alt={song.dataValues.title}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '15px',
            marginBottom: '1rem',
          }}
        />
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Status: {song.dataValues.status}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Moods: {song.dataValues.moods.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Colors: {song.dataValues.colours.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Objects: {song.dataValues.objects.join(', ')}
        </p>
        <p style={{ fontSize: '1rem', color: colors.grey2 }}>
          Backgrounds: {song.dataValues.backgrounds.join(', ')}
        </p>
        
        {/* Image Gallery Section */}
        <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
          <h3 style={{ 
            fontSize: '1.2rem', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center'
          }}>
            <FaImage style={{ marginRight: '0.5rem' }} />
            Images & GIFs Gallery
          </h3>
          
          {/* Image Upload Control */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              onClick={openFileDialog}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: colors.grey3,
                color: colors.white,
                border: 'none',
                borderRadius: '9999px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              <FaImage style={{ marginRight: '0.5rem' }} />
              Select Image
            </button>
            {selectedImage && <span style={{marginLeft: '1rem'}}>{selectedImage.name}</span>}
            <button
              onClick={handleImageUpload}
              disabled={!selectedImage}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: selectedImage ? colors.blue : colors.grey3,
                color: colors.white,
                border: 'none',
                borderRadius: '9999px',
                padding: '0.5rem 1rem',
                cursor: selectedImage ? 'pointer' : 'not-allowed',
                fontSize: '1rem',
                marginLeft: 'auto',
              }}
            >
              <FaUpload style={{ marginRight: '0.5rem' }} />
              Upload
            </button>
          </div>
          
          {uploadStatus && (
            <p style={{ fontSize: '0.9rem', color: uploadStatus.includes('Error') || uploadStatus.includes('failed') ? 'red' : 'green' }}>
              {uploadStatus}
            </p>
          )}
          
          {/* Display uploaded images */}
          {uploadedImages && uploadedImages.length > 0 ? (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '15px' 
              }}>
                {uploadedImages.map((imagePath, index) => (
                  <div 
                    key={index}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: `1px solid ${colors.grey4}`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => handleImageClick(imagePath)}
                  >
                    <img 
                      src={imagePath} 
                      alt={`Media ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                      }}
                    />
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteClick(imagePath, e)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        color: '#FF3B30', // Apple red color
                        border: 'none',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    >
                      <FaTrash size={12} />
                    </button>
                    
                    {isGif(imagePath) && (
                      <div style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '5px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        GIF
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: colors.grey2, fontStyle: 'italic' }}>No images uploaded yet</p>
          )}
        </div>
        
        {/* Delete Confirmation Dialog - Apple style */}
        {showDeleteConfirmation && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}>
            <div style={{
              backgroundColor: 'rgba(250, 250, 250, 0.95)',
              borderRadius: '14px',
              padding: '0',
              width: '300px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                padding: '16px 16px 14px',
                textAlign: 'center',
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  margin: '0 0 8px',
                  color: '#000'
                }}>
                  Delete Image?
                </h3>
                <p style={{ 
                  fontSize: '13px', 
                  margin: 0,
                  color: '#666',
                  lineHeight: '1.4'
                }}>
                  This image will be permanently deleted. This action cannot be undone.
                </p>
              </div>
              
              <div style={{
                borderTop: '0.5px solid rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <button 
                  onClick={handleDeleteConfirm}
                  style={{
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '0.5px solid rgba(0, 0, 0, 0.2)',
                    fontSize: '17px',
                    fontWeight: 600,
                    color: '#FF3B30', // Apple red color
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
                <button 
                  onClick={() => setShowDeleteConfirmation(false)}
                  style={{
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '17px',
                    fontWeight: 400,
                    color: '#007AFF', // Apple blue color
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Large image viewer modal */}
        {selectedImageView && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
            onClick={closeImageView}
          >
            <div style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
            }}>
              <img 
                src={selectedImageView} 
                alt="Enlarged view"
                style={{
                  maxWidth: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }} 
              />
              <button
                style={{
                  position: 'absolute',
                  top: '-30px',
                  right: '0',
                  backgroundColor: 'transparent',
                  color: colors.white,
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeImageView();
                }}
              >
                &times;
              </button>
            </div>
          </div>
        )}
        
        {/* Add the buttons side by side in a container */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginTop: '1rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleRunGemma}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: colors.blue,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            <FaPlay style={{ marginRight: '0.5rem' }} />
            Run Gemma
          </button>
          
          <button
            onClick={handleRunStableDiffusion}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: song?.dataValues.backgrounds?.length ? '#5856D6' : colors.grey3, // Apple purple for active, grey for disabled
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: song?.dataValues.backgrounds?.length ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
            }}
          >
            <FaPaintBrush style={{ marginRight: '0.5rem' }} />
            Generate Images
          </button>
        </div>
        
        {gemmaStatus && (
          <p
            style={{ fontSize: '1rem', color: colors.grey2, marginTop: '1rem' }}
          >
            {gemmaStatus}
          </p>
        )}
        
        {sdStatus && (
          <p
            style={{ 
              fontSize: '1rem', 
              color: sdStatus.includes('Error') || sdStatus.includes('Please run Gemma') ? '#FF3B30' : colors.grey2,
              marginTop: '0.5rem' 
            }}
          >
            {sdStatus}
          </p>
        )}
      </div>
    </div>
  );
};

export default SongDetails;
