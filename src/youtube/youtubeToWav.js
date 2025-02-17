const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const ffmpegPath = path.join(
  __dirname,
  '..',
  '..',
  '.erb',
  'bin',
  'ffmpeg',
  'bin',
  'ffmpeg.exe',
);
const ffprobePath = path.join(
  __dirname,
  '..',
  '..',
  '.erb',
  'bin',
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
  const downloadsPath = path.join(__dirname, 'downloads');

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  const timestamp = new Date().getTime();
  const tempFile = path.join(downloadsPath, `temp_${timestamp}.m4a`);
  const outputFile = path.join(downloadsPath, `youtube_${timestamp}.wav`);

  try {
    // Download audio
    await ytdlp(url, {
      format: 'bestaudio',
      output: tempFile,
      noCheckCertificates: true,
      preferFreeFormats: true,
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

    return outputFile;
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
