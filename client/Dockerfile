# Multi-stage: build the static Vite bundle, then serve it with nginx —
# the final image ships no Node runtime, no node_modules, no source files,
# just the compiled static assets.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite env vars are compile-time, not runtime — `docker compose`'s
# `environment:` block never reaches them (that only affects nginx's own
# process below, at container start, long after this build already ran).
# Override via `docker build --build-arg VITE_API_URL=...` or compose's
# `build.args:` to target a real deployment; defaults to localhost for
# `docker compose up` local development. Not secrets — this is a
# client-side SPA build, so these end up in the shipped JS bundle
# regardless (see client/.env.production, which contains only a public API URL).
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_API_ORIGIN=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
