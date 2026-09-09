# Remaining Work — 2026-09-09

Every known-unfinished item from the 2026-09-09 session was re-verified against the repo on `main` (HEAD `1184907`). Statuses below reflect what is actually in the tree, not what was assumed.

**Legend:** Status — `verified-todo` (confirmed still open), `already-done` (confirmed resolved in tree), `obsolete` (no longer applicable). Effort — S (< 2h), M (2h–1d), L (1–3d), XL (> 3d).

## Summary Table

| # | Item | Status | Priority | Effort |
|---|------|--------|----------|--------|
| 1 | Playwright E2E specs cannot run (remote Postgres auth fails) | verified-todo | **P0** | M |
| 2 | Root `docker-compose.yml` stale (mongo) | verified-todo | P2 | S |
| 3 | UI-CLEANUP Phase 1: stray dirs + stray files | already-done | — | — |
| 4 | UI-CLEANUP Phases 3.1–3.5, 3.6, 4.1, 4.2, 5.1 | already-done | P3 (mark plan done) | S |
| 5 | Payroll not implemented (plan only) | verified-todo | P2 | XL |
| 6 | Dropdown clipping audit (native `<select>` / popups) | verified-todo | **P1** | M |
| 7 | Nepali digit formatting + amount-in-words option | verified-todo | **P1** | M |
| 8 | Print replica M3: appliedDateBs picker + letterhead | verified-todo | P2 | M |
| 9 | Members CSV import (SPA-side mapping UI) | verified-todo | P2 | M |
| 10 | Component split (VoucherForm/Settings) + report fetch batching | verified-todo | P2 | L |

---

## 1. Playwright E2E specs cannot run — **P0, M**

**Status: verified-todo.**

- Specs confirmed present in `apps/billing/e2e/specs/`: `00-shell`, `01-settings`, `02-accounts`, `03-masters`, `04-vouchers`, `05-journal`, `06-reports`, `07-offline`, `08-desktop-storage`, `09-spa-sqlite`, `10-membership`, `90-defects`, plus `auth.setup.ts` and `seed.setup.ts`.
- `.env` has `DATABASE_URI=postgresql://…@82.165.181.153:5432/syasha` (remote Postgres) — auth fails from this machine, so `pnpm test:e2e` cannot bootstrap.
- `apps/billing/e2e/playwright.config.ts` (lines 53–54) already supports overriding via `E2E_DATABASE_URI`, and `e2e/scripts/bootstrap.mjs` wipes/creates the `default` tenant only when `E2E_DATABASE_URI` is set. The escape hatch is fully built; only the database is missing.

**Next steps:**
1. Install local Postgres (brew) or run `postgres:16` in Docker; create a throwaway DB, e.g. `billing_e2e`.
2. Run the suite against it: `E2E_DATABASE_URI=postgresql://postgres:postgres@localhost:5432/billing_e2e pnpm --filter billing test:e2e` (or from `apps/billing/`).
3. Fix any spec drift exposed (specs were written but never executed).
4. Optional: wire the local-DB run into CI with a Postgres service container.

**Files:** `apps/billing/e2e/playwright.config.ts`, `apps/billing/e2e/scripts/bootstrap.mjs`, `.env` (do not commit real credentials), `apps/billing/docs/E2E_TEST_CASES.md`, `apps/billing/docs/SETUP_AND_E2E_PLAN.md`.

## 2. Root `docker-compose.yml` stale (mongo) — **P2, S**

**Status: verified-todo.**

Root compose defines a `payload` service (node:18, yarn dev) + `mongo:latest` with a `data` volume. The real stack is Vite SPA (`apps/billing`) + Payload 3 + **Postgres** (`DATABASE_URI` in `.env`). The mongo service is dead weight and misleading; the app isn't even developed via compose.

**Next steps:** Either (a) delete `docker-compose.yml`, or (b) rewrite it as `postgres:16` (port 5432, named volume) + optional `mailhog`-style extras for local dev, and document `docker compose up -d` in the README. Option (a) is simplest.

**Files:** `docker-compose.yml`, `README.md`.

## 3. UI-CLEANUP Phase 1 (stray dirs/files) — **already-done**

**Status: already-done / obsolete — no code action needed.**

Verified on disk:
- `src/app/%5Blocale%5D` — does not exist.
- `src/app/\[locale\]` (literal-backslash dir) — does not exist. `src/app/` contains exactly `app`, `[locale]`, `api`, `(payload)`.
- Stray `…ndex.tsx` at root — does not exist.
- `src/components/MemberEntryForm.tsx` — does not exist.

