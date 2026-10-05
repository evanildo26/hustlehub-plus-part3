const express = require('express');
const transactionController = require('../controllers/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/transactions - read-only, scoped to the caller (all records for admin).
router.get('/transactions', protect, transactionController.listTransactions);

// GET /api/income/summary - a freelancer's own income totals and monthly breakdown.
router.get('/income/summary', protect, restrictTo('freelancer'), transactionController.getIncomeSummary);

module.exports = router; // Mounted at /api.
