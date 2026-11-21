# Plan: Hide item line form when not needed per transaction type

**Target repo:** `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`
**Branch:** `feat/sales-invoice-edit-design` (deploy via `./LocalSyncDeployer.sh --rsync`, not git push)
**Main file:** `apps/billing/src/pages/VoucherForm.tsx`
**Test file:** `apps/billing/src/pages/VoucherForm.test.tsx`

---

## Goal

Make the item line table (Item / Account / Sub-account / Qty / Rate / Discount) render **only** for transaction types that actually use items, and be removed/hidden for types that don't — so receipt/payment show the cash panel only, journal shows the debit/credit grid only, contra shows from/to account only, and each type shows exactly one line-entry UI.

---

## Current context / assumptions

**Type constants** (top of `VoucherForm.tsx`):
- `INVENTORY_TYPES = ['sales-invoice', 'delivery-challan', 'grn', 'purchase-invoice', 'credit-note', 'debit-note']` (line 85)
- `CASH_TYPES = ['payment-voucher', 'receipt-voucher']` (line 86)
- `ORDER_TYPES = ['sales-order', 'purchase-order']` (line 88)

**Derived booleans** (lines 574–588):
- `isItem` (line 574–576): array includes `'sales-quote', 'sales-order', 'sales-invoice', 'purchase-order', 'purchase-invoice', 'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan', 'receipt-voucher', 'payment-voucher'` — **includes receipt/payment**, so the item table renders for them.
- `isCash = CASH_TYPES.includes(docType)` (line 579) → receipt/payment.
- `isJournal = docType === 'journal-voucher'` (line 578).
- `isContra = docType === 'contra'` (line 577).

**What renders per type today:**
- Item table: `{isItem && ...}` at line ~1126 → shows for receipt/payment too (overlap).
- Item Summary card: `{isItem && ...}` at line ~1414 → shows for receipt/payment too.
- Cash panel (`{isCash && ...}` at line ~1578): shows for receipt/payment → **so receipt/payment currently show BOTH item table AND cash panel**.
- Journal grid: `{isJournal && ...}` at line ~1464.
- Contra fields: `{isContra && ...}` at line ~1530.
- Outstanding invoices block (line ~1561): receipt/payment only, stays with cash panel.

**Submit validation** (lines 876–882): loops `lines` and errors `"Each line needs an Item or Account"` when `!l.item && !l.account`, with **no docType guard**. `lines` defaults to `[emptyLine()]` (item='', account=''), so this would also block contra/journal/simple-cash submit even though they don't use `lines` as their primary entry.

**Verified working state:** `tsc --noEmit` clean; 14/14 vitest pass; deploy via `./LocalSyncDeployer.sh --rsync` works.

---

## Architecture / proposed approach

1. **Redefine `isItem`** to exclude `'receipt-voucher'` and `'payment-voucher'` — they are cash types and use the cash panel, not the item table. Journal/contra already excluded.
2. **Scope line validation** to `isItem` types only: only item-based types require each line to have Item or Account. Cash-simple receipts (description + amount, no item/account), contra, and journal are exempt.
3. **Result:** each doc type shows exactly one line-entry UI:
   - Item-based (sales/purchase invoice, quote, order, credit/debit note, petty cash, GRN, delivery challan) → item table + item summary.
   - Receipt/payment → cash panel (+ outstanding invoices when party set).
   - Journal → debit/credit grid.
   - Contra → from/to account strip.
4. **Tests:** vitest — render form per type, assert item table present/absent; assert simple-cash submit isn't blocked by item/account validation.
5. **Deploy:** `./LocalSyncDeployer.sh --rsync`; live verify `?type=` persistence + correct panel per type.

---

## Step-by-step tasks

### Task 1 — Audit baseline: confirm current visibility per type (read-only, 5 min)

Confirm exact gating by reading these regions of `apps/billing/src/pages/VoucherForm.tsx`:
- Lines 574–588 (`isItem`, `isCash`, `isJournal`, `isContra` definitions)
- Lines 1126–1391 (item table block, `{isItem && ...}`)
- Lines 1414–1461 (item summary card, `{isItem && ...}`)
- Lines 1463–1527 (journal grid, `{isJournal && ...}`)
- Lines 1529–1558 (contra fields, `{isContra && ...}`)
- Lines 1560–1648 (cash panel + outstanding invoices, `{isCash && ...}`)
- Lines 874–882 (submit line validation)

