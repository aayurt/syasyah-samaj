# Plan: Clean voucher page — shared Notes & Attachments card + per-transaction-type forms

**Target repo:** `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`
**Branch:** `feat/sales-invoice-edit-design` (deploy via `./LocalSyncDeployer.sh --rsync`, not git push)
**Main file:** `apps/billing/src/pages/VoucherForm.tsx`
**Component dir:** `apps/billing/src/components/`
**Test file:** `apps/billing/src/pages/VoucherForm.test.tsx`

---

## Goal

Extract Notes/Remarks + Attach Images into one reusable card that renders for **every** transaction type (not trapped inside the item-lines block), style the card per transaction type, and keep each transaction type's form fields in its own clearly-scoped card so the page reads cleanly and changes with the selected type.

---

## Current context / assumptions

- `VoucherForm.tsx` is ~2153 lines, single file. It already switches form layout by `docType`:
  - `isItem` (sales-invoice, purchase-invoice, quote, order, credit-note, debit-note, petty-cash-voucher, grn, delivery-challan, receipt-voucher, payment-voucher) → item table + item summary (lines ~1126–1461)
  - `isJournal` (`journal-voucher`) → account/debit/credit/memo grid (lines ~1463–1527)
  - `isContra` (`contra`) → from/to account + amount strip (lines ~1529–1558)
  - `isCash` (receipt/payment) → party/amount/cash-bank 3-field strip + optional detailed mode (lines ~1560–1659)
- `narration` state is declared at line ~370 (`useState('')`) and sent in `buildBody()` at line ~754 (`narration: narration || undefined`) for **all** types — already common.
- Notes textarea + "Attach Images" placeholder button are inline at lines ~1394–1412, sitting **after** the `isItem` fragment closes and **before** the item-summary card. Visually this lands inside the item area, not as its own shared card.
- Default `docType` = `journal-voucher`; `?type=` is written to search params and survives refresh (previous turn).
- `tsc --noEmit` is clean; 14 vitest tests pass; deploy works via `./LocalSyncDeployer.sh --rsync`.
- Imports already available in `VoucherForm.tsx`: `Camera`, `FileText`, `ChevronDown`, `ChevronUp`, `Plus`, `Trash2`, `ListPlus`, `ListCollapse` from `lucide-react`.

---

## Architecture / proposed approach

1. **New shared component** `apps/billing/src/components/VoucherNotesCard.tsx` — a simple (non-collapsible) card holding the `narration` textarea with placeholder and the "Attach Images" button. It accepts `narration`, `onNarrationChange`, `docType` only. The card gets a doc-type-specific accent (border + icon color) so it visually belongs to the selected transaction type. No file-upload backend yet — keep the Camera button as a disabled-styled placeholder with a hint (YAGNI: wire real upload only when asked).
2. **Replace** the inline notes/attach block in `VoucherForm.tsx` (lines ~1394–1412) with `<VoucherNotesCard />`, rendered once for all types, positioned after the per-type form card and before the item-summary/journal/cash cards. Remove the now-unused `notesSectionOpen` state if nothing else references it.
3. **Keep per-type form cards** as separate conditional blocks keyed on `docType` (already largely done). Make sure no per-type card is nested inside another type's fragment so each renders independently.
4. **Tests:** add a vitest suite for `VoucherNotesCard` (renders per doc type, toggles open/closed, narration flows to onChange) and one regression test that `buildBody` still includes `narration`. Follow RED-GREEN-REFACTOR per task.
5. **Deploy:** `./LocalSyncDeployer.sh --rsync` then verify `?type=` persistence + notes card on live site.

---

## Step-by-step tasks

### Task 1 — Read-only baseline: confirm exact line numbers & imports (5 min)

Verify current import block and notes-block boundaries before editing.

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```

Expected output: `TSC CLEAN` and `Tests  14 passed (14)`.

Read-only inspection (no edits): confirm `Camera`, `ChevronDown`, `ChevronUp` are imported from `lucide-react` in `VoucherForm.tsx`, and confirm the notes block is at lines ~1394–1412.

### Task 2 — Create `VoucherNotesCard.tsx` shared component (10 min)

Create `apps/billing/src/components/VoucherNotesCard.tsx` with full copy-pasteable code:

```tsx
import { ChevronDown, ChevronUp, Camera, FileText } from 'lucide-react'

interface VoucherNotesCardProps {
  narration: string
  onNarrationChange: (value: string) => void
  docType: string
}

