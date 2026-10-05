/**
 * Thin wrapper around jsonwebtoken so the rest of the codebase never
 * touches process.env or the jsonwebtoken API directly.
 */
const jwt = require('jsonwebtoken'); // Third-party library implementing the JWT standard (signing + verifying tokens).
const { jwtSecret, jwtExpiresIn, jwtIssuer, jwtAudience } = require('../config/env');

const ALGORITHM = 'HS256'; // Pinned explicitly - see verifyToken below.

/**
 * Signs a JWT for an authenticated user.
 * Payload intentionally only contains non-sensitive identifiers -
 * never the password hash or other sensitive fields.
 */
function signToken({ id, role, email }) {
  // Destructure only the three fields we want to embed in the token - nothing else from the user object leaks in.
  return jwt.sign({ id: String(id), role, email }, jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: jwtExpiresIn,
    issuer: jwtIssuer, // `iss` - who created the token.
    audience: jwtAudience, // `aud` - who the token is for.
  });
}

/**
 * Verifies a token's signature, expiry, issuer and audience.
 * Throws (jsonwebtoken's own error types) if invalid/expired - callers
 * are expected to catch this and translate it into a generic 401.
 */
function verifyToken(token) {
  return jwt.verify(token, jwtSecret, {
    algorithms: [ALGORITHM], // Only accept HS256 - blocks "alg: none" and algorithm-confusion attacks.
    issuer: jwtIssuer, // Reject tokens minted by anything other than this API.
    audience: jwtAudience, // Reject tokens intended for a different audience.
  });
}

module.exports = { signToken, verifyToken }; // Export both functions for use by the auth controller and auth middleware.
