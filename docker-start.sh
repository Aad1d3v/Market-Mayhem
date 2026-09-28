#!/bin/sh
set -e

# Resolve DATABASE_URL from Render internal, external, or generic env vars
export DATABASE_URL="${DATABASE_URL:-${INTERNAL_DATABASE_URL:-$POSTGRES_URL}}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ [Fatal] DATABASE_URL is not set." >&2
  echo "Prisma cannot connect to PostgreSQL without DATABASE_URL." >&2
  echo "If deploying via Render Blueprint: ensure the database is defined and linked in render.yaml." >&2
  echo "If deploying as a standalone Web Service: go to Render Dashboard -> Web Service -> Environment -> add DATABASE_URL (Internal Connection String)." >&2
  exit 1
fi

echo "✅ DATABASE_URL is available."

# On Render's free tier the database can take a minute to accept connections
# on first deploy. Without this wait, the container crashes before the DB is
# ready and Render has to rely on its (limited) automatic restarts.
echo "⏳ Waiting for PostgreSQL to accept connections..."
i=0
while [ $i -lt 30 ]; do
  if echo "SELECT 1;" | npx prisma db execute --schema prisma/schema.postgres.prisma --stdin >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready."
    break
  fi
  i=$((i + 1))
  echo "   not ready yet (attempt $i/30), retrying in 5s..."
  sleep 5
done

if [ $i -eq 30 ]; then
  echo "❌ [Fatal] PostgreSQL did not become ready in 150 seconds." >&2
  exit 1
fi

# Push Prisma schema to Postgres (skip generate because client was generated at build time)
echo "📦 Applying database schema to PostgreSQL..."
npx prisma db push --schema prisma/schema.postgres.prisma --skip-generate

# Seed the database (idempotent: admin, listings, achievements, lessons, events)
echo "🌱 Running database seed..."
npx tsx prisma/seed.ts

# Start the Express server
echo "🚀 Starting AadiInvest server on 0.0.0.0:${PORT:-4000}..."
exec npx tsx server/src/index.ts
