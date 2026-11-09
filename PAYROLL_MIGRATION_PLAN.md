# Payroll → Syasya Migration Plan

## Source: QniPay Payroll (`/Users/aayurtshrestha/Projects/self/payroll-system`)
## Target: Syasyah Samaj (`/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`)

## Migration Strategy

Bring Payroll's **Pay Frequency → Pay Period → Batch → Calculate → Post** workflow into Syasya as a **Payroll module** under the existing multi-tenant billing app. Syasya already has `PayrollRuns`, `PayrollPeriods`, `PayrollSettings`, `PayrollSlips`, `PayrollComponentAccounts`, `PayrollRunEmployees` collections — the Payroll app adds the missing pieces: batch wizard, pay groups/frequency, employees roster, calculation engine, statutory registers.

---

## Phase 1 — Data Model Mapping (Payroll → Syasya)

| Payroll Entity | Syasya Target | Mapping Notes |
|---|---|---|
| `pay_groups` (frequency: MONTHLY/WEEKLY/FORTNIGHTLY/FOUR_WEEKLY) | `pay-periods` collection + new `pay-groups` collection | Syasya has `PayrollPeriods` but no frequency grouping. Add `PayGroups` collection with `frequency` field. |
| `fiscal_years` | `fiscal-years` (existing) | Direct map. Syasya uses BS/AD dual dates; Payroll uses AD↔BS via `adStringToBs`. |
| `employees` (24 fields) | `employees` (existing Payload collection) | Payroll has more fields (termination date, bank account, PAN, basic salary, allowances, deductions). Syasya `employees` needs these added. |
| `number_series` + `number_series_mappings` | Same (existing) | Direct map — already in Syasya. |
| `payroll_batches` | `payroll-runs` (existing) | Payroll's "batch" = Syasya's "run". Add `batchNumber`, `approvalStatus`, `varianceReview`. |
| `payroll_periods` | `payroll-periods` (existing) | Direct map — Syasya already has periods linked to fiscal year. |
| `pay_elements` (taxable/non-taxable) | `payroll-component-accounts` (existing) | Direct map. |
| `salary_structures` | Employee `allowances`/`deductions` arrays (existing on `PayrollRunLine`) | Syasya stores salary structure inline on employee; Payroll has separate `salary_structures` table. Normalize into Syasya's inline model. |
| `payroll_process` (calculation) | Payroll run `generate` + `post` endpoints (existing) | Syasya's `summarizePayroll()` is MVP. Port Payroll's `payrollProcessor.ts`, `calcEngine.ts`, `prorationEngine.ts`, `taxCalculator.ts` for full calc. |
| `statutory_config` (EPF/ESIC/PT/LWF/TDS) | `payroll-settings` (existing, India-specific) | Payroll uses Nepal SSF/PF/CIT. Syasya's `PayrollSettings` is India-specific. Generalize to Nepal statutory (SSF, CIT, PF). |
| `payroll_slips` | `payroll-slips` (existing) | Direct map. |

---

## Phase 2 — UI Migration (Syasya theme: Finance Copilot Pro)

Syasya's UI theme: light `#fdf6e3` parchment, forest `#1e3a2a` primary / gold `#c5a059` active; dark `#0a1410`. Payroll uses shadcn/ui + TanStack Table/Query + sonner. Syasya uses shadcn/ui + React Router + lucide-react.

### New Pages to Add in `apps/billing/src/pages/`

| Page | Source | Purpose |
|---|---|---|
| `PayrollGroups.tsx` | `PayGroupsPage.tsx` (Payroll org) | Create/edit pay frequencies + generate periods per FY. |
| `PayrollBatch.tsx` | `PayrollBatchWizardPage.tsx` | 6-stage wizard: Period & Setup → Review & Exclusion → Validate → Calculate → Review & Variance → Release & Post. |
| `PayrollEmployees.tsx` | `EmployeesPage.tsx` (Payroll) | 24-field employee roster with salary structure (basic + allowances − deductions), termination date. |
| `PayrollSettings.tsx` | `SettingsPage.tsx` tabs + `PayrollSettingsPage.tsx` | Statutory toggles (SSF/PF/CIT for Nepal), number series, calendar AD/BS. |
| `PayrollReports.tsx` | `PayrollPage.tsx` + Statutory Registers | Payslips, registers (PF/SSF/CIT), variance reports. |

### Components to Port

