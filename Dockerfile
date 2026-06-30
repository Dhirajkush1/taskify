# ============================================================
# Taskify / Clutch AI — Production Dockerfile
# M1/M2 Mac compatible — targets linux/amd64 for Cloud Run
# ============================================================

# IMPORTANT: All FROM statements explicitly target linux/amd64.
# This ensures the image runs on Cloud Run (x86) even when
# built on Apple Silicon (M1/M2/M3 arm64) Macs.

# --- Stage 1: Base ---
FROM --platform=linux/amd64 node:20-alpine AS base

# libc6-compat: required for Next.js SWC compiler on Alpine
# curl: required for HEALTHCHECK
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# ============================================================
# --- Stage 2: Install Dependencies ---
# Cached separately so code changes don't reinstall packages.
# ============================================================
FROM --platform=linux/amd64 base AS deps

COPY package.json package-lock.json* ./

# --legacy-peer-deps: required for React 19 peer dependency compatibility
RUN npm ci --legacy-peer-deps

# ============================================================
# --- Stage 3: Build ---
# Compiles Next.js into a standalone output bundle.
# NEXT_PUBLIC_* vars are baked into the client JS at build time —
# they MUST be passed as build args here.
# ============================================================
FROM --platform=linux/amd64 base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── Build-time environment variables ──────────────────────────
# Pass actual values via --build-arg in your CI/CD pipeline:
#   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://...
# ──────────────────────────────────────────────────────────────
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Disable Next.js anonymous telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================================
# --- Stage 4: Runner (Final Production Image) ---
# Only copies what is strictly needed to run the server.
# ============================================================
FROM --platform=linux/amd64 base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Dynamic port support (Cloud Run, Railway, Fly.io)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ── Security: non-root user ───────────────────────────────────
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Pre-create .next dir with correct permissions
RUN mkdir -p .next && chown nextjs:nodejs .next

# ── Copy standalone server bundle ────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# ── Switch to non-root user ───────────────────────────────────
USER nextjs

# ── Expose port ───────────────────────────────────────────────
EXPOSE 3000

# ── Health Check ──────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# ── Start Next.js standalone server ──────────────────────────
CMD ["node", "server.js"]
