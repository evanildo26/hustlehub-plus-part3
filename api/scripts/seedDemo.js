/**
 * Seeds demo data for screenshots / the demonstration video: freelancers
 * across every category, 27 gigs, two clients, and a handful of sample
 * bookings (with their payment/refund transactions) spread over the last
 * few months so the Earnings, Bookings and Admin pages have data.
 *
 * Safe to run repeatedly - accounts and gigs are only created once, and
 * sample bookings are only added if the demo clients have none yet.
 * Bookings go through bookingService, so they create real transaction
 * records exactly like the app does.
 *
 * Run with: npm run seed:demo
 *
 * Demo logins (local development only) - all use the password DemoPass1!
 *   freelancer  thandiwe@demo.hustlehub.local
 *   client      sipho@demo.hustlehub.local
 */
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/userModel');
const Gig = require('../src/models/gigModel');
const Booking = require('../src/models/bookingModel');
const Transaction = require('../src/models/transactionModel');
const bookingService = require('../src/services/bookingService');

const DEMO_PASSWORD = 'DemoPass1!';

const FREELANCERS = [
  {
    name: 'Thandiwe Nkosi',
    email: 'thandiwe@demo.hustlehub.local',
    gigs: [
      ['Modern logo and brand identity pack', 'Three logo concepts, two revision rounds, a colour palette and a font pairing guide, delivered as SVG and PNG files ready for print and web.', 'design', 1500, 5],
      ['Social media graphics bundle (15 posts)', 'Fifteen on-brand Instagram and Facebook post designs in Canva and PNG formats, including editable templates you can reuse.', 'design', 950, 4],
      ['Business card and letterhead design', 'Print-ready business card and letterhead designs that match your brand, with bleed and crop marks for any South African printer.', 'design', 650, 3],
    ],
  },
  {
    name: 'Kagiso Molefe',
    email: 'kagiso@demo.hustlehub.local',
    gigs: [
      ['Responsive React landing page', 'A fast, accessible single-page website built with React, including a contact form, mobile layout and step-by-step deployment instructions.', 'development', 4800, 10],
      ['WordPress site setup and speed tuning', 'Install and configure WordPress with a premium theme, security plugins, caching and image optimisation for a fast, secure business site.', 'development', 3200, 7],
      ['Bug fixing for Node.js and Express APIs', 'I will find and fix bugs in your Node.js / Express API, add input validation and write tests so the problem stays fixed.', 'development', 1200, 2],
      ['Online store with secure checkout', 'A WooCommerce or Shopify store with product pages, PayFast or Yoco checkout, shipping zones and an admin walkthrough video.', 'development', 7500, 14],
    ],
  },
  {
    name: 'Naledi Khumalo',
    email: 'naledi@demo.hustlehub.local',
    gigs: [
      ['SEO blog articles (1000 words)', 'Well-researched, original blog articles written for South African audiences and optimised for the keywords you choose.', 'writing', 650, 3],
      ['Professional CV and LinkedIn makeover', 'A recruiter-ready CV, cover letter template and LinkedIn profile rewrite tailored to your industry, with one revision round.', 'writing', 850, 3],
      ['Website copy that converts', 'Clear, friendly copy for up to five website pages - home, about, services, FAQ and contact - written to turn visitors into customers.', 'writing', 2200, 6],
    ],
  },
  {
    name: 'Zanele Mthembu',
    email: 'zanele@demo.hustlehub.local',
    gigs: [
      ['Social media content calendar', 'A 30-day content plan for Instagram and LinkedIn with captions, hashtags and suggested posting times for your audience.', 'marketing', 1200, 4],
      ['Google Ads campaign setup', 'Keyword research, ad copy and conversion tracking for a Google Ads search campaign, plus a simple monthly reporting dashboard.', 'marketing', 2500, 5],
      ['Email newsletter design and automation', 'A branded Mailchimp newsletter template and a three-email welcome sequence that starts automatically when someone subscribes.', 'marketing', 1800, 5],
    ],
  },
  {
    name: 'Pieter van der Merwe',
    email: 'pieter@demo.hustlehub.local',
    gigs: [
      ['YouTube video editing (up to 15 min)', 'Professional editing with cuts, colour correction, captions, music and an eye-catching thumbnail for videos up to fifteen minutes long.', 'video', 1400, 4],
      ['30-second promo video for your business', 'A short, punchy promotional video for social media using your footage or licensed stock clips, with music and on-screen text.', 'video', 2600, 6],
      ['Animated explainer video (60 seconds)', 'A friendly 2D animated explainer that shows how your product or service works, including script help and a professional voice-over.', 'video', 5500, 12],
    ],
  },
  {
    name: 'Rashid Adams',
    email: 'rashid@demo.hustlehub.local',
    gigs: [
      ['Podcast editing and mastering', 'Noise removal, levelling, intro and outro music and mastering to broadcast standard for podcast episodes up to an hour long.', 'music', 700, 3],
      ['Custom jingle for your brand', 'A memorable 15 to 30 second jingle composed and produced for your brand, delivered in radio-ready and social media versions.', 'music', 3500, 8],
      ['Professional voice-over recording', 'Clear, warm English or Afrikaans voice-over for adverts, e-learning or explainer videos, recorded in a treated home studio.', 'music', 900, 2],
    ],
  },
  {
    name: 'Anika Naidoo',
    email: 'anika@demo.hustlehub.local',
    gigs: [
      ['Business plan for funding applications', 'A complete business plan with market research, financial projections and an executive summary suitable for banks and investors.', 'business', 4500, 10],
      ['Bookkeeping clean-up in Xero or Sage', 'I will reconcile your bank accounts, categorise transactions and prepare tidy monthly reports so your books are ready for your accountant.', 'business', 1900, 5],
      ['Pitch deck design and storytelling', 'A polished 12-slide investor pitch deck that tells your story clearly, with charts, consistent branding and speaker notes.', 'business', 2800, 6],
    ],
  },
  {
    name: 'Thabo Ndlovu',
    email: 'thabo@demo.hustlehub.local',
    gigs: [
      ['Virtual assistant - 10 hours of admin', 'Ten hours of reliable admin support: inbox management, scheduling, data entry and online research, with a daily progress update.', 'other', 1500, 7],
      ['Excel dashboard and automation', 'A clean Excel or Google Sheets dashboard with formulas, charts and simple automation that turns messy data into clear insights.', 'other', 1100, 4],
      ['Product photo retouching (20 images)', 'Background removal, colour correction and consistent sizing for twenty product photos, ready for your online store.', 'other', 800, 3],
    ],
  },
  {
    name: 'Lindiwe Dube',
    email: 'lindiwe@demo.hustlehub.local',
    gigs: [
      ['UI/UX design for a mobile app', 'User flows, wireframes and high-fidelity Figma screens for up to eight app screens, with a clickable prototype to test with users.', 'design', 6200, 12],
      ['Translate documents English to isiZulu', 'Accurate, natural translation of documents, websites or marketing material between English and isiZulu, proofread before delivery.', 'writing', 500, 2],
    ],
  },
];

