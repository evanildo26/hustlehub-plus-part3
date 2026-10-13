#!/bin/sh
# Creates the API's self-signed TLS certificate on first start (stored in the
# api-certs volume, so it survives restarts and the nginx container can trust
# it), then hands over to the real command (node server.js).
set -e

if [ ! -f certs/key.pem ] || [ ! -f certs/cert.pem ]; then
  echo "Generating self-signed TLS certificate for the API (CN=api)..."
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
    -keyout certs/key.pem -out certs/cert.pem \
    -subj "/CN=api/O=HustleHub Plus (local development)" \
    -addext "subjectAltName=DNS:api,DNS:localhost,IP:127.0.0.1" 2>/dev/null >/dev/null || { echo "Could not create the TLS certificate (is certs/ writable?)" >&2; exit 1; }
  chmod 600 certs/key.pem
  chmod 644 certs/cert.pem
fi

exec "$@"
