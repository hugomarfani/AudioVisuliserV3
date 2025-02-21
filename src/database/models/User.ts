import { dbAsync } from '../config';

export interface User {
  id?: number;
  name: string;
}

export const UserDB = {
  create: async (user: User) => {
    const query = 'INSERT INTO users (name) VALUES (?)';
    return dbAsync.run(query, [user.name]);
  },

  getAll: async () => {
    const query = 'SELECT * FROM users';
    return dbAsync.all(query);
  },

  getById: async (id: number) => {
    const query = 'SELECT * FROM users WHERE id = ?';
    return dbAsync.get(query, [id]);
  },

  update: async (user: User) => {
    const query = 'UPDATE users SET name = ? WHERE id = ?';
    return dbAsync.run(query, [user.name, user.id]);
  },

  delete: async (id: number) => {
    const query = 'DELETE FROM users WHERE id = ?';
    return dbAsync.run(query, [id]);
  }
};
