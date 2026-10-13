# syntax=docker/dockerfile:1
#
# HustleHub+ API image.
#  - Multi-stage: dependencies are installed in a throw-away stage, so the
#    final image has no npm cache, build tools or dev dependencies.
#  - Small, current base (Node 22 LTS on Alpine, OS packages patched, npm
#    removed) with only openssl (to create
#    the TLS certificate) and tini (a proper PID 1 that forwards SIGTERM so
#    the server can shut down gracefully and flush its logs).
#  - Runs as the unprivileged `node` user. The application code is owned by
#    root and read-only for that user; only certs/ and src/logs/ are writable.

FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:26-alpine AS runtime
# Patch OS packages, add openssl + tini, and remove the package managers that
# ship with the Node image: the API never installs anything at runtime, and
# the bundled npm carried known CVEs (found by the Trivy scan in CI).
RUN apk upgrade --no-cache \
 && apk add --no-cache openssl tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY src ./src
COPY scripts/seedAdmin.js scripts/seedDemo.js scripts/healthcheck.js ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p certs src/logs \
 && chown node:node certs src/logs

USER node
EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 CMD ["node", "scripts/healthcheck.js"]
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
