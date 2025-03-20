import sqlite3 from 'sqlite3';
import { Sequelize } from 'sequelize';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
console.log('Database path:', dbPath);

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  dialectModule: require('sqlite3'),
  // below only for debugging purposes
  logging: console.log, 
  define: {
    timestamps: true 
  }
});

// testing stuff
sequelize.authenticate()
  .then(() => {
    console.log('✅ Sequelize connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });

// just for debugging stuff
sqlite3.verbose();

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database opening error: ', err);
  } else {
    console.log('✅ Database connected successfully at:', dbPath);
    db.run('PRAGMA foreign_keys = ON');
  }
});

export const dbAsync = {
  run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },

  get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};
