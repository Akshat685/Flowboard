# Flowboard: JavaScript MERN application and guide

Flowboard uses MongoDB, Express, React, and Node.js. Application source, shared validation, configuration, and tests are plain JavaScript; React components use JSX. The existing feature/module organization and npm workspaces remain in place. All code below is generated from the working files.

Your private Atlas connection remains in `server/.env`. Existing local records were not copied, as requested. The separate older `../project/` application and retained local database are outside this change.

Start with [architecture and diagrams](docs/architecture.md), [installation and deployment](docs/deployment.md), [testing instructions](docs/testing.md), and the [end-to-end audit report](docs/audit-report.md).

## 1. Project overview

A Flowboard is a Kanban task manager: boards contain workflow columns, and columns contain task cards. This app supports accounts, private boards, full column/card CRUD, card metadata, drag-and-drop, and live updates between the owner's sessions.

React sends requests to `/api` through Vite on port 5173. Express listens on port 4001 and talks to MongoDB using Mongoose. Socket.IO sends account-scoped notifications; clients reload the authoritative data through REST. MongoDB credentials never reach the browser.

The older application in `../project/` contains additional workspace, sprint, comment, and role features. Those are not implemented by this core Flowboard app and are not silently removed from the older project.

## 2. Folder structure

```text
flowboard-mern/
  client/
    public/                 favicon.ico, robots.txt
    src/
      components/           common forms, application layout, UI extension directory
      features/
        auth/               auth.api.js, hooks, index.js
        boards/             boards.api.js, hooks, card forms, Kanban, index.js
      pages/                auth, boards, board details and missing-page views
      routes/               ProtectedRoute.jsx, index.jsx
      services/http.js      Fetch transport and API errors
      store/index.jsx       Context provider composition
      styles/global.css
      utils/errors.js
      App.jsx
      main.jsx
    tests/                  app, card creation, resilience, live sync and setup
    .env                    private client configuration
    .env.example
    index.html
    package.json
    vite.config.js
  server/
    src/
      modules/
        auth/               routes, controller, service, validation
        boards/             routes, controller, service, model, validation
        users/              model and public-user projection
      config/               db.js, env.js, environment.schema.js
      middleware/           auth, errors, authentication rate limiting
      errors/AppError.js
      routes/index.js
      app.js
      server.js
    scripts/dev.mjs
    tests/                  api.test.js, deployment.test.js
    .env                    private database and session configuration
    .env.example
    package.json
  shared/
    constants/              card priorities
    schemas/                auth, board, column, card, move and version validation
    tests/auth.test.js
    package.json
  scripts/                  setup, source checks, guide generation, isolated smoke server
  docs/                     architecture, deployment, testing, audit, guide and migration map
  .github/workflows/ci.yml
  eslint.config.js
  .prettierrc
  .prettierignore
  .gitignore
  package.json
  package-lock.json
  README.md
```

Dependencies, client build output, private environment files, and `.local/` are ignored by Git. Empty extension directories are reserved for future functionality. There are no invented products/orders modules or separate card collections.

See [the file migration map](docs/refactor-map.md) for how the files were reorganized.

## 3. Stack and workspaces

- **MongoDB:** durable users and boards collections. Columns and cards stay embedded in their board, preserving atomic moves and array order.
- **Mongoose:** schema validation, timestamps, ownership references, indexes, and optimistic concurrency.
- **Express and Node.js:** REST routing, request validation, authentication, persistence, and live notifications. The server runs directly from JavaScript source.
- **React, React Router, Context:** views, protected pages, session restoration, and board state.
- **Fetch:** JSON transport with cookies, request-protection headers, and readable errors.
- **Zod:** shared runtime validation; it remains necessary in JavaScript.
- **bcryptjs and jsonwebtoken:** password hashing and signed session cookies.
- **Socket.IO:** private live updates and logout disconnections.
- **@hello-pangea/dnd:** card drag-and-drop, with a keyboard-accessible Move to alternative.
- **Vite, Vitest, Testing Library, Node test runner, ESLint, Prettier:** development, build, verification, and formatting.

Install once at the repository root. The workspaces link `@flowboard/shared` directly to its JavaScript schemas/constants. There is no server/shared compilation step. Client `@/` and `@shared` aliases are configured in Vite; Node modules use native ESM imports with explicit file extensions.

### File: `package.json`

```json
{
  "name": "flowboard-mern",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "client",
    "server",
    "shared"
  ],
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "smoke": "npm run build && node scripts/smoke.mjs",
    "setup": "node scripts/setup.mjs",
    "dev": "concurrently -k -n API,WEB \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w client",
    "start": "npm run start -w server",
    "test": "npm run test -w shared && npm run test -w server && npm run test -w client",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "node scripts/check.mjs",
    "guide": "node scripts/build-guide.mjs"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.0",
    "concurrently": "^9.2.1",
    "eslint": "^9.39.0",
    "globals": "^16.4.0",
    "prettier": "^3.6.2",
    "eslint-plugin-react": "^7.37.5"
  }
}
```

### File: `client/package.json`

```json
{
  "name": "@flowboard/client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run"
  },
  "dependencies": {
    "@hello-pangea/dnd": "^18.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.9.4",
    "socket.io-client": "^4.8.1",
    "@flowboard/shared": "*"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^27.0.1",
    "vite": "^8.3.0",
    "vitest": "^4.0.0"
  }
}
```

### File: `server/package.json`

```json
{
  "name": "@flowboard/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "start": "node src/server.js",
    "test": "node --test --test-concurrency=1 tests/*.test.js"
  },
  "dependencies": {
    "@flowboard/shared": "1.0.0",
    "bcryptjs": "^3.0.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "express-rate-limit": "^8.1.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^9.0.0",
    "socket.io": "^4.8.1",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "mongodb-memory-server": "^10.2.3",
    "socket.io-client": "^4.8.1",
    "supertest": "^7.1.4"
  }
}
```

### File: `shared/package.json`

```json
{
  "name": "@flowboard/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./schemas": "./schemas/index.js",
    "./constants": "./constants/index.js"
  },
  "scripts": {
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "zod": "^4.1.12"
  }
}
```

## 4. Backend setup and middleware

After `npm ci` and `npm run setup`, set the server environment and run `npm run dev`. Startup connects to MongoDB and initializes indexes before listening. Shutdown closes live connections and the database connection.

Middleware applies Helmet, the exact allowed browser origin, JSON size limits, cookies, and write-request protection. Writes must send JSON and `X-Flowboard-Request: 1`. The cookie policy is HttpOnly/SameSite=Lax, with Secure cookies under HTTPS in production.

### File: `server/src/config/env.js`

```javascript
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { environmentSchema } from './environment.schema.js';
// Load the private environment relative to this source file.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const env = environmentSchema.parse(process.env);
export const config = {
  ...env,
  serveClient:
    env.SERVE_CLIENT === undefined ? env.NODE_ENV === 'production' : env.SERVE_CLIENT === 'true',
  cookieName: env.NODE_ENV === 'production' ? '__Host-flowboard' : 'flowboard',
  tokenSeconds: 3600,
};
```

### File: `server/src/config/environment.schema.js`

```javascript
import { isIP } from 'node:net';
import { z } from 'zod';

function trustedAddress(value) {
  if (value === 'loopback') return true;
  const [address, bits, extra] = value.split('/');
  const family = isIP(address);
  return (
    Boolean(family) &&
    extra === undefined &&
    (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= (family === 4 ? 32 : 128)))
  );
}

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4001),
    HOST: z.string().min(1).default('127.0.0.1'),
    MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
    CLIENT_ORIGIN: z
      .string()
      .url()
      .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
      }, 'Use an HTTP(S) origin only, without a path or trailing slash'),
    JWT_SECRET: z
      .string()
      .min(48)
      .refine((value) => !value.startsWith('REPLACE_'), 'Run npm run setup'),
    TRUST_PROXY: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .refine(
        (values) => values.every(trustedAddress),
        'Use trusted proxy IP addresses, CIDRs, or loopback; never true or a hop count',
      ),
    SERVE_CLIENT: z.enum(['true', 'false']).optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.CLIENT_ORIGIN.startsWith('https://'), {
    path: ['CLIENT_ORIGIN'],
    message: 'Production requires HTTPS for secure session cookies',
  });
```

### File: `server/src/config/db.js`

```javascript
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
```

### File: `server/src/app.js`

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import { authenticate } from './middleware/auth.middleware.js';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRoutes } from './routes/index.js';
import { mountClient } from './middleware/client.middleware.js';
export function createApplication() {
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY.length ? config.TRUST_PROXY : false);
  const server = createServer(app);
  const allowedOrigin = (origin) => !origin || origin === config.CLIENT_ORIGIN;
  const io = new Server(server, {
    cors: { origin: config.CLIENT_ORIGIN, credentials: true },
    allowRequest: (req, done) => done(null, allowedOrigin(req.headers.origin)),
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
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
        },
      },
    }),
  );
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!allowedOrigin(req.headers.origin)) {
      next(new AppError(403, 'Origin is not allowed'));
      return;
    }
    next();
  });
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
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
  app.use('/api', apiRoutes(io));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'Endpoint not found')));
  if (config.serveClient)
    mountClient(app, fileURLToPath(new URL('../../client/dist', import.meta.url)));
  app.use((_req, _res, next) => next(new AppError(404, 'Endpoint not found')));
  app.use(errorHandler);
  return { app, server, io };
}
```

### File: `server/src/server.js`

```javascript
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApplication } from './app.js';
try {
  await connectDatabase();
  const { server, io } = createApplication();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, config.HOST, resolve);
  });
  console.log(`Flowboard API: http://localhost:${config.PORT}`);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    io.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  const name = error instanceof Error ? error.name : 'Error';
  console.error(`Startup failed (${name}). Check MongoDB, environment variables and the port.`);
  await disconnectDatabase();
  process.exitCode = 1;
}
```

### File: `server/src/routes/index.js`

```javascript
import { Router } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { boardRoutes } from '../modules/boards/boards.routes.js';
export function apiRoutes(io) {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  router.get('/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('Disconnected');
      await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 1500 });
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
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
```

### File: `server/src/errors/AppError.js`

```javascript
export class AppError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
```

### File: `server/src/middleware/error.middleware.js`

```javascript
export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  let status = error.status || 500;
  let message = error.message;
  if (error.name === 'ZodError') {
    status = 400;
    message = error.issues
      ?.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
  } else if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name ?? '')) {
    status = 400;
    message = 'Invalid document fields';
  } else if (error.name === 'VersionError') {
    status = 409;
    message = 'This board changed. Reload it and retry your action.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'An account with that email already exists';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (
    [
      'MongoNetworkError',
      'MongoServerSelectionError',
      'MongooseServerSelectionError',
      'MongoOperationTimeoutError',
      'MongoNetworkTimeoutError',
    ].includes(error.name) ||
    error.code === 50
  ) {
    status = 503;
  }
  if (status >= 500) {
    console.error('Request failed:', error.name);
    message =
      status === 503
        ? 'Database temporarily unavailable. Please retry shortly.'
        : 'The server could not complete your request';
  }
  res.status(status).json({ error: message });
};
```

### File: `server/src/middleware/rateLimit.middleware.js`

```javascript
import rateLimit from 'express-rate-limit';
export function authenticationLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  });
}
```

### File: `server/src/middleware/client.middleware.js`

```javascript
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function mountClient(app, directory) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index))
    throw new Error('Client build is missing. Run npm run build before starting production.');
  app.use(
    express.static(directory, {
      index: false,
      redirect: false,
      dotfiles: 'ignore',
      setHeaders(res, file) {
        res.set(
          'Cache-Control',
          path.dirname(file) === path.join(directory, 'assets')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    }),
  );
  app.get('/{*path}', (req, res, next) => {
    // Missing assets and API paths must remain real 404 responses.
    if (
      path.extname(req.path) ||
      req.path.split('/').some((part) => part.startsWith('.')) ||
      !req.accepts('html')
    )
      return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: directory });
  });
}
```

### File: `server/scripts/dev.mjs`

```javascript
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = ['--watch'];
// Explicit paths prevent dependency/cache notifications from restarting requests.
if (['win32', 'darwin'].includes(process.platform)) {
  args.push('--watch-path=src', '--watch-path=../shared');
}
const child = spawn(process.execPath, [...args, 'src/server.js'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', (error) => {
  console.error('Development server failed:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
```

## 5. Database and shared validation

Users contain name, normalized unique email, password hash, and a token version for account-wide logout. Public responses expose only ID, name, and email.

Boards contain owner, title, description, ordered columns, and a version number. Cards contain title, description, priority, optional due date, labels, and timestamps. Limits remain 30 columns and 500 cards per board; at most 10 labels per card, each at most 32 characters. Passwords must fit the original 72 UTF-8 byte bound.

Each mutation checks the client's board version. Mongoose optimistic concurrency detects simultaneous saves; stale writes return 409. A card move removes and inserts within one board save, preserving its ID and metadata atomically.

### File: `server/src/modules/users/users.model.js`

```javascript
import mongoose from 'mongoose';
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true },
);
export const User = mongoose.model('User', userSchema);
```

### File: `server/src/modules/users/users.service.js`

```javascript
export const publicUser = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
});
```

### File: `server/src/modules/boards/boards.model.js`

```javascript
import mongoose from 'mongoose';
import { priorities } from '@flowboard/shared/constants';
// Array order IS display order. Columns and cards remain embedded documents.
export const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 5000 },
    priority: { type: String, enum: priorities, default: 'medium' },
    dueDate: { type: Date, default: null },
    labels: {
      type: [{ type: String, trim: true, maxlength: 32 }],
      default: [],
      validate: (value) => value.length <= 10,
    },
  },
  { timestamps: true },
);
export const columnSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    cards: { type: [cardSchema], default: [] },
  },
  { timestamps: true },
);
const boardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    columns: {
      type: [columnSchema],
      default: [],
      validate: (value) => value.length <= 30,
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);
boardSchema
  .path('columns')
  .validate(
    (columns) => columns.reduce((sum, column) => sum + column.cards.length, 0) <= 500,
    'A board can contain at most 500 cards',
  );
