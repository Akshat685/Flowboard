import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';
import { User } from '../modules/users/users.model.js';
import { Board } from '../modules/boards/boards.model.js';

let connecting;
let listenersBound = false;
let indexesReady = false;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (connecting) {
    await connecting;
    if (mongoose.connection.readyState === 1) return;
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
    const serverless = process.env.VERCEL === '1';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI, {
        serverSelectionTimeoutMS: serverless ? 8000 : 5000,
        socketTimeoutMS: 10000,
        bufferCommands: false,
        maxPoolSize: serverless ? 5 : 10,
      });
    } else {
      await mongoose.connection.asPromise();
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB disconnected');
    }
    // Re-running Model.init() after a drop/reconnect tries to createCollection
    // while the native client is still coming up.
    if (!indexesReady) {
      await Promise.all([User.init(), Board.init()]);
      indexesReady = true;
    }
  })();
  try {
    await connecting;
  } catch (error) {
    connecting = undefined;
    throw error;
  }
  connecting = undefined;
}

export async function disconnectDatabase() {
  connecting = undefined;
  await mongoose.disconnect();
}
