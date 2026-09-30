import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import hpp from 'hpp';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import { authenticate } from './middleware/auth.middleware.js';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import { apiRoutes } from './routes/index.js';
import { mountClient } from './middleware/client.middleware.js';

/**
 * Recursively strip keys starting with $ or containing . from an object.
 * Prevents NoSQL injection via req.body (Express 5 compatible — does not touch req.query).
 */
function sanitize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = sanitize(val);
  }
  return clean;
}

function vercelOrigins() {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .filter(Boolean)
    .map((value) =>
      value.startsWith('http://') || value.startsWith('https://')
        ? new URL(value).origin
        : `https://${value}`,
    );
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return origin === config.CLIENT_ORIGIN || vercelOrigins().includes(origin);
}

function corsOrigin(origin, callback) {
  callback(null, isAllowedOrigin(origin));
}

export function createApplication() {
  const app = express();
  // Vercel terminates TLS one hop in front of the function.
  app.set(
    'trust proxy',
    process.env.VERCEL === '1' ? 1 : config.TRUST_PROXY.length ? config.TRUST_PROXY : false,
  );
  const server = createServer(app);

  const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
    allowRequest: (req, done) => done(null, isAllowedOrigin(req.headers.origin)),
  });

  io.use(async (socket, next) => {
    try {
      // Cookie-parser only reads headers and writes cookie fields in this handshake.
      const request = socket.request;
      cookieParser()(request, {}, () => {});
      socket.data.session = await authenticate(request.cookies[config.cookieName]);
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', async (socket) => {
    const { user, expiresAt } = socket.data.session;
    // Revocation covers pending verification; this room receives no board data.
    await socket.join(`session:${user._id}`);
    try {
      await authenticate(socket.request.cookies[config.cookieName]);
      if (!socket.connected) return;
      await socket.join(`user:${user._id}`);
      socket.emit('session:ready');
    } catch {
      socket.disconnect(true);
      return;
    }
    const timer = setTimeout(() => socket.disconnect(true), Math.max(0, expiresAt - Date.now()));
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
  });

  // --- Middleware chain (order matters) ---

  app.disable('x-powered-by');

  // Request tracing — assign a unique ID to every request
  app.use(requestId);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
        },
      },
    }),
  );

  // GZIP/Brotli compression for all responses
  app.use(compression());

  // CORS — CLIENT_ORIGIN, plus this Vercel deployment's public URLs
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!isAllowedOrigin(req.headers.origin)) {
      next(new AppError(403, 'Origin is not allowed'));
      return;
    }
    next();
  });
  app.use(cors({ origin: corsOrigin, credentials: true }));

  // Body parsing with size limit
  app.use(express.json({ limit: '64kb' }));

  // Cookie parser
  app.use(cookieParser());

  // NoSQL injection sanitization — strips $ and . keys from req.body
  // (Express 5 compatible: does not mutate the read-only req.query getter)
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitize(req.body);
    }
    next();
  });

  // HTTP parameter pollution protection
  app.use(hpp());

  // Request logging — JSON in production, colored dev format otherwise
  if (config.NODE_ENV !== 'test') {
    morgan.token('request-id', (req) => req.id || '-');
    const prodFormat =
      ':request-id :remote-addr :method :url :status :res[content-length] - :response-time ms';
    app.use(morgan(config.NODE_ENV === 'production' ? prodFormat : 'dev'));
  }

  // General API rate limiter — 200 requests per 15 minutes
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    }),
  );

  // CSRF + content-type enforcement for mutating requests
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-Flowboard-Request') !== '1') {
        next(new AppError(403, 'Missing request protection header'));
        return;
      }
      if (!req.is('application/json')) {
        next(new AppError(415, 'Use application/json'));
        return;
      }
    }
    next();
  });

  // API routes
  app.use('/api', apiRoutes(io));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'Endpoint not found')));

  // Serve client build in production
  if (config.serveClient)
    mountClient(app, fileURLToPath(new URL('../../client/dist', import.meta.url)));

  app.use((_req, _res, next) => next(new AppError(404, 'Endpoint not found')));

  // Global error handler — MUST be last
  app.use(errorHandler);

  return { app, server, io };
}
