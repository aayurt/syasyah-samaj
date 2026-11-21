# Plan: Arrange voucher form per transaction type — minimal, clean, consistent cards

**Target repo:** `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`
**Branch:** `feat/sales-invoice-edit-design` (deploy via `./LocalSyncDeployer.sh --rsync`, not git push)
**Main file:** `apps/billing/src/pages/VoucherForm.tsx`
**Shared card:** `apps/billing/src/components/VoucherNotesCard.tsx` (from sibling plan; create if not present)
**Test file:** `apps/billing/src/pages/VoucherForm.test.tsx`

---

## Goal

Re-arrange the voucher form so each transaction type renders a single clean, consistently-styled entry card with the right fields in a sensible order (type selector → required checklist → entry block → notes/attach → totals preview → save bar), sharing the same card shell and Notes/Attach card across all types.

---

## Current context / assumptions

**Verified state:** `tsc --noEmit` clean; 14/14 + 2 new vitest pass (isItemDocType gating deployed via `--rsync`, PM2 reloaded, commit `69286449`). Deployed live at `https://syasyahsamaj.com/app`.

**Current layout (top → bottom) in `VoucherForm.tsx`:**
1. Header (back + title) — line ~942
2. Doc Type Cards (icon grid, create mode) — line ~958
3. RequiredChecklist — line ~990
4. Top Row: Invoice No / Date / Party / Currency — line ~995
5. Item line table — `{isItem && ...}` — line ~1126 (big Item/Account/Sub-account/QTY/RATE/Discount table)
6. Notes + Attach Images inline — line ~1409 (plain textarea + attach button, NOT the shared card yet)
7. Item Summary card — `{isItem && ...}` — line ~1427 (discount/VAT/TDS/grand total)
8. Journal Lines — `{isJournal && ...}` — line ~1477 (Debit/Credit/Memo grid + balanced indicator)
9. Contra Fields — `{isContra && ...}` — line ~1543 (From/To/Amount 3-col strip)
10. Outstanding Invoices (receipt/payment) — line ~1574
11. Cash Flow Panel — `{isCash && ...}` — line ~1591 (simple 3-field strip + detailed amber table + payment method/tax)
12. Payment Details collapsible — `{isCash && !cashSimple && ...}` — line ~1778
13. Invoice Preview — line ~1811 (big right-side card: party, items/journal lines, totals breakdown)
14. Floating bottom bar (Cancel + Save/Post) — line ~1969

**Problems to fix:**
- Each type's entry block is stacked with inconsistent spacing/borders (cash detailed uses amber-200/amber-50; others use slate-200/white).
- Notes/Attach is inline, not the shared docType-accented `VoucherNotesCard`.
- Item Summary is a separate card after the item table; should live inside the item entry card.
- Invoice Preview duplicates totals already shown in Item Summary / journal totals; visually heavy.
- No consistent visual hierarchy — fields scatter across cards with different padding/borders.

**Type → entry block mapping (from prior plan):**
- Item-based (sales-quote, sales-order, sales-invoice, purchase-order, purchase-invoice, credit-note, debit-note, petty-cash-voucher, grn, delivery-challan) → item table
- Receipt/payment → cash panel (simple 3-field by default; detailed toggle inside same card)
- Journal → debit/credit grid
- Contra → From/To/Amount strip

---

## Architecture / proposed approach

Introduce one reusable `EntryCard` shell (same `rounded-lg border border-slate-200 bg-white p-5` for every type) with a small header strip (type label + icon). Wrap each type's entry block in it:

1. **Item types:** EntryCard containing the item table, then Item Summary folded into the same card (discount/VAT/TDS/grand total), then Notes/Attach card below.
2. **Receipt/payment:** EntryCard containing the cash panel (simple 3-field; detailed toggle reveals table + tax/TDS inside the same card), then Notes/Attach card below.
3. **Journal:** EntryCard containing the debit/credit grid + balanced indicator, then Notes/Attach card below.
4. **Contra:** EntryCard containing From/To/Amount, then Notes/Attach card below.

