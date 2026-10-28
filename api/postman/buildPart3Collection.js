/**
 * Builds the Part 3 Postman collection from the Part 2 one plus three new
 * folders (tax estimate; Part 3 security features; rate limits on the real
 * routes). Keeping the new
 * requests in code makes them easy to review and regenerate:
 *
 *   node postman/buildPart3Collection.js
 *
 * Output: postman/HustleHub-Part3.postman_collection.json (import it into
 * Postman, or run it headless with `npm run test:api`).
 */
const fs = require('fs');
const path = require('path');

const part2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'HustleHub-Part2.postman_collection.json'), 'utf8'));

/** Small helper for a request with an optional bearer token, JSON body and test/pre-request scripts. */
function req(name, method, urlPath, { token, body, tests = [], pre = [] } = {}) {
  const header = [];
  if (body !== undefined) header.push({ key: 'Content-Type', value: 'application/json' });
  if (token) header.push({ key: 'Authorization', value: `Bearer {{${token}}}` });
  const raw = `{{baseUrl}}${urlPath}`;
  const [pathPart, queryPart] = urlPath.split('?');
  const url = { raw, host: ['{{baseUrl}}'], path: pathPart.split('/').filter(Boolean) };
  if (queryPart) url.query = queryPart.split('&').map((kv) => ({ key: kv.split('=')[0], value: kv.split('=')[1] }));
  const item = { name, request: { method, header, url }, event: [] };
  if (body !== undefined) {
    item.request.body = {
      mode: 'raw',
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  if (pre.length) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  if (tests.length) item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests } });
  return item;
}

const status = (code) => `pm.test('Status is ${code}', () => pm.response.to.have.status(${code}));`;

const taxFolder = {
  name: '7. Tax estimate (Part 3)',
  description: 'SARS income tax estimate on the freelancer\'s own net earnings for the current tax year.',
  item: [
    req('Freelancer tax estimate -> 200', 'GET', '/api/income/tax-estimate', {
      token: 'freelancerToken',
      tests: [
        status(200),
        'const t = pm.response.json().data;',
        "pm.test('Uses net earnings this tax year (R900 after the refund)', () => pm.expect(t.ytdIncome).to.eql(900));",
        "pm.test('Gross and platform fee for the year', () => { pm.expect(t.ytdGross).to.eql(1000); pm.expect(t.ytdPlatformFees).to.eql(100); });",
        "pm.test('Twelve months in the tax year', () => pm.expect(t.months).to.have.length(12));",
        "pm.test('Tax year label like 2026/27', () => pm.expect(t.taxYear.label).to.match(/^\\d{4}\\/\\d{2}$/));",
        "pm.test('Below the threshold -> no tax', () => { pm.expect(t.belowThreshold).to.eql(true); pm.expect(t.estimatedAnnualTax).to.eql(0); });",
        "pm.test('Two provisional tax payments', () => pm.expect(t.provisionalTax).to.have.length(2));",
        "pm.test('Calculation method and disclaimer explained', () => { pm.expect(t.method.length).to.be.above(2); pm.expect(t.disclaimer).to.match(/estimate/i); });",
      ],
    }),
    req('Age group 65 to 74 adds the secondary rebate', 'GET', '/api/income/tax-estimate?ageGroup=65to74', {
      token: 'freelancerToken',
      tests: [status(200), "pm.test('Rebate is larger than the primary rebate alone', () => pm.expect(pm.response.json().data.rebate).to.be.above(17820));"],
    }),
    req('Invalid age group -> 400', 'GET', '/api/income/tax-estimate?ageGroup=everyone', {
      token: 'freelancerToken',
      tests: [status(400), "pm.test('Field error for ageGroup', () => pm.expect(pm.response.json().errors[0].field).to.eql('ageGroup'));"],
    }),
    req('Other freelancer sees only their own (zero) income', 'GET', '/api/income/tax-estimate', {
      token: 'freelancer2Token',
      tests: [status(200), "pm.test('No income leaks between freelancers', () => pm.expect(pm.response.json().data.ytdIncome).to.eql(0));"],
    }),
    req('Client tax estimate -> 403', 'GET', '/api/income/tax-estimate', { token: 'clientToken', tests: [status(403)] }),
    req('Anonymous tax estimate -> 401', 'GET', '/api/income/tax-estimate', { tests: [status(401)] }),
  ],
};

