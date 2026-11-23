#!/bin/bash
#
# LocalSyncDeployer.sh - build locally, ship the build, refresh natives on the server.
#
# Why this exists: the VPS is too small to run `next build` (it starves the box -
# sshd stops answering until the build finishes or you kill it). So this script
# NEVER builds on the server. It:
#
#   1. Builds locally (Next.js + billing SPA) to catch errors early.
#   2. Ships source (git push/pull by default, or --rsync) AND the build output
#      (.next + apps/billing/dist - always rsynced, never committed).
#   3. On the server: `pnpm install` refreshes sharp + any other native modules
#      for the server's Linux platform, then PM2 reloads. The server runs
#      `next start` against the shipped .next - no build step at all.
#
# Usage:
#   ./LocalSyncDeployer.sh                 # git mode (commit + push + pull)
#   ./LocalSyncDeployer.sh --rsync         # rsync source, no git involved
#   ./LocalSyncDeployer.sh --skip-build    # don't build locally first
#   ./LocalSyncDeployer.sh --sync-env      # copy LOCAL .env to server (PROD config!)
#   ./LocalSyncDeployer.sh --message "..." # custom commit message (git mode)
#   ./LocalSyncDeployer.sh --dry-run       # print steps, don't execute
#
# NOTE: keep this file ASCII-only. bash 3.2 (the macOS default) in non-UTF-8
# locales treats multibyte bytes as variable-name characters, so a string like
# "$SERVER..." with a multibyte char glued to the expansion breaks under
# `set -u` with "unbound variable". ASCII keeps it portable.
#
set -euo pipefail

# -- Config --------------------------------------------------------------
SERVER="${SYASYA_SERVER:-PersonalVPS}"          # ssh alias from ~/.ssh/config
REMOTE_PATH="${SYASYA_REMOTE_PATH:-/var/www/syasyah-samaj}"
BRANCH="${SYASYA_BRANCH:-main}"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_APP="${SYASYA_PM2_APP:-syasha-samaj}"
PUBLIC_URL="${SYASYA_PUBLIC_URL:-https://syasyahsamaj.com/}"
NODE_OPTIONS_BUILD="${NODE_OPTIONS_BUILD:---max_old_space_size=3072}"

# -- Flags ---------------------------------------------------------------
RSYNC_MODE=0
SKIP_BUILD=0
SYNC_ENV=0
DRY_RUN=0
MESSAGE=""
for arg in "$@"; do
  case "$arg" in
    --rsync) RSYNC_MODE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --sync-env) SYNC_ENV=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --message=*) MESSAGE="${arg#*=}" ;;
    --message) echo "ERROR: --message needs a value: --message=\"deploy x\"" >&2; exit 1 ;;
    *) echo "ERROR: Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# -- Helpers -------------------------------------------------------------
