const express = require('express');
const { app, request } = require('./helpers');
const { createLimiter } = require('../src/middleware/rateLimiter');
const { stripOperators } = require('../src/middleware/sanitizeRequest');
const { sanitizeText, escapeRegex } = require('../src/utils/sanitize');
const logger = require('../src/utils/logger');

describe('Security headers', () => {
  test('API responses carry a strict CSP and hardening headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('data responses are marked no-store', async () => {
    const res = await request(app).get('/api/gigs/not-an-id');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('Controlled error responses', () => {
  test('unknown routes return a JSON 404 with no stack trace or file paths', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|\\src\\|\/src\/|node_modules/);
  });

  test('malformed JSON returns a 400 instead of a crash', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Request body must be valid JSON.');
  });

  test('oversized bodies are rejected with 413', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'a'.repeat(20000) });
    expect(res.status).toBe(413);
  });
});

describe('Rate limiting', () => {
  test('returns 429 with a meaningful message once the limit is exceeded', async () => {
    const limited = express();
    limited.use(createLimiter({ name: 'test', max: 2, windowMs: 60000, message: 'Slow down please.' }));
    limited.get('/', (req, res) => res.json({ ok: true }));

    await request(limited).get('/').expect(200);
    await request(limited).get('/').expect(200);
    const res = await request(limited).get('/');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, message: 'Slow down please.', retryAfterSeconds: 60 });
    expect(res.headers['retry-after']).toBe('60');
  });
});

describe('Sanitisation helpers', () => {
  test('stripOperators removes $-operators and dotted keys at any depth', () => {
    const input = { email: { $ne: null }, profile: { 'a.b': 1, nested: { $where: 'x' } }, ok: 'yes' };
    const removed = stripOperators(input);
    expect(input).toEqual({ email: {}, profile: { nested: {} }, ok: 'yes' });
    expect(removed).toEqual(expect.arrayContaining(['$ne', 'a.b', '$where']));
  });

  test('sanitizeText strips tags, brackets and control characters', () => {
    expect(sanitizeText('  Hello <b>world</b>\u0000 <script>x</script> ')).toBe('Hello world x');
    expect(sanitizeText('5 > 3 and 2 < 4')).toBe('5 3 and 2 4'); // Lone brackets are removed too.
    expect(sanitizeText('Line 1\n\n\n\nLine 2', { multiline: true })).toBe('Line 1\n\nLine 2');
  });

  test('escapeRegex neutralises regex operators', () => {
    // The point of this test is to build a RegExp from (escaped) input, as gigController does.
    /* eslint-disable security/detect-non-literal-regexp */
    expect(new RegExp(escapeRegex('.*')).test('anything')).toBe(false);
    expect(new RegExp(escapeRegex('a+b')).test('a+b')).toBe(true);
    /* eslint-enable security/detect-non-literal-regexp */
  });
});

describe('Prototype pollution (static-analysis follow-up)', () => {
  test('stripOperators removes __proto__, constructor and prototype keys at any depth', () => {
    const input = JSON.parse('{"title":"ok","__proto__":{"isAdmin":true},"nested":{"constructor":{"prototype":{"x":1}}}}');
    const removed = stripOperators(input);
    expect(removed).toEqual(expect.arrayContaining(['__proto__', 'constructor']));
    expect(Object.keys(input)).toEqual(['title', 'nested']);
    expect(Object.keys(input.nested)).toEqual([]);
    expect({}.isAdmin).toBeUndefined(); // Object.prototype untouched
  });

  test('a __proto__ payload sent to the API is stripped and logged as a security event', async () => {
    const events = [];
    logger.addSink((e) => events.push(e.event));
    const res = await request(app)
      .post('/api/no-such-route')
      .set('Content-Type', 'application/json')
      .send('{"name":"x","__proto__":{"role":"admin"}}');
    expect(res.status).toBe(404); // Handled normally - no crash.
    expect({}.role).toBeUndefined();
    expect(events).toContain('PROTOTYPE_POLLUTION_ATTEMPT');
  });
});

describe('sanitizeText with nested tags (CodeQL follow-up)', () => {
  test('repeats tag removal so nested tags cannot rebuild a <script> tag', () => {
    const out = sanitizeText('<scr<script>ipt>alert(1)</script> Hi <<b>i>there');
    expect(out).not.toMatch(/[<>]/);
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('Hi');
  });
});
