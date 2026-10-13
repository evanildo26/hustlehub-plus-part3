const express = require('express'); // Web framework - used here just for its Router.
const authController = require('../controllers/authController'); // Business logic for register/login.
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter'); // Caps auth attempts per IP per window.
const { protect } = require('../middleware/authMiddleware'); // JWT check - logout needs to know which token to revoke.
const {
  registerValidationRules, // Field-level validation rules specific to registration.
  loginValidationRules, // Field-level validation rules specific to login.
  handleValidationErrors, // Shared middleware that turns validation failures into a 400 response.
  allowOnlyFields, // Rejects unexpected body fields (mass-assignment protection).
  REGISTER_FIELDS,
  LOGIN_FIELDS,
} = require('../middleware/validators');

const router = express.Router(); // A mini, mountable Express app - just for auth-related endpoints.

// POST /api/auth/register
router.post(
  '/register',
  registerLimiter, // 1. Reject if this IP has created too many accounts recently.
  allowOnlyFields(REGISTER_FIELDS), // 2. Reject unknown fields such as "isAdmin": true.
  registerValidationRules, // 3. Run every validation rule against req.body.
  handleValidationErrors, // 4. If any rule failed, stop here with a 400; otherwise continue.
  authController.register // 5. All checks passed - run the actual registration logic.
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter, // Failed-attempt limiting - the classic brute-force target.
  allowOnlyFields(LOGIN_FIELDS),
  loginValidationRules, // Basic presence/format checks (not the full password policy - see authValidators.js).
  handleValidationErrors,
  authController.login
);

// POST /api/auth/logout - revokes the token used to call it.
router.post('/logout', protect, authController.logout);

module.exports = router; // Mounted at /api/auth in src/app.js, so these become /api/auth/register and /api/auth/login.