Commit `a1fbd80` ("UI cleanup & improvement plan (Phases 1-3)") removed these.

## 4. UI-CLEANUP Phases 3–5 — **already-done** (mark the plan complete — P3, S)

**Status: already-done.** Commit `8f525b3` ("Phase 4-5: Logo CLS fix, ChatInterface accessibility, FOUC removal, theme consistency") actually covered everything:

| Sub-item | Verification result |
|---|---|
| 3.1 homepageHero yellow CTA | done — no `bg-yellow` in file |
| 3.2 Hero yellow CTA | done — no `bg-yellow` in file |
| 3.3 EventCard `bg-white dark:bg-card` | done — no `bg-white` left |
| 3.4 Members double `p-6` | done — single `p-6` on Card (line 33) |
| 3.5 DigitalIDCard hardcoded status colors | done — no `bg-green-100` / `text-yellow-400` |
| 3.6 tailwind duplicate keyframes | done — `keyframes` appears once in `tailwind.config.mjs` |
| 4.1 Logo CLS (width/height) | done — 4 width/height attrs in `Logo.tsx` |
| 4.2 ChatInterface `onKeyPress` + aria | done — no `onKeyPress` in repo; `aria-label="Type a message"` present (line 135) |
| 5.1 FOUC `html { opacity: 0 }` | done — the only `opacity: 0` left in `globals.css` is the unrelated `.rotating-border-gradient` hover effect |

**Next steps:** Edit `docs/UI-CLEANUP-PLAN.md` to add a "✅ Completed 2026-09-08 (commit 8f525b3)" banner at the top so future sessions stop re-checking it. (Docs-only change; can ride along with this commit's follow-ups.)

**Files:** `docs/UI-CLEANUP-PLAN.md`.

## 5. Payroll not implemented — **P2, XL**

**Status: verified-todo.** `grep -ri payroll apps/billing/src/` returns zero hits — no schema, no UI, no routes. `apps/billing/docs/PAYROLL_PLAN.md` (336 lines) is the full design: salary structures, monthly payroll runs, payslips, journal integration, TDS, fiscal-year aware.

**Next steps (per the plan doc):** 1) Payload collection for salary structures + payroll runs; 2) monthly run calculation endpoint; 3) payslip generation wired to document/journal posting; 4) UI page under Settings/Reports; 5) i18n keys EN+NE; 6) e2e spec `11-payroll.spec.ts`. Consider a spike first to right-size the first PR (structure + manual run entry only).

**Files:** `apps/billing/docs/PAYROLL_PLAN.md`, `apps/billing/src/collections/`, `apps/billing/src/pages/`, `apps/billing/src/lib/i18n/{en,ne}.ts`.

## 6. Dropdown clipping audit — **P1, M**

**Status: verified-todo.** BUG-2 (dropdown z-index/portal) was fixed by portalizing **only** `AccountSelect` and `SearchSelect`. Audit found native `<select>` or custom popups still in **17 files**, any of which can be clipped by an ancestor `overflow: hidden`:

`IllakaSwitcher.tsx`, `FiscalYearSwitcher.tsx` (both in the app header — highest visual risk), `Parties.tsx`, `Vouchers.tsx`, `Members.tsx`, `Transfers.tsx`, `Posting.tsx`, `Journal.tsx`, `BankReconciliation.tsx`, `Accounts.tsx`, `VoucherForm.tsx`, `SetupOpeningBalances.tsx`, `AuditLog.tsx`, `reports/PartyStatement.tsx`, `reports/SalesReport.tsx`, `reports/PurchaseReport.tsx` (+ more under `src/pages/`).

**Next steps:** 1) Grep-driven sweep: for each `<select`, decide — stays native (fine inside cards with no overflow clipping) vs. migrates to the portalized Select; 2) prioritize the header switchers and report-page filter rows; 3) add a `position: relative; overflow: visible` lint rule or a shared `FilterSelect` component to stop regressions; 4) check `ConflictResolutionModal` popups inside dialogs.

**Files:** the 17 files above, `apps/billing/src/components/{AccountSelect,SearchSelect}.tsx` (reference implementations).

## 7. Nepali digit formatting + amount-in-words — **P1, M**

**Status: verified-todo.**

