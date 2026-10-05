/**
 * Validation helpers shared by every resource's rules.
 */
const { param, validationResult } = require('express-validator');
const AppError = require('../../utils/AppError');

/**
 * Collects express-validator results and, if any rule failed, turns them
 * into a single controlled 400 response instead of letting the request
 * continue into the controller. Field names + messages are safe to expose
 * (they describe the client's own input); nothing about the server is
 * revealed.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req); // Gather the results of every validation rule that ran on this request.
  if (!errors.isEmpty()) {
    // At least one rule failed. Only the first message per field is returned, to keep responses readable.
    const seen = new Set();
    const details = errors
      .array()
      .filter((e) => (seen.has(e.path) ? false : seen.add(e.path)))
      .map((e) => ({ field: e.path, message: e.msg }));
    const error = new AppError('Validation failed', 400); // 400 Bad Request - the client sent invalid data.
    error.details = details; // Attach the field-level messages so errorHandler.js can include them in the response.
    return next(error); // Hand off to the central error handler instead of continuing to the controller.
  }
  return next(); // No errors - proceed to the next middleware/controller in the chain.
}

/**
 * Mass-assignment protection: rejects a request body containing any field
 * that isn't on the allow-list. Without this, a client could try sending
 * e.g. `"freelancer": "<someone else's id>"` when editing a gig, or
 * `"amount": 1` when booking, hoping the server copies it into the record.
 */
function allowOnlyFields(allowed) {
  return (req, res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unexpected.length > 0) {
      const error = new AppError('Validation failed', 400);
      error.details = unexpected.map((field) => ({ field, message: 'This field is not allowed' }));
      return next(error);
    }
    return next();
  };
}

/** Route-parameter rule: `:id` must be a well-formed MongoDB ObjectId. */
const idParamRule = [param('id').isMongoId().withMessage('Invalid id')];

module.exports = { handleValidationErrors, allowOnlyFields, idParamRule };
