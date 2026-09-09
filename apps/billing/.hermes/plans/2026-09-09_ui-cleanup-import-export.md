# Billing SPA — UI Cleanup & Import/Export Plan

**Date:** 2026-09-09  
**Base:** `apps/billing/src`

---

## Issue 1: BS Date Field — Should Be One Line

**Current:** `NepaliDateInput` (non-compact) renders label + input + AD/BS preview on 3 lines. In `VoucherForm.tsx:724` it's used without `compact`, making the Date column much taller than Party/Invoice No.

**Fix:** Two options (pick one):

### Option A: Make `NepaliDateInput` support inline mode (preferred)
- Add an `inline` prop that puts label + input on the same row
- In `VoucherForm.tsx:638`, the grid is `sm:grid-cols-4` — Party gets 1 col, Invoice No gets 2 cols (3 sub-fields), Date gets 1 col
- Change Date column to use the inline variant so the BS trigger button sits next to the label

### Option B: Use compact mode + separate label
- Pass `compact` to `NepaliDateInput` and render the label separately
- Less clean but faster to implement

**Files:** `src/components/NepaliDateInput.tsx`, `src/pages/VoucherForm.tsx:636-728`

---

## Issue 2: Inconsistent Padding Across Screens

**Current:** Different pages use `p-4`, `p-5`, `p-6` inconsistently. Example from screenshot: VoucherForm top row uses `p-5` while main content area is `p-6` (from App.tsx:458).

**Fix:**
- Standardize all page content wrappers to `p-6` (matches App.tsx main area)
- Standardize inner card sections to `p-4` or `px-5 py-4`
- Standardize form sections to `p-5`
- Audit all pages in `src/pages/` for padding consistency

**Files to audit:**
- `src/pages/VoucherForm.tsx` — uses `p-5` in cards
- `src/pages/Parties.tsx`, `src/pages/Items.tsx`, `src/pages/Accounts.tsx`
- `src/pages/Vouchers.tsx`, `src/pages/Journal.tsx`
- `src/pages/reports/*.tsx` — check `max-w-5xl mx-auto` pattern
- `src/pages/Dashboard.tsx`

---

## Issue 3: Import/Export with Dedup Modal

**Current:** `DataManagement.tsx` has Cleanup + Demo Seed. No import/export.

**Design:**

### Export
- Add "Export" button to DataManagement (and optionally each collection page)
- Export scope: per-collection or full database
- Format: JSON (primary), CSV (for reports)
- Include tenant scope in export (metadata header)
- Use `api()` to fetch all docs, then `downloadCsv()` or `downloadJson()` helper

### Import
- File upload (JSON/CSV) via drag-drop or file picker
- **3-step flow:**
  1. **Parse & Preview**: Show row count, field mapping, sample rows
  2. **Duplicate Detection Modal**: Compare imported records against DB by:
     - **Exact match**: same `id` → offer Skip / Overwrite / Merge
     - **Fuzzy match**: same name+type (for parties/items) → show side-by-side diff
     - **New**: no match → auto-import
  3. **Confirm & Execute**: Show summary (N new, N updated, N skipped), apply

### Dedup Modal UI
```
┌─────────────────────────────────────────────┐
│  Import Preview — 47 records                │
├─────────────────────────────────────────────┤
│  ✅ 32 new (will be added)                  │
│  ⚠️ 12 similar (review below)              │
│  ❌ 3 exact duplicates (will skip)         │
├─────────────────────────────────────────────┤
│  [Similar Records]                          │
│  Imported: "Ram Shrestha" (Party)           │
│  Existing: "Ram Shrestha" (Party, ID: x)   │
│  ☐ Skip  ● Update  ○ Merge fields          │
│  ...                                        │
├─────────────────────────────────────────────┤
│  [Import All New]  [Review Selected]        │
└─────────────────────────────────────────────┘
```

### Collections to support import/export:
- Parties
- Items
- Accounts
- Journal Entries / Documents
- Members

**Files to create/modify:**
- `src/pages/DataManagement.tsx` — add Import/Export sections
- `src/components/ImportPreviewModal.tsx` — new component
- `src/components/DedupReviewModal.tsx` — new component
- `src/lib/importExport.ts` — parse, dedup logic, download helpers

---

## Issue 4: Sidebar Active State Bug (P&L + Reports)

**Root cause:** In `App.tsx:121-123`, both nav items:
```tsx
{ to: '/reports/pnl', label: 'Profit & Loss', ... }  // no `end` prop
{ to: '/reports', label: 'Reports', ... }              // no `end` prop
```

