// ============================================================================
//  Application logging.
//
//  Writes to the terminal AND to logs/app-<timestamp>.log (plus app-latest.log).
//
//  LEVELS: verbose (default) | normal | quiet
//    LOG_LEVEL=normal npm start        or    npm start -- --quiet
//  The file always receives everything, whatever the screen shows.
//
//  SAFETY: every line passes through redact() on its way to the screen and the
//  file, so passwords, tokens and connection-string credentials become ***.
//  A log you cannot safely share is a log nobody will share.
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');

const REDACTIONS = [
  // mongodb+srv://user:SECRET@host -> mongodb+srv://user:***@host
  [/(mongodb(?:\+srv)?:\/\/[^:@\s/]+:)([^@\s]+)(@)/gi, '$1***$3'],
  [/((?:password|passwd|secret|token|apikey|api_key)["']?\s*[:=]\s*["']?)([^\s"',;}]+)/gi, '$1***'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 ***'],
  [/\b[a-f0-9]{48,}\b/gi, '***'], // long hex = a JWT secret
  [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, '<jwt>'] // whole JWTs
];

const redact = (value) => {
  let text = typeof value === 'string' ? value : String(value);
  for (const [pattern, replacement] of REDACTIONS) text = text.replace(pattern, replacement);
  return text;
};

// Show a connection string safely: keep host and database, hide the password
const maskConnectionString = (uri) =>
  String(uri || '(not set)').replace(/(mongodb(?:\+srv)?:\/\/[^:@/]+:)([^@]+)(@)/, '$1***$3');

const LEVELS = { quiet: 0, normal: 1, verbose: 2 };

function resolveLevel(argv = process.argv.slice(2)) {
  for (const name of ['quiet', 'normal', 'verbose']) if (argv.includes(`--${name}`)) return name;
  const fromEnv = (process.env.LOG_LEVEL || '').toLowerCase();
  return fromEnv in LEVELS ? fromEnv : 'verbose';
}

const stamp = (date = new Date()) => date.toISOString().replace(/[:.]/g, '-').slice(0, 23);

function createLogger({ name = 'app', dir = path.join(__dirname, '..', 'logs'), toFile = true, toConsole = true } = {}) {
  const startedAt = new Date();
  const levelName = resolveLevel();
  const threshold = LEVELS[levelName];
  let filePath = null;
  let latestPath = null;

  if (toFile) {
    fs.mkdirSync(dir, { recursive: true });
    filePath = path.join(dir, `${name}-${stamp(startedAt)}.log`);
    for (let suffix = 2; fs.existsSync(filePath); suffix++) {
      filePath = path.join(dir, `${name}-${stamp(startedAt)}-${suffix}.log`);
    }
    latestPath = path.join(dir, `${name}-latest.log`);
    const header = [
      `# ${name} started ${startedAt.toISOString()}`,
      `# log level: ${levelName}`,
      `# node:      ${process.version} on ${os.platform()} ${os.arch()} (pid ${process.pid})`,
      `# cwd:       ${process.cwd()}`,
      ''
    ].join('\n');
    fs.writeFileSync(filePath, header);
    fs.writeFileSync(latestPath, header);
  }

  const write = (line) => {
    if (!toFile) return;
    const timed = `${new Date().toISOString()}  ${redact(line)}\n`;
    fs.appendFileSync(filePath, timed);
    fs.appendFileSync(latestPath, timed);
  };

  const emit = (consoleLine, fileLine, { stream = 'log', minLevel = 'normal' } = {}) => {
    if (toConsole && threshold >= LEVELS[minLevel]) console[stream](redact(consoleLine));
    write(fileLine);
  };

  return {
    get file() {
      return filePath;
    },
    level: levelName,
    isVerbose: threshold >= LEVELS.verbose,
    banner: (message) => emit(message, `BANNER ${message}`, { minLevel: 'quiet' }),
    step: (message) => emit(`\n▶ ${message}`, `STEP  ${message}`),
    done: (message) => emit(`  ✓ ${message}`, `DONE  ${message}`),
    info: (message) => emit(message, `INFO  ${message}`),
    warn: (message) => emit(`  ! ${message}`, `WARN  ${message}`, { stream: 'warn', minLevel: 'quiet' }),
    error: (message) => emit(`  ✗ ${message}`, `ERROR ${message}`, { stream: 'error', minLevel: 'quiet' }),
    request: (message) => emit(`  → ${message}`, `REQ   ${message}`),
    detail: (message) => emit(`    · ${message}`, `DETAIL ${message}`, { minLevel: 'verbose' })
  };
}

module.exports = { createLogger, redact, maskConnectionString };
