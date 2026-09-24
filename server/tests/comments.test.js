import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

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
let cookie;
let board;
let colId;
let cardId;

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
  config.MONGODB_URI = mongo.getUri('flowboard_comments_test');
  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase();
  ({ app, server, io } = createApplication());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  // Create a fixture user, board, and card for use in all tests.
  const session = await fixtureSession('commenter');
  cookie = session.cookie;

  const boardRes = await protect(request(app).post('/api/boards'))
    .set('Cookie', cookie)
    .send({ title: 'Comments Board' });
  assert.equal(boardRes.status, 201);
  board = boardRes.body.board;
  colId = board.columns[0]._id;

  const cardRes = await protect(
    request(app).post(`/api/boards/${board._id}/columns/${colId}/cards`),
  )
    .set('Cookie', cookie)
    .send({ title: 'Commentable Card', version: board.__v });
  assert.equal(cardRes.status, 201);
  board = cardRes.body.board;
  cardId = board.columns[0].cards[0]._id;
});

after(async () => {
  if (io) await new Promise((resolve) => io.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});

function commentsPath() {
  return `/api/boards/${board._id}/columns/${colId}/cards/${cardId}/comments`;
}

function commentDeletePath(commentId) {
  return `${commentsPath()}/${commentId}`;
}

test('add comment returns 201 and the comment appears on the card', async () => {
  const res = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: 'First comment', version: board.__v });
  assert.equal(res.status, 201);
  board = res.body.board;
  const card = board.columns[0].cards[0];
  assert.equal(card.comments.length, 1);
  assert.equal(card.comments[0].text, 'First comment');
  assert.ok(card.comments[0]._id);
  assert.ok(card.comments[0].createdAt);
});

test('comment on nonexistent card returns 404', async () => {
  const fakeCardId = new mongoose.Types.ObjectId().toString();
  const path = `/api/boards/${board._id}/columns/${colId}/cards/${fakeCardId}/comments`;
  const res = await protect(request(app).post(path))
    .set('Cookie', cookie)
    .send({ text: 'Ghost comment', version: board.__v });
  assert.equal(res.status, 404);
});

test('empty comment text returns 400', async () => {
  const res = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: '', version: board.__v });
  assert.equal(res.status, 400);
});

test('whitespace-only comment text returns 400', async () => {
  const res = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: '   ', version: board.__v });
  assert.equal(res.status, 400);
});

test('comment text exceeding 1000 characters returns 400', async () => {
  const res = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: 'x'.repeat(1001), version: board.__v });
  assert.equal(res.status, 400);
});

test('delete comment removes it from the card', async () => {
  // Add a comment to delete.
  const addRes = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: 'To be deleted', version: board.__v });
  assert.equal(addRes.status, 201);
  board = addRes.body.board;
  const commentId = board.columns[0].cards[0].comments.at(-1)._id;
  const countBefore = board.columns[0].cards[0].comments.length;

  const delRes = await protect(request(app).delete(commentDeletePath(commentId)))
    .set('Cookie', cookie)
    .send({ version: board.__v });
  assert.equal(delRes.status, 200);
  board = delRes.body.board;
  assert.equal(board.columns[0].cards[0].comments.length, countBefore - 1);
  assert.ok(!board.columns[0].cards[0].comments.some((c) => c._id === commentId));
});

test('stale version on add comment returns 409', async () => {
  const staleVersion = board.__v - 1;
  const res = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: 'Stale add', version: staleVersion });
  assert.equal(res.status, 409);
});

test('stale version on delete comment returns 409', async () => {
  // Ensure there is a comment to try deleting.
  const addRes = await protect(request(app).post(commentsPath()))
    .set('Cookie', cookie)
    .send({ text: 'For stale delete test', version: board.__v });
  assert.equal(addRes.status, 201);
  board = addRes.body.board;
  const commentId = board.columns[0].cards[0].comments.at(-1)._id;
  const staleVersion = board.__v - 1;

  const res = await protect(request(app).delete(commentDeletePath(commentId)))
    .set('Cookie', cookie)
    .send({ version: staleVersion });
  assert.equal(res.status, 409);
});

test('100-comment cap is enforced', async () => {
  // Create a fresh board/card so we start at 0 comments.
  const { cookie: freshCookie } = await fixtureSession('limiter');
  const bRes = await protect(request(app).post('/api/boards'))
    .set('Cookie', freshCookie)
    .send({ title: 'Limit Board' });
  assert.equal(bRes.status, 201);
  let b = bRes.body.board;
  const col = b.columns[0]._id;

  const cRes = await protect(request(app).post(`/api/boards/${b._id}/columns/${col}/cards`))
    .set('Cookie', freshCookie)
    .send({ title: 'Limit Card', version: b.__v });
  assert.equal(cRes.status, 201);
  b = cRes.body.board;
  const cId = b.columns[0].cards[0]._id;
  const path = `/api/boards/${b._id}/columns/${col}/cards/${cId}/comments`;

  // Bulk-insert 100 comments directly into the database to avoid 100 HTTP round trips.
  const dbBoard = await Board.findById(b._id);
  const card = dbBoard.columns[0].cards.id(cId);
  for (let i = 0; i < 100; i++) {
    card.comments.push({ text: `Bulk comment ${i}` });
  }
  await dbBoard.save();
  // Re-read the version after the bulk insert.
  const reloaded = await Board.findById(b._id);
  b = reloaded.toObject();
  b.__v = reloaded.__v;

  assert.equal(b.columns[0].cards[0].comments.length, 100);

  // The 101st comment should fail validation.
  const res = await protect(request(app).post(path))
    .set('Cookie', freshCookie)
    .send({ text: 'One too many', version: b.__v });
  assert.equal(res.status, 400);
});
