const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClientServer } = require('../client/server');

let server;
let base;

before(async () => {
  server = createClientServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('the client server serves the page, script and stylesheet', async () => {
  for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), new RegExp(type), path);
  }
});

test('the client server serves nothing outside its fixed file list', async () => {
  for (const path of ['/server.js', '/../.env', '/%2e%2e/.env', '/package.json']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
});
