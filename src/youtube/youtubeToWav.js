
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');
const { mainPaths, getResourcePath} = require('../main/paths');

const ffmpegPath = mainPaths.ffmpegPath;
const ffprobePath = mainPaths.ffprobePath;

process.env.YOUTUBE_DL_DIR = "./resources";

const ytdlp = require('yt-dlp-exec');

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

const downloadYoutubeAudio = async (url, onlyMp3) => {
  const downloadsPath = getResourcePath('assets', 'audio');

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
  console.log('Downloading audio from:', url);

  try {
    // Download audio
    await ytdlp(url, {
      format: 'bestaudio',
      output: tempFile,
      'no-check-certificates': true,
      'prefer-free-formats': true,
    });

    await saveAudio(tempFile, outputFile, mp3OutputFile, onlyMp3);




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

const saveAudio = async (tempFile, outputFile, mp3OutputFile, onlyMp3) => {
  console.log('Converting audio to WAV and MP3...');
 // Convert directly to 16kHz WAV
 if (!onlyMp3) {
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
  }

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

  // Clean up the temporary file
  if (tempFile.slice(-3) === 'm4a') {
    fs.unlinkSync(tempFile);
  }
}


const getYoutubeMetadata = async (url) => {
  try {
    const metadata = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      verbose: true,
    });
    console.log('Metadata:', metadata);
    const title = metadata.title;
    const artist = metadata.uploader;
    const thumbnailUrl = metadata.thumbnail; // Get the thumbnail URL
    
    // Extract video ID from the URL
    const videoId = url.match(/(v=)([^&]*)/)[2];
    
    // Create directory for the thumbnail
    const thumbnailDir = getResourcePath('assets', 'images', videoId);
    const thumbnailPath = path.join(thumbnailDir, 'jacket.png');
    
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    
    // Download the thumbnail
    await new Promise((resolve, reject) => {
      https.get(thumbnailUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download thumbnail: ${response.statusCode}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(thumbnailPath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlinkSync(thumbnailPath);
          reject(err);
        });
      }).on('error', reject);
    });

    console.log('Title:', title);
    console.log('Artist:', artist);
    console.log('Thumbnail saved to:', thumbnailPath);

    // Return the relative path to be stored in the database
    return { 
      title, 
      artist, 
      thumbnailPath: `images/${videoId}/jacket.png` 
    };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    throw error;
  }
};

module.exports = { downloadYoutubeAudio, getYoutubeMetadata, saveAudio };
