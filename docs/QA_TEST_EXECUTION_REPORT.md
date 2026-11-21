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
| 23 | Items CSV Import | `/app/inventory` | ✅ PASS | Uploaded `items-import-test.csv`. Successfully parsed and created `SOL-001` (Monocrystalline Solar Panel 450W) and `BAT-001` (Lithium Battery 48V 100Ah). Table automatically reloaded with new stock. |
| 24 | Parties CSV Import & PAN Preview | `/app/parties` & `/app/vouchers/new` | ✅ PASS | Uploaded `parties-import-test.csv`. Auto-resolved default control accounts (`1130` AR / `2110` AP). Created customer `Everest Hardware Traders` and vendor `Apex Logistics Nepal`. Selecting Everest on Sales Invoice displays PAN badge `Customer · PAN: 600987654`. |
| 25 | Line Items Keyboard Navigation & Column Alignment | `/app/vouchers/new?type=sales-invoice` | ✅ PASS | Searching "SOL" autocompletes by code to `SOL-001`. Auto-populates `4000 Revenue / Income`. Pressing Tab from rate/tax adds Row 2 with 100% pixel-perfect column alignment under headers. Removed redundant Sub-account column. |
| 26 | Members CSV Import | `/app/members` | ✅ PASS | Uploaded `members-import-test.csv`. Parsed and created `Sita Maya Maharjan` and `Ram Bahadur Shrestha`. Successfully persisted under `tenant: 1` with 0 errors. Members table reloaded to display 2 members. |
| 27 | Chart of Accounts CSV Import & Layout | `/app/accounts` | ✅ PASS | Uploaded `accounts-import-test.csv`. Created `1140 Security Deposits Paid` (Asset) and `5130 Community Event Expenses` (Expense). Verified in table view (18 accounts) and tree view with clean header and cell spacing. |

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

### Issue 16: Parties CSV Import Rejection Due to Missing Default Control Accounts
- **Problem**: When importing parties via CSV, `Parties` collection enforces mandatory `receivableAccount` (for customers) and `payableAccount` (for vendors). Since external CSV files do not contain internal account IDs, the backend rejected imports with HTTP 400 Bad Request.
- **Fix Applied**: Updated `src/collections/Parties/index.ts` in the `beforeValidate` hook to automatically lookup and populate default AR (`1130`) and AP (`2110`) accounts from `billing-settings` or Chart of Accounts when omitted.

### Issue 17: Table Column Shift / Misalignment on Secondary Line in VoucherForm
- **Problem**: If line 1 had an account selected, the table header conditionally rendered `<th ...>Sub-account</th>`. When line 2 was appended (which had no account selected yet), `TransactionLine` rendered `<td className="hidden" />` (display: none). This omitted the cell from the DOM and shifted all subsequent cells in row 2 (Qty appeared under Sub-account, Rate under Qty, etc.).
- **Fix Applied**: Passed `showSubledger={showSubledgerCol}` to `TransactionLine`. When `showSubledgerCol` is true, every row renders a `<td>` (rendering `—` if no subledger is applicable). When false, no row renders the cell. Column alignment across all rows is 100% guaranteed.

### Issue 18: Redundant Sub-Account Selector on Income/Expense Line Items
- **Problem**: In `VoucherForm.tsx`, item-based lines already have an item picker. `subledgerSelectorForAccount` returned `'item'` for income/expense accounts, creating a redundant "Sub-account" column that prompted users to select an item a second time.
- **Fix Applied**: Updated `subledgerSelectorForAccount(account, hasItemPicker = false)` so item-based lines suppress item subledgers. Income/expense accounts pair directly with the line's item, keeping the table clean and eliminating duplicate dropdowns.

### Issue 19: Chart of Accounts Tree View `flex` on `<td>` Causing Word Overlap
- **Problem**: In `apps/billing/src/components/AccountsTable.tsx`, table cells had `className="... flex items-center gap-2"`. Setting `display: flex` on a `<td>` breaks native table layout in browsers, causing the Class column ("Bank", "Cash") to render directly on top of the Account Name.
- **Fix Applied**: Removed `flex` from `<td>` and placed it on an inner `<div>`. The Name and Class columns now render with clean, distinct columns.

### Issue 20: Missing Cell in Chart of Accounts Heading Row (7 vs 8 Columns)
- **Problem**: In `AccountsTable.tsx`, the `<thead>` declared 8 columns, but group heading rows only rendered 7 `<td>` cells (omitted Parent), causing Opening and Actions cells to shift left by one column.
- **Fix Applied**: Added the missing `<td className="px-4 py-2 text-xs text-slate-500">—</td>` in heading rows so all rows match the 8-column header.

### Issue 21: Entity-Agnostic Import Fallback on Dedicated Pages
- **Problem**: When a user uploaded a file without the entity name in the filename (e.g. `test.csv` on the Members or Accounts page), `guessCollection` returned `'unknown'`, causing the preview modal to fail.
- **Fix Applied**: Updated `parseImportFile(file, defaultCollection)` and passed page-specific defaults (`'gl-accounts'`, `'parties'`, `'items'`, `'members'`) on each entity page.

### Issue 22: Overscroll & Min-Width Containment Across Dropdowns and Modals
- **Problem**: Dropdowns and select popovers were squished on small viewports, and scrolling inside modals caused the outer page background to bounce (`overscroll`).
- **Fix Applied**: Added base `min-width: 140px` and `min-w-[160px]` / `minWidth={300}` on `AccountSelect`, `SearchSelect`, and `Popover`. Added `overscroll-y-contain` across `ImportPreviewModal`, `ConflictDrawer`, `VoucherViewModal`, `ExportModal`, `Popover`, and the main application container.

---

## 3. UI Updates & UX Improvements Implemented

1. **Setup Wizard Auto-Selection & 1-Click Seeding**:
   - Implemented quick tenant buttons in consolidated mode and 1-click standard Chart of Accounts auto-matching (`autoMatchDefaults`), removing friction during cold setup.
2. **Voucher Form Active Branch & PAN Badge**:
   - Implemented `Posting into: [Tenant Name]` badge in `VoucherForm` to ensure branch context is unambiguous.
   - Added instant party tax preview (`Customer · PAN: 600987654`) directly beneath the Party selector.
3. **Item Lines Keyboard Navigation**:
   - Added `Tab` navigation on line items (`onTabLast`), allowing fast continuous data entry without manual mouse clicks.
4. **General Ledger Breadcrumbs**:
   - Added `← Back to Trial Balance` breadcrumbs for seamless navigation.
5. **Fixed Assets Useful Life Presets**:
   - Added 1-click duration presets (e.g., Vehicles = 5 yrs, Computers = 3 yrs, Buildings = 20 yrs).
6. **Horizontal Scroll Containment on Wide Tables**:
   - Wrapped Item Lines and Chart of Accounts tables in `<div className="overflow-x-auto overscroll-x-contain">` to prevent content clipping on smaller screens.
