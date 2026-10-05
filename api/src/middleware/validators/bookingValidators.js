/**
 * Validation + sanitisation rules for booking endpoints.
 *
 * Note what is NOT accepted: the price/amount. The amount charged is always
 * read from the gig in the database, so a client can't tamper with what
 * they pay by editing the request.
 */
const { body } = require('express-validator');
const { sanitizeText } = require('../../utils/sanitize');

const BOOKING_FIELDS = ['gigId', 'notes'];

const createBookingRules = [
  body('gigId').exists().withMessage('gigId is required').bail().isMongoId().withMessage('gigId must be a valid id'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be text')
    .bail()
    .customSanitizer((v) => sanitizeText(v, { multiline: true }))
    .isLength({ max: 500 })
    .withMessage('Notes must be 500 characters or fewer'),
];

module.exports = { BOOKING_FIELDS, createBookingRules };
