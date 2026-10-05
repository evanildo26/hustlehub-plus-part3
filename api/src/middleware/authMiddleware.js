/**
 * JWT authentication + authorisation middleware.
 *
 * `protect` runs on every route that requires a logged-in user. It:
 *   1. Reads the token from the `Authorization: Bearer <token>` header.
 *   2. Verifies its signature and expiry against JWT_SECRET.
 *   3. Confirms the user referenced by the token still exists.
 *   4. Attaches a minimal `req.user` object for downstream handlers.
 *
 * This means the token is validated on EVERY protected request (not just
 * checked for presence) - a forged, tampered, or expired token is
 * rejected even if it "looks" well-formed.
 *
 * `restrictTo` builds on top of `protect` to provide role-based access
 * control (RBAC): e.g. only freelancers may create gigs, only clients may
 * book them, only admins may list users. Resource OWNERSHIP (e.g. "this is
 * my gig") is checked separately inside the controllers, because it depends
 * on the specific record being accessed, not just the caller's role.
 */
const { verifyToken } = require('../utils/jwt'); // Our wrapper around jsonwebtoken's verify() function.
const AppError = require('../utils/AppError'); // Operational-error class for controlled 401/403 responses.
const logger = require('../utils/logger'); // Structured logger, used to record suspicious/invalid token attempts.
const User = require('../models/userModel'); // Used to confirm the user referenced by the token still exists.

async function protect(req, res, next) {
  // Express middleware signature: (request, response, next-function).
  try {
    const authHeader = req.headers.authorization || ''; // Read the Authorization header, defaulting to '' if absent.
    const [scheme, token] = authHeader.split(' '); // Expected format: "Bearer <token>" - split into its two parts.

    if (scheme !== 'Bearer' || !token) {
      // Reject if the header is missing, malformed, or uses a different scheme.
      throw new AppError('You are not logged in. Please log in to access this resource.', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token); // Verify signature + expiry; throws if either check fails.
    } catch (err) {
      // Covers expired tokens, tampered signatures, and malformed tokens -
      // all treated the same way from the client's perspective.
      logger.security('INVALID_TOKEN_ATTEMPT', {
        path: req.originalUrl, // Which endpoint was being accessed.
        reason: err.name, // e.g. 'TokenExpiredError', 'JsonWebTokenError' - useful server-side, not sent to the client.
      });
      throw new AppError('Invalid or expired session. Please log in again.', 401); // Generic message - doesn't reveal *why* it failed.
    }

    const user = await User.findById(decoded.id).lean(); // Re-check the user still exists (e.g. wasn't deleted after the token was issued).
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    // Minimal, non-sensitive user context for the rest of the request. The
    // role comes from the DATABASE, not the token, so a role change takes
    // effect immediately rather than when the old token expires.
    req.user = { id: user._id.toString(), role: user.role, email: user.email, name: user.name }; // Never the password hash.
    next(); // Validation passed - continue to the next middleware/controller.
  } catch (err) {
    next(err); // Forward any thrown error to the central error handler instead of letting it crash the request.
  }
}

function restrictTo(...allowedRoles) {
  // Higher-order function: called with a list of roles, returns an actual middleware function.
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      // `protect` must run first to populate req.user; if the role isn't in the allowed list, deny access.
      logger.security('ACCESS_DENIED', {
        userId: req.user && req.user.id,
        role: req.user && req.user.role,
        required: allowedRoles,
        method: req.method,
        path: req.originalUrl,
      }); // Repeated denials from one account can indicate someone probing for privilege-escalation gaps.
      return next(new AppError('You do not have permission to perform this action.', 403)); // 403 Forbidden - authenticated, but not authorised.
    }
    next(); // Role is allowed - continue.
  };
}

/**
 * For PUBLIC routes that behave slightly differently for a logged-in user
 * (e.g. an owner can view their own inactive gig). A valid token attaches
 * req.user; a missing or invalid token simply means "anonymous" - it never
 * blocks the request, because the route is public anyway.
 */
async function optionalAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next();
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).lean();
    if (user) req.user = { id: user._id.toString(), role: user.role, email: user.email, name: user.name };
  } catch {
    // Invalid/expired token on a public route: continue as anonymous.
  }
  return next();
}

module.exports = { protect, restrictTo, optionalAuth }; // Export both so routes can compose them, e.g. router.post('/gigs', protect, restrictTo('freelancer'), ...).
