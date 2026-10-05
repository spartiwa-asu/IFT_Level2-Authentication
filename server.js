
// Load environment BEFORE requiring anything that reads process.env
const dotenv = require('dotenv');
// .env first (the MERN convention), then config.env as a fallback.
// dotenv does not overwrite a variable that is already set, so .env wins.
dotenv.config({ path: `${__dirname}/.env`, quiet: true });
dotenv.config({ path: `${__dirname}/config.env`, quiet: true });

const mongoose = require('mongoose');
const crypto = require('crypto');

// Logging, course evidence, and startup reporting.
const governance = require('./utils/governance');

const port = process.env.PORT || 4001;
const runId = crypto.randomUUID();
const tracker = governance.createCloTracker();
// Declared out here, not inside the else block below: shutdown() reads it too,
// and a const inside { } only exists inside those braces.
let originPromise = Promise.resolve(null);

// Atlas strings contain placeholders; local ones do not. Two styles are supported:
//   <password>                              <- DATABASE_PASSWORD (already URI-encoded)
//   <db_username> / <db_password> / <db_name> <- DATABASE_USER / DATABASE_PWD / DATABASE_NAME (plain; encoded here)
// Replacer functions stop `$&`, `$$` etc. in a password being treated as replace() patterns.
// `|| ''` lets a missing DATABASE_URL reach the guidance check below instead of throwing a TypeError.
// NOTE: the full string is never logged - logStartupConfig masks the password.
const DB = (process.env.DATABASE_URL || '')
  .replace('<password>', () => process.env.DATABASE_PASSWORD || '')
  .replace('<db_username>', () => encodeURIComponent(process.env.DATABASE_USER || ''))
  .replace('<db_password>', () => encodeURIComponent(process.env.DATABASE_PWD || ''))
  .replace('<db_name>', () => encodeURIComponent(process.env.DATABASE_NAME || ''));

// this is a sanity check to ensure the DATABASE_URL environment variable is set before proceeding for governance
// Do not change any part of this code
if (!process.env.DATABASE_URL) {
  governance.log.error('DATABASE_URL is not set - no .env or config.env with a connection string.');
  governance.log.step('What to check');
  governance.STARTUP_CHECKS.missingConfig.forEach((stepText, index) => governance.log.info(`  ${index + 1}. ${stepText}`));
  governance.logHowToRun(governance.log);
  process.exit(1);
}
else
{
  governance.logStartupConfig(governance.log, { database: DB, port });
  governance.logStudentIdentity(governance.log, runId);
  // Best-effort and non-blocking: the banner records it as soon as it arrives
  originPromise = governance.logOrigin(governance.log);
  governance.logHowToRun(governance.log);
  governance.logSubmissionInstructions(governance.log);
  governance.logCloPlan(governance.log, tracker);
  governance.logDocs(governance.log);
}

const app = require('./app')(governance.log, tracker);
// End of initial setup and logging configuration


// The logger masks the password in console output and log files.
governance.log.info(`MongoDB connection string: ${DB}`);

mongoose
  .connect(DB)
  .then(() => {
    governance.log.done('DB connection successful');
    tracker.record({ event: 'db-connected', detail: 'mongoose connected' }); // evidence for CLO1
    const server = app.listen(port, () => governance.logReady(governance.log, port));

    // Handle graceful shutdown on Ctrl+C DONOT CHAGE This part of the code
    // Ctrl+C: write the graded summary, then stop. This is the part the
    // student submits, so it must be produced even on a hurried shutdown.
    const shutdown = async (signal) => {
      // Arm the safety exit FIRST, so an error in the lines below cannot hang Ctrl+C
      setTimeout(() => process.exit(0), 3000).unref(); // never hang on Ctrl+C
      governance.log.info(`\nReceived ${signal} - finishing the log.`);
      const origin = await originPromise.catch(() => null);
      const result = governance.logCloSummary(governance.log, tracker, runId, origin);
      const digest = governance.appendChecksum(governance.log);
      governance.log.info(`  checksum: ${digest ? digest.slice(0, 16) + '…' : 'n/a'}`);
      governance.log.info(`  submit:   ${governance.log.file}`);
      server.close(() => {
        mongoose.connection.close().finally(() => process.exit(result.covered === result.total ? 0 : 0));
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((err) => {
    governance.logStartupFailure(governance.log, err, governance.diagnoseStartup(err));
    process.exit(1);
  });

// Anything that escapes Express should still be explained, not just dumped
process.on('unhandledRejection', (reason) => {
  governance.log.error(`Unhandled promise rejection: ${reason?.message || reason}`);
  governance.log.info('  This is a bug in the app. The stack trace is in the newest logs/ file.');
  governance.log.detail(String(reason?.stack || reason));
});
