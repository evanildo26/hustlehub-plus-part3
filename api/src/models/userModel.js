/**
 * User model (MongoDB via Mongoose).
 *
 * Replaces the Part 1 JSON-file store. Controllers still only talk to this
 * module - never to the database driver directly - so the "single point of
 * data access" boundary from Part 1 is preserved.
 */
const mongoose = require('mongoose');

const ROLES = ['client', 'freelancer', 'admin']; // Every role the system knows about.

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true, // Unique index - the database itself refuses duplicate accounts, even under a race condition.
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false, // The bcrypt hash is excluded from every query unless explicitly requested with .select('+password').
    },
    role: { type: String, enum: ROLES, default: 'client' },
    // Bumped to revoke every token issued so far (admin 'revoke sessions').
    // Each JWT carries the version it was issued with; protect() rejects older ones.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true, // Adds createdAt / updatedAt automatically.
    toJSON: {
      // Controls what leaves the server whenever a user document is serialised in a response.
      transform(doc, ret) {
        ret.id = ret._id.toString(); // Expose a plain `id` like Part 1 did.
        delete ret._id;
        delete ret.__v;
        delete ret.password; // Belt and braces: never serialise the hash, even if it was selected.
        return ret;
      },
    },
  }
);

/** Strips fields that must never leave the server (password hash etc.) */
function toPublicProfile(user) {
  if (!user) return null; // Guard against being called with a missing user (e.g. lookup failed).
  return typeof user.toJSON === 'function' ? user.toJSON() : user;
}

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.toPublicProfile = toPublicProfile;
