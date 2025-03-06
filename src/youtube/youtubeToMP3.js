// ======= FILE DEPRECATED =======


// ======= FILE DEPRECATED =======

// This file is deprecated and should not be used. It is kept here for reference only.
// The file contains the original implementation of the YouTube to MP3 conversion, which was later replaced with a more robust solution using the `yt-dlp-exec` and `fluent-ffmpeg` libraries.
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
// Remove app import since we're using a fixed path
const { app } = require('electron');

// Set FFmpeg paths - make sure to point to the complete FFmpeg installation
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

console.log('FFmpeg path:', ffmpegPath);
console.log('FFprobe path:', ffprobePath);

// Verify FFmpeg files exist
if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg not found at:', ffmpegPath);
  throw new Error('FFmpeg executable not found');
}

if (!fs.existsSync(ffprobePath)) {
  console.error('FFprobe not found at:', ffprobePath);
  throw new Error('FFprobe executable not found');
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const downloadYoutubeAudio = async (url) => {
  // Set downloads folder to a fixed location in the project
  const downloadsPath = path.join(app.getAppPath(), 'external', 'mp3');

  console.log('Downloads path:', downloadsPath);

  try {
    // Ensure downloads directory exists
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    const timestamp = new Date().getTime();
    const tempFile = path.join(downloadsPath, `temp_${timestamp}.m4a`);
    const outputFile = path.join(downloadsPath, `youtube_${timestamp}.mp3`);

    console.log('Temp file path:', tempFile);
    console.log('Output file path:', outputFile);

    // Download audio with corrected options
    await ytdlp(url, {
      format: 'bestaudio',
      output: tempFile,
      noCheckCertificates: true,
      preferFreeFormats: true,
      verbose: true,
      // Removed the invalid binPath option
    });

    // Convert to MP3 with more detailed error handling
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .audioCodec('libmp3lame')
        .audioBitrate(192)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('error', (err) => {
          console.error('FFmpeg detailed error:', err);
          console.error('FFmpeg error message:', err.message);
          reject(err);
        })
        .on('end', () => {
          console.log('FFmpeg finished');
          resolve();
        })
        .save(outputFile);
    });

    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

    console.log('Conversion successful:', outputFile);
    return outputFile;
  } catch (error) {
    console.error('Detailed error:', error);
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    throw error;
  }
};

const downloadYoutubeAudioWav = async (url) => {
  const downloadsPath = path.join(__dirname, 'downloads');

  console.log('Downloads path:', downloadsPath);

  try {
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    const timestamp = new Date().getTime();
    const tempFile = path.join(downloadsPath, `temp_${timestamp}.m4a`);
    const tempMp3File = path.join(downloadsPath, `temp_mp3_${timestamp}.mp3`);
    const outputFile = path.join(downloadsPath, `youtube_${timestamp}.wav`);

    // Download audio
    await ytdlp(url, {
      format: 'bestaudio',
      output: tempFile,
      noCheckCertificates: true,
      preferFreeFormats: true,
      verbose: true,
    });

    // Convert to MP3 first
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .audioCodec('libmp3lame')
        .audioBitrate(192)
        .on('error', (err) => {
          console.error('FFmpeg MP3 conversion error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('MP3 conversion finished');
          resolve();
        })
        .save(tempMp3File);
    });

    // Convert MP3 to WAV with 16kHz
    await new Promise((resolve, reject) => {
      ffmpeg(tempMp3File)
        .audioFrequency(16000)
        .toFormat('wav')
        .on('error', (err) => {
          console.error('FFmpeg WAV conversion error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('WAV conversion finished');
          resolve();
        })
        .save(outputFile);
    });

    // Cleanup temporary files
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    if (fs.existsSync(tempMp3File)) {
      fs.unlinkSync(tempMp3File);
    }

    console.log('Conversion successful:', outputFile);
    return outputFile;
  } catch (error) {
    console.error('Detailed error:', error);
    throw error;
  }
};

module.exports = {
  downloadYoutubeAudio,
  downloadYoutubeAudioWav,
};
