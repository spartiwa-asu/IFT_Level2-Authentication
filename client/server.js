// ============================================================================
//  A tiny static web server for the browser client: npm run client
//
//  It runs on its OWN port (5173), so the page's origin is different from the
//  API's (4001). That is on purpose: every fetch() from the page is a
//  cross-origin request, and only works once CORS_ORIGINS in .env lists
//  http://localhost:5173 (see middleware/cors.js).
// ============================================================================
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.CLIENT_PORT) || 5173;

// A fixed list, not a path built from the URL: a request for
// /../.env can never reach a file outside this folder.
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};

function createClientServer() {
  return http.createServer((req, res) => {
    const file = FILES[new URL(req.url, 'http://x').pathname];
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const [name, type] = file;
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, name)));
  });
}

if (require.main === module) {
  createClientServer().listen(PORT, () => {
    console.log(`Client:  http://localhost:${PORT}`);
    console.log('API must be running too (npm start), and .env needs:');
    console.log(`  CORS_ORIGINS=http://localhost:${PORT}`);
  });
}

module.exports = { createClientServer, FILES };
