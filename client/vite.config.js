/**
 * Vite configuration for the HustleHub+ React client.
 *
 * Security-relevant choices:
 *  - HTTPS: the dev/preview servers reuse the API's locally generated
 *    certificate (api/certs), so credentials and JWTs never travel over
 *    plain HTTP between the browser and the app either.
 *  - Same-origin API proxy: the browser only ever talks to this server;
 *    requests to /api are forwarded to the Express API. That lets the CSP
 *    use `connect-src 'self'` and means no extra CORS exposure is needed.
 *  - Security headers + Content Security Policy on every page response.
 *    The production policy (vite preview / built app) is strict. The dev
 *    server needs two relaxations that ONLY exist for hot-reloading:
 *    'unsafe-inline' (React Fast Refresh injects an inline preamble and Vite
 *    injects CSS as <style> tags) and a websocket for HMR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const CERT_DIR = path.resolve(here, '..', 'api', 'certs');

/** Uses the API's self-signed certificate when it exists (run `npm run generate-cert` in api/). */
function httpsOptions() {
  const key = path.join(CERT_DIR, 'key.pem');
  const cert = path.join(CERT_DIR, 'cert.pem');
  if (fs.existsSync(key) && fs.existsSync(cert)) {
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  }
  console.warn('[vite] api/certs not found - serving over HTTP. Run `npm run generate-cert` in api/ for HTTPS.');
  return undefined;
}

function contentSecurityPolicy({ dev }) {
  return [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'", // Production: only our own bundled scripts may run.
    dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    dev ? "connect-src 'self' ws://localhost:* wss://localhost:*" : "connect-src 'self'", // fetch/XHR only to our own origin (/api proxy).
    "object-src 'none'", // No Flash/Java/plugins.
    "base-uri 'self'", // Stops injected <base> tags re-pointing relative URLs.
    "form-action 'self'", // Forms can't post data to another site.
    "frame-ancestors 'none'", // The app can't be framed (clickjacking).
  ].join('; ');
}

function securityHeaders({ dev }) {
  return {
    'Content-Security-Policy': contentSecurityPolicy({ dev }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', // The app needs none of these browser features.
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, ''); // Reads client/.env, client/.env.local, etc.
  const proxy = {
    '/api': {
      target: env.API_PROXY_TARGET || 'https://localhost:5000', // Where the Express API is listening.
      changeOrigin: true,
      secure: false, // The API's certificate is self-signed (local development only).
    },
  };
  const https = mode === 'test' ? undefined : httpsOptions();

  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true, https, proxy, headers: securityHeaders({ dev: true }) },
    preview: { port: 4173, strictPort: true, https, proxy, headers: securityHeaders({ dev: false }) },
    build: {
      sourcemap: false, // Don't publish source maps that reveal original source to anyone who opens dev tools.
      // Never inline small assets as data: URLs. Vite does this by default for
      // files under 4 KB (some font subsets are), and the strict CSP
      // (font-src 'self') would then block them. Every asset is a real file.
      assetsInlineLimit: 0,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.js',
      css: false,
    },
  };
});
