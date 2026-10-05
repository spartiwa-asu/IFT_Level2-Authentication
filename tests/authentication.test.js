require('./helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const request = require('supertest');
const app = require('../app')();
const Session = require('../models/sessionModel');
const User = require('../models/userModel');
const Game = require('../models/gameModel');
const Score = require('../models/scoreModel');
const credentials = { name: 'Alice', email: 'alice@ift458.test', password: 'password12345', passwordConfirmation: 'password12345' };
async function login() {
  await User.create(credentials);
  const res = await request(app).post('/api/v1/users/login').send(credentials);
  assert.equal(res.status, 200);
  assert.match(res.body.token, /^[a-f0-9]{64}$/);
  assert.equal(res.headers['cache-control'], 'no-store');
  return res.body.token;
}

test('every resource operation rejects missing, malformed and unknown credentials without mutations', async () => {
  const game = await Game.create({ title: 'Test', developer: 'Dev', description: 'Original' });
  const score = await Score.create({ gameTitle: 'Test', points: 5, playerEmail: credentials.email });
  for (const [resource, id] of [['games', game.id], ['scores', score.id]]) {
    for (const [method, suffix] of [['get', ''], ['post', ''], ['get', `/${id}`], ['head', `/${id}`], ['patch', `/${id}`], ['delete', `/${id}`]]) {
      for (const header of ['', 'Basic abc', 'Bearer invalid', `Bearer ${'a'.repeat(64)}`]) {
        const call = request(app)[method](`/api/v1/${resource}${suffix}`);
        if (header) call.set('Authorization', header);
        assert.equal((await call).status, 401, `${method} ${resource}${suffix}`);
      }
    }
  }
  assert.equal(await Game.countDocuments(), 1);
  assert.equal(await Score.countDocuments(), 1);
  assert.equal((await Game.findById(game.id)).description, 'Original');
  assert.equal((await Score.findById(score.id)).points, 5);
});

test('valid login allows every game operation and stores only a token digest', async () => {
  const token = await login();
  const session = await Session.findOne();
  assert.equal(session.tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(session).includes(token));
  const api = (method, path) => request(app)[method](`/api/v1/games${path}`).auth(token, { type: 'bearer' });
  const created = await api('post', '').send({ title: 'Test', developer: 'Dev', description: 'Original' });
  assert.equal(created.status, 201);
  const path = `/${created.body.data.game._id}`;
  assert.equal((await api('get', '')).status, 200);
  assert.equal((await api('get', path)).status, 200);
  assert.equal((await api('patch', path).send({ title: 'Updated' })).status, 200);
  assert.equal((await api('delete', path)).status, 204);
});

test('expired sessions and deleted users cannot access resources', async () => {
  const token = await login();
  await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await request(app).get('/api/v1/games').auth(token, { type: 'bearer' })).status, 401);
  const fresh = await request(app).post('/api/v1/users/login').send(credentials);
  await User.deleteMany({});
  assert.equal((await request(app).get('/api/v1/scores').auth(fresh.body.token, { type: 'bearer' })).status, 401);
});

test('body and query tokens do not bypass the Authorization header requirement', async () => {
  const token = await login();
  assert.equal((await request(app).get('/api/v1/games').query({ token })).status, 401);
  assert.equal((await request(app).post('/api/v1/games').send({ token })).status, 401);
});