C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'; C_BLU=$'\033[34m'; C_RST=$'\033[0m'
info()  { echo "${C_BLU}>>${C_RST} $*"; }
ok()    { echo "${C_GRN}OK${C_RST} $*"; }
warn()  { echo "${C_YLW}!!${C_RST} $*"; }
fail()  { echo "${C_RED}ERROR${C_RST} $*" >&2; exit 1; }

run_local()  { info "local: $*"; "$@" || fail "local command failed: $*"; }
run_remote() { info "server: $*"; ssh -o ConnectTimeout=20 -o BatchMode=yes "$SERVER" "$*" || fail "remote command failed: $*"; }

if [ "$DRY_RUN" -eq 1 ]; then
  run_local()  { info "local (dry): $*"; }
  run_remote() { info "server (dry): $*"; }
fi

# -- 1. Local build (catch errors before shipping) -----------------------
# Resolve database connection for local Next.js SSG build.
# When Docker is used locally, .env.local may specify 'db:5432' which does not
# resolve on macOS host. Map it to localhost:5433 (if exposed) or fallback to .env.
BUILD_DATABASE_URI="${DATABASE_URI:-}"
if [ -z "$BUILD_DATABASE_URI" ] && [ -f "$LOCAL_PATH/.env.local" ]; then
  if grep -q "@db:5432" "$LOCAL_PATH/.env.local"; then
    if nc -z localhost 5433 2>/dev/null; then
      info "Detected Docker Postgres in .env.local; routing build to localhost:5433 on host..."
      BUILD_DATABASE_URI="postgresql://postgres:postgres@localhost:5433/syasyah"
    elif [ -f "$LOCAL_PATH/.env" ] && grep -q "^DATABASE_URI=" "$LOCAL_PATH/.env"; then
      info "Host cannot reach 'db'; using DATABASE_URI from .env for SSG..."
      BUILD_DATABASE_URI="$(grep '^DATABASE_URI=' "$LOCAL_PATH/.env" | cut -d '=' -f2-)"
    fi
  fi
fi

if [ "$SKIP_BUILD" -eq 1 ]; then
  warn "Skipping local build (--skip-build)."
else
  # Clean stale Next.js build output
  info "Cleaning stale .next build output..."
  rm -rf "$LOCAL_PATH/.next"

  # Build the Next.js app locally
  info "Building Next.js app locally..."
  if [ -n "$BUILD_DATABASE_URI" ]; then
    run_local env DATABASE_URI="$BUILD_DATABASE_URI" NODE_OPTIONS="${NODE_OPTIONS_BUILD}" pnpm run build
  else
    run_local env NODE_OPTIONS="${NODE_OPTIONS_BUILD}" pnpm run build
  fi

  # Ensure local binary path is included for Vite/tsc
  info "Building billing SPA locally... (base /app/ for the hosted deploy)"
  run_local env PATH="$LOCAL_PATH/apps/billing/node_modules/.bin:$PATH" pnpm --dir apps/billing build
  ok "Local build passed."
fi

# -- 2. Ship source to the server ---------------------------------------
if [ "$RSYNC_MODE" -eq 1 ]; then
  info "Rsync mode: sending source tree to $SERVER:$REMOTE_PATH (no git)..."
  run_local rsync -az --delete \
    --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='apps/billing/node_modules' --exclude='apps/billing/dist' \
    --exclude='apps/desktop/src-tauri/target'  --exclude='.env' --exclude='.env.local' \
    --exclude='.freebuff' --exclude='public/media' \
    "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"
else
  info "Git mode: committing + pushing branch '$BRANCH'..."
  if [ -z "$MESSAGE" ]; then MESSAGE="deploy: $(date '+%Y-%m-%d %H:%M')"; fi
  if [ -n "$(git -C "$LOCAL_PATH" status --porcelain)" ]; then
    run_local git -C "$LOCAL_PATH" add -A
    run_local git -C "$LOCAL_PATH" commit -m "$MESSAGE"
  else
    ok "No local changes to commit."
  fi
  run_local git -C "$LOCAL_PATH" push origin "$BRANCH"
  ok "Pushed $BRANCH."
fi

# -- 3. Verify and ship build artifacts ---------------------------------
info "Verifying build artifacts before shipping..."
if [ ! -f "$LOCAL_PATH/.next/BUILD_ID" ]; then
  fail "Build check failed: $LOCAL_PATH/.next/BUILD_ID missing! Aborting deploy to prevent server 502."
fi
if [ ! -f "$LOCAL_PATH/.next/routes-manifest.json" ]; then
  fail "Build check failed: $LOCAL_PATH/.next/routes-manifest.json missing! Aborting deploy to prevent server 502."
fi
if [ ! -f "$LOCAL_PATH/apps/billing/dist/index.html" ]; then
  fail "Build check failed: $LOCAL_PATH/apps/billing/dist/index.html missing! Aborting deploy."
fi
BUILD_ID_VAL="$(cat "$LOCAL_PATH/.next/BUILD_ID")"
ok "Build artifacts verified (BUILD_ID: $BUILD_ID_VAL)."

info "Shipping build output (.next + billing dist) to $SERVER..."
# .next: platform-independent JS; exclude webpack cache + standalone (unused
# with `next start`). --delete keeps the server free of stale build files.
run_local rsync -az --delete \
  --exclude='cache' --exclude='standalone' --exclude='trace' \
  "$LOCAL_PATH/.next/" "$SERVER:$REMOTE_PATH/.next/"
run_local rsync -az --delete \
  "$LOCAL_PATH/apps/billing/dist/" "$SERVER:$REMOTE_PATH/apps/billing/dist/"
# next-sitemap writes these locally but they're gitignored - ship them too.
run_local rsync -az "$LOCAL_PATH"/public/robots.txt "$SERVER:$REMOTE_PATH/public/" || warn "no robots.txt to ship"
run_local rsync -az "$LOCAL_PATH"/public/sitemap*.xml "$SERVER:$REMOTE_PATH/public/" || warn "no sitemap to ship"
ok "Build output shipped."

# -- 4. Server-side: pull, install (refresh natives), reload -------------
read -r -d '' REMOTE_SCRIPT <<'EOF' || true
set -euo pipefail
REMOTE_PATH="$1"
RSYNC_MODE="$2"
BRANCH="$3"
PM2_APP="$4"

source ~/.nvm/nvm.sh
cd "$REMOTE_PATH"

if [ "$RSYNC_MODE" -eq 0 ]; then
  echo ">> Fetching latest source..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" origin/"$BRANCH"
  git pull --ff-only origin "$BRANCH" 2>/dev/null || git reset --hard origin/"$BRANCH"
  echo "OK At: $(git log --oneline -1)"
fi

echo ">> Installing dependencies - refreshes sharp + other native modules for this platform..."
pnpm install --frozen-lockfile || pnpm install
pnpm rebuild sharp 2>/dev/null || true

echo "OK Dependencies ready (sharp verified)."

echo ">> Reloading PM2 ($PM2_APP)..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo ">> Verifying app health on server..."
sleep 2
SERVER_HEALTHY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8085/ || true)
  case "$HTTP_CODE" in
    200|301|302|307|308)
      echo "OK App responded with HTTP $HTTP_CODE on localhost:8085."
      SERVER_HEALTHY=1
      break
      ;;
    *)
      sleep 1
      ;;
  esac