boardSchema.index({ owner: 1, updatedAt: -1, _id: -1 });
export const Board = mongoose.model('Board', boardSchema);
```

### File: `shared/constants/boards.js`

```javascript
export const priorities = ['low', 'medium', 'high', 'urgent'];
```

### File: `shared/constants/index.js`

```javascript
export { priorities } from './boards.js';
```

### File: `shared/schemas/auth.js`

```javascript
import { z } from 'zod';
import { title } from './common.js';
// TextEncoder has identical UTF-8 length semantics in Node and the browser.
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password,
  })
  .strict();
export const registration = credentials.extend({ name: title(80) });
```

### File: `shared/schemas/boards.js`

```javascript
import { z } from 'zod';
import { priorities } from '../constants/boards.js';
import { objectId, title, withVersion } from './common.js';
export const boardListInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict();
export const boardInput = z
  .object({ title: title(120), description: z.string().max(2000).optional() })
  .strict();
export const columnInput = z.object({ title: title(80) }).strict();
export const cardInput = z
  .object({
    title: title(160),
    description: z.string().max(5000).optional(),
    priority: z.enum(priorities).optional(),
    dueDate: z.iso.datetime().nullable().optional(),
    labels: z.array(title(32)).max(10).optional(),
  })
  .strict();
export const moveInput = withVersion(
  z
    .object({
      sourceColumnId: objectId,
      targetColumnId: objectId,
      // Destination index is measured after removing the dragged card.
      targetIndex: z.number().int().min(0).max(500),
    })
    .strict(),
);
```

### File: `shared/schemas/common.js`

```javascript
import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid document ID');
export const title = (max) => z.string().trim().min(1).max(max);
export const versionInput = z.object({ version: z.number().int().nonnegative() }).strict();
export const withVersion = (schema) => schema.extend(versionInput.shape);
```

### File: `shared/schemas/index.js`

```javascript
export * from './common.js';
export * from './auth.js';
export * from './boards.js';
```

## 6. Authentication

Registration validates inputs, hashes the password, and creates a user without starting a session. The client then shows the login page with an account-created confirmation. Login verifies the password and sets the signed cookie; it uses a dummy hash for missing accounts to avoid skipping password work. Protected routes verify the token's algorithm, issuer, audience, expiry, and token version before loading the account.

Logout increments tokenVersion and disconnects that account's sockets. The client never stores the JWT in localStorage. Ownership checks are required in addition to authentication: another account's board returns 404.

### File: `server/src/middleware/auth.middleware.js`

```javascript
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../modules/users/users.model.js';
import { AppError } from '../errors/AppError.js';
export const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
export function setSession(res, user) {
  const token = jwt.sign({ ver: user.tokenVersion }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'flowboard-api',
    audience: 'flowboard-web',
    expiresIn: config.tokenSeconds,
  });
  res.cookie(config.cookieName, token, { ...cookieOptions, maxAge: config.tokenSeconds * 1000 });
}
export async function authenticate(token) {
  let subject;
  let version;
  let expiry;
  try {
    if (typeof token !== 'string') throw new Error('Invalid token');
    const claims = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'flowboard-api',
      audience: 'flowboard-web',
    });
    if (
      typeof claims === 'string' ||
      typeof claims.sub !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(claims.sub) ||
      typeof claims.ver !== 'number' ||
      !Number.isInteger(claims.ver) ||
      typeof claims.exp !== 'number' ||
      !Number.isInteger(claims.exp)
    )
      throw new Error('Invalid claims');
    subject = claims.sub;
    version = claims.ver;
    expiry = claims.exp;
  } catch {
    throw new AppError(401, 'Please sign in again');
  }
  const user = await User.findById(subject).select('+tokenVersion');
  if (!user || user.tokenVersion !== version) throw new AppError(401, 'Please sign in again');
  return { user, expiresAt: expiry * 1000 };
}
export const requireAuth = async (req, _res, next) => {
  const session = await authenticate(req.cookies[config.cookieName]);
  req.user = session.user;
  next();
};
export function authenticatedUser(req) {
  if (!req.user) throw new AppError(401, 'Please sign in again');
  return req.user;
}
```

### File: `server/src/modules/auth/auth.controller.js`

```javascript
import { credentials, registration } from './auth.validation.js';
import { loginUser, registerUser, revokeSessions } from './auth.service.js';
import { publicUser } from '../users/users.service.js';
import { authenticatedUser, cookieOptions, setSession } from '../../middleware/auth.middleware.js';
import { config } from '../../config/env.js';
export function authController(io) {
  return {
    register: async (req, res) => {
      const user = await registerUser(registration.parse(req.body));
      res.status(201).json({ user: publicUser(user) });
    },
    login: async (req, res) => {
      const user = await loginUser(credentials.parse(req.body));
      setSession(res, user);
      res.json({ user: publicUser(user) });
    },
    me: (req, res) => {
      res.json({ user: publicUser(authenticatedUser(req)) });
    },
    logout: async (req, res) => {
      // Explicitly signs out ALL sessions, including open sockets.
      await revokeSessions(authenticatedUser(req), io);
      res.clearCookie(config.cookieName, cookieOptions).status(204).end();
    },
  };
}
```

### File: `server/src/modules/auth/auth.routes.js`

```javascript
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
```

### File: `server/src/modules/auth/auth.service.js`

```javascript
import bcrypt from 'bcryptjs';
import { User } from '../users/users.model.js';
import { AppError } from '../../errors/AppError.js';
const dummyHash = await bcrypt.hash('not-a-real-user-password', 12);
export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email, passwordHash });
}
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw new AppError(401, 'Invalid email or password');
  return user;
}
export async function revokeSessions(user, io) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  io.in(`session:${user._id}`).disconnectSockets(true);
}
```

### File: `server/src/modules/auth/auth.validation.js`

```javascript
export { credentials, registration } from '@flowboard/shared/schemas';
```

## 7. Frontend setup, routes, and layout

Vite proxies both `/api` and `/socket.io` to Express. Run the browser at `http://localhost:5173` to match the configured origin. The application restores the session before rendering protected pages and provides retry controls when the API is unreachable.

### File: `client/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#182a36" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <title>Flowboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### File: `client/vite.config.js`

```javascript
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:4001';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target }, '/socket.io': { target, ws: true } },
    },
    test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'] },
  };
});
```

### File: `client/src/main.jsx`

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { AppProviders } from '@/store';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import '@/styles/global.css';
const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
```

### File: `client/src/components/common/ErrorBoundary.jsx`

```jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="page" role="alert">
          <h1>Something went wrong</h1>
          <p>Your saved work is still on the server. Reload to try again.</p>
          <button onClick={() => window.location.reload()}>Reload Flowboard</button>
        </main>
      );
    return this.props.children;
  }
}
```

### File: `client/src/pages/NotFoundPage.jsx`

```jsx
import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p>Check the address or return to your boards.</p>
      <Link to="/boards">Go to boards</Link>
    </main>
  );
}
```

### File: `client/src/App.jsx`

```jsx
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { AppRoutes } from '@/routes';
export default function App() {
  const { loading, error, restore } = useAuth();
  if (loading)
    return (
      <main className="page" role="status">
        Restoring your session…
      </main>
    );
  if (error)
    return (
      <main className="page">
        <p role="alert">{error}</p>
        <button onClick={restore}>Retry connection</button>
      </main>
    );
  return <AppRoutes />;
}
```

### File: `client/src/store/index.jsx`

```jsx
import { AuthProvider } from '@/features/auth/hooks/AuthContext';
// BoardProvider is scoped to the signed-in user in ProtectedRoute so sign-out clears board state.
export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

