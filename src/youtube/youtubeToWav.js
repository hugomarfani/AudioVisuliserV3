const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { mainPaths} = require('../main/paths');

const ffmpegPath = mainPaths.ffmpegPath;
const ffprobePath = mainPaths.ffprobePath;


// Verify FFmpeg files exist
if (!fs.existsSync(ffmpegPath)) {
  console.log(`FFmpeg not found at: ${ffmpegPath}`);
  throw new Error(`FFmpeg not found at: ${ffmpegPath}`);
}

if (!fs.existsSync(ffprobePath)) {
  console.log(`FFprobe not found at: ${ffprobePath}`);
  throw new Error(`FFprobe not found at: ${ffprobePath}`);
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const downloadYoutubeAudio = async (url) => {
  const downloadsPath = path.join(app.getAppPath(), 'assets', 'audio');

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  // use regex to obtain the video id
  // start at (v=) and end at (& or the end of the string)
  const videoId = url.match(/(v=)([^&]*)/)[2];
  // const timestamp = new Date().getTime();
  const tempFile = path.join(downloadsPath, `temp_${videoId}.m4a`);
  const outputFile = path.join(downloadsPath, `${videoId}.wav`);
  const mp3OutputFile = path.join(downloadsPath, `${videoId}.mp3`);

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

    // Convert to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
      .audioBitrate('320k')
      .toFormat('mp3')
      .on('error', (err) => {
        reject(new Error(`FFmpeg conversion error: ${err.message}`));
      })
      .on('end', resolve)
      .save(mp3OutputFile);
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

const getYoutubeMetadata = async (url) => {
  try {
    const metadata = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      verbose: true,
    });

    const title = metadata.title;
    const artist = metadata.uploader;
    // console.log('Metadata:', metadata);

    console.log('Title:', title);
    console.log('Artist:', artist);

    return { title, artist };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    throw error;
  }
};

module.exports = { downloadYoutubeAudio, getYoutubeMetadata };
