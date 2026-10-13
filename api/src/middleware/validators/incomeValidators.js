/**
 * Validation rules for income / tax endpoints.
 */
const { query } = require('express-validator');
const { AGE_GROUPS } = require('../../services/taxService');

// Age group changes the SARS rebate (65+ and 75+ get extra rebates). Optional; defaults to under65.
const taxEstimateRules = [
  query('ageGroup')
    .optional()
    .isString()
    .bail()
    .isIn(AGE_GROUPS)
    .withMessage(`ageGroup must be one of: ${AGE_GROUPS.join(', ')}`),
];

module.exports = { taxEstimateRules };
