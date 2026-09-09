# Implementation Plan — Defects + Membership

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship the two confirmed accounting defects (cacheVersion bump on FY change; dropdown z-index/clip fix) and build the Membership UI + Nepali language workstream (M1–M6), finishing with an E2E pass.

**Architecture:**
- Backend: Payload CMS 3.75 collections + custom API endpoints in `src/collections/<slug>/index.ts`.
- SPA (apps/billing): cache-first offline SPA (IndexedDB + localStorage + outbox). Use `useCachedList` / `useCachedGlobals` — never `Promise.all(list())`.
- i18n: lightweight `apps/billing/src/lib/i18n.tsx` with `en.ts` / `ne.ts` dictionaries; display-only translation, inputs stay English.

---

## Part A — Confirmed Defects (Quick Wins)

### Status: started.
Verified from working-tree diffs:
- **BUG-1 (cacheVersion on FY change)** — `FiscalYearSwitcher.tsx` now bakes `cacheVersion` eviction on `beforeunload` + `visibilitychange`, plus refresh on year switch and Add-Year button. Done.
- **BUG-2 (dropdown z-index / overflow:hidden)** — `Popover.tsx` created; `AccountSelect.tsx` and `SearchSelect.tsx` swap `absolute z-30` dropdown for `<Popover>` portal. Done.

### A1 — Commit and lock down

**Step 1: Stash or keep the current WIP**

The following are modified in the working tree:

- `src/collections/FiscalYears/index.ts`
- `src/collections/AccountGroups/index.ts`
- `src/collections/DocSequences/index.ts`
- `src/collections/Accounts/index.ts`
- `src/collections/JournalEntries/index.ts`
- `src/collections/OpeningBalances/index.ts`
- `apps/billing/src/App.tsx`
- `apps/billing/src/components/AccountSelect.tsx`
- `apps/billing/src/components/SearchSelect.tsx`
- `apps/billing/src/components/FiscalYearSwitcher.tsx`
- `apps/billing/src/components/Popover.tsx` (new)
- New standalone docs/scripts: `docs/accounting-defect-plan.md`, `scripts/validate-defects.sh`

**Step 2: Confirm no breakage in the already-touched files**

Run the existing tests and a quick `pnpm build` on the SPA side and `pnpm payload generate:types` on the backend side. If any of these fail, fix before committing. If they pass, commit as a single WIP branch:

```
git checkout -b wip/accounting-defects-membership
git add ...
git commit -m "wip: accounting defect fixes (BUG-1 cacheVersion, BUG-2 dropdown portal) + backend groundwork"
```

### A2 — Validate the two confirmed defects with an automated check

**Objective:** Prove BUG-1 and BUG-2 are actually fixed, not just changed.

**Files:**
- Reuse / extend `scripts/validate-defects.sh` (new, untracked).
- Optional: add a Playwright smoke check if the existing E2E harness (`apps/billing/e2e/`) can run against a seeded DB.

**Step 1: Read the existing validation script**

```bash
cat scripts/validate-defects.sh
```

**Step 2: Make the script test the visible symptoms**

For BUG-1: after adding a new FY and switching to it, the next data load must reflect the new state (no stale cache). For BUG-2: open a dropdown inside a container with `overflow:hidden` and confirm it is still visible (not clipped).

**Step 3: Run the script against a running dev server**

```bash
bash scripts/validate-defects.sh
```

**Step 4: If the script cannot exercise the SPA directly, add Playwright smoke**

Refer to `apps/billing/docs/E2E_TEST_CASES.md` for harness conventions (S0/S1 suites). A small S9 suite:

```ts
// 90-defects.spec.ts
import { test, expect } from '@playwright/test'

test('BUG-1 smoke: cache clears after FY change', async ({ page }) => {
  // 1. log in, 2. pick a FY in the switcher, 3. navigate, 4. verify visible data matches the FY
})

test('BUG-2 smoke: dropdown visible inside overflow:hidden parent', async ({ page }) => {
  // 1. open a select inside the constrained container, 2. assert dropdown not clipped
})
```

Run:

```bash
cd apps/billing && pnpm test:e2e --project=90-defects
```

> Prerequisites: Postgres reachable via `.env` DATABASE_URI; browser installed once with `npx playwright install chromium`.

---

## Part B — Backend Groundwork Already Started

Several backend changes are already uncommitted (see Part A, Step 1). They should be reviewed, committed, and then extended. The table below records what is already in the diffs and what still needs attention.

