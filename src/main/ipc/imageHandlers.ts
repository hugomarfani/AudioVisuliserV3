import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Song, saveSongAsJson } from '../../database/models/Song';
import { getResourcePath } from '../paths';

export const registerImageHandlers = () => {
  // Handler for saving uploaded images
  ipcMain.handle('save-image', async (event, { songId, filePath, fileName }) => {
    try {
      console.log('Saving image:', songId, filePath, fileName);
      // Create directory for song images if it doesn't exist
      // const imagesDir = path.join(app.getAppPath(), 'assets', 'images', songId);
      const imagesDir = path.join(getResourcePath('assets', 'images', songId));
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
      const relativePath = path.join('images', songId, newFileName).replace(/\\/g, '/');
      
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

  // Handler for deleting images
  ipcMain.handle('delete-image', async (event, { songId, imagePath }) => {
    try {
      console.log('Deleting image:', songId, imagePath);
      
      // Get the full path of the image
      const fullPath = getResourcePath('assets', imagePath);
      
      // Check if file exists
      if (fs.existsSync(fullPath)) {
        // Delete the file
        fs.unlinkSync(fullPath);
        
        // Get the song and update its images list
        const song = await Song.findByPk(songId);
        if (song) {
          const currentImages = song.dataValues.images || [];
          const updatedImages = currentImages.filter(img => img !== imagePath);
          
          // Update song in database
          await Song.update({ images: updatedImages }, {
            where: { id: songId }
          });
          
          // Update the JSON file
          await saveSongAsJson(await Song.findByPk(songId));
          
          return { success: true };
        }
        return { success: false, error: 'Song not found' };
      } else {
        return { success: false, error: 'Image file not found' };
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to delete image' 
      };
    }
  });

  // Handler for updating a song
  ipcMain.handle('update-song', async (event, songData) => {
    console.log('Updating song:', songData);
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
    console.log('Saving song as JSON:', songData);
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