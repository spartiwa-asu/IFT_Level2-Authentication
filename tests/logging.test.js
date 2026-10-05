require('./helpers'); // must be first: sets env + in-memory DB

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const { createLogger, redact, maskConnectionString } = require('../utils/logger');
const { sanitize } = require('../middleware/requestLogger');
const { diagnoseStartup, diagnoseRequest, HOW_TO_RUN, DOCS } = require('../utils/troubleshooting');
const { networkAddresses } = require('../utils/startupReport');
const User = require('../models/userModel');

const tempLogger = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ift458-applog-'));
  return { dir, log: createLogger({ name: 'test', dir, toConsole: false }) };
};

describe('log redaction', () => {
  test('the connection string is logged with the password masked', () => {
    const uri = 'mongodb+srv://ift_user:sup3rSecret@cluster.mongodb.net/ift458_level1';
    const masked = maskConnectionString(uri);
    assert.ok(!masked.includes('sup3rSecret'));
    assert.match(masked, /ift_user:\*\*\*@cluster\.mongodb\.net\/ift458_level1/);
  });

  test('passwords, tokens and JWTs never reach the log text', () => {
    assert.ok(!redact('password=hunter2').includes('hunter2'));
    assert.match(redact('authorization: Bearer abcdefghijklmnop'), /Bearer \*\*\*/);
    assert.match(redact('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef'), /<jwt>/);
  });
});

describe('payload sanitising', () => {
  test('secret fields are replaced, ordinary ones kept', () => {
    const clean = sanitize({
      email: 'alice@ift458.test',
      password: 'password12345',
      passwordConfirmation: 'password12345',
      nested: { accessToken: 'abc', title: 'Hollow Knight' }
    });
    assert.equal(clean.email, 'alice@ift458.test');
    assert.equal(clean.password, '***');
    assert.equal(clean.passwordConfirmation, '***');
    assert.equal(clean.nested.accessToken, '***');
    assert.equal(clean.nested.title, 'Hollow Knight');
  });

  test('very long strings are truncated so one request cannot flood the log', () => {
    const clean = sanitize({ description: 'x'.repeat(500) });
    assert.ok(clean.description.length < 250);
    assert.match(clean.description, /…$/);
  });
});

describe('troubleshooting guidance', () => {
  test('startup errors map to the right checklist', () => {
    assert.equal(diagnoseStartup(new Error('bad auth : Authentication failed.')).kind, 'badAuth');
    assert.equal(diagnoseStartup(new Error('connect ECONNREFUSED 127.0.0.1:27017')).kind, 'unreachable');
    assert.equal(diagnoseStartup(new Error('something else entirely')).kind, 'generic');
  });

  test('every failure checklist ends with documentation links', () => {
    for (const status of [400, 401, 404, 500]) {
      const steps = diagnoseRequest(status);
      assert.ok(steps.length >= 2, `status ${status} has no guidance`);
      assert.ok(steps.some((s) => s.includes('https://')), `status ${status} has no doc link`);
    }
  });

  test('a 401 on a protected route is about the token, a 401 at login is about the password', () => {
    assert.match(diagnoseRequest(401, '/api/v1/games').join('\n'), /Authorize/);
    assert.match(diagnoseRequest(401, '/api/v1/users/login').join('\n'), /email or password/);
  });

  test('an unmapped status still gets advice, never nothing', () => {
    assert.ok(diagnoseRequest(418).length > 0);
    assert.ok(diagnoseRequest(503).length > 0);
  });

  test('the run instructions are ordered and complete', () => {
    assert.ok(HOW_TO_RUN.length >= 6);
    assert.match(HOW_TO_RUN.join('\n'), /npm install/);
    assert.match(HOW_TO_RUN.join('\n'), /npm run seed/);
    assert.match(HOW_TO_RUN.join('\n'), /npm start/);
  });

  test('doc links are real URLs', () => {
    for (const [key, value] of Object.entries(DOCS)) {
      const text = typeof value === 'function' ? value() : value;
      assert.match(text, /https?:\/\/\S+/, `${key} has no URL`);
    }
  });
});

describe('startup banner', () => {
  test('reports the hostname and this machine\'s addresses', () => {
    const addresses = networkAddresses();
    assert.ok(Array.isArray(addresses));
    for (const address of addresses) assert.match(address, /\(IPv[46], .+\)$/);
  });
});

describe('request logging (end to end)', () => {
  test('logs route, controller, payload and outcome - with the password masked', async () => {
    const { log } = tempLogger();
    const app = require('../app')(log);
    await User.create({
      name: 'Alice',
      email: 'alice@ift458.test',
      password: 'password12345',
      passwordConfirmation: 'password12345'
    });

    await request(app).post('/api/v1/users/login').send({ email: 'alice@ift458.test', password: 'password12345' });
    await new Promise((resolve) => setImmediate(resolve)); // res.on('finish') is async

    const body = fs.readFileSync(log.file, 'utf8');
    assert.match(body, /REQ +POST \/api\/v1\/users\/login/);
    assert.match(body, /\[authController\.login\]/, 'the controller name should be recorded');
    assert.match(body, /payload .*"email":"alice@ift458\.test"/);
    assert.match(body, /"password":"\*\*\*"/);
    assert.ok(!body.includes('password12345'), 'the real password must never be written');
    assert.match(body, /DONE +200/);
  });

  test('a failed request logs the status and a numbered checklist', async () => {
    const { log } = tempLogger();
    const app = require('../app')(log);

    await request(app).post('/api/v1/users/login').send({ email: 'ghost@ift458.test', password: 'wrong-password' });
    await new Promise((resolve) => setImmediate(resolve));

    const body = fs.readFileSync(log.file, 'utf8');
    assert.match(body, /ERROR 401/);
    assert.match(body, /What to check, in order/);
    assert.match(body, /INFO {4}( +)1\. /);
    assert.match(body, /https:\/\//, 'guidance should include a documentation link');
  });
});
