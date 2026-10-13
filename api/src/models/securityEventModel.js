/**
 * Security events kept in MongoDB for the admin Security monitor.
 *
 * Every `security` and `alert` log entry is also written here (see
 * services/securityMonitor.js), so an admin can see failed logins,
 * lockouts, access-control violations and attack alerts inside the app.
 * The full history also goes to the log file and Better Stack; this copy
 * is kept for 30 days (TTL index) to bound its size.
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 30;

const securityEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true }, // e.g. LOGIN_FAILED, ACCOUNT_LOCKED, SECURITY_ALERT
    level: { type: String, enum: ['security', 'alert'], required: true },
    requestId: String,
    ip: String,
    userId: String,
    path: String,
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // Already redacted by the logger.
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
