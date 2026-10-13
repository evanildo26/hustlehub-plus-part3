/**
 * Failed-login tracking per EMAIL ADDRESS, used for account lockout.
 *
 * Keyed by the email that was typed, not by user id, on purpose: an
 * address that has no account gets locked in exactly the same way as a
 * real one, so the lockout response can't be used to discover which
 * emails are registered. Records expire on their own (TTL index), so the
 * collection never grows without bound.
 */
const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  failures: { type: Number, default: 0 }, // Failed attempts in the current window.
  windowStartedAt: { type: Date, default: Date.now }, // Failures older than the lockout window don't count.
  lockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true }, // MongoDB deletes the document after this time.
});

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
