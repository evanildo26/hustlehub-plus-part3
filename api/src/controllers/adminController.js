/**
 * Admin-only endpoints (every route in adminRoutes.js is behind
 * restrictTo('admin')). Admins get platform oversight - user list and
 * headline stats - plus gig moderation via DELETE /api/gigs/:id. They
 * cannot create bookings, edit other users' gigs, or alter transactions.
 */
const User = require('../models/userModel');
const Gig = require('../models/gigModel');
const Booking = require('../models/bookingModel');
const Transaction = require('../models/transactionModel');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { getSecuritySummary } = require('../services/securityMonitor');

// GET /api/admin/users
async function listUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(500); // password is select:false, so never included.
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/gigs - every gig including inactive ones, for moderation
async function listAllGigs(req, res, next) {
  try {
    const gigs = await Gig.find().sort({ createdAt: -1 }).limit(500).populate('freelancer', 'name email');
    return res.status(200).json({ success: true, data: gigs });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/stats
async function getStats(req, res, next) {
  try {
    const [users, gigs, bookings, [money]] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Gig.countDocuments(),
      Booking.countDocuments(),
      Transaction.aggregate([
        { $group: { _id: null, volume: { $sum: '$amount' }, platformRevenue: { $sum: '$platformFee' } } },
      ]),
    ]);
    const byRole = Object.fromEntries(users.map((u) => [u._id, u.count]));
    const round = (n) => Math.round((n || 0) * 100) / 100;
    return res.status(200).json({
      success: true,
      data: {
        users: { client: byRole.client || 0, freelancer: byRole.freelancer || 0, admin: byRole.admin || 0 },
        gigs,
        bookings,
        transactionVolume: round(money && money.volume),
        platformRevenue: round(money && money.platformRevenue),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// POST /api/admin/users/:id/revoke-sessions - incident response: sign a
// user out everywhere (e.g. their password leaked or their account was
// misused). Every token issued before now stops working on the next request.
async function revokeSessions(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new AppError('User not found.', 404);
    logger.security('SESSIONS_REVOKED', { targetUserId: user.id, revokedBy: req.user.id });
    return res.status(200).json({ success: true, message: `All sessions for ${user.name} have been revoked.` });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/security-events?hours=24 - Security monitor data.
async function getSecurityEvents(req, res, next) {
  try {
    const hours = req.query.hours ? Number(req.query.hours) : 24;
    return res.status(200).json({ success: true, data: await getSecuritySummary({ hours }) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listUsers, listAllGigs, getStats, revokeSessions, getSecurityEvents };
