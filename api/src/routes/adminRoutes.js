const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, restrictTo('admin')); // Every route below is admin-only.

router.get('/users', adminController.listUsers);
router.get('/gigs', adminController.listAllGigs);
router.get('/stats', adminController.getStats);

module.exports = router; // Mounted at /api/admin.
