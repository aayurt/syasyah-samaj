# Financial Reporting Engine — Audit Report

**Scope:** trial balance, ledger, profit & loss, balance sheet, daybook (reporting layer) + the posting rules that feed them.
**Stand:** read-only audit. No code was changed.
**Files audited:** `src/collections/JournalEntries/index.ts`, `src/utilities/journalSums.ts`, `src/utilities/journalValidation.ts`, `src/collections/Documents/index.ts` (posting rules / void), `billing-seed.mjs`.

Convention: amounts use `dr - cr` per account; income/expense/liability/equity are presented on their natural (credit) side. `JOURNAL_EPSILON = 0.001`.

---

## Findings

### 1. Reports silently truncate when more than 1000 posted entries exist in range
**Issue:** Trial balance, P&L, balance sheet, ledger, and daybook drop entries beyond the 1000-row fetch cap, so accounts go missing and totals/balances are understated; `balanced` and `closingBalance` are computed on a partial set.
**Module:** Trial balance / P&L / balance sheet / ledger / daybook.
**Root cause:** `sumPostedByAccount` fetches `limit: 1000` with no pagination and sums in JS (`src/utilities/journalSums.ts:15-21`); callers assume the set is complete (`JournalEntries/index.ts:70,242,331`). The ledger endpoint also caps entries at `limit: 1000` (`JournalEntries/index.ts:143-149`) and accumulates `runningBalance` over that truncated set (`:175-209,220`).
**Severity:** High — silent misstatement at scale.
**Correction:** paginate/aggregate server-side until the entry set is exhausted (or aggregate in SQL), and never report totals/`balanced` from a possibly-truncated fetch without surfacing truncation.
**File:line:** `src/utilities/journalSums.ts:18`; `src/collections/JournalEntries/index.ts:70,143-149,175-209,220,242,331`.

### 2. P&L COGS bucket keys off a single settings account ID
**Issue:** Only the account in `settings.cogsAccount` is routed to COGS; every other expense-typed account lands in Other Expense. COGS is understated, Gross Profit overstated, Other Expense overstated; Net Profit happens to be unchanged but its components are wrong.
**Module:** Profit & Loss.
**Root cause:** `cogsAccountId` resolved from settings (`JournalEntries/index.ts:255-257`) and matched by exact id (`:275-279`), not by account class/type. Multi-COGS charts of accounts cannot be classified correctly.
**Severity:** Medium — distorts gross margin presentation.
**Correction:** bucket by account class/COGS flag, or support a list of COGS accounts from settings; classify by account metadata, not one ID.
**File:line:** `src/collections/JournalEntries/index.ts:255-279`.

### 3. Purchase credit notes / voids credit an income-typed returns account, inflating income
**Issue:** Voiding or crediting a purchase debits AP and credits `returnsAccount` ("Sales & Purchase Returns", typed `income`) for the full value (`Documents/index.ts:794-796`). P&L treats every `income`-type account as income (`JournalEntries/index.ts:265-269`), so a credit there increases reported income instead of reducing the original expense. A purchase void overstates Net Profit and leaves the original expense in place.
**Module:** Profit & Loss, Balance Sheet (via equity), Ledger.
**Root cause:** one returns account shared by sales and purchase returns, typed `income`; the credit-note rule always credits it on the purchase side, and the reporter cannot distinguish contra accounts. Verified by simulation: voiding purchase invoice #3 inflates income by the full gross (13,560) with expense unchanged.
**Severity:** High — direct P&L misstatement on returns/voids.
**Correction:** post purchase returns to a contra-expense account (or debit the original expense account); segregate contra accounts from genuine income; do not route purchase returns through an income-typed account.
**File:line:** `src/collections/Documents/index.ts:773-828` (esp. `:794-796`); `src/collections/JournalEntries/index.ts:265-280`.

### 4. Document void posts a `credit-note` rule for every doc type — wrong accounts for non-invoice documents
**Issue:** The void handler hard-codes `creditNoteType = 'credit-note'` and posts it through `buildPostingLines`, while the original journal entry stays `posted`. For payment vouchers, receipt vouchers, journal vouchers, contra vouchers, GRNs, and petty-cash vouchers, the credit note does **not** reverse the original legs (e.g., voiding a payment voucher leaves `Dr AP / Cr Bank` in place and adds `Dr Sales Returns / Cr AR`). Ledger, trial balance, P&L and balance sheet are all corrupted after any non-invoice void.
**Module:** Ledger / Trial balance / P&L / Balance sheet (via void).
**Root cause:** void does not reverse the original entry line-for-line and does not dispatch by original `docType`; it re-posts a generic credit-note rule (`Documents/index.ts:1677,1692-1716,1734-1738`). Contrast `JournalEntries/:id/void`, which does a true line-for-line swap (`JournalEntries/index.ts:784`).
**Severity:** High — ledger/report corruption on void of any non-invoice document.
**Correction:** reverse the original journal entry line-for-line (swap debit/credit) or dispatch the void posting rule by the original `docType`; mark the original entry voided rather than leaving it posted alongside an unrelated credit note.
**File:line:** `src/collections/Documents/index.ts:1611-1780` (esp. `:1677,1734-1738`).

