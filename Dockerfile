# ==============================================================================
# Market Mayhem — production image (single container: API + built React client)
#
# The container is configuration-free: PORT and DATABASE_URL are supplied by
# the platform at runtime (Render injects both). Nothing is hardcoded here.
#
# Build:  docker build -t market-mayhem .
# Run:    PORT=4000 DATABASE_URL=postgres://... docker run -e PORT -e DATABASE_URL -p 4000:$PORT market-mayhem
#
# On Render: deploy as a Blueprint (uses render.yaml, wires DATABASE_URL from
# the managed Postgres automatically) or as a plain Web Service and add the
# environment variables in the dashboard (see LAUNCH-CHECKLIST.md).
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app
# OpenSSL and libc6-compat are required for Prisma query engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# ---------- Stage 1: install dependencies ----------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --no-audit --no-fund

# ---------- Stage 2: build client (Vite) ----------
FROM deps AS build
COPY packages/shared packages/shared
COPY client client
COPY tsconfig.base.json ./
# Build the client into client/dist
RUN npx vite build client

# ---------- Stage 3: production runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
# NOTE: no baked-in PORT — the platform injects PORT at runtime.

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY server server
COPY prisma prisma

# Pre-generate Prisma client for PostgreSQL in the container image
RUN npx prisma generate --schema prisma/schema.postgres.prisma

# Copy built frontend assets
COPY --from=build /app/client/dist client/dist

# Production entry script (verifies DATABASE_URL, waits for Postgres, pushes schema, seeds, serves)
COPY docker-start.sh ./
RUN chmod +x ./docker-start.sh

# No EXPOSE: the listen port comes from $PORT at runtime.
CMD ["./docker-start.sh"]