| Area | Already in diff | What's left |
|---|---|---|
| FiscalYears (BUG-2 date validation, BUG-3/4 single-active, overlap detection) | Yes — full `beforeValidate` with date validation, span check, overlap query | Confirm `bsYear.ts` helpers align; ensure the SPA FY switcher plays nicely with the new `isActive` invariant |
| AccountGroups (hierarchical parent, auto-code) | Yes | Use the hierarchy in the Chart of Accounts UI tree |
| DocSequences (user-manageable series, delete protection) | Yes — DOC_TYPE_OPTIONS, access via isBillingUser, lastNumber>0 guard | Build the Settings UI for series management (Phase 2) |
| Accounts seed endpoint (`POST /seed-defaults`) | Yes | Verify default accounts seed from the SPA wizard; confirm account-code uniqueness behavior per tenant |
| JournalEntries void + reopen endpoints | Yes — `POST /:id/void`, `POST /:id/reopen` with tx + audit | Wire those into the Transaction Entry UI (Phase 3); decide whether reopen/void share a “remark” field in the UI |
| OpeningBalances bulk save (`POST /save-wizard`) | Yes | Wire the wizard UI to call it; surface the balance-difference error |

### B1 — Commit backend groundwork

After Part A is committed as WIP, rebase/squash the backend changes into a clean commit so the history reads:

```
feat: accounting backend — fiscal-year validation, doc series, journal void/reopen, opening-balances bulk save, accounts seed
```

### B2 — Run `payload generate:types`