**Verification command (read-only, no edits):**
```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`, exit 0; `Tests  14 passed (14)`.

**Expected finding to document:** receipt/payment render BOTH the item table (isItem includes them) and the cash panel (isCash includes them) — the item form is NOT removed for receipt/payment.

### Task 2 — Exclude receipt/payment from `isItem` (10 min)

Edit `apps/billing/src/pages/VoucherForm.tsx`, line 574–576.

OLD:
```tsx
  const isItem = ['sales-quote', 'sales-order', 'sales-invoice', 'purchase-order', 'purchase-invoice',
    'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan',
    'receipt-voucher', 'payment-voucher'].includes(docType)
```

NEW:
```tsx
  // Item-based document types use the item line table (Item / Account / Sub-account / Qty / Rate).
  // Receipt / payment are cash types — they use the cash panel, not the item table.
  // Journal / contra use their own line-entry UI and are already excluded.
  const isItem = ['sales-quote', 'sales-order', 'sales-invoice', 'purchase-order', 'purchase-invoice',
    'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan'].includes(docType)
```

No other references to `isItem` need changing — the item table (line ~1126) and item summary card (line ~1414) are already gated by `isItem`, so they'll drop out for receipt/payment automatically.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
```
Expected: `TSC CLEAN`, exit 0.

### Task 3 — Scope line validation to `isItem` types only (10 min)

Edit `apps/billing/src/pages/VoucherForm.tsx`, lines 874–882. Wrap the item/account validation so it only runs for item-based types. Cash-simple receipts/payments carry `description` + `amount` on `lines[0]` with no `item`/`account` — they must not be blocked. Contra/journal don't use `lines` as primary entry either.

OLD:
```tsx
    // Validate: each line needs Item or Account; parent Account without Item needs Sub-account
    for (const l of lines) {
      if (!l.item && !l.account) { setError('Each line needs an Item or Account'); setSaving(false); return }
      if (!l.item && l.account) {
        const hasChildren = accounts.some((a) => a.parent !== null && Number(a.parent) === Number(l.account))
        if (hasChildren && !l.subAccount) { setError('Select a Sub-account for this Account'); setSaving(false); return }
      }
    }
```

NEW:
```tsx
    // Validate: each line needs Item or Account; parent Account without Item needs Sub-account.
    // Only item-based document types use `lines` as their primary line entry with item/account.
    // Cash-simple receipt/payment carries description+amount (no item/account) — exempt.
    // Journal uses journalLines; contra uses fromAccount/toAccount — exempt.
    if (isItem) {
      for (const l of lines) {
        if (!l.item && !l.account) { setError('Each line needs an Item or Account'); setSaving(false); return }
        if (!l.item && l.account) {
          const hasChildren = accounts.some((a) => a.parent !== null && Number(a.parent) === Number(l.account))
          if (hasChildren && !l.subAccount) { setError('Select a Sub-account for this Account'); setSaving(false); return }
        }
      }
    }
```

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`, exit 0; `Tests  14 passed (14)` (existing tests still pass).

### Task 4 — Vitest: item table visibility per type + cash-simple validation (20 min, TDD)

Add tests to `apps/billing/src/pages/VoucherForm.test.tsx`. Follow RED-GREEN: write failing test first, run to confirm failure, implement (Tasks 2–3 already done), run to confirm pass.

RED — append these tests (they should fail before Tasks 2–3, pass after):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// adjust import path to match the existing test file's import of VoucherForm
import VoucherForm from './VoucherForm'

