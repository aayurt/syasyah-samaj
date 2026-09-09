# Future Improvements — Proposals (2026-09-09)

Ten new proposals beyond the verified leftovers in `2026-09-09-remaining-work.md`. None are started; each lists problem, solution, effort (S < 2h, M 2h–1d, L 1–3d, XL > 3d), dependencies, and suggested priority.

## Summary Table

| # | Proposal | Effort | Priority | Key dependencies |
|---|----------|--------|----------|------------------|
| A | Nepali digits + Nepali amount-in-words display option | M | **P1** | #7 groundwork (same util) |
| B | Dashboard MoM compare + trend export | M | P2 | existing 12-month trend fetch |
| C | Keyboard-first UX: shortcut map + cheat-sheet modal | M | P2 | existing ⌘K palette |
| D | Bulk voucher import via CSV with column mapping | L | P2 | #9 CSV parser + mapping UI |
| E | Audit-log viewer: saved filter views | M | P3 | AuditLog query params |
| F | Fiscal-year close wizard | L | **P1** | fiscal-year validation (done today) |
| G | Notification center (SSE → in-app toasts) | L | P3 | toast lib decision |
| H | Member portal (read-only fee status) | XL | P3 | auth for members, security review |
| I | PWA install prompt + offline indicator polish | M | P3 | existing sw.js / UpdatePrompt |
| J | Report scheduling (weekly PDF email) | L | P3 | mail transport, PDF render server-side |

---

## A. Nepali digits + amount-in-words display option — **P1, M**

**Problem:** All amounts render Western digits (`1,234.00`) via `fmt()` (`src/lib/api.ts:471`) even when the UI language is Nepali. Accountants filling government filings in Devanagari must mentally re-write every figure; the existing "In words" hook on vouchers/reports is English-only.

**Proposed solution:** Billing setting `nepaliDigits` (toggle in Settings). New `src/lib/nepaliNumbers.ts`: `toNepaliDigits(str)` (0-9 → ०-९) and `numberToNepaliWords(n)` with lakh/crore grouping in Devanagari. `fmt()` respects the setting (or a `useFmt()` hook so it's reactive). Route the existing "In words" line through the active language. Optionally extend to BS dates on reports.

**Dependencies:** none strictly (self-contained); benefits from being paired with leftover #7 (same util — proposal A is effectively the user-facing half of #7).

## B. Dashboard month-over-month compare + trend export — **P2, M**

**Problem:** `Dashboard.tsx` renders a 12-month P&L `MiniBarChart` (pure CSS, no library) but gives no explicit month-vs-month deltas; there's no way to take the trend out of the app for meetings/Excel.

**Proposed solution:** Add a compare mode: current vs previous month per metric (income, expense, net) with % arrows; add "Export CSV"/"Export PNG" on the trend chart. Optionally a selectable range (3/6/12 months). Reuse `downloadCsv` from `src/lib/csv.ts`; PNG via canvas serialization of the CSS chart or a tiny SVG re-render.

**Dependencies:** none new; touches `Dashboard.tsx` trend fetch only (consider the #10 `useReportData` hook while there).

## C. Keyboard-first UX: shortcut map + cheat-sheet modal — **P2, M**

**Problem:** `CommandPalette` (⌘K) exists and covers navigation, but form-level actions (save/post/void/new line/next field) have no documented or consistent shortcuts, and there's no discoverability layer.

**Proposed solution:** 1) Inventory + standardize shortcuts (`⌘S` save voucher, `⌘Enter` post, `⌘⇧N` new, `?` opens cheat sheet); 2) a cheat-sheet modal (grouped list, i18n EN+NE) triggered by `?` and from the palette itself; 3) per-form hint chips in footers. Keep an internal registry module so shortcuts are defined once and rendered in the modal.

**Dependencies:** none; coordinate with #10 (VoucherForm split) so the VoucherForm handler extraction lands once.

## D. Bulk voucher import via CSV with column mapping — **P2, L**

