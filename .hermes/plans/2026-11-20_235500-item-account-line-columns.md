# Plan: Manager.io-style Item + Account columns on voucher entry lines

## Goal
Add an **Account column** next to the Item column on each voucher entry line so that picking an Item auto-selects its fixed/default Account, and picking an Account (with Item empty) reveals a sub-account column — mirroring Manager.io's item-per-line behavior.

## Current context / assumptions
- Repo: `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`, billing app at `apps/billing/`.
- Entry lines live in `apps/billing/src/pages/VoucherForm.tsx`.
- `LineDraft` (VoucherForm.tsx:64-68) has `item` but **no** `account` field. `emptyLine()` (line 76-79) doesn't set one.
- Lines are loaded from server at line 513-524 (maps `l.item` but not account) and submitted at line 801-808 (sends `item, description, unit, qty, rate, taxRate, amount` but **no** account).
- Item cell UI is inline in VoucherForm.tsx lines 1348-1428 (custom dropdown, sets `item`/`description`/`rate`/`unit`). No Account column exists.
- `Item` type (`src/lib/types.ts:250-262`) has no default-account link.
- `Account` type (`src/lib/types.ts:73-87`) has `parent?: number | Account | null` (for sub-accounts) and `type`.
- `AccountSelect.tsx` (`src/components/AccountSelect.tsx`) is a reusable searchable account dropdown (`accounts, value, onChange, placeholder`).
- Tests: vitest; existing tests `VoucherForm.test.tsx`, `AccountSelect.test.tsx`. Run with `pnpm --dir apps/billing test` (verify exact script name in `apps/billing/package.json`).
- Deploy: `./LocalSyncDeployer.sh` (not part of this plan).

## Architecture / proposed approach
Three data changes + one UI change:
1. `Item.accountId?: number | null` — the fixed/default account an item posts to.
2. `LineDraft.account: string` — the GL account for the line; persisted on load and send on submit.
3. UI: entry-line row gets an **Account** cell right after the **Item** cell. Reuse `AccountSelect` for both cells.
   - Item chosen → if `item.accountId` set, auto-fill `line.account` (and hide sub-account).
   - Item empty + Account chosen (a parent account with children) → reveal a **Sub-account** cell listing child accounts (`Account.parent === selected`).
4. Load `l.account` from server lines; send `account` in submit payload.

## Step-by-step tasks

### Task 1 — Add `accountId` to `Item` type
File: `apps/billing/src/lib/types.ts` (line 250)
Add `accountId?: number | null` to the `Item` interface, with a `ponytail:` comment.

Copy-paste:
```ts
export interface Item {
  id: number
  code?: string
  name: string
  unit?: string
  accountId?: number | null   // ponytail: default GL account auto-selected when item is picked on a voucher line
  valuationMethod?: 'avco' | 'fifo'
  reorderLevel?: number
  openingStock?: number
  salePrice?: number
  purchasePrice?: number
  active?: boolean
  tenant?: number | null
}
```
Verification: `npx tsc --noEmit` in `apps/billing/` → exit 0, no errors referencing `Item`.

### Task 2 — Add `account` to `LineDraft` and `emptyLine()`
File: `apps/billing/src/pages/VoucherForm.tsx`
- Line 64-68: add `account: string` to `LineDraft`.
- Line 76-79: add `account: ''` to `emptyLine()`.

Copy-paste (LineDraft):
```ts
interface LineDraft {
  key: string; id?: string; item: string; description: string
  unit: string; qty: string; rate: string; taxType: string; taxRate: string; amount: string
  discountPct: string; discountAmt: string
  account: string            // GL account for this line
}
```
Copy-paste (emptyLine):
```ts
const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(), item: '', description: '', unit: '', qty: '', rate: '', taxType: '', taxRate: '', amount: '',
  discountPct: '', discountAmt: '', account: '',
})
```
Verification: `npx tsc --noEmit` → exit 0.

### Task 3 — Fetch accounts list in VoucherForm
File: `apps/billing/src/pages/VoucherForm.tsx`
- Confirm `api` / `list` import from `../lib/api` (read top of file first).
- Add `const [accounts, setAccounts] = useState<Account[]>([])` and a `useEffect` that calls `list<Account>('/gl-accounts', { depth: 0, ...tenantQuery })` (match the pattern used in `CashStatement.tsx:52`).
- Derive `subAccounts = accounts.filter(a => a.parent !== null)` and a helper `childrenOf(parentId: number)`.

Verification: `npx tsc --noEmit` → exit 0. (Runtime verified later via the form rendering without crash.)

### Task 4 — Persist `account` on load and submit
File: `apps/billing/src/pages/VoucherForm.tsx`
- Load (line 513-524): add `account: idOf(l.account) ?? '',` to the mapped line object.
- Submit (line 801-808): add `...(l.account ? { account: Number(l.account) } : {}),` to the line payload.