NavLink without `end` uses prefix matching. When on `/reports/pnl`:
- `/reports/pnl` matches exactly ✓
- `/reports` matches as prefix ✓ → both show active

**Fix:** Add `end: true` to the Reports nav item:
```tsx
{ to: '/reports', label: 'Reports', ..., end: true }
```

This way `/reports` only matches exactly `/reports`, not `/reports/pnl` or `/reports/sales`.

**File:** `src/App.tsx:123`

---

## Issue 5: Table Default Sorting — Latest First

**Current:** Tables default to `dir: 'asc'` (alphabetical). User wants most recent first.

**Fix:** Change default sort for date-based tables:

| File | Current | Change To |
|------|---------|-----------|
| `Vouchers.tsx` | `defaultSort: { key: 'date', dir: 'asc' }` | `dir: 'desc'` |
| `Journal.tsx:219` | `defaultSort: { key: 'date', dir: 'desc' }` | Already correct ✓ |
| `Parties.tsx:180` | `defaultSort: { key: 'name', dir: 'asc' }` | Keep asc (names sort naturally) |
| `Items.tsx:109` | `defaultSort: { key: 'name', dir: 'asc' }` | Keep asc |
| `Accounts.tsx:190` | `defaultSort: { key: 'name', dir: 'asc' }` | Keep asc |
| `Members.tsx` | Check and update | `dir: 'desc'` on `createdAt` |
| `AuditLog.tsx` | Check and update | `dir: 'desc'` on `createdAt` |
| `ExpenseClaims.tsx` | Check and update | `dir: 'desc'` on `date` |
| `Daybooks.tsx` | Check and update | `dir: 'desc'` on `date` |
| `BankReconciliation.tsx:107` | `sort: '-createdAt'` | Already correct ✓ |
| `RecentActivity.tsx:100` | `sort: '-createdAt'` | Already correct ✓ |

**Files:** `src/pages/Vouchers.tsx`, `src/pages/Members.tsx`, `src/pages/ExpenseClaims.tsx`, `src/pages/Daybooks.tsx`, `src/pages/AuditLog.tsx`

---

## Issue 6: Member View Mode — Paper-Form Layout for Viewing Members

**Current:** `Members.tsx` has two modes — Table and Application Form. The ApplicationForm handles create/edit with the paper-form layout (org header, red title, sections for Identity/Address/Personal/Family/Membership). But when viewing an existing member from the table, there's only an inline edit form (basic Name/Email/Phone fields) — not the full paper-form layout.

**Goal:** Clicking a member in the table should open a **read-only view** that mirrors the paper-form structure — the same layout as the ApplicationForm but with all fields displayed as read-only text, matching the physical paper form from the image.

### Design

#### MemberViewModal (new component)
A modal/slide-over that displays a member's data in the paper-form layout:

```
┌─────────────────────────────────────────────────────┐
│  ✕                                    [Edit] [Print]│
├─────────────────────────────────────────────────────┤
│  [Logo]  स्यस्यः समाज, यल              ┌─────────┐ │
│          Syasyah Samaj, Yala            │  फोटो   │ │
│          Phone: 01-XXXXXXX              │  [img]  │ │
│                                         └─────────┘ │
│  ─── साधारण/स्थायी/आजीवन दुज़: आवेदन फाराम ───    │
├─────────────────────────────────────────────────────┤
│  Identity (पहिचान)                                   │
│  ┌──────────────────┬──────────────────┐            │
│  │ नाम: Ram Shrestha│ नागरिकता: 12-... │            │
│  │ मिति: 2080-01-15 │ जिल्ला: Lalitpur │            │
│  └──────────────────┴──────────────────┘            │
│                                                     │
│  Address & Contact (ठेगाना)                          │
│  स्थायी ठेगाना: Ward 1, Lalitpur                    │
│  अस्थाई ठेगाना: ...                                 │
│  ┌──────────────────┬──────────────────┐            │
│  │ इमेल: ram@...   │ फोन: 01-...     │            │
│  │ मोबाइल: 98...   │                  │            │
│  └──────────────────┴──────────────────┘            │
│                                                     │
│  Personal (व्यक्तिगत)                                │
│  ┌──────────────────┬──────────────────┐            │
│  │ रक्ता: B+        │ विशिष्टता: MBA   │            │
│  │ पेशा: Engineer   │ कार्यालय: NT     │            │
│  └──────────────────┴──────────────────┘            │
│                                                     │
│  Family (पारिवारिक)                                  │
│  ┌──────────────────┬──────────────────┐            │
│  │ बाजेको: ...      │ बाबुको: ...      │            │
│  │ ससुराको: ...     │ पत्नीको: ...     │            │
│  │ छोराको: ...      │ छोरीको: ...      │            │
│  └──────────────────┴──────────────────┘            │
│                                                     │
│  Membership & Fee (दुज़ तथा शुल्क)                   │
│  ┌──────────────────┬──────────────────┐            │
│  │ दुज़: स्थायी     │ मिति: 2082-05-15│            │
│  └──────────────────┴──────────────────┘            │
├─────────────────────────────────────────────────────┤
│  दस्तखत: नागरिकताका फोटो कापि संलग्न गर्नादिस् ।     │
└─────────────────────────────────────────────────────┘
```

