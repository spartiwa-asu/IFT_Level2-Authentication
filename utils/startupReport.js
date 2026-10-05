// ============================================================================
//  The banner every run starts with: what this app is, what it is connected to
//  (connection string with the password masked - ONCE per log), and the ordered
//  steps for running it.
// ============================================================================
const os = require('os');

const { maskConnectionString } = require('./logger');
const { HOW_TO_RUN, DOCS, LEVEL } = require('./troubleshooting');
const { lookupOrigin, formatOrigin, geoEnabled } = require('./origin');

// Every non-internal IPv4/IPv6 address this machine answers on. Students on a
// shared network use these to reach each other's servers, and "which address
// am I actually on?" is a common first-week confusion.
function networkAddresses({ includeLinkLocal = false } = {}) {
  return Object.entries(os.networkInterfaces())
    .flatMap(([name, addresses]) => (addresses || []).map((address) => ({ name, ...address })))
    .filter((address) => !address.internal)
    // fe80:: addresses are link-local: valid, but noise for a class of beginners
    .filter((address) => includeLinkLocal || !String(address.address).toLowerCase().startsWith('fe80:'))
    // IPv4 first: that is the one students will actually type
    .sort((a, b) => String(a.family).localeCompare(String(b.family)))
    .map((address) => `${address.address} (${address.family}, ${address.name})`);
}

function logStartupConfig(log, { database, port }) {
  log.step(`Level ${LEVEL} - Resource Authentication`);

  // The one and only place the connection string is logged, always masked
  log.info(`  database:     ${maskConnectionString(database)}`);
  log.info(`  environment:  ${process.env.NODE_ENV || 'development'}`);
  log.info(`  port:         ${port}`);
  log.info(`  api version:  ${process.env.API_VERSION || '/api/v1'}`);
  log.info(`  bcrypt cost:  ${process.env.BCRYPT_ROUNDS || 12}`);

  // Which machine is this, and on what addresses can it be reached?
  const addresses = networkAddresses();
  log.info(`  hostname:     ${os.hostname()}`);
  log.info(`  ip addresses: ${addresses.length ? addresses.slice(0, 4).join(', ') : 'none (loopback only)'}`);
  if (addresses.length > 4) log.detail(`other addresses: ${addresses.slice(4).join(', ')}`);
  log.detail(`link-local addresses omitted: ${networkAddresses({ includeLinkLocal: true }).length - addresses.length}`);
  log.info(`  node:         ${process.version} on ${os.platform()} ${os.arch()} (pid ${process.pid})`);

  log.detail(`config files read: .env then config.env (first value wins)`);
  log.detail(`log file: ${log.file}`);
}

// Where the run was started from - public IP and the city/state it maps to.
// Once per run, in the banner, because the log is assignment evidence.
async function logOrigin(log) {
  if (!geoEnabled()) {
    log.step('Where this run was started from');
    log.info('  network origin: lookup disabled (LOG_GEO=false)');
    return { available: false, reason: 'disabled' };
  }
  // Look up FIRST, then print the whole block, so it is never split across
  // the rest of the startup output.
  const origin = await lookupOrigin();
  log.step('Where this run was started from');
  log.info(`  network origin: ${formatOrigin(origin)}`);
  if (origin.available) {
    log.info(`  state/region:   ${origin.state || 'unknown'}${origin.stateCode ? ` (${origin.stateCode})` : ''}`);
    log.info(`  timezone:       ${origin.timezone || 'unknown'}  (machine: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  } else {
    log.detail('the lookup is best-effort; the run continues either way');
  }
  return origin;
}

// Reference material, once per run, so it is in every log file
function logDocs(log) {
  log.step('Documentation');
  log.info(`  ${DOCS.swagger()}`);
  for (const key of ['express', 'expressMw', 'mongoose', 'mongooseValidation', 'mongooseQueries', 'connectionString', 'bcrypt', 'owasp', 'httpStatus', 'nodeTest']) {
    log.info(`  ${DOCS[key]}`);
  }
}

function logHowToRun(log) {
  log.step('How to run this app, in order');
  HOW_TO_RUN.forEach((stepText, index) => log.info(`  ${index + 1}. ${stepText}`));
}

function logReady(log, port) {
  log.step('Ready');
  log.done(`API:      http://localhost:${port}${process.env.API_VERSION || '/api/v1'}`);
  log.done(`Swagger:  http://localhost:${port}/api-docs`);
  for (const address of networkAddresses().filter((a) => a.includes('IPv4'))) {
    log.done(`On LAN:   http://${address.split(' ')[0]}:${port}/api-docs`);
  }
  log.info('  Stop with Ctrl+C. Every request is logged below and in logs/.');
}

// A startup failure: say what failed, then the ordered checklist for that cause
function logStartupFailure(log, err, diagnosis) {
  log.error(`Startup failed: ${err.message}`);
  log.step(`What to check (${diagnosis.kind})`);
  diagnosis.steps.forEach((stepText, index) => log.info(`  ${index + 1}. ${stepText}`));
  log.info('\n  Full detail is in the newest file in logs/.');
}

module.exports = { logStartupConfig, logHowToRun, logDocs, logOrigin, logReady, logStartupFailure, networkAddresses };
