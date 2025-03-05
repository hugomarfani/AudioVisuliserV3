import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Song, saveSongAsJson } from '../../database/models/Song';

export const registerImageHandlers = () => {
  // Handler for saving uploaded images
  ipcMain.handle('save-image', async (event, { songId, filePath, fileName }) => {
    try {
      // Create directory for song images if it doesn't exist
      const imagesDir = path.join(app.getAppPath(), 'assets', 'images', songId);
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Get file extension
      const fileExt = path.extname(fileName);
      const timestamp = new Date().getTime();
      const newFileName = `image_${timestamp}${fileExt}`;
      const savedPath = path.join(imagesDir, newFileName);
      
      // Copy the file to the destination
      fs.copyFileSync(filePath, savedPath);
      
      // Return the relative path to store in the database
      const relativePath = path.join('assets', 'images', songId, newFileName).replace(/\\/g, '/');
      
      return { 
        success: true, 
        savedPath: relativePath 
      };
    } catch (error) {
      console.error('Error saving image:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to save image' 
      };
    }
  });

  // Handler for updating a song
  ipcMain.handle('update-song', async (event, songData) => {
    try {
      await Song.update(songData, {
        where: { id: songData.id }
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating song:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for saving song as JSON
  ipcMain.handle('save-song-as-json', async (event, songData) => {
    try {
      const song = await Song.findByPk(songData.id);
      if (song) {
        await saveSongAsJson(song);
        return { success: true };
      }
      return { success: false, error: 'Song not found' };
    } catch (error) {
      console.error('Error saving song as JSON:', error);
      return { success: false, error: error.message };
    }
  });
};