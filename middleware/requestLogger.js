// ============================================================================
//  One log entry per request: route, controller, payload, outcome.
//
//    → POST /api/v1/users/login  [authController.login]
//        payload {"email":"admin@ift458.test","password":"***"}
//      ✓ 200 in 84ms
//
//  A failure adds a numbered checklist from utils/troubleshooting.js, so the
//  advice sits next to the error in the log the student sends you.
// ============================================================================
const { diagnoseRequest } = require('../utils/troubleshooting');
const { clientAddress } = require('../utils/origin');

// Fields that must never reach a log file, even redacted by pattern
const SECRET_FIELDS = new Set([
  'password',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'newPasswordConfirmation',
  'token',
  'accessToken',
  'refreshToken'
]);

function sanitize(value, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 3) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitize(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (SECRET_FIELDS.has(key)) return [key, '***'];
      if (typeof item === 'string' && item.length > 200) return [key, `${item.slice(0, 200)}…`];
      return [key, sanitize(item, depth + 1)];
    })
  );
}

// Which controller handled this? app.js tags every exported handler with a name.
function controllerName(req) {
  // A route registered with .get().post().delete() keeps all of them in one
  // stack, so filter by the verb that actually ran - otherwise a GET would be
  // logged as "getGames -> createGame -> deleteGame".
  const verb = String(req.method || '').toLowerCase();
  const handlers = (req.route?.stack || []).filter((layer) => !layer.method || layer.method === verb);
  const named = handlers.map((layer) => layer.handle?.controllerName).filter(Boolean);
  return named.length ? named.join(' -> ') : '(no controller)';
}

module.exports = (log, tracker = null) => (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  req.startedAt = startedAt;

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = req.route ? `${req.baseUrl}${req.route.path}` : req.originalUrl;
    const label = `${req.method} ${req.originalUrl}  [${controllerName(req)}]  from ${clientAddress(req)}`;

    log.request(label);
    if (route !== req.originalUrl) log.detail(`route pattern: ${route}`);

    const payload = {
      ...(Object.keys(req.params || {}).length ? { params: sanitize(req.params) } : {}),
      ...(Object.keys(req.query || {}).length ? { query: sanitize(req.query) } : {}),
      ...(req.body && Object.keys(req.body).length ? { body: sanitize(req.body) } : {})
    };
    if (Object.keys(payload).length) log.detail(`payload ${JSON.stringify(payload)}`);

    // Assignment evidence: does this request demonstrate a course outcome?
    const completed =
      tracker?.record({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        detail: `${req.method} ${req.originalUrl} -> ${res.statusCode}`
      }) || [];
    for (const clo of completed) log.done(`CLO DEMONSTRATED  ${clo.id}  ${clo.text}`);

    if (res.statusCode < 400) {
      log.done(`${res.statusCode} ${res.statusMessage || ''} in ${ms.toFixed(1)}ms`);
      return;
    }

    // Failure: say what happened, then what to try, in order
    log.error(`${res.statusCode} ${res.statusMessage || ''} in ${ms.toFixed(1)}ms  (${req.method} ${req.originalUrl})`);
    if (res.locals.failureMessage) log.detail(`response said: ${res.locals.failureMessage}`);
    log.info('  What to check, in order:');
    diagnoseRequest(res.statusCode, req.originalUrl).forEach((stepText, index) => log.info(`    ${index + 1}. ${stepText}`));
  });

  next();
};

module.exports.sanitize = sanitize;
module.exports.controllerName = controllerName;
