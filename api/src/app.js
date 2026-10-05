/**
 * Express application setup.
 *
 * Kept separate from server.js so the app itself (routes, middleware) can
 * be imported by the Jest/Supertest tests without having to boot an actual
 * HTTPS server or bind a port.
 *
 * Middleware ORDER matters - each request passes through, top to bottom:
 *   security headers -> CORS -> rate limit -> body parsing (size-capped)
 *   -> NoSQL-operator stripping -> request logging -> routes
 *   (route-level: JWT -> role check -> field allow-list -> validation)
 *   -> 404 -> central error handler
 */
const express = require('express'); // The web framework used to define routes and middleware.
const cors = require('cors'); // Middleware that controls which browser origins are allowed to call this API.
const morgan = require('morgan'); // HTTP request logging middleware (logs method, path, status, response time, etc.).

const { corsOrigins, nodeEnv, isTest } = require('./config/env');
const { securityHeaders, noStore } = require('./middleware/securityHeaders'); // Helmet + strict CSP, and no-store caching.
const { apiLimiter } = require('./middleware/rateLimiter'); // Global per-IP request ceiling.
const { sanitizeRequest } = require('./middleware/sanitizeRequest'); // Strips $-operators / dotted keys (NoSQL injection).
const authRoutes = require('./routes/authRoutes'); // /api/auth/register, /api/auth/login
const userRoutes = require('./routes/userRoutes'); // /api/users/me
const gigRoutes = require('./routes/gigRoutes'); // /api/gigs
const bookingRoutes = require('./routes/bookingRoutes'); // /api/bookings
const transactionRoutes = require('./routes/transactionRoutes'); // /api/transactions, /api/income/summary
const adminRoutes = require('./routes/adminRoutes'); // /api/admin/*
const { notFound, errorHandler } = require('./middleware/errorHandler'); // 404 + centralised error-handling middleware.
const logger = require('./utils/logger'); // Structured logger used to route morgan's output into our own log file too.

const app = express(); // Create the Express application instance.

// --- Security-related HTTP headers, including a strict Content Security
// Policy (see middleware/securityHeaders.js for the reasoning).
app.use(securityHeaders);

// --- CORS: only the configured frontend origin(s) may call this API from a
// browser; credentials are not required for the JWT bearer-token flow.
app.use(
  cors({
    origin: corsOrigins, // Exact allow-list - never '*' for an API that handles personal and financial data.
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// --- Global rate limit (sensitive endpoints add stricter limiters of their own).
app.use('/api', apiLimiter);

// --- Body parsing with a size limit, to reduce the impact of oversized
// payload abuse.
app.use(express.json({ limit: '10kb' })); // Parse JSON request bodies into req.body; reject bodies bigger than 10kb.
app.use(express.urlencoded({ extended: false, limit: '10kb' })); // Form bodies, flat only - no nested-object parsing.

// --- NoSQL injection guard: runs after parsing, before any route.
app.use(sanitizeRequest);

// --- HTTP request logging: routed through the app logger so every request
// is also captured in src/logs/events.log. Disabled under Jest.
if (!isTest) {
  app.use(
    morgan(nodeEnv === 'production' ? 'combined' : 'dev', {
      stream: { write: (message) => logger.info('HTTP_REQUEST', { message: message.trim() }) },
    })
  );
}

// --- Public health check (useful for CI/CD + container orchestration
// checks in later parts of the POE).
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'HustleHub+ API is running.' }); // Simple liveness check, no auth required.
});

// --- Feature routes (all responses contain user data -> never cache)
app.use('/api', noStore);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', transactionRoutes);

// --- 404 + centralised error handling (must be registered last)
app.use(notFound); // Catches any request that didn't match a route above and turns it into a controlled 404.
app.use(errorHandler); // Catches every error passed to next(err) anywhere in the app and builds a safe response.

module.exports = app; // Export the configured app so server.js (and the test suite) can use it.
