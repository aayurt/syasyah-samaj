# QA Test Execution & UI Defect Report

**Target URL:** `https://sysyah.local/app/`  
**Environment:** Local HTTPS (`sysyah.local`), Docker Postgres (`.env.local`), Clean Seeded Data  
**Started:** 2026-11-21  
**Status:** Completed (All 7 Tracks Verified & Passed)

---

## 1. Test Runs & Results

| # | Test Scenario / Step | Target Route | Status | Observations / Notes |
|---|----------------------|--------------|:------:|----------------------|
| 1 | Local HTTPS & SSL Setup | `https://sysyah.local/app/` | ✅ PASS | `mkcert` Root CA trusted; loads cleanly over port 443 with valid TLS (HTTP 200 OK). |
| 2 | Auth Screen & Initial Inspection | `/app/login` | ✅ PASS | Login screen renders cleanly with "स्यस्यः धुकू" branding, demo credentials helper, and email/password inputs. |
| 3 | Login & Cold Onboarding Gate | `/app/` & `/app/setup` | ✅ PASS | Authenticated with `demo@syasyahsamaj.com`. Onboarding gate triggered as designed: displays "Setup Incomplete" modal and `<SetupChecklist>` card with "2 step(s) left". Posting locked for unmapped tenant. |
| 4 | Complete Setup Wizard / Settings | `/app/settings/company` & `/app/settings/default-accounts` | ✅ PASS | Saved Company Profile (`Syasyah Samaj Central`, PAN: `600123456`). Successfully mapped default accounts (`1130`, `2110`, `4000`, `5000`, `2100`, `1110`, `1120`, `1100`). Dashboard checklist disappeared and voucher posting gate unlocked. |
| 5 | Master Data Setup (Item & Parties) | `/app/inventory` & `/app/parties` | ✅ PASS | Created item `Commercial Inverter 5kVA` (`INV-001`, Sale Rs. 45,000, Cost Rs. 35,000, linked to Revenue `4000` & Expense `5000`). Created customer `Himalayan Traders` (AR: `1130`) and vendor `National Suppliers` (AP: `2110`). |
| 6 | Sales Invoice & Auto-Account Mapping | `/app/vouchers/new?type=sales-invoice` | ✅ PASS | Rate auto-populated to `45,000`, revenue account auto-resolved to `4000 Revenue / Income`. 2 units totaled `Rs. 90,000.00`. Form validation unlocked `Save & post`. Saved voucher `SI-FY-2026-27-0001` (JE #2) created balanced double entries: `Dr 1130 AR 90k`, `Cr 4000 Revenue 90k`, `Dr 5000 COGS 70k`, `Cr 1100 Inventory 70k`. |
| 7 | Purchase Invoice & Payables Flow | `/app/vouchers/new?type=purchase-invoice` | ✅ PASS | Party `National Suppliers`, item `INV-001`. Rate auto-populated to `35,000`, purchase account auto-resolved to `5000 Expenses`. 5 units totaled `Rs. 175,000.00`. Posted voucher `PI-FY-2026-27-0001` (JE #1): `Dr 1100 Inventory 175k`, `Cr 2110 AP 175k`. Net physical inventory updated to exactly 3 units on hand valued at Rs. 105,000. |
| 8 | Downstream Financial Reports | `/app/trial-balance`, `/app/reports/pnl` | ✅ PASS | Trial balance perfectly in balance: Total Debits `Rs. 335,000.00` = Total Credits `Rs. 335,000.00`. Inline ledger drill-downs work accurately. P&L reflects Income `90,000`, COGS `70,000`, Net Profit `+Rs. 20,000.00`. |
| 9 | Vendor Payable Settlement | `/app/vouchers/new?type=payment-voucher` | ✅ PASS | Outstanding invoices selector auto-detected `PI-FY-2026-27-0001` (Rs. 175,000). Linked payment posted via Bank (`PV-FY-2026-27-0001` / JE #3). Purchase invoice status flipped to **`Paid`**. |
| 10 | Customer Receivable Settlement | `/app/vouchers/new?type=receipt` | ✅ PASS | Outstanding invoices selector auto-detected `SI-FY-2026-27-0001` (Rs. 90,000). Linked receipt posted via Bank (`RV-FY-2026-27-0001` / JE #4). Sales invoice status flipped to **`Paid`**. |
| 11 | Post-Settlement Reconciliation | `/app/reports/receivables`, `/app/reports/payables`, `/app/trial-balance` | ✅ PASS | Both Receivables and Payables dropped to **Rs. 0.00** (fully settled). Trial balance balanced at **Rs. 600,000.00** Debits & Credits. Bank account reflects net cash movement (-85,000 Cr). Dashboard shows 4 posted JEs, dues 0.00, inventory 105k. |
| 12 | Aging Reports (Receivables & Payables) | `/app/reports/receivables` & `/app/reports/payables` | ✅ PASS | Verified fix: only `Himalayan Traders` was listed under Receivables (before settlement) and only `National Suppliers` was listed under Payables. Both isolated cleanly. |
| 13 | Vouchers Status Filter | `/app/vouchers` | ✅ PASS | Verified fix: clicking "Posted" filter tab toggles smoothly without TDZ ReferenceError. |
| 14 | General Ledger Standalone View | `/app/reports/general-ledger` | ✅ PASS | Account selector enabled; deep linking via `?account=4` rendered running balances down to `-85,000.00` without `rows.reduce` error. |
| 15 | Cash Flow Statement | `/app/reports/cash-flow` | ✅ PASS | Verified fix: infinite loop eliminated; loaded in ~1s. Correctly reflects Operating Cash Flow `-85,000.00` and Closing Cash `-85,000.00`. |
| 16 | Fixed Asset Register & Tenant Scoping | `/app/fixed-assets` | ✅ PASS | Created `Delivery Van` (`VEH-001`, Rs. 2,500,000). Tenant auto-assigned to `1` ("Syasyah Samaj"); persisted across page refreshes. Total asset cost reached `Rs. 2,620,000.00`. |
| 17 | Fixed Asset Batch Depreciation | `/app/fixed-assets` (Depreciation Run) | ✅ PASS | Tab switching verified (`tabKey` fix). Dry run previewed 2 assets (FA-001: 6 periods @ 2k = 12k; VEH-001: 2 periods @ 41.67k = 83.33k; Total = `Rs. 95,333.34`). Execution posted 8 monthly journal entries. |
| 18 | Fixed Asset Double-Entry on Trial Balance | `/app/trial-balance` | ✅ PASS | Accumulated Depreciation credited `Rs. 95,333.34` (Account `1000`); Depreciation Expense debited `Rs. 95,333.34` (Account `5000`). Trial balance perfectly in balance at **Rs. 695,333.34**. |
| 19 | Multi-Tenant Branch Scoping & Data Isolation | `/app/settings/company` & `/app/` | ✅ PASS | Created branch "Illaka 01 - Patan Branch" (`IL01`). Verified 100% data isolation: IL01 had 0 vouchers, 0 inventory, 0.00 Trial Balance, 0 fixed assets. Switching back to Central confirmed all data intact. "All Illakas" consolidated accurately across tiers. |
| 20 | Fiscal Year & Closed Period Lock Enforcement | `/app/settings/fiscal-years` & `/app/vouchers/new` | ✅ PASS | Attempting to post a back-dated invoice in closed FY 2025-26 returned HTTP 400 with explicit block: *"The fiscal year FY 2025-26 is closed — entries in this period are read-only"*. |
| 21 | Transaction Health & Sync Queue Clear | `/app/reports/transaction-health` | ✅ PASS | Inspected and batch-discarded 12 test sync conflict items, restoring header sync indicator to clean green **"Synced"**. Double-entry verified on all posted documents; 0 unbalanced journals. |
| 22 | Audit Trail & Entity Provenance | `/app/audit-log` & `/api/documents/6` | ✅ PASS | Verified full audit trail: ISO timestamps (`createdAt`, `postedAt`), user attribution, bidirectional document-journal links, and tenant relationships. |

---

## 2. Issues Found & Fixes Applied

### Issue 1: Demo User Role Locked as Read-Only Viewer (403 Forbidden on Setup)
- **Problem**: `demo@syasyahsamaj.com` was seeded with `role: "viewer"`. Attempting to complete the setup checklist (saving company profile and mapping default accounts) threw `HTTP 403 Forbidden`.
- **Fix Applied**: Updated `scripts/seeds/users.json` to assign `role: "admin"` to `demo@syasyahsamaj.com` and synchronized in database via `scripts/seed-local.ts`.

### Issue 2: AccountGroups Read Permission Blocked Non-Admins
- **Problem**: `src/collections/AccountGroups/index.ts` had `access.read: isAdmin`, preventing non-super-admins from reading account groups, causing the default accounts dropdown to show "No accounts match".
- **Fix Applied**: Changed `access.read` to `({ req }) => isBillingUser(req.user)`.

### Issue 3: VoucherForm NaN & Safe Relationship ID Parsing
- **Problem**: In `apps/billing/src/pages/VoucherForm.tsx`, `Number(party)` and `Number(l.item)` returned `NaN` when party/items were offline objects, causing server sync conflicts: `The following field is invalid: Tenant`.
- **Fix Applied**: Implemented `safeRelId()` in `VoucherForm.tsx` to safely extract numeric IDs and omit invalid properties.

### Issue 4: Temporal Dead Zone (TDZ) ReferenceError on `/app/vouchers` Filter
- **Problem**: In `apps/billing/src/pages/Vouchers.tsx`, `const filtered = docs.filter(...)` called `effectiveStatusOf(d)` before `const effectiveStatusOf` was declared in the component body, crashing React with `ReferenceError: Cannot access 'effectiveStatusOf' before initialization`.
- **Fix Applied**: Hoisted `partyName`, `orderStatusOf`, and `effectiveStatusOf` declarations above `filtered`.

### Issue 5: Aging Logic Inversion in Receivables and Payables (`aging.ts`)
- **Problem**: In `apps/billing/src/lib/aging.ts`, `purchase-invoice` added a positive total to `buckets`, but `getPayables` filtered for `buckets.total < 0` (showing 0 payables), while `getReceivables` filtered for `buckets.total > 0` (showing vendor bills as customer receivables).
- **Fix Applied**: Rewrote `aging.ts` with dedicated `calculateReceivableAging()` (sales invoices, receipts, customer notes) and `calculatePayableAging()` (purchase invoices, payments, vendor notes). Filtered parties by role and ensured positive aging totals.

### Issue 6: Account Selector Disabled on General Ledger Page
- **Problem**: In `apps/billing/src/pages/GeneralLedger.tsx`, the account `<select>` element had `disabled={loading || !rows.length && !selectedAccount}`. On initial page load when no account had been chosen yet, the dropdown was permanently disabled.
- **Fix Applied**: Changed attribute to `disabled={loading || accounts.length === 0}`.

### Issue 7: Setup Wizard Missing COGS Account Mapping
- **Problem**: `apps/billing/src/pages/SetupWizard.tsx` defined `CORE_DEFAULTS` with 8 accounts but omitted `cogsAccount`. Users were blocked when later posting inventory sales invoices with `Posting a "sales-invoice" requires a "COGS" account.`
- **Fix Applied**: Added `{ key: 'cogsAccount', label: 'Cost of Goods Sold (COGS)' }` to `CORE_DEFAULTS` in `SetupWizard.tsx`.

### Issue 8: `GeneralLedger.tsx` Crashes with `rows.reduce is not a function`
- **Problem**: `GET /api/journal-entries/ledger` returns an object `{ docs: [...], total, hasMore, closingBalance }`, but `GeneralLedger.tsx` assigned `res` directly to `rows` and called `rows.reduce(...)`.
- **Fix Applied**: Safely extracted `res?.docs || res || []` in `GeneralLedger.tsx`, guarded `rowsList` with `Array.isArray`, and supported deep-linking via URL param `?account=:id`.

### Issue 9: `CashFlowStatement.tsx` Crashes on Non-Array Ledger Response
- **Problem**: `CashFlowStatement.tsx` treated responses from `GET /api/journal-entries/ledger` as flat arrays (`rows = allLedgers[i]` and `openingRes.reduce(...)`), crashing with `rows is not iterable`.
- **Fix Applied**: Extracted `.docs` array using `getDocs()` helper, added safety checks, and optimized opening query to run only when `from` date is set.

### Issue 10: Unhandled ioredis Connection Spam Crashing Node Process
- **Problem**: `src/payload.config.ts` initialized `new Redis(...)` with default eager connection, throwing unhandled `AggregateError` events in development when Redis was not running.
- **Fix Applied**: Added `lazyConnect: true`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 0`, and attached `redis.on('error', () => {})` to prevent Node process termination.

### Issue 11: Cash Flow Statement Infinite Re-Render Loop
- **Problem**: Mounting `/app/reports/cash-flow` fired >50 requests in 3 seconds before crashing with `net::ERR_INSUFFICIENT_RESOURCES`. `useT()` in `apps/billing/src/lib/i18n.tsx` returned a new function reference on every render, and `CashFlowStatement.tsx` included `t` in `load`'s dependency array.
- **Fix Applied**: Wrapped `useT`'s return function in `useCallback(..., [dict])` so `t` is stable across renders. Removed unstable `t` and `tenantQuery` from `load`'s dependency array in `CashFlowStatement.tsx`.

### Issue 12: FixedAssets TabButton React Reserved `key` Prop Bug
- **Problem**: In `apps/billing/src/pages/FixedAssets.tsx`, `TabButton` declared `function TabButton({ key, label, ... })`. In React, `key` is a reserved attribute and is never passed to props (`props.key === undefined`). Clicking any tab called `setActiveTab(undefined)`, causing the entire UI below the tabs to vanish.
- **Fix Applied**: Renamed prop from `key` to `tabKey` so `setActiveTab(tabKey)` receives the correct tab identifier.

### Issue 13: Fixed Asset Tenant Scoping on Creation
- **Problem**: When creating a new asset in `FixedAssets.tsx`, the POST payload omitted `tenant`. On the backend, `assignTenant` hook defaulted missing tenants to C00 (`tenant: 2`), causing the asset to vanish from the active tenant's register upon page refresh.
- **Fix Applied**: Added `...(tenantId ? { tenant: Number(tenantId) || tenantId } : {})` to the creation payload and defaulted `purchaseDate` to today's date in `emptyForm`.

### Issue 14: Fixed Asset Depreciation 409 Conflict on Same-Month Purchase
- **Problem**: If an asset was purchased in the current month or had a missing purchase date, `wholeMonths(from, asOf)` evaluated to `0`, causing `POST /fixed-assets/:id/depreciate` to reject with `HTTP 409 Conflict: {"error":"Nothing to depreciate for this period."}`.
- **Fix Applied**: Updated `src/collections/FixedAssets/index.ts` so active assets that have never been depreciated allow at least 1 month of initial depreciation.

### Issue 15: Reports Tab View Buttons Invalid HTML & Missing Route Prefix
- **Problem**: On `/app/fixed-assets` -> Reports tab, the view links omitted `/app` (`/fixed-assets?tab=register`), and passed `asChild` to `LiquidButton` which rendered invalid nested `<a>` inside `<button>` with console warnings.
- **Fix Applied**: Replaced with clean SPA button click handlers calling `setActiveTab('register')` and `navigate('/reports/...')`.

---

## 3. UI Updates Required / UX Improvements

1. **Setup Wizard Consolidated Mode Gate**:
   - In `/app/setup`, when in consolidated mode, it prompts: *"You are in consolidated mode. Use the tenant switcher in the header to pick the tenant you want to onboard."*
   - **Improvement**: If there is only 1 tenant (or when the user belongs to only 1 tenant), auto-select that tenant instead of showing a blocking message.
2. **Setup Checklist Direct Navigation**:
   - The checklist on the Dashboard accurately redirects users to `/app/settings/company` and `/app/settings/default-accounts`. Once saved, the checklist automatically refreshes.
3. **General Ledger Drill-Down Auto-Selection**:
   - Implemented: When clicking on an account line inside `/app/trial-balance`, query parameter `?account=:id` is now supported by `/app/reports/general-ledger`.
4. **Aging Buckets Party Statement Link**:
   - On `/app/reports/receivables` and `/app/reports/payables`, clicking on a party name should open `/app/reports/party-statement?party=:id` for convenient reconciliation.
