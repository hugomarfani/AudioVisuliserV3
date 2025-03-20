import { db, dbAsync, sequelize } from './config';
import fs from 'fs';
import path from 'path';
import { Song } from './models/Song';
import { app } from 'electron';
import { getResourcePath } from '../main/paths';
import { Version, getCurrentVersion, updateVersion } from './models/Version';

const DB_VERSION = '2.1';

const initDatabase = async () => {
  console.log('🔄 Starting database initialization...');

  // Create all required directories
  const dirs = ['audios', 'images', 'models'];
  dirs.forEach((dir) => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  try {
    // Create the Version table if it doesn't exist
    await Version.sync();
    
    // Get current version
    const currentVersion = await getCurrentVersion();
    
    if (!currentVersion) {
      // First time setup
      console.log('First time database setup');
      await sequelize.sync({ force: true });
      await updateVersion(DB_VERSION);
      
      // Add sample data
      const songDataDir = getResourcePath('assets', 'songData');
      const songFiles = fs
        .readdirSync(songDataDir)
        .filter((file) => file.endsWith('.json'));
      console.log(songDataDir)
      const sampleSongs = songFiles.map((file) => {
        const filePath = path.join(songDataDir, file);
        const songData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return songData;
      });

      const createdSongs = await Song.bulkCreate(sampleSongs);
    }
    else if (currentVersion !== DB_VERSION) {
      // Schema update needed
      console.log(`Updating database from ${currentVersion} to ${DB_VERSION}`);
      await sequelize.sync({ alter: true });
      await updateVersion(DB_VERSION);
    }
    else {
      // No changes needed
      console.log('Database schema is up to date');
    }

    const songs = await Song.findAll();

    console.log('✅ Sample songs added successfully');
    console.log('✅ Database tables created successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

export default initDatabase;
