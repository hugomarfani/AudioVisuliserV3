import React, { useState } from 'react';
import colors from '../../theme/colors';

interface DeleteSongButtonProps {
  songId: string;
  songTitle: string;
  onSuccess: () => void;
}

const DeleteSongButton: React.FC<DeleteSongButtonProps> = ({ songId, songTitle, onSuccess }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    setShowConfirmation(true);
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const result = await window.electron.ipcRenderer.invoke('delete-song', songId);

      if (result.success) {
        setIsDeleting(false);
        setShowConfirmation(false);
        onSuccess();
      } else {
        setIsDeleting(false);
        setError(result.error || 'Failed to delete the song');
      }
    } catch (err) {
      setIsDeleting(false);
      setError(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (showConfirmation) {
    return (
      <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
        <div style={{
          backgroundColor: colors.grey5,
          padding: '1.5rem',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: colors.red }}>
            Delete "{songTitle}"?
          </h3>
          <p style={{ fontSize: '0.9rem', color: colors.grey1, marginBottom: '1.5rem' }}>
            This will permanently delete this song and all associated files. This action cannot be undone.
          </p>

          {error && (
            <p style={{ color: colors.red, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: colors.white,
                color: colors.primary,
                border: `1px solid ${colors.grey3}`,
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                minWidth: '100px',
              }}
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </button>

            <button
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: colors.red,
                color: colors.white,
                border: 'none',
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                minWidth: '100px',
              }}
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem', borderTop: `1px solid ${colors.grey4}`, paddingTop: '1rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: colors.red }}>
        Delete Song
      </h3>
      <p style={{ fontSize: '0.9rem', color: colors.grey2, marginBottom: '1rem' }}>
        Remove this song and all related files from the system.
      </p>
      <button
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: colors.red,
          color: colors.white,
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
        onClick={handleDeleteClick}
      >
        Delete Song
      </button>
    </div>
  );
};

export default DeleteSongButton;
