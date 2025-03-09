import React, { useState, useEffect } from 'react';
import { FaImage, FaUpload } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';

interface ShaderImageSelectorProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const ShaderImageSelector: React.FC<ShaderImageSelectorProps> = ({ 
  song, 
  songId, 
  refetch 
}) => {
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<{name: string, path: string} | null>(null);
  const [selectedTextureImage, setSelectedTextureImage] = useState<{name: string, path: string} | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [shaderBackgroundUrl, setShaderBackgroundUrl] = useState<string>('');
  const [shaderTextureUrl, setShaderTextureUrl] = useState<string>('');

  useEffect(() => {
    loadShaderImages();
  }, [song]);

  const loadShaderImages = async () => {
    if (song && song.dataValues) {
      if (song.dataValues.shaderBackground) {
        try {
          const backgroundPath = await window.electron.fileSystem.mergeAssetPath(song.dataValues.shaderBackground);
          setShaderBackgroundUrl(backgroundPath);
        } catch (error) {
          console.error("Failed to load shader background:", error);
        }
      }
      
      if (song.dataValues.shaderTexture) {
        try {
          const texturePath = await window.electron.fileSystem.mergeAssetPath(song.dataValues.shaderTexture);
          setShaderTextureUrl(texturePath);
        } catch (error) {
          console.error("Failed to load shader texture:", error);
        }
      }
    }
  };

  const openFileDialog = async (type: 'background' | 'texture') => {
    try {
      const result = await window.electron.ipcRenderer.invoke('open-file-dialog');
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split('\\').pop().split('/').pop(); // Extract filename
        
        if (type === 'background') {
          setSelectedBackgroundImage({
            name: fileName,
            path: filePath
          });
        } else {
          setSelectedTextureImage({
            name: fileName,
            path: filePath
          });
        }
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
    }
  };

  const handleImageUpload = async (type: 'background' | 'texture') => {
    const selectedImage = type === 'background' ? selectedBackgroundImage : selectedTextureImage;
    if (!selectedImage || !song) return;

    setUploadStatus(`Uploading ${type} shader...`);
    try {
      const result = await window.electron.ipcRenderer.invoke('save-shader-image', {
        songId: songId,
        filePath: selectedImage.path,
        fileName: selectedImage.name,
        shaderType: type
      });

      if (result.success) {
        setUploadStatus(`${type} shader upload successful!`);
        
        // Update the song with the new image path
        const fieldToUpdate = type === 'background' ? 'shaderBackground' : 'shaderTexture';
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          [fieldToUpdate]: result.savedPath
        });
        
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
        
        // Reset selected image
        if (type === 'background') {
          setSelectedBackgroundImage(null);
          setShaderBackgroundUrl(await window.electron.fileSystem.mergeAssetPath(result.savedPath));
        } else {
          setSelectedTextureImage(null);
          setShaderTextureUrl(await window.electron.fileSystem.mergeAssetPath(result.savedPath));
        }
        
        // Refresh the song data
        refetch();
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
        Shader Images
      </h3>
      
      {/* Background Shader Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Background Shader</h4>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <button
            onClick={() => openFileDialog('background')}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: colors.grey3,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <FaImage style={{ marginRight: '0.5rem' }} />
            Select Image
          </button>
          
          {selectedBackgroundImage && (
            <span style={{
              fontSize: '0.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '150px'
            }}>
              {selectedBackgroundImage.name}
            </span>
          )}
          
          <button
            onClick={() => handleImageUpload('background')}
            disabled={!selectedBackgroundImage}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: selectedBackgroundImage ? colors.blue : colors.grey3,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: selectedBackgroundImage ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              marginLeft: 'auto',
            }}
          >
            <FaUpload style={{ marginRight: '0.5rem' }} />
            Upload
          </button>
        </div>
        
        {/* Display current background shader */}
        {shaderBackgroundUrl ? (
          <div style={{
            border: `1px solid ${colors.grey4}`,
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '1rem'
          }}>
            <p style={{ fontSize: '0.8rem', marginBottom: '5px', color: colors.grey2 }}>Current Background Shader:</p>
            <img 
              src={shaderBackgroundUrl} 
              alt="Background Shader"
              style={{
                width: '100%',
                maxHeight: '150px',
                objectFit: 'contain',
                borderRadius: '4px',
              }}
            />
          </div>
        ) : (
          <p style={{ color: colors.grey2, fontStyle: 'italic', fontSize: '0.8rem' }}>
            No background shader image set
          </p>
        )}
      </div>
      
      {/* Texture Shader Section */}
      <div>
        <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Texture Shader</h4>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <button
            onClick={() => openFileDialog('texture')}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: colors.grey3,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <FaImage style={{ marginRight: '0.5rem' }} />
            Select Image
          </button>
          
          {selectedTextureImage && (
            <span style={{
              fontSize: '0.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '150px'
            }}>
              {selectedTextureImage.name}
            </span>
          )}
          
          <button
            onClick={() => handleImageUpload('texture')}
            disabled={!selectedTextureImage}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: selectedTextureImage ? colors.blue : colors.grey3,
              color: colors.white,
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              cursor: selectedTextureImage ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              marginLeft: 'auto',
            }}
          >
            <FaUpload style={{ marginRight: '0.5rem' }} />
            Upload
          </button>
        </div>
        
        {/* Display current texture shader */}
        {shaderTextureUrl ? (
          <div style={{
            border: `1px solid ${colors.grey4}`,
            borderRadius: '8px',
            padding: '10px',
          }}>
            <p style={{ fontSize: '0.8rem', marginBottom: '5px', color: colors.grey2 }}>Current Texture Shader:</p>
            <img 
              src={shaderTextureUrl} 
              alt="Texture Shader"
              style={{
                width: '100%',
                maxHeight: '150px',
                objectFit: 'contain',
                borderRadius: '4px',
              }}
            />
          </div>
        ) : (
          <p style={{ color: colors.grey2, fontStyle: 'italic', fontSize: '0.8rem' }}>
            No texture shader image set
          </p>
        )}
      </div>
      
      {uploadStatus && (
        <p style={{
          fontSize: '0.9rem',
          marginTop: '1rem',
          color: uploadStatus.includes('Error') || uploadStatus.includes('failed')
            ? 'red' : 'green'
        }}>
          {uploadStatus}
        </p>
      )}
    </div>
  );
};

export default ShaderImageSelector;
