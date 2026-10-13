const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { query } = require('express-validator');
const { idParamRule, handleValidationErrors } = require('../middleware/validators');

const router = express.Router();

router.use(protect, restrictTo('admin')); // Every route below is admin-only.

router.get('/users', adminController.listUsers);
router.get('/gigs', adminController.listAllGigs);
router.get('/stats', adminController.getStats);
router.post('/users/:id/revoke-sessions', idParamRule, handleValidationErrors, adminController.revokeSessions);
router.get(
  '/security-events',
  query('hours').optional().isInt({ min: 1, max: 720 }).withMessage('hours must be a whole number from 1 to 720'),
  handleValidationErrors,
  adminController.getSecurityEvents
);

module.exports = router; // Mounted at /api/admin.
