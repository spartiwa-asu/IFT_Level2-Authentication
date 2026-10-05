// =============================================================================
// labs/jwt-walkthrough.js - HOW A JWT IS BUILT AND VERIFIED (HS256)
//
// This is a stand-alone lab. The API itself does NOT use JWTs: it uses opaque
// session tokens (controllers/authController.js). Here you build a JWT by hand to
// compare the two designs:
//   opaque token : random bytes; the server looks it up in the database to trust it
//   JWT          : readable claims + a signature; the server recomputes the signature
//                  with its secret to trust it - no database lookup
//
// Run:    VS Code -> Run and Debug -> "Debug JWT lab" -> F5   (or: node labs/jwt-walkthrough.js)
// Needs:  JWT_SECRET (and optionally JWT_LIFETIME_SECONDS) in .env
//
// Built with node:crypto so every step is visible. Real applications should use a
// maintained library (e.g. jsonwebtoken) that also checks issuer, audience, etc.
// =============================================================================
const { createHmac, timingSafeEqual } = require('node:crypto');
const dotenv = require('dotenv');

dotenv.config({ path: `${__dirname}/../.env`, quiet: true });
dotenv.config({ path: `${__dirname}/../config.env`, quiet: true });

const SECRET = process.env.JWT_SECRET;
const LIFETIME_SECONDS = Number(process.env.JWT_LIFETIME_SECONDS) || 5;

if (!SECRET || SECRET.length < 32) {
  console.error('JWT_SECRET is missing or shorter than 32 characters. Add it to .env, e.g.');
  console.error('JWT_SECRET=' + require('node:crypto').randomBytes(32).toString('hex'));
  process.exit(1);
}

// Base64URL = Base64 made safe for URLs and headers (no + / =). It is ENCODING, not
// encryption: anyone can decode it.
const base64url = (input) => Buffer.from(input).toString('base64url');
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');

function createJwt(claims, secret) {
  // ● BREAKPOINT J1 - the HEADER: which algorithm signed this token
  //   Inspect:  header, encodedHeader
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));

  // ● BREAKPOINT J2 - the PAYLOAD (claims): who, issued when, expires when
  //   Inspect:  payload.iat and payload.exp are seconds since 1970. The token carries
  //             its OWN expiry - compare with the opaque token, whose expiry lives only
  //             in the sessions collection.
  //   Note:     the payload is readable by anyone. Never put a password in it.
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now, exp: now + LIFETIME_SECONDS };
  const encodedPayload = base64url(JSON.stringify(payload));

  // ● BREAKPOINT J3 - the SIGNATURE: HMAC-SHA256(secret, header.payload)
  //   Inspect:  signature
  //   Why:      only someone holding JWT_SECRET can produce this value. That is how a
  //             server later proves "I created this token" without a database.
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  // ● BREAKPOINT J4 - VERIFY: split the token into its three parts
  //   Inspect:  decode(encodedHeader), decode(encodedPayload) in the DEBUG CONSOLE
  const [encodedHeader, encodedPayload, signature] = String(token).split('.');
  if (!encodedHeader || !encodedPayload || !signature) return { valid: false, reason: 'not three parts' };

  // Never let the token choose its own algorithm - accept only the one we use.
  if (decode(encodedHeader).alg !== 'HS256') return { valid: false, reason: 'unexpected alg' };

  // ● BREAKPOINT J5 - VERIFY: recompute the signature and compare
  //   Inspect:  expected vs signature - equal only if header, payload AND secret are unchanged.
  //   Why:      timingSafeEqual takes the same time whether the first or last character
  //             differs, so an attacker cannot guess the signature byte by byte.
  const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const same = expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!same) return { valid: false, reason: 'invalid signature' };

  // ● BREAKPOINT J6 - VERIFY: the signature is fine, but is the token still alive?
  //   Inspect:  payload.exp vs now
  const payload = decode(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { valid: false, reason: `expired ${now - payload.exp}s ago` };

  return { valid: true, payload };
}

const show = (label, result) =>
  console.log(`${label.padEnd(38)} ${result.valid ? 'VALID' : 'REJECTED - ' + result.reason}`);

(async () => {
  // 1) Create a token for a demo user (no database involved)
  const token = createJwt({ sub: '66f0c0ffee0000000000abcd', email: 'alice@ift458.test' }, SECRET);
  console.log('\nJWT (header.payload.signature):\n' + token + '\n');
  console.log('Decoded header: ', decode(token.split('.')[0]));
  console.log('Decoded payload:', decode(token.split('.')[1]), '\n');

  // 2) The untouched token verifies
  show('1. original token', verifyJwt(token, SECRET));

  // 3) Tamper with the payload: change the email, keep the old signature
  const [h, p, s] = token.split('.');
  const forgedPayload = base64url(JSON.stringify({ ...decode(p), email: 'mallory@ift458.test' }));
  show('2. payload changed (email)', verifyJwt(`${h}.${forgedPayload}.${s}`, SECRET));

  // 4) Right token, wrong secret - a server that did not issue it cannot verify it
  show('3. verified with a different secret', verifyJwt(token, SECRET + 'x'));

  // 5) LIFE OF A JWT: wait until exp has passed. Nothing is deleted anywhere -
  //    the token simply stops verifying. There is also no server record to delete
  //    for an early logout: that is the JWT's revocation problem.
  console.log(`\nWaiting ${LIFETIME_SECONDS + 1}s for the token to expire (JWT_LIFETIME_SECONDS=${LIFETIME_SECONDS})...`);
  await new Promise((resolve) => setTimeout(resolve, (LIFETIME_SECONDS + 1) * 1000));
  show('4. same token after exp', verifyJwt(token, SECRET));
})();
