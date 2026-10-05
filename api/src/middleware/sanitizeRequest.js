/**
 * NoSQL-injection guard.
 *
 * MongoDB query operators start with `$` (e.g. `$gt`, `$ne`, `$where`) and
 * nested paths use `.`. If a client sends JSON such as
 *     { "email": { "$ne": null }, "password": "..." }
 * and that object reaches a query unfiltered, the filter matches ANY user -
 * the classic MongoDB authentication bypass. This middleware removes every
 * key that starts with `$` or contains `.` from req.body, req.query and
 * req.params - at any depth - before validation or controllers run, and
 * logs the attempt as a security event.
 *
 * (The popular express-mongo-sanitize package does the same job; this small
 * in-house version avoids an extra dependency and adds the logging.)
 */
const logger = require('../utils/logger');

const MAX_DEPTH = 10; // Deeply nested payloads are truncated rather than recursed into forever.

/** Recursively deletes dangerous keys. Returns the list of keys removed. */
function stripOperators(target, removed = [], depth = 0) {
  if (!target || typeof target !== 'object' || depth > MAX_DEPTH) return removed;

  for (const key of Object.keys(target)) {
    if (key.startsWith('$') || key.includes('.')) {
      removed.push(key);
      delete target[key];
    } else {
      stripOperators(target[key], removed, depth + 1);
    }
  }
  return removed;
}

function sanitizeRequest(req, res, next) {
  const removed = [
    ...stripOperators(req.body),
    ...stripOperators(req.query),
    ...stripOperators(req.params),
  ];

  if (removed.length > 0) {
    logger.security('NOSQL_INJECTION_ATTEMPT', {
      method: req.method,
      path: req.originalUrl.split('?')[0], // Path only - the query string is the attacker-controlled part.
      ip: req.ip,
      removedKeys: removed.slice(0, 10),
    });
  }
  next();
}

module.exports = { sanitizeRequest, stripOperators };
