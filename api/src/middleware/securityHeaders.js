/**
 * Security headers (Helmet) including a Content Security Policy.
 *
 * This API only ever returns JSON - it never serves HTML, scripts, styles
 * or images. So its CSP can be the strictest possible: `default-src 'none'`
 * means that if a response were ever rendered by a browser (e.g. someone
 * opens an API URL directly, or an attacker tricks the API into reflecting
 * markup), the browser would refuse to load or run ANYTHING from it.
 *
 * The React frontend gets its own, page-appropriate CSP from the Vite
 * server (see client/vite.config.js), since that is where HTML is served.
 */
const helmet = require('helmet');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false, // Build the policy explicitly rather than inheriting defaults meant for HTML sites.
    directives: {
      defaultSrc: ["'none'"], // Block every resource type by default.
      frameAncestors: ["'none'"], // No site may embed API responses in a frame (clickjacking).
      baseUri: ["'none'"], // No <base> tag can re-point relative URLs.
      formAction: ["'none'"], // No form may submit anywhere from an API response.
    },
  },
  strictTransportSecurity: {
    maxAge: 31536000, // HSTS: browsers remember "HTTPS only" for this host for one year...
    includeSubDomains: true, // ...including subdomains.
  },
  referrerPolicy: { policy: 'no-referrer' }, // Never leak API URLs (which can contain IDs) in the Referer header.
  crossOriginResourcePolicy: { policy: 'same-site' }, // Other sites can't embed API responses as resources.
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY for older browsers that ignore frame-ancestors.
});

/**
 * Responses contain personal and financial data (profiles, bookings,
 * transactions, income). `no-store` stops browsers and intermediary
 * proxies from caching them, so they can't be read later from a shared
 * computer's cache after the user logs out.
 */
function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache'); // HTTP/1.0 equivalent for old caches.
  next();
}

module.exports = { securityHeaders, noStore };