### 5. Cross-illaka transfer posts identical legs in both entries, doubling the amount
**Issue:** Both legs of a transfer post `Cr fromAccount / Dr toAccount`, so each account is hit twice. Per-account bank/cash balances are wrong (2×). The trial balance still balances (each entry is internally balanced) and total assets are unchanged, so the error is stealthy — it shows up only in individual account balances and ledgers.
**Module:** Ledger / Balance sheet account balances / Trial balance (per-row).
**Root cause:** `je1` (`JournalEntries/index.ts:602-605`) and `je2` (`:619-622`) contain the exact same line set instead of each leg posting only its own side plus a clearing/contra account. Verified by simulation: a 1,000 transfer leaves Bank credited 2,000 and Cash debited 2,000 instead of 1,000 each.
**Severity:** High — account balances misstated; TB `balanced` flag gives false confidence.
**Correction:** each leg should post its own side (fromTenant credits its account; toTenant debits its account) balanced by an inter-illaka clearing account, so neither account is doubled.
**File:line:** `src/collections/JournalEntries/index.ts:594-626` (esp. `:602-605,:619-622`).

### 6. No contra-account / normal-balance handling on the balance sheet
**Issue:** Balance sign is derived solely from `a.type` (`asset = dr - cr`; `liability/equity = cr - dr`). A credit-balance asset (contra-asset such as accumulated depreciation) reduces total assets; a debit-balance liability inflates liabilities. Contra accounts are neither segregated nor flagged, so balance sheet totals and the `balanced` check can be silently wrong.
**Module:** Balance sheet.
**Root cause:** sign logic keys on `type` only, with no normal-balance or contra attribute (`JournalEntries/index.ts:353-363`). Latent — no contra accounts exist in the seed.
**Severity:** Medium — latent classification risk.
**Correction:** add a contra/normal-balance attribute to accounts and flip the sign; present contra accounts as contra lines rather than netting into the natural balance.
**File:line:** `src/collections/JournalEntries/index.ts:353-363,394-402`.

### 7. Balance sheet is movement-only within the date range; no opening-balance carryforward
**Issue:** With `from` set mid-year, the report shows only movements in the range (opening balances omitted), so it is not the true financial position — although `A = L + E` still holds for the range, so `balanced` reads true and hides the omission.
**Module:** Balance sheet.
**Root cause:** balances are computed from posted entries in range only; no opening-balance brought forward (`JournalEntries/index.ts:344-380`).
**Severity:** Low/Medium — design limitation, not a calculation error.
**Correction:** carry forward opening balances, or document the report as movement-only.
**File:line:** `src/collections/JournalEntries/index.ts:316-403`.

### 8. Daybook `closingBalance` is meaningless (0) for non-cash types
**Issue:** `running` is only accumulated for `cash`/`petty-cash`; for `sales`/`purchase`/`journal`/`all` it stays 0 and is returned as `closingBalance`.
**Module:** Daybook.
**Root cause:** `running` update gated on type (`JournalEntries/index.ts:535-541`) but `closingBalance` is always returned (`:553`).
**Severity:** Low — cosmetic/wrong field for non-cash daybooks.
**Correction:** omit `closingBalance` for non-cash types or compute the relevant register balance.
**File:line:** `src/collections/JournalEntries/index.ts:535-541,553`.

### 9. Fragile rounding and silent coercion of bad amounts
**Issue:** `round2` uses `+ Number.EPSILON` before multiplying by 100 — a fragile float fix that can mis-round exact .5 boundary cases; `toNum` coerces non-numeric/missing values to 0 instead of rejecting them (`journalValidation.ts:10-17`). Posted entries are validated at entry time, so impact on reporting is limited to legacy/bad data.
**Module:** All reports (shared utilities).
**Severity:** Low.
**Correction:** use decimal math or a well-tested round-half-up; reject non-numeric amounts at trust boundaries rather than coercing to 0.
**File:line:** `src/utilities/journalValidation.ts:10-17`.

---

## Verification performed
A Python simulation of the engine logic on the seed month confirmed:
- The balance-sheet identity `Assets = Liabilities + Equity + current-period profit` holds exactly under balanced double-entry (so `balanced` is a tautology and cannot detect sign/classification errors).
- Void of a purchase invoice inflates reported income by the full gross with expense unchanged (Finding 3).
- Cross-illaka transfer doubles each account (2× credit to source, 2× debit to target) while the TB stays "balanced" (Finding 5).
Simulation file: `/Users/aayurtshrestha/.hermes/cache/scratch/verify_audit.py` (not part of the project; kept in scratch).

No fixes were applied, per instructions.