Remove the standalone Invoice Preview card (its content is already shown in the entry card's summary + floating bar total). Keep the RequiredChecklist and Top Row (Invoice No/Date/Party/Currency) above the entry cards. Keep Notes/Attach as the shared `VoucherNotesCard` (docType accent) below each entry card. Keep floating bottom bar for save.

**UI rules (questionable-taste-proof):**
- All entry cards: `rounded-lg border border-slate-200 bg-white p-5`, no per-type border colors.
- Card header: `text-xs uppercase tracking-wider font-semibold text-slate-400` label + `text-sm font-semibold text-slate-800` type name.
- Labels: `text-sm font-medium text-slate-700`, required `*` in `text-red-500`.
- Inputs: `rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500`.
- Monetary inputs: `font-mono text-right`.
- Buttons: consistent `text-sm font-medium` with hover states.
- Field order within a card: Party (if applicable) → line table/strip → Amount → summary totals.

---

## Step-by-step tasks

### Task 1 — Read-only audit: inventory every entry card's classes & order (10 min, read-only)

Confirm current markup by reading these regions of `apps/billing/src/pages/VoucherForm.tsx`:
- Lines 956–986 (Doc Type Cards)
- Lines 995–1125 (Top Row: Invoice No/Date/Party/Currency)
- Lines 1126–1390 (Item table + discount/TDS)
- Lines 1407–1425 (Notes + Attach Images inline)
- Lines 1427–1474 (Item Summary card)
- Lines 1477–1540 (Journal Lines)
- Lines 1543–1571 (Contra Fields)
- Lines 1591–1775 (Cash Flow Panel)
- Lines 1777–1805 (Payment Details collapsible)
- Lines 1811–1967 (Invoice Preview)
- Lines 1969–2166 (Floating bottom bar + submit)

Also confirm `VoucherNotesCard` exists at `apps/billing/src/components/VoucherNotesCard.tsx` (sibling plan) — if not, note it must be created first (plain textarea + attach button, docType-accented border, no collapsible behavior).

**Verification command (read-only):**
```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
ls src/components/VoucherNotesCard.tsx 2>/dev/null && echo "NOTES CARD EXISTS" || echo "NOTES CARD MISSING"
```
Expected: `TSC CLEAN`, exit 0; `Tests  16 passed (16)`; notes card status reported.

### Task 2 — Create `EntryCard` shell component (15 min)

Create `apps/billing/src/components/EntryCard.tsx`:

```tsx
import { ReactNode } from 'react'

interface EntryCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  accent?: 'slate' | 'indigo' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'orange' | 'lime' | 'cyan'
}

const ACCENT_BORDER: Record<string, string> = {
  slate: 'border-slate-200',
  indigo: 'border-indigo-200',
  blue: 'border-blue-200',
  violet: 'border-violet-200',
  emerald: 'border-emerald-200',
  amber: 'border-amber-200',
  rose: 'border-rose-200',
  orange: 'border-orange-200',
  lime: 'border-lime-200',
  cyan: 'border-cyan-200',
}

export default function EntryCard({ title, subtitle, children, accent = 'slate' }: EntryCardProps) {
  return (
    <section className={`mt-4 rounded-lg border ${ACCENT_BORDER[accent]} bg-white p-5`}>
      <div className="mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">{title}</span>
        {subtitle && <span className="ml-2 text-sm font-medium text-slate-600">{subtitle}</span>}
      </div>
      <div>{children}</div>
    </section>
  )
}
```

Use the `subtle` accent (slate) as default so cards look uniform; per-type color comes only from the shared `VoucherNotesCard` below (sibling plan).

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
```
Expected: `TSC CLEAN`, exit 0.

### Task 3 — Wrap item entry block in EntryCard + fold Item Summary inside (20 min)

In `VoucherForm.tsx`, replace the item table block (lines ~1126–1390) so it renders inside `<EntryCard title="Item Lines" subtitle={docType label}>`. Move the Item Summary card (lines ~1427–1474) to render at the bottom of the same EntryCard (remove its standalone wrapper). The Notes/Attach (Task 4) sits below.

Key edits:
- Wrap the item `<table>` (line ~1126) in `<EntryCard title="Item Lines" accent="slate">` … `</EntryCard>`.
- Replace the standalone `{isItem && (<div className="mt-4 rounded-lg border border-slate-200 bg-white">…Item Summary…</div>)}` (line ~1427) with a summary fragment rendered inside the item EntryCard, or a second EntryCard titled "Summary" directly after. Simplest: one EntryCard titled "Item Lines & Summary" containing table then summary rows.

Approach: single EntryCard per type. For item types, title = "Lines", contains the item table; then a second EntryCard titled "Summary" containing discount/VAT/TDS/grand total. This keeps each card small and scannable.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 4 — Replace inline Notes/Attach with shared VoucherNotesCard (15 min)

Replace lines ~1407–1425 (inline textarea + attach button) with:

```tsx
<VoucherNotesCard
  narration={narration}
  onNarrationChange={setNarration}
  docType={docType}
/>
```

Remove the now-duplicated inline textarea/attach markup. `VoucherNotesCard` provides the docType-accented border (indigo for sales invoice, etc.) per the sibling plan.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 5 — Wrap cash entry block in EntryCard (simple + detailed in one card) (15 min)

Replace the `{isCash && (<>…simple strip…detailed amber table…</>)}` block (lines ~1591–1775) so both simple mode and detailed mode live inside ONE `EntryCard` titled "Cash / Bank". Remove the amber border/background (`border-amber-200 bg-amber-50/60`) — use standard slate card. Keep the simple 3-field strip (Party/Amount/Cash-Bank) and the "Detailed Line Items" toggle that reveals the description/amount table + tax/TDS inside the same card.

Remove the separate "Payment Details" collapsible (line ~1777) — payment method + cash/bank account are already in the cash card; the collapsible adds redundant depth.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 6 — Wrap journal + contra entry blocks in EntryCard (15 min)

- Journal (lines ~1477–1540): wrap in `EntryCard` titled "Journal Lines"; keep Debit/Credit/Memo grid + balanced indicator inside.
- Contra (lines ~1543–1571): wrap in `EntryCard` titled "Contra Entry"; keep From/To/Amount 3-col strip inside.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 7 — Remove/reduce Invoice Preview card (15 min)

The Invoice Preview (lines ~1811–1967) duplicates totals already shown in each entry card's summary. Options:
- (Recommended) Remove it entirely — totals are in the entry card summary + floating bottom bar.
- Or shrink it to a read-only "Preview" toggle (collapsed by default).

Choose removal for minimal UI. Keep the party "Bill To" line (line ~1838) inside the entry card instead.

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 8 — Final layout order + visual QA (10 min)

Confirm final top-to-bottom order:
1. Header
2. Doc Type Cards (create mode)
3. RequiredChecklist
4. Top Row: Invoice No / Date / Party / Currency
5. EntryCard per type (item / cash / journal / contra)
6. VoucherNotesCard (shared, docType-accented)
7. Floating bottom bar (Cancel + Save/Post)

Run:
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN`; `Tests  16 passed (16)`.

### Task 9 — Commit + deploy + live verify (10 min)

```bash
git add apps/billing/src/pages/VoucherForm.tsx apps/billing/src/components/EntryCard.tsx
git commit -m "billing: arrange voucher form per type in clean entry cards"
./LocalSyncDeployer.sh --rsync
```
Expected: commit created; deploy `OK All done.` exit 0; PM2 reloads both apps.

Live verify (browser, `https://syasyahsamaj.com/app/vouchers/new`):
- Default Journal Entry → one EntryCard "Journal Lines" (Debit/Credit/Memo), VoucherNotesCard below, no item table, no separate preview card.
- Switch to Sales Invoice → EntryCard "Lines" (item table) + EntryCard "Summary" (totals), VoucherNotesCard indigo-accented below.
- Switch to Receipt → EntryCard "Cash / Bank" (Party/Amount/Cash-Bank 3-field), VoucherNotesCard below.
- Switch to Contra → EntryCard "Contra Entry" (From/To/Amount), VoucherNotesCard below.
- Refresh each → `?type=` persists (from prior turn), correct card re-renders.

---

## Tests / validation

Per-task TDD where logic exists (EntryCard is pure presentational — no test needed beyond tsc). The existing 16 vitest tests cover `isItemDocType` gating; they must continue to pass after every task.

- `npx tsc --noEmit` → exit 0 (after every task)
- `npx vitest run src/pages/VoucherForm.test.tsx` → 16 passed (after every task)
- `./LocalSyncDeployer.sh --rsync` → exit 0, PM2 reload both apps
- Live: each type shows exactly one EntryCard + VoucherNotesCard; no duplicate totals/preview card; `?type=` survives refresh

Commit convention (repo AGENTS.md): git author `Aayurt55 <aayurt.s@konvergex.com>`, feature branch + PR via `gh pr create` (no direct push to main).

---

## Risks, tradeoffs, and open questions

- **Invoice Preview removal:** some users may want a print-ready preview. Mitigation: totals are already in the entry card summary; print can be handled by the existing `PrintVoucher` component elsewhere. If the user wants it back, it's one collapsible toggle away.
- **Payment Details collapsible removal:** merges payment method into the cash card. Bank account field shows only when method=bank — keep that conditional inside the card.
- **`VoucherNotesCard` dependency:** this plan assumes the sibling plan's `VoucherNotesCard.tsx` exists (plain textarea + attach button, docType-accented, non-collapsible). If not created yet, Task 4 blocks until it exists — create it first (same file, same props: `narration`, `onNarrationChange`, `docType`).
- **EntryCard accent default:** using slate for all entry cards keeps it uniform; per-type color lives only in VoucherNotesCard. If the user wants per-type entry card borders, change `accent` prop per type (map docType → accent color).
- **No component-rendering tests:** existing test file tests pure functions only. Adding React Testing Library tests for card visibility per type would require router/providers setup — defer unless layout regressions appear.