### File: `client/src/routes/ProtectedRoute.jsx`

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { Shell } from '@/components/layout/Shell';
export function ProtectedRoute() {
  const { user } = useAuth();
  return user ? (
    <BoardProvider key={user._id}>
      <Shell />
    </BoardProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
```

### File: `client/src/routes/index.jsx`

```jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { BoardsPage } from '@/pages/BoardsPage';
import { BoardPage } from '@/pages/BoardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/boards" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

### File: `client/src/components/common/TitleForm.jsx`

```jsx
import { useRef, useState } from 'react';
import { errorMessage } from '@/utils/errors';
export function TitleForm({ label, initial = '', busy, maxLength = 120, onSubmit }) {
  const [title, setTitle] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || pending.current) return;
        setError('');
        if (!title.trim()) {
          setError('Enter a name containing at least one non-space character.');
          return;
        }
        pending.current = true;
        setSaving(true);
        try {
          if (await onSubmit(title.trim())) setTitle('');
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      <input
        disabled={busy || saving}
        aria-label={label}
        placeholder={label}
        required
        maxLength={maxLength}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button disabled={busy || saving}>{label}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

### File: `client/src/components/layout/Shell.jsx`

```jsx
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { errorMessage } from '@/utils/errors';
export function Shell() {
  const { user, signOut } = useAuth();
  const { error, clearError, live, loadList, loadBoard } = useBoards();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <Link className="brand" to="/boards">
          Flowboard<span> / </span>
        </Link>
        <div className="actions">
          <small>{live ? 'Live sync on' : 'Sync reconnecting'}</small>
          <span>{user?.name}</span>
          <button
            disabled={signingOut}
            onClick={async () => {
              if (signingOut) return;
              setSigningOut(true);
              setLogoutError('');
              try {
                await signOut();
              } catch (err) {
                setLogoutError(errorMessage(err));
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out everywhere'}
          </button>
        </div>
      </header>
      {(error || logoutError) && (
        <div className="error-banner" role="alert">
          {error || logoutError}{' '}
          <button
            onClick={() => {
              clearError();
              setLogoutError('');
              void loadList();
              void loadBoard();
            }}
          >
            Reload
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}
```

### File: `client/src/pages/AuthPage.jsx`

```jsx
import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { errorMessage } from '@/utils/errors';
export function AuthPage({ mode }) {
  const { user, signIn, registerAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const register = mode === 'register';
  if (user) return <Navigate to="/boards" replace />;
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">FLOWBOARD / YOUR WORK, IN VIEW</p>
        <h1>
          A little structure.
          <br />A lot more progress.
        </h1>
        <p>Turn a collection of tasks into a clear path forward.</p>
      </div>
      <form
        className="auth-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current) return;
          pending.current = true;
          setError('');
          setBusy(true);
          const data = new FormData(event.currentTarget);
          const input = {
            email: String(data.get('email') ?? ''),
            password: String(data.get('password') ?? ''),
            ...(register ? { name: String(data.get('name') ?? '') } : {}),
          };
          try {
            if (register) {
              await registerAccount(input);
              navigate('/login', { replace: true, state: { registered: true } });
            } else {
              await signIn(input);
            }
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
        {!register && location.state?.registered && (
          <p role="status">Account created successfully. Please sign in.</p>
        )}
        {register && (
          <label>
            Name
            <input disabled={busy} name="name" required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input
            disabled={busy}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            disabled={busy}
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
        </label>
        {register && <small>At least 8 characters; at most 72 UTF-8 bytes.</small>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
        <Link to={register ? '/login' : '/register'}>
          {register ? 'Already registered? Sign in' : 'Create an account'}
        </Link>
      </form>
    </main>
  );
}
```

### File: `client/src/pages/BoardPage.jsx`

```jsx
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { boardsApi as api } from '@/features/boards/boards.api';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { Kanban } from '@/features/boards/components/Kanban';
export function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { board, loadingBoard, busy, run, selectBoard } = useBoards();
  useEffect(() => {
    selectBoard(boardId ?? null);
    return () => selectBoard(null);
  }, [boardId, selectBoard]);
  if (loadingBoard)
    return (
      <main id="main-content" tabIndex={-1} className="page" role="status">
        Loading board…
      </main>
    );
  if (!board || board._id !== boardId)
    return (
      <main id="main-content" tabIndex={-1} className="page">
        <h1>Board unavailable</h1>
        <p>The board could not be opened. It may have been deleted or belong to another account.</p>
        <Link to="/boards">Back to boards</Link>
      </main>
    );
  return (
    <main id="main-content" tabIndex={-1} className="board-page">
      <Link to="/boards">← All boards</Link>
      <div className="board-heading">
        <div>
          <p className="eyebrow">KEEP THINGS MOVING</p>
          <h1>{board.title}</h1>
          {board.description && <p>{board.description}</p>}
        </div>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() => {
              const title = window.prompt('Board name', board.title);
              if (title?.trim()) void run(() => api.updateBoard(board._id, { title }, board.__v));
            }}
          >
            Rename board
          </button>
          <button
            disabled={busy}
            onClick={() => {
              const description = window.prompt('Board description', board.description);
              if (description !== null)
                void run(() => api.updateBoard(board._id, { description }, board.__v));
            }}
          >
            Edit description
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Delete this board and every column and card in it?')) return;
              const result = await run(async () => {
                await api.deleteBoard(board._id, board.__v);
                selectBoard(null);
                return true;
              });
              if (result) navigate('/boards');
            }}
          >
            Delete board
          </button>
        </div>
      </div>
      <p className="muted">
        Drag a card by its handle, or use its Move to menu. Keyboard: Space to lift, arrows to move,
        Space to drop.
      </p>
      {busy && <p role="status">Saving changes…</p>}
      <Kanban key={board._id} board={board} />
    </main>
  );
}
```

### File: `client/src/pages/BoardsPage.jsx`

```jsx
import { Link, useNavigate } from 'react-router-dom';
import { boardsApi as api } from '@/features/boards/boards.api';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { TitleForm } from '@/components/common/TitleForm';
export function BoardsPage() {
  const { boards, page, pages, changePage, loadingList, busy, run } = useBoards();
  const navigate = useNavigate();
  return (
    <main id="main-content" tabIndex={-1} className="page">
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>Make room for your next idea.</h1>
      <p className="muted">Create a board, break things down, and keep moving.</p>
      <TitleForm
        label="Create board"
        busy={busy}
        onSubmit={async (title) => {
          const result = await run(() => api.createBoard({ title }));
          if (result) navigate(`/boards/${result.board._id}`);
          return result;
        }}
      />
      {loadingList ? (
        <p role="status">Loading boards…</p>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <Link className="board-tile" key={board._id} to={`/boards/${board._id}`}>
              <small>BOARD</small>
              <h2>{board.title}</h2>
              <p>{board.description || 'Open your board'}</p>
              <span>Open board →</span>
            </Link>
          ))}
          {boards.length === 0 && <p>Your first board starts here. Give it a name above.</p>}
        </div>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="Board pages">
          <button disabled={loadingList || page <= 1} onClick={() => changePage(page - 1)}>
            Previous
          </button>
          <span aria-live="polite">
            Page {page} of {pages}
          </span>
          <button disabled={loadingList || page >= pages} onClick={() => changePage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
```

### File: `client/src/styles/global.css`

```css
:root {
  font-family: system-ui, sans-serif;
  color: #182a36;
  background: #f5f6f4;
  font-synthesis: none;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
button,
input,
textarea,
select {
  font: inherit;
}
button,
a,
input,
textarea,
select {
  outline-offset: 4px;
}
button {
  cursor: pointer;
  border: 1px solid #b9c7c4;
  background: #fff;
  color: #183c35;
  border-radius: 7px;
  padding: 8px 12px;
}
button:hover {
  background: #e2eee8;
}
button:disabled {
  opacity: 0.55;
  cursor: wait;
}
a {
  color: #245c4e;
}
input,
textarea,
select {
  width: 100%;
  min-width: 0;
  border: 1px solid #bdc9c5;
  border-radius: 6px;
  background: #fff;
  padding: 9px;
  color: #182a36;
}
textarea {
  min-height: 90px;
  resize: vertical;
}
label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
h1,
h2,
h3,
p {
  overflow-wrap: anywhere;
}
h1 {
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.15;
  letter-spacing: -0.04em;
  margin: 10px 0 16px;
}
h2 {
  font-size: 19px;
}
h3 {
  font-size: 16px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 4vw;
  background: #fff;
  border-bottom: 1px solid #dce2df;
}
.brand {
  font-size: 25px;
  letter-spacing: -0.07em;
  font-weight: 700;
  text-decoration: none;
  color: #182a36;
}
.brand span {
  color: #527c6c;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.actions button {
  font-size: 12px;
}
.page {
  max-width: 1240px;
  margin: auto;
  padding: 60px 4vw;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: #58796f;
}
.muted {
  color: #65746e;
  line-height: 1.6;
}
.inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 530px;
  margin: 25px 0;
}
.inline-form input {
  flex: 1;
  width: auto;
}
.inline-form p {
  flex-basis: 100%;
  margin: 0;
}
.actions > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.board-heading > div {
  min-width: 0;
}
.pagination {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 24px;
}
:focus-visible {
  outline: 3px solid #245c4e;
}
.skip-link {
  position: absolute;
  top: 8px;
  left: 8px;
  transform: translateY(-200%);
  background: white;
  padding: 12px;
  z-index: 10;
}
.skip-link:focus {
  transform: translateY(0);
}
@media (pointer: coarse) {
  button,
  select,
  input {
    min-height: 44px;
  }
}
.inline-form button {
  white-space: nowrap;
  background: #214f42;
  color: #fff;
  border-color: #214f42;
}
.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 45px;
}
.board-tile {
  border: 1px solid #d6dfd9;
  border-radius: 12px;
  background: #fff;
  padding: 28px;
  text-decoration: none;
  color: inherit;
}
.board-tile small {
  color: #6a7b72;
  font-size: 10px;
  letter-spacing: 0.13em;
}
.board-tile p {
  color: #68756e;
  font-size: 14px;
}
.board-tile span {
  display: block;
  margin-top: 30px;
  font-size: 13px;
  color: #2f6654;
}
.board-tile:hover {
  border-color: #527c6c;
}
.board-page {
  padding: 32px 4vw;
}
.board-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
  margin-top: 28px;
}
.kanban {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  overflow-x: auto;
  padding: 14px 0 40px;
}
.column {
  flex: 0 0 310px;
  min-width: 0;
  background: #e9eeea;
  border: 1px solid #dbe2dc;
  border-radius: 12px;
  padding: 15px;
}
.column-header h2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  margin: 5px 0 12px;
}
.column-header h2 span {
  font-size: 12px;
  color: #6d7b72;
}
.column-header button {
  padding: 5px 8px;
  font-size: 10px;
}
.card-list {
  min-height: 80px;
  padding-top: 14px;
}
.drag-over {
  background: #d2e6d8;
}
.task-card {
  border: 1px solid #d6dfd8;
  background: #fff;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 12px;
}
.task-card h3 {
  margin: 10px 0;
}
.drag-handle {
  font-size: 10px;
  padding: 3px 8px;
  color: #5a7263;
  touch-action: none;
}
.description {
  font-size: 13px;
  color: #5e6e63;
  white-space: pre-wrap;
}
.metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 12px 0;
}
.metadata > * {
  font-size: 10px;
  background: #eef2ed;
  border-radius: 4px;
  padding: 4px 6px;
}
.task-card .actions button {
  padding: 5px 8px;
  font-size: 11px;
}
.move-select {
  display: flex;
  align-items: center;
  font-size: 10px;
  margin-top: 14px;
}
.move-select select {
  width: auto;
  max-width: 200px;
  font-size: 10px;
  padding: 5px;
}
.column .inline-form {
  margin-bottom: 2px;
}
.column .inline-form input,
.column .inline-form button {
  font-size: 12px;
}
.new-column {
  background: transparent;
  border-style: dashed;
}
.card-form {
  display: grid;
  gap: 12px;
  margin-top: 15px;
}
.add-card-button {
  width: 100%;
  margin-top: 15px;
  background: #214f42;
  border-color: #214f42;
  color: #fff;
}
.add-card-button:hover {
  background: #183c35;
}
.card-composer {
  margin-top: 15px;
}
.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
}
.auth-intro {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10vw 7vw;
  background: #dce8df;
}
.auth-intro h1 {
  font-size: clamp(38px, 5vw, 65px);
}
.auth-intro > p:last-child {
  color: #52685b;
  line-height: 1.7;
}
.auth-form {
  align-self: center;
  width: min(420px, 90%);
  margin: 55px auto;
  display: grid;
  gap: 22px;
  padding: 20px;
}
.auth-form > button {
  background: #214f42;
  color: #fff;
  padding: 13px;
}
.auth-form a,
.auth-form small {
  font-size: 12px;
}
.error,
.error-banner {
  background: #f9e8e4;
  color: #8e2921;
  padding: 14px;
  border-radius: 6px;
  line-height: 1.5;
}
.error-banner {
  margin: 20px 4vw 0;
}
@media (max-width: 760px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
  .auth-intro {
    padding: 35px 7vw;
  }
  .auth-intro h1 {
    font-size: 35px;
  }
  .topbar,
  .board-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .page {
    padding-top: 35px;
  }
  .column {
    flex-basis: 285px;
  }
}
```

## 8. State management

Auth Context handles the account, restoration state, login, registration, logout, and unauthorized events. Board Context tracks the list, selected board, pending writes, errors, and live connection state.

Only one local mutation runs at a time. After writes, including conflicts or ambiguous network errors, the state reloads from REST. Sequence guards prevent older responses replacing newer selections. Socket events, window focus, and a periodic fallback refresh recover missed changes.

Superseded reads are cancelled. Requests have a 15-second deadline. Session revisions prevent old 401 responses from clearing a newer login. Open card edits retain their starting version; stale drafts stay visible but cannot overwrite newer data. Drag layouts stay fixed until drop/cancel. The dashboard uses bounded pagination.

### File: `client/src/features/auth/hooks/AuthContext.jsx`

```jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../auth.api';
import { errorMessage, errorStatus } from '@/utils/errors';
import { advanceSession } from '@/services/http';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const restoring = useRef(null);
  function invalidate() {
    restoring.current?.abort();
    advanceSession();
    return ++sequence.current;
  }
  async function restore() {
    const seq = invalidate();
    const controller = new AbortController();
    restoring.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await authApi.me({ signal: controller.signal });
      if (seq === sequence.current) setUser(data.user);
    } catch (err) {
      if (seq !== sequence.current || err.name === 'AbortError') return;
      setUser(null);
      if (errorStatus(err) !== 401) setError(errorMessage(err));
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void restore();
    const expired = () => {
      invalidate();
      setUser(null);
      setLoading(false);
      setError('');
    };
    window.addEventListener('flowboard:unauthorized', expired);
    return () => {
      invalidate();
      window.removeEventListener('flowboard:unauthorized', expired);
    };
  }, []);
  const registerAccount = (input) => authApi.register(input);
  const signIn = async (input) => {
    const seq = invalidate();
    const data = await authApi.login(input);
    if (seq === sequence.current) {
      advanceSession();
      setUser(data.user);
      setLoading(false);
      setError('');
    }
  };
  const signOut = async () => {
    invalidate();
    try {
      await authApi.logout();
    } catch (err) {
      if (errorStatus(err) !== 401) throw err;
    }
    setUser(null);
    setLoading(false);
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, restore, registerAccount, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### File: `client/src/features/boards/hooks/BoardContext.jsx`

```jsx
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import { boardsApi } from '../boards.api';
import { authApi } from '@/features/auth/auth.api';
import { socketOrigin } from '@/services/http';
import { errorMessage, errorStatus } from '@/utils/errors';
const BoardContext = createContext(null);
const initial = {
  boards: [],
  page: 1,
  pages: 1,
  total: 0,
  board: null,
  loadingList: true,
  loadingBoard: false,
  busy: false,
  error: '',
  live: false,
};
export function BoardProvider({ children }) {
  const [state, dispatch] = useReducer((old, patch) => ({ ...old, ...patch }), initial);
  const activeId = useRef(null);
  const sequence = useRef({ list: 0, board: 0 });
  const pending = useRef(false);
  const mounted = useRef(true);
  const listPage = useRef(1);
  const requests = useRef({ list: null, board: null });
  const patch = useCallback((value) => {
    if (mounted.current) dispatch(value);
  }, []);
  const loadList = useCallback(
    async (page = listPage.current) => {
      listPage.current = page;
      requests.current.list?.abort();
      const controller = new AbortController();
      requests.current.list = controller;
      const seq = ++sequence.current.list;
      try {
        const {
          boards,
          page: currentPage = 1,
          pages = 1,
          total = 0,
        } = await boardsApi.boards(page, { signal: controller.signal });
        if (seq === sequence.current.list) {
          listPage.current = currentPage;
          patch({ boards, page: currentPage, pages, total, loadingList: false });
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (seq === sequence.current.list)
          patch({ error: errorMessage(error), loadingList: false });
      }
    },
    [patch],
  );
  const loadBoard = useCallback(
    async (id = activeId.current) => {
      if (!id) return;
      requests.current.board?.abort();
      const controller = new AbortController();
      requests.current.board = controller;
      const seq = ++sequence.current.board;
      try {
        const { board } = await boardsApi.board(id, { signal: controller.signal });
        if (id === activeId.current && seq === sequence.current.board)
          patch({ board, loadingBoard: false });
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (id === activeId.current && seq === sequence.current.board)
          patch({
            error: errorMessage(error),
            loadingBoard: false,
            ...(errorStatus(error) === 404 ? { board: null } : {}),
          });
      }
    },
    [patch],
  );
  const selectBoard = useCallback(
    (id) => {
      activeId.current = id;
      requests.current.board?.abort();
      ++sequence.current.board;
      patch({ board: null, loadingBoard: Boolean(id), error: '' });
      if (id) void loadBoard(id);
    },
    [loadBoard, patch],
  );
  const run = useCallback(
    async (operation) => {
      if (pending.current) return null;
      pending.current = true;
      patch({ busy: true, error: '' });
      let result = null;
      try {
        result = await operation();
      } catch (error) {
        patch({ error: errorMessage(error) });
      } finally {
        // Also reconcile after 409 conflicts or ambiguous network failures.
        await Promise.all([loadList(), loadBoard()]);
        pending.current = false;
        patch({ busy: false });
      }
      return result;
    },
    [loadBoard, loadList, patch],
  );
  useEffect(() => {
    mounted.current = true;
    void loadList();
    const socket = io(socketOrigin, { withCredentials: true });
    let active = true;
    let reconnectTimer;
    const retrySocket = () => {
      if (!active || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        if (active && !socket.connected) socket.connect();
      }, 10000);
    };
    const refresh = () => {
      void loadList();
      void loadBoard();
    };
    socket.on('session:ready', () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      patch({ live: true });
      refresh();
    });
    socket.on('boards:changed', ({ boardId }) => {
      void loadList();
      if (boardId === activeId.current) void loadBoard();
    });
    socket.on('connect_error', () => {
      patch({ live: false });
      retrySocket();
    });
    socket.on('disconnect', (reason) => {
      patch({ live: false });
      if (reason === 'io server disconnect') {
        void authApi
          .me()
          .then(() => {
            if (active) socket.connect();
          })
          .catch((error) => {
            if (errorStatus(error) !== 401) retrySocket();
          });
      }
    });
    // Re-fetch after a reconnect or missed event; REST remains the source of truth.
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      mounted.current = false;
      ++sequence.current.list;
      ++sequence.current.board;
      requests.current.list?.abort();
      requests.current.board?.abort();
      socket.disconnect();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [loadList, loadBoard, patch]);
  return (
    <BoardContext.Provider
      value={{
        ...state,
        run,
        selectBoard,
        loadList,
        loadBoard,
        changePage: (page) => {
          patch({ loadingList: true, error: '' });
          void loadList(page);
        },
        clearError: () => patch({ error: '' }),
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}
export function useBoards() {
  const context = useContext(BoardContext);
  if (!context) throw new Error('useBoards must be used within BoardProvider');
  return context;
}
```

## 9. CRUD, card details, drag-and-drop, and live updates

Routes delegate HTTP concerns to controllers; services perform database operations. Every nested board operation first resolves a board owned by the signed-in user. Column/card schemas and operations remain within the boards module.

**Add card opens the same full-detail form used by editing:** title, description, priority, due date, and labels. Cancel creates nothing. Failed saves preserve the draft. The native drag button keeps its drag attributes while saving so keyboard focus can be restored. A Move to menu provides an alternative to dragging.

### File: `server/src/modules/boards/boards.routes.js`

```javascript
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { boardController } from './boards.controller.js';
export function boardRoutes(io) {
  const router = Router();
  const controller = boardController(io);
  router.use(requireAuth);
  router.get('/', controller.list);
  router.post('/', controller.create);
  // Every nested operation loads a board scoped to the signed-in owner first.
  router.use('/:boardId', controller.loadOwned);
  router.get('/:boardId', controller.get);
  router.patch('/:boardId', controller.update);
  router.delete('/:boardId', controller.remove);
  router.get('/:boardId/columns', controller.columns);
  router.get('/:boardId/columns/:columnId', controller.column);
  router.post('/:boardId/columns', controller.createColumn);
  router.patch('/:boardId/columns/:columnId', controller.updateColumn);
  router.delete('/:boardId/columns/:columnId', controller.deleteColumn);
  const cardsPath = '/:boardId/columns/:columnId/cards';
  router.get(cardsPath, controller.cards);
  router.get(`${cardsPath}/:cardId`, controller.card);
  router.post(cardsPath, controller.createCard);
  router.patch(`${cardsPath}/:cardId`, controller.updateCard);
  router.delete(`${cardsPath}/:cardId`, controller.deleteCard);
  router.post('/:boardId/cards/:cardId/move', controller.moveCard);
  return router;
}
```

### File: `server/src/modules/boards/boards.controller.js`

```javascript
import { authenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../errors/AppError.js';
import {
  boardListInput,
  boardInput,
  columnInput,
  cardInput,
  versionInput,
  withVersion,
  moveInput,
} from './boards.validation.js';
import { boardService, findColumn, findCard } from './boards.service.js';
function loadedBoard(req) {
  if (!req.board) throw new AppError(404, 'Board not found');
  return req.board;
}
export function boardController(io) {
  const service = boardService(io);
  return {
    list: async (req, res) => {
      res.json(await service.list(authenticatedUser(req)._id, boardListInput.parse(req.query)));
    },
    create: async (req, res) => {
      const input = boardInput.parse(req.body);
      const board = await service.create(authenticatedUser(req)._id, input);
      res.status(201).json({ board });
    },
    loadOwned: async (req, _res, next) => {
      req.board = await service.findOwned(authenticatedUser(req)._id, req.params.boardId);
      next();
    },
    get: (req, res) => {
      res.json({ board: loadedBoard(req) });
    },
    update: async (req, res) => {
      const { version, ...input } = withVersion(boardInput.partial()).parse(req.body);
      res.json({ board: await service.update(loadedBoard(req), input, version) });
    },
    remove: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      await service.remove(loadedBoard(req), authenticatedUser(req)._id, version);
      res.status(204).end();
    },
    columns: (req, res) => {
      res.json({ columns: loadedBoard(req).columns });
    },
    column: (req, res) => {
      res.json({ column: findColumn(loadedBoard(req), req.params.columnId) });
    },
    createColumn: async (req, res) => {
      const { version, ...input } = withVersion(columnInput).parse(req.body);
      res.status(201).json({ board: await service.createColumn(loadedBoard(req), input, version) });
    },
    updateColumn: async (req, res) => {
      const { version, ...input } = withVersion(columnInput).parse(req.body);
      res.json({
        board: await service.updateColumn(loadedBoard(req), req.params.columnId, input, version),
      });
    },
    deleteColumn: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      res.json({
        board: await service.deleteColumn(loadedBoard(req), req.params.columnId, version),
      });
    },
    cards: (req, res) => {
      res.json({ cards: findColumn(loadedBoard(req), req.params.columnId).cards });
    },
    card: (req, res) => {
      res.json({
        card: findCard(findColumn(loadedBoard(req), req.params.columnId), req.params.cardId),
      });
    },
    createCard: async (req, res) => {
      const { version, ...input } = withVersion(cardInput).parse(req.body);
      res.status(201).json({
        board: await service.createCard(loadedBoard(req), req.params.columnId, input, version),
      });
    },
    updateCard: async (req, res) => {
      const { version, ...input } = withVersion(cardInput.partial()).parse(req.body);
      res.json({
        board: await service.updateCard(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          input,
          version,
        ),
      });
    },
    deleteCard: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      res.json({
        board: await service.deleteCard(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          version,
        ),
      });
    },
    moveCard: async (req, res) => {
      const input = moveInput.parse(req.body);
      res.json({ board: await service.moveCard(loadedBoard(req), req.params.cardId, input) });
    },
  };
}
```

### File: `server/src/modules/boards/boards.service.js`

```javascript
import { Board } from './boards.model.js';
import { objectId } from './boards.validation.js';
import { AppError } from '../../errors/AppError.js';
export function findColumn(board, id) {
  const found = board.columns.id(objectId.parse(id));
  if (!found) throw new AppError(404, 'Column not found');
  return found;
}
export function findCard(column, id) {
  const found = column.cards.id(objectId.parse(id));
  if (!found) throw new AppError(404, 'Card not found');
  return found;
}
function checkVersion(board, version) {
  if (board.__v !== version)
    throw new AppError(409, 'This board changed. Reload it and retry your action.');
}
export function boardService(io) {
  const notify = (board) => {
    io.to(`user:${board.owner}`).emit('boards:changed', { boardId: board._id.toString() });
  };
  const save = async (board) => {
    await board.save();
    notify(board);
    return board;
  };
  return {
    async list(owner, { page, limit }) {
      const total = await Board.countDocuments({ owner });
      const pages = Math.max(1, Math.ceil(total / limit));
      const currentPage = Math.min(page, pages);
      const boards = await Board.find({ owner })
        .select('-columns')
        .sort({ updatedAt: -1, _id: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .lean();
      return { boards, page: currentPage, pages, total };
    },
    async create(owner, input) {
      const board = await Board.create({
        ...input,
        owner,
        columns: [{ title: 'To do' }, { title: 'In progress' }, { title: 'Done' }],
      });
      notify(board);
      return board;
    },
    async findOwned(owner, id) {
      const board = await Board.findOne({ _id: objectId.parse(id), owner });
      if (!board) throw new AppError(404, 'Board not found');
      return board;
    },
    async update(board, input, version) {
      checkVersion(board, version);
      Object.assign(board, input);
      return save(board);
    },
    async remove(board, owner, version) {
      checkVersion(board, version);
      const result = await Board.deleteOne({ _id: board._id, owner, __v: version });
      if (!result.deletedCount)
        throw new AppError(409, 'This board changed. Reload it and retry your action.');
      notify(board);
    },
    async createColumn(board, input, version) {
      checkVersion(board, version);
      board.columns.push(input);
      return save(board);
    },
    async updateColumn(board, id, input, version) {
      checkVersion(board, version);
      Object.assign(findColumn(board, id), input);
      return save(board);
    },
    async deleteColumn(board, id, version) {
      checkVersion(board, version);
      findColumn(board, id).deleteOne();
      return save(board);
    },
    async createCard(board, columnId, input, version) {
      checkVersion(board, version);
      findColumn(board, columnId).cards.push(input);
      return save(board);
    },
    async updateCard(board, columnId, cardId, input, version) {
      checkVersion(board, version);
      Object.assign(findCard(findColumn(board, columnId), cardId), input);
      return save(board);
    },
    async deleteCard(board, columnId, cardId, version) {
      checkVersion(board, version);
      findCard(findColumn(board, columnId), cardId).deleteOne();
      return save(board);
    },
    async moveCard(board, cardId, input) {
      checkVersion(board, input.version);
      const source = findColumn(board, input.sourceColumnId);
      const target = findColumn(board, input.targetColumnId);
      const moving = findCard(source, cardId);
      const data = moving.toObject(); // Preserve ID, metadata and creation timestamp.
      moving.deleteOne();
      if (input.targetIndex > target.cards.length)
        throw new AppError(400, 'Destination index is out of range');
      target.cards.splice(input.targetIndex, 0, data);
      // Removing and inserting the card commit atomically in one document save.
      return save(board);
    },
  };
}
```

### File: `server/src/modules/boards/boards.validation.js`

```javascript
export {
  boardListInput,
  boardInput,
  columnInput,
  cardInput,
  objectId,
  versionInput,
  withVersion,
  moveInput,
} from '@flowboard/shared/schemas';
```

### File: `client/src/features/boards/components/CardComposer.jsx`

```jsx
import { useState } from 'react';
import { CardForm } from './CardForm';
export function CardComposer({ columnTitle, busy, onSubmit }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        className="add-card-button"
        type="button"
        disabled={busy}
        aria-label={`Add card to ${columnTitle}`}
        onClick={() => setOpen(true)}
      >
        Add card
      </button>
    );
  return (
    <div className="task-card card-composer">
      <h3>New card</h3>
      <CardForm
        busy={busy}
        submitLabel="Create card"
        onSubmit={onSubmit}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
```

### File: `client/src/features/boards/components/CardForm.jsx`

```jsx
import { useRef, useState } from 'react';
import { priorities } from '@shared/constants';
import { errorMessage } from '@/utils/errors';
export function CardForm({
  card = {},
  busy,
  stale = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save card',
}) {
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const locked = busy || saving;
  const [input, setInput] = useState({
    title: card.title || '',
    description: card.description || '',
    priority: card.priority || 'medium',
    dueDate: card.dueDate?.slice(0, 10) || '',
    labels: (card.labels || []).join(', '),
  });
  const field = (key) => ({
    disabled: locked,
    value: input[key],
    onChange: (event) => setInput((old) => ({ ...old, [key]: event.target.value })),
  });
  const [error, setError] = useState('');
  return (
    <form
      className="card-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked || stale || pending.current) return;
        setError('');
        if (!input.title.trim()) {
          setError('Enter a card title.');
          return;
        }
        const labels = input.labels
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        if (labels.length > 10 || labels.some((value) => value.length > 32)) {
          setError('Use up to 10 labels, each at most 32 characters.');
          return;
        }
        pending.current = true;
        setSaving(true);
        try {
          const success = await onSubmit({
            ...input,
            title: input.title.trim(),
            labels,
            dueDate:
              input.dueDate === card.dueDate?.slice(0, 10)
                ? card.dueDate
                : input.dueDate
                  ? `${input.dueDate}T00:00:00.000Z`
                  : null,
          });
          if (success) onCancel();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      {stale && (
        <p role="status">
          This board changed while you were editing. Your draft is preserved. Copy any text you
          need, then cancel and reopen the card to review the latest details before saving.
        </p>
      )}
      <label>
        Card title
        <input autoFocus required maxLength={160} {...field('title')} />
      </label>
      <label>
        Description
        <textarea maxLength={5000} {...field('description')} />
      </label>
      <label>
        Priority
        <select
          disabled={locked}
          value={input.priority}
          onChange={(event) => {
            const priority = priorities.find((value) => value === event.target.value);
            if (priority) setInput((old) => ({ ...old, priority }));
          }}
        >
          {priorities.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Due date
        <input type="date" {...field('dueDate')} onInput={field('dueDate').onChange} />
      </label>
      <label>
        Labels, separated by commas
        <input maxLength={340} {...field('labels')} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button disabled={locked || stale}>{locked ? 'Saving…' : submitLabel}</button>
        <button type="button" disabled={locked} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
```

### File: `client/src/features/boards/components/Kanban.jsx`

```jsx
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { boardsApi as api } from '../boards.api';
import { useBoards } from '../hooks/BoardContext';
import { CardComposer } from './CardComposer';
import { CardForm } from './CardForm';
import { TitleForm } from '@/components/common/TitleForm';
export function Kanban({ board: currentBoard }) {
  const { run, busy } = useBoards();
  const [editing, setEditing] = useState(null);
  const [dragBoard, setDragBoard] = useState(null);
  useEffect(() => {
    if (
      editing &&
      !currentBoard.columns.some((column) => column.cards.some((card) => card._id === editing.id))
    ) {
      setEditing(null);
    }
  }, [currentBoard, editing]);
  // Keep the drag layout and expected version stable until drop/cancel.
  const board = dragBoard || currentBoard;
  const move = (cardId, sourceColumnId, targetColumnId, targetIndex) =>
    run(() =>
      api.moveCard(board._id, cardId, { sourceColumnId, targetColumnId, targetIndex }, board.__v),
    );
  return (
    <DragDropContext
      onBeforeCapture={() => setDragBoard(currentBoard)}
      onDragEnd={({ draggableId, source, destination }) => {
        setDragBoard(null);
        if (
          !destination ||
          busy ||
          (source.droppableId === destination.droppableId && source.index === destination.index)
        )
          return;
        void move(draggableId, source.droppableId, destination.droppableId, destination.index);
      }}
    >
      <div className="kanban" aria-label="Board columns">
        {board.columns.map((column) => (
          <section className="column" key={column._id}>
            <header className="column-header">
              <h2>
                {column.title} <span>{column.cards.length}</span>
              </h2>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    const title = window.prompt('Column name', column.title);
                    if (title?.trim())
                      void run(() => api.updateColumn(board._id, column._id, { title }, board.__v));
                  }}
                >
                  Rename
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete ${column.title} and all its cards?`))
                      void run(() => api.deleteColumn(board._id, column._id, board.__v));
                  }}
                >
                  Delete column
                </button>
              </div>
            </header>
            <Droppable droppableId={column._id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`card-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                >
                  {column.cards.map((card, index) => (
                    <Draggable
                      key={card._id}
                      draggableId={card._id}
                      index={index}
                      isDragDisabled={editing !== null}
                      disableInteractiveElementBlocking
                    >
                      {(drag) => (
                        <article className="task-card" ref={drag.innerRef} {...drag.draggableProps}>
                          {/* Keep handle attributes during save so the drag library can restore focus. */}
                          <button
                            className="drag-handle"
                            disabled={busy}
                            {...drag.dragHandleProps}
                            aria-label={`Drag ${card.title}`}
                          >
                            Move card
                          </button>
                          {editing?.id === card._id ? (
                            <CardForm
                              card={editing.card}
                              stale={editing.version !== currentBoard.__v}
                              busy={busy}
                              onCancel={() => setEditing(null)}
                              onSubmit={(input) =>
                                run(() =>
                                  api.updateCard(
                                    board._id,
                                    column._id,
                                    card._id,
                                    input,
                                    editing.version,
                                  ),
                                )
                              }
                            />
                          ) : (
                            <>
                              <h3>{card.title}</h3>
                              {card.description && (
                                <p className="description">{card.description}</p>
                              )}
                              <div className="metadata">
                                <span>{card.priority}</span>
                                {card.dueDate && (
                                  <time dateTime={card.dueDate}>{card.dueDate.slice(0, 10)}</time>
                                )}
                                {card.labels.map((label, i) => (
                                  <span key={`${label}-${i}`}>{label}</span>
                                ))}
                              </div>
                              <div className="actions">
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    setEditing({ id: card._id, card, version: board.__v })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    if (window.confirm(`Delete ${card.title}?`))
                                      void run(() =>
                                        api.deleteCard(board._id, column._id, card._id, board.__v),
                                      );
                                  }}
                                >
                                  Delete card
                                </button>
                              </div>
                              <label className="move-select">
                                Move to
                                <select
                                  aria-label={`Move ${card.title} to column`}
                                  disabled={busy}
                                  value={column._id}
                                  onChange={(event) => {
                                    const target = board.columns.find(
                                      (value) => value._id === event.target.value,
                                    );
                                    if (target)
                                      void move(
                                        card._id,
                                        column._id,
                                        target._id,
                                        target.cards.length,
                                      );
                                  }}
                                >
                                  {board.columns.map((value) => (
                                    <option key={value._id} value={value._id}>
                                      {value.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                        </article>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <CardComposer
              columnTitle={column.title}
              busy={busy}
              onSubmit={(input) =>
                run(() => api.createCard(board._id, column._id, input, board.__v))
              }
            />
          </section>
        ))}
        <section className="column new-column">
          <h2>New column</h2>
          <TitleForm
            label="Add column"
            maxLength={80}
            busy={busy}
            onSubmit={(title) => run(() => api.createColumn(board._id, { title }, board.__v))}
          />
        </section>
      </div>
    </DragDropContext>
  );
}
```

## 10. API integration and errors

All paths below are under `/api`:

- POST `/auth/register`, POST `/auth/login`, GET `/auth/me`, POST `/auth/logout`.
- GET `/health` for liveness; GET `/ready` for database readiness (503 during an outage).
- GET/POST `/boards`; GET/PATCH/DELETE `/boards/:boardId`.
- GET/POST `/boards/:boardId/columns`; GET/PATCH/DELETE `/boards/:boardId/columns/:columnId`.
- GET/POST `/boards/:boardId/columns/:columnId/cards`; GET/PATCH/DELETE that path plus `/:cardId`.
- POST `/boards/:boardId/cards/:cardId/move` with source column, target column, target index, and version.

Writes to existing boards require `version: board.__v`. Board creation and nested creates return 201. Deleting a board and logout return 204. Other successful reads and updates return 200.

The board list accepts `page` (default 1) and `limit` (default 24, maximum 100), returning `{ boards, page, pages, total }`. Summaries exclude columns. See [the API contract](docs/architecture.md#api-contract).

The transport sends cookies and protection headers, handles empty 204 responses, preserves cancellation, and emits unauthorized events when a protected request returns 401. Components display loading, saving, and error states rather than discarding failed drafts.

### File: `client/src/services/http.js`

```javascript
const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const socketOrigin = new URL(base, window.location.origin).origin;
let sessionRevision = 0;
// Responses started under an older session must not sign out a newly logged-in user.
export const advanceSession = () => ++sessionRevision;
export class ApiError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function request(path, { method = 'GET', body, signal, timeoutMs = 15000 } = {}) {
  const revision = sessionRevision;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Flowboard-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    if (response.status !== 204) {
      try {
        data = await response.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error;
      }
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        revision === sessionRevision &&
        !['/auth/login', '/auth/register'].includes(path)
      ) {
        window.dispatchEvent(new Event('flowboard:unauthorized'));
      }
      const message =
        typeof data?.error === 'string' ? data.error : `Request failed (${response.status})`;
      throw new ApiError(response.status, message);
    }
    if (data === null && response.status !== 204)
      throw new ApiError(502, 'The server returned an invalid response');
    return data;
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        408,
        'The request timed out. Refresh before retrying; your last change may have been saved.',
      );
    if (error instanceof ApiError) throw error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
    )
      throw error;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and retry.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
export const write = (path, method, body) => request(path, { method, body });
```

### File: `client/src/utils/errors.js`

```javascript
export const errorMessage = (error) =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string'
    ? error.message
    : 'Something went wrong. Please retry.';
export const errorStatus = (error) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : undefined;
```

### File: `client/src/features/auth/auth.api.js`

```javascript
import { request, write } from '@/services/http';
export const authApi = {
  register: (body) => write('/auth/register', 'POST', body),
  login: (body) => write('/auth/login', 'POST', body),
  me: (options) => request('/auth/me', options),
  logout: () => write('/auth/logout', 'POST', {}),
};
```

### File: `client/src/features/auth/index.js`

```javascript
export { authApi } from './auth.api';
export { AuthProvider, useAuth } from './hooks/AuthContext';
```

### File: `client/src/features/boards/boards.api.js`

```javascript
import { request, write } from '@/services/http';
const boardPath = (id) => `/boards/${id}`;
const colPath = (id, col) => `${boardPath(id)}/columns/${col}`;
const cardPath = (id, col, card) => `${colPath(id, col)}/cards/${card}`;
export const boardsApi = {
  boards: (page = 1, options) => request(`/boards?page=${page}`, options),
  board: (id, options) => request(boardPath(id), options),
  createBoard: (input) => write('/boards', 'POST', input),
  updateBoard: (id, input, version) => write(boardPath(id), 'PATCH', { ...input, version }),
  deleteBoard: (id, version) => write(boardPath(id), 'DELETE', { version }),
  columns: (id) => request(`${boardPath(id)}/columns`),
  column: (id, col) => request(colPath(id, col)),
  createColumn: (id, input, version) =>
    write(`${boardPath(id)}/columns`, 'POST', { ...input, version }),
  updateColumn: (id, col, input, version) =>
    write(colPath(id, col), 'PATCH', { ...input, version }),
  deleteColumn: (id, col, version) => write(colPath(id, col), 'DELETE', { version }),
  cards: (id, col) => request(`${colPath(id, col)}/cards`),
  card: (id, col, card) => request(cardPath(id, col, card)),
  createCard: (id, col, input, version) =>
    write(`${colPath(id, col)}/cards`, 'POST', { ...input, version }),
  updateCard: (id, col, card, input, version) =>
    write(cardPath(id, col, card), 'PATCH', { ...input, version }),
  deleteCard: (id, col, card, version) => write(cardPath(id, col, card), 'DELETE', { version }),
  moveCard: (id, card, input, version) =>
    write(`${boardPath(id)}/cards/${card}/move`, 'POST', { ...input, version }),
};
```

### File: `client/src/features/boards/index.js`

```javascript
export { boardsApi } from './boards.api';
export { BoardProvider, useBoards } from './hooks/BoardContext';
export { Kanban } from './components/Kanban';
```

## 11. Environment variables

### File: `server/.env.example`

```text
NODE_ENV=development
PORT=4001
HOST=127.0.0.1
# Set only to the address/CIDR of your trusted reverse proxy (e.g. loopback for local nginx).
TRUST_PROXY=
# Defaults to true in production, false otherwise. Build the client first when true.
# SERVE_CLIENT=true
MONGODB_URI=mongodb://127.0.0.1:27017/flowboard_mern
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_USING_NPM_RUN_SETUP
```

### File: `client/.env.example`

```text
# Public build-time value. Never put secrets in VITE_* variables.
VITE_API_URL=/api
# Used only by the Vite development proxy (not included in browser code).
API_PROXY_TARGET=http://127.0.0.1:4001
```

- Server `MONGODB_URI`: private MongoDB connection string. This project uses that name, not DATABASE_URL. Your Atlas database remains configured in the private file.
- Server `JWT_SECRET`: random secret, at least 48 characters. Setup generates it only when creating a new environment file.
- Server `CLIENT_ORIGIN`: exact origin with no trailing slash; default http://localhost:5173.
- Server `PORT`: default 4001.
- Server `HOST`: default 127.0.0.1; production binding depends on the host network.
- Server `TRUST_PROXY`: empty by default; allow only the real proxy IP/CIDR or local `loopback`.
- Server `SERVE_CLIENT`: defaults to true in production, false otherwise. Requires a client build when enabled.
- Server `NODE_ENV`: development/test/production; production cookies require HTTPS.
- Client `VITE_API_URL`: public API base, normally /api.
- Client `API_PROXY_TARGET`: development proxy target, normally http://127.0.0.1:4001.

Never put database credentials or session secrets in VITE_* variables. Restart the server after changing its environment; client build-time variables require a new build.

## 12. Install, run, and deploy

Use Node.js 24 or a compatible version at least 22.12. MongoDB must be reachable: use your configured Atlas database, or an installed local MongoDB service and its URI.

```powershell
cd 'C:\Akshat\bolt flowboard\Flowboard2\flowboard-mern'
npm.cmd ci
npm.cmd run setup
npm.cmd run dev
```

Open http://localhost:5173/register. The API health endpoint is http://localhost:4001/api/health. Keep the development process running; Ctrl+C stops both services. Restart with the same `npm run dev` command. Do not launch a second copy on occupied ports.

Setup preserves the existing client/server environment files. Your local database copy remains in `.local/mongodb`; this app uses the URI configured in `server/.env`. Earlier accounts and board IDs were not transferred to Atlas, as requested.

### File: `scripts/setup.mjs`

```javascript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const name of ['server/.env', 'client/.env']) {
  const target = new URL(name, root);
  if (existsSync(target)) {
    console.log(`Keeping existing ${name}`);
    continue;
  }
  let content = readFileSync(new URL(`${name}.example`, root), 'utf8');
  content = content.replace(
    'REPLACE_WITH_A_RANDOM_SECRET_USING_NPM_RUN_SETUP',
    randomBytes(48).toString('hex'),
  );
  writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  console.log(`Created ${fileURLToPath(target)}`);
}
```

For separate terminals, run `npm run dev -w server` and `npm run dev -w client`. Shared schemas are consumed directly from JavaScript; the server watcher watches them too.

```powershell
npm.cmd run check
npm.cmd run format:check
npm.cmd test
npm.cmd run build
npm.cmd start
```

`build` creates `client/dist`. `start` launches Node directly from `server/src/server.js`; there is no server build output. In production Express serves the built client and SPA deep links by default. Put an HTTPS reverse proxy in front with WebSocket upgrades and an explicit proxy allowlist. See [deployment and nginx instructions](docs/deployment.md). Vite preview is not a production API proxy.

For multi-instance deployments, use a shared rate-limit store and Socket.IO adapter, configure trusted proxies deliberately, and test backups and restores before launch.

For isolated browser acceptance, run `npm run smoke` and use `http://127.0.0.1:4002/register`. This creates a temporary MongoDB database and never copies Atlas data. Stop with Ctrl+C.

### File: `scripts/smoke.mjs`

```javascript
// Disposable browser acceptance environment; never reads the configured database URI.
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
const port = Number(process.env.SMOKE_PORT || 4002);
const mongo = await MongoMemoryServer.create();
Object.assign(process.env, {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(port),
  MONGODB_URI: mongo.getUri('flowboard_browser_test'),
  CLIENT_ORIGIN: `http://127.0.0.1:${port}`,
  JWT_SECRET: randomBytes(48).toString('hex'),
  SERVE_CLIENT: 'true',
  TRUST_PROXY: '',
});
let io;
let disconnectDatabase;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (io) await new Promise((resolve) => io.close(resolve));
  await disconnectDatabase?.();
  await mongo.stop();
}
try {
  const db = await import('../server/src/config/db.js');
  disconnectDatabase = db.disconnectDatabase;
  await db.connectDatabase();
  const { createApplication } = await import('../server/src/app.js');
  const application = createApplication();
  io = application.io;
  await new Promise((resolve, reject) => {
    application.server.once('error', reject);
    application.server.listen(port, '127.0.0.1', resolve);
  });
  console.log(`Disposable Flowboard: http://127.0.0.1:${port}/register`);
  console.log('This database is temporary. Ctrl+C stops the server and removes its test data.');
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
} catch (error) {
  console.error(`Smoke startup failed: ${error.name}`);
  await stop();
  process.exitCode = 1;
}
```

## 13. Verification, CI, and source checks

See [the verification record](docs/verification.md) and [complete audit report](docs/audit-report.md) for reviewed issues, fixes, test results and remaining deployment limits.

Tests use a disposable local MongoDB process and mock browser requests; they do not write to the configured Atlas database. The first server test run may download a MongoDB executable. CI runs the same checks, formatting, tests, build, and guide-regeneration verification.

### File: `scripts/check.mjs`

```javascript
import { readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
function check(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.local', '.test-artifacts'].includes(item.name)) continue;
    const file = resolve(dir, item.name);
    if (item.isDirectory()) check(file);
    else if (['.js', '.mjs'].includes(extname(file))) {
      const result = spawnSync(process.execPath, ['--check', file], {
        stdio: 'inherit',
        windowsHide: true,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
check(root);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script using npm run check');
const lint = spawnSync(process.execPath, [npmCli, 'run', 'lint'], {
  stdio: 'inherit',
  windowsHide: true,
});
if (lint.error) throw lint.error;
process.exit(lint.status ?? 1);
```

### File: `.github/workflows/ci.yml`

```yaml
name: Flowboard checks
on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      MONGOMS_VERSION: 7.0.24
      MONGOMS_DISABLE_POSTINSTALL: '1'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run format:check
      - run: npm test
      - run: npm run build
      - run: npm run guide && git diff --exit-code -- README.md
```

### File: `eslint.config.js`

```javascript
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '.local/**',
      '.test-artifacts/**',
      'frontend/**',
      'backend/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
```

### File: `.prettierrc`

```text
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

### File: `.prettierignore`

```text
node_modules
**/dist
.local
.test-artifacts
**/.env
package-lock.json
README.md
docs/guide.template.md
```

### File: `.gitignore`

```text
node_modules/
dist/
.env
.env.*
!.env.example
coverage/
.test-artifacts/
.local/
*.log
```

### File: `shared/tests/auth.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentials } from '../schemas/auth.js';
test('shared password validation preserves Node UTF-8 byte limits in browser-safe code', () => {
  for (const password of [
    'a'.repeat(7),
    'a'.repeat(8),
    'a'.repeat(72),
    'a'.repeat(73),
    '🧩'.repeat(18),
    '🧩'.repeat(19),
    'é'.repeat(36),
    'é'.repeat(37),
    'abcde\ud800'.repeat(9),
    'abcde\ud800'.repeat(10),
  ]) {
    const expected =
      password.length >= 8 && password.length <= 72 && Buffer.byteLength(password, 'utf8') <= 72;
    assert.equal(
      credentials.safeParse({ email: 'person@example.com', password }).success,
      expected,
    );
  }
});
```

### File: `server/tests/api.test.js`

```javascript
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as clientIo } from 'socket.io-client';
const testSecret = randomBytes(48).toString('hex');
const testOrigin = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testSecret;
process.env.CLIENT_ORIGIN = testOrigin;
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused_test_placeholder';
const { createApplication } = await import('../src/app.js');
const { User } = await import('../src/modules/users/users.model.js');
const { Board } = await import('../src/modules/boards/boards.model.js');
let mongo;
let app;
let server;
let io;
let origin;
const sockets = [];
const protect = (req) => req.set('X-Flowboard-Request', '1').set('Origin', testOrigin);
const register = (agent, name) =>
  protect(agent.post('/api/auth/register')).send({
    name,
    email: `${name}@example.com`,
    password: 'Testing123!safe',
  });
const registerAndLogin = async (agent, name) => {
  assert.equal((await register(agent, name)).status, 201);
  const response = await protect(agent.post('/api/auth/login')).send({
    email: `${name}@example.com`,
    password: 'Testing123!safe',
  });
  assert.equal(response.status, 200);
  return response;
};
const event = (socket, name) =>
  new Promise((resolve, reject) => {
    const done = (value) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      socket.off(name, done);
      reject(new Error(`Timed out waiting for ${name}`));
    }, 5000);
    socket.once(name, done);
  });
const socketFor = (cookie) => {
  const socket = clientIo(origin, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Cookie: cookie, Origin: testOrigin },
  });
  sockets.push(socket);
  return socket;
};
before(async () => {
  mongo = await MongoMemoryServer.create();
  const { config } = await import('../src/config/env.js');
  config.MONGODB_URI = mongo.getUri('flowboard_test');
  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  ({ app, server, io } = createApplication());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (io) await new Promise((resolve) => io.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});
test('registration, duplicate email, login, safe session response and logout revocation', async () => {
  const agent = request.agent(app);
  const response = await register(agent, 'alice');
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body.user).sort(), ['_id', 'email', 'name']);
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
  assert.equal((await agent.get('/api/boards')).status, 401);
  assert.equal((await register(request.agent(app), 'alice')).status, 409);
  assert.equal(
    (
      await protect(agent.post('/api/auth/login')).send({
        email: 'alice@example.com',
        password: 'wrong-password',
      })
    ).status,
    401,
  );
  const login = await protect(agent.post('/api/auth/login')).send({
    email: 'ALICE@example.com',
    password: 'Testing123!safe',
  });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/);
  const oldCookie = login.headers['set-cookie'][0].split(';')[0];
  assert.equal((await agent.get('/api/auth/me')).body.user._id, response.body.user._id);
  const socket = socketFor(oldCookie);
  const connected = event(socket, 'session:ready');
  socket.connect();
  await connected;
  const disconnected = event(socket, 'disconnect');
  assert.equal((await protect(agent.post('/api/auth/logout')).send({})).status, 204);
  await disconnected;
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status, 401);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});
test('board, column and card CRUD with order persistence and atomic cross-column moves', async () => {
  const agent = request.agent(app);
  await registerAndLogin(agent, 'bob');
  const response = await protect(agent.post('/api/boards')).send({ title: 'Launch' });
  assert.equal(response.status, 201);
  let board = response.body.board;
  const path = `/api/boards/${board._id}`;
  assert.equal((await agent.get('/api/boards')).body.boards.length, 1);
  assert.equal((await agent.get(path)).body.board.title, 'Launch');
  assert.equal((await agent.get(`${path}/columns`)).body.columns.length, 3);
  async function write(method, suffix, body = {}, expected = 200) {
    const result = await protect(agent[method](`${path}${suffix}`)).send({
      ...body,
      version: board.__v,
    });
    assert.equal(result.status, expected, JSON.stringify(result.body));
    if (result.body.board) board = result.body.board;
    return result;
  }
  await write('patch', '', { title: 'Product launch', description: 'September' });
  await write('post', '/columns', { title: 'Review' }, 201);
  const reviewId = board.columns.at(-1)._id;
  await write('patch', `/columns/${reviewId}`, { title: 'QA' });
  assert.equal((await agent.get(`${path}/columns/${reviewId}`)).body.column.title, 'QA');
  const sourceId = board.columns[0]._id;
  const targetId = board.columns[1]._id;
  for (const title of ['First', 'Second', 'Third'])
    await write('post', `/columns/${sourceId}/cards`, { title }, 201);
  const [first, second, third] = board.columns[0].cards;
  const firstPath = `/columns/${sourceId}/cards/${first._id}`;
  await write('patch', firstPath, {
    description: 'Keep this text',
    priority: 'high',
    labels: ['release'],
    dueDate: '2026-10-01T00:00:00.000Z',
  });
  assert.equal((await agent.get(`${path}${firstPath}`)).body.card.priority, 'high');
  assert.equal((await agent.get(`${path}/columns/${sourceId}/cards`)).body.cards.length, 3);
  await write('post', `/cards/${first._id}/move`, {
    sourceColumnId: sourceId,
    targetColumnId: sourceId,
    targetIndex: 2,
  });
  assert.deepEqual(
    board.columns[0].cards.map((card) => card._id),
    [second._id, third._id, first._id],
  );
  await write('post', `/cards/${first._id}/move`, {
    sourceColumnId: sourceId,
    targetColumnId: targetId,
    targetIndex: 0,
  });
  assert.equal(board.columns[0].cards.length, 2);
  assert.equal(board.columns[1].cards[0]._id, first._id);
  assert.equal(board.columns[1].cards[0].description, 'Keep this text');
  const persisted = (await agent.get(path)).body.board;
  assert.deepEqual(persisted.columns[1].cards, board.columns[1].cards);
  await write('delete', `/columns/${targetId}/cards/${first._id}`);
  assert.equal(board.columns[1].cards.length, 0);
  await write('delete', `/columns/${sourceId}`);
  assert.equal(
    board.columns.some((col) => col._id === sourceId),
    false,
  );
  await write('delete', '', {}, 204);
  assert.equal((await agent.get(path)).status, 404);
  assert.equal((await agent.get('/api/boards')).body.boards.length, 0);
});
test('ownership, malformed IDs, strict input, CSRF header and CORS checks', async () => {
  const owner = request.agent(app),
    stranger = request.agent(app);
  await registerAndLogin(owner, 'carol');
  await registerAndLogin(stranger, 'dave');
  const board = (await protect(owner.post('/api/boards')).send({ title: 'Private' })).body.board;
  const path = `/api/boards/${board._id}`;
  assert.equal((await stranger.get(path)).status, 404);
  assert.equal(
    (await protect(stranger.patch(path)).send({ title: 'Stolen', version: board.__v })).status,
    404,
  );
  assert.equal((await protect(stranger.delete(path)).send({ version: board.__v })).status, 404);
  assert.equal((await stranger.get(`${path}/columns/${board.columns[0]._id}/cards`)).status, 404);
  assert.equal((await stranger.get('/api/boards')).body.boards.length, 0);
  assert.equal((await request(app).get('/api/boards')).status, 401);
  assert.equal((await owner.get('/api/boards/not-an-id')).status, 400);
  assert.equal(
    (
      await protect(owner.patch(path)).send({
        owner: new mongoose.Types.ObjectId().toString(),
        version: board.__v,
      })
    ).status,
    400,
  );
  assert.equal(
    (await protect(owner.patch(path)).send({ title: '   ', version: board.__v })).status,
    400,
  );
  assert.equal((await owner.post('/api/boards').send({ title: 'CSRF' })).status, 403);
  assert.equal(
    (
      await protect(owner.post('/api/boards'))
        .set('Origin', 'https://evil.example')
        .send({ title: 'CSRF' })
    ).status,
    403,
  );
  assert.equal(
    (await protect(owner.post('/api/boards')).set('Content-Type', 'application/json').send('{'))
      .status,
    400,
  );
  const preflight = await request(app)
    .options('/api/boards')
    .set('Origin', testOrigin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'X-Flowboard-Request,Content-Type');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.equal(preflight.headers['access-control-allow-origin'], testOrigin);
});
test('stale and simultaneous edits return 409; invalid moves never remove a card', async () => {
  const agent = request.agent(app);
  await registerAndLogin(agent, 'eve');
  let board = (await protect(agent.post('/api/boards')).send({ title: 'Concurrent' })).body.board;
  const path = `/api/boards/${board._id}`,
    col = board.columns[0]._id;
  const create = await protect(agent.post(`${path}/columns/${col}/cards`)).send({
    title: 'Keep me',
    version: board.__v,
  });
  assert.equal(create.status, 201);
  board = create.body.board;
  const id = board.columns[0].cards[0]._id;
  const badMove = await protect(agent.post(`${path}/cards/${id}/move`)).send({
    sourceColumnId: col,
    targetColumnId: col,
    targetIndex: 20,
    version: board.__v,
  });
  assert.equal(badMove.status, 400);
  assert.equal((await agent.get(path)).body.board.columns[0].cards[0]._id, id);
  const other = (await protect(agent.post('/api/boards')).send({ title: 'Other' })).body.board;
  assert.equal(
    (
      await protect(agent.post(`${path}/cards/${id}/move`)).send({
        sourceColumnId: col,
        targetColumnId: other.columns[0]._id,
        targetIndex: 0,
        version: board.__v,
      })
    ).status,
    404,
  );
  const results = await Promise.all(
    ['A', 'B'].map((title) => protect(agent.patch(path)).send({ title, version: board.__v })),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await protect(agent.delete(path)).send({ version: board.__v })).status, 409);
  assert.equal((await agent.get(path)).body.board.columns[0].cards[0]._id, id);
});
test('real-time notifications require valid cookies and are isolated per user', async () => {
  const owner = request.agent(app),
    other = request.agent(app);
  const response = await registerAndLogin(owner, 'frank');
  const otherResponse = await registerAndLogin(other, 'grace');
  const socket = socketFor(response.headers['set-cookie'][0].split(';')[0]);
  const otherSocket = socketFor(otherResponse.headers['set-cookie'][0].split(';')[0]);
  const invalid = socketFor('flowboard=invalid');
  const rejected = event(invalid, 'connect_error');
  invalid.connect();
  await rejected;
  const exp = jwt.sign({ ver: 0 }, testSecret, {
    subject: response.body.user._id,
    expiresIn: -1,
    algorithm: 'HS256',
    issuer: 'flowboard-api',
    audience: 'flowboard-web',
  });
  assert.equal(
    (await request(app).get('/api/auth/me').set('Cookie', `flowboard=${exp}`)).status,
    401,
  );
  const connected = event(socket, 'session:ready'),
    otherConnected = event(otherSocket, 'session:ready');
  socket.connect();
  otherSocket.connect();
  await Promise.all([connected, otherConnected]);
  const leaked = [];
  otherSocket.on('boards:changed', (payload) => leaked.push(payload));
  const changed = event(socket, 'boards:changed');
  const board = (await protect(owner.post('/api/boards')).send({ title: 'Live' })).body.board;
  assert.equal((await changed).boardId, board._id);
  // Give the independent socket's transport a turn to deliver any accidental broadcast.
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(leaked.length, 0);
});
test('UTF-8 password bounds and document limits are validated', async () => {
  const agent = request.agent(app);
  const password = await protect(agent.post('/api/auth/register')).send({
    name: 'Too long',
    email: 'long@example.com',
    password: '🧩'.repeat(25),
  });
  assert.equal(password.status, 400);
  const board = new Board({
    owner: new mongoose.Types.ObjectId(),
    title: 'Limits',
    columns: Array.from({ length: 31 }, () => ({ title: 'Column' })),
  });
  await assert.rejects(board.validate());
  board.set('columns', [
    { title: 'Many', cards: Array.from({ length: 501 }, () => ({ title: 'Task' })) },
  ]);
  await assert.rejects(board.validate());
});

