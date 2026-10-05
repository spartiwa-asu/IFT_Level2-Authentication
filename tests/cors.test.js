require('./helpers');
process.env.CORS_ORIGINS = 'http://localhost:5173, http://192.168.1.5:5173';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app')();

const ALLOWED = 'http://localhost:5173';

test('a listed origin gets CORS headers', async () => {
  const res = await request(app).get('/api/v1/games').set('Origin', ALLOWED);
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED);
});

test('an unlisted origin gets no CORS headers, so the browser blocks it', async () => {
  const res = await request(app).get('/api/v1/games').set('Origin', 'http://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('the preflight for a protected route is answered before authenticate (204, not 401)', async () => {
  const res = await request(app)
    .options('/api/v1/games')
    .set('Origin', ALLOWED)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type');
  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED);
  assert.match(res.headers['access-control-allow-headers'], /Authorization/);
});

test('CORS does not replace authentication: an allowed origin without a token still gets 401', async () => {
  const res = await request(app).get('/api/v1/games').set('Origin', ALLOWED);
  assert.equal(res.status, 401);
});