Schema changes in collections + globals should be reflected in `src/payload-types.ts`:

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
pnpm payload generate:types
```

If `payload-types.ts` changes, include it in the commit.

---

## Part C — Phase 2: Series Management UI (DocSequences)

**Goal:** Let a billing user manage number-series in Settings, including adding new series, editing prefix/format, and deleting only series that haven’t posted (lastNumber === 0).

**Files:**
- Backend: `src/collections/DocSequences/index.ts` (mostly done) — minor: ensure `fiscalYear` and `key` fields exist and the auto-generation logic is sound.
- SPA: `apps/billing/src/pages/Settings.tsx`.
- SPA types: `apps/billing/src/lib/types.ts` — add `DocSequence` if needed.

**Step 1: Verify DocSequences schema**

Read `src/collections/DocSequences/index.ts` and confirm:
- fields: `name`, `docType` (select of DOC_TYPE_OPTIONS), `prefix`, `fiscalYear` (relationship or number?), `lastNumber`, `key` (auto).
- `access`: create/read/update via `isBillingUser`; delete restricted as already coded.

**Step 2: Add a SeriesManagement card to Settings.tsx**

- Table of current series (name, docType, prefix, lastNumber, FY).
- “Add series” button → inline form (docType select, prefix input, FY select).
- Edit inline (same form prefilled).
- Delete button disabled when `lastNumber > 0` with a tooltip “Cannot delete — documents already posted using this series”.

**Step 3: Persist changes**

Settings uses the existing `api()` call pattern; on save, recompute and re-render. Follow the “settings-changed” event pattern from `apps/billing/src/AGENTS.md` Rule 3 if the series data affects any downstream feature.

**Step 4: Cache invalidation**

If series changes affect voucher numbering, ensure the SPA invalidates its sequence cache (or refreshes on next create).

---

## Part D — Phase 3: Transaction Entry UI (Rename already done)

**Goal:** Rename “Journal” → “Transaction Entry” with tabs: Posting | Reopen | Delete | Void; support a remark field for void/reopen; wire up the new endpoints.

**Already done:** `App.tsx` renamed the nav item to “Transaction Entry” and added `/transaction-entry` route that renders `<Vouchers />`. Confirm whether the intended split is:
- `/transaction-entry` = the new unified entry hub (tabs), OR
- `/journal` still exists as a read-only ledger view.

If the latter, keep both. If the former, make `/transaction-entry` the primary entry point with the tabbed UI.

**Files:**
- `apps/billing/src/pages/Vouchers.tsx` (or a new `TransactionEntry.tsx` if you prefer a dedicated page).
- `apps/billing/src/lib/api.ts` — ensure the new `POST /journal-entries/:id/void` and `POST /:id/reopen` calls are usable.

**Step 1: Decide route layout**

Prefer: `/transaction-entry` for create + the four action tabs (Posting / Reopen / Delete / Void), `/journal` for the ledger/list view (read-only). Update `App.tsx` nav accordingly.

**Step 2: Add tabs to the entry UI**

Tab 1 — Posting: existing voucher creation flow.
Tab 2 — Reopen: list posted entries eligible for reopen; click → remark input → call `POST /:id/reopen`.
Tab 3 — Delete: list draft/void entries eligible for deletion.
Tab 4 — Void: list posted entries; click → remark input → call `POST /:id/void`; show reversal id.

**Step 3: Remark field UI**

A small text input above the action buttons for Reopen and Void. Require it (backend already enforces remark for both endpoints).

**Step 4: Feedback + audit**

After a successful void/reopen, show a toast with the reversal id and a link to the reversed entry (if the UI can navigate there). The audit log is written by the backend; optionally surface recent audit entries in a small “Recent actions” panel.

---

## Part D2 — Phase 4: Chart of Accounts verification

**Goal:** Confirm the default accounts seed works end-to-end and that the account head mapping used by vouchers aligns.

**Files:**
- Backend: `src/collections/Accounts/index.ts` (seed endpoint already present).
- SPA: Chart of Accounts UI (if it exists — check `apps/billing/src/pages/Accounts.tsx` or equivalent).
- Seed data: `seed-accounting.sql` (root) or `billing-seed.mjs` might already define COA.

**Step 1: Run the seed endpoint against a fresh tenant**

Using the existing seed harness or manually via `curl` / Postman against `POST /api/gl-accounts/seed-defaults` with a tenant id.

**Step 2: Confirm defaults land with correct code/name/type/group**

Spot-check the 13 default groups (Cash, AR/AP, VAT, etc.) and the ~44 accounts listed in the diff.

**Step 3: Verify account head mapping**

If vouchers use a “default account per transaction type” mapping (e.g. sales → Sales Revenue, purchase → COGS), confirm that mapping references the seeded accounts and that it survives a tenant reset.

---

## Part E — Membership UI + Nepali Language (M1–M6)

**Source doc:** `apps/billing/docs/MEMBERSHIP_UI_AND_NEPALI_PLAN.md` — detailed field mapping, UX, print replica, i18n approach. Use it as the authoritative spec; this plan only breaks it into tasks.

**Estimated total:** ~4–5 working days. M1–M3 and M4–M5 can run in parallel.

### E1 — M1: Members schema extension

**Objective:** Extend `Members` collection with an `application` group, district select (77 districts), and blood-group select.

**Files:**
- `src/collections/Members/index.ts` (modify).
- Possibly `src/collections/Members/access/` if tenant scoping changes.

**Step 1: Add the `application` group fields**

Per the field mapping table in MEMBERSHIP_UI_AND_NEPALI_PLAN.md A1:
- `citizenshipNo` (text)
- `citizenshipIssuedDateBs` (text, YYYY-MM-DD)
- `citizenshipDistrict` (select, 77 districts)
- `addressPermanent` (text)
- `addressTemporary` (text)
- `mobile` (text)
- `specialQualification` (text)
- `occupation` (text)
- `officeName` (text)
- `fatherName` (text)
- `grandfatherName` (text)
- `fatherInLawName` (text)
- `spouseName` (text)
- `sonName` (text)
- `daughterName` (text)
- `appliedDateBs` (text)

**Step 2: Convert bloodGroup to select**

In `idCardDetails` (or wherever bloodGroup currently lives): switch from text to select of `A+, A-, B+, B-, AB+, AB-, O+, O-`.

**Step 3: Add district options**

77 districts (Nepal). Decide where to store the list:
- Option A: static array in a `lib/districts.ts` file.
- Option B: a small `districts` select field with explicit options inline in the schema.

Pick Option A for reuse if other forms later need districts.

**Step 4: Generate types**

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
pnpm payload generate:types
```

**Step 5: Commit**

```
feat: members schema extension (application group, 77 districts, blood group select)
```

---

### E2 — M2: Application-form UI (paper-layout, save/edit)

**Objective:** A full-page application form that mirrors the paper, editable inputs, save/edit, photo preview, BS date input.

**Files:**
- `apps/billing/src/pages/Members.tsx` (or a new `ApplicationForm.tsx` imported there).
- Possibly a shared `components/ApplicationForm/` folder.

**Step 1: Create the form page component**

Render the paper layout:
- Org header (logo, स्यस्यः समाज, यल / Syasyah Samaj, Yala, phone).
- Red underlined title exactly as on the paper.
- Sections in paper order: Identity → Address & contact → Personal → Family → Membership & fee.
- Photo upload with square crop preview in a “फोटो” frame.
- BS date input using whichever compact Nepal-date component the app already uses (or a simple text input with YYYY-MM-DD hint).

**Step 2: Read/write members**

Use the SPA’s existing `api()` pattern (or better-auth if login is required). On create/update, save the member and show success toast.

