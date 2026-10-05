const describeError = require('../utils/describeError');

// Express recognises an error handler by its FOUR parameters.
// It takes the logger, so a 500 is explained in the log, not just returned.
module.exports = (log) =>
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    let { statusCode, message } = describeError(err);

    if (statusCode >= 500) {
      log?.error?.(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`);
      log?.detail?.(String(err.stack || err));
      if (process.env.NODE_ENV === 'production') message = 'Something went wrong.';
    }

    // requestLogger reads this when it logs the outcome
    res.locals.failureMessage = message;
    res.status(statusCode).json({ status: statusCode < 500 ? 'fail' : 'error', message });
  };
