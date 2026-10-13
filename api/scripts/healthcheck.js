/**
 * Container health check (Dockerfile HEALTHCHECK and docker compose).
 *
 * Calls GET /api/health over HTTPS and exits 0 when it returns 200. The
 * server's own certificate is passed as the trusted CA, so TLS is fully
 * verified - no "ignore certificate errors" shortcut is needed even though
 * the certificate is self-signed.
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const port = Number(process.env.PORT) || 5000;
const ca = fs.readFileSync(path.join(__dirname, '..', 'certs', 'cert.pem'));

const req = https.get({ host: '127.0.0.1', port, path: '/api/health', ca, servername: 'localhost', timeout: 4000 }, (res) => {
  res.resume();
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('timeout', () => req.destroy(new Error('timeout')));
req.on('error', () => process.exit(1));
