# ── Build Stage ────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Build deps for sharp (image optimization)
RUN apk add --no-cache python3 make g++ vips-dev

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install deps with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune devDependencies for production
RUN npm prune --omit=dev

# ── Production Stage ───────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Nginx + utilities + vips (sharp runtime) + fonts
RUN apk add --no-cache nginx libcap curl vips-dev font-dejavu

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx && chown -R nginx:nginx /var/cache/nginx

# Copy build artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Copy public assets if they exist
COPY --from=build /app/public ./public

# Nginx config
COPY --chown=root:nginx nginx.conf /etc/nginx/http.d/default.conf

# Create non-root user for Astro
RUN addgroup -S astro && adduser -S astro -G astro && \
    chown -R nginx:nginx /var/lib/nginx /var/log/nginx /run /etc/nginx && \
    setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx

EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/api/health || exit 1

# Startup script: Astro (non-root) + Nginx (foreground)
RUN printf '%s\n' \
    '#!/bin/sh' \
    '# Start Astro as non-root user' \
    'su -s /bin/sh astro -c "HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs &"' \
    '' \
    '# Cache warmup: hit brand homepages after startup' \
    'sleep 5' \
    'for path in / /meliponas/ /cafe/ /tierras/ /naturaleza/ /gestion/; do' \
    '  wget -qO /dev/null "http://127.0.0.1:4321${path}" 2>/dev/null || true' \
    'done &' \
    '' \
    '# Start Nginx in foreground' \
    'exec nginx -g "daemon off;"' \
    > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
