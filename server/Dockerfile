# Multi-stage build — the final image ships only production dependencies
# and application code, not devDependencies or the npm cache layer.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# npm ci (not install) — fails if package-lock.json is out of sync with
# package.json instead of silently resolving a different tree, and skips
# the dependency-resolution step entirely for faster, reproducible builds.
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

# SECURITY: run as a non-root, unprivileged user. The default `node` user
# baked into this image already exists — no need to create one. Without
# this, a container-escape or dependency RCE runs as root inside the
# container, which is a materially worse blast radius than running as an
# account with no special privileges.
RUN chown -R node:node /app
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production
EXPOSE 3000

# HEALTHCHECK lets `docker compose ps` / orchestrators detect a hung
# process (e.g. lost its MongoDB connection) instead of treating "the
# process is still running" as "the service is healthy".
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
