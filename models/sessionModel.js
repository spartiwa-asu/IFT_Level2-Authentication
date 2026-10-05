// =============================================================================
// sessionModel.js - one document per login. This is the server's memory of every
// token it has issued (see BREAKPOINTS 11 and 14).
//
// LIFE OF THE TOKEN
//   1. BIRTH    login creates a random token and stores its SHA-256 here  (BREAKPOINTS 9-11)
//   2. USE      every protected request re-hashes the token and finds this record (BREAKPOINT 14)
//   3. EXPIRY   after TOKEN_LIFETIME_MINUTES (.env) the middleware rejects it immediately
//   4. CLEANUP  the TTL index below lets MongoDB delete the expired record (about once a minute)
//   Known gap:  this build has no logout endpoint, so a token cannot be cancelled early -
//               a stolen token works until it expires.
// =============================================================================
const mongoose = require('mongoose');

// Persist only a digest: a database read must not reveal usable credentials.
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // expires: 0 creates a TTL index - MongoDB deletes the document once expiresAt has passed
  expiresAt: { type: Date, required: true, expires: 0 }
});

module.exports = mongoose.model('Session', sessionSchema);
