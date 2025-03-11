import React, { useEffect, useState } from "react";
import axios from "axios";

interface PlayerProps {
  accessToken: string;
  trackURI: string | null;
}

interface Device {
  id: string;
  name: string;
}

async function getDevices(accessToken: string): Promise<Device[]> {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me/player/devices", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.devices;
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

async function playTrack(accessToken: string, deviceId: string, trackURI: string) {
  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        uris: [trackURI]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Error playing track - Status:", error.response.status);
      console.error("Error data:", error.response.data);
    } else {
      console.error("Error playing track:", error);
    }
  }
}

async function pauseTrack(accessToken: string, deviceId: string) {
  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/pause`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  } catch (error) {
    console.error("Error pausing track:", error);
  }
}

function Player({ accessToken, trackURI }: PlayerProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  console.log("Player accessToken:", accessToken);

  useEffect(() => {
    if (accessToken) {
      getDevices(accessToken).then(setDevices);
    }
  }, [accessToken]);

  const handlePlay = () => {
    if (accessToken && selectedDevice && trackURI) {
      playTrack(accessToken, selectedDevice, trackURI);
    }
  };

  const handlePause = () => {
    if (accessToken && selectedDevice) {
      pauseTrack(accessToken, selectedDevice);
    }
  };

  return (
    <div>
      <select
        onChange={(e) => setSelectedDevice(e.target.value)}
        value={selectedDevice || ""}
      >
        <option value="" disabled>
          Select a device
        </option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
      <button onClick={handlePlay} disabled={!selectedDevice || !trackURI}>
        Play
      </button>
      <button onClick={handlePause} disabled={!selectedDevice}>
        Pause
      </button>
    </div>
  );
}

export default Player;
