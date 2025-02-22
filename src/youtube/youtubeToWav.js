const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const ffmpegPath = path.join(
  app.getAppPath(),
  'external',
  'ffmpeg',
  'bin',
  'ffmpeg.exe',
);
const ffprobePath = path.join(
  app.getAppPath(),
  'external',
  'ffmpeg',
  'bin',
  'ffprobe.exe',
);

// Verify FFmpeg files exist
if (!fs.existsSync(ffmpegPath)) {
  throw new Error(`FFmpeg not found at: ${ffmpegPath}`);
}

if (!fs.existsSync(ffprobePath)) {
  throw new Error(`FFprobe not found at: ${ffprobePath}`);
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const downloadYoutubeAudio = async (url) => {
  const downloadsPath = path.join(app.getAppPath(), 'AiResources', 'wav');

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  // use regex to obtain the video id
  // start at (v=) and end at (& or the end of the string)
  const videoId = url.match(/(v=)([^&]*)/)[2];
  // const timestamp = new Date().getTime();
  const tempFile = path.join(downloadsPath, `temp_${videoId}.m4a`);
  const outputFile = path.join(downloadsPath, `${videoId}.wav`);

  try {
    // Download audio
    await ytdlp(url, {
      format: 'bestaudio',
      output: tempFile,
      'no-check-certificates': true,
      'prefer-free-formats': true,
    });

    // Convert directly to 16kHz WAV
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .audioFrequency(16000)
        .toFormat('wav')
        .on('error', (err) => {
          reject(new Error(`FFmpeg conversion error: ${err.message}`));
        })
        .on('end', resolve)
        .save(outputFile);
    });

    // Cleanup temp file
    fs.unlinkSync(tempFile);

    return videoId;
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
    throw error;
  }
};

module.exports = { downloadYoutubeAudio };
