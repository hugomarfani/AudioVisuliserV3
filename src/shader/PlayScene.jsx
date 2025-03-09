import { useLocation } from "react-router-dom";
import ShaderVisuals from "./ShaderVisuals";
import { useEffect, useState } from "react";

const PlayScene = () => {
  const location = useLocation();
  const [track, setTrack] = useState(null);

  let songDetail = location.state?.songDetails;
  console.log(songDetail);

  useEffect(() => {
    const loadTrack = async () => {
      // Parse the texture color string into an array of integers
      const textureColorStr = '[255,255,255]';
      const textureColor = textureColorStr
        .replace(/[\[\]]/g, '')  // Remove brackets
        .split(',')              // Split by comma
        .map(num => parseInt(num, 10)); // Convert to integers

      setTrack({
        title: songDetail.title,
        artist: songDetail.uploader,
        albumArt: await findCompletePath(songDetail.jacket),
        // background: await findCompletePath(songDetail.shaderBackground),
        background: await findCompletePath(`shader/background/${songDetail.id}.jpg`),
        audioPath: await findCompletePath(songDetail.audioPath),
        texture: await findCompletePath(songDetail.shaderTexture),
        texture: await findCompletePath(`shader/texture/${songDetail.id}.jpg`),
        // texture: await findCompletePath(`icon.png`),
        textureColor: textureColor
      });
      console.log('set track', track);
    };

    if (songDetail) {
      loadTrack();
    }
  }, [songDetail]);

  const findCompletePath = async (path) => {
    const response = await window.electron.fileSystem.mergeAssetPath(path);
    return response;
  };

  return (
    <>
      {track && <ShaderVisuals track={track} />}
    </>
  );
};

export default PlayScene;
