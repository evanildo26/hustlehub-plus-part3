/**
 * Booking + transaction business logic.
 *
 * Kept out of the controller because "create a booking" is really several
 * steps that must stay consistent: check the gig is bookable, simulate the
 * payment, create the booking, and record the transaction. Putting it in a
 * service keeps the controller thin and makes the money logic testable on
 * its own.
 */
const crypto = require('crypto'); // Cryptographically secure random values for payment/transaction references.
const Gig = require('../models/gigModel');
const Booking = require('../models/bookingModel');
const Transaction = require('../models/transactionModel');
const { PLATFORM_FEE_RATE } = require('../models/transactionModel');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/** Rounds to cents so floating-point noise (e.g. 0.1 + 0.2) never reaches stored money values. */
const toCents = (n) => Math.round(n * 100) / 100;

/** Unguessable, human-readable reference e.g. "SIM-PAY-7F3A9C21D4". */
function makeReference(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

/** Splits a gross amount into platform fee and freelancer earnings. */
function splitAmount(amount) {
  const platformFee = toCents(amount * PLATFORM_FEE_RATE);
  return { amount: toCents(amount), platformFee, freelancerEarnings: toCents(amount - platformFee) };
}

/**
 * Simulated payment gateway. The brief states payments are simulated, so
 * this always "succeeds" and returns a reference - but it sits behind its
 * own function so a real provider could be swapped in at this one point.
 */
function simulatePayment() {
  return { status: 'succeeded', reference: makeReference('SIM-PAY') };
}

async function createBooking({ gigId, clientId, notes }) {
  const gig = await Gig.findById(gigId);
  if (!gig || !gig.isActive) throw new AppError('This gig is not available for booking.', 404);
  if (gig.freelancer.toString() === clientId) throw new AppError('You cannot book your own gig.', 400);

  const payment = simulatePayment();

  const booking = await Booking.create({
    gig: gig._id,
    client: clientId,
    freelancer: gig.freelancer,
    gigTitle: gig.title,
    amount: toCents(gig.price), // Price comes from the database, never from the request.
    notes: notes || '',
    paymentReference: payment.reference,
  });

  let transaction;
  try {
    transaction = await Transaction.create({
      booking: booking._id,
      gig: gig._id,
      client: clientId,
      freelancer: gig.freelancer,
      gigTitle: gig.title,
      type: 'payment',
      ...splitAmount(gig.price),
      reference: makeReference('TXN'),
    });
  } catch (err) {
    // Without a replica set MongoDB can't run multi-document transactions,
    // so if recording the payment fails we roll the booking back manually -
    // a booking must never exist without its financial record.
    await Booking.deleteOne({ _id: booking._id });
    throw err;
  }

  logger.audit('BOOKING_CREATED', {
    bookingId: booking.id,
    gigId: gig.id,
    clientId,
    freelancerId: gig.freelancer.toString(),
    amount: booking.amount,
  });
  logger.audit('TRANSACTION_RECORDED', {
    transactionId: transaction.id,
    reference: transaction.reference,
    type: 'payment',
    bookingId: booking.id,
    amount: transaction.amount,
    freelancerEarnings: transaction.freelancerEarnings,
  });

  return { booking, transaction };
}

/** Freelancer marks a confirmed booking as delivered. */
async function completeBooking(booking) {
  if (booking.status !== 'confirmed') throw new AppError(`A ${booking.status} booking cannot be completed.`, 409);
  booking.status = 'completed';
  booking.completedAt = new Date();
  await booking.save();
  logger.audit('BOOKING_COMPLETED', { bookingId: booking.id, freelancerId: String(booking.freelancer._id) }); // _id works whether or not the field is populated.
  return booking;
}

/** Client or freelancer cancels a confirmed booking - a refund transaction reverses the payment. */
async function cancelBooking(booking, cancelledBy) {
  if (booking.status !== 'confirmed') throw new AppError(`A ${booking.status} booking cannot be cancelled.`, 409);

  const original = splitAmount(booking.amount);
  const refund = await Transaction.create({
    booking: booking._id,
    gig: booking.gig,
    client: booking.client,
    freelancer: booking.freelancer,
    gigTitle: booking.gigTitle,
    type: 'refund',
    amount: -original.amount, // Negative rows cancel out the original payment in every income total.
    platformFee: -original.platformFee,
    freelancerEarnings: -original.freelancerEarnings,
    reference: makeReference('TXN'),
  });

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = cancelledBy;
  await booking.save();

  logger.audit('BOOKING_CANCELLED', { bookingId: booking.id, cancelledBy });
  logger.audit('TRANSACTION_RECORDED', {
    transactionId: refund.id,
    reference: refund.reference,
    type: 'refund',
    bookingId: booking.id,
    amount: refund.amount,
  });
  return { booking, refund };
}

module.exports = { createBooking, completeBooking, cancelBooking, splitAmount, toCents };
