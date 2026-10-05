/**
 * Authentication controller: registration and login.
 *
 * Both handlers are deliberately "thin" - validation already happened in
 * middleware, so this file focuses purely on the business logic:
 * hashing/checking passwords, talking to the user store, issuing tokens,
 * and logging security-relevant events.
 */
const bcrypt = require('bcryptjs'); // Password hashing library - deliberately slow and salted, unlike fast general-purpose hashes.

const User = require('../models/userModel'); // Mongoose model - the data access layer for user records.
const { toPublicProfile } = require('../models/userModel'); // Strips the password hash before a user is sent to the client.
const { signToken } = require('../utils/jwt'); // Issues a signed JWT after a successful login.
const AppError = require('../utils/AppError'); // Operational-error class for controlled, safe error responses.
const logger = require('../utils/logger'); // Structured logger for recording registration/login events.

const SALT_ROUNDS = 12; // Higher = slower to brute force, but slower to hash.
// 12 is the OWASP-recommended baseline for bcrypt as of 2024/2025 - a good
// balance between attacker cost and acceptable login latency.

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', SALT_ROUNDS); // Compared against when an email isn't registered.

async function register(req, res, next) {
  // Express route handler: (request, response, next-function). Marked `async` so we can `await` inside.
  try {
    const { name, email, password, role } = req.body; // req.body was already validated by validators.js before this runs.
    const normalisedEmail = email.trim().toLowerCase(); // Normalise so "A@B.com" and "a@b.com" are treated as the same account.

    const existing = await User.exists({ email: normalisedEmail }); // Check whether an account with this email already exists.
    if (existing) {
      // Generic-enough not to help an attacker enumerate accounts via
      // response timing/content beyond "this email is taken", which is an
      // accepted, low-risk trade-off for a usable registration flow.
      throw new AppError('An account with this email already exists.', 409); // 409 Conflict - the resource (email) already exists.
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); // Hash the plain-text password - this is what actually gets stored.

    let newUser;
    try {
      newUser = await User.create({
        name: name.trim(), // Store the trimmed name (validators.js already enforced format/length).
        email: normalisedEmail, // Store the normalised email so lookups are consistent.
        password: hashedPassword, // hash only - the plain-text password is
        // never stored, logged, or held onto beyond this function's scope.
        role: role || 'client', // Default to 'client' if no role was supplied (role is optional in validators.js).
      }); // MongoDB generates a random ObjectId as the primary key.
    } catch (err) {
      // Two simultaneous registrations for the same email can both pass the
      // exists() check above - the unique index then rejects the second one
      // with error code 11000, which we report as the same controlled 409.
      if (err.code === 11000) throw new AppError('An account with this email already exists.', 409);
      throw err;
    }

    logger.security('REGISTER_SUCCESS', { userId: newUser.id, role: newUser.role }); // Audit trail entry - no sensitive data included.

    return res.status(201).json({
      success: true, // Consistent response shape used across the whole API.
      message: 'Account created successfully. You can now log in.',
      data: toPublicProfile(newUser), // Strips the password hash before this ever reaches the client.
    });
  } catch (err) {
    return next(err); // Forward any error (AppError or unexpected) to the central error handler.
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body; // Already validated (both fields present, email well-formed) by validators.js.
    const normalisedEmail = email.trim().toLowerCase(); // Match the same normalisation used at registration time.

    const user = await User.findOne({ email: normalisedEmail }).select('+password'); // Look up the account; the hash is opted in only here.

    // Intentionally the SAME error message and status code whether the
    // email doesn't exist or the password is wrong. Distinguishing the two
    // would let an attacker enumerate which emails are registered.
    const invalidCredentialsError = new AppError('Invalid email or password.', 401); // Pre-built, reused for both failure cases below.

    // When the account doesn't exist we still run a bcrypt comparison
    // (against a dummy hash) so the response takes the same time either way -
    // otherwise a fast reply would reveal "no such email" via timing.
    const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user) {
      logger.security('LOGIN_FAILED', { email: normalisedEmail, reason: 'no_such_user', ip: req.ip }); // Logged server-side only - the client never sees "reason".
      throw invalidCredentialsError;
    }

    if (!passwordMatches) {
      logger.security('LOGIN_FAILED', { email: normalisedEmail, reason: 'bad_password', ip: req.ip });
      throw invalidCredentialsError; // Same error/status as "no such user" - keeps the response indistinguishable to an attacker.
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email }); // Issue a JWT proving this user is now authenticated.

    logger.security('LOGIN_SUCCESS', { userId: user.id, role: user.role }); // Audit trail entry for a successful login.

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token, // The client stores this and sends it back as `Authorization: Bearer <token>` on future requests.
      data: toPublicProfile(user), // User's own profile, password hash stripped.
    });
  } catch (err) {
    return next(err); // Forward to the central error handler.
  }
}

module.exports = { register, login }; // Wired up to POST /api/auth/register and POST /api/auth/login in authRoutes.js.
