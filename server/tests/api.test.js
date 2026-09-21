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
  assert.deepEqual(response.body, { success: false, status: 'unavailable' });
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
