/**
 * Runs the Part 2 Postman collection with Newman.
 *
 * Reads PORT and the seeded admin credentials from .env (so no secrets live
 * inside the collection file), then writes three reports:
 *   - the console (CLI reporter)
 *   - postman/reports/newman-report.html  (htmlextra - human-readable evidence)
 *   - postman/reports/newman-junit.xml    (JUnit - for the CI pipeline in Part 3)
 * Exits with code 1 if any assertion fails, so CI can fail the build.
 *
 * Prerequisites: the API is running (npm start) and the admin is seeded
 * (npm run seed:admin).
 *
 * Usage: npm run test:api   [optional: BASE_URL=https://host:port npm run test:api]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const newman = require('newman');

const REPORT_DIR = path.join(__dirname, '..', 'postman', 'reports');
const baseUrl = process.env.BASE_URL || `https://localhost:${process.env.PORT || 5000}`;

newman.run(
  {
    collection: require('../postman/HustleHub-Part2.postman_collection.json'),
    envVar: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'adminEmail', value: process.env.ADMIN_EMAIL || '' },
      { key: 'adminPassword', value: process.env.ADMIN_PASSWORD || '' },
    ],
    insecure: true, // The local certificate is self-signed - accept it for localhost testing only.
    reporters: ['cli', 'htmlextra', 'junit'],
    reporter: {
      htmlextra: {
        export: path.join(REPORT_DIR, 'newman-report.html'),
        title: 'HustleHub+ API - Newman Test Report',
        browserTitle: 'HustleHub+ Newman Report',
        // The report is committed as evidence, so keep secrets out of it: the admin
        // credentials (injected from .env) and every Bearer token are omitted.
        hideRequestBody: ['Login admin (seeded)'],
        hideResponseBody: ['Login admin (seeded)'],
        skipHeaders: 'Authorization',
      },
      junit: { export: path.join(REPORT_DIR, 'newman-junit.xml') },
    },
  },
  (err, summary) => {
    if (err) {
      console.error('Newman could not run the collection:', err.message);
      process.exit(1);
    }
    const failures = summary.run.failures.length;
    console.log(`\nReports written to ${path.relative(process.cwd(), REPORT_DIR)}`);
    process.exit(failures > 0 ? 1 : 0);
  }
);
