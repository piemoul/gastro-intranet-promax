FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run lint && npm run typecheck && npm test && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    INTRANET_DATA_DIR=/app/.data
RUN groupadd --system --gid 1001 intranet \
    && useradd --system --uid 1001 --gid intranet intranet \
    && mkdir -p /app/.data \
    && chown intranet:intranet /app/.data
COPY --from=builder --chown=intranet:intranet /app/.next/standalone ./
COPY --from=builder --chown=intranet:intranet /app/.next/static ./.next/static
COPY --from=builder --chown=intranet:intranet /app/public ./public
USER intranet
EXPOSE 3100
CMD ["node", "server.js"]
