/**
 * Validation + sanitisation rules for gig endpoints.
 *
 * Free-text fields go through sanitizeText (strips HTML tags, angle brackets
 * and control characters) BEFORE their length is checked, so a payload like
 * "<script>alert(1)</script>" can't be stored - and can't sneak past the
 * minimum length using markup that gets stripped later.
 */
const { body, query } = require('express-validator');
const { CATEGORIES, PRICE_MIN, PRICE_MAX } = require('../../models/gigModel');
const { sanitizeText } = require('../../utils/sanitize');

const GIG_FIELDS = ['title', 'description', 'category', 'price', 'deliveryDays', 'isActive']; // Everything a freelancer may set.

/**
 * "1500", "1500.5" and "1500.50" pass; "1e3", "1500.505", "12." and " 12" fail.
 * Two simple checks instead of one regex with nested quantifiers - static
 * analysis (security/detect-unsafe-regex) flags those as a ReDoS risk.
 */
function isMoneyAmount(value) {
  const parts = String(value).split('.');
  if (parts.length > 2) return false;
  const [whole, decimals] = parts;
  const wholeOk = /^\d{1,6}$/.test(whole);
  const decimalsOk = decimals === undefined || /^\d{1,2}$/.test(decimals);
  return wholeOk && decimalsOk;
}

/** Builds the rule set; `optional` = true for PATCH (partial updates). */
function gigRules({ optional }) {
  const field = (name) => (optional ? body(name).optional() : body(name).exists().withMessage(`${name} is required`).bail());

  return [
    field('title')
      .isString()
      .withMessage('Title must be text')
      .bail()
      .customSanitizer((v) => sanitizeText(v))
      .isLength({ min: 5, max: 100 })
      .withMessage('Title must be between 5 and 100 characters (HTML is removed)'),

    field('description')
      .isString()
      .withMessage('Description must be text')
      .bail()
      .customSanitizer((v) => sanitizeText(v, { multiline: true }))
      .isLength({ min: 20, max: 2000 })
      .withMessage('Description must be between 20 and 2000 characters (HTML is removed)'),

    field('category')
      .isString()
      .withMessage('Category must be text')
      .bail()
      .trim()
      .toLowerCase()
      .isIn(CATEGORIES)
      .withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),

    field('price')
      .isFloat({ min: PRICE_MIN, max: PRICE_MAX })
      .withMessage(`Price must be a number between ${PRICE_MIN} and ${PRICE_MAX}`)
      .bail()
      .custom(isMoneyAmount) // Money: at most two decimal places, no exponent notation.
      .withMessage('Price may have at most two decimal places')
      .toFloat(),

    field('deliveryDays')
      .isInt({ min: 1, max: 90 })
      .withMessage('Delivery time must be a whole number of days between 1 and 90')
      .toInt(),

    body('isActive').optional().isBoolean({ strict: true }).withMessage('isActive must be true or false').toBoolean(),
  ];
}

const createGigRules = gigRules({ optional: false });
const updateGigRules = [
  ...gigRules({ optional: true }),
  body().custom((value) => Boolean(value) && Object.keys(value).some((key) => GIG_FIELDS.includes(key))).withMessage('Provide at least one field to update'),
];

/** Query-string rules for browsing: everything is optional and bounded. */
const listGigsRules = [
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be text')
    .bail()
    .customSanitizer((v) => sanitizeText(v))
    .isLength({ max: 50 })
    .withMessage('Search must be 50 characters or fewer'),
  query('category').optional().isString().bail().trim().toLowerCase().isIn(CATEGORIES).withMessage('Unknown category'),
  query('minPrice').optional().isFloat({ min: 0, max: PRICE_MAX }).withMessage('minPrice must be a positive number').toFloat(),
  query('maxPrice').optional().isFloat({ min: 0, max: PRICE_MAX }).withMessage('maxPrice must be a positive number').toFloat(),
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('page must be a positive whole number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').toInt(),
];

module.exports = { GIG_FIELDS, createGigRules, updateGigRules, listGigsRules };