| Component | Source | Target |
|---|---|---|
| `PayFrequencySelector` | `PayGroupsPage.tsx` | Frequency dropdown with period count preview (12/52/26/13). |
| `BatchWizard` | `PayrollBatchWizardPage.tsx` | 6-stage wizard with TanStack Query mutations. |
| `EmployeeDialog` | `EmployeesPage.tsx` | 24-field dialog, 4 tabs, maximize, termination date. |
| `StatutoryRegisterTable` | `PayrollRegisters.tsx` | PF/ESIC/PT/LWF/TDS register rows with CSV export. |
| `PayslipPreview` | `PayrollPage.tsx` | Per-employee payslip with AD/BS dates, Devanagari digits toggle. |

### Shared Components to Reuse

Syasya already has: `AnimatedSidebar`, `FiscalYearSwitcher`, `IllakaSwitcher`, `LanguageSwitcher`, `CommandPalette`, `Tooltip`, `AccountsTable`, `TenantSelector`. Payroll pages should integrate into the existing sidebar nav group "Payroll".

---

## Phase 3 — Backend/API Migration

### New Endpoints (`src/app/api/payroll/`)

| Endpoint | Method | Purpose | Source |
|---|---|---|---|
| `/api/pay-groups` | POST | Create pay frequency | `routes/payGroups.ts` |
| `/api/pay-groups/:id/generate-periods` | POST | Generate periods per FY | `routes/payGroups.ts` |
| `/api/payroll-batches` | GET/POST | List/create payroll batches | `routes/payrollBatches.ts` |
| `/api/payroll-batches/:id/validate` | POST | Pre-flight validation | `validatePayrollBatch` |
| `/api/payroll-batches/:id/calculate` | POST | Run calc engine | `calculatePayrollBatch` |
| `/api/payroll-batches/:id/release` | POST | Release for approval | `releasePayrollBatch` |
| `/api/payroll-batches/:id/post` | POST | Post journal entry | `postPayrollBatch` |
| `/api/payroll-slips` | GET | List payslips | `PayrollSlips` collection |

### Calculation Engine to Port (`apps/billing/src/lib/payroll/`)

| File | Source | Purpose |
|---|---|---|
| `payrollProcessor.ts` | `backend/src/utils/payrollProcessor.ts` | Batch-level process orchestration. |
| `calcEngine.ts` | `backend/src/utils/calcEngine.ts` | Element → method → value resolution. |
| `prorationEngine.ts` | `backend/src/utils/prorationEngine.ts` | Mid-month joins/leavers proration. |
| `taxCalculator.ts` | `backend/src/utils/taxCalculator.ts` | Nepal SSF/PF/CIT tax calculation. |
| `payrollDays.ts` | `backend/src/utils/payrollDays.ts` | Working days / total days / perDay. |
| `bsAdCalendar.ts` | `backend/src/utils/bsAdCalendar.ts` | AD↔BS conversion (already in Syasya `nepaliDate.ts`). |

---

## Phase 4 — Syasya-Specific Adaptations

1. **Multi-tenancy**: All payroll entities get `tenant` field + `scopedCreate/Read/Update/Delete` access control (like existing collections).
2. **Offline-first**: Payroll batch operations go through `immediate: true` flag (never queued — payroll must reflect roster at moment of calculation).
3. **Nepali localization**: BS dates on payslips, Devanagari digits toggle, amount-in-words in Nepali (लाख/करोड़).
4. **Illaka scoping**: Central sees all payroll data; Illaka-scoped users see only their illaka's employees.
5. **Double-entry invariant**: Posting a payroll batch creates a balanced journal entry (debits = credits).

---

## Phase 5 — Migration Order (Week by Week)

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Data model | `PayGroups` collection, employee field additions, `payroll-batches` fields |
| 2 | Backend API | Pay groups, periods generation, batch CRUD, validate/calculate/post endpoints |
| 3 | UI — Setup | Payroll Groups page, Payroll Settings page, employee roster dialog |
| 4 | UI — Batch | 6-stage batch wizard, payslip preview, statutory registers |
| 5 | Integration | Wire into sidebar nav, tenant scoping, offline sync, E2E tests |
| 6 | QA | Balanced journal entries, batch validation, edge cases (mid-month joins, closed FY) |

---

## Phase 6 — Rollback

- Payroll is additive — new collections and pages, no changes to existing accounting flows.
- Feature toggle `payrollEnabled` in Settings → Features (like Payroll's `useFeatures`).
- If issues, disable toggle → payroll pages hidden, existing data untouched.

---

## Open Questions

1. Does Syasya's `PayrollRuns` collection need `batchNumber` and `approvalStatus` fields added?
2. Should Payroll use Syasya's existing `api()` client (Payload-based) or a dedicated Express route?
3. Nepal statutory: SSF (Social Security Fund), PF (Provident Fund), CIT (Corporate/Individual Tax) — confirm rates and caps.
4. Employee 24 fields: which are mandatory vs optional for MVP?
