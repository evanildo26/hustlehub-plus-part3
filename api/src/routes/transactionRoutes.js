const express = require('express');
const transactionController = require('../controllers/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { taxEstimateRules, handleValidationErrors } = require('../middleware/validators');

const router = express.Router();

// GET /api/transactions - read-only, scoped to the caller (all records for admin).
router.get('/transactions', protect, transactionController.listTransactions);

// GET /api/income/summary - a freelancer's own income totals and monthly breakdown.
router.get('/income/summary', protect, restrictTo('freelancer'), transactionController.getIncomeSummary);

// GET /api/income/tax-estimate - estimated SARS income tax on the freelancer's own earnings this tax year.
router.get(
  '/income/tax-estimate',
  protect,
  restrictTo('freelancer'),
  taxEstimateRules,
  handleValidationErrors,
  transactionController.getTaxEstimate
);

module.exports = router; // Mounted at /api.
