/**
 * Centralised, secure error handling.
 *
 * Two middlewares:
 *  - notFound: turns any unmatched route into a controlled 404 AppError
 *    instead of Express's default HTML error page.
 *  - errorHandler: the single place responses for ALL errors are built.
 *    Operational errors (AppError - things we expected, like bad input or
 *    a duplicate email) return their own safe message. Anything else
 *    (a programming bug, an unexpected exception) is logged in full detail
 *    server-side but the client only ever receives a generic message.
 *    Stack traces, file paths, and internal configuration are never sent
 *    in a response, in any environment - that is a hard requirement of
 *    this POE, not just a "production only" precaution.
 */
const logger = require('../utils/logger'); // Structured logger for recording every error server-side.
const AppError = require('../utils/AppError'); // Operational-error class - used to build the 404 error below.

function notFound(req, res, next) {
  // Registered after all real routes in app.js - only runs if nothing else matched the request.
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404)); // Hand a controlled 404 error to errorHandler below.
}

/**
 * Translates well-known library errors into safe operational AppErrors, so
 * the client gets a useful 4xx instead of a generic 500 - without ever
 * seeing the raw library message (which can contain schema/field internals).
 */
function normaliseKnownErrors(err) {
  if (err.type === 'entity.parse.failed') return new AppError('Request body must be valid JSON.', 400); // body-parser: malformed JSON.
  if (err.type === 'entity.too.large') return new AppError('Request body is too large.', 413); // body-parser: over the 10kb limit.
  if (err.name === 'CastError') return new AppError('Invalid identifier or value supplied.', 400); // Mongoose: e.g. a malformed ObjectId.
  if (err.name === 'ValidationError') return new AppError('Submitted data failed validation.', 400); // Mongoose schema validation.
  if (err.code === 11000) return new AppError('A record with these details already exists.', 409); // MongoDB duplicate key.
  return err;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(rawErr, req, res, next) {
  // Express recognises this as an ERROR-HANDLING middleware specifically because it takes 4 arguments (err first).
  const err = normaliseKnownErrors(rawErr);
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  // Use the error's own status code if it set one validly (AppError does); otherwise default to 500 Internal Server Error.
  const isOperational = err.isOperational === true; // True only for errors we deliberately threw as AppError.

  // Full detail (message + stack) is always logged server-side for
  // debugging/auditing, never discarded.
  const logFn = statusCode >= 500 ? logger.error : logger.warn; // 4xx = client mistakes (warn); 5xx = our bugs (error).
  logFn('REQUEST_ERROR', {
    method: req.method, // e.g. 'POST'.
    path: req.originalUrl, // The URL that was requested.
    statusCode, // The status code being returned.
    userId: req.user && req.user.id, // Who made the request, if authenticated.
    message: rawErr.message, // The original error's message (safe or not - this log is server-side only).
    stack: statusCode >= 500 ? rawErr.stack : undefined, // Full stack trace for real failures - NEVER sent in the HTTP response.
  });

  const responseBody = {
    success: false, // Consistent response shape - every error response has success: false.
    message: isOperational ? err.message : 'Something went wrong. Please try again later.',
    // Operational errors show their real (safe) message; anything unexpected shows a generic message only.
  };

  // Field-level validation feedback is safe to return - it only describes
  // the client's own input, never server internals.
  if (Array.isArray(err.details) && err.details.length > 0) {
    responseBody.errors = err.details; // Attach the per-field validation messages set by validators.js, if present.
  }

  res.status(statusCode).json(responseBody); // Send the final, safe JSON response with the correct HTTP status code.
}

module.exports = { notFound, errorHandler }; // Both are registered, in this order, as the last two app.use() calls in app.js.
