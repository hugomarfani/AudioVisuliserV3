import React, { useState, useEffect } from 'react';
import HueService from '../utils/HueService';

interface HueSetupProps {
  onSetupComplete?: () => void;
}

const HueSetup: React.FC<HueSetupProps> = ({ onSetupComplete }) => {
  const [bridges, setBridges] = useState<any[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<string>('');
  const [registrationStatus, setRegistrationStatus] = useState<string>('');
  const [entertainmentGroups, setEntertainmentGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [setupComplete, setSetupComplete] = useState<boolean>(HueService.hasValidConfig());

  // Discover bridges
  const discoverBridges = async () => {
    setIsLoading(true);
    try {
      const discoveredBridges = await HueService.discoverBridges();
      setBridges(discoveredBridges);
      if (discoveredBridges.length === 1) {
        setSelectedBridge(discoveredBridges[0].ip);
      }
    } catch (error) {
      console.error('Error discovering bridges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Register with selected bridge
  const registerBridge = async () => {
    if (!selectedBridge) return;

    setIsLoading(true);
    setRegistrationStatus('Press the link button on your Hue Bridge, then click Register');

    try {
      await HueService.registerBridge(selectedBridge);
      setRegistrationStatus('Registration successful! Fetching entertainment groups...');
      await fetchEntertainmentGroups();
      setSetupComplete(true);
      if (onSetupComplete) onSetupComplete();
    } catch (error) {
      setRegistrationStatus(`Registration failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch entertainment groups
  const fetchEntertainmentGroups = async () => {
    try {
      const groups = await HueService.getEntertainmentGroups();
      setEntertainmentGroups(groups);
      if (groups.length > 0) {
        setSelectedGroup(groups[0].id);
      }
    } catch (error) {
      console.error('Error fetching entertainment groups:', error);
    }
  };

  // Save selected entertainment group
  const saveSelectedGroup = () => {
    if (selectedGroup) {
      HueService.setEntertainmentGroupId(selectedGroup);
      setSetupComplete(true);
      if (onSetupComplete) onSetupComplete();
    }
  };

  // Check if we already have a valid config on component mount
  useEffect(() => {
    if (HueService.hasValidConfig()) {
      fetchEntertainmentGroups();
    } else {
      discoverBridges();
    }
  }, []);

  if (setupComplete) {
    return (
      <div className="hue-setup">
        <h3>Phillips Hue Setup Complete</h3>
        <button onClick={() => setSetupComplete(false)}>Reconfigure</button>
      </div>
    );
  }

  return (
    <div className="hue-setup">
      <h3>Phillips Hue Setup</h3>

      {/* Bridge Discovery */}
      <div className="setup-section">
        <h4>Step 1: Discover Hue Bridges</h4>
        <button onClick={discoverBridges} disabled={isLoading}>
          {isLoading ? 'Discovering...' : 'Discover Bridges'}
        </button>

        {bridges.length > 0 && (
          <div className="bridge-selection">
            <select
              value={selectedBridge}
              onChange={(e) => setSelectedBridge(e.target.value)}
            >
              <option value="">Select a bridge</option>
              {bridges.map((bridge, index) => (
                <option key={index} value={bridge.ip}>
                  {bridge.ip} ({bridge.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bridge Registration */}
      {selectedBridge && (
        <div className="setup-section">
          <h4>Step 2: Register with Bridge</h4>
          <p>Press the link button on your Hue Bridge, then click Register</p>
          <button onClick={registerBridge} disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register'}
          </button>
          {registrationStatus && <p>{registrationStatus}</p>}
        </div>
      )}

      {/* Entertainment Group Selection */}
      {entertainmentGroups.length > 0 && (
        <div className="setup-section">
          <h4>Step 3: Select Entertainment Group</h4>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">Select a group</option>
            {entertainmentGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button onClick={saveSelectedGroup} disabled={!selectedGroup}>
            Save and Complete Setup
          </button>
        </div>
      )}
    </div>
  );
};

export default HueSetup;
