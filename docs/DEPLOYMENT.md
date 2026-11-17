# Deployment & DevOps — syasyah-samaj

Production: <https://syasyahsamaj.com/> (Cloudflare → VPS `PersonalVPS`, PM2 app `syasha-samaj`, port 8085).

The golden rule: **the VPS never builds**. It is too small to run `next build` (sshd stops answering until the build finishes). We build locally, ship the build output, refresh native modules on the server with `pnpm install`, then reload PM2. `LocalSyncDeployer.sh` automates this.

## Prerequisites

| Item | Value |
| --- | --- |
| SSH alias | `PersonalVPS` (from `~/.ssh/config`) |
| Remote repo | `/var/www/syasyah-samaj` |
| Branch | `main` |
| PM2 apps | `syasha-samaj` (prod, :8085), `syasha-samaj-staging` (staging, :8086) |
| Public URL | `https://syasyahsamaj.com/` |
| Local tools | `pnpm`, `git`, `rsync`, `ssh` |

All of these are overridable without editing the script:

```bash
SYASYA_SERVER=PersonalVPS \
SYASYA_REMOTE_PATH=/var/www/syasyah-samaj \
SYASYA_BRANCH=main \
SYASYA_PM2_APP=syasha-samaj \
SYASYA_PUBLIC_URL=https://syasyahsamaj.com/ \
NODE_OPTIONS_BUILD=--max_old_space_size=3072 \
./LocalSyncDeployer.sh
```

## Standard deploy

```bash
# 1. Always dry-run first when changing the script/config
./LocalSyncDeployer.sh --dry-run

# 2. Real deploy (default message: "deploy: YYYY-MM-DD HH:MM")
./LocalSyncDeployer.sh --message="fix: describe the change"
```

What it does, in order:

1. **Local build** — `pnpm run build` (Next.js; also runs `postbuild` → `next-sitemap`) and `pnpm --dir apps/billing build` (Vite SPA, base `/app/`). The build ID is `git short SHA + timestamp`, exposed via `version.json` for client reload prompts.
2. **Ship source** — in git mode (default): `git add -A`, commit, `git push origin main`. In `--rsync` mode: `rsync -az --delete` of the source tree (excludes `.git`, `node_modules`, `.next`, `apps/billing/dist`, `.env`, media, Tauri target).
3. **Ship build artifacts** — `rsync -az --delete` of `.next/` (excludes `cache`, `standalone`, `trace`) and `apps/billing/dist/` into the same paths on the server. Also ships `public/robots.txt` and `public/sitemap*.xml`.
4. **Server update** — `git fetch` + `git checkout main` + `git pull --ff-only` (fallback `git reset --hard origin/main`), then `pnpm install --frozen-lockfile` (fallback `pnpm install`) and `pnpm rebuild sharp`.
5. **Reload** — `pm2 reload ecosystem.config.cjs --update-env` (reloads **both** prod and staging) followed by `pm2 save`.

### Flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Print the local commands and the server script; execute nothing. |
| `--message="..."` | Custom commit message for git mode. |
| `--skip-build` | Skip both local builds — use when shipping a source-only change whose build output is already current. |
| `--rsync` | Skip git entirely; rsync source to the server. Useful when the working tree has unrelated uncommitted work. |
| `--sync-env` | Copy local `.env` to the server and force `BETTER_AUTH_URL` / `NEXT_PUBLIC_SERVER_URL` back to the prod URL. **Overwrites prod config** — only use deliberately. |

⚠️ **Watch out for `git add -A`.** In git mode the script commits *everything* in the working tree, including unrelated uncommitted edits from parallel agents. Check `git status --short` first. If there is work you don't own, use the surgical SPA-only deploy below, or `--rsync`, or commit your change yourself and use `--skip-build`.

## Surgical deploys

### SPA-only fix (billing UI, no backend change)

The hosted app serves `apps/billing/dist` via `src/app/app/[...path]/route.ts`. A change confined to `apps/billing/src` only needs the rebuilt SPA shipped — no `.next` rebuild, no dependency install:

```bash
# Commit just your files, then push (never git add -A here)
git add apps/billing/src/pages/AuditLog.tsx
git commit -m "fix(api): leading slash on audit endpoint"
git push origin main

# Ship the built SPA and reload prod only
rsync -az --delete apps/billing/dist/ \
  PersonalVPS:/var/www/syasyah-samaj/apps/billing/dist/
ssh PersonalVPS 'cd /var/www/syasyah-samaj && git pull --ff-only origin main && pm2 reload syasha-samaj --update-env && pm2 save'
```

Rebuild the SPA first if the source changed: `pnpm --dir apps/billing build`. If an unrelated source edit appeared after your build, **do not rebuild** — the existing `dist` may be exactly the clean artifact you want. Verify with:

```bash
node -e "const fs=require('fs');const f=fs.readdirSync('apps/billing/dist/assets').find(x=>x.startsWith('index-')&&x.endsWith('.js'));console.log(fs.readFileSync('apps/billing/dist/assets/'+f,'utf8').includes('/audit-logs'))"
```

