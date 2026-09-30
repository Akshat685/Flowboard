import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { boardTemplates } from '@flowboard/shared/constants';

const testSecret = randomBytes(48).toString('hex');
const testOrigin = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = testSecret;
process.env.CLIENT_ORIGIN = testOrigin;
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused_test_placeholder';

const { createApplication } = await import('../src/app.js');
const { User } = await import('../src/modules/users/users.model.js');

let mongo;
let app;
let server;
let io;
let cookie;

const protect = (req) => req.set('X-Flowboard-Request', '1').set('Origin', testOrigin);

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

before(async () => {
  mongo = await MongoMemoryServer.create();
  const { config } = await import('../src/config/env.js');
  config.MONGODB_URI = mongo.getUri('flowboard_templates_test');
  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  ({ app, server, io } = createApplication());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const session = await fixtureSession('templater');
  cookie = session.cookie;
});

after(async () => {
  if (io) await new Promise((resolve) => io.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});

test('omitting template field produces the original 3-column default (backward compatibility)', async () => {
  const res = await protect(request(app).post('/api/boards'))
    .set('Cookie', cookie)
    .send({ title: 'Default Board' });
  assert.equal(res.status, 201);
  const board = res.body.board;
  const colTitles = board.columns.map((c) => c.title);
  assert.deepEqual(colTitles, ['To do', 'In progress', 'Done']);
});

test('creating a board with each template id produces the correct column titles in order', async () => {
  for (const template of boardTemplates) {
    const res = await protect(request(app).post('/api/boards'))
      .set('Cookie', cookie)
      .send({ title: `${template.id} Board`, template: template.id });
    assert.equal(res.status, 201);
    const board = res.body.board;
    const colTitles = board.columns.map((c) => c.title);
    assert.deepEqual(colTitles, template.columns, `Template ${template.id} failed`);
  }
});

test('invalid template id fails validation', async () => {
  const res = await protect(request(app).post('/api/boards'))
    .set('Cookie', cookie)
    .send({ title: 'Invalid Board', template: 'invalid-id-xyz' });
  assert.equal(res.status, 400); // Because Zod enum will reject it
});