async function fixtureSession(name) {
  const user = await User.create({
    name,
    email: `${name}@example.com`,
    passwordHash: 'isolated-test-fixture',
  });
  const token = jwt.sign({ ver: 0 }, testSecret, {
    subject: user._id.toString(),
    expiresIn: 3600,
    algorithm: 'HS256',
    issuer: 'flowboard-api',
    audience: 'flowboard-web',
  });
  return { user, cookie: `flowboard=${token}` };
}

test('board pagination is bounded, ordered, owner-scoped, and clamps deleted/out-of-range pages', async () => {
  const { user, cookie } = await fixtureSession('pagination');
  await Board.create(
    Array.from({ length: 25 }, (_, index) => ({ owner: user._id, title: `Page board ${index}` })),
  );
  const first = await request(app).get('/api/boards').set('Cookie', cookie);
  assert.equal(first.status, 200);
  assert.equal(first.body.boards.length, 24);
  assert.equal(first.body.total, 25);
  assert.equal(first.body.pages, 2);
  assert.ok(
    first.body.boards.every(
      (board) => board.owner === user._id.toString() && board.columns === undefined,
    ),
  );
  const last = await request(app).get('/api/boards?page=2').set('Cookie', cookie);
  assert.equal(last.body.boards.length, 1);
  assert.ok(!first.body.boards.some((board) => board._id === last.body.boards[0]._id));
  await Board.deleteOne({ _id: last.body.boards[0]._id });
  const clamped = await request(app).get('/api/boards?page=2').set('Cookie', cookie);
  assert.equal(clamped.body.page, 1);
  for (const query of ['page=-1', 'limit=101', 'page=Infinity', 'page=1&page=2', 'unknown=1']) {
    assert.equal(
      (await request(app).get(`/api/boards?${query}`).set('Cookie', cookie)).status,
      400,
    );
  }
});