const securityFolder = {
  name: '8. Part 3 security features',
  description:
    'Account lockout, logout (token revocation), admin session revocation, security monitor, prototype-pollution stripping and request ids. Runs last because it revokes tokens used earlier.',
  item: [
    req('Every response has an X-Request-Id', 'GET', '/api/health', {
      tests: [status(200), "pm.test('Request id header present', () => pm.expect(pm.response.headers.get('X-Request-Id')).to.match(/^[A-Za-z0-9._-]{8,64}$/));"],
    }),
    req('Register lockout test user', 'POST', '/api/auth/register', {
      pre: ["pm.collectionVariables.set('lockEmail', 'lock.' + Date.now() + '@newman.test');", "pm.collectionVariables.set('lockAttempts', 0);"],
      body: '{\n  "name": "Lockout Test",\n  "email": "{{lockEmail}}",\n  "password": "{{password}}",\n  "role": "client"\n}',
      tests: [status(201)],
    }),
    req('Wrong password until the account locks (4 x 401, then 423)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{lockEmail}}",\n  "password": "WrongPass1!"\n}',
      tests: [
        "const attempt = Number(pm.collectionVariables.get('lockAttempts')) + 1;",
        "pm.collectionVariables.set('lockAttempts', attempt);",
        'if (attempt < 5) {',
        "  pm.test('Attempt ' + attempt + ': 401 invalid credentials', () => pm.response.to.have.status(401));",
        '  pm.execution.setNextRequest(pm.info.requestName); // Repeat this request',
        '} else {',
        "  pm.test('5th failure locks the account: 423', () => pm.response.to.have.status(423));",
        "  pm.test('Lockout message and Retry-After header', () => { pm.expect(pm.response.json().message).to.match(/try again in 15 minutes/); pm.expect(pm.response.headers.get('Retry-After')).to.eql('900'); });",
        '}',
      ],
    }),
    req('Correct password while locked -> still 423 (no token)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{lockEmail}}",\n  "password": "{{password}}"\n}',
      tests: [status(423), "pm.test('No token issued', () => pm.expect(pm.response.json().token).to.be.undefined);"],
    }),
    req('Login client again (second session)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{clientEmail}}",\n  "password": "{{password}}"\n}',
      tests: [status(200), "pm.collectionVariables.set('logoutToken', pm.response.json().token);"],
    }),
    req('Second session works -> 200', 'GET', '/api/users/me', { token: 'logoutToken', tests: [status(200)] }),
    req('Logout revokes that token -> 200', 'POST', '/api/auth/logout', { token: 'logoutToken', tests: [status(200)] }),
    req('Logged-out token is rejected -> 401', 'GET', '/api/users/me', {
      token: 'logoutToken',
      tests: [status(401), "pm.test('Session ended message', () => pm.expect(pm.response.json().message).to.eql('Your session has ended. Please log in again.'));"],
    }),
    req('Other sessions keep working -> 200', 'GET', '/api/users/me', { token: 'clientToken', tests: [status(200)] }),
    req('Client cannot revoke sessions -> 403', 'POST', '/api/admin/users/{{client2Id}}/revoke-sessions', { token: 'clientToken', tests: [status(403)] }),
    req('Admin revokes all sessions of the second client -> 200', 'POST', '/api/admin/users/{{client2Id}}/revoke-sessions', {
      token: 'adminToken',
      tests: [status(200)],
    }),
    req("Second client's old token is rejected -> 401", 'GET', '/api/users/me', { token: 'client2Token', tests: [status(401)] }),
    req('Prototype-pollution keys are stripped (no crash)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{clientEmail}}",\n  "password": "WrongPass1!",\n  "__proto__": { "role": "admin" }\n}',
      tests: ["pm.test('Handled as a normal failed login (401), not a 500', () => pm.response.to.have.status(401));"],
    }),
    req('Admin security monitor shows the lockout -> 200', 'GET', '/api/admin/security-events?hours=1', {
      token: 'adminToken',
      tests: [
        status(200),
        'const t = pm.response.json().data.totals;',
        "pm.test('Failed logins counted', () => pm.expect(t.failedLogins).to.be.at.least(4));",
        "pm.test('Account lock recorded', () => pm.expect(t.accountsLocked).to.be.at.least(1));",
        "pm.test('Recent events listed', () => pm.expect(pm.response.json().data.recentEvents.length).to.be.above(0));",
      ],
    }),
    req('Freelancer cannot see security events -> 403', 'GET', '/api/admin/security-events', { token: 'freelancerToken', tests: [status(403)] }),
  ],
};