const DOC_NOTES_STYLE: Record<string, { icon: React.ElementType; borderClass: string; iconClass: string; label: string }> = {
  'sales-invoice': { icon: FileText, borderClass: 'border-indigo-200', iconClass: 'text-indigo-600 bg-indigo-50', label: 'Sales Invoice' },
  'purchase-invoice': { icon: FileText, borderClass: 'border-blue-200', iconClass: 'text-blue-600 bg-blue-50', label: 'Purchase Invoice' },
  'journal-voucher': { icon: FileText, borderClass: 'border-violet-200', iconClass: 'text-violet-600 bg-violet-50', label: 'Journal Entry' },
  'payment-voucher': { icon: FileText, borderClass: 'border-emerald-200', iconClass: 'text-emerald-600 bg-emerald-50', label: 'Payment' },
  'receipt-voucher': { icon: FileText, borderClass: 'border-amber-200', iconClass: 'text-amber-600 bg-amber-50', label: 'Receipt' },
  contra: { icon: FileText, borderClass: 'border-cyan-200', iconClass: 'text-cyan-600 bg-cyan-50', label: 'Contra Entry' },
  'credit-note': { icon: FileText, borderClass: 'border-rose-200', iconClass: 'text-rose-600 bg-rose-50', label: 'Credit Note' },
  'debit-note': { icon: FileText, borderClass: 'border-orange-200', iconClass: 'text-orange-600 bg-orange-50', label: 'Debit Note' },
  'petty-cash-voucher': { icon: FileText, borderClass: 'border-lime-200', iconClass: 'text-lime-600 bg-lime-50', label: 'Petty Cash' },
  grn: { icon: FileText, borderClass: 'border-emerald-200', iconClass: 'text-emerald-600 bg-emerald-50', label: 'Goods Received' },
  'delivery-challan': { icon: FileText, borderClass: 'border-slate-200', iconClass: 'text-slate-600 bg-slate-50', label: 'Delivery Challan' },
  'sales-order': { icon: FileText, borderClass: 'border-indigo-200', iconClass: 'text-indigo-600 bg-indigo-50', label: 'Sales Order' },
  'purchase-order': { icon: FileText, borderClass: 'border-blue-200', iconClass: 'text-blue-600 bg-blue-50', label: 'Purchase Order' },
}

const DEFAULT_STYLE = DOC_NOTES_STYLE['journal-voucher']

export default function VoucherNotesCard({
  narration,
  onNarrationChange,
  docType,
}: VoucherNotesCardProps) {
  const style = DOC_NOTES_STYLE[docType] || DEFAULT_STYLE
  const Icon = style.icon

  return (
    <div className={`rounded-lg border ${style.borderClass} bg-white p-5`}>
      {/* Remarks / Notes */}
      <div>
        <label className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
          Remarks / Notes
        </label>
        <textarea
          rows={4}
          value={narration}
          onChange={(e) => onNarrationChange(e.target.value)}
          placeholder={tNotAvailablePlaceholder()}
          className="w-full resize-none rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500"
        />
      </div>

      {/* Attach Images */}
      <div className="mt-4">
        <label className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
          Attach Images
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-placeholder="Coming soon"
            className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500 cursor-not-allowed"
          >
            <Camera size={24} />
          </button>
          <span className="text-xs text-slate-400">
            Upload receipts, invoices, or supporting documents
          </span>
        </div>
      </div>
    </div>
  )
}

// placeholder so the component has no external i18n dependency
function tNotAvailablePlaceholder(): string {
  return 'Enter note or description...'
}
```

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
```
Expected: `TSC CLEAN`, exit 0.

### Task 3 — Replace inline notes block with `<VoucherNotesCard />` (10 min)

In `apps/billing/src/pages/VoucherForm.tsx`:

1. Add import at top of file (alphabetical with other component imports):
   ```tsx
   import VoucherNotesCard from '@/components/VoucherNotesCard'
   ```
   (Use the exact import path convention already used in the file for `@/components/*`.)

2. Replace the inline block at lines ~1394–1412:

   OLD (lines ~1394–1412):
   ```tsx
   {/* ── Notes (collapsible) ─────────────────────────────── */}
   {/* ── Attach Images ───────────────────────────────────── */}
   <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
     <textarea rows={4} value={narration} onChange={(e) => setNarration(e.target.value)}
       placeholder={t('vouchers.notePlaceholder', 'Enter note or description...')}
       className="w-full resize-none rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500" />

     {/* ── Attach Images ───────────────────────────────────── */}
     <div className="mt-4">
       <label className="text-sm font-medium text-slate-700">{t('vouchers.attachImages', 'Attach Images')}</label>
       <div className="mt-2 flex items-center gap-3">
         <button type="button"
           className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500">
           <Camera size={24} />
         </button>
         <span className="text-xs text-slate-400">{t('vouchers.uploadHint', 'Upload receipts, invoices, or supporting documents')}</span>
       </div>
     </div>
   </div>
   ```

   NEW:
   ```tsx
   {/* ── Notes & Attachments (shared across all transaction types) ── */}
   <VoucherNotesCard
     narration={narration}
     onNarrationChange={setNarration}
     docType={docType}
   />
   ```

   `notesSectionOpen` is no longer used by the notes card — remove its declaration (line ~441) if nothing else references it.

   Remove the now-unused `ChevronDown`/`ChevronUp` imports from `VoucherForm.tsx` if they become unused elsewhere (check via `tsc`).

