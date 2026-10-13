/**
 * Per-account lockout (additional security feature #1).
 *
 * The Part 2 login limiter counts failures per IP address. An attacker with
 * many IPs (a botnet, or rotating proxies) can still try thousands of
 * passwords against ONE account. This adds a second, per-email counter:
 * after LOCKOUT_THRESHOLD (default 5) failures within LOCKOUT_MINUTES
 * (default 15), that email is locked for LOCKOUT_MINUTES, whatever IP the
 * next attempt comes from.
 *
 * Trade-off: someone could deliberately lock a victim out by typing wrong
 * passwords for their email. The lock is therefore short and lifts by
 * itself rather than being permanent, every lock is logged (ACCOUNT_LOCKED)
 * and shows up on the admin Security monitor.
 */
const LoginAttempt = require('../models/loginAttemptModel');
const { security } = require('../config/env');

const windowMs = () => security.lockoutMinutes * 60 * 1000;

/** Minutes left on a lock for this email, or 0 if it isn't locked. */
async function lockedMinutesLeft(email) {
  const record = await LoginAttempt.findOne({ email }).lean();
  if (!record || !record.lockedUntil) return 0;
  const msLeft = record.lockedUntil.getTime() - Date.now();
  return msLeft > 0 ? Math.ceil(msLeft / 60000) : 0;
}

/**
 * Counts a failed login. Returns { failures, locked, minutes }.
 * The counter update is a single atomic $inc, so parallel guesses can't
 * slip past the threshold.
 */
async function recordFailure(email) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs());

  // Failures from an old window no longer count - start a fresh one.
  await LoginAttempt.updateOne({ email, windowStartedAt: { $lt: windowStart } }, { $set: { failures: 0, windowStartedAt: now } });

  const record = await LoginAttempt.findOneAndUpdate(
    { email },
    { $inc: { failures: 1 }, $setOnInsert: { windowStartedAt: now }, $set: { expiresAt: new Date(now.getTime() + windowMs()) } },
    { upsert: true, new: true }
  );

  if (record.failures >= security.lockoutThreshold) {
    const lockedUntil = new Date(now.getTime() + windowMs());
    await LoginAttempt.updateOne({ email }, { $set: { lockedUntil, failures: 0, windowStartedAt: now, expiresAt: lockedUntil } });
    return { failures: record.failures, locked: true, minutes: security.lockoutMinutes };
  }
  return { failures: record.failures, locked: false, minutes: 0 };
}

/** A successful login wipes the counter. */
async function clearFailures(email) {
  await LoginAttempt.deleteOne({ email });
}

module.exports = { lockedMinutesLeft, recordFailure, clearFailures };
