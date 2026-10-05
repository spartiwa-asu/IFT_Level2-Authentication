require('./helpers');

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app')();
let token;
beforeEach(async () => {
  const credentials = { name: 'Player', email: 'player@ift458.test', password: 'password12345', passwordConfirmation: 'password12345' };
  await request(app).post('/api/v1/users/signup').send(credentials);
  const login = await request(app).post('/api/v1/users/login').send(credentials);
  token = login.body.token;
});
const Score = require('../models/scoreModel');

const score = { gameTitle: 'Hollow Knight', points: 128400, playerEmail: 'player1@ift458.test' };

describe('Authenticated scores', () => {
  test('an authenticated user can submit a score, and it starts as submitted', async () => {
    const res = await request(app).post('/api/v1/scores').auth(token, { type: 'bearer' }).send(score);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.score.status, 'submitted');
    assert.equal(res.body.data.score.points, 128400);
    assert.ok(res.body.data.score.playedAt, 'playedAt defaults to now');
    assert.equal(res.body.data.score.verifiedAt, null, 'nothing is verified on arrival');
  });

  test('a score needs a game title, a points value and a valid player email', async () => {
    assert.equal((await request(app).post('/api/v1/scores').auth(token, { type: 'bearer' }).send({ gameTitle: 'x' })).status, 400);
    assert.equal((await request(app).post('/api/v1/scores').auth(token, { type: 'bearer' }).send({ ...score, playerEmail: 'nope' })).status, 400);
  });

  test('points must be a whole, non-negative, plausible number', async () => {
    for (const points of [-1, 3.5, 100000001]) {
      const res = await request(app).post('/api/v1/scores').auth(token, { type: 'bearer' }).send({ ...score, points });
      assert.equal(res.status, 400, `points ${points} should be rejected`);
    }
  });

  test('an authenticated user can list, read, edit and delete any score', async () => {
    const created = await Score.create(score);
    assert.equal((await request(app).get('/api/v1/scores').auth(token, { type: 'bearer' })).status, 200);
    assert.equal((await request(app).get(`/api/v1/scores/${created._id}`).auth(token, { type: 'bearer' })).status, 200);

    // Authentication alone does not impose role or ownership restrictions.
    const patched = await request(app).patch(`/api/v1/scores/${created._id}`).auth(token, { type: 'bearer' }).send({ status: 'verified' });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.score.status, 'verified');

    assert.equal((await request(app).delete(`/api/v1/scores/${created._id}`).auth(token, { type: 'bearer' })).status, 204);
  });

  test('an unknown status is rejected', async () => {
    const res = await request(app).post('/api/v1/scores').auth(token, { type: 'bearer' }).send({ ...score, status: 'world-record' });
    assert.equal(res.status, 400);
  });
});
