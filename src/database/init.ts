import { db, dbAsync, sequelize } from './config';
import fs from 'fs';
import path from 'path';
import { Song } from './models/Song';
import { app } from 'electron';
import { getResourcePath } from '../main/paths';

const DB_VERSION = '2.1';

const initDatabase = async () => {
  console.log('🔄 Starting database initialization...');

  // Create all required directories
  const dirs = ['audios', 'images', 'models'];
  dirs.forEach((dir) => {
    // const dirPath = path.join(__dirname, dir);
    const dirPath = path.join(app.getPath('userData'), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  try {
    await sequelize.sync({ force: true });
    

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
