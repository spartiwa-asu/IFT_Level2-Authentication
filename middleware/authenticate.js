// =============================================================================
// authenticate.js - MIDDLEWARE that guards every game and score route
// Journey 3 - USE THE TOKEN (BREAKPOINTS 12-15). app.js runs this function BEFORE
// any game or score controller, for every request under /api/v1 except /users.
//
// Trigger for every breakpoint here: log in, click "Authorize" in Swagger, paste the
// token, then run GET /games. Also try: no token, a made-up token, an expired token.
// =============================================================================
const { createHash } = require('node:crypto');
const Session = require('../models/sessionModel');
const User = require('../models/userModel');

module.exports = async (req, res, next) => {
  // ● BREAKPOINT 12 of 16 - MIDDLEWARE: read the token from the request
  //   Step over (F10), then inspect:  req.get('authorization')  and  match
  //   Why:      the token must arrive as the header  Authorization: Bearer <64 hex>.
  //             Tokens in the URL or body are ignored (URLs end up in logs and history).
  //             match[1] is the token itself; match is null if the header is missing
  //             or malformed - try GET /games without clicking Authorize.
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.get('authorization') || '');
  const deny = () => res.set('WWW-Authenticate', 'Bearer').status(401).json({
    status: 'fail', message: 'Authentication required. Log in and provide a valid bearer token.'
  });
  if (!match) return deny();

  // ● BREAKPOINT 13 of 16 - MIDDLEWARE: hash the token we were given
  //   Step over (F10), then inspect:  tokenHash
  //   Why:      the database only holds the SHA-256 of each token (BREAKPOINT 11), so we
  //             hash what the client sent and look for the same digest.
  const tokenHash = createHash('sha256').update(match[1]).digest('hex');

  // ---- LIFE OF THE TOKEN, stage 2: EVERY USE --------------------------------
  // ● BREAKPOINT 14 of 16 - MIDDLEWARE: did WE issue this token, and is it still alive?
  //   Step over (F10), then inspect:  session  (a document, or null)
  //   Why:      a matching record proves this server created the token at login - an
  //             invented token has no record. expiresAt > now rejects an expired token
  //             right away. (Mongo's TTL index deletes old records too, but only about
  //             once a minute, so we never rely on it for security.)
  //   Try:      set TOKEN_LIFETIME_MINUTES=1 in .env, restart, log in, wait a minute,
  //             call GET /games again - session is null and you get 401.
  // Check expiry explicitly; MongoDB TTL cleanup is asynchronous.
  const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!session) return deny();

  // ● BREAKPOINT 15 of 16 - MIDDLEWARE: attach the user, then hand over to the route
  //   Step over (F10), then inspect:  user
  //   Why:      a valid token for a deleted account must not work, so we load the user.
  //             req.user is how the controller finds out who is calling. next() passes
  //             control to the next function in the chain - the game/score controller.
  //   Next:     F11 on next() or F5 - you land in controllers/gameController.js (BREAKPOINT 16).
  const user = await User.findById(session.user);
  if (!user) return deny();
  req.user = user;
  next();
};
///-------------------------



