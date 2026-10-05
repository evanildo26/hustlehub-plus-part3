const express = require('express');
const bookingController = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { bookingLimiter } = require('../middleware/rateLimiter');
const {
  createBookingRules,
  idParamRule,
  allowOnlyFields,
  handleValidationErrors,
  BOOKING_FIELDS,
} = require('../middleware/validators');

const router = express.Router();

router.use(protect); // Every booking route requires a valid JWT.

router.post(
  '/',
  restrictTo('client'), // Only clients book gigs.
  bookingLimiter, // Per-user booking rate limit (runs after protect so it can key on the user id).
  allowOnlyFields(BOOKING_FIELDS), // Rejects e.g. a client-supplied "amount".
  createBookingRules,
  handleValidationErrors,
  bookingController.createBooking
);

router.get('/', bookingController.listBookings); // Results are scoped to the caller inside the controller.
router.get('/:id', idParamRule, handleValidationErrors, bookingController.getBooking);
router.patch('/:id/complete', restrictTo('freelancer'), idParamRule, handleValidationErrors, bookingController.completeBooking);
router.patch('/:id/cancel', restrictTo('client', 'freelancer'), idParamRule, handleValidationErrors, bookingController.cancelBooking);

module.exports = router; // Mounted at /api/bookings.
