/**
 * Gig model - a service a freelancer advertises on the marketplace.
 */
const mongoose = require('mongoose');

const CATEGORIES = ['design', 'development', 'writing', 'marketing', 'video', 'music', 'business', 'other'];
const PRICE_MIN = 50; // ZAR
const PRICE_MAX = 100000; // ZAR - an upper bound stops absurd/abusive values reaching the income figures.

const gigSchema = new mongoose.Schema(
  {
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // "My gigs" and ownership checks query by this field.
    },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 100 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    category: { type: String, required: true, enum: CATEGORIES },
    price: { type: Number, required: true, min: PRICE_MIN, max: PRICE_MAX },
    deliveryDays: { type: Number, required: true, min: 1, max: 90 },
    isActive: { type: Boolean, default: true }, // Inactive gigs stay visible to their owner but cannot be browsed or booked.
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

gigSchema.index({ isActive: 1, createdAt: -1 }); // Supports the default "browse newest active gigs" query.

const Gig = mongoose.model('Gig', gigSchema);

module.exports = Gig;
module.exports.CATEGORIES = CATEGORIES;
module.exports.PRICE_MIN = PRICE_MIN;
module.exports.PRICE_MAX = PRICE_MAX;
