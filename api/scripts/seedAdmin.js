/**
 * Creates (or updates) the platform administrator account.
 *
 * Admins cannot register through the public API - that would be a
 * privilege-escalation hole - so the account is provisioned out-of-band
 * here, from credentials in .env (ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD).
 *
 * Run with: npm run seed:admin
 */
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/userModel');

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,128}$/; // Same policy as registration.

async function main() {
  const name = (process.env.ADMIN_NAME || 'Platform Admin').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !PASSWORD_POLICY.test(password) || password.startsWith('replace_with')) {
    console.error(
      'Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (8+ chars, upper, lower, digit, symbol) in .env first.'
    );
    process.exit(1);
  }

  await connectDB();
  const hashed = await bcrypt.hash(password, 12);
  await User.findOneAndUpdate(
    { email },
    { name, email, password: hashed, role: 'admin' },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin account ready: ${email}`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Failed to seed admin:', err.message);
  await disconnectDB();
  process.exit(1);
});
