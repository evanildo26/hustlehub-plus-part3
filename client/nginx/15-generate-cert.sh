#!/bin/sh
# Runs before nginx starts (official image hook). Creates a self-signed TLS
# certificate for the browser-facing site in /tmp (the container filesystem
# is read-only). Production would mount a CA-issued certificate instead.
set -e
CERT_DIR=/tmp/nginx-certs
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/cert.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
    -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
    -subj "/CN=localhost/O=HustleHub Plus (local development)" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
  chmod 600 "$CERT_DIR/key.pem"
  echo "15-generate-cert.sh: created self-signed certificate for localhost"
fi