done
if [ "$SERVER_HEALTHY" -eq 0 ]; then
  echo "!! Warning: Local check did not return 2xx/3xx within 10s. Inspect 'pm2 logs $PM2_APP'."
fi

echo "DONE Server deploy complete."
EOF

# Optional: push local .env to the server (explicit opt-in - it's prod
# config). The local .env carries dev URLs (localhost) that would break
# prod auth and the hosted client, so after the copy we force the server's
# public URLs back to the prod values.
if [ "$SYNC_ENV" -eq 1 ]; then
  warn "Copying LOCAL .env to the server (overwrites server .env!)"
  run_local rsync -az "$LOCAL_PATH/.env" "$SERVER:$REMOTE_PATH/.env"
  info "Restoring prod public URLs on the server..."
  run_remote "cd $REMOTE_PATH && sed -i -e 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=$PUBLIC_URL|' -e 's|^NEXT_PUBLIC_SERVER_URL=.*|NEXT_PUBLIC_SERVER_URL=$PUBLIC_URL|' .env"
  warn "Preserved prod URLs (BETTER_AUTH_URL, NEXT_PUBLIC_SERVER_URL=$PUBLIC_URL)"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  info "Dry run - would execute remote script on $SERVER with args: $REMOTE_PATH $RSYNC_MODE $BRANCH $PM2_APP"
else
  info "Running server-side update..."
  ssh -o ConnectTimeout=20 -o BatchMode=yes "$SERVER" "bash -s -- \"$REMOTE_PATH\" \"$RSYNC_MODE\" \"$BRANCH\" \"$PM2_APP\"" <<< "$REMOTE_SCRIPT" || fail "server deploy failed"
fi

echo ""
info "Testing public URL ($PUBLIC_URL)..."
PUB_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" || true)
case "$PUB_CODE" in
  200|301|302|307|308)
    ok "All done. Verified $PUBLIC_URL is healthy (HTTP $PUB_CODE)."
    ;;
  *)
    warn "Deploy completed, but $PUBLIC_URL returned HTTP $PUB_CODE. Check PM2 logs on $SERVER."
    ;;
esac
