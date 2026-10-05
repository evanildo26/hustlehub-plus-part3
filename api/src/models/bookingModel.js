/**
 * Booking model - a client booking a freelancer's gig.
 *
 * The gig title and price are copied ("snapshotted") onto the booking at
 * the moment it is made. If the freelancer later edits or deletes the gig,
 * the booking - and the money trail attached to it - still reflects what
 * the client actually agreed to pay.
 */
const mongoose = require('mongoose');

const BOOKING_STATUSES = ['confirmed', 'completed', 'cancelled'];

const bookingSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gigTitle: { type: String, required: true }, // Snapshot at booking time.
    amount: { type: Number, required: true, min: 0 }, // Snapshot of the gig price at booking time (ZAR).
    notes: { type: String, trim: true, maxlength: 500, default: '' }, // Optional brief from the client.
    status: { type: String, enum: BOOKING_STATUSES, default: 'confirmed' },
    paymentReference: { type: String, required: true }, // Simulated payment confirmation reference.
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['client', 'freelancer'] },
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

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