describe('VoucherForm line-entry UI per transaction type', () => {
  // Helper: render with a given ?type= search param. Match the existing test file's render wrapper
  // (router, tenant, query-client provider) as used by the 14 existing tests.
  const renderWithType = (type: string) => {
    // use the same render setup as existing tests in this file
    return render(<VoucherForm mode="create" />)
  }

  it('renders item table for sales-invoice', () => {
    const { getByText } = renderWithType('sales-invoice')
    expect(getByText(/Item/i)).toBeInTheDocument()
    expect(getByText(/Account/i)).toBeInTheDocument()
  })

  it('hides item table for receipt-voucher (shows cash panel instead)', () => {
    const { queryByText, getByText } = renderWithType('receipt-voucher')
    // item table headers should not be present
    expect(queryByText(/Sub-account/i)).not.toBeInTheDocument()
    // cash panel fields should be present
    expect(getByText(/Cash \/ Bank Account/i)).toBeInTheDocument()
  })

  it('hides item table for payment-voucher', () => {
    const { queryByText } = renderWithType('payment-voucher')
    expect(queryByText(/Sub-account/i)).not.toBeInTheDocument()
  })

  it('hides item table for journal-voucher (shows journal grid)', () => {
    const { queryByText, getByText } = renderWithType('journal-voucher')
    expect(queryByText(/Sub-account/i)).not.toBeInTheDocument()
    expect(getByText(/Debit/i)).toBeInTheDocument()
    expect(getByText(/Credit/i)).toBeInTheDocument()
  })

  it('hides item table for contra (shows from/to account)', () => {
    const { queryByText, getByText } = renderWithType('contra')
    expect(queryByText(/Sub-account/i)).not.toBeInTheDocument()
    expect(getByText(/From account/i)).toBeInTheDocument()
    expect(getByText(/To account/i)).toBeInTheDocument()
  })
})

describe('VoucherForm submit validation', () => {
  it('allows simple-cash receipt submit without item/account on the amount line', () => {
    // Render receipt-voucher, fill party + amount, click save → should NOT show
    // "Each line needs an Item or Account" error. Match existing test file's submit flow.
    expect(true).toBe(true) // placeholder — replace with real render+submit assertion following existing test patterns
  })
})
```

> Note: `renderWithType` must reuse the exact provider/router wrapper the existing 14 tests use (read the top of `VoucherForm.test.tsx` to copy it). The `type` param currently isn't wired into the render helper — if the existing tests mount `VoucherForm` without a router/search-param context, pass `type` via a wrapper or set `window.location.search` before render. Adapt to the file's existing conventions.

GREEN — Tasks 2 and 3 already implement the behavior. Run:

```bash
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -8
```
Expected: all existing + new tests pass (14 + N).

Commit after green.

### Task 5 — Deploy + live verify (10 min)

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
./LocalSyncDeployer.sh --rsync
```
Expected: `OK All done.` exit 0; PM2 reloads `syasha-samaj` + `syasha-samash-staging`.

Live verification (browser, `https://syasyahsamaj.com/app/vouchers/new`):
1. Default = Journal Entry → journal grid (Account/Debit/Credit/Memo), NO item table.
2. Switch to Sales Invoice (`?type=sales-invoice`) → item table appears, cash panel hidden.
3. Switch to Receipt (`?type=receipt-voucher`) → cash panel (Party / Amount / Cash-Bank), NO item table, NO item summary.
4. Switch to Contra (`?type=contra`) → From/To account strip, NO item table.
5. Refresh each → `?type=` persists (from prior turn), correct panel re-renders.

---

## Tests / validation

Per-task TDD: write failing test → run → implement minimally → run → pass → commit.

- `npx tsc --noEmit` → exit 0
- `npx vitest run src/pages/VoucherForm.test.tsx` → all pass (14 + new)
- `./LocalSyncDeployer.sh --rsync` → exit 0, PM2 reload both apps
- Live: each type shows exactly one line-entry UI; `?type=` survives refresh

Commit convention (repo AGENTS.md): git author `Aayurt55 <aayurt.s@konvergex.com>`, feature branch + PR via `gh pr create` (no direct push to main).

---

## Risks, tradeoffs, and open questions

- **Validation blind spot discovered:** the existing "Each line needs an Item or Account" check has no docType guard and would block contra/journal/simple-cash submit (all start with `lines=[emptyLine()]`). Task 3 scopes it to `isItem`. Verify contra/journal/simple-cash submit actually works after the change — if contra/journal were already submitting, something else may be masking this; confirm with live test.
- **Petty cash** stays in `isItem` (it uses item/expense lines) — confirm that's intended; petty cash posts Expense dr / Petty Cash cr and may be party-optional.
- **`lines` state still initialized as `[emptyLine()]` for all types** even when unused (contra/journal). Harmless memory-wise, but `buildBody` only reads `lines` for isItem and isCash. No change needed (YAGNI).
- **`renderWithType` helper** — the existing test file's render setup must be reused exactly (router + providers). If `VoucherForm` reads `useSearchParams`/`useParams`, tests need a router wrapper or `window.location.search` stub. Copy the pattern from an existing test in the file rather than inventing a new one.
- **Attach Images / Notes** (planned in sibling plan) are unrelated to this task — leave as-is here.
