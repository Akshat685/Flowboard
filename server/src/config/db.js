import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';
import { User } from '../modules/users/users.model.js';
import { Board } from '../modules/boards/boards.model.js';

let connecting;
let listenersBound = false;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (connecting) {
    await connecting;
    return;
  }
  connecting = (async () => {
    mongoose.set('maxTimeMS', 5000);
    if (!listenersBound) {
      listenersBound = true;
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB connected');
      });
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });
      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { message: error.message });
      });
    }
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      bufferCommands: false,
    });
    await Promise.all([User.init(), Board.init()]);
  })();
  try {
    await connecting;
  } catch (error) {
    connecting = undefined;
    throw error;
  }
}

export async function disconnectDatabase() {
  connecting = undefined;
  await mongoose.disconnect();
}