test('readiness reports database failures without leaking connection details', async (t) => {
  assert.equal((await request(app).get('/api/ready')).status, 200);
  const stub = t.mock.method(mongoose.connection.db, 'command', async () => {
    throw new Error('private database detail');
  });
  assert.equal((await request(app).get('/api/health')).status, 200);
  const response = await request(app).get('/api/ready');
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { status: 'unavailable' });
  stub.mock.restore();
  assert.equal((await request(app).get('/api/ready')).status, 200);
});

test('logout revokes a socket whose first authentication lookup was already in flight', async (t) => {
  const { user, cookie } = await fixtureSession('delayed-socket');
  const original = User.findById.bind(User);
  let release;
  let started;
  const captured = new Promise((resolve) => {
    started = resolve;
  });
  let first = true;
  t.mock.method(User, 'findById', (...args) => {
    if (!first) return original(...args);
    first = false;
    return {
      select: async (fields) => {
        const snapshot = await original(...args).select(fields);
        started();
        await new Promise((resolve) => {
          release = resolve;
        });
        return snapshot;
      },
    };
  });
  const socket = socketFor(cookie);
  const notifications = [];
  const ready = [];
  socket.on('boards:changed', (data) => notifications.push(data));
  socket.on('session:ready', () => ready.push(true));
  socket.connect();
  await captured;
  const { revokeSessions } = await import('../src/modules/auth/auth.service.js');
  await revokeSessions(user, io);
  const disconnected = event(socket, 'disconnect');
  release();
  await disconnected;
  io.to(`user:${user._id}`).emit('boards:changed', { boardId: 'private' });
  assert.equal(ready.length, 0);
  assert.equal(notifications.length, 0);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookie)).status, 401);
});

