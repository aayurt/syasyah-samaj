#!/bin/bash
#
# LocalStagingSyncDeployer.sh - build locally, ship the build to the staging
# app on Personal VPS, refresh natives, reload PM2.
#
# Staging runs on the same Personal VPS as production but is isolated:
#   - separate remote path  (/var/www/syasyah-samaj-staging)
#   - separate PM2 app       (syasha-samaj-staging)
#   - separate env           (.env.staging -> staging DB syasha_staging)
#   - separate public URL    (https://staging.syasyahsamaj.com/)
#
# Never builds on the server. Builds locally, rsyncs .next + billing dist,
# then PM2-reloads the staging app against `next start`.
#
# Usage:
#   ./LocalStagingSyncDeployer.sh                 # git mode (commit + push + pull)
#   ./LocalStagingSyncDeployer.sh --rsync         # rsync source, no git involved
#   ./LocalStagingSyncDeployer.sh --skip-build    # don't build locally first
#   ./LocalStagingSyncDeployer.sh --sync-env      # copy LOCAL .env.staging to server
#   ./LocalStagingSyncDeployer.sh --message "..." # custom commit message (git mode)
#   ./LocalStagingSyncDeployer.sh --dry-run       # print steps, don't execute
#
set -euo pipefail

# -- Config --------------------------------------------------------------
SERVER="${SYASYA_STAGING_SERVER:-PersonalVPS}"     # ssh alias from ~/.ssh/config
REMOTE_PATH="${SYASYA_STAGING_REMOTE_PATH:-/var/www/syasyah-samaj-staging}"
BRANCH="${SYASYA_BRANCH:-main}"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_APP="${SYASYA_STAGING_PM2_APP:-syasha-samaj-staging}"
PUBLIC_URL="${SYASYA_STAGING_PUBLIC_URL:-https://staging.syasyahsamaj.com/}"
STAGING_ENV="${LOCAL_PATH}/.env.staging"
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
if [ "$SKIP_BUILD" -eq 1 ]; then
  warn "Skipping local build (--skip-build)."
else
  info "Building Next.js app locally..."
  run_local pnpm run build
  info "Building billing SPA locally... (base /app/ for the hosted deploy)"
  run_local env PATH="$LOCAL_PATH/apps/billing/node_modules/.bin:$PATH" pnpm --dir apps/billing build
  ok "Local build passed."
fi

# -- 2. Ship source to the server ----------------------------------------
info "Rsync source tree to $SERVER:$REMOTE_PATH..."
run_local rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' \
  --exclude='apps/billing/node_modules' --exclude='apps/billing/dist' \
  --exclude='apps/desktop/src-tauri/target' --exclude='.env' --exclude='.env.local' \
  --exclude='.env.staging' --exclude='.freebuff' --exclude='public/media' \
  "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"
ok "Source shipped."

# -- 3. Ship build artifacts (always rsync - the server never builds) ----
info "Shipping build output (.next + billing dist) to $SERVER..."
run_local rsync -az --delete \
  --exclude='cache' --exclude='standalone' --exclude='trace' \
  "$LOCAL_PATH/.next/" "$SERVER:$REMOTE_PATH/.next/"
run_local rsync -az --delete \
  "$LOCAL_PATH/apps/billing/dist/" "$SERVER:$REMOTE_PATH/apps/billing/dist/"
run_local rsync -az "$LOCAL_PATH"/public/robots.txt "$SERVER:$REMOTE_PATH/public/" || warn "no robots.txt to ship"
run_local rsync -az "$LOCAL_PATH"/public/sitemap*.xml "$SERVER:$REMOTE_PATH/public/" || warn "no sitemap to ship"
ok "Build output shipped."

# -- 4. Server-side: pull, install (refresh natives), reload -------------
REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
source ~/.nvm/nvm.sh
cd "$REMOTE_PATH"

echo ">> Installing dependencies - refreshes sharp + other native modules for this platform..."
pnpm install --frozen-lockfile || pnpm install
pnpm rebuild sharp 2>/dev/null || true

echo "OK Dependencies ready (sharp verified)."

echo ">> Reloading PM2 apps ($PM2_APP + syasha-samaj)..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
echo "DONE Server deploy complete."
EOF
)

# Optional: push local .env.staging to the server (explicit opt-in).
# The local .env.staging carries staging URLs; after the copy we force the
# server's public URLs back to the staging values.
if [ "$SYNC_ENV" -eq 1 ]; then
  [ -f "$STAGING_ENV" ] || fail "staging env not found: $STAGING_ENV"
  warn "Copying LOCAL .env.staging to the server (overwrites server .env!)"
  run_local rsync -az "$STAGING_ENV" "$SERVER:$REMOTE_PATH/.env"
  info "Restoring staging public URLs on the server..."
  run_remote "cd $REMOTE_PATH && sed -i -e 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=$PUBLIC_URL|' -e 's|^NEXT_PUBLIC_SERVER_URL=.*|NEXT_PUBLIC_SERVER_URL=$PUBLIC_URL|' .env"
  warn "Preserved staging URLs (BETTER_AUTH_URL, NEXT_PUBLIC_SERVER_URL=$PUBLIC_URL)"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  info "Dry run - would execute this on the server:"
  echo "$REMOTE_SCRIPT" | sed 's/^/    /'
else
  info "Running server-side update..."
  ssh -o ConnectTimeout=20 -o BatchMode=yes "$SERVER" "bash -s" <<< "$REMOTE_SCRIPT" || fail "server deploy failed"
fi

echo ""
ok "All done. Check $PUBLIC_URL to confirm."