**Step 3: Prefill from existing member**

When editing an existing member (from the table row action), prefill every field.

**Step 4: Form validation**

Minimal client-side: required fields per the paper (name, citizenship no, etc.). The server-side validation in the collection schema is the backstop.

**Step 5: Commit**

```
feat: membership application form UI (paper-layout, save/edit, photo preview)
```

---

### E3 — M3: Print view matching the paper form

**Objective:** A print replica (A4 portrait) of the paper form from the saved member record; blank-form printing option.

**Files:**
- Reuse `ApplicationForm.tsx` / `ApplicationForm.print.tsx` (one component, two skins per the spec).
- Print CSS: `@media print` that hides app chrome, sizes A4 portrait, draws dotted-line fields with in-line data.

**Step 1: Implement print CSS**

```css
@media print {
  /* hide sidebar, header, banners, buttons */
  .app-shell, .sidebar, .header, .banner, button { display: none !important; }
  .print-sheet { width: 210mm; min-height: 297mm; }
  /* enforce black-on-white, no shadows */
}
```

**Step 2: Add a “Print form” action**

- On the Application Form view: a “प्रिन्ट” button that calls `window.print()`.
- On the Members table: a “Print form” row action for any saved member.

**Step 3: Blank-form printing**

A “Print blank form” action renders the same replica with no data (empty dotted blanks), so the office can print empty paper forms.

**Step 4: Fonts / layout check**

Devanagari webfont already in the app; verify the print replica renders Devanagari correctly. Verify the photo box appears top-right and the footer note “दस्तखत: नागरिकताका फोटो कापि संलग्न यानादिस ।” is at the bottom.

**Step 5: Commit**

```
feat: membership print replica (A4 paper form, blank-form printing)
```

---

### E4 — M4: i18n layer + language toggle + en/ne dictionaries (shell & common)

**Objective:** A lightweight i18n layer with `LangProvider` + `useT()`, a language toggle in Settings, and dictionaries for shell/common.

**Files:**
- `apps/billing/src/lib/i18n.tsx` — new.
- `apps/billing/src/lib/i18n/en.ts` — new.
- `apps/billing/src/lib/i18n/ne.ts` — new.
- `apps/billing/src/pages/Settings.tsx` — add Language / भाषा toggle.
- `apps/billing/src/App.tsx` — read initial language from localStorage, re-render on `ui-lang` change.

**Step 1: Create the i18n module**

```tsx
// apps/billing/src/lib/i18n.tsx
export const en = { ... }  // flat key map
export const ne = { ... }  // flat key map
export function useT() {
  const lang = localStorage.getItem('ui-lang') || 'ne'
  return (key: string, fallback?: string) => {
    const dict = lang === 'ne' ? ne : en
    return dict[key] ?? fallback ?? key
  }
}
```

Store the language in `localStorage` under key `ui-lang` (`en` | `ne`), default `ne`.

**Step 2: Add the toggle to Settings**

A card “Language / भाषा” with two radio buttons: English / नेपाली. On change, write `localStorage` and dispatch a `ui-lang-changed` event (or re-render via React state lifted to App.tsx).

**Step 3: Bootstrap the dictionaries**

Start with shell + common keys:
- `nav.*`, `common.*`, `toast.*`, `status.*` (Draft / Posted / Void / Paid / Unpaid labels), `button.*` (Save, Cancel, Delete, Edit, Add, Search), `empty.*`, `calendar.*`.

**Step 4: Wire useT() into shell components**

Sidebar, header, sync banner, command palette, Tour. Confirm the toggle switches all of them.

**Step 5: Fallback rule**

`useT(key)` falls back to the English string when the `ne` key is missing — enables incremental translation. Implement this in the hook.

**Step 6: Commit**

```
feat: i18n layer (en/ne dictionaries, language toggle, shell + common strings)
```

---

### E5 — M5: Page-by-page Nepali translation

**Objective:** Translate page UI chrome (labels, menus, messages) to Nepali, priority order per the spec. Inputs, codes, names, amounts, emails, phone numbers never translated. Status values stay English in the DB.

**Priority order:**
1. Shell (sidebar groups + items, header, sync banner, command palette, Tour) — mostly done in M4.
2. Common (buttons, toasts, confirm dialogs, status chips, date/calendar labels, empty-state text).
3. Pages: Vouchers, VoucherForm, Journal, Transfers, Members (incl. Application Form), Parties, Accounts, Settings, Dashboard.
4. Reports: titles + column headers (numbers/codes stay as-is).
5. Print outputs: extend to fully Nepali when `ne`.

