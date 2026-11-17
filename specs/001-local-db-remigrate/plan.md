# Implementation Plan: local-db-remigrate

**Branch**: `[001-local-db-remigrate]` | **Date**: 2026-11-17 | **Spec**: [`specs/001-local-db-remigrate/spec.md`](spec.md)

**Input**: Feature specification from `/specs/001-local-db-remigrate/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Clean and remigrate the local Syasyah Samaj Postgres database (`postgresql://nepse:nepse@localhost:5432/syasyah_samaj`), seed it with Syasyah Samaj-focused sample JSON data, add demo users, and verify the full data migration flow end-to-end via the application at `http://localhost:3000`. Includes a UI button to clear all data except accounting-related users.

## Technical Context

**Language/Version**: TypeScript, Node.js (Next.js 15, Payload CMS 3.75)

**Primary Dependencies**: Next.js 15, Payload CMS 3.75, `@payloadcms/db-postgres` 3.75.0, React 19, Tailwind CSS, TypeScript, pnpm, tsx

**Storage**: PostgreSQL (local: `localhost:5432/syasyah_samaj`, user `nepse`, password `nepse`)

**Testing**: Manual verification via browser at `http://localhost:3000` (sign-in, data viewing); no dedicated automated test framework configured for this flow

**Target Platform**: Local development (macOS), web app at `http://localhost:3000`

**Project Type**: Web application (monorepo: root Next.js + Payload CMS backend, `apps/billing/` offline-first SPA)

**Performance Goals**: Database cleanup + remigration completes in under 5 minutes; sample JSON import with zero rejected records

**Constraints**: Local-only environment, no production data involved, idempotent on repeated runs, demo user credentials predefined, production guard (no `NODE_ENV=production` for `db:setup`)

**Scale/Scope**: Single local database, demo users only, Syasyah Samaj domain data (chart of accounts, tenants, fiscal years, demo transactions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is a template with placeholder values (`[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, etc.) and contains no active project-specific principles or gates. No violations to evaluate. Constitution check passes with no blocking gates.

## Project Structure

### Documentation (this feature)

```text
specs/001-local-db-remigrate/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) - skipped (no external interfaces)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── collections/            # Payload CMS collection definitions (accounts, users, tenants, etc.)
├── migrations/             # Database migration files (numbered, sequential)
├── lib/                    # Shared utilities (i18n, auth helpers, db helpers)
├── payload.config.ts       # Payload CMS configuration
scripts/
├── db-setup.ts             # Database schema push script (DATABASE_URI required)
├── seed-local.ts           # NEW: Seed script for Syasyah Samaj sample JSON data
├── clear-local-data.ts     # NEW: Clear data script preserving accounting users
apps/billing/
├── src/
│   ├── components/         # React components (tables, buttons, forms)
│   ├── pages/              # SPA routes (Accounts, Members, VoucherStepper, etc.)
│   └── lib/                # SPA utilities (i18n, usePagination, cached lists)
```

**Structure Decision**: Web application structure with backend (root `src/`, Payload CMS) and frontend (`apps/billing/` SPA). Database scripts live in root `scripts/`. UI changes (clear-data button) go in `apps/billing/src/components/` and `apps/billing/src/pages/`. No separate backend/frontend split — it's a monorepo with shared root.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations — section not applicable.

---

## Phase 0: Outline & Research

### Unknowns from Technical Context

All technical context fields are resolved from the project (Next.js 15, Payload CMS 3.75, Postgres, pnpm, localhost:3000). No `[NEEDS CLARIFICATION]` markers remain in the spec.

### Research Tasks

1. **Research Payload CMS dev-mode schema push behavior** — How `db:setup` boots Payload config and pushes schema against target DB, and what placeholder env vars are needed (RESEND_API_KEY, PAYLOAD_SECRET).
2. **Research sample JSON import patterns** — Existing data import patterns in the project for chart of accounts, tenants, fiscal years, demo transactions.
3. **Research UI clear-data button pattern** — Existing button patterns in `apps/billing/src/components/` for destructive actions (confirmation dialog, type confirmation text, production guard).

### Consolidated Findings (research.md)

See `research.md` below.

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md` below.

### Interface Contracts

No external interfaces exposed by this feature (database cleanup, migration, seeding, and UI button are all internal to the local development environment). `/contracts/` directory is not created — project is a web application with no public API contract for this dev-flow feature.

### Quickstart Validation Guide

See `quickstart.md` below.
