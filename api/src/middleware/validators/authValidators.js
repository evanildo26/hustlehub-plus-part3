/**
 * Server-side input validation using express-validator.
 *
 * Frontend validation (client/src/utils/validation.js) is a UX nicety - it can always be
 * bypassed by calling the API directly (curl, Postman, a modified client),
 * so every field is re-validated here regardless of what the client sent.
 * Anything that fails validation is rejected before it reaches a
 * controller or touches the data store.
 */
const { body } = require('express-validator'); // `body` declares validation rules per field.
const { handleValidationErrors } = require('./common'); // Shared middleware that turns validation failures into a 400 response.

const ALLOWED_SELF_REGISTER_ROLES = ['client', 'freelancer']; // The only roles a user is allowed to pick for themselves at signup.
// 'admin' is intentionally excluded - administrators are provisioned
// out-of-band, never through the public registration endpoint. Allowing
// self-service admin signup would be a privilege-escalation vulnerability.

const registerValidationRules = [
  // An array of express-validator chains - Express runs each one against the incoming request in order.
  body('name')
    .isString() // Reject arrays/objects outright (e.g. {"$ne": null}) before any coercion happens.
    .withMessage('Name must be text')
    .bail() // Stop running further rules on this field once it has failed.
    .trim() // Remove leading/trailing whitespace before validating/using the value.
    .notEmpty() // Reject if the field is missing or empty after trimming.
    .withMessage('Name is required') // Message returned to the client if the above check fails.
    .isLength({ min: 2, max: 100 }) // Enforce a sane length range.
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/) // Only letters, spaces, hyphens, apostrophes - blocks digits/symbols/script tags in the name.
    .withMessage('Name may only contain letters, spaces, hyphens and apostrophes'),

  body('email')
    .isString() // Reject arrays/objects outright (e.g. {"$ne": null}) before any coercion happens.
    .withMessage('Email must be text')
    .bail() // Stop running further rules on this field once it has failed.
    .trim() // Strip surrounding whitespace.
    .notEmpty() // Must be present.
    .withMessage('Email is required')
    .isEmail() // Must be a syntactically valid email address.
    .withMessage('A valid email address is required')
    .normalizeEmail(), // Normalises formatting (e.g. lower-cases the domain) so the same address always matches consistently.

  body('password')
    .isString()
    .withMessage('Password must be text')
    .bail()
    .notEmpty() // Must be present - not trimmed, since leading/trailing spaces could be an intentional part of a password.
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 }) // Minimum length resists brute-force/guessing; max length avoids abuse via huge inputs.
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/) // Require at least one lowercase letter.
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/) // Require at least one uppercase letter.
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/) // Require at least one digit.
    .withMessage('Password must contain at least one number')
    .matches(/[^a-zA-Z0-9]/) // Require at least one character that isn't a letter or digit (a symbol).
    .withMessage('Password must contain at least one special character'),

  body('role')
    .optional() // Not required - authController defaults to 'client' if omitted.
    .isString()
    .withMessage('Role must be text')
    .bail()
    .trim()
    .toLowerCase() // Normalise case before checking against the allow-list.
    .isIn(ALLOWED_SELF_REGISTER_ROLES) // Reject anything other than 'client' or 'freelancer' - this is what blocks self-assigned 'admin'.
    .withMessage(`Role must be one of: ${ALLOWED_SELF_REGISTER_ROLES.join(', ')}`),
];

const loginValidationRules = [
  body('email')
    .isString() // Reject arrays/objects outright (e.g. {"$ne": null}) before any coercion happens.
    .withMessage('Email must be text')
    .bail() // Stop running further rules on this field once it has failed.
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),

  body('password').isString().withMessage('Password must be text').bail().notEmpty().withMessage('Password is required'),
  // Note: login intentionally does NOT re-check the password policy (length/complexity) - a user's existing
  // password should always be accepted for login even if password rules change later; only its correctness matters here.
];

const REGISTER_FIELDS = ['name', 'email', 'password', 'role']; // Anything else in the body is rejected (see allowOnlyFields).
const LOGIN_FIELDS = ['email', 'password'];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
  REGISTER_FIELDS,
  LOGIN_FIELDS,
};