const CLIENTS = [
  { name: 'Sipho Dlamini', email: 'sipho@demo.hustlehub.local' },
  { name: 'Amahle Zulu', email: 'amahle@demo.hustlehub.local' },
];

/** Sample bookings: [client email, gig title, days ago, final status, notes] */
const SAMPLE_BOOKINGS = [
  ['sipho@demo.hustlehub.local', 'Modern logo and brand identity pack', 75, 'completed', 'Logo for my new coffee shop in Soweto - earthy colours please.'],
  ['amahle@demo.hustlehub.local', 'Social media graphics bundle (15 posts)', 48, 'completed', 'Posts for our spring sale campaign.'],
  ['sipho@demo.hustlehub.local', 'Business card and letterhead design', 40, 'cancelled', ''],
  ['amahle@demo.hustlehub.local', 'Modern logo and brand identity pack', 20, 'completed', 'Rebrand for a small bakery.'],
  ['sipho@demo.hustlehub.local', 'Social media graphics bundle (15 posts)', 6, 'confirmed', 'Matching posts for the new logo.'],
  ['sipho@demo.hustlehub.local', 'Responsive React landing page', 33, 'completed', 'Landing page for the coffee shop.'],
  ['amahle@demo.hustlehub.local', 'SEO blog articles (1000 words)', 12, 'confirmed', 'Topic: easy weekday baking recipes.'],
  ['sipho@demo.hustlehub.local', 'Podcast editing and mastering', 3, 'confirmed', ''],
];

async function upsertUser(name, email, role, passwordHash) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, role, password: passwordHash });
}

/** Moves a booking and its transactions back in time so the monthly income breakdown has history. */
async function backdate(bookingId, daysAgo) {
  const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  // Raw collection updates bypass Mongoose's automatic timestamps (seed data only).
  await Booking.collection.updateOne({ _id: bookingId }, { $set: { createdAt: when, updatedAt: when } });
  await Transaction.collection.updateMany({ booking: bookingId }, { $set: { createdAt: when, updatedAt: when } });
}

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  let gigCount = 0;
  for (const f of FREELANCERS) {
    const freelancer = await upsertUser(f.name, f.email, 'freelancer', passwordHash);
    for (const [title, description, category, price, deliveryDays] of f.gigs) {
      const exists = await Gig.exists({ freelancer: freelancer._id, title });
      if (!exists) await Gig.create({ freelancer: freelancer._id, title, description, category, price, deliveryDays });
      gigCount += 1;
    }
  }

  const clients = {};
  for (const c of CLIENTS) clients[c.email] = await upsertUser(c.name, c.email, 'client', passwordHash);

  const existingBookings = await Booking.countDocuments({ client: { $in: Object.values(clients).map((c) => c._id) } });
  let bookingCount = 0;
  if (existingBookings === 0) {
    for (const [email, title, daysAgo, status, notes] of SAMPLE_BOOKINGS) {
      const gig = await Gig.findOne({ title });
      const { booking } = await bookingService.createBooking({ gigId: gig._id, clientId: clients[email].id, notes });
      if (status === 'completed') await bookingService.completeBooking(booking);
      if (status === 'cancelled') await bookingService.cancelBooking(booking, 'client');
      await backdate(booking._id, daysAgo);
      bookingCount += 1;
    }
  }

  console.log(`Demo data ready: ${FREELANCERS.length} freelancers, ${gigCount} gigs, ${CLIENTS.length} clients, ${bookingCount} new sample bookings.`);
  console.log(`All demo accounts use the password ${DEMO_PASSWORD}`);
  console.log('  freelancer  thandiwe@demo.hustlehub.local');
  console.log('  client      sipho@demo.hustlehub.local');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Failed to seed demo data:', err.message);
  await disconnectDB();
  process.exit(1);
});