#### Implementation Details

1. **Create `MemberViewModal.tsx`** — new component
   - Receives `member: Member` prop
   - Renders same section structure as `ApplicationForm` but read-only
   - Reuses `Section` component for consistent styling
   - Shows photo in top-right (same as form)
   - Footer note about citizenship copy
   - Buttons: Edit (switches to ApplicationForm edit mode), Print, Close

2. **Update table row click** — in `Members.tsx` table view
   - Add `onClick` on table rows → opens `MemberViewModal`
   - Or add a "View" action in the dropdown menu (alongside Edit/Delete)

3. **Reuse `PrintableForm`** — already exists for print, same layout
   - The print CSS already renders the paper-form layout
   - MemberViewModal screen layout should match the print layout's field structure

4. **Edit flow from view** — clicking "Edit" in the modal:
   - Close modal → switch to Application Form view → load member data
   - Or: modal transitions to edit mode inline

### Files to create/modify:
- `src/components/MemberViewModal.tsx` — **new** (read-only paper-form view)
- `src/pages/Members.tsx` — add view modal trigger on row click or action menu

### Field mapping (Member → paper form):
| Paper Form Field | Member Field | Source |
|-----------------|-------------|--------|
| नाम (Name) | `fullName` | direct |
| नागरिकता ल्या (Citizenship No.) | `application.citizenshipNo` | nested |
| नागरिकता मिति (Issue Date) | `application.citizenshipIssuedDateBs` | nested |
| जिल्ला (District) | `application.citizenshipDistrict` | nested |
| स्थायी ठेगाना (Permanent Address) | `application.addressPermanent` | nested |
| अस्थाई ठेगाना (Temporary Address) | `application.addressTemporary` | nested |
| इमेल (Email) | `email` | direct |
| फोन (Phone) | `phoneNumber` | direct |
| मोबाइल (Mobile) | `application.mobile` | nested |
| रक्ता (Blood Group) | `idCardDetails.bloodGroup` | nested |
| विशिष्टता (Qualification) | `application.specialQualification` | nested |
| पेशा (Occupation) | `application.occupation` | nested |
| कार्यालय (Office) | `application.officeName` | nested |
| बाजेको नाम (Grandfather) | `application.grandfatherName` | nested |
| बाबुको नाम (Father) | `application.fatherName` | nested |
| ससुराको नाम (Father-in-law) | `application.fatherInLawName` | nested |
| पत्नीको नाम (Spouse) | `application.spouseName` | nested |
| छोराको नाम (Son) | `application.sonName` | nested |
| छोरीको नाम (Daughter) | `application.daughterName` | nested |
| दुज़ (Membership Type) | `membershipType.name` | nested |
| आवेदन मिति (Applied Date) | `application.appliedDateBs` | nested |
| फोटो (Photo) | `profileImage.url` | nested |

---

## Execution Order

1. **Issue 4** (sidebar) — 1 line fix, do first
2. **Issue 5** (table sorting) — mechanical, batch all pages
3. **Issue 1** (date one-line) — small component change
4. **Issue 2** (padding audit) — mechanical scan + fix
5. **Issue 6** (member view mode) — new component, moderate
6. **Issue 3** (import/export) — largest, build last

---

## Verification

- [ ] Navigate to `/reports/pnl` → only P&L highlighted in sidebar, not Reports
- [ ] Navigate to `/reports` → only Reports highlighted
- [ ] VoucherForm Date field is same height as Party/Invoice No fields
- [ ] All pages have consistent padding
- [ ] Tables show latest records first
- [ ] Click member in table → view modal shows paper-form layout with all fields
- [ ] View modal has Edit button → switches to ApplicationForm edit mode
- [ ] View modal Print button → prints paper-form replica
- [ ] Export downloads JSON/CSV correctly
- [ ] Import shows preview, detects duplicates, offers skip/overwrite/merge
- [ ] Dedup modal shows side-by-side comparison
