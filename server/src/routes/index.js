import { Router } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { boardRoutes } from '../modules/boards/boards.routes.js';

const startTime = Date.now();

export function apiRoutes(io) {
  const router = Router();

  // Liveness probe — always returns 200 if the process is running
  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
  });

  // Readiness probe — checks database connectivity
  router.get('/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('Disconnected');
      await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 1500 });
      res.json({ success: true, status: 'ready' });
    } catch {
      res.status(503).json({ success: false, status: 'unavailable' });
    }
  });

  // Database guard — rejects requests when DB is disconnected
  router.use((_req, _res, next) => {
    next(
      mongoose.connection.readyState === 1
        ? undefined
        : new AppError(503, 'Database temporarily unavailable. Please retry shortly.'),
    );
  });

  router.use('/auth', authRoutes(io));
  router.use('/boards', boardRoutes(io));
  return router;
}
