// =============================================================================
// authController.js - the CONTROLLER for signup and login (the "C" in MVC)
//
// DEBUGGING WALKTHROUGH (see DEBUGGING.md for setup):
//   Each "● BREAKPOINT n" block below tells you where to click. Set the red dot
//   on the FIRST CODE LINE UNDER the block (click left of the line number), start
//   "Debug API server" with F5, then send the request named in "Trigger".
//
//   Journey 1 - SIGNUP: plain password -> salted bcrypt hash   (BREAKPOINTS 1-5)
//   Journey 2 - LOGIN:  check password -> issue a session token (BREAKPOINTS 6-11)
//   Journey 3 - USE THE TOKEN: middleware/authenticate.js       (BREAKPOINTS 12-16)
// =============================================================================
const { randomBytes, createHash } = require('node:crypto');
const Session = require('../models/sessionModel');
const User = require('../models/userModel');

// How long a login token lives. Set TOKEN_LIFETIME_MINUTES=1 in .env and restart
// to watch a token expire during class; the default is 24 hours.
const TOKEN_LIFETIME_MINUTES = Number(process.env.TOKEN_LIFETIME_MINUTES) || 24 * 60;

// Only these fields are ever returned to the client
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

// POST /api/v1/users/signup
exports.signup = async (req, res) => {
  // ● BREAKPOINT 1 of 16 - SIGNUP: the request reaches the controller
  //   Trigger:  Swagger -> POST /users/signup -> Try it out -> Execute
  //   Inspect:  req.body.password  - still the plain text the user typed.
  //   Why:      the route (routes/userRoutes.js) sent POST /signup here; nothing
  //             has protected the password yet.
  //   Next:     F5 (Continue) - the debugger stops in models/userModel.js (BREAKPOINT 2).
  // Destructure only the fields we expect - nothing else from the body reaches the DB
  const { name, email, password, passwordConfirmation } = req.body || {};
  const user = await User.create({ name, email, password, passwordConfirmation });

  // ● BREAKPOINT 5 of 16 - SIGNUP: the user is saved, build the response
  //   Inspect:  user.password  - now a 60-character bcrypt hash, not the plain text.
  //             publicUser(user) - type it in the DEBUG CONSOLE: no password field.
  //   Why:      the JSON response is this API's "View"; it must never echo secrets.
  //             Signup does not log you in - no token is created here.
  res.status(201).json({ status: 'success', data: { user: publicUser(user) } });
};

// POST /api/v1/users/login
exports.login = async (req, res) => {
  // ● BREAKPOINT 6 of 16 - LOGIN: the credentials arrive
  //   Trigger:  Swagger -> POST /users/login with the email + password you signed up with
  //   Inspect:  req.body.email, req.body.password (plain text, sent once, over HTTPS in real life)
  const { email, password } = req.body || {};

  // 1) Both fields present? (the `return` stops Express from trying to respond twice)
  if (!email || !password) {
    return res.status(400).json({ status: 'fail', message: 'Please provide email and password.' });
  }

  // ● BREAKPOINT 7 of 16 - LOGIN: load the user AND the stored hash
  //   Step over (F10) this line, then inspect:  user.password
  //   Why:      the schema hides password (select: false); .select('+password') asks
  //             for it explicitly because we need the hash to compare against.
  //   Try:      log in with an unknown email - user is null.
  // 2) Find the user. String() stops someone sending {"$gt": ""} as the email (NoSQL injection).
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  // ● BREAKPOINT 8 of 16 - LOGIN: validate the password
  //   Step into (F11) isPasswordMatch to land in models/userModel.js, or just step over (F10).
  //   Try:      a wrong password - you reach the 401 below. Note the message is identical
  //             for "no such user" and "wrong password".
  // 3) Same message for "no such user" and "wrong password" - don't reveal which emails exist
  if (!user || !(await user.isPasswordMatch(String(password)))) {
    return res.status(401).json({ status: 'fail', message: 'Incorrect email or password.' });
  }

  // ---- LIFE OF THE TOKEN, stage 1: BIRTH -----------------------------------
  // ● BREAKPOINT 9 of 16 - LOGIN: the token is born
  //   Step over (F10), then inspect:  token  - 64 hex characters (32 random bytes).
  //   Why:      it is OPAQUE: random, meaningless, not a JWT. It contains no email, id
  //             or expiry. The only way to know who it belongs to is the database record
  //             created below. (Compare with labs/jwt-walkthrough.js, where the token
  //             carries its own claims and a signature.)
  const token = randomBytes(32).toString('hex');

  // ● BREAKPOINT 10 of 16 - LOGIN: the token's lifetime is decided
  //   Inspect:  expiresAt, TOKEN_LIFETIME_MINUTES (from .env, default 1440 = 24 h)
  //   Why:      the server, not the client, decides when the token dies.
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MINUTES * 60 * 1000);

  // ● BREAKPOINT 11 of 16 - LOGIN: remember that WE issued this token
  //   In the DEBUG CONSOLE type:  createHash('sha256').update(token).digest('hex')
  //   Why:      only this SHA-256 digest is stored. Someone who can read the sessions
  //             collection cannot use a digest as a token. This record is the server's
  //             proof, later, that it created the token (BREAKPOINT 14).
  //   Check:    in Atlas/Compass, the sessions document has tokenHash - never the token.
  await Session.create({
    tokenHash: createHash('sha256').update(token).digest('hex'),
    user: user._id,
    expiresAt
  });

  // The raw token leaves the server exactly once, in this response. The client must
  // send it back in the Authorization header: "Bearer <token>" (Journey 3).
  res.set('Cache-Control', 'no-store').status(200).json({
    status: 'success',
    token,
    expiresAt,
    data: { user: publicUser(user) }
  });
};
