/**
 * Shared test helpers: DB lifecycle and quick ways to create users/gigs.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/userModel');
const { signToken } = require('../src/utils/jwt');

const PASSWORD = 'StrongPass1!';

async function setupDB() {
  await connectDB();
}

async function clearDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function teardownDB() {
  await clearDB();
  await disconnectDB();
}

let counter = 0;

/** Creates a user directly in the DB (fast, low bcrypt cost) and returns { user, token }. */
async function createUser(role = 'client', overrides = {}) {
  counter += 1;
  const user = await User.create({
    name: overrides.name || `Test ${role}`,
    email: overrides.email || `${role}${counter}-${Date.now()}@test.local`,
    password: await bcrypt.hash(PASSWORD, 4), // Low cost factor keeps the suite fast; production uses 12.
    role,
  });
  return { user, token: signToken({ id: user.id, role: user.role, email: user.email }) };
}

const validGig = (overrides = {}) => ({
  title: 'Professional logo design',
  description: 'A clean, modern logo with two revision rounds and source files.',
  category: 'design',
  price: 1000,
  deliveryDays: 5,
  ...overrides,
});

/** Creates a gig through the API as the given freelancer. */
async function createGig(token, overrides = {}) {
  const res = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send(validGig(overrides));
  if (res.status !== 201) throw new Error(`createGig failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

module.exports = { app, request, setupDB, clearDB, teardownDB, createUser, createGig, validGig, PASSWORD };
