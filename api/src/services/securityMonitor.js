/**
 * Security monitoring (additional security feature #3).
 *
 * Subscribes to the logger and, for every `security` / `alert` entry:
 *   1. Stores it in MongoDB (SecurityEvent) for the admin Security monitor.
 *   2. Watches for attack patterns: when one IP produces
 *      SECURITY_ALERT_THRESHOLD (default 10) suspicious events within
 *      SECURITY_ALERT_WINDOW_MINUTES (default 5), it raises a single
 *      SECURITY_ALERT naming the pattern (brute force, access probing,
 *      injection attempts). The alert is a log entry like any other, so it
 *      reaches Better Stack, where an alert rule can email the team.
 *
 * Individual failed logins are normal (people mistype passwords); ten from
 * one address in five minutes is not. Turning a stream of events into one
 * actionable alert is what makes the logs useful for monitoring.
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SecurityEvent = require('../models/securityEventModel');
const LoginAttempt = require('../models/loginAttemptModel');
const { security } = require('../config/env');

const SUSPICIOUS = new Set([
  'LOGIN_FAILED',
  'LOGIN_BLOCKED_LOCKED',
  'ACCOUNT_LOCKED',
  'ACCESS_DENIED',
  'OWNERSHIP_VIOLATION',
  'INVALID_TOKEN_ATTEMPT',
  'REVOKED_TOKEN_USED',
  'NOSQL_INJECTION_ATTEMPT',
  'RATE_LIMIT_EXCEEDED',
]);

// Recent suspicious events per IP: ip -> [{ at, event }]. In memory is enough
// for one API instance; several instances would share this via Redis.
const recent = new Map();
const lastAlertAt = new Map();
const MAX_TRACKED_IPS = 10000;

function classify(events) {
  const count = (names) => events.filter((e) => names.includes(e.event)).length;
  const half = events.length / 2;
  if (count(['LOGIN_FAILED', 'LOGIN_BLOCKED_LOCKED', 'ACCOUNT_LOCKED']) >= half) return 'BRUTE_FORCE_LOGIN';
  if (count(['ACCESS_DENIED', 'OWNERSHIP_VIOLATION']) >= half) return 'ACCESS_PROBING';
  if (count(['NOSQL_INJECTION_ATTEMPT']) >= half) return 'INJECTION_ATTEMPTS';
  if (count(['INVALID_TOKEN_ATTEMPT', 'REVOKED_TOKEN_USED']) >= half) return 'TOKEN_TAMPERING';
  return 'SUSPICIOUS_ACTIVITY';
}

/** Records one suspicious event for an IP and raises an alert if the IP crossed the threshold. */
function track(entry) {
  if (!entry.ip || !SUSPICIOUS.has(entry.event)) return;
  const now = Date.now();
  const windowMs = security.alertWindowMinutes * 60 * 1000;

  if (!recent.has(entry.ip) && recent.size >= MAX_TRACKED_IPS) recent.delete(recent.keys().next().value); // Bound memory.
  const events = (recent.get(entry.ip) || []).filter((e) => now - e.at < windowMs);
  events.push({ at: now, event: entry.event });
  recent.set(entry.ip, events);

  const alertedRecently = now - (lastAlertAt.get(entry.ip) || 0) < windowMs;
  if (events.length >= security.alertThreshold && !alertedRecently) {
    lastAlertAt.set(entry.ip, now);
    const breakdown = events.reduce((acc, e) => ({ ...acc, [e.event]: (acc[e.event] || 0) + 1 }), {});
    logger.alert('SECURITY_ALERT', {
      pattern: classify(events),
      ip: entry.ip,
      eventCount: events.length,
      windowMinutes: security.alertWindowMinutes,
      breakdown,
    });
  }
}

function persist(entry) {
  if (mongoose.connection.readyState !== 1) return; // DB not connected (startup/shutdown) - the file and cloud copies still exist.
  const { timestamp, level, event, requestId, ip, userId, path, service: _s, env: _e, ...details } = entry;
  SecurityEvent.create({ event, level, requestId, ip, userId, path, details, createdAt: timestamp }).catch(() => {
    // Never let monitoring storage break the request; the event is still in the log file / Better Stack.
  });
}

/** Hooks the monitor into the logger. Called once from app.js. */
function startSecurityMonitor() {
  logger.addSink((entry) => {
    if (entry.level !== 'security' && entry.level !== 'alert') return;
    persist(entry);
    track(entry);
  });
}

/** Admin dashboard data for the last `hours` hours. */
async function getSecuritySummary({ hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [byEvent, topIps, alerts, recentEvents, lockedAccounts] = await Promise.all([
    SecurityEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    SecurityEvent.aggregate([
      { $match: { createdAt: { $gte: since }, event: { $in: ['LOGIN_FAILED', 'ACCESS_DENIED', 'OWNERSHIP_VIOLATION', 'NOSQL_INJECTION_ATTEMPT', 'INVALID_TOKEN_ATTEMPT'] }, ip: { $ne: null } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, ip: '$_id', count: 1, last: 1 } },
    ]),
    SecurityEvent.find({ event: 'SECURITY_ALERT', createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20),
    SecurityEvent.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(50),
    LoginAttempt.countDocuments({ lockedUntil: { $gt: new Date() } }),
  ]);

  const counts = Object.fromEntries(byEvent.map((e) => [e._id, e.count]));
  return {
    windowHours: hours,
    since: since.toISOString(),
    totals: {
      failedLogins: counts.LOGIN_FAILED || 0,
      successfulLogins: counts.LOGIN_SUCCESS || 0,
      accountsLocked: counts.ACCOUNT_LOCKED || 0,
      currentlyLocked: lockedAccounts,
      accessDenied: (counts.ACCESS_DENIED || 0) + (counts.OWNERSHIP_VIOLATION || 0),
      injectionAttempts: counts.NOSQL_INJECTION_ATTEMPT || 0,
      invalidTokens: (counts.INVALID_TOKEN_ATTEMPT || 0) + (counts.REVOKED_TOKEN_USED || 0),
      rateLimited: counts.RATE_LIMIT_EXCEEDED || 0,
      alerts: counts.SECURITY_ALERT || 0,
    },
    byEvent: byEvent.map((e) => ({ event: e._id, count: e.count })),
    topIps,
    alerts,
    recentEvents,
  };
}

/** Test hook: forget the in-memory alert state. */
function resetMonitorState() {
  recent.clear();
  lastAlertAt.clear();
}

module.exports = { startSecurityMonitor, getSecuritySummary, resetMonitorState, SUSPICIOUS };
