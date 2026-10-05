require('./helpers'); // must be first: sets env + in-memory DB

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app')(); // app.js exports a factory: createApp(logger)
const User = require('../models/userModel');
const Game = require('../models/gameModel');

const alice = {
  name: 'Alice',
  email: 'alice@ift458.test',
  password: 'password12345',
  passwordConfirmation: 'password12345'
};

describe('Level 2 - authentication (signup + login)', () => {
  test('signup stores a bcrypt hash, never the plain password', async () => {
    const res = await request(app).post('/api/v1/users/signup').send(alice);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.password, undefined, 'password must never be returned');

    const saved = await User.findOne({ email: alice.email }).select('+password').lean();
    assert.notEqual(saved.password, alice.password);
    assert.match(saved.password, /^\$2[aby]\$/); // bcrypt hash prefix
    assert.equal(saved.passwordConfirmation, undefined);
  });

  test('signup rejects a mismatched password confirmation', async () => {
    const res = await request(app)
      .post('/api/v1/users/signup')
      .send({ ...alice, passwordConfirmation: 'different-password' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Passwords do not match/);
  });

  test('signup rejects a duplicate email with 409', async () => {
    await User.create(alice);
    const res = await request(app).post('/api/v1/users/signup').send(alice);
    assert.equal(res.status, 409);
  });

  test('login succeeds with the right password', async () => {
    await User.create(alice);
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: alice.email, password: alice.password });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, alice.email);
  });

  test('login gives the SAME error for a wrong password and an unknown email', async () => {
    await User.create(alice);
    const wrongPassword = await request(app)
      .post('/api/v1/users/login')
      .send({ email: alice.email, password: 'nope-nope-nope' });
    const unknownEmail = await request(app)
      .post('/api/v1/users/login')
      .send({ email: 'ghost@ift458.test', password: 'whatever123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  test('login blocks NoSQL-injection objects in the email field', async () => {
    await User.create(alice);
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: { $gt: '' }, password: alice.password });
    assert.equal(res.status, 401);
  });
});

describe('Level 2 - API plumbing', () => {
  test('an invalid game id returns 400, not a crash', async () => {
    await User.create(alice);
    const login = await request(app).post('/api/v1/users/login').send(alice);
    const res = await request(app).get('/api/v1/games/not-an-id').auth(login.body.token, { type: 'bearer' });
    assert.equal(res.status, 400);
  });

  test('unknown routes return a JSON 404', async () => {
    await User.create(alice);
    const login = await request(app).post('/api/v1/users/login').send(alice);
    const res = await request(app).get('/api/v1/nope').auth(login.body.token, { type: 'bearer' });
    assert.equal(res.status, 404);
    assert.equal(res.body.status, 'fail');
  });

  test('Swagger UI is served at /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    assert.equal(res.status, 200);
    assert.match(res.text, /swagger-ui/i);
  });
});
