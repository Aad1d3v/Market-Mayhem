# ==============================================================================
# AadiInvest — production image (single container: API + built React client)
#
# Build:  docker build -t aadiinvest .
# Run:    docker run -p 4000:4000 --env-file .env aadiinvest
#
# On Render: create a Web Service pointing at this repo — Render detects the
# Dockerfile automatically (or deploy the render.yaml blueprint instead).
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
ENV PORT=4000

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

EXPOSE 4000

CMD ["./docker-start.sh"]