test('an authenticated socket disconnects when its token expires', async () => {
  const { user } = await fixtureSession('expiring-socket');
  const token = jwt.sign({ ver: 0 }, testSecret, {
    subject: user._id.toString(),
    expiresIn: 2,
    algorithm: 'HS256',
    issuer: 'flowboard-api',
    audience: 'flowboard-web',
  });
  const socket = socketFor(`flowboard=${token}`);
  const ready = event(socket, 'session:ready');
  socket.connect();
  await ready;
  assert.equal(await event(socket, 'disconnect'), 'io server disconnect');
});
```

### File: `server/tests/deployment.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { environmentSchema } from '../src/config/environment.schema.js';
import { mountClient } from '../src/middleware/client.middleware.js';
import { authenticationLimiter } from '../src/middleware/rateLimit.middleware.js';
const base = {
  MONGODB_URI: 'mongodb://127.0.0.1/isolated',
  CLIENT_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: randomBytes(48).toString('hex'),
};

test('production configuration requires HTTPS and explicit proxy addresses', () => {
  assert.equal(environmentSchema.parse(base).HOST, '127.0.0.1');
  for (const TRUST_PROXY of ['true', '1', '0.0.0.0/99', 'my-proxy']) {
    assert.equal(environmentSchema.safeParse({ ...base, TRUST_PROXY }).success, false);
  }
  assert.deepEqual(
    environmentSchema.parse({ ...base, TRUST_PROXY: 'loopback,10.10.0.0/24' }).TRUST_PROXY,
    ['loopback', '10.10.0.0/24'],
  );
  for (const CLIENT_ORIGIN of [
    'not-a-url',
    'ftp://example.com',
    'https://example.com/',
    'https://example.com/path',
  ]) {
    assert.equal(environmentSchema.safeParse({ ...base, CLIENT_ORIGIN }).success, false);
  }
  assert.equal(environmentSchema.safeParse({ ...base, NODE_ENV: 'production' }).success, false);
  assert.equal(
    environmentSchema.safeParse({
      ...base,
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://flowboard.example.com',
    }).success,
    true,
  );
});

