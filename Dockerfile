# --- Stage 1: Base Image ---
FROM node:20-alpine AS base

# Install libc6-compat for compatible native modules (like SWC compiler)
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Stage 2: Install Dependencies ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# --- Stage 3: Build the Application ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Perform the build
RUN npm run build

# --- Stage 4: Runner Image ---
FROM base AS runner
WORKDIR /app

# Set production environment and disable telemetry at runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root system user and group for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Pre-create Next.js directory and set correct permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build artifacts with correct owner permissions
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose Next.js port
EXPOSE 3000

# Cloud Run dynamic PORT support
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the standalone Node.js server
CMD ["node", "server.js"]
