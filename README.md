# Syasyah Samaj — Community Billing & Accounting Platform

> **Multi-tenant offline-first billing and accounting for Nepali community organizations**

[![CI](https://github.com/aayurt/syasyah-samaj/workflows/CI/badge.svg)](https://github.com/aayurt/syasyah-samaj/actions)
[![kritikka-mcp](https://img.shields.io/badge/kritikka--mcp-governed-blue)](https://github.com/aayurt/kritikka-mcp)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        syasyah-samaj                            │
│  Multi-tenant community billing & accounting platform           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Web SPA     │    │  Tauri Desktop │   │  Payload CMS  │
│   (Vite)      │    │  (SQLite)      │    │  (Postgres)   │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │   Sync Engine   │
                    │  (IndexedDB/    │
                    │   SQLite +      │
                    │   Outbox)       │
                    └─────────────────┘
```

### Core Architectural Decisions (ADRs)

| ADR | Title | Scope |
|-----|-------|-------|
| [0001](docs/adr/0001-data-model-governance.md) | Data Model Governance | Collection schemas, migrations |
| [0002](docs/adr/0002-offline-first-architecture.md) | Offline-First Architecture | SyncEngine, adapters, cache |
| [0003](docs/adr/0003-nepali-calendar-numbers.md) | Nepali Calendar & Numbers | BS dates, Devanagari digits |
| [0004](docs/adr/0004-excel-import-export-dedup.md) | Excel Import/Export & Dedup | Bulk data, conflict resolution |
| [0005](docs/adr/0005-accounting-invariants.md) | Accounting Invariants | Double-entry, validation layers |

---

## ✨ Key Features

### 📊 **Accounting Module**
- Double-entry vouchers with real-time debit/credit validation
- Journal entries, daybooks, posting queue
- Trial Balance, P&L, Balance Sheet, Party Statements
- VAT (13%) calculation, Tax reports
- Bank reconciliation, fixed assets, recurring billing

### 👥 **Community Management**
- Member directory with blood group, ward, family details
- Membership types, renewals, opening balances
- Party/vendor management with GSTIN/PAN
- Items & services inventory

### 🔄 **Offline-First Architecture**
- **Cache-first reads** — Instant UI from IndexedDB/SQLite
- **Outbox pattern** — All writes queued locally, synced when online
- **Conflict resolution** — Visual diff, merge, or choose server/local
- **Background sync** — 60s push, 5min pull, visibility-triggered
- **Tauri desktop** — Native SQLite persistence

### 📥 **Excel Import/Export**
- **No duplicates** — 3-tier dedup (exact ID, business key, fuzzy name)
- **Conflict rules** — Skip / Update existing / Append all
- **Validation preview** — Color-coded rows (valid/warning/error)
- **Nepali support** — Devanagari digits, BS dates in Excel
- **Templates** — Download blank templates with examples

### 🇳🇵 **Nepali Localization**
- Bikram Sambat (BS) calendar alongside Gregorian (AD)
- Devanagari digits (०-९) toggle per tenant
- Amount in words: English + Nepali (लाख/करोड़)
- Dual date columns in exports

### 🛡️ **Governance (kritikka-mcp)**
- Repository-aware MCP server enforcing 16 rules
- Jules dispatch gates: `validate_jules_ready`, `prepare_jules_task`, `validate_jules_result`
- CI validation on every PR

---

## 🚀 Quick Start

### Prerequisites
- **Node.js ≥ 20** (see `.nvmrc`)
- **pnpm ≥ 10** (`corepack enable`)
- **PostgreSQL 16+** (local or Docker)
- **Git**

### Development Setup

```bash
# 1. Clone and install
git clone https://github.com/aayurt/syasyah-samaj.git
cd syasyah-samaj
pnpm install

# 2. Environment
cp .env.example .env
# Edit .env with your DATABASE_URI, RESEND_API_KEY, etc.

# 3. Database (Option A: Local Postgres)
createdb syasyah_samaj
pnpm --filter @afno/billing db:push

# Option B: Docker
docker run -d --name pg \
  -e POSTGRES_DB=syasyah_samaj \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16

# 4. Start dev servers
# Terminal 1: Payload CMS (admin + API on :3000)
pnpm dev

# Terminal 2: Billing SPA (Vite on :5173)
cd apps/billing && pnpm dev
```

### Verify Governance
```bash
# Check if changes violate rules
npx kritikka-mcp validate-change --changed-files "apps/billing/src/pages/Vouchers.tsx"

# Full architecture validation
npx kritikka-mcp validate-architecture
```

---

## 📁 Project Structure

```
syasyah-samaj/
├── apps/
│   └── billing/           # Vite + React 19 SPA (main app)
│       ├── src/
│       │   ├── pages/     # Route pages (Vouchers, Members, etc.)
│       │   ├── components/# Shared UI components
│       │   ├── lib/       # Core logic (api, sync, offline, importExport)
│       │   ├── hooks/     # Custom React hooks
│       │   ├── collections/# Payload collection configs
│       │   └── e2e/       # Playwright E2E tests
│       └── ...
├── src/                   # Payload CMS collections (shared)
├── docs/                  # Architecture, ADRs, conventions
│   ├── adr/               # Architecture Decision Records
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   └── DEVELOPMENT.md
├── locales/               # i18n translations (EN/NE)
├── .github/workflows/     # CI/CD
├── mcp-rules.json         # Kritikka-MCP governance rules
├── CONTRIBUTING.md
├── RUNBOOK.md
└── ...
```

---

## 🧪 Testing

```bash
# Unit + Integration + Component (Vitest)
cd apps/billing
pnpm test              # Run once with coverage
pnpm test:watch        # Watch mode
pnpm test:ui           # Vitest UI

# E2E (requires local Postgres)
E2E_DATABASE_URI=postgresql://postgres:test@localhost:5432/billing_e2e \
  pnpm test:e2e

# All tests
pnpm test && pnpm test:e2e
```

### Coverage Targets
| Layer | Target |
|-------|--------|
| `src/lib/**` | ≥ 90% |
| `src/components/**` | ≥ 80% |
| Critical paths (accounting, sync, import) | 100% |

---

## 📦 Deployment

### Production (VPS)
```bash
cd /var/www/syasyah-samaj
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart ecosystem.config.cjs
```

### Desktop (Tauri)
```bash
cd apps/desktop
pnpm tauri build
# Output: DMG (macOS), MSI (Windows), AppImage (Linux)
```

### Docker
```bash
docker compose -f docker-compose.yml up -d --build
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data flow, sync protocol |
| [CONVENTIONS.md](docs/CONVENTIONS.md) | TypeScript, React, i18n, testing conventions |
| [TESTING.md](docs/TESTING.md) | Test pyramid, coverage, CI pipeline |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, common tasks, debugging |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR workflow, governance, translation |
| [RUNBOOK.md](RUNBOOK.md) | Operations, incidents, monitoring, scaling |
| [ADRs](docs/adr/) | Architecture Decision Records |

---

## 🤝 Contributing

1. **Fork & branch**: `git checkout -b feat/your-feature`
2. **Write tests first** (TDD)
3. **Follow conventions** — see [CONVENTIONS.md](docs/CONVENTIONS.md)
4. **Validate with kritikka-mcp**:
   ```bash
   npx kritikka-mcp validate-change --changed-files "your/changed/files"
   ```
5. **Commit conventionally**:
   ```bash
   git commit -m "feat(scope): description"
   ```
6. **Push & PR** — CI runs: lint, typecheck, test, build, e2e, kritikka-mcp

---

## 🔒 Security

- **Auth**: better-auth with email/password + 2FA
- **Tenant isolation**: Row-level in Payload + API middleware
- **Secrets**: Environment variables only, never committed
- **Report vulnerabilities**: security@syasyah.org (or private GitHub advisory)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Payload CMS](https://payloadcms.com) — Headless CMS & framework
- [Tauri](https://tauri.app) — Desktop app framework
- [kritikka-mcp](https://github.com/aayurt/kritikka-mcp) — Repository governance
- [nepali-date-converter](https://github.com/.../nepali-date-converter) — BS/AD conversion
- [ExcelJS](https://exceljs.dev) — Excel generation/parsing