import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaImage, FaTrash, FaPlus } from 'react-icons/fa';
import colors from '../../theme/colors';
import particleListData from '../../particles/particleList.json';

interface ParticleSettingsProps {
  onClose: () => void;
  onSaved: () => void;
  initialSelectedParticleId?: string;
}

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

interface ImagePreviewModalProps {
  imagePath: string;
  onClose: () => void;
}

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  fileName: string;
}

interface DeleteParticleModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  particleName: string;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imagePath, onClose }) => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1100,
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={onClose}
    >
      <div style={{
        position: 'relative',
        maxHeight: '85vh',
        maxWidth: '85vw',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            color: 'white',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          aria-label="Close"
          onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        >
          <FaTimes size={16} />
        </button>
        <img 
          src={imagePath} 
          style={{
            maxHeight: '85vh',
            maxWidth: '85vw',
            objectFit: 'contain',
            borderRadius: '8px',
          }} 
          onClick={e => e.stopPropagation()}
          alt="Particle preview"
        />
      </div>
    </div>
  );
};

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ onConfirm, onCancel, fileName }) => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1100,
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 15px 0', color: '#1d1d1f', fontSize: '18px' }}>
          Delete Image
        </h3>
        <p style={{ margin: '0 0 20px 0', color: '#86868b', fontSize: '14px' }}>
          Are you sure you want to delete <strong>{fileName}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#1d1d1f',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#ff3b30',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Add a new component for delete particle confirmation
const DeleteParticleModal: React.FC<DeleteParticleModalProps> = ({ onConfirm, onCancel, particleName }) => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1100,
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 15px 0', color: '#1d1d1f', fontSize: '18px' }}>
          Delete Particle
        </h3>
        <p style={{ margin: '0 0 20px 0', color: '#86868b', fontSize: '14px' }}>
          Are you sure you want to delete the "<strong>{particleName}</strong>" particle? This action cannot be undone and will remove it from all songs that use it.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#1d1d1f',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#ff3b30',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const ParticleSettings: React.FC<ParticleSettingsProps> = ({ onClose, onSaved, initialSelectedParticleId = '' }) => {
  const [particles, setParticles] = useState<ParticleData[]>(particleListData.particles);
  const [selectedParticleId, setSelectedParticleId] = useState<string>(initialSelectedParticleId || '');
  const [editedParticle, setEditedParticle] = useState<ParticleData | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [activeView, setActiveView] = useState<'physics' | 'images'>('physics');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [particleImages, setParticleImages] = useState<{path: string, name: string}[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{index: number, name: string} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDeleteParticleModal, setShowDeleteParticleModal] = useState<boolean>(false);
  
  // Set initial selected particle when component loads
  useEffect(() => {
    if (initialSelectedParticleId) {
      setSelectedParticleId(initialSelectedParticleId);
    } else if (particles.length > 0 && !selectedParticleId) {
      setSelectedParticleId(particles[0].id);
    }
  }, [particles, selectedParticleId, initialSelectedParticleId]);
  
  // When selected particle changes, update the edited particle state
  useEffect(() => {
    if (selectedParticleId) {
      const particle = particles.find(p => p.id === selectedParticleId);
      if (particle) {
        setEditedParticle({ ...particle });
        
        // If in images view, load the particle images
        if (activeView === 'images') {
          loadParticleImages(particle);
        }
      }
    }
  }, [selectedParticleId, particles]);
  
  // When activeView changes to images, load the particle images
  useEffect(() => {
    if (activeView === 'images' && editedParticle) {
      loadParticleImages(editedParticle);
    }
  }, [activeView]);
  
  // Load images for the selected particle
  const loadParticleImages = async (particle: ParticleData) => {
    setIsLoading(true);
    setParticleImages([]); 
    
    try {
      console.log(`Loading images for ${particle.name} (${particle.dir})`);
      // Use electron IPC to get the actual image paths
      const result = await window.electron.ipcRenderer.invoke('get-particle-images', {
        particleDir: particle.dir,
        particleName: particle.name
      });
      
      if (result.success && Array.isArray(result.images)) {
        console.log(`Loaded ${result.images.length} images successfully`);
        setParticleImages(result.images);
      } else {
        console.error('Failed to load particle images:', result.error);
        
        // Generate placeholder images if real ones can't be loaded
        const placeholders = Array.from({ length: particle.count }, (_, i) => ({
          name: `${particle.name}${i + 1}.png`,
          path: `file://placeholder${i}.png` 
        }));
        
        setParticleImages(placeholders);
        setSaveStatus(`Note: Using placeholder images. ${result.error || 'Images directory not found.'}`);
        setTimeout(() => setSaveStatus(''), 5000);
      }
    } catch (error) {
      console.error('Error loading particle images:', error);
      const placeholders = Array.from({ length: particle.count }, (_, i) => ({
        name: `${particle.name}${i + 1}.png`,
        path: `file://placeholder${i}.png`
      }));
      setParticleImages(placeholders);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle changes to the form fields
  const handleInputChange = (field: keyof ParticleData, value: any) => {
    if (!editedParticle) return;
    
    // For numeric fields, convert to number and validate
    if (['weight', 'gravity', 'bounce', 'airResistance', 'lifespan'].includes(field)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      
      setEditedParticle({
        ...editedParticle,
        [field]: numValue
      });
    } else if (field === 'glow') {
      // Boolean toggle for glow
      setEditedParticle({
        ...editedParticle,
        glow: value
      });
    } else {
      // For other fields
      setEditedParticle({
        ...editedParticle,
        [field]: value
      });
    }
  };
  
  // Handle view switching with smooth transition
  const switchView = (view: 'physics' | 'images') => {
    if (view !== activeView) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveView(view);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 150);
    }
  };
  
  // Handle image click to show preview
  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };
  
  // Handle image delete click
  const handleDeleteClick = (e: React.MouseEvent, index: number, imageName: string) => {
    e.stopPropagation(); 
    setImageToDelete({ index, name: imageName });
  };
  
  // Confirm image deletion
  const confirmDeleteImage = async () => {
    if (!imageToDelete || !editedParticle) return;
    
    try {
      const result = await window.electron.ipcRenderer.invoke('delete-particle-image', {
        particleDir: editedParticle.dir,
        imageName: imageToDelete.name
      });
      
      if (result.success) {
        // Update the local state to remove the deleted image
        setParticleImages(currentImages => 
          currentImages.filter((_, index) => index !== imageToDelete.index)
        );
        
        // Update the particle count in the editedParticle
        const updatedCount = editedParticle.count - 1;
        const updatedParticle = { ...editedParticle, count: updatedCount };
        setEditedParticle(updatedParticle);
        
        // Update the global particles state
        setParticles(currentParticles => 
          currentParticles.map(p => 
            p.id === editedParticle.id ? updatedParticle : p
          )
        );
        
        // Show a success message
        setSaveStatus('Image deleted successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(`Error: ${result.error || 'Failed to delete image'}`);
        setTimeout(() => setSaveStatus(''), 5000);
      }
    } catch (error) {
      setSaveStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setTimeout(() => setSaveStatus(''), 5000);
    } finally {
      setImageToDelete(null);
    }
  };
  
  // Handle adding a new image
  const handleAddImage = async () => {
    if (!editedParticle) return;
    
    try {
      const result = await window.electron.ipcRenderer.invoke('add-particle-image', {
        particleDir: editedParticle.dir,
        particleName: editedParticle.name,
        currentCount: editedParticle.count
      });
      
      if (result.success) {
        // Reload the images
        loadParticleImages(editedParticle);
        
        // Update the particle count in the editedParticle
        const updatedCount = editedParticle.count + 1;
        const updatedParticle = { ...editedParticle, count: updatedCount };
        setEditedParticle(updatedParticle);
        
        // Update the global particles state
        setParticles(currentParticles => 
          currentParticles.map(p => 
            p.id === editedParticle.id ? updatedParticle : p
          )
        );
        
        // Show a success message
        setSaveStatus('Image added successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(`Error: ${result.error || 'Failed to add image'}`);
        setTimeout(() => setSaveStatus(''), 5000);
      }
    } catch (error) {
      setSaveStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };
  
  // Save changes to the particle settings
  const saveChanges = async () => {
    if (!editedParticle) return;
    
    try {
      setSaveStatus('Saving...');
      
      // Create updated particles array with the edited particle
      const updatedParticles = particles.map(p => 
        p.id === editedParticle.id ? editedParticle : p
      );
      
      // Update the particleList.json file via Electron IPC
      const result = await window.electron.ipcRenderer.invoke('update-particle-settings', {
        particles: updatedParticles
      });
      
      if (result.success) {
        setSaveStatus('Settings saved successfully!');
        setParticles(updatedParticles);
        
        // Notify parent component but don't close the modal
        // Add a delay to give time for the file to be written
        setTimeout(() => {
          onSaved();
        }, 500);
        
        // Clear status after a delay
        setTimeout(() => {
          setSaveStatus('');
        }, 3000);
      } else {
        setSaveStatus(`Error: ${result.error || 'Failed to save settings'}`);
        setTimeout(() => setSaveStatus(''), 5000);
      }
    } catch (error) {
      setSaveStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  // Handle deleting a particle
  const handleDeleteParticle = async () => {
    if (!editedParticle) return;
    
    try {
      setSaveStatus('Deleting particle...');
      
      // We need to remove this particle from the list
      const updatedParticles = particles.filter(p => p.id !== editedParticle.id);
      
      // Update the particleList.json file via Electron IPC
      const result = await window.electron.ipcRenderer.invoke('update-particle-settings', {
        particles: updatedParticles
      });
      
      if (result.success) {
        setSaveStatus('Particle deleted successfully!');
        setParticles(updatedParticles);
        
        // If we deleted the currently selected particle, select the first available one
        if (updatedParticles.length > 0) {
          setSelectedParticleId(updatedParticles[0].id);
        } else {
          setEditedParticle(null);
        }
        
        // Close the delete modal
        setShowDeleteParticleModal(false);
        
        // Notify parent component
        onSaved();
        
        // Clear status after a delay
        setTimeout(() => {
          setSaveStatus('');
        }, 3000);
      } else {
        setSaveStatus(`Error: ${result.error || 'Failed to delete particle'}`);
        setShowDeleteParticleModal(false);
      }
    } catch (error) {
      setSaveStatus(`Error: ${error.message || 'Unknown error occurred'}`);
      setShowDeleteParticleModal(false);
    }
  };

  // Handle clicking outside the modal to close it
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Render images for the selected particle
  const renderParticleImages = () => {
    if (!editedParticle) return null;
    
    return (
      <div style={{ padding: '10px 0' }}>
        <p style={{ 
          fontSize: '14px',
          color: '#86868b',
          margin: '0 0 16px 0',
        }}>
          This particle type has {editedParticle.count} image{editedParticle.count !== 1 ? 's' : ''}. 
          Images are located in assets/particles/{editedParticle.dir}/ directory.
        </p>
        
        {isLoading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '50px 0',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: '8px' 
          }}>
            <p style={{ color: '#86868b' }}>Loading images...</p>
          </div>
        ) : particleImages.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '20px',
            marginTop: '16px'
          }}>
            {particleImages.map((img, index) => (
              <div key={index} style={{
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '5px 5px 10px 5px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={() => handleImageClick(index)}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                {/* Delete button */}
                <button
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(255, 59, 48, 0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 5,
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                  }}
                  onClick={(e) => handleDeleteClick(e, index, img.name)}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                  <FaTrash size={12} />
                </button>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100px',
                  height: '100px',
                  backgroundColor: 'rgba(0, 0, 0, 0.03)',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  marginTop: '10px',
                  overflow: 'hidden',
                }}>
                  {/* Handle both valid and invalid image paths */}
                  <img 
                    src={img.path}
                    alt={img.name}
                    style={{
                      maxWidth: '90%',
                      maxHeight: '90%',
                      objectFit: 'contain',
                    }}
                    onError={(e) => {
                      // If image fails to load, show a placeholder
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.style.display = 'flex';
                        placeholder.style.alignItems = 'center';
                        placeholder.style.justifyContent = 'center';
                        placeholder.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 5px',
                }}>
                  {img.name}
                </div>
              </div>
            ))}
            
            {/* Add Image button */}
            <div 
              style={{
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 5px',
                border: '1px dashed rgba(0, 122, 255, 0.3)',
                cursor: 'pointer',
                height: '143px', // Match height of other items
                transition: 'background-color 0.2s',
              }}
              onClick={handleAddImage}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.15)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.1)'}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(0, 122, 255, 0.2)',
                borderRadius: '50%',
                marginBottom: '10px',
              }}>
                <FaPlus size={16} color="#007aff" />
              </div>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: 500,
                color: '#007aff',
                textAlign: 'center',
              }}>
                Add Image
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            borderRadius: '12px',
            padding: '30px 20px',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '15px',
            }}>
              <FaImage size={32} color="#aaa" />
            </div>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '15px',
              color: '#86868b',
            }}>
              No images found for this particle type.
            </p>
            <button
              onClick={handleAddImage}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#007aff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <FaPlus size={12} style={{ marginRight: '6px' }} />
              Add First Image
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={handleBackdropClick}
    >
      {/* Image Preview Modal */}
      {selectedImageIndex !== null && particleImages[selectedImageIndex] && (
        <ImagePreviewModal 
          imagePath={particleImages[selectedImageIndex].path} 
          onClose={() => setSelectedImageIndex(null)} 
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {imageToDelete && (
        <DeleteConfirmModal 
          fileName={imageToDelete.name}
          onConfirm={confirmDeleteImage}
          onCancel={() => setImageToDelete(null)}
        />
      )}
      
      {/* Delete Particle Confirmation Modal */}
      {showDeleteParticleModal && editedParticle && (
        <DeleteParticleModal
          particleName={editedParticle.name}
          onConfirm={handleDeleteParticle}
          onCancel={() => setShowDeleteParticleModal(false)}
        />
      )}
      
      <div 
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          width: '90%',
          maxWidth: '550px',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '24px',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: '#1d1d1f',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Particle Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#1d1d1f',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            aria-label="Close"
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
          >
            <FaTimes size={14} />
          </button>
        </div>
        
        {/* Particle Selection and Delete Button */}
        <div style={{ 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px'
        }}>
          <div style={{ flex: 1 }}>
            <label 
              htmlFor="particle-select" 
              style={{ 
                display: 'block', 
                marginBottom: '8px',
                fontWeight: 500,
                fontSize: '14px',
                color: '#1d1d1f',
              }}
            >
              Select Particle
            </label>
            <select
              id="particle-select"
              value={selectedParticleId}
              onChange={(e) => setSelectedParticleId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                fontSize: '14px',
                appearance: 'none',
                backgroundColor: 'white',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                backgroundSize: '16px',
              }}
            >
              {particles.map((particle) => (
                <option key={particle.id} value={particle.id}>
                  {particle.name} ({particle.id})
                </option>
              ))}
            </select>
          </div>
          
          {/* Delete Particle Button */}
          <button
            onClick={() => setShowDeleteParticleModal(true)}
            disabled={!editedParticle || particles.length <= 1} // Prevent deleting if there's only one particle
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: (!editedParticle || particles.length <= 1) ? 'rgba(255, 59, 48, 0.5)' : '#ff3b30',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 14px',
              cursor: (!editedParticle || particles.length <= 1) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.2s',
            }}
            title={particles.length <= 1 ? "Cannot delete the last particle" : "Delete this particle"}
          >
            <FaTrash size={14} />
          </button>
        </div>
        
        {/* Tabs Navigation */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          marginBottom: '16px' 
        }}>
          <div 
            onClick={() => switchView('physics')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: activeView === 'physics' ? 600 : 400,
              color: activeView === 'physics' ? '#007aff' : '#86868b',
              borderBottom: activeView === 'physics' ? '2px solid #007aff' : '2px solid transparent',
              transition: 'all 0.2s ease',
              fontSize: '15px',
              marginRight: '20px',
              userSelect: 'none',
            }}
          >
            Physics Properties
          </div>
          <div 
            onClick={() => switchView('images')}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: activeView === 'images' ? 600 : 400,
              color: activeView === 'images' ? '#007aff' : '#86868b',
              borderBottom: activeView === 'images' ? '2px solid #007aff' : '2px solid transparent',
              transition: 'all 0.2s ease',
              fontSize: '15px',
              userSelect: 'none',
            }}
          >
            Particle Images
          </div>
        </div>
        
        {/* Content Section with Transition */}
        <div style={{ 
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 0.15s ease-in-out',
        }}>
          {/* Particle Settings Form */}
          {editedParticle && (
            <>
              {activeView === 'physics' ? (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
                    gap: '40px',
                    marginBottom: '20px',
                    width: '95%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}>
                    {/* Weight */}
                    <div>
                      <label 
                        htmlFor="weight" 
                        style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontSize: '13px',
                          color: '#86868b',
                          fontWeight: 500,
                        }}
                      >
                        Weight
                      </label>
                      <input
                        id="weight"
                        type="number"
                        step="0.01"
                        value={editedParticle.weight}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                    </div>
                    
                    {/* Gravity */}
                    <div>
                      <label 
                        htmlFor="gravity" 
                        style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontSize: '13px',
                          color: '#86868b',
                          fontWeight: 500,
                        }}
                      >
                        Gravity
                      </label>
                      <input
                        id="gravity"
                        type="number"
                        step="0.01"
                        value={editedParticle.gravity}
                        onChange={(e) => handleInputChange('gravity', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                    </div>
                    
                    {/* Bounce */}
                    <div>
                      <label 
                        htmlFor="bounce" 
                        style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontSize: '13px',
                          color: '#86868b',
                          fontWeight: 500,
                        }}
                      >
                        Bounce
                      </label>
                      <input
                        id="bounce"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={editedParticle.bounce}
                        onChange={(e) => handleInputChange('bounce', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                    </div>
                    
                    {/* Air Resistance */}
                    <div>
                      <label 
                        htmlFor="airResistance" 
                        style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontSize: '13px',
                          color: '#86868b',
                          fontWeight: 500,
                        }}
                      >
                        Air Resistance
                      </label>
                      <input
                        id="airResistance"
                        type="number"
                        step="0.001"
                        min="0"
                        value={editedParticle.airResistance}
                        onChange={(e) => handleInputChange('airResistance', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                    </div>
                    
                    {/* Lifespan */}
                    <div style={{ gridColumn: '1 / span 2' }}>
                      <label 
                        htmlFor="lifespan" 
                        style={{ 
                          display: 'block', 
                          marginBottom: '6px', 
                          fontSize: '13px',
                          color: '#86868b',
                          fontWeight: 500,
                        }}
                      >
                        Lifespan (ms)
                      </label>
                      <input
                        id="lifespan"
                        type="number"
                        step="100"
                        min="0"
                        value={editedParticle.lifespan}
                        onChange={(e) => handleInputChange('lifespan', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Glow toggle */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '40px',
                        height: '22px',
                        backgroundColor: editedParticle.glow ? '#34c759' : '#e9e9eb',
                        borderRadius: '11px',
                        transition: 'background-color 0.2s',
                        marginRight: '12px',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '2px',
                          left: editedParticle.glow ? '20px' : '2px',
                          width: '18px',
                          height: '18px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'left 0.2s',
                        }}/>
                        <input
                          type="checkbox"
                          checked={editedParticle.glow}
                          onChange={(e) => handleInputChange('glow', e.target.checked)}
                          style={{ 
                            position: 'absolute',
                            opacity: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#1d1d1f',
                        fontWeight: 400,
                      }}>
                        Glow Effect
                      </span>
                    </label>
                  </div>

                </div>
              ) : (
                <div>
                  {renderParticleImages()}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Save button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '8px',
        }}>
          <div>
            {saveStatus && (
              <p style={{ 
                margin: 0, 
                color: saveStatus.includes('Error') ? '#ff3b30' : '#34c759',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'opacity 0.3s',
                opacity: saveStatus ? 1 : 0,
              }}>
                {saveStatus}
              </p>
            )}
          </div>
          <button
            onClick={saveChanges}
            disabled={!editedParticle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#007aff',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 18px',
              cursor: editedParticle ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background-color 0.2s, transform 0.1s',
              boxShadow: '0 2px 6px rgba(0, 122, 255, 0.3)',
            }}
            onMouseOver={e => {
              if (editedParticle) e.currentTarget.style.backgroundColor = '#0071e3';
            }}
            onMouseDown={e => {
              if (editedParticle) e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={e => {
              if (editedParticle) e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseOut={e => {
              if (editedParticle) {
                e.currentTarget.style.backgroundColor = '#007aff';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <FaSave style={{ marginRight: '6px' }} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticleSettings;