**Problem:** Migrating a fiscal year of paper vouchers (or switching from another system) means hand-entering hundreds of documents. Members CSV import (leftover #9) covers members only.

**Proposed solution:** Import wizard (extends the #9 mapping UI): upload CSV → map columns (date BS/AD, party, items, accounts, amounts, tax) → validation pass (party/item/account resolution with fuzzy suggestions, per-row error report) → dry-run preview with computed totals → batch create as **drafts** (not auto-posted) → one-click post-all after review. Server endpoint accepts batches; respects doc sequences.

**Dependencies:** #9's CSV parser + mapping component; doc sequences (done 2026-09-09); journal void/reopen for corrections (done 2026-09-09).

## E. Audit-log viewer: saved filter views — **P3, M**

**Problem:** `AuditLog.tsx` has basic filters (3 mentions of filter in the file) but power users (auditors) repeat the same queries daily — "voided vouchers this week", "entries by user X" — with no way to save/share them.

**Proposed solution:** Persist named filter presets per user: encode current filters (date range, user, collection, action, doc type) to a querystring; "Save view" stores it (per-tenant collection or localStorage first iteration); a views dropdown restores them; shareable via URL. Optional: mark one view as the default landing filter.

**Dependencies:** none; audit log API already supports filtering.

## F. Fiscal-year close wizard — **P1, L**

**Problem:** Closing a BS fiscal year (mid-July) is currently manual and error-prone: nobody verifies the year is balanced, closing entries are hand-made, and opening balances for the new year are re-keyed. The 2026-09-09 groundwork (fiscal-year validation, opening-balances bulk save, journal void/reopen) removed the hard blockers but not the workflow.

**Proposed solution:** A step-by-step wizard in Settings: (1) pre-flight checks — all vouchers posted, no drafts, income/expense accounts net to zero, trial balance verified; (2) auto-generate closing journal entries; (3) compute + write next-year opening balances (reuse bulk save); (4) lock the year (status `closed`, server-side write guard on dated documents); (5) generate a year-end summary PDF (P&L, BS, trial balance). Each step reversible until final confirm; final step idempotent.

**Dependencies:** fiscal-year validation + opening-balances bulk save (done 2026-09-09); #10 report data layer for the summary PDF feeds; coordinate with `fiscalYear.tsx` status model.

## G. Notification center (server events → in-app toasts) — **P3, L**

**Problem:** Multi-user edits (another clerk posting the same voucher number, sync conflicts, renewals due, fiscal-year closed by an admin) are only discoverable by reloading. There is no toast/notification layer in the SPA today.

**Proposed solution:** Server-Sent Events endpoint (Payload hook → SSE stream per tenant); client `NotificationProvider` with a bell icon + unread badge + toasts (evaluate `sonner` vs in-house; keep bundle small); notification types: sync conflict resolved, document voided by another user, member renewal due (from data), fiscal-year events; "mark all read" persisted per user. Offline-tolerant: queue notifications while disconnected (SQLite/IndexedDB kv).

**Dependencies:** toast library decision; SSE support in the deployment (check the Postgres/Payload host allows long-lived connections); offline layer (exists) for queued delivery.

## H. Member portal (read-only fee status) — **P3, XL**

**Problem:** Members call the office to ask about their fee status/renewal date; the office answers by looking up Members. There's no self-service.

**Proposed solution:** A separate lightweight route/app (or Payload route) with phone/email + OTP login tied to the member record; shows: profile, fee status, renewal date (BS), payment history, printable receipt links. Strictly read-only, scoped per member; rate-limited OTP; no cross-member data access (server-side scoping tests mandatory). Later: dues reminders via SMS/email hooks.

**Dependencies:** member auth model (none exists — design decision: OTP vs password); security review (this touches personal data of non-users); hosting capacity; PII handling policy sign-off. Largest item here — spike first.

## I. PWA install prompt + offline indicator polish — **P3, M**

**Problem:** The app already ships `sw.js` + `UpdatePrompt.tsx` (version-poll reload banner), but installability is untapped: no custom install prompt, and offline state is invisible until an action fails.

**Proposed solution:** 1) Capture `beforeinstallprompt` → custom "Install Syasyah Billing" button (i18n) in the header/settings instead of relying on browser UI; 2) global online/offline indicator (banner + icon) driven by `navigator.onLine` + SyncEngine state — show pending outbox count ("3 changes waiting to sync"); 3) manifest polish (name, icons, theme color) so the installed window looks native; 4) cache-strategy audit for reports (stale-while-revalidate on read endpoints).

**Dependencies:** existing service worker + SyncEngine (`src/lib/sync/SyncEngine.ts`, `src/lib/offline/`); no backend work.

## J. Report scheduling (weekly PDF email) — **P3, L**

**Problem:** Committee members who never log in still need weekly summaries (cash statement, income/expense, outstanding invoices). Today someone must export and email manually.

**Proposed solution:** Scheduled jobs (cron on the server) that render a chosen report set to PDF and email to subscribers weekly (e.g. Sunday 07:00 NPT). Server-side PDF rendering (reuse report logic headlessly — needs the #10 report data layer extracted so it's callable outside React); mail transport (SMTP creds in env); per-tenant subscription management UI in Settings (report set, day, recipients); retry + failure notification to admins.

**Dependencies:** server-side report rendering (currently browser-rendered — the biggest lift); SMTP/mail transport decision; cron infra on the deployment host; i18n of scheduled emails.

---

### Suggested sequencing

1. **Quick wins (P1/P2, small):** A (#7), B, C.
2. **Mid:** D (after #9), E, I.
3. **Large, high-value:** F (fiscal-year close — do before the next mid-July close!), then G.
4. **Spikes first:** H (security/auth design), J (server-side PDF feasibility).