**Step 1: Translate page by page**

Pick one page at a time. For each component, wrap static labels with `useT('key')` and add the `ne` value to `ne.ts`. Do not touch input values or printed numbers.

**Step 2: Verify in both languages**

Toggle Settings → English / नेपाली; confirm labels flip and inputs stay English.

**Step 3: Commit per page or per group**

Group commits sensibly:

```
docs(i18n): nepali strings for vouchers + voucher form
docs(i18n): nepali strings for masters (parties, accounts, members)
docs(i18n): nepali strings for reports + print outputs
```

---

### E6 — M6: E2E — application-form spec + ne-mode smoke

**Objective:** End-to-end: fill application form → save → pay fee (existing pay-fee endpoint) → print. Plus a Nepal-mode smoke that checks labels render in Nepali.

**Files:**
- `apps/billing/e2e/specs/10-membership.spec.ts` (or similar).
- `apps/billing/e2e/dataset.json` if any new test data is needed.
- Follow existing harness from `apps/billing/docs/E2E_TEST_CASES.md`.

**Step 1: Write the application-form E2E**

Use Playwright to:
1. Open the new Members → Application Form view.
2. Fill all paper fields (English input, as required).
3. Upload a photo (use a small local image).
4. Save.
5. Verify the member appears in the table.
6. Pay fee via the existing pay-fee action.
7. Open the print view and verify the print replica renders.

**Step 2: Write the ne-mode smoke**

1. Switch Settings → नेपाली.
2. Assert key labels on the sidebar, header, and a page (e.g. “सदस्यहरू” for Members) are in Nepali.
3. Switch back → English.

**Step 3: Run the suite**

```bash
cd apps/billing && pnpm test:e2e --project=10-membership
```

Prereqs: Postgres reachable, browser installed once (`npx playwright install chromium`). Use a dedicated/test DB or ensure the seed is idempotent per the harness docs.

**Step 4: Commit**

```
test(e2e): membership application form journey + ne-mode smoke
```

---

## Part F — Closing Out

### F1 — Final review of all changes

- Read through `src/collections/*/index.ts` for the collections touched.
- Read through `apps/billing/src/pages/Settings.tsx` and `App.tsx` for the UI changes.
- Confirm `payload-types.ts` is up to date.

### F2 — Generate types + rebuild

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
pnpm payload generate:types
pnpm build    # next build
```

If anything fails, fix before marking done.

### F3 — Final commit / squash

Once all phases pass locally, clean up the WIP branch:

```
git checkout main
git merge --squash wip/accounting-defects-membership
git commit -m "feat: accounting defect fixes, series UI, transaction entry tabs, membership UI + nepali i18n"
```

Or, if the user prefers a stacked series of small commits, rebase and split accordingly.

### F4 — Update plan.md

Update `plan.md` to reflect completion (or partial completion if some phases are deferred).

---

## Dependencies and ordering

- Parts A and B must land first (backend groundwork + confirmed defects verified).
- Part C (Series UI) depends on DocSequences backend (already started) — small, can go right after B.
- Part D (Transaction Entry UI) depends on JournalEntries void/reopen endpoints (already started).
- Part E1 (Members schema) can go anytime; E2 (form UI) depends on E1; E3 (print) depends on E2; E4 (i18n layer) is independent but E5 depends on it; E6 depends on E2 + E5.

Recommended order:

1. A1 commit + A2 validate-defects
2. B1 commit backend + B2 generate types
3. C (Series Management UI)
4. D (Transaction Entry UI)
5. E1 (Members schema) + E4 (i18n layer) in parallel
6. E2 (form UI) + E3 (print) in sequence
7. E5 (page-by-page nepali) 
8. E6 (E2E)

---

## Risks and caveats

- The `docker-compose.yml` in the repo root is stale (mongo) — the real DB is Postgres via `.env` `DATABASE_URI`. Do not rely on `docker-compose up` for a working local dev; use the real DB. This is an existing inconsistency, not a new risk.
- Some backend endpoints use `overrideAccess: true` — double-check that the access rules still protect tenant-scoped data.
- Offline SPA cache: the BUG-1 fix clears cache on `beforeunload` + `visibilitychange`. Verify this doesn’t cause a noticeable refetch storm on rapid tab switches — if it does, debounce or gate on `cacheVersion` change.
- Print CSS: test actual print output (not just preview) to confirm A4 sizing and that app chrome is hidden.
- 77 districts list: confirm the final district list is correct and up-to-date; the spec leaves the source open (“select of 77 districts”).
