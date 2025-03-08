import React, { useState } from 'react';
import { FaStar, FaPlus, FaCheck, FaTrash, FaImage, FaUpload } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import particleListData from '../../particles/particleList.json';

interface ParticleSelectorProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

const ParticleSelector: React.FC<ParticleSelectorProps> = ({ song, songId, refetch }) => {
  const [particleList] = useState<string[]>(particleListData.particles);
  const [showParticleSelector, setShowParticleSelector] = useState<boolean>(false);
  const [customParticleName, setCustomParticleName] = useState<string>('');
  const [selectedParticleImage, setSelectedParticleImage] = useState<{name: string, path: string} | null>(null);
  const [particleUploadStatus, setParticleUploadStatus] = useState<string>('');

  // Handler for selecting predefined particles
  const handleSelectParticle = async (particleName: string) => {
    if (!song) return;

    // Clone the current particles array or create a new one
    const currentParticles = [...(song.dataValues.particles || [])];
    
    // Check if the particle is already selected
    const isAlreadySelected = currentParticles.includes(particleName);
    
    let updatedParticles;
    if (isAlreadySelected) {
      // Remove the particle if already selected
      updatedParticles = currentParticles.filter(p => p !== particleName);
    } else {
      // Add the particle if not selected
      updatedParticles = [...currentParticles, particleName];
    }
    
    // Update the song in the database
    try {
      await window.electron.ipcRenderer.invoke('update-song', {
        id: songId,
        particles: updatedParticles
      });
      
      // Save the updated song as JSON
      await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
      
      // Refresh the song data
      refetch();
      setParticleUploadStatus('Particles updated successfully');
    } catch (error) {
      setParticleUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  // Handler to open file dialog for custom particles
  const openParticleFileDialog = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('open-file-dialog');
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split('\\').pop().split('/').pop(); // Extract filename
        
        setSelectedParticleImage({
          name: fileName,
          path: filePath
        });
      }
    } catch (error) {
      console.error('Error opening file dialog for particle:', error);
    }
  };

  // Handler for uploading custom particle images
  const handleParticleImageUpload = async () => {
    if (!selectedParticleImage || !song || !customParticleName) {
      setParticleUploadStatus('Please provide both a name and select an image');
      return;
    }

    setParticleUploadStatus('Uploading particle image...');
    try {
      // Save the image with a prefix to identify it as a particle
      const result = await window.electron.ipcRenderer.invoke('save-image', {
        songId: songId,
        filePath: selectedParticleImage.path,
        fileName: `particle_${customParticleName}_${selectedParticleImage.name}`
      });

      if (result.success) {
        // Update the song with the new custom particle
        const customParticleId = `custom_${customParticleName}`;
        const updatedParticles = [...(song.dataValues.particles || []), customParticleId];
        
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          particles: updatedParticles,
          // Store the mapping of custom particle ID to the image path
          [`particle_${customParticleId}`]: result.savedPath
        });
        
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
        
        setParticleUploadStatus('Custom particle added successfully');
        setSelectedParticleImage(null);
        setCustomParticleName('');
        
        // Refresh the song data
        refetch();
      } else {
        setParticleUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setParticleUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  // Handler for deleting particles
  const handleDeleteParticle = async (particleName: string) => {
    if (!song) return;
    
    try {
      // Remove from particles array
      const updatedParticles = (song.dataValues.particles || []).filter(p => p !== particleName);
      
      // If it's a custom particle, also clean up the image reference
      if (particleName.startsWith('custom_')) {
        // Logic to delete the particle image if needed
        // This would depend on how you're storing custom particle images
      }
      
      // Update the song in the database
      await window.electron.ipcRenderer.invoke('update-song', {
        id: songId,
        particles: updatedParticles
      });
      
      // Save the updated song as JSON
      await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
      
      setParticleUploadStatus('Particle removed successfully');
      
      // Refresh the song data
      refetch();
    } catch (error) {
      setParticleUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
      <h3 style={{ 
        fontSize: '1.2rem', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center'
      }}>
        <FaStar style={{ marginRight: '0.5rem' }} />
        Particle Effects
      </h3>
      
      {/* Display selected particles */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Selected Particles:</h4>
        {song.dataValues.particles && song.dataValues.particles.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {song.dataValues.particles.map((particle, index) => (
              <div 
                key={`particle-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: colors.grey5,
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '0.9rem',
                }}
              >
                <span>{particle}</span>
                <button
                  onClick={() => handleDeleteParticle(particle)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.grey2,
                    marginLeft: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <FaTrash size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: colors.grey2, fontStyle: 'italic' }}>No particles selected</p>
        )}
      </div>
      
      {/* Add particle buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowParticleSelector(!showParticleSelector)}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.blue,
            color: colors.white,
            border: 'none',
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <FaPlus style={{ marginRight: '0.5rem' }} />
          {showParticleSelector ? 'Hide Options' : 'Add Particle'}
        </button>
      </div>
      
      {/* Particle selection panel */}
      {showParticleSelector && (
        <div style={{ 
          backgroundColor: colors.grey5, 
          borderRadius: '12px', 
          padding: '1rem', 
          marginBottom: '1rem'
        }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Select from predefined particles:</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
            {particleList.map((particle) => {
              const isSelected = song.dataValues.particles?.includes(particle);
              return (
                <button
                  key={particle}
                  onClick={() => handleSelectParticle(particle)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.blue : 'white',
                    color: isSelected ? 'white' : colors.grey1,
                    border: `1px solid ${isSelected ? colors.blue : colors.grey4}`,
                    borderRadius: '16px',
                    padding: '6px 12px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isSelected && <FaCheck size={12} style={{ marginRight: '6px' }} />}
                  {particle}
                </button>
              );
            })}
          </div>
          
          <h4 style={{ fontSize: '1rem', marginTop: '1rem', marginBottom: '0.75rem' }}>Upload custom particle:</h4>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Enter name for custom particle"
                value={customParticleName}
                onChange={(e) => setCustomParticleName(e.target.value)}
                style={{
                  flex: '1',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: `1px solid ${colors.grey4}`,
                  marginRight: '8px',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={openParticleFileDialog}
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
              {selectedParticleImage && <span style={{marginLeft: '1rem', fontSize: '0.9rem'}}>{selectedParticleImage.name}</span>}
              <button
                onClick={handleParticleImageUpload}
                disabled={!selectedParticleImage || !customParticleName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: selectedParticleImage && customParticleName ? colors.blue : colors.grey3,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  cursor: selectedParticleImage && customParticleName ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  marginLeft: 'auto',
                }}
              >
                <FaUpload style={{ marginRight: '0.5rem' }} />
                Upload
              </button>
            </div>
            {particleUploadStatus && (
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: particleUploadStatus.includes('Error') || particleUploadStatus.includes('failed') ? 'red' : 'green' }}>
                {particleUploadStatus}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticleSelector;
