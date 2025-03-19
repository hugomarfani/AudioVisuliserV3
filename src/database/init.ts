import { db, dbAsync, sequelize } from './config';
import fs from 'fs';
import path from 'path';
import { Song } from './models/Song';
import { app } from 'electron';

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
    // Initialise tables
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `;

    await dbAsync.run(createUsersTable);

    await sequelize.sync({ force: true });
    console.log('Database synced successfully');

    // Read in json files from assets/songData
    const songDataDir = path.join(app.getAppPath(), 'resources', 'assets', 'songData');
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
