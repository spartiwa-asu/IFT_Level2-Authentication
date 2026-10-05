// ============================================================================
//  CORS: which OTHER websites may call this API from a browser.
//
//  Swagger at /api-docs is served by this same server, so it never needs CORS.
//  You need this when a separate front end - e.g. a React app on
//  http://localhost:5173 - calls the API on http://localhost:4001.
//
//  The allowlist comes from .env, comma separated:
//    CORS_ORIGINS=http://localhost:5173,http://192.168.1.5:5173
//
//  CORS is NOT authentication. It only tells the BROWSER whether a page may
//  READ the response. curl, requests.http and other servers ignore it, so
//  authenticate.js still has to check the bearer token on every request.
// ============================================================================
const cors = require('cors');

// "http://a.com, http://b.com" -> ['http://a.com', 'http://b.com']
function parseOrigins(value = '') {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Decide whether a browser page at `origin` may call this API.
//   origin    - the request's Origin header, e.g. 'http://localhost:5173',
//               or undefined when there is none (curl, requests.http,
//               a same-origin GET such as Swagger)
//   allowList - the parsed CORS_ORIGINS array
// Return true to send the CORS headers, false to leave them off.
function isAllowedOrigin(origin, allowList) {
  // No Origin header: not a cross-origin browser call, so CORS headers change nothing
  if (!origin) return true;
  // Browsers never send a trailing slash, but a hand-typed .env entry might have one
  const normalize = (value) => value.replace(/\/+$/, '').toLowerCase();
  // Exact match only - no wildcards, so a lookalike such as
  // http://localhost:5173.evil.example is never allowed
  return allowList.some((allowed) => normalize(allowed) === normalize(origin));
}

module.exports = function corsMiddleware(allowList = parseOrigins(process.env.CORS_ORIGINS)) {
  return cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin, allowList)),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
    // Authorization must be listed, or the browser refuses to send the bearer token
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Tokens travel in a header, not a cookie, so no credentials mode is needed
    credentials: false,
    // Let the browser cache a successful preflight for 10 minutes
    maxAge: 600
  });
};

module.exports.parseOrigins = parseOrigins;
module.exports.isAllowedOrigin = isAllowedOrigin;
