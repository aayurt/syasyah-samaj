# Plan: Complete Nepali Translation + Illaka Button Fix

## Goal
Wire `useT()` into every remaining hardcoded English string across the billing SPA, and reposition the Illaka "Add" button beside the Illaka selector with proper spacing.

---

## Part 1 — Illaka Button Repositioning

**Current:** IllakaSwitcher is a standalone dropdown. There may be a separate "Add Illaka" button elsewhere.

**Fix:** Move the "Add Illaka" button inside or directly beside the IllakaSwitcher component, with `gap-2` spacing. If no Add button exists, add one (a small "+" icon button next to the dropdown for central users).

**Files:** `apps/billing/src/components/IllakaSwitcher.tsx`

---

## Part 2 — Sidebar + Top Bar Translation

### 2A. Sidebar nav labels (App.tsx)
The `navGroups` array at line 81 has hardcoded English labels. Convert to use `useT()`:

```tsx
// Before:
{ items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] }
// After:
{ items: [{ to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard }] }
```

Then in the Shell component's sidebar rendering, resolve `labelKey` via `t(labelKey)`.

**Files:** `apps/billing/src/App.tsx` (navGroups + Shell sidebar rendering)

### 2B. Header / Shell chrome
The Shell component renders: email display, sync status, FY switcher, Illaka switcher, search button, command palette trigger. Translate:
- "Signed in as" → `t('header.email')`
- "Search & shortcuts" → `t('header.search')`
- Any other hardcoded header text

**Files:** `apps/billing/src/App.tsx` (Shell component)

---

## Part 3 — Component Translation

### 3A. IllakaSwitcher
- "All Illakas" → new key `illaka.all`
- "Switch illaka scope" → new key `illaka.switchScope`
- "Illaka" (fallback label) → new key `illaka.label`

### 3B. FiscalYearSwitcher
- "Add new fiscal year" title → new key `fy.addYear`
- "Switch fiscal year" title → new key `fy.switchScope`
- Any other hardcoded text

### 3C. SyncBanner (436 lines)
Hardcoded strings to translate:
- "Queued create/update/delete" → `sync.queuedCreate`, `sync.queuedUpdate`, `sync.queuedDelete`
- "could not sync" → `sync.couldNotSync`
- "server rejected it" → `sync.serverRejected`
- "Resolve" → `sync.resolve`
- "Edit" → `sync.edit`
- "Retry" → `sync.retry`
- "Discard" → `sync.discard`
- "Offline — new changes will be queued and synced when you reconnect." → `sync.offlineNotice`
- "Syncing…" → `sync.syncing`
- "Sync now" → `sync.syncNow`
- "{n} change(s) waiting to sync" → `sync.waitingToSync`
- "Offline — {n} change(s) queued locally" → `sync.offlineQueued`
- "{n} change(s) needs attention" → `sync.needsAttention`
- DraftBody labels: "Type", "Date", "Party", "Narration", "Payment", "Tax rate", "Item", "Description", "Qty", "Rate", "Amount", "Account", "Debit", "Credit", "Memo"

### 3D. CommandPalette (308 lines)
- "Search for transactions, parties & inventory…" → `palette.searchPlaceholder`
- "Searching…" → `palette.searching`
- "No results for" → `palette.noResults`
- "Shortcuts (for adding data)" → `palette.shortcuts`
- Shortcut labels: "Sales Invoice", "Purchase Invoice", "Payment", "Receipt", "Journal Entry", "Contra Entry", "Credit Note", "Add Item", "Add Party", "Dashboard" → `palette.shortcut.*`
- Footer: "to open · to navigate · to select" → `palette.footerHint`

### 3E. Tour (234 lines)
All 7 step titles + bodies + "Back"/"Next"/"Finish" buttons:
- `tour.step1.title`, `tour.step1.body`, etc.
- `tour.back`, `tour.next`, `tour.finish`
- "Close tour" aria-label → `tour.closeTour`

### 3F. UpdatePrompt
- "Update available" and any other text

### 3G. ConnectingBanner
- "Connecting…" and any other text

