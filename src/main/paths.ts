const path = require('path');
const { app } = require('electron');

function getResourcePath(...subPath: string[]): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, ...subPath);
    } else {
        return path.join(app.getAppPath(),"resources", ...subPath);
    }
}

const mainPaths = {
    llmWhisperPath: getResourcePath('cppVer.exe'),
    SDPath: getResourcePath('SD.exe'),
    ps1Path: getResourcePath('AiResources', 'openvino_2025', 'setupvars.ps1'),
    ffmpegPath: getResourcePath('ffmpeg', 'bin', 'ffmpeg.exe'),
    ffprobePath: getResourcePath('ffmpeg', 'bin', 'ffprobe.exe'),
}

// export mainPaths and getResourcePath
export { mainPaths, getResourcePath };