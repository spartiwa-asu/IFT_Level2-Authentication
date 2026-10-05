// Shared logging, course evidence, and startup reporting dependencies.
// Load environment variables before requiring this module so the logger
// uses the configured LOG_LEVEL.
const { createLogger } = require('./logger');
const { createCloTracker } = require('./clos');
const {
  logStudentIdentity,
  logSubmissionInstructions,
  logCloPlan,
  logCloSummary,
  appendChecksum
} = require('./submission');
const { diagnoseStartup, STARTUP_CHECKS } = require('./troubleshooting');
const {
  logStartupConfig,
  logHowToRun,
  logDocs,
  logOrigin,
  logReady,
  logStartupFailure
} = require('./startupReport');

const log = createLogger({ name: 'app' });

module.exports = {
  log,
  createCloTracker,
  logStudentIdentity,
  logSubmissionInstructions,
  logCloPlan,
  logCloSummary,
  appendChecksum,
  diagnoseStartup,
  STARTUP_CHECKS,
  logStartupConfig,
  logHowToRun,
  logDocs,
  logOrigin,
  logReady,
  logStartupFailure
};
