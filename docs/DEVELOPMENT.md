# Development Workflow — syasyah-samaj

## Prerequisites

- **Node.js**: ≥ 20 (check `.nvmrc`)
- **pnpm**: ≥ 10 (corepack enabled)
- **PostgreSQL**: 16+ (for local dev and E2E)
- **Git**: 2.40+
- **VS Code** (recommended) with extensions:
  - TypeScript Vue Plugin (for TS)
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier
  - Playwright Test for VS Code

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/aayurt/syasyah-samaj.git
cd syasyah-samaj
pnpm install

# 2. Environment
cp .env.example .env
# Edit .env with your DATABASE_URI, RESEND_API_KEY, etc.

# 3. Database
# Option A: Local Postgres
createdb syasyah_samaj
pnpm --filter @afno/billing db:push

# Option B: Docker
docker run -d --name pg -e POSTGRES_DB=syasyah_samaj -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# 4. Dev servers
# Terminal 1: Payload CMS (admin + API)
pnpm dev

# Terminal 2: Billing SPA (Vite)
cd apps/billing && pnpm dev
```

## Project Structure

```
syasyah-samaj/
├── apps/
│   └── billing/           # Vite + React SPA (main app)
│       ├── src/
│       │   ├── pages/     # Route pages (Vouchers, Members, etc.)
│       │   ├── components/# Shared UI components
│       │   ├── lib/       # Core logic (api, sync, offline, importExport)
│       │   ├── hooks/     # Custom React hooks
│       │   ├── collections/# Payload collection configs
│       │   └── ...
│       ├── e2e/           # Playwright E2E tests
│       └── ...
├── src/                   # Payload CMS collections (shared)
├── docs/                  # Architecture, ADRs, conventions
├── locales/               # i18n translations
├── .github/workflows/     # CI/CD
└── ...
```

## Common Commands

### Root (monorepo)
```bash
pnpm install              # Install all deps
pnpm build                # Build all apps
pnpm lint                 # Lint all
pnpm format               # Format translations
pnpm translate            # Auto-translate EN → NE
```

### Billing App (`apps/billing`)
```bash
pnpm dev                  # Vite dev server (port 5173)
pnpm build                # Typecheck + Vite build
pnpm preview              # Preview production build
pnpm test                 # Vitest unit/integration/component
pnpm test:watch           # Watch mode
pnpm test:ui              # Vitest UI
pnpm test:e2e             # Playwright (needs Postgres)
pnpm lint                 # ESLint
pnpm typecheck            # tsc --noEmit
```

### Payload CMS (root)
```bash
pnpm dev                  # Next.js dev (port 3000)
pnpm build                # Next.js build
pnpm start                # Production server
pnpm payload              # Payload CLI
pnpm generate:types       # Generate payload-types.ts
pnpm generate:importmap   # Generate import map
```

## Development Workflow

### 1. Create Feature Branch
```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### 2. Develop with Tests
```bash
# Write failing test first (TDD)
# Implement feature
# Run tests frequently
pnpm test -- --watch

# For E2E
E2E_DATABASE_URI=postgresql://postgres:test@localhost:5432/billing_e2e pnpm test:e2e
```

### 3. Validate with Kritikka-MCP
```bash
# Check if changes violate governance rules
npx kritikka-mcp validate-change --changed-files "apps/billing/src/pages/Vouchers.tsx"

# Full architecture validation
npx kritikka-mcp validate-architecture

# Check repository boundaries
npx kritikka-mcp check-repository-boundary --paths "apps/billing/src/lib/new-file.ts"
```

### 4. Pre-Commit Checks
```bash
pnpm lint                 # Must pass
pnpm typecheck            # Must pass
pnpm test                 # Must pass (coverage thresholds)
pnpm build                # Must pass
```

### 5. Commit
```bash
git add .
git commit -m "feat(scope): description

Longer explanation if needed

Refs: #issue-number"
```

### 6. Push & PR
```bash
git push origin feat/your-feature-name
# Open PR on GitHub
# CI runs: lint, typecheck, test, build, e2e
# Kritikka-MCP validates PR changes
```

## Debugging

### VS Code Debug Configurations

**`.vscode/launch.json`:**
```json
{
  "configurations": [
    {
      "name": "Debug Vite (Billing)",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/apps/billing",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Payload CMS",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Vitest",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/apps/billing",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test:watch"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Chrome DevTools (Vite)
- Open `http://localhost:5173`
- Cmd+Option+I → Sources → Page → webpack:// → src/
- Set breakpoints in TypeScript source

