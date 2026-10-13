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
 * It also removes `__proto__`, `constructor` and `prototype` keys
 * (added in Part 3 after static analysis flagged object-injection sinks).
 * JSON.parse keeps "__proto__" as an ordinary key; if such an object is
 * later merged or copied key-by-key, it can modify Object.prototype for the
 * whole process (prototype pollution).
 *
 * (The popular express-mongo-sanitize package does the same job; this small
 * in-house version avoids an extra dependency and adds the logging.)
 */
const logger = require('../utils/logger');

const MAX_DEPTH = 10; // Deeply nested payloads are truncated rather than recursed into forever.
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isOperatorKey = (key) => key.startsWith('$') || key.includes('.');

/** Recursively deletes dangerous keys. Returns the list of keys removed. */
function stripOperators(target, removed = [], depth = 0) {
  if (!target || typeof target !== 'object' || depth > MAX_DEPTH) return removed;

  // Walks the object's OWN entries and deletes the unsafe keys in place.
  for (const [key, value] of Object.entries(target)) {
    if (isOperatorKey(key) || PROTOTYPE_KEYS.has(key)) {
      removed.push(key);
      Reflect.deleteProperty(target, key);
    } else {
      stripOperators(value, removed, depth + 1);
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
    const pollution = removed.some((k) => PROTOTYPE_KEYS.has(k));
    logger.security(pollution ? 'PROTOTYPE_POLLUTION_ATTEMPT' : 'NOSQL_INJECTION_ATTEMPT', {
      method: req.method,
      path: req.originalUrl.split('?')[0], // Path only - the query string is the attacker-controlled part.
      removedKeys: removed.slice(0, 10),
    });
  }
  next();
}

module.exports = { sanitizeRequest, stripOperators };