test('trusted reverse proxies preserve separate per-client authentication limits', async () => {
  const app = express();
  app.set('trust proxy', ['loopback']);
  app.use(authenticationLimiter());
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  for (let index = 0; index < 30; index++) {
    assert.equal((await request(app).get('/').set('X-Forwarded-For', '198.51.100.1')).status, 200);
  }
  assert.equal((await request(app).get('/').set('X-Forwarded-For', '198.51.100.1')).status, 429);
  const other = await request(app).get('/').set('X-Forwarded-For', '203.0.113.9');
  assert.equal(other.status, 200);
  assert.equal(other.body.ip, '203.0.113.9');
});

test('production hosting serves deep links and cached assets without exposing private files or hiding API 404s', async () => {
  const directory = fileURLToPath(new URL('../../.test-artifacts/hosting/', import.meta.url));
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><title>Flowboard test</title>',
  );
  await writeFile(path.join(directory, 'assets', 'index-test.js'), 'window.fixture = true;');
  await writeFile(path.join(directory, '.env'), 'PRIVATE_FIXTURE=not-a-secret');
  const app = express();
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  mountClient(app, directory);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  const page = await request(app)
    .get('/boards/507f1f77bcf86cd799439012')
    .set('Accept', 'text/html');
  assert.equal(page.status, 200);
  assert.match(page.text, /Flowboard test/);
  assert.equal(page.headers['cache-control'], 'no-cache');
  const asset = await request(app).get('/assets/index-test.js');
  assert.match(asset.headers['cache-control'], /immutable/);
  for (const url of ['/api/missing', '/assets/missing.js', '/.env']) {
    assert.equal((await request(app).get(url)).status, 404);
  }
  assert.throws(
    () => mountClient(express(), path.join(directory, 'missing')),
    /Client build is missing/,
  );
});
```

### File: `client/tests/app.test.jsx`

```jsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/hooks/AuthContext';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { Kanban } from '@/features/boards/components/Kanban';
import App from '@/App';
import { authApi } from '@/features/auth/auth.api';
import { boardsApi as api } from '@/features/boards/boards.api';
import { request } from '@/services/http';
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
const user = { _id: '507f1f77bcf86cd799439011', name: 'Test User', email: 'test@example.com' };
const board = {
  _id: '507f1f77bcf86cd799439012',
  owner: user._id,
  title: 'Launch',
  description: '',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  __v: 3,
  columns: [
    {
      _id: '507f1f77bcf86cd799439013',
      title: 'To do',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [
        {
          _id: '507f1f77bcf86cd799439014',
          title: 'Write guide',
          description: '',
          priority: 'medium',
          labels: [],
          dueDate: null,
          createdAt: '2026-09-15T00:00:00.000Z',
          updatedAt: '2026-09-15T00:00:00.000Z',
        },
      ],
    },
    {
      _id: '507f1f77bcf86cd799439015',
      title: 'Done',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [],
    },
  ],
};
const json = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});
describe('API contract and session handling', () => {
  it('sends cookies, protection header, versions and the matching move endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ board }));
    vi.stubGlobal('fetch', fetchMock);
    await api.moveCard(
      board._id,
      board.columns[0].cards[0]._id,
      {
        sourceColumnId: board.columns[0]._id,
        targetColumnId: board.columns[1]._id,
        targetIndex: 0,
      },
      3,
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/boards/${board._id}/cards/${board.columns[0].cards[0]._id}/move`);
    expect(options.credentials).toBe('include');
    expect(options.headers['X-Flowboard-Request']).toBe('1');
    expect(JSON.parse(options.body)).toMatchObject({ version: 3, targetIndex: 0 });
  });
  it('handles 204 responses, network errors and expired sessions', async () => {
    const expired = vi.fn();
    window.addEventListener('flowboard:unauthorized', expired);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(null, 204))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ error: 'Please sign in again' }, 401));
    vi.stubGlobal('fetch', fetchMock);
    expect(await authApi.logout()).toBeNull();
    await expect(api.boards()).rejects.toMatchObject({ status: 0 });
    await expect(api.boards()).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('flowboard:unauthorized', expired);
  });
  it('renders loading, restores a session and creates a board through the UI', async () => {
    let release;
    vi.spyOn(authApi, 'me').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.spyOn(api, 'boards').mockResolvedValue({ boards: [] });
    vi.spyOn(api, 'board').mockResolvedValue({ board });
    const create = vi.spyOn(api, 'createBoard').mockResolvedValue({ board });
    render(
      <MemoryRouter initialEntries={['/boards']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Restoring');
    release({ user });
    await screen.findByRole('button', { name: 'Create board' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Create board' }), 'Launch');
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }));
    await screen.findByRole('heading', { name: 'Launch' });
    expect(create).toHaveBeenCalledWith({ title: 'Launch' });
  });
  it('shows login errors and protects boards when no session exists', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid email or password'));
    render(
      <MemoryRouter initialEntries={['/boards']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Sign in' });
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'bad-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
it('creates an account, shows login confirmation, and requires a separate sign-in', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
  const register = vi.spyOn(authApi, 'register').mockResolvedValue({ user });
  const login = vi.spyOn(authApi, 'login').mockResolvedValue({ user });
  const boards = vi.spyOn(api, 'boards').mockResolvedValue({ boards: [] });
  render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Create account' });
  await userEvent.type(screen.getByLabelText('Name'), user.name);
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Account created successfully. Please sign in.',
  );
  expect(register).toHaveBeenCalledWith({
    name: user.name,
    email: user.email,
    password: 'Testing123!safe',
  });
  expect(login).not.toHaveBeenCalled();
  expect(boards).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Password')).toHaveValue('');
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('button', { name: 'Create board' });
  expect(login).toHaveBeenCalledWith({ email: user.email, password: 'Testing123!safe' });
});
it('keeps failed registration on the account form without signing in', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
  vi.spyOn(authApi, 'register').mockRejectedValue(
    new Error('An account with that email already exists'),
  );
  const login = vi.spyOn(authApi, 'login');
  render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Create account' });
  await userEvent.type(screen.getByLabelText('Name'), user.name);
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An account with that email already exists',
  );
  expect(screen.getByLabelText('Name')).toHaveValue(user.name);
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  expect(login).not.toHaveBeenCalled();
});
it('moves a card through the accessible column menu with the correct source, destination and version', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const move = vi.spyOn(api, 'moveCard').mockResolvedValue({ board });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  fireEvent.change(screen.getByLabelText('Move Write guide to column'), {
    target: { value: board.columns[1]._id },
  });
  await waitFor(() =>
    expect(move).toHaveBeenCalledWith(
      board._id,
      board.columns[0].cards[0]._id,
      {
        sourceColumnId: board.columns[0]._id,
        targetColumnId: board.columns[1]._id,
        targetIndex: 0,
      },
      3,
    ),
  );
});
it('preserves AbortError so cancelled requests are not mislabeled as network failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
  await expect(request('/boards')).rejects.toMatchObject({ name: 'AbortError' });
});
it('allows a native button handle to lift a card with the keyboard and cancel without saving', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const move = vi.spyOn(api, 'moveCard').mockResolvedValue({ board });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  const handle = screen.getByRole('button', { name: 'Drag Write guide' });
  handle.focus();
  fireEvent.keyDown(handle, { key: ' ', code: 'Space', keyCode: 32, which: 32 });
  await waitFor(() =>
    expect(screen.getByText('You have lifted an item in position 1')).toBeInTheDocument(),
  );
  fireEvent.keyDown(handle, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27 });
  await waitFor(() => expect(screen.getByText(/Movement cancelled/)).toBeInTheDocument());
  expect(move).not.toHaveBeenCalled();
});

it('preserves an open card draft and blocks overwriting a newer live board version', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const update = vi.spyOn(api, 'updateCard');
  const view = render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await userEvent.type(screen.getByLabelText('Card title'), ' draft');
  const changed = structuredClone(board);
  changed.__v++;
  changed.columns[0].cards[0].title = 'Remote edit';
  view.rerender(
    <BoardProvider>
      <Kanban board={changed} />
    </BoardProvider>,
  );
  expect(screen.getByLabelText('Card title')).toHaveValue('Write guide draft');
  expect(screen.getByRole('status')).toHaveTextContent('board changed');
  expect(screen.getByRole('button', { name: 'Save card' })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText('Card title').closest('form'));
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  expect(screen.getByLabelText('Card title')).toHaveValue('Remote edit');
});

it('loads the next board page through accessible navigation', async () => {
  vi.spyOn(authApi, 'me').mockResolvedValue({ user });
  const list = vi.spyOn(api, 'boards').mockImplementation(async (page) => ({
    boards: [{ ...board, title: page === 2 ? 'Second page board' : 'First page board' }],
    page,
    pages: 2,
    total: 25,
  }));
  render(
    <MemoryRouter initialEntries={['/boards']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText('First page board');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Second page board');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(list).toHaveBeenLastCalledWith(
    2,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

it('restores drag handles when a card being edited is deleted in another tab', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const withTwoCards = structuredClone(board);
  withTwoCards.columns[0].cards.push({
    ...board.columns[0].cards[0],
    _id: '507f1f77bcf86cd799439099',
    title: 'Remaining task',
  });
  const view = render(
    <BoardProvider>
      <Kanban board={withTwoCards} />
    </BoardProvider>,
  );
  await userEvent.click(screen.getAllByRole('button', { name: 'Edit', exact: true })[0]);
  const changed = structuredClone(withTwoCards);
  changed.columns[0].cards.shift();
  changed.__v++;
  view.rerender(
    <BoardProvider>
      <Kanban board={changed} />
    </BoardProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Drag Remaining task' })).toHaveAttribute(
      'data-rfd-drag-handle-draggable-id',
    ),
  );
});
```

### File: `client/tests/card-create.test.jsx`

```jsx
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApi as api } from '@/features/boards/boards.api';
import { Kanban } from '@/features/boards/components/Kanban';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
const board = {
  _id: '507f1f77bcf86cd799439012',
  title: 'Launch',
  description: '',
  owner: '507f1f77bcf86cd799439011',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  __v: 3,
  columns: [
    {
      _id: '507f1f77bcf86cd799439013',
      title: 'To do',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [],
    },
    {
      _id: '507f1f77bcf86cd799439015',
      title: 'Done',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [],
    },
  ],
};
const details = {
  title: 'Write release notes',
  description: 'Include the new card fields.',
  priority: 'high',
  dueDate: '2026-10-20T00:00:00.000Z',
  labels: ['release', 'documentation'],
};
function renderBoard() {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  return userEvent.setup();
}
async function enterDetails(user) {
  await user.type(screen.getByLabelText('Card title'), `  ${details.title}  `);
  await user.type(screen.getByLabelText('Description'), details.description);
  await user.selectOptions(screen.getByRole('combobox', { name: /Priority/ }), details.priority);
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
  await user.type(screen.getByLabelText('Labels, separated by commas'), 'release, documentation, ');
}
describe('creating cards with full details', () => {
  it('opens the full form and discards a canceled draft without creating a card', async () => {
    const create = vi.spyOn(api, 'createCard').mockResolvedValue({ board });
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    expect(screen.getByLabelText('Card title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /Priority/ })).toHaveValue('medium');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByLabelText('Labels, separated by commas')).toHaveValue('');
    expect(create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Card title'), 'Canceled draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    expect(screen.getByLabelText('Card title')).toHaveValue('');
  });
  it('submits every detail to the selected column and waits for success before closing', async () => {
    let finishCreation;
    const create = vi.spyOn(api, 'createCard').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreation = resolve;
        }),
    );
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to Done' }));
    await enterDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    expect(create).toHaveBeenCalledExactlyOnceWith(
      board._id,
      board.columns[1]._id,
      details,
      board.__v,
    );
    expect(screen.getByLabelText('Card title')).toHaveValue(`  ${details.title}  `);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      finishCreation({ board });
    });
    await waitFor(() => expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add card to Done' })).toBeEnabled();
  });
  it('preserves every draft field after a failed request and lets the user retry', async () => {
    const create = vi
      .spyOn(api, 'createCard')
      .mockRejectedValueOnce(new Error('Unable to create card'))
      .mockResolvedValueOnce({ board });
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    await enterDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create card' })).toBeEnabled());
    expect(create).toHaveBeenCalledExactlyOnceWith(
      board._id,
      board.columns[0]._id,
      details,
      board.__v,
    );
    expect(screen.getByLabelText('Card title')).toHaveValue(`  ${details.title}  `);
    expect(screen.getByLabelText('Description')).toHaveValue(details.description);
    expect(screen.getByRole('combobox', { name: /Priority/ })).toHaveValue(details.priority);
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('Labels, separated by commas')).toHaveValue(
      'release, documentation, ',
    );
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument());
    expect(create).toHaveBeenNthCalledWith(2, board._id, board.columns[0]._id, details, board.__v);
  });
});
```

### File: `client/tests/resilience.test.jsx`

```jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { request, advanceSession } from '@/services/http';
import { AuthProvider, useAuth } from '@/features/auth/hooks/AuthContext';
import { authApi } from '@/features/auth/auth.api';
import { CardForm } from '@/features/boards/components/CardForm';
import { TitleForm } from '@/components/common/TitleForm';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

it('times out stalled requests and preserves explicit cancellation while reading a body', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ),
  );
  await expect(request('/boards', { timeoutMs: 20 })).rejects.toMatchObject({ status: 408 });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    }),
  );
  await expect(request('/boards')).rejects.toMatchObject({ name: 'AbortError' });
});

it('ignores unauthorized responses from an older session', async () => {
  let finish;
  const expired = vi.fn();
  window.addEventListener('flowboard:unauthorized', expired);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const pending = request('/boards');
  advanceSession();
  finish({ status: 401, ok: false, json: async () => ({ error: 'Expired' }) });
  await expect(pending).rejects.toMatchObject({ status: 401 });
  expect(expired).not.toHaveBeenCalled();
  window.removeEventListener('flowboard:unauthorized', expired);
});

it('discards late session restoration after sign-in, including StrictMode double effects', async () => {
  const releases = [];
  vi.spyOn(authApi, 'me').mockImplementation(
    () => new Promise((resolve) => releases.push(resolve)),
  );
  vi.spyOn(authApi, 'login').mockResolvedValue({ user: { name: 'New session' } });
  function Session() {
    const { user, signIn } = useAuth();
    return (
      <>
        <span>{user?.name || 'Guest'}</span>
        <button onClick={() => signIn({})}>Login</button>
      </>
    );
  }
  render(
    <StrictMode>
      <AuthProvider>
        <Session />
      </AuthProvider>
    </StrictMode>,
  );
  fireEvent.click(screen.getByText('Login'));
  await screen.findByText('New session');
  await act(async () => releases.forEach((resolve) => resolve({ user: { name: 'Old session' } })));
  expect(screen.getByText('New session')).toBeInTheDocument();
});

it('locks draft fields, blocks duplicate submits, and preserves an unchanged due timestamp', async () => {
  let finish;
  const submit = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const cancel = vi.fn();
  render(
    <CardForm
      card={{ title: 'Task', dueDate: '2026-10-20T15:30:00.000Z' }}
      onSubmit={submit}
      onCancel={cancel}
    />,
  );
  const form = screen.getByText('Save card').closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledOnce();
  expect(submit.mock.calls[0][0].dueDate).toBe('2026-10-20T15:30:00.000Z');
  expect(screen.getByLabelText('Card title')).toBeDisabled();
  await act(async () => finish(false));
  expect(screen.getByLabelText('Card title')).toBeEnabled();
  expect(cancel).not.toHaveBeenCalled();
});

it('rejects whitespace titles without a request and preserves the form after errors', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('Unavailable'));
  render(<TitleForm label="Create board" onSubmit={submit} />);
  const input = screen.getByLabelText('Create board');
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.submit(input.closest('form'));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('non-space');
  fireEvent.change(input, { target: { value: 'Keep my draft' } });
  fireEvent.submit(input.closest('form'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unavailable'));
  expect(input).toHaveValue('Keep my draft');
});

it('renders a recovery screen when a component crashes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() {
    throw new Error('Private stack detail');
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.queryByText('Private stack detail')).not.toBeInTheDocument();
});

it('saves a date entered through a native input event', async () => {
  const submit = vi.fn().mockResolvedValue(true);
  render(<CardForm card={{ title: 'Dated task' }} onSubmit={submit} onCancel={vi.fn()} />);
  fireEvent.input(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: '2026-10-20T00:00:00.000Z' }),
    ),
  );
});
```

### File: `client/tests/live-sync.test.jsx`

```jsx
import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { boardsApi } from '@/features/boards/boards.api';
const transport = vi.hoisted(() => ({
  handlers: {},
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('socket.io-client', () => ({
  io: () => ({
    ...transport,
    on: (event, callback) => {
      transport.handlers[event] = callback;
    },
  }),
}));
it('retries a rejected socket handshake and stops retrying after unmount', async () => {
  vi.useFakeTimers();
  try {
    vi.spyOn(boardsApi, 'boards').mockResolvedValue({ boards: [] });
    const view = render(
      <BoardProvider>
        <p>Workspace</p>
      </BoardProvider>,
    );
    await act(async () => transport.handlers.connect_error());
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(transport.connect).toHaveBeenCalledOnce();
    await act(async () => transport.handlers.connect_error());
    view.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport.connect).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
```

### File: `client/tests/setup.js`

```javascript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
```

Manual acceptance: create an account, confirm that the login page appears, then sign in explicitly. Create a board and full-detail card; reload to check persistence; edit and move a card; check a second tab receives updates; sign out everywhere and confirm both tabs lose access. Use `git diff main` to review the current changes.

## 14. Common errors and conversion notes

- **Connection refused:** start `npm run dev`, then check API health. A browser page alone does not start the API.
- **Port occupied:** close the earlier app process before starting another. Avoid stopping unrelated Node processes.
- **MongoDB connection fails:** check the URI, database user/password, Atlas IP allowlist, network, or local database service. Encode special characters in URI credentials.
- **401 or JWT expiry:** sign in again. Tokens last one hour; changing the secret or signing out everywhere invalidates sessions.
- **403/CORS:** use the exact CLIENT_ORIGIN, send the request protection header, and keep credentials enabled. localhost and 127.0.0.1 are distinct origins.
- **400/413/415:** correct invalid input, excessive payloads, or missing JSON Content-Type.
- **409:** reload the current board before retrying. Inspect whether a failed network response already saved a create operation.
- **429:** authentication attempts are throttled; wait before retrying.
- **Blank page or broken imports:** install at the root, then run check, tests, and build. Use the new .js/.jsx paths.
- **Live updates reconnecting:** check /socket.io proxying, cookies, session expiry, and WebSocket upgrades.
- **Production login fails:** Secure cookies require HTTPS and matching origin configuration.

For any later migration of the older application, first map existing entities, IDs, account/password formats, and permissions. Preserve workspace memberships and original IDs deliberately, or maintain an explicit ID mapping. Migrate into a separate database, verify counts/references and authorization behavior, then switch traffic with a rollback plan. No such data migration runs automatically in this project.
