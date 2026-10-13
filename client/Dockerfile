# syntax=docker/dockerfile:1
#
# HustleHub+ React client image.
#  - Stage 1 builds the production bundle with Vite.
#  - Stage 2 serves it with nginx (unprivileged image: runs as uid 101 and
#    listens on 8080/8443, so no root and no low ports). nginx also
#    terminates HTTPS, sends the strict CSP and security headers, and proxies
#    /api to the API container over verified TLS.

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
USER root
# Patch the base image's OS packages (Trivy flagged outdated curl, expat,
# pcre2, libxml2 ...) and add openssl for the self-signed certificate.
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/15-generate-cert.sh /docker-entrypoint.d/15-generate-cert.sh
RUN chmod 0755 /docker-entrypoint.d/15-generate-cert.sh
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080 8443
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider --no-check-certificate https://127.0.0.1:8443/healthz || exit 1
