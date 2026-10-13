/**
 * Server-side input validation (express-validator), grouped per resource.
 * Importing '../middleware/validators' gives access to every rule set.
 */
module.exports = {
  ...require('./common'),
  ...require('./authValidators'),
  ...require('./gigValidators'),
  ...require('./bookingValidators'),
  ...require('./incomeValidators'),
};
