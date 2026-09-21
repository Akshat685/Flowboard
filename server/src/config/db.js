import mongoose from 'mongoose';
import { config } from './env.js';
import { User } from '../modules/users/users.model.js';
import { Board } from '../modules/boards/boards.model.js';
export async function connectDatabase() {
  mongoose.set('maxTimeMS', 5000);
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    bufferCommands: false,
  });
  // Indexes, including unique email, must be ready before accepting traffic.
  await Promise.all([User.init(), Board.init()]);
}
export async function disconnectDatabase() {
  await mongoose.disconnect();
}
