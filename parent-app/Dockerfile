################################################################################
# Monto Parent App — Docker Image (Linux)
# Multi-stage build: build → runtime (minimal)
################################################################################

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Build args become env vars at build time so Next.js can inline them
ARG NEXT_PUBLIC_ASTERISK_WS_URL=ws://localhost:8088/ws
ARG NEXT_PUBLIC_SIP_USERNAME=parent
ARG NEXT_PUBLIC_SIP_PASSWORD=parentpass123
ARG NEXT_PUBLIC_SIP_DOMAIN=localhost
ARG NEXT_PUBLIC_MONTO_BOX_EXTENSION=monto
ARG NEXT_PUBLIC_MONTO_API_URL=http://localhost:8000

ENV NEXT_PUBLIC_ASTERISK_WS_URL=$NEXT_PUBLIC_ASTERISK_WS_URL
ENV NEXT_PUBLIC_SIP_USERNAME=$NEXT_PUBLIC_SIP_USERNAME
ENV NEXT_PUBLIC_SIP_PASSWORD=$NEXT_PUBLIC_SIP_PASSWORD
ENV NEXT_PUBLIC_SIP_DOMAIN=$NEXT_PUBLIC_SIP_DOMAIN
ENV NEXT_PUBLIC_MONTO_BOX_EXTENSION=$NEXT_PUBLIC_MONTO_BOX_EXTENSION
ENV NEXT_PUBLIC_MONTO_API_URL=$NEXT_PUBLIC_MONTO_API_URL

RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public*  ./public/  2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs
EXPOSE 3001

CMD ["node", "server.js"]