3. Remove the now-unused `Camera` import from `VoucherForm.tsx` if it becomes unused elsewhere (check via `tsc`).

**Verification command:**
```bash
npx tsc --noEmit && echo "TSC CLEAN"
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `TSC CLEAN` and `Tests  14 passed (14)`.

### Task 4 — Vitest for `VoucherNotesCard` (15 min, TDD)

Create `apps/billing/src/components/VoucherNotesCard.test.tsx`.

RED — write failing test first:

```tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import VoucherNotesCard from './VoucherNotesCard'

describe('VoucherNotesCard', () => {
  it('renders notes textarea and attach button', () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <VoucherNotesCard narration="" onNarrationChange={() => {}} docType="journal-voucher" />
    )
    expect(getByPlaceholderText('Enter note or description...')).toBeInTheDocument()
    expect(getByLabelText(/Attach Images/i)).toBeInTheDocument()
  })

  it('renders doc-type accent border', () => {
    const { container } = render(
      <VoucherNotesCard narration="" onNarrationChange={() => {}} docType="sales-invoice" />
    )
    expect(container.firstChild).toHaveClass('border-indigo-200')
  })

  it('flows narration to onChange', () => {
    let value = ''
    const { getByPlaceholderText } = render(
      <VoucherNotesCard narration="" onNarrationChange={(v) => { value = v }} docType="journal-voucher" />
    )
    fireEvent.input(getByPlaceholderText('Enter note or description...'), { target: { value: 'test remark' } })
    expect(value).toBe('test remark')
  })
})
```

GREEN — implement (Task 2 already provides implementation). Run:

```bash
npx vitest run src/components/VoucherNotesCard.test.tsx 2>&1 | tail -8
```
Expected: all 3 tests pass.

### Task 5 — Regression test: `buildBody` still sends `narration` for all types (10 min, TDD)

Add one test to `apps/billing/src/pages/VoucherForm.test.tsx` (RED first — a failing assertion that `narration` is present in the submit body). Since `buildBody` is not exported, test through the existing submit path or via rendered form: change narration, click save, assert the request body contains `narration`. Follow the pattern of the 14 existing tests in that file.

Verification:
```bash
npx vitest run src/pages/VoucherForm.test.tsx 2>&1 | tail -5
```
Expected: `Tests  15 passed (15)` (or 16 if two added).

### Task 6 — Deploy + live verify (10 min)

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
./LocalSyncDeployer.sh --rsync
```
Expected: `OK All done. Check https://syasyahsamaj.com/ to confirm.` exit 0.

Live verification (browser):
1. Open `https://syasyahsamaj.com/app/vouchers/new` → default = Journal Entry, notes card visible with violet accent.
2. Switch type to Sales Invoice → URL gains `?type=sales-invoice`, notes card switches to indigo accent, form shows item table.
3. Refresh → `?type=sales-invoice` persists, notes card retains indigo accent.
4. Type something in Remarks → persists on refresh (narration is local state; note it resets on hard refresh unless persisted — call out as open question).

---

## Tests / validation

Per task TDD cycle: write failing test → run → implement minimally → run → pass → commit.

- `npx tsc --noEmit` → exit 0
- `npx vitest run src/pages/VoucherForm.test.tsx` → 14+ pass
- `npx vitest run src/components/VoucherNotesCard.test.tsx` → 4 pass
- Deploy `./LocalSyncDeployer.sh --rsync` → exit 0, PM2 reloads both apps
- Live: notes card renders for every type; `?type=` survives refresh; default = Journal Entry

Commit convention (per repo AGENTS.md): git author `Aayurt55 <aayurt.s@konvergex.com>`, feature branch + PR via `gh pr create` (no direct push to main).

---

## Risks, tradeoffs, and open questions

- **Narration not persisted on hard refresh:** `narration` is local `useState`; a full page reload clears it. `?type=` persists via search params, but `narration` does not. Open question: should `narration` also be written to `?notes=` or `sessionStorage`? Decide with user before adding.
- **Attach Images button is disabled placeholder:** No upload backend wired. Deliberate YAGNI — the button shows intent but does nothing. If user wants real uploads, that's a separate task (file input + API endpoint).
- **Single-file component bloat:** `VoucherForm.tsx` is already ~2153 lines. Extracting `VoucherNotesCard` reduces it slightly; further per-type card extraction (item card, journal card, cash card) is deferred — only if the user asks.
- **Import path:** `@/components/VoucherNotesCard` must match whatever alias `VoucherForm.tsx` already uses for `@/components/*`; verify in Task 3 before writing.
- **lucide-react icons:** `ChevronDown`, `ChevronUp`, `Camera`, `FileText` must all be exported from the installed `lucide-react` version — `tsc` will catch a bad import.
