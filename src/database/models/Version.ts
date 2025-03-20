import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config';

interface VersionModel extends Model {
  version: string;
}

export const Version = sequelize.define<VersionModel>('Version', {
  version: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

export const getCurrentVersion = async () => {
  await Version.sync();
  const version = await Version.findOne();
  return version ? version.version : null;
};

export const updateVersion = async (newVersion: string) => {
  await Version.sync();
  await Version.destroy({ where: {} });
  await Version.create({ version: newVersion });
};