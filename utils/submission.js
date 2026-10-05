// ============================================================================
//  The parts of the log that exist for grading.
//
//  The log file IS the assignment evidence, so every run records:
//    - who ran it          (STUDENT_NAME / STUDENT_ID from .env)
//    - a run id            (so two logs cannot be confused)
//    - which CLOs were demonstrated, with timestamps
//    - a checksum of the log body, so an edited log is detectable
// ============================================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { LEVEL } = require('./troubleshooting');
const { formatOrigin } = require('./origin');

const student = () => ({
  name: process.env.STUDENT_NAME || null,
  id: process.env.STUDENT_ID || process.env.ASURITE || null
});

function logStudentIdentity(log, runId) {
  const { name, id } = student();
  log.step('Submission details');
  log.info(`  run id:       ${runId}`);
  log.info(`  student:      ${name || 'NOT SET'}`);
  log.info(`  student id:   ${id || 'NOT SET'}`);
  log.info(`  log file:     ${log.file}`);

  if (!name || !id) {
    log.warn('STUDENT_NAME and STUDENT_ID are not set - this log cannot be graded as it stands.');
    log.info('  Add them to .env, for example:');
    log.info('    STUDENT_NAME=Alice Johnson');
    log.info('    STUDENT_ID=1212345678');
    log.info('  then restart the app so a fresh log carries your name.');
  }
}

// Printed at startup so students know what is expected before they begin
function logSubmissionInstructions(log) {
  log.step('What to submit');
  log.info(`  1. Exercise every endpoint for Level ${LEVEL} (the CLO list below says which).`);
  log.info('  2. Stop the server with Ctrl+C - the CLO summary is written on shutdown.');
  log.info(`  3. Submit the newest file in logs/ (logs/app-latest.log is a copy of it).`);
  log.info('  4. A log that shows missing CLOs, or no student name, will be returned unmarked.');
}

function logCloPlan(log, tracker) {
  log.step(`Course Learning Outcomes to demonstrate (Level ${LEVEL})`);
  for (const clo of tracker.clos) {
    log.info(`  ${clo.id}  ${clo.text}`);
    log.detail(`      how: ${clo.howTo}`);
  }
}

// Called on shutdown: the section a grader reads first
function logCloSummary(log, tracker, runId, origin = null) {
  const rows = tracker.summary();
  const covered = rows.filter((row) => row.covered);

  log.step(`CLO COVERAGE - ${covered.length}/${rows.length} demonstrated  (run ${runId})`);
  for (const row of rows) {
    if (row.covered) log.done(`${row.id}  ${row.text}   [first seen ${row.firstSeen}]`);
    else log.error(`${row.id}  ${row.text}   NOT DEMONSTRATED`);
  }

  const missing = rows.filter((row) => !row.covered);
  if (missing.length) {
    log.step('To complete this submission, still to do');
    missing.forEach((row, index) => {
      log.info(`  ${index + 1}. ${row.id}: ${row.howTo}`);
      log.detail(`      still missing: ${row.missing.join(' | ')}`);
    });
    log.info('\n  Run those, stop the server again, and submit the NEW log file.');
  } else {
    log.info('\n  All outcomes demonstrated. This log is ready to submit.');
  }

  const { name, id } = student();
  log.info(`\n  Student: ${name || 'NOT SET'} (${id || 'NOT SET'})  -  Level ${LEVEL}  -  run ${runId}`);
  log.info(`  Started from: ${origin ? formatOrigin(origin) : 'not recorded'}`);
  return { covered: covered.length, total: rows.length };
}

// A checksum over everything above it. Editing the log to fake coverage
// invalidates this line - it is a deterrent, not cryptographic proof.
function appendChecksum(log) {
  if (!log.file || !fs.existsSync(log.file)) return null;
  const body = fs.readFileSync(log.file, 'utf8');
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const line = `# checksum sha256 of everything above: ${digest}\n`;

  fs.appendFileSync(log.file, line);
  const latest = path.join(path.dirname(log.file), `${path.basename(log.file).split('-')[0]}-latest.log`);
  if (fs.existsSync(latest)) fs.appendFileSync(latest, line);
  return digest;
}

module.exports = {
  student,
  logStudentIdentity,
  logSubmissionInstructions,
  logCloPlan,
  logCloSummary,
  appendChecksum
};
