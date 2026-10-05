require('./helpers'); // must be first: sets env + in-memory DB

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const { createLogger } = require('../utils/logger');
const { createCloTracker, CLOS } = require('../utils/clos');
const { describeOrigin, formatOrigin, lookupOrigin, clientAddress } = require('../utils/origin');
const { logCloSummary, appendChecksum, student } = require('../utils/submission');

const tempLog = () =>
  createLogger({ name: 'clo', dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ift458-clo-')), toConsole: false });

describe('CLO tracker', () => {
  test('nothing is covered before anything runs', () => {
    const tracker = createCloTracker();
    assert.equal(tracker.summary().filter((row) => row.covered).length, 0);
  });

  test('a matching request marks its outcome, and only that one', () => {
    const tracker = createCloTracker();
    const completed = tracker.record({ method: 'POST', url: '/api/v1/users/signup', status: 201 });
    assert.deepEqual(completed.map((c) => c.id), ['L1-CLO2']);
    assert.equal(tracker.summary().find((r) => r.id === 'L1-CLO2').covered, true);
    assert.equal(tracker.summary().find((r) => r.id === 'L1-CLO3').covered, false);
  });

  test('the wrong status does not count as evidence', () => {
    const tracker = createCloTracker();
    tracker.record({ method: 'POST', url: '/api/v1/users/login', status: 500 });
    assert.equal(tracker.summary().find((r) => r.id === 'L1-CLO3').covered, false);
  });

  test('a requireAll outcome needs every verb, not just one', () => {
    const tracker = createCloTracker();
    tracker.record({ method: 'POST', url: '/api/v1/games', status: 201 });
    tracker.record({ method: 'GET', url: '/api/v1/games', status: 200 });
    assert.equal(tracker.summary().find((r) => r.id === 'L1-CLO6').covered, false, 'CRUD is not done yet');

    tracker.record({ method: 'PATCH', url: '/api/v1/games/abc', status: 200 });
    const completed = tracker.record({ method: 'DELETE', url: '/api/v1/games/abc', status: 204 });
    assert.ok(completed.some((c) => c.id === 'L1-CLO6'), 'all four verbs now seen');
  });

  test('an outcome is announced once, not on every repeat', () => {
    const tracker = createCloTracker();
    const first = tracker.record({ method: 'POST', url: '/api/v1/users/login', status: 200 });
    const second = tracker.record({ method: 'POST', url: '/api/v1/users/login', status: 200 });
    assert.equal(first.length, 1);
    assert.equal(second.length, 0);
  });

  test('the startup database connection is evidence too', () => {
    const tracker = createCloTracker();
    const completed = tracker.record({ event: 'db-connected' });
    assert.deepEqual(completed.map((c) => c.id), ['L1-CLO1']);
  });

  test('every outcome tells the student how to demonstrate it', () => {
    for (const clo of CLOS) {
      assert.ok(clo.id && clo.text && clo.howTo, `${clo.id} is incomplete`);
      assert.ok(clo.evidence.length > 0);
    }
  });
});

describe('graded summary', () => {
  test('lists what is missing and how to get it, then a checksum', () => {
    const log = tempLog();
    const tracker = createCloTracker();
    tracker.record({ event: 'db-connected' });

    const result = logCloSummary(log, tracker, 'run-123', { available: true, ip: '1.2.3.4', city: 'Tempe', state: 'Arizona', stateCode: 'AZ', country: 'United States' });
    assert.equal(result.covered, 1);
    assert.equal(result.total, CLOS.length);

    const digest = appendChecksum(log);
    const body = fs.readFileSync(log.file, 'utf8');
    assert.match(body, new RegExp(`CLO COVERAGE - 1/${CLOS.length} demonstrated`));
    assert.match(body, /L1-CLO2.*NOT DEMONSTRATED/);
    assert.match(body, /To complete this submission/);
    assert.match(body, /Started from: 1\.2\.3\.4 - Tempe, Arizona \(AZ\), United States/);
    assert.match(body, new RegExp(`checksum sha256 of everything above: ${digest}`));
    assert.equal(digest.length, 64);
  });

  test('student identity comes from the environment', () => {
    process.env.STUDENT_NAME = 'Alice Johnson';
    process.env.STUDENT_ID = '1212345678';
    assert.deepEqual(student(), { name: 'Alice Johnson', id: '1212345678' });
    delete process.env.STUDENT_NAME;
    delete process.env.STUDENT_ID;
    assert.deepEqual(student(), { name: null, id: null });
  });
});

describe('run origin', () => {
  test('formats city, state and country into one line', () => {
    const origin = describeOrigin({
      ip: '24.255.14.100',
      city: 'Tempe',
      region: 'Arizona',
      region_code: 'AZ',
      country_name: 'United States',
      org: 'Cox Communications'
    });
    assert.equal(origin.state, 'Arizona');
    assert.equal(formatOrigin(origin), '24.255.14.100 - Tempe, Arizona (AZ), United States - Cox Communications');
  });

  test('a failed lookup never throws and never blocks the run', async () => {
    let attempts = 0;
    const origin = await lookupOrigin({
      fetcher: async () => {
        attempts++;
        throw new Error('offline');
      }
    });
    assert.equal(origin.available, false);
    assert.ok(attempts >= 2, 'the second provider should be tried before giving up');
    assert.match(formatOrigin(origin), /unavailable \(offline/);
  });

  test('falls back to the second provider when the first is rate limited', async () => {
    const origin = await lookupOrigin({
      fetcher: async (url) =>
        url.includes('ipapi.co')
          ? { ok: false, status: 429 }
          : {
              ok: true,
              json: async () => ({
                status: 'success',
                query: '24.255.14.100',
                city: 'Gilbert',
                regionName: 'Arizona',
                region: 'AZ',
                country: 'United States',
                countryCode: 'US',
                isp: 'Cox'
              })
            }
    });
    assert.equal(origin.available, true);
    assert.equal(origin.state, 'Arizona');
    assert.equal(origin.stateCode, 'AZ');
  });

  test('LOG_GEO=false disables the lookup entirely', async () => {
    process.env.LOG_GEO = 'false';
    let called = false;
    const origin = await lookupOrigin({ fetcher: async () => { called = true; } });
    delete process.env.LOG_GEO;
    assert.equal(called, false, 'no request should leave the machine');
    assert.match(origin.reason, /disabled/);
  });

  test('client addresses: proxy header wins, loopback is labelled', () => {
    assert.equal(clientAddress({ headers: { 'x-forwarded-for': '8.8.8.8, 10.0.0.1' }, ip: '10.0.0.1' }), '8.8.8.8');
    assert.equal(clientAddress({ headers: {}, ip: '::1' }), '::1 (localhost)');
    assert.equal(clientAddress({ headers: {}, ip: '192.168.0.92' }), '192.168.0.92');
  });
});

describe('end to end: the log records evidence as it happens', () => {
  test('a signup marks CLO2 in the log with the client address', async () => {
    const log = tempLog();
    const tracker = createCloTracker();
    const app = require('../app')(log, tracker);

    await request(app).post('/api/v1/users/signup').send({
      name: 'Alice',
      email: `alice-${Date.now()}@ift458.test`,
      password: 'password12345',
      passwordConfirmation: 'password12345'
    });
    await new Promise((resolve) => setImmediate(resolve));

    const body = fs.readFileSync(log.file, 'utf8');
    assert.match(body, /CLO DEMONSTRATED {2}L1-CLO2/);
    assert.match(body, /from (::ffff:)?127\.0\.0\.1 \(localhost\)|from ::1 \(localhost\)/);
  });
});
