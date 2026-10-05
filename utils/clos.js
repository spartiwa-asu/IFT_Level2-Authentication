// ============================================================================
//  Course Learning Outcomes for THIS level, and how the log proves each one.
//
//  Why this exists: the log file is the assignment evidence. As the student
//  exercises the API, each request is matched against the rules below. The
//  first time an outcome is demonstrated, the log records it with a timestamp,
//  and at shutdown the log ends with a coverage summary the grader can read.
//
//  INSTRUCTORS: edit `id` and `text` to match the official CLO numbering for
//  the course. Nothing else depends on the wording.
// ============================================================================

// evidence: { method, path (RegExp against the URL), statuses (allowed) }
const CLOS = [
  {
    id: 'L1-CLO1',
    text: 'Connect an Express API to MongoDB using configuration held outside the code',
    evidence: [{ event: 'db-connected' }],
    howTo: 'Start the app with a working DATABASE_URL in .env: npm start'
  },
  {
    id: 'L1-CLO2',
    text: 'Register a user and store the password as a bcrypt hash, never in plain text',
    evidence: [{ method: 'POST', path: /\/users\/signup$/, statuses: [201] }],
    howTo: 'POST /api/v1/users/signup with name, email, password, passwordConfirmation'
  },
  {
    id: 'L1-CLO3',
    text: 'Authenticate a user by comparing a supplied password with the stored hash',
    evidence: [{ method: 'POST', path: /\/users\/login$/, statuses: [200] }],
    howTo: 'POST /api/v1/users/login with a correct email and password'
  },
  {
    id: 'L1-CLO4',
    text: 'Reject invalid credentials without revealing which part was wrong',
    evidence: [{ method: 'POST', path: /\/users\/login$/, statuses: [401] }],
    howTo: 'POST /api/v1/users/login with a deliberately wrong password'
  },
  {
    id: 'L1-CLO5',
    text: 'Validate input and report failures with the correct HTTP status code',
    evidence: [
      { method: 'POST', path: /\/users\/signup$/, statuses: [400, 409] },
      { method: 'POST', path: /\/games$/, statuses: [400] }
    ],
    howTo: 'POST /api/v1/users/signup twice with the same email (409), or with a 3-character password (400)'
  },
  {
    id: 'L1-CLO6',
    text: 'Implement REST CRUD over a MongoDB collection',
    evidence: [
      { method: 'POST', path: /\/games$/, statuses: [201] },
      { method: 'GET', path: /\/games/, statuses: [200] },
      { method: 'PATCH', path: /\/games\//, statuses: [200] },
      { method: 'DELETE', path: /\/games\//, statuses: [204] }
    ],
    requireAll: true, // all four verbs, not just one
    howTo: 'Create, list, edit and delete a game: POST, GET, PATCH, DELETE /api/v1/games'
  },
  {
    id: 'L1-CLO7',
    text: 'Create and manage score records through the API',
    evidence: [
      { method: 'POST', path: /\/scores$/, statuses: [201] },
      { method: 'GET', path: /\/scores/, statuses: [200] }
    ],
    requireAll: true,
    howTo: 'POST /api/v1/scores three times (title, author, playerEmail), then GET /api/v1/scores'
  },
  {
    id: 'L1-CLO8',
    text: 'Demonstrate the risk of authentication without authorization',
    evidence: [{ method: 'DELETE', path: /\/games\//, statuses: [204] }],
    howTo: 'DELETE a game WITHOUT logging in - it succeeds, and that is the lesson of Level 1'
  }
];

// Does this finished request satisfy a rule?
const matches = (rule, { method, url, status }) =>
  rule.method === method && rule.path.test(url) && (rule.statuses || []).includes(status);

// Tracks which outcomes have been seen during one run of the app
function createCloTracker(clos = CLOS) {
  const seen = new Map(); // "CLO id::rule index" -> { at, detail }

  const keyFor = (clo, index) => `${clo.id}::${index}`;

  // Returns the ids newly completed by this request (so the log can announce them)
  function record(observation) {
    const completed = [];

    for (const clo of clos) {
      const before = isCovered(clo);
      clo.evidence.forEach((rule, index) => {
        if (rule.event ? rule.event === observation.event : matches(rule, observation)) {
          if (!seen.has(keyFor(clo, index))) {
            seen.set(keyFor(clo, index), { at: new Date().toISOString(), detail: observation.detail });
          }
        }
      });
      if (!before && isCovered(clo)) completed.push(clo);
    }
    return completed;
  }

  function isCovered(clo) {
    const hits = clo.evidence.filter((_, index) => seen.has(keyFor(clo, index)));
    return clo.requireAll ? hits.length === clo.evidence.length : hits.length > 0;
  }

  function missingParts(clo) {
    return clo.evidence
      .map((rule, index) => ({ rule, index }))
      .filter(({ index }) => !seen.has(keyFor(clo, index)))
      .map(({ rule }) => (rule.event ? rule.event : `${rule.method} ${rule.path.source} -> ${rule.statuses.join('/')}`));
  }

  const summary = () =>
    clos.map((clo) => ({
      id: clo.id,
      text: clo.text,
      covered: isCovered(clo),
      howTo: clo.howTo,
      missing: isCovered(clo) ? [] : missingParts(clo),
      firstSeen: clo.evidence
        .map((_, index) => seen.get(keyFor(clo, index))?.at)
        .filter(Boolean)
        .sort()[0]
    }));

  return { record, summary, isCovered, clos };
}

module.exports = { CLOS, createCloTracker };
