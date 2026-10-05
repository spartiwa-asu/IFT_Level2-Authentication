// ============================================================================
//  What to do when something goes wrong.
//
//  Every failure the app can produce gets a numbered checklist, in the order a
//  beginner should try things. Printed to the terminal AND written to the log,
//  so a student who pastes their log file has the advice attached to the error.
// ============================================================================
const LEVEL = 2;
const PORT = () => process.env.PORT || 4001;

// Documentation worth having at hand. Printed at startup and attached to the
// failures they explain, so a student never has to guess what to search for.
const DOCS = {
  swagger: () => `http://localhost:${PORT()}/api-docs   (this app's own API reference)`,
  express: 'Express routing      https://expressjs.com/en/guide/routing.html',
  expressMw: 'Express middleware   https://expressjs.com/en/guide/using-middleware.html',
  mongoose: 'Mongoose schemas     https://mongoosejs.com/docs/guide.html',
  mongooseValidation: 'Mongoose validation  https://mongoosejs.com/docs/validation.html',
  mongooseQueries: 'Mongoose queries     https://mongoosejs.com/docs/queries.html',
  objectId: 'MongoDB ObjectId     https://www.mongodb.com/docs/manual/reference/method/ObjectId/',
  connectionString: 'Connection strings   https://www.mongodb.com/docs/manual/reference/connection-string/',
  atlasAccessList: 'Atlas IP access list https://www.mongodb.com/docs/atlas/security/ip-access-list/',
  atlasUsers: 'Atlas database users https://www.mongodb.com/docs/atlas/security-add-mongodb-users/',
  bcrypt: 'bcrypt (password hashing) https://github.com/dcodeIO/bcrypt.js#readme',
  owasp: 'OWASP authentication cheat sheet https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
  httpStatus: 'HTTP status codes    https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
  json: 'JSON request bodies  https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type',
  dotenv: 'dotenv / .env files  https://github.com/motdotla/dotenv#readme',
  nodeTest: 'Node test runner     https://nodejs.org/api/test.html'
};

// Ordered steps for running this app from nothing
const HOW_TO_RUN = [
  'cd into this folder (IFT_Level2-Authentication)',
  'npm install                      - install dependencies (once)',
  'cp config.env.example config.env - or let ../0-Atlas-Setup-Automation write it for you',
  'edit config.env                  - set DATABASE_URL (local MongoDB or Atlas)',
  'npm run seed                     - load sample users and games',
  'npm start                        - start the server',
  `open http://localhost:${PORT()}/api-docs - try the API in Swagger UI`,
  'npm test                         - run the tests (in-memory MongoDB, no setup needed)'
];

// Startup failures - the database is the usual suspect
const STARTUP_CHECKS = {
  missingConfig: [
    'This folder has no .env or config.env yet.',
    'Option A: cp config.env.example config.env, then edit DATABASE_URL.',
    'Option B: cd ../0-Atlas-Setup-Automation && npm run check && npm run setup',
    'Then start the app again with npm start.',
    `Docs: ${DOCS.dotenv}`,
    `Docs: ${DOCS.connectionString}`
  ],
  badAuth: [
    'MongoDB rejected the username or password in your connection string.',
    'Check DATABASE_URL and DATABASE_PASSWORD in .env / config.env.',
    'If Atlas manages this user: cd ../0-Atlas-Setup-Automation && npm run setup',
    '  (it detects a stale password, rotates it and rewrites your env files).',
    'Then: npm run test:connections in that folder to confirm, and npm start here.',
    `Docs: ${DOCS.atlasUsers}`,
    `Docs: ${DOCS.connectionString}`
  ],
  unreachable: [
    'The database could not be reached at all.',
    'Local MongoDB? Check it is running: docker ps, or brew services list.',
    '  Start one with: docker run -d -p 27017:27017 --name ift458-mongo mongo',
    'Atlas? Your IP may not be on the access list.',
    '  cd ../0-Atlas-Setup-Automation && npm run check   (it reports your IP)',
    'Also check you are online and not behind a VPN that blocks port 27017.',
    `Docs: ${DOCS.atlasAccessList}`
  ],
  generic: [
    'Read the error message above - it is the database talking, not this app.',
    'Confirm DATABASE_URL in .env / config.env is the string you expect.',
    'cd ../0-Atlas-Setup-Automation && npm run test:connections',
    'Still stuck? Open the newest file in logs/ - the full detail is there.',
    `Docs: ${DOCS.connectionString}`
  ]
};