Verification: `npx tsc --noEmit` → exit 0.

### Task 5 — Add Account column cell to entry-line row
File: `apps/billing/src/pages/VoucherForm.tsx`, the `<tr>` block starting ~line 1345.
- Insert a `<td>` for Account immediately after the Item cell (after line 1428 `</td>`), before the Qty cell.
- Account cell: use `AccountSelect` with `value={l.account}`, `onChange={id => setLine(l.key, { account: id })}`, `accounts`.
- Reuse the existing inline item dropdown (do not refactor to a component yet — YAGNI).

Verification: `npx tsc --noEmit` → exit 0. Build: `pnpm --dir apps/billing build` → exit 0.

### Task 6 — Auto-fill account when item is picked
File: `apps/billing/src/pages/VoucherForm.tsx`, the item-dropdown `onClick` handlers (lines 1371-1374 and 1380-1383).
- In both `setLine(...)` calls, add `account: String(it.accountId || '')` so picking an item fills its default account.
- When item picked, clear any manual sub-account.

Copy-paste (both handlers):
```ts
setLine(l.key, { item: String(it.id), description: it.name, rate: String(it.salePrice || ''), unit: selectedUnit || '', account: String(it.accountId || '') })
setItemSearchRow(null); setItemSearchText('')
```

### Task 7 — Sub-account column when item empty + parent account chosen
File: `apps/billing/src/pages/VoucherForm.tsx`
- Add state `const [subAccountRow, setSubAccountRow] = useState<string | null>(null)` (row key currently being edited for sub-account).
- Add a Sub-account `<td>` rendered only when: `!l.item && l.account && childrenOf(Number(l.account)).length > 0`.
- Sub-account cell: a simple select/dropdown of `childrenOf(Number(l.account))`, bound to a new `subAccount: string` field on `LineDraft` (add to Task 2 interface) — OR reuse `l.account` to hold the leaf. Cleaner: keep `LineDraft.account` as the final posted account; sub-account selection writes into `l.account` too (leaf overrides parent). Simplest: sub-account dropdown `onChange` calls `setLine(l.key, { account: childId })`.
- When item is picked (Task 6), hide sub-account (condition `!l.item` handles it).

Verification: `npx tsc --noEmit` → exit 0. Build passes.

### Task 8 — i18n keys
File: `apps/billing/src/lib/i18n/en.ts` and `ne.ts`
Add keys used by new labels/placeholders (e.g. `vouchers.accountLabel`, `vouchers.subAccountLabel`, `vouchers.selectAccount`, `vouchers.selectSubAccount`) — check existing keys first to avoid duplicates; mirror `AccountSelect.tsx` placeholders (`accountSelect.selectAccount`).

Verification: run build; no missing-key warnings at runtime (spot-check form renders labels).

### Task 9 — Vitest: item auto-fills its default account
File: `apps/billing/src/pages/VoucherForm.test.tsx` (create if needed; follows `AccountSelect.test.tsx` pattern).
- Render voucher form in item mode with one item that has `accountId`.
- Select the item from the dropdown.
- Assert `line.account` === item's `accountId` (via the onChange capture or the rendered AccountSelect value).

Cycle: write failing test → `pnpm --dir apps/billing test` (expect fail) → implement (already done in Task 6) → `pnpm --dir apps/billing test` (expect pass) → commit.

### Task 10 — Commit
`git add -A && git commit -m "feat(billing): add Account + sub-account columns to voucher lines"` on branch `feat/sales-invoice-edit-design`. Do NOT push to main (repo rule: feature branch + PR).

## Tests / validation
- `npx tsc --noEmit` (apps/billing) — exit 0 after each code task.
- `pnpm --dir apps/billing build` — exit 0 after Task 5/7.
- `pnpm --dir apps/billing test` — vitest green after Task 9.
- Manual: open https://syasyahsamaj.com/app, create a sales invoice, pick an item → Account auto-fills; leave item empty, pick a parent account → Sub-account column appears.

## Risks, tradeoffs, open questions
- **Server-side account persistence**: The POST/payload contract for `lines[].account` is assumed accepted by the API. If the server ignores unknown fields, account won't persist — verify against the server's voucher schema or a test POST.
- **Item `accountId` backfill**: Existing items have no `accountId`; auto-fill only works for items that have it. Consider a server migration or admin UI to set default account per item (out of scope — YAGNI, flag as follow-up).
- **Sub-account UX**: rendering a third column widens rows; on mobile the row may wrap. Acceptable for v1; revisit if mobile complaints arise.
- **`AccountSelect` import**: confirm VoucherForm already imports from `../components/AccountSelect` or add the import in Task 5.
- **Line key collisions**: sub-account state keyed by `l.key` (UUID) — safe.
