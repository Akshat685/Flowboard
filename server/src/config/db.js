import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';
import { User } from '../modules/users/users.model.js';
import { Board } from '../modules/boards/boards.model.js';

export async function connectDatabase() {
  mongoose.set('maxTimeMS', 5000);

  // Connection monitoring — critical for production observability
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
