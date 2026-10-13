/**
 * One structured HTTP_REQUEST log entry per request, written when the
 * response finishes. Fields (not a pre-formatted string) so the log
 * platform can filter and chart them: e.g. "all 5xx in the last hour" or
 * "p95 durationMs for /api/bookings".
 *
 * Health checks from Docker/CI are skipped - they run every few seconds
 * and would drown out real traffic.
 */
const logger = require('../utils/logger');

function httpLogger(req, res, next) {
  if (req.path === '/api/health') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    const log = res.statusCode >= 500 ? logger.error : res.statusCode >= 400 ? logger.warn : logger.info;
    log('HTTP_REQUEST', {
      method: req.method,
      path: req.originalUrl.split('?')[0], // Query strings can hold search text - the route is enough here.
      status: res.statusCode,
      durationMs,
      userAgent: (req.get('user-agent') || '').slice(0, 200),
    });
  });
  return next();
}

module.exports = { httpLogger };
