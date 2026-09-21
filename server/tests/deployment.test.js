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