### 3H. ErrorBoundary
- "Something went wrong" and any other text

---

## Part 4 — Page Translation (remaining pages)

Pages that have `useT` imported but may still have hardcoded English strings. For each, find remaining hardcoded strings and replace with `t('key')` calls, adding keys to en.ts + ne.ts.

### Priority 1 — High-traffic pages:
- `pages/Journal.tsx` (24 useT calls — verify completeness)
- `pages/Transfers.tsx` (25 useT calls)
- `pages/Daybooks.tsx` (11 useT calls — likely incomplete)
- `pages/Items.tsx` (20 useT calls)
- `pages/ExpenseClaims.tsx` (24 useT calls)
- `pages/Members.tsx` (57 useT calls — likely good but verify)

### Priority 2 — Setup/admin pages:
- `pages/SetupWizard.tsx` (18 useT calls)
- `pages/Posting.tsx` (19 useT calls)
- `pages/AuditLog.tsx` (14 useT calls)
- `pages/BankReconciliation.tsx` (30 useT calls)
- `pages/Aging.tsx` (10 useT calls — likely incomplete)
- `pages/RecurringBilling.tsx` (16 useT calls)
- `pages/SetupOpeningBalances.tsx` (8 useT calls — likely incomplete)
- `pages/DataManagement.tsx` (18 useT calls)
- `pages/RecentActivity.tsx` (5 useT calls — very incomplete)

### Priority 3 — Reports:
- `pages/reports/BalanceSheet.tsx`
- `pages/reports/ProfitLoss.tsx`
- `pages/reports/SalesReport.tsx`
- `pages/reports/PurchaseReport.tsx`
- `pages/reports/ReportsHub.tsx`
- `pages/reports/StockQuantity.tsx`
- `pages/reports/TaxSales.tsx`
- `pages/reports/TaxPurchase.tsx`
- `pages/reports/LowStockSummary.tsx`
- `pages/reports/ExpenseCategory.tsx`

### Priority 4 — Login:
- `pages/Login.tsx` — "Not authorized", "You need an admin account", "Sign out", "Loading…"

---

## Part 5 — Dictionary Expansion

Add new keys to `en.ts` and `ne.ts` for every newly translated string. Group by namespace:

| Namespace | Purpose |
|-----------|---------|
| `illaka.*` | Illaka switcher labels |
| `fy.*` | Fiscal year switcher labels |
| `sync.*` | SyncBanner labels |
| `palette.*` | CommandPalette labels |
| `tour.*` | Tour step titles/bodies |
| `update.*` | UpdatePrompt labels |
| `connecting.*` | ConnectingBanner labels |
| `error.*` | ErrorBoundary labels |
| `journal.*` | Journal page labels |
| `transfers.*` | Transfers page labels |
| `daybooks.*` | Daybooks page labels |
| `items.*` | Items/Inventory page labels |
| `expenseClaims.*` | Expense Claims page labels |
| `members.*` | Members page labels |
| `setup.*` | Setup Wizard labels |
| `posting.*` | Posting page labels |
| `audit.*` | Audit Log page labels |
| `bankRec.*` | Bank Reconciliation page labels |
| `aging.*` | Aging Report page labels |
| `recurringBilling.*` | Recurring Billing page labels |
| `openingBalances.*` | Opening Balances page labels |
| `dataManagement.*` | Data Management page labels |
| `recentActivity.*` | Recent Activity page labels |
| `reports.*` | All report pages labels |
| `login.*` | Login page labels |

---

## Execution Order

1. **Part 1** — Illaka button reposition (1 file, quick)
2. **Part 2** — Sidebar + header translation (App.tsx)
3. **Part 3** — Component translation (8 components)
4. **Part 4** — Page translation (20+ pages)
5. **Part 5** — Dictionary expansion (en.ts + ne.ts)

Parts 2-5 can be parallelized across multiple subagents.

---

## Verification
- `npx tsc --noEmit` passes
- Toggle language in Settings → verify sidebar, header, all pages flip to Nepali
- No hardcoded English strings visible in Nepali mode (except amounts, codes, emails, phone numbers)
