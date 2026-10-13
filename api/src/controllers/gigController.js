/**
 * Gig controller: browse (public), and create/update/delete (freelancer,
 * own gigs only).
 *
 * RBAC is two layers deep:
 *   1. Role  - `restrictTo('freelancer')` on the route decides WHO may
 *              create/edit gigs at all.
 *   2. Owner - this controller checks that the gig being edited/deleted
 *              actually belongs to the caller. Without this second check,
 *              any freelancer could edit any other freelancer's gig just by
 *              changing the id in the URL (an IDOR - Insecure Direct Object
 *              Reference - one of the OWASP Top 10 access-control flaws).
 */
const Gig = require('../models/gigModel');
const Booking = require('../models/bookingModel');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/sanitize');
const { GIG_FIELDS } = require('../middleware/validators');

const PUBLIC_FREELANCER_FIELDS = 'name'; // Browsers see a freelancer's name only - never their email or other details.

/** Copies only allow-listed fields from the validated body (mass-assignment protection, layer 2). */
function pickGigFields(source) {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => GIG_FIELDS.includes(key) && value !== undefined));
}

/** Loads a gig and enforces ownership. Admins may pass `allowAdmin` for moderation actions. */
async function findOwnedGig(req, { allowAdmin = false } = {}) {
  const gig = await Gig.findById(req.params.id);
  if (!gig) throw new AppError('Gig not found.', 404);

  const isOwner = gig.freelancer.toString() === req.user.id;
  const isAdminOverride = allowAdmin && req.user.role === 'admin';
  if (!isOwner && !isAdminOverride) {
    logger.security('OWNERSHIP_VIOLATION', {
      userId: req.user.id,
      resource: 'gig',
      resourceId: req.params.id,
      method: req.method,
    });
    throw new AppError('You can only manage your own gigs.', 403);
  }
  return gig;
}

// GET /api/gigs - public marketplace browse (active gigs only)
async function listGigs(req, res, next) {
  try {
    const { search, category, minPrice, maxPrice } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;

    // Built from validated, typed values only - never from raw req.query objects. $eq and Number()
    // also guarantee each value is used literally, never as a query operator (CodeQL js/sql-injection).
    const filter = { isActive: true };
    if (category) filter.category = { $eq: String(category) };
    if (search) {
      // Reviewed static-analysis finding (security/detect-non-literal-regexp): the
      // input is escaped so every character matches literally, and the validator
      // caps it at 50 characters, so it can't form a slow (ReDoS) pattern.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const pattern = new RegExp(escapeRegex(search), 'i'); // Literal, case-insensitive match - see escapeRegex.
      filter.$or = [{ title: pattern }, { description: pattern }];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    const [gigs, total] = await Promise.all([
      Gig.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('freelancer', PUBLIC_FREELANCER_FIELDS),
      Gig.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: gigs,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/gigs/categories - public count of active gigs per category (for the marketplace filters)
async function listCategories(req, res, next) {
  try {
    const counts = await Gig.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const byCategory = new Map(counts.map((c) => [c._id, c.count]));
    const data = Gig.CATEGORIES.map((category) => ({ category, count: byCategory.get(category) || 0 }));
    return res.status(200).json({ success: true, data, total: data.reduce((sum, c) => sum + c.count, 0) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/gigs/mine - the calling freelancer's own gigs, including inactive ones
async function listMyGigs(req, res, next) {
  try {
    const gigs = await Gig.find({ freelancer: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: gigs });
  } catch (err) {
    return next(err);
  }
}

// GET /api/gigs/:id - public detail view (inactive gigs visible to their owner only)
async function getGig(req, res, next) {
  try {
    const gig = await Gig.findById(req.params.id).populate('freelancer', PUBLIC_FREELANCER_FIELDS);
    const isOwner = gig && req.user && gig.freelancer && gig.freelancer.id === req.user.id;
    if (!gig || (!gig.isActive && !isOwner)) {
      throw new AppError('Gig not found.', 404); // Inactive gigs are hidden as if they didn't exist.
    }
    return res.status(200).json({ success: true, data: gig });
  } catch (err) {
    return next(err);
  }
}

// POST /api/gigs - freelancer creates a gig (owner is ALWAYS the caller)
async function createGig(req, res, next) {
  try {
    const gig = await Gig.create({
      ...pickGigFields(req.body),
      freelancer: req.user.id, // Taken from the verified token - never from the request body.
    });
    logger.audit('GIG_CREATED', { gigId: gig.id, freelancerId: req.user.id, price: gig.price });
    return res.status(201).json({ success: true, message: 'Gig created successfully.', data: gig });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/gigs/:id - owner updates their gig
async function updateGig(req, res, next) {
  try {
    const gig = await findOwnedGig(req);
    const updates = pickGigFields(req.body);
    gig.set(updates);
    await gig.save(); // save() re-runs the schema validators on the changed fields.
    logger.audit('GIG_UPDATED', { gigId: gig.id, freelancerId: req.user.id, fields: Object.keys(updates) });
    return res.status(200).json({ success: true, message: 'Gig updated successfully.', data: gig });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/gigs/:id - owner deletes their gig; admins may remove any gig (moderation)
async function deleteGig(req, res, next) {
  try {
    const gig = await findOwnedGig(req, { allowAdmin: true });

    const openBookings = await Booking.countDocuments({ gig: gig._id, status: 'confirmed' });
    if (openBookings > 0) {
      // Deleting a gig a client has already paid for would strand their booking.
      throw new AppError(
        'This gig has confirmed bookings. Complete or cancel them first, or deactivate the gig instead.',
        409
      );
    }

    await gig.deleteOne();
    logger.audit('GIG_DELETED', { gigId: gig.id, deletedBy: req.user.id, role: req.user.role });
    return res.status(200).json({ success: true, message: 'Gig deleted successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listGigs, listCategories, listMyGigs, getGig, createGig, updateGig, deleteGig };
