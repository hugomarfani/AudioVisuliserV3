import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { sequelize } from '../config';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface SongModel
  extends Model<
    InferAttributes<SongModel>,
    InferCreationAttributes<SongModel>
  > {
  id: CreationOptional<string>;
  title: string;
  uploader: string;
  audioPath: string;
  jacket: string;
  images: string[];
  moods: string[];
  status: string;
  colours: string[];
  colours_reason: string[];
  objects: string[];
  object_prompts: string[];
  particles: string[];
  backgrounds: string[];
  background_prompts: string[];
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const Song = sequelize.define<SongModel>('Song', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  uploader: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  audioPath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  jacket: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Blue',
  },
  moods: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  colours: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  colours_reason: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  objects: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  object_prompts: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  particles: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  backgrounds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  background_prompts: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

// Songs are loaded in the init.ts file using the Song.bulkCreate method

// Function to save a Song instance as a JSON file
const saveSongAsJson = async (song: SongModel) => {
  const songData = {
    id: song.id,
    title: song.title,
    uploader: song.uploader,
    audioPath: song.audioPath,
    jacket: song.jacket,
    images: song.images,
    moods: song.moods,
    status: song.status,
    colours: song.colours,
    colours_reason: song.colours_reason,
    objects: song.objects,
    object_prompts: song.object_prompts,
    particles: song.particles,
    backgrounds: song.backgrounds,
    background_prompts: song.background_prompts,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };

  const songDataDir = path.join(app.getAppPath(), 'assets', 'songData');
  if (!fs.existsSync(songDataDir)) {
    fs.mkdirSync(songDataDir, { recursive: true });
  }

  const filePath = path.join(songDataDir, `${song.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(songData, null, 2));
  console.log(`Song saved as JSON file: ${filePath}`);
};

export { SongModel, Song, saveSongAsJson };
