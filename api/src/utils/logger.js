/**
 * Structured event logger with three outputs:
 *
 *   1. Console      - human-readable line for local development and
 *                     `docker compose logs`.
 *   2. Log file     - append-only JSON lines in src/logs/events.log, so
 *                     events survive restarts even with no network.
 *   3. Better Stack - (when BETTERSTACK_SOURCE_TOKEN is set) the same JSON
 *                     entries are batched and shipped over HTTPS to the
 *                     cloud log platform, where they can be searched,
 *                     charted and alerted on (see README section 9).
 *
 * Extra "sinks" can subscribe to entries (logger.addSink) - the security
 * monitor uses this to store security events in MongoDB for the admin
 * dashboard without the logger depending on the database.
 *
 * Every entry is automatically stamped with the request id, IP and user of
 * the request that produced it (utils/requestContext.js), and passes
 * through `redact` first: any field whose name looks like a secret
 * (password, token, authorization, secret, cookie) is replaced, so a
 * careless log call can never leak a credential to disk or to the cloud.
 */
const fs = require('fs');
const path = require('path');
const { getContext } = require('./requestContext');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'events.log');
const IS_TEST = process.env.NODE_ENV === 'test'; // Tests assert on behaviour, not log lines - no console/file/cloud output.
const SERVICE = 'hustlehub-api';

if (!IS_TEST && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------
const SECRET_KEY = /pass(word)?|token|secret|authori[sz]ation|cookie|jwt/i;

/** Deep-copies `value`, replacing secret-looking fields and cutting very long strings. */
function redact(value, depth = 0) {
  if (depth > 5) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1)])
    );
  }
  if (typeof value === 'string' && value.length > 4000) return `${value.slice(0, 4000)}…[TRUNCATED]`;
  return value;
}

/**
 * "thandiwe@demo.hustlehub.local" -> "th***@demo.hustlehub.local".
 * Failed-login logs need to show WHICH account is being attacked, but the
 * full address is personal information (POPIA) that the log platform
 * doesn't need. The domain and first two characters are enough to spot a
 * pattern; the full address stays in MongoDB.
 */
function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

// ---------------------------------------------------------------------------
// Better Stack shipping (batched, never blocks or crashes a request)
// ---------------------------------------------------------------------------
const cloud = {
  token: process.env.BETTERSTACK_SOURCE_TOKEN,
  host: (process.env.BETTERSTACK_INGEST_HOST || 'in.logs.betterstack.com').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  queue: [],
  timer: null,
  failures: 0,
};
const CLOUD_ENABLED = Boolean(cloud.token) && !IS_TEST;
const BATCH_SIZE = 50;
const FLUSH_MS = 2000;
const MAX_QUEUE = 5000; // If the platform is unreachable, keep at most this many entries in memory (oldest dropped first).

async function flushCloud() {
  clearTimeout(cloud.timer);
  cloud.timer = null;
  if (cloud.queue.length === 0) return;
  const batch = cloud.queue.splice(0, BATCH_SIZE);
  try {
    const res = await fetch(`https://${cloud.host}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cloud.token}` },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cloud.failures = 0;
  } catch (err) {
    cloud.failures += 1;
    if (cloud.failures === 1 || cloud.failures % 20 === 0) {
      // Report the problem locally without logging through ourselves (no loop).
      console.error(`[logger] Could not ship logs to Better Stack (${err.message}); keeping them in the local file.`);
    }
    if (isRetryable(err)) cloud.queue.unshift(...batch.slice(0, MAX_QUEUE - cloud.queue.length)); // Retry later.
  }
  if (cloud.queue.length > 0) scheduleFlush();
}

/** 403 (bad token) or 413 will never succeed on retry; network errors and 5xx might. */
function isRetryable(err) {
  return !/HTTP 4\d\d/.test(err.message);
}

function scheduleFlush() {
  if (cloud.queue.length >= BATCH_SIZE) {
    flushCloud();
  } else if (!cloud.timer) {
    cloud.timer = setTimeout(flushCloud, FLUSH_MS);
    cloud.timer.unref(); // Never keep the process alive just for logging.
  }
}

function shipToCloud(entry) {
  if (!CLOUD_ENABLED) return;
  if (cloud.queue.length >= MAX_QUEUE) cloud.queue.shift();
  cloud.queue.push({ dt: entry.timestamp, message: entry.event, ...entry });
  scheduleFlush();
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
const sinks = [];

const dropUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

function write(level, event, meta = {}) {
  const ctx = getContext();
  const entry = dropUndefined(redact({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: SERVICE,
    env: process.env.NODE_ENV || 'development',
    requestId: ctx.requestId,
    ip: ctx.ip,
    userId: ctx.userId,
    ...meta, // Explicit values from the caller win over the context ones.
  }));

  for (const sink of sinks) {
    try {
      sink(entry);
    } catch {
      // A failing sink must never break the request that logged.
    }
  }

  if (IS_TEST) return;

  const consoleFn = level === 'error' ? console.error : console.log;
  const { timestamp, level: _l, event: _e, service: _s, env: _env, ...rest } = entry;
  consoleFn(`[${timestamp}] [${level.toUpperCase()}] ${event}`, rest);

  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error('Failed to write to log file:', err.message);
  });

  shipToCloud(entry);
}

/** Sends anything still queued for Better Stack (called on shutdown). */
async function flush() {
  while (CLOUD_ENABLED && cloud.queue.length > 0 && cloud.failures === 0) await flushCloud();
}

module.exports = {
  info: (event, meta) => write('info', event, meta), // Lifecycle and request lines.
  warn: (event, meta) => write('warn', event, meta), // Client errors (4xx) and anything worth a look.
  error: (event, meta) => write('error', event, meta), // Server faults (5xx, crashes, DB down).
  security: (event, meta) => write('security', event, meta), // Authentication and access-control events.
  audit: (event, meta) => write('audit', event, meta), // Money and ownership trail: gigs, bookings, transactions.
  alert: (event, meta) => write('alert', event, meta), // Detected attack patterns - the events worth paging someone for.
  addSink: (fn) => sinks.push(fn),
  flush,
  maskEmail,
  redact,
  cloudEnabled: CLOUD_ENABLED,
};