### Backend/source-only change with an already-current build

```bash
./LocalSyncDeployer.sh --skip-build --message="fix: backend change"
```

## Database migrations

Schema changes must have a migration in `src/migrations/`, registered in `src/migrations/index.ts`. Naming: `YYYYMMDD_HHMMSS_description.ts` with `up`/`down` exports using `sql` from `@payloadcms/db-postgres`. Dev picks up collection field changes via Payload push; **deployed DBs do not** — a missing migration causes runtime errors like `column "level" does not exist`.

On the server, after deploying the migration files:

```bash
ssh PersonalVPS 'cd /var/www/syasyah-samaj && source ~/.nvm/nvm.sh && pnpm payload migrate'
```

If the column already exists (e.g. an emergency manual fix) but the migration is not recorded, insert bookkeeping so it never re-runs — use `MAX(batch) + 1`:

```sql
ALTER TABLE "account_groups" ADD COLUMN IF NOT EXISTS "level" numeric DEFAULT 0;
INSERT INTO payload_migrations (name, batch, updated_at, created_at)
SELECT '20261117_120000_account_groups_level', 12, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM payload_migrations WHERE name = '20261117_120000_account_groups_level'
);
SELECT MAX(batch) FROM payload_migrations;  -- check first; use MAX+1
```

Real incident: `account_groups.level` was added to the collection in `f76d1937` without a migration. Prod P&L failed on `select ... "level" ... from "account_groups" where id in (...)`. Fixed by adding the column + migration row; `20261117_120000_account_groups_level` now carries the bookkeeping.

## Native modules & platform drift

- Local dev is macOS/arm64 with a newer Node; the VPS is linux/x64 on Node 18.19.1. **Never rsync `node_modules` across platforms.**
- `sharp` is pinned to `^0.33.0` in `package.json` (supports Node ^18.17.0). The server-side `pnpm install` builds the correct linux-x64 binding. A darwin binary shipped by mistake makes every PATCH return `500 HTML`; healthy state is `403 JSON` (auth required) instead.
- The deploy log prints `WARN Unsupported engine ... wanted node ^18.20.2 || >=20.9.0 (current v18.19.1)` — expected on the VPS; not a failure.

## Verification checklist

After any deploy:

```bash
# Process health
ssh PersonalVPS 'pm2 list | grep syasha; pm2 logs syasha-samaj --lines 30 --nostream | grep -i error'

# HTTP smoke (use a valid session cookie for authenticated endpoints)
curl -s -o /dev/null -w 'home %{http_code}\n' https://syasyahsamaj.com/
curl -s -o /dev/null -w 'app  %{http_code}\n' https://syasyahsamaj.com/app
curl -s -o /dev/null -w 'pnl  %{http_code}\n' https://syasyahsamaj.com/app/reports/pnl
curl -s -o /dev/null -w 'audit %{http_code}\n' https://syasyahsamaj.com/app/audit

# Authenticated API smoke
curl -s -b '...session cookie...' 'https://syasyahsamaj.com/api/account-groups?limit=1&depth=0'
curl -s -b '...session cookie...' 'https://syasyahsamaj.com/api/audit-logs?depth=0&limit=5'
```

Triage rules that have bitten us before:

- `{"error":"Unauthorized"}` after login → check whether `/app` is serving a stale `apps/billing/dist` (sign-out logic and access gates live in the SPA bundle).
- `403` on collection reads → viewer users need a `tenants` mapping (or singular `tenant`) for `tenantScoped.ts` to resolve scope.
- `404` on a path like `/apiaudit-logs` → a caller passed `'audit-logs'` instead of `'/audit-logs'` to `api()`; `doFetch` builds `${API_BASE}/api${path}` and does not insert the slash. **Always pass a leading slash.**

## Rollback

```bash
# See what's deployed
ssh PersonalVPS 'cd /var/www/syasyah-samaj && git log --oneline -5'

# Point the server at a known-good commit, reload, and verify
ssh PersonalVPS 'cd /var/www/syasyah-samaj && git checkout <sha> && pm2 reload syasha-samaj --update-env && pm2 save'

# Also roll back main locally/origin if the bad commit should not stay
git revert <sha> && git push origin main
```

Because build artifacts are rsynced separately from git, a source-only checkout does **not** restore an older SPA or `.next` build. To fully roll back a shipped build, restore the previous `apps/billing/dist` (and/or `.next`) from a backup or rebuild from the reverted commit and re-run the deploy.

## Known gaps

- The prod DB is older than local; 34 payroll-related tables (`payroll_runs`, `payroll_slips`, `salary_structures`, `loans`, etc.) exist locally but not on prod. A proper migration pass is needed before those features are used live.
- Worktree git metadata written inside containers uses container-relative paths; host-side `git` may report them as prunable even though container-side git is fine.
- The Vite dev server logs `@fontsource/inter` "outside of Vite serving allow list" warnings; pre-existing and unrelated to deploys.
