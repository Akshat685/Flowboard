import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { authenticationLimiter } from '../../middleware/rateLimit.middleware.js';
import { authController } from './auth.controller.js';
export function authRoutes(io) {
  const router = Router();
  const controller = authController(io);
  const limiter = authenticationLimiter();
  router.post('/register', limiter, controller.register);
  router.post('/login', limiter, controller.login);
  router.get('/me', requireAuth, controller.me);
  router.post('/logout', requireAuth, controller.logout);
  return router;
}
