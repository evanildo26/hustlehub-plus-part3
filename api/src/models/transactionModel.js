/**
 * Transaction model - the financial record produced by a booking.
 *
 * Every booking creates a `payment` transaction (payments are simulated, as
 * the brief allows). Cancelling a booking creates a matching `refund`
 * transaction with negative amounts rather than editing or deleting the
 * original - financial records are append-only, so the history can always
 * be audited and income totals are simply the sum of a freelancer's rows.
 */
const mongoose = require('mongoose');

const TRANSACTION_TYPES = ['payment', 'refund'];
const PLATFORM_FEE_RATE = 0.1; // HustleHub+ keeps 10% of each booking; the freelancer earns the remaining 90%.

const transactionSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gigTitle: { type: String, required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true }, // Gross amount paid by the client (negative for refunds).
    platformFee: { type: Number, required: true }, // Platform's share (negative for refunds).
    freelancerEarnings: { type: Number, required: true }, // amount - platformFee: the freelancer's income.
    currency: { type: String, default: 'ZAR' },
    status: { type: String, enum: ['succeeded'], default: 'succeeded' }, // Simulated gateway always succeeds.
    reference: { type: String, required: true, unique: true }, // Human-readable, unique reference e.g. TXN-....
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

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
module.exports.PLATFORM_FEE_RATE = PLATFORM_FEE_RATE;
