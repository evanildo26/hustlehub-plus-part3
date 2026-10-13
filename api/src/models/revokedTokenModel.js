/**
 * Denylist of JWTs that were revoked before they expired (logout).
 *
 * A JWT is valid until its `exp` time no matter what the server does -
 * unless the server keeps a list of tokens it has withdrawn. Each token
 * carries a unique id (`jti`); logging out stores that id here and
 * `protect` rejects any token whose id is on the list. Entries delete
 * themselves once the token would have expired anyway (TTL index), so the
 * list only ever holds still-live tokens.
 */
const mongoose = require('mongoose');

const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: ['logout'], default: 'logout' },
  expiresAt: { type: Date, required: true },
});

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
