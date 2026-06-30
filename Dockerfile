# ============================================================
# Taskify / Clutch AI — Production Dockerfile
# Multi-stage build for minimal, secure, production-ready image
# ============================================================

# --- Stage 1: Base ---
# Alpine Linux for smallest possible footprint
FROM node:20-alpine AS base

# libc6-compat: required for Next.js SWC compiler on Alpine
# curl: required for HEALTHCHECK
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# ============================================================
# --- Stage 2: Install Dependencies ---
# Only installs production + dev deps needed for the build.
# Cached separately so code changes don't reinstall packages.
# ============================================================
FROM base AS deps

COPY package.json package-lock.json* ./

# --legacy-peer-deps: required for React 19 peer dependency compatibility
RUN npm ci --legacy-peer-deps

# ============================================================
# --- Stage 3: Build ---
# Compiles Next.js into a standalone output bundle.
# NEXT_PUBLIC_* vars are baked into the client bundle at build time —
# they MUST be passed as build args here.
# ============================================================
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── Build-time environment variables ──────────────────────────
# NEXT_PUBLIC_* values are statically inlined into client JS.
# Pass actual values via --build-arg in your CI/CD pipeline,
# e.g.: docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://...
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
# Everything else (node_modules, source files, .git) is excluded.
# ============================================================
FROM base AS runner

WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Dynamic port support (Cloud Run, Railway, Fly.io, etc.)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ── Security: non-root user ───────────────────────────────────
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# ── Copy static public assets ─────────────────────────────────
COPY --from=builder /app/public ./public

# ── Copy standalone server bundle ────────────────────────────
# next.config.ts sets output: "standalone" which produces a
# minimal self-contained server in .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pre-create .next dir with correct permissions
RUN mkdir -p .next && chown nextjs:nodejs .next

# ── Switch to non-root user ───────────────────────────────────
USER nextjs

# ── Expose port ───────────────────────────────────────────────
EXPOSE 3000

# ── Health Check ──────────────────────────────────────────────
# Docker / Kubernetes will restart the container if the app is unhealthy.
# Checks every 30s, allows 3 failures before marking unhealthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# ── Start Next.js standalone server ──────────────────────────
CMD ["node", "server.js"]
