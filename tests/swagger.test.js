require('./helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app')();
const doc = require('../SwaggerTFT458');

const errorResponses = () =>
  Object.entries(doc.paths).flatMap(([path, ops]) =>
    Object.entries(ops)
      .filter(([, op]) => op.responses)
      .flatMap(([method, op]) =>
        Object.entries(op.responses).filter(([code]) => code >= 400).map(([code, r]) => ({ path, method, code, r }))));

test('every documented error shows its own example message', () => {
  for (const { path, method, code, r } of errorResponses()) {
    assert.ok(r.content?.['application/json']?.example?.message, `${method} ${path} ${code} has no example message`);
  }
});

test('Level 2 documents no 403: there are no ownership checks yet', () => {
  assert.deepEqual(errorResponses().filter((e) => e.code === '403').map((e) => `${e.method} ${e.path}`), []);
});

test('the documented 401 and 404 messages are the ones the API sends', async () => {
  const documented = (path, method, code) => doc.paths[path][method].responses[code].content['application/json'].example.message;
  const noToken = await request(app).get('/api/v1/games');
  assert.equal(noToken.body.message, documented('/games', 'get', 401));
  const badLogin = await request(app).post('/api/v1/users/login').send({ email: 'nobody@ift458.test', password: 'password12345' });
  assert.equal(badLogin.body.message, documented('/users/login', 'post', 401));
  const missing = await request(app).post('/api/v1/users/login').send({});
  assert.equal(missing.body.message, documented('/users/login', 'post', 400));
});
