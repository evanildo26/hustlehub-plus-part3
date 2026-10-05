/**
 * MongoDB connection (via Mongoose).
 *
 * Part 1 stored users in a JSON file, which the brief allowed "at this
 * stage". Part 2 replaces it with MongoDB - the "M" in MERN. Mongoose adds
 * schema validation on top of MongoDB, so even if a bug let bad data past
 * the request validators, the database layer would still reject it.
 */
const mongoose = require('mongoose'); // ODM (object-document mapper) for MongoDB.
const { mongoUri } = require('./env');
const logger = require('../utils/logger');

// Only fields declared in a schema can be used in query filters. Unknown
// keys are dropped instead of being passed through to MongoDB, which shrinks
// the surface for crafted-filter (NoSQL injection) attacks.
mongoose.set('strictQuery', true);

async function connectDB(uri = mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000, // Fail within 5s (with a clear log) if MongoDB isn't running, instead of hanging.
  });
  logger.info('DB_CONNECTED', { host: mongoose.connection.host, db: mongoose.connection.name }); // Never log the full URI - it may hold credentials.
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
