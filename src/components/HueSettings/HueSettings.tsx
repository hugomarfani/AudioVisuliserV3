import React from 'react';
import HueConfigModal from './HueConfigModal';

interface HueSettingsProps {
  onClose: () => void;
}

const HueSettings: React.FC<HueSettingsProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <HueConfigModal onClose={onClose} />
    </div>
  );
};

export default HueSettings;