- `apps/billing/src/lib/api.ts:471` — `fmt()` hardcodes `toLocaleString('en-US', {2 decimals})` → Western digits everywhere.
- `Settings.tsx` has no Nepali-digit option (only the language toggle label mentions Devanagari).
- Amount-in-words exists as an English-only hook in `PrintVoucher.tsx` / `Vouchers.tsx` / `VoucherForm.tsx` (i18n keys in `en.ts`/`ne.ts`); no Devanagari words conversion.

**Next steps:**
1. Add `nepaliDigits: boolean` to billing settings (schema + Settings UI toggle, EN+NE labels).
2. Add `toNepaliDigits(s: string)` util (0-9 → ०-९) and a `fmt()` wrapper that reads the setting (or a `useFmt()` hook so the toggle applies without reload).
3. Swap call sites gradually — start with reports + voucher totals.
4. Nepali amount-in-words: implement `numberToNepaliWords(n)` (lakh/crore grouping, Devanagari units) and route the existing "In words" line through the language setting.

**Files:** `apps/billing/src/lib/api.ts`, new `apps/billing/src/lib/nepaliNumbers.ts`, `Settings.tsx`, `PrintVoucher.tsx`, i18n files, settings collection schema.

## 8. Print replica M3 (appliedDateBs picker + letterhead) — **P2, M**

**Status: verified-todo.** `PrintVoucher.tsx` provides blank-form A4 printing. `appliedDateBs` exists only in `Members.tsx` / `MemberViewModal.tsx` — there is **no date-picker for appliedDateBs on the print page**, and there is **no per-tenant letterhead customization** (logo/name/address block is fixed).

**Next steps:** 1) Add a Nepali date input (`NepaliDateInput` already exists) to the print toolbar bound to appliedDateBs, defaulting to today's BS date; 2) add tenant-level letterhead fields (org name, address, logo URL, footer note) to settings + render them in the print header; 3) i18n both.

**Files:** `apps/billing/src/components/PrintVoucher.tsx`, `apps/billing/src/components/NepaliDateInput.tsx`, `Settings.tsx`, settings schema, i18n files.

## 9. Members CSV import (SPA-side) — **P2, M**

**Status: verified-todo.** `apps/billing/src/lib/csv.ts` only supports **export** (`downloadCsv`); `Members.tsx:1125` wires CSV export. There is **no CSV import** for members in the SPA. (Server-side Google Sheets sync exists; JSON import exists in `DataManagement.tsx`.) Members count now ~thousands with the 77-district + application-group schema, so a mapping UI is worth it.

**Next steps:** 1) `parseCsv(text): {headers, rows}` in `csv.ts`; 2) Import wizard in `DataManagement.tsx` (or Members toolbar): file drop → column mapping (name, email, phone, district, bloodGroup, membership type, appliedDateBs…) → preview 5 rows → bulk POST; 3) dry-run validation report (row errors shown per row); 4) reuse the bulk openling-balances save pattern; 5) i18n.

**Files:** `apps/billing/src/lib/csv.ts`, `apps/billing/src/pages/DataManagement.tsx`, `apps/billing/src/pages/Members.tsx`, i18n files.

## 10. Component split + report fetch batching — **P2, L**

**Status: verified-todo.** Measured line counts: `apps/billing/src/pages/VoucherForm.tsx` = **1,750** lines, `Settings.tsx` = **2,132** lines. `useCachedList` exists (`src/lib/useCachedList.ts`) and is used by `Posting.tsx` + `VoucherForm.tsx`, but each report page (`reports/*.tsx`) runs its own `useEffect` fetch — no shared batching/caching layer for reference data across reports.

**Next steps:**
1. **Settings.tsx:** extract section components (FiscalYears, CoA, DocSequences, OrgProfile, MembershipTypes…) into `src/components/settings/`; Settings keeps only tab state. Mechanical, low-risk, do first.
2. **VoucherForm.tsx:** extract line-items editor, party/item selectors wiring, totals footer, keyboard handlers into `src/components/voucher/`.
3. **Report data layer:** a `useReportData(slug, params)` hook backed by `useCachedList`/swr-style caching so reference lists (accounts, parties, items, tax types) are fetched once per session across reports.
4. Guardrail: no behavior change — pure moves; verify with `pnpm build` + smoke of each settings tab.

**Files:** `apps/billing/src/pages/{Settings,VoucherForm}.tsx`, new `src/components/settings/*`, `src/components/voucher/*`, `src/lib/useCachedList.ts`, `src/pages/reports/*`.
