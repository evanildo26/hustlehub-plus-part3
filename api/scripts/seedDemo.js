/**
 * Seeds demo data for screenshots / the demonstration video: one
 * freelancer, one client and a handful of gigs. Safe to run repeatedly -
 * existing demo accounts are reused and their gigs are only created once.
 *
 * Run with: npm run seed:demo
 *
 * Demo logins (local development only):
 *   freelancer  thandiwe@demo.hustlehub.local / DemoPass1!
 *   client      sipho@demo.hustlehub.local    / DemoPass1!
 */
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/userModel');
const Gig = require('../src/models/gigModel');

const DEMO_PASSWORD = 'DemoPass1!';

const GIGS = [
  {
    title: 'Modern logo and brand identity pack',
    description: 'A professional logo with three concepts, two revision rounds, colour palette and font pairing guide delivered as SVG and PNG.',
    category: 'design',
    price: 1500,
    deliveryDays: 5,
  },
  {
    title: 'Responsive React landing page',
    description: 'A fast, accessible single-page site built with React. Includes a contact form, mobile layout and deployment instructions.',
    category: 'development',
    price: 4800,
    deliveryDays: 10,
  },
  {
    title: 'SEO blog articles (1000 words)',
    description: 'Well-researched, original blog articles written for South African audiences, optimised for your chosen keywords.',
    category: 'writing',
    price: 650,
    deliveryDays: 3,
  },
  {
    title: 'Social media content calendar',
    description: 'A 30-day content plan for Instagram and LinkedIn with captions, hashtags and suggested posting times.',
    category: 'marketing',
    price: 1200,
    deliveryDays: 4,
  },
];

async function upsertUser(name, email, role) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, role, password: await bcrypt.hash(DEMO_PASSWORD, 12) });
}

async function main() {
  await connectDB();
  const freelancer = await upsertUser('Thandiwe Nkosi', 'thandiwe@demo.hustlehub.local', 'freelancer');
  await upsertUser('Sipho Dlamini', 'sipho@demo.hustlehub.local', 'client');

  for (const gig of GIGS) {
    const exists = await Gig.exists({ freelancer: freelancer._id, title: gig.title });
    if (!exists) await Gig.create({ ...gig, freelancer: freelancer._id });
  }

  console.log('Demo data ready:');
  console.log('  freelancer  thandiwe@demo.hustlehub.local / DemoPass1!');
  console.log('  client      sipho@demo.hustlehub.local    / DemoPass1!');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Failed to seed demo data:', err.message);
  await disconnectDB();
  process.exit(1);
});
