import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
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
        return { success: true, deletedPath: imagePath };
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

  // Add new handler for shader images
  ipcMain.handle('save-shader-image', async (_, { songId, filePath, fileName, shaderType }) => {
    try {
      if (!songId || !filePath || !shaderType) {
        return { success: false, error: 'Invalid parameters' };
      }

      // Determine folder based on shader type
      const folderName = shaderType === 'background' ? 'background' : 'texture';
      
      // Create directory if it doesn't exist
      const outputDir = getResourcePath('assets', 'shader', folderName);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Get file extension
      const ext = path.extname(fileName).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png'];
      
      if (!validExtensions.includes(ext)) {
        return { 
          success: false, 
          error: 'Invalid file format. Please use JPG, JPEG or PNG.' 
        };
      }

      // Using .jpg for all shader images for consistency
      const outputFileName = `${songId}.jpg`;
      const outputPath = path.join(outputDir, outputFileName);
      
      // Copy the file
      fs.copyFileSync(filePath, outputPath);
      
      const relativePath = `shader/${folderName}/${outputFileName}`;

      // Update song in database with new image path
      const song = await Song.findByPk(songId);
      if (song) {
        if (shaderType === 'background') {
          await song.update({ shaderBackground: relativePath });
        } else {
          await song.update({ shaderTexture: relativePath });
        }
        
        // Save the updated song as JSON
        saveSongAsJson(song);
      }

      return { 
        success: true, 
        savedPath: relativePath 
      };
    } catch (error) {
      console.error('Error saving shader image:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to save shader image' 
      };
    }
  });
};