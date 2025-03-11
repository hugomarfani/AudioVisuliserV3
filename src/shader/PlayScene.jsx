import { useLocation } from "react-router-dom";
import ShaderVisuals from "./ShaderVisuals";
import { useEffect, useState } from "react";

const PlayScene = () => {
  const location = useLocation();
  const [track, setTrack] = useState(null);

  let songDetail = location.state?.songDetails;
  console.log("songDetail is", songDetail);

  useEffect(() => {
    const loadTrack = async () => {
      // Parse the texture color string into an array of integers
      const convertColor = (color) => {
        let colorData = color
          .split(',')              // Split by comma
          .map(num => parseFloat(num/255));
        return colorData
      }

      setTrack({
        title: songDetail.title,
        artist: songDetail.uploader,
        albumArt: await findCompletePath(songDetail.jacket),
        background: await findCompletePath(songDetail.shaderBackground),
        audioPath: await findCompletePath(songDetail.audioPath),
        texture: await findCompletePath(songDetail.shaderTexture),
        textureColor: convertColor(String(songDetail.particleColour))
      });
      console.log('particleColour', String(songDetail.particleColour))
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
