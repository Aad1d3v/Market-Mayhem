#!/bin/sh
set -e

# ------------------------------------------------------------------------------
# Runtime entrypoint. The container is configuration-free by design:
#   - DATABASE_URL is injected by the platform (Render blueprint links the
#     managed Postgres automatically; INTERNAL_DATABASE_URL also works).
#   - PORT is injected by the platform.
# No connection strings, passwords, or ports are hardcoded in the repo.
# ------------------------------------------------------------------------------

export DATABASE_URL="${DATABASE_URL:-${INTERNAL_DATABASE_URL:-$POSTGRES_URL}}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ [Fatal] DATABASE_URL is not set." >&2
  echo "" >&2
  echo "The app expects the platform to inject it. To fix:" >&2
  echo "" >&2
  echo "  • Render Blueprint (render.yaml): the database is defined there and" >&2
  echo "    DATABASE_URL is wired automatically. If you deployed a plain Web" >&2
  echo "    Service instead, render.yaml is IGNORED — that is the likely cause." >&2
  echo "    Redeploy as: Render Dashboard → New → Blueprint → this repo." >&2
  echo "" >&2
  echo "  • Plain Web Service: Dashboard → your service → Environment →" >&2
  echo "    add DATABASE_URL = (the database's Internal Connection String," >&2
  echo "    visible on the database's Connect page)." >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgres://*|postgresql://*) : ;; # fine
  *)
    echo "❌ [Fatal] DATABASE_URL must start with postgres:// or postgresql://." >&2
    echo "   Got a URL with a different scheme — pointing Prisma at the wrong" >&2
    echo "   database type will fail at runtime." >&2
    exit 1
    ;;
esac

# ------------------------------------------------------------------------------
# Pick the PostgreSQL schema automatically: when DATABASE_URL points at
# Postgres (always true on Render), use prisma/schema.postgres.prisma.
# ------------------------------------------------------------------------------
SCHEMA=prisma/schema.prisma
case "$DATABASE_URL" in
  postgres://*|postgresql://*) SCHEMA=prisma/schema.postgres.prisma ;;
esac

echo "✅ DATABASE_URL is set (values are never logged)."
echo "🗄️  Using Prisma schema: $SCHEMA"

# On Render's free tier the database can take a minute to accept connections
# on first deploy. Without this wait, the container crashes before the DB is
# ready and Render has to rely on its (limited) automatic restarts.
echo "⏳ Waiting for PostgreSQL to accept connections..."
i=0
while [ $i -lt 30 ]; do
  if echo "SELECT 1;" | npx prisma db execute --schema "$SCHEMA" --stdin >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready."
    break
  fi
  i=$((i + 1))
  echo "   not ready yet (attempt $i/30), retrying in 5s..."
  sleep 5
done

if [ $i -eq 30 ]; then
  echo "❌ [Fatal] PostgreSQL did not become ready in 150 seconds." >&2
  echo "   Check that the database exists, is in the same region as the web" >&2
  echo "   service, and that DATABASE_URL is its Internal Connection String." >&2
  exit 1
fi

# Push Prisma schema to Postgres (skip generate because client was generated at build time)
echo "📦 Applying database schema to PostgreSQL..."
npx prisma db push --schema "$SCHEMA" --skip-generate

# Seed the database (idempotent: admin, achievements, lessons, events).
# Requires ADMIN_EMAIL/ADMIN_PASSWORD in production — no silent defaults.
echo "🌱 Running database seed..."
npx tsx prisma/seed.ts

# Start the Express server (PORT is injected by the platform).
echo "🚀 Starting Market Mayhem server on 0.0.0.0:${PORT:-4000}..."
exec npx tsx server/src/index.ts
