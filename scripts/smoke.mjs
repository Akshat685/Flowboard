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
