import React, { useState } from 'react';
import { FaStar, FaPlus, FaCheck, FaTrash, FaCog } from 'react-icons/fa';
import { SongModel } from '../../database/models/Song';
import colors from '../../theme/colors';
import particleListData from '../../particles/particleList.json';
import ParticleSettings from './ParticleSettings';

interface ParticleSelectorProps {
  song: SongModel;
  songId: string;
  refetch: () => void;
}

// Define TypeScript interface for the new particle structure
interface ParticleData {
  id: string;
  name: string;
  weight: number;
  gravity: number;
  bounce: number;
  airResistance: number;
  lifespan: number;
  glow: boolean;
  images: string[];
  moods: string[];
  dir: string;
  count: number;
}

const ParticleSelector: React.FC<ParticleSelectorProps> = ({ song, songId, refetch }) => {
  const [particleList, setParticleList] = useState<ParticleData[]>(particleListData.particles);
  const [showParticleSelector, setShowParticleSelector] = useState<boolean>(false);
  const [customParticleName, setCustomParticleName] = useState<string>('');
  const [particleUploadStatus, setParticleUploadStatus] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedParticleForSettings, setSelectedParticleForSettings] = useState<string>('');

  // Helper function to find particle name by ID
  const getParticleNameById = (particleId: string): string => {
    const particle = particleList.find(p => p.id === particleId);
    return particle ? particle.name : particleId;
  };

  // Handler for selecting predefined particles
  const handleSelectParticle = async (particleId: string) => {
    if (!song) return;

    // Clone the current particles array or create a new one
    const currentParticles = [...(song.dataValues.particles || [])];
    
    // Check if the particle is already selected
    const isAlreadySelected = currentParticles.includes(particleId);
    
    let updatedParticles;
    if (isAlreadySelected) {
      // Remove the particle if already selected
      updatedParticles = currentParticles.filter(p => p !== particleId);
    } else {
      // Add the particle if not selected
      updatedParticles = [...currentParticles, particleId];
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

  // Handler for creating and adding a custom particle
  const handleAddCustomParticle = async () => {
    if (!customParticleName || !song) {
      setParticleUploadStatus('Please provide a name for the custom particle');
      return;
    }

    // Validate that the particle name is a single word (no spaces)
    if (customParticleName.includes(' ')) {
      setParticleUploadStatus('Particle name must be a single word (no spaces)');
      return;
    }

    setParticleUploadStatus('Creating custom particle...');
    try {
      // Create a safe ID from the name (lowercase)
      const customParticleId = `custom_${customParticleName.toLowerCase()}`;
      
      // Create new particle object
      const newParticle: ParticleData = {
        id: customParticleId,
        name: customParticleName,
        weight: 1.0,
        gravity: 0.1,
        bounce: 0.5,
        airResistance: 0.02,
        lifespan: 5000,
        glow: false,
        images: [],
        moods: ["custom"],
        dir: customParticleId,
        count: 0
      };
      
      // Update particle list with the new custom particle
      const updatedParticles = [...particleList, newParticle];
      
      // Save the updated particle list to particleList.json
      const result = await window.electron.ipcRenderer.invoke('update-particle-settings', {
        particles: updatedParticles
      });
      
      if (result.success) {
        // Update the song with the new custom particle
        const updatedSongParticles = [...(song.dataValues.particles || []), customParticleId];
        
        await window.electron.ipcRenderer.invoke('update-song', {
          id: songId,
          particles: updatedSongParticles
        });
        
        // Save the updated song as JSON
        await window.electron.ipcRenderer.invoke('save-song-as-json', { id: songId });
        
        // Update local state
        setParticleList(updatedParticles);
        setCustomParticleName('');
        
        // Open particle settings with the new particle selected
        setSelectedParticleForSettings(customParticleId);
        //setShowSettings(true);
        
        setParticleUploadStatus('Custom particle added successfully');
        
        // Refresh the song data
        refetch();
      } else {
        setParticleUploadStatus(`Failed to add custom particle: ${result.error}`);
      }
    } catch (error) {
      setParticleUploadStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    }
  };

  // Handler for deleting particles
  const handleDeleteParticle = async (particleId: string) => {
    if (!song) return;
    
    try {
      // Remove from particles array
      const updatedParticles = (song.dataValues.particles || []).filter(p => p !== particleId);
      
      // If it's a custom particle, also clean up the image reference
      if (particleId.startsWith('custom_')) {
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

  // Handle closing the settings modal
  const handleSettingsClose = () => {
    setShowSettings(false);
    setSelectedParticleForSettings('');
  };

  // Handle settings saved
  const handleSettingsSaved = () => {
    setParticleUploadStatus('Particle settings updated successfully');
    // Use a simple timeout instead of immediately trying to fetch
    setTimeout(() => {
      // Silently update the particle list without showing errors to the user
      window.electron.ipcRenderer.invoke('get-particle-list')
        .then(result => {
          if (result.success) {
            setParticleList(result.particles);
          }
        })
        .catch(() => {
          // Silent fail - we'll use the existing data
          console.log('Using cached particle list data');
        });
      refetch();
    }, 1000); // Wait a second before refreshing to allow the file to be written
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem', position: 'relative' }}>
      <h3 style={{ 
        fontSize: '1.2rem', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FaStar style={{ marginRight: '0.5rem' }} />
          Particle Effects
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.grey3,
            color: colors.white,
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          title="Particle Settings"
        >
          <FaCog />
        </button>
      </h3>
      
      {/* Display selected particles */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Selected Particles:</h4>
        {song.dataValues.particles && song.dataValues.particles.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {song.dataValues.particles.map((particleId, index) => {
              // Find the particle object to display the proper name
              const particleName = getParticleNameById(particleId);
              return (
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
                  <span>{particleName}</span>
                  <button
                    onClick={() => handleDeleteParticle(particleId)}
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
              );
            })}
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
              const isSelected = song.dataValues.particles?.includes(particle.id);
              return (
                <button
                  key={particle.id}
                  onClick={() => handleSelectParticle(particle.id)}
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
                  {particle.name}
                </button>
              );
            })}
          </div>
          
          <h4 style={{ fontSize: '1rem', marginTop: '1rem', marginBottom: '0.75rem' }}>Create custom particle:</h4>
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
              <button
                onClick={handleAddCustomParticle}
                disabled={!customParticleName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: customParticleName ? colors.blue : colors.grey3,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  cursor: customParticleName ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                }}
              >
                <FaPlus style={{ marginRight: '0.5rem' }} />
                Create Particle
              </button>
            </div>
            {particleUploadStatus && (
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: particleUploadStatus.includes('Error') || particleUploadStatus.includes('Failed') ? 'red' : 'green' }}>
                {particleUploadStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Particle Settings Modal */}
      {showSettings && (
        <ParticleSettings 
          onClose={handleSettingsClose} 
          onSaved={handleSettingsSaved}
          initialSelectedParticleId={selectedParticleForSettings}
        />
      )}
    </div>
  );
};

export default ParticleSelector;
