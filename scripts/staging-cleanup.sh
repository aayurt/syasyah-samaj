#!/usr/bin/env bash
# staging-cleanup.sh — wipe all data from the staging database for fresh cleanup.
#
# Reads DATABASE_URI from .env.staging (or env var). Connects to the staging
# Postgres and deletes every transactional + master row, leaving an empty
-- schema ready for re-seeding with billing-seed.mjs or seed-accounting.sql.
#
# Usage:
#   DATABASE_URI=postgresql://... ./scripts/staging-cleanup.sh
#   # or, using the staged env file:
#   DATABASE_URI=$(grep '^DATABASE_URI=' .env.staging | cut -d= -f2-) ./scripts/staging-cleanup.sh
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$REPO_DIR/scripts/staging-cleanup.sql"

DATABASE_URI="${DATABASE_URI:-}"

if [ -z "$DATABASE_URI" ]; then
  if [ -f "$REPO_DIR/.env.staging" ]; then
    DATABASE_URI=$(grep '^DATABASE_URI=' "$REPO_DIR/.env.staging" | cut -d= -f2-)
  fi
fi

if [ -z "$DATABASE_URI" ]; then
  echo "ERROR: DATABASE_URI not set. Export it or create .env.staging with DATABASE_URI."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found. Install postgresql-client."
  exit 1
fi

echo "==> Connecting to staging database …"

# Mask password in echo
MASKED=$(echo "$DATABASE_URI" | sed 's/:[^:@]*@/:***@/')
echo "    $MASKED"

# Extract password from postgresql://user:pass@host:port/db for PGPASSWORD
DB_PASSWORD=$(echo "$DATABASE_URI" | sed -n 's/.*:\(.*\)@.*/\1/p')

echo "==> Running staging cleanup …"
PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URI" -f "$SQL_FILE"

echo "==> Staging cleanup complete. Database is empty and ready for re-seeding."
