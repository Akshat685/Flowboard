import { Router } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { boardRoutes } from '../modules/boards/boards.routes.js';

const startTime = Date.now();
const nodeVersion = process.version;

export function apiRoutes(io) {
  const router = Router();

  // Liveness probe — always returns 200 if the process is running
  router.get('/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      success: true,
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      node: nodeVersion,
      memory: {
        rss: Math.round(mem.rss / 1_048_576),
        heapUsed: Math.round(mem.heapUsed / 1_048_576),
        heapTotal: Math.round(mem.heapTotal / 1_048_576),
      },
    });
  });

  // Readiness probe — checks database connectivity and latency
  router.get('/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('Disconnected');
      const start = performance.now();
      await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 1500 });
      const latencyMs = Math.round(performance.now() - start);
      res.json({ success: true, status: 'ready', dbLatencyMs: latencyMs });
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