// Loops with pm.execution.setNextRequest until the REAL limiter answers 429, then asserts on that response.
const rateLimitFolder = {
  name: '9. Rate limits on the real routes',
  description:
    'Hits the configured limiters at their real limits (10 bookings per user, 10 failed logins per IP, per 15 minutes) and asserts on the final 429. Runs LAST: once the login limit is reached every login from this IP is refused for 15 minutes, so restart the API (in-memory limiter store) or wait before running the collection again.',
  item: [
    req('Register a fresh client for the booking limit', 'POST', '/api/auth/register', {
      pre: ["pm.collectionVariables.set('rlEmail', 'ratelimit.' + Date.now() + '@newman.test');", "pm.collectionVariables.set('rlBookings', 0);"],
      body: '{\n  "name": "Rate Limit Test",\n  "email": "{{rlEmail}}",\n  "password": "{{password}}",\n  "role": "client"\n}',
      tests: [status(201)],
    }),
    req('Login fresh client (successful logins do not count)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{rlEmail}}",\n  "password": "{{password}}"\n}',
      tests: [status(200), "pm.collectionVariables.set('rlToken', pm.response.json().token);"],
    }),
    req('Book until the booking limiter answers (10 x 201, then 429)', 'POST', '/api/bookings', {
      token: 'rlToken',
      body: '{\n  "gigId": "{{gigId}}"\n}',
      tests: [
        "const n = Number(pm.collectionVariables.get('rlBookings')) + 1;",
        "pm.collectionVariables.set('rlBookings', n);",
        'if (n <= 10) {',
        "  pm.test('Booking ' + n + ' of 10: 201', () => pm.response.to.have.status(201));",
        '  pm.execution.setNextRequest(pm.info.requestName); // Repeat this request',
        '} else {',
        "  pm.test('11th booking from the same user: 429', () => pm.response.to.have.status(429));",
        "  pm.test('Clear message, retryAfterSeconds and Retry-After header', () => { const b = pm.response.json(); pm.expect(b.success).to.eql(false); pm.expect(b.message).to.match(/booking/i); pm.expect(b.retryAfterSeconds).to.eql(900); pm.expect(pm.response.headers.get('Retry-After')).to.eql('900'); });",
        "  pm.test('Policy header advertises 10 per 15 minutes', () => pm.expect(pm.response.headers.get('RateLimit-Policy')).to.match(/^10;w=900/));",
        '}',
      ],
    }),
    req('Another user can still book (limit is per user, not per IP) -> 201', 'POST', '/api/bookings', {
      token: 'clientToken',
      body: '{\n  "gigId": "{{gigId}}"\n}',
      tests: [status(201)],
      pre: ["pm.collectionVariables.set('rlLogins', 0);"],
    }),
    req('Wrong passwords until the login limiter answers (then 429)', 'POST', '/api/auth/login', {
      // A new unknown email each attempt, so the per-account lockout (423) never hides the per-IP limiter.
      pre: ["pm.variables.set('rlLoginEmail', 'nobody.' + Date.now() + '.' + pm.collectionVariables.get('rlLogins') + '@newman.test');"],
      body: '{\n  "email": "{{rlLoginEmail}}",\n  "password": "WrongPass1!"\n}',
      tests: [
        "const n = Number(pm.collectionVariables.get('rlLogins')) + 1;",
        "pm.collectionVariables.set('rlLogins', n);",
        // Earlier folders already used part of this IP's budget of 10 failures, so the loop stops at the first 429.
        'if (pm.response.code === 401 && n <= 10) {',
        "  pm.test('Failed login ' + n + ': 401', () => pm.response.to.have.status(401));",
        '  pm.execution.setNextRequest(pm.info.requestName); // Repeat this request',
        '} else {',
        "  pm.test('Limit reached: 429', () => pm.response.to.have.status(429));",
        "  pm.test('Clear message, retryAfterSeconds and Retry-After header', () => { const b = pm.response.json(); pm.expect(b.message).to.eql('Too many failed login attempts. Please wait 15 minutes before trying again.'); pm.expect(b.retryAfterSeconds).to.eql(900); pm.expect(pm.response.headers.get('Retry-After')).to.eql('900'); });",
        "  pm.test('Policy header advertises 10 failures per 15 minutes', () => pm.expect(pm.response.headers.get('RateLimit-Policy')).to.match(/^10;w=900/));",
        '}',
      ],
    }),
    req('Correct password from the blocked IP -> 429 (no token)', 'POST', '/api/auth/login', {
      body: '{\n  "email": "{{rlEmail}}",\n  "password": "{{password}}"\n}',
      tests: [status(429), "pm.test('No token issued', () => pm.expect(pm.response.json().token).to.be.undefined);"],
    }),
  ],
};

const part3 = {
  ...part2,
  info: {
    ...part2.info,
    name: 'HustleHub+ API - Part 3',
    description:
      'Part 2 collection (auth, gigs, bookings, transactions, admin, security controls) plus Part 3: tax estimate, account lockout, token revocation, security monitor, and the real rate limits (10 bookings per user, 10 failed logins per IP). Run in order; restart the API or wait 15 minutes between runs, because the last folder uses up the login limit (Newman: npm run test:api).',
  },
  item: [...part2.item, taxFolder, securityFolder, rateLimitFolder],
};
delete part3.info._postman_id;

fs.writeFileSync(path.join(__dirname, 'HustleHub-Part3.postman_collection.json'), JSON.stringify(part3, null, 2) + '\n');
console.log(`Wrote HustleHub-Part3.postman_collection.json (${part3.item.reduce((n, f) => n + f.item.length, 0)} requests in ${part3.item.length} folders)`);
