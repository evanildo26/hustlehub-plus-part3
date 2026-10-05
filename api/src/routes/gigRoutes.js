const express = require('express');
const gigController = require('../controllers/gigController');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');
const {
  createGigRules,
  updateGigRules,
  listGigsRules,
  idParamRule,
  allowOnlyFields,
  handleValidationErrors,
  GIG_FIELDS,
} = require('../middleware/validators');

const router = express.Router();

// Public: anyone can browse the marketplace (read-only, active gigs, no private freelancer data).
router.get('/', listGigsRules, handleValidationErrors, gigController.listGigs);

// Public: active gig count per category. Declared before '/:id' so "categories" isn't treated as an id.
router.get('/categories', gigController.listCategories);

// Freelancer: their own gigs, including inactive ones. Declared before '/:id' so "mine" isn't treated as an id.
router.get('/mine', protect, restrictTo('freelancer'), gigController.listMyGigs);

router.get('/:id', idParamRule, handleValidationErrors, optionalAuth, gigController.getGig);

router.post(
  '/',
  protect, // 1. Must be logged in (valid JWT).
  restrictTo('freelancer'), // 2. Must be a freelancer.
  allowOnlyFields(GIG_FIELDS), // 3. No unexpected fields (e.g. "freelancer").
  createGigRules, // 4. Validate + sanitise every field.
  handleValidationErrors,
  gigController.createGig // 5. Owner is set from the token inside the controller.
);

router.patch(
  '/:id',
  protect,
  restrictTo('freelancer'),
  idParamRule,
  allowOnlyFields(GIG_FIELDS),
  updateGigRules,
  handleValidationErrors,
  gigController.updateGig // Ownership is enforced inside the controller.
);

// Freelancers delete their own gigs; admins can delete any gig (moderation).
router.delete('/:id', protect, restrictTo('freelancer', 'admin'), idParamRule, handleValidationErrors, gigController.deleteGig);

module.exports = router; // Mounted at /api/gigs.