### React DevTools
- Install browser extension
- Components tab → inspect props/state
- Profiler tab → performance analysis

### Network Tab
- Filter: `api/sync` for sync traffic
- Check outbox payloads
- Verify conflict responses

### IndexedDB / SQLite Inspection
**Web (IndexedDB):**
- DevTools → Application → IndexedDB → `sync-db`
- Stores: `outbox`, `members`, `vouchers`, `sync_meta`, etc.

**Desktop (SQLite):**
```bash
# Tauri app stores DB in:
# macOS: ~/Library/Application Support/com.syasyah.samaj/
# Linux: ~/.local/share/syasyah-samaj/
# Windows: %APPDATA%/syasyah-samaj/

sqlite3 "path/to/db.sqlite" ".tables"
sqlite3 "path/to/db.sqlite" "SELECT * FROM outbox;"
```

## Common Tasks

### Add New Collection
1. Create `src/collections/NewCollection.ts` (Payload config)
2. Add to `payload.config.ts` collections array
3. Run `pnpm generate:types` → updates `payload-types.ts`
4. Create page in `apps/billing/src/pages/NewCollection.tsx`
5. Add route in `apps/billing/src/app.tsx`
6. Add dedup keys in `apps/billing/src/lib/importExport.ts` (`DEDUP_KEYS`)
7. Add import/export config in `excelImportExport.ts`
8. Write tests (unit + integration + E2E)
9. Update `docs/ARCHITECTURE.md` and ADR if needed

### Modify Existing Collection
1. Update Payload collection config
2. Run `pnpm generate:types`
3. Update dedup keys if business keys changed
4. Update import/export templates
5. Write migration if data transformation needed
6. Run tests
7. Reference ADR-0001 in PR

### Add Nepali Date Field
1. Add `dateAd` (ISO string) + `dateBs` (YYYY-MM-DD) to collection
2. Use `NepaliDateInput` component in forms
3. Update import/export to handle both formats
4. Add tests for AD/BS conversion
5. Reference ADR-0003

### Add Accounting Validation
1. Add validation in `VoucherForm` (client)
2. Add Payload `beforeChange` hook (server)
3. Add database constraint (migration)
4. Add test in `14-accounting.spec.ts`
5. Reference ADR-0005

### Debug Sync Issues
1. Open DevTools → Application → IndexedDB → `outbox` store
2. Check `lastSyncAt` in `sync_meta`
3. Check `cacheVersion` (should increment on changes)
4. Monitor Network → `api/sync` requests
4. Use `getEngine().getState()` in console for sync state

### Reset Local Data (Dev Only)
```bash
# Clear IndexedDB (in browser console)
indexedDB.deleteDatabase('sync-db')
location.reload()

# Or via SyncEngine
const engine = getEngine()
await engine.adapter.clearAll()
await engine.adapter.clearKV()
location.reload()
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URI` | Yes | Postgres connection string |
| `RESEND_API_KEY` | No | Email sending (Resend) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `PAYLOAD_SECRET` | Yes | Payload auth secret |
| `KRITI_API_KEY` | No | For kriti-mcp (different from kritikka-mcp) |
| `E2E_DATABASE_URI` | For E2E | Separate test database |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `pnpm install` fails | `rm -rf node_modules pnpm-lock.yaml && pnpm install` |
| TypeScript errors after pull | `pnpm generate:types` (Payload types updated) |
| E2E tests fail to connect | Check `E2E_DATABASE_URI`, ensure Postgres running |
| Sync not working | Check Network tab for `/api/sync`, verify `lastSyncAt` |
| Tauri build fails | `cd apps/desktop && pnpm tauri build` with Rust installed |
| Kritikka-MCP fails | Ensure `mcp-rules.json` valid JSON, ADR files exist |

## Useful Scripts

```bash
# Generate types after collection changes
pnpm generate:types

# Full clean rebuild
pnpm reinstall

# Check for unused exports
pnpm ts-prune  # if configured

# Analyze bundle size
cd apps/billing && pnpm build && npx vite-bundle-analyzer dist

# Run specific test
pnpm test -- VoucherForm.test.tsx
pnpm test:e2e -- --grep "voucher"
```