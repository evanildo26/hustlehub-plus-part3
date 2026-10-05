/**
 * Booking controller.
 *
 * Who can see/do what:
 *   - client:     create bookings; view and cancel their OWN bookings
 *   - freelancer: view bookings made on THEIR gigs; complete or cancel them
 *   - admin:      view all bookings (read-only oversight)
 * Every query is scoped by the caller's id, so a user can never list or
 * open someone else's booking by guessing an id.
 */
const Booking = require('../models/bookingModel');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const bookingService = require('../services/bookingService');

/** The Mongo filter limiting results to bookings the caller is a party to. */
function scopeForUser(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'freelancer') return { freelancer: user.id };
  return { client: user.id };
}

/** Loads a booking the caller is a party to, or throws 404/403. */
async function findBookingForUser(req) {
  const booking = await Booking.findById(req.params.id)
    .populate('client', 'name')
    .populate('freelancer', 'name');
  if (!booking) throw new AppError('Booking not found.', 404);

  const isParty = booking.client.id === req.user.id || booking.freelancer.id === req.user.id;
  if (!isParty && req.user.role !== 'admin') {
    logger.security('OWNERSHIP_VIOLATION', { userId: req.user.id, resource: 'booking', resourceId: req.params.id });
    throw new AppError('You do not have access to this booking.', 403);
  }
  return booking;
}

// POST /api/bookings - client books a gig (simulated payment + transaction record)
async function createBooking(req, res, next) {
  try {
    const { booking, transaction } = await bookingService.createBooking({
      gigId: req.body.gigId,
      clientId: req.user.id,
      notes: req.body.notes,
    });
    return res.status(201).json({
      success: true,
      message: `Booking confirmed. Simulated payment ${booking.paymentReference} succeeded.`,
      data: { booking, transaction },
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/bookings - bookings the caller is a party to (all bookings for admin)
async function listBookings(req, res, next) {
  try {
    const bookings = await Booking.find(scopeForUser(req.user))
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('client', 'name')
      .populate('freelancer', 'name');
    return res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    return next(err);
  }
}

// GET /api/bookings/:id
async function getBooking(req, res, next) {
  try {
    const booking = await findBookingForUser(req);
    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/bookings/:id/complete - the booked freelancer only
async function completeBooking(req, res, next) {
  try {
    const booking = await findBookingForUser(req);
    if (booking.freelancer.id !== req.user.id) {
      throw new AppError('Only the freelancer for this booking can mark it as completed.', 403);
    }
    await bookingService.completeBooking(booking);
    return res.status(200).json({ success: true, message: 'Booking marked as completed.', data: booking });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/bookings/:id/cancel - the booking's client or freelancer
async function cancelBooking(req, res, next) {
  try {
    const booking = await findBookingForUser(req);
    const cancelledBy = booking.client.id === req.user.id ? 'client' : booking.freelancer.id === req.user.id ? 'freelancer' : null;
    if (!cancelledBy) throw new AppError('Only the client or freelancer on this booking can cancel it.', 403); // Admin is read-only.
    const { refund } = await bookingService.cancelBooking(booking, cancelledBy);
    return res.status(200).json({
      success: true,
      message: `Booking cancelled. Refund ${refund.reference} recorded.`,
      data: { booking, refund },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createBooking, listBookings, getBooking, completeBooking, cancelBooking, scopeForUser };