// Pick the right startup checklist from the driver's error
function diagnoseStartup(err) {
  const message = String(err?.message || '');
  if (/bad auth|Authentication failed/i.test(message)) return { kind: 'badAuth', steps: STARTUP_CHECKS.badAuth };
  if (/ENOTFOUND|ECONNREFUSED|timed out|ServerSelection/i.test(message)) {
    return { kind: 'unreachable', steps: STARTUP_CHECKS.unreachable };
  }
  return { kind: 'generic', steps: STARTUP_CHECKS.generic };
}

// Request failures - what a 4xx/5xx means HERE, at this level
const REQUEST_CHECKS = {
  400: [
    'The request body failed validation.',
    'Check the field names against /api-docs - they are case sensitive.',
    'Passwords must be at least 8 characters, and passwordConfirmation must match.',
    'Sending JSON? Set the Content-Type: application/json header.',
    `Docs: ${DOCS.mongooseValidation}`,
    `Docs: ${DOCS.json}`
  ],
  401: [
    'No valid bearer token came with this request (games and scores need one).',
    'Swagger: POST /users/login, copy the token, click Authorize, paste ONLY the 64-character token (Swagger adds "Bearer ").',
    'Reloading the Swagger page clears Authorize on purpose - authorize again after every reload.',
    'Tokens expire after TOKEN_LIFETIME_MINUTES (default 1440). Log in again for a new one.',
    'Postman: Authorization tab -> Bearer Token -> paste ONLY the token (Postman adds "Bearer ").',
    'Browser client, requests.http or a hand-typed header: send  Authorization: Bearer <token>',
    `Docs: ${DOCS.expressMw}`,
    `Docs: ${DOCS.owasp}`
  ],
  404: [
    'No route or document matched.',
    'Check the URL against /api-docs, including the /api/v1 prefix.',
    'For /games/:id, the id must be a 24-character MongoDB ObjectId from GET /games.',
    `Docs: ${DOCS.express}`,
    `Docs: ${DOCS.objectId}`
  ],
  // A 401 from login itself is a wrong email or password, not a missing token
  loginFailed: [
    'The email or password did not match.',
    'Login gives the SAME message for an unknown email and a wrong password, on purpose.',
    'Seeded users log in with password12345 (run npm run seed first).',
    `Docs: ${DOCS.bcrypt}`,
    `Docs: ${DOCS.owasp}`
  ],
  409: ['That email is already registered. Use another, or re-run npm run seed to reset the data.'],
  413: ['The request body is too large. Send less data.'],
  500: [
    'The app itself failed - this is a bug, not your request.',
    'Read the stack trace in the newest logs/ file.',
    'Is MongoDB still reachable? cd ../0-Atlas-Setup-Automation && npm run test:connections',
    'Restart with npm start and try the same request again.',
    `Docs: ${DOCS.expressMw}`,
    `Docs: ${DOCS.httpStatus}`
  ]
};

// url tells the two kinds of 401 apart: bad password at login vs. missing token elsewhere
function diagnoseRequest(statusCode, url = '') {
  if (statusCode === 401 && /\/users\/login\b/.test(url)) return REQUEST_CHECKS.loginFailed;
  return REQUEST_CHECKS[statusCode] || (statusCode >= 500 ? REQUEST_CHECKS[500] : REQUEST_CHECKS[400]);
}

module.exports = { HOW_TO_RUN, STARTUP_CHECKS, REQUEST_CHECKS, DOCS, diagnoseStartup, diagnoseRequest, LEVEL };
