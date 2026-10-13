/**
 * Transaction controller - read-only access to financial records.
 *
 * There are deliberately NO create/update/delete endpoints: transactions are
 * only ever written by bookingService as a side effect of booking or
 * cancelling. A client can't fabricate a payment, and nobody (not even an
 * admin) can rewrite financial history through the API.
 */
const mongoose = require('mongoose');
const Transaction = require('../models/transactionModel');
const Booking = require('../models/bookingModel');
const { buildTaxEstimate, taxYearFor } = require('../services/taxService');

/** Same scoping rule as bookings: you only see records you are a party to. */
function scopeForUser(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'freelancer') return { freelancer: user.id };
  return { client: user.id };
}

// GET /api/transactions
async function listTransactions(req, res, next) {
  try {
    const transactions = await Transaction.find(scopeForUser(req.user))
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('client', 'name')
      .populate('freelancer', 'name');
    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    return next(err);
  }
}

// GET /api/income/summary - freelancer only (route is restricted to the freelancer role)
async function getIncomeSummary(req, res, next) {
  try {
    const freelancerId = new mongoose.Types.ObjectId(req.user.id); // Aggregation pipelines don't auto-cast ids like find() does.

    const [totalsRow] = await Transaction.aggregate([
      { $match: { freelancer: freelancerId } },
      {
        $group: {
          _id: null,
          grossIncome: { $sum: '$amount' }, // Refund rows are negative, so this is already net of refunds.
          platformFees: { $sum: '$platformFee' },
          netIncome: { $sum: '$freelancerEarnings' },
          payments: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, 1, 0] } },
          refunds: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, 1, 0] } },
        },
      },
    ]);

    const monthly = await Transaction.aggregate([
      { $match: { freelancer: freelancerId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, // e.g. "2026-10"
          grossIncome: { $sum: '$amount' },
          netIncome: { $sum: '$freelancerEarnings' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', grossIncome: 1, netIncome: 1, transactions: 1 } },
    ]);

    const byGig = await Transaction.aggregate([
      { $match: { freelancer: freelancerId } },
      { $group: { _id: '$gig', gigTitle: { $last: '$gigTitle' }, netIncome: { $sum: '$freelancerEarnings' } } },
      { $sort: { netIncome: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, gigId: '$_id', gigTitle: 1, netIncome: 1 } },
    ]);

    const bookingCounts = await Booking.aggregate([
      { $match: { freelancer: freelancerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const statusCount = (s) => (bookingCounts.find((b) => b._id === s) || { count: 0 }).count;

    return res.status(200).json({
      success: true,
      data: {
        currency: 'ZAR',
        grossIncome: round(totalsRow && totalsRow.grossIncome),
        platformFees: round(totalsRow && totalsRow.platformFees),
        netIncome: round(totalsRow && totalsRow.netIncome),
        payments: (totalsRow && totalsRow.payments) || 0,
        refunds: (totalsRow && totalsRow.refunds) || 0,
        bookings: {
          confirmed: statusCount('confirmed'),
          completed: statusCount('completed'),
          cancelled: statusCount('cancelled'),
        },
        monthly: monthly.map((m) => ({ ...m, grossIncome: round(m.grossIncome), netIncome: round(m.netIncome) })),
        topGigs: byGig.map((g) => ({ ...g, netIncome: round(g.netIncome) })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/income/tax-estimate?ageGroup= - freelancer only. Logic lives in services/taxService.js.
async function getTaxEstimate(req, res, next) {
  try {
    const now = new Date();
    const taxYear = taxYearFor(now);

    // Net earnings per calendar month inside the current SA tax year (1 March - end of February).
    const monthlyNet = await Transaction.aggregate([
      {
        $match: {
          freelancer: new mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: taxYear.start, $lt: taxYear.end },
        },
      },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, netIncome: { $sum: '$freelancerEarnings' } } },
      { $project: { _id: 0, month: '$_id', netIncome: 1 } },
    ]);

    const estimate = buildTaxEstimate({ monthlyNet, now, ageGroup: req.query.ageGroup || 'under65' });
    return res.status(200).json({ success: true, data: estimate });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listTransactions, getIncomeSummary, getTaxEstimate };
