/**
 * Per-request context (request id, client IP, user) that follows a request
 * through every async call without being passed around by hand.
 *
 * Node's AsyncLocalStorage keeps a separate store per request, so when the
 * logger is called deep inside a controller or service it can still stamp
 * the entry with the id of the request that caused it. In a log platform
 * that makes it possible to filter on one request id and see the complete
 * story: HTTP line, security checks, audit events and any error.
 */
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

// An incoming X-Request-Id is only reused if it is short and plain (e.g. one
// set by a reverse proxy). Anything else is replaced, so a client can't
// inject newlines or huge values into the logs through this header.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Express middleware: assigns the request id, exposes it in a response header and opens the context. */
function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  req.id = requestId;
  res.set('X-Request-Id', requestId); // Lets a user quote the id in a support request so it can be traced in the logs.
  storage.run({ requestId, ip: req.ip }, next);
}

/** The current request's context, or an empty object outside a request (startup, scripts). */
function getContext() {
  return storage.getStore() || {};
}

/** Records the authenticated user on the current context (called by `protect` once the JWT is verified). */
function setUser(userId, role) {
  const store = storage.getStore();
  if (store) {
    store.userId = userId;
    store.role = role;
  }
}

module.exports = { requestContext, getContext, setUser };
