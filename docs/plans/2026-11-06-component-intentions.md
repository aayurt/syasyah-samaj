# Component Intentions & Features Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement UI fixes, CRUD workflows, and an in-app "Objectives & System Goals" roadmap page in the Syasyah Samaj billing SPA.

**Key Deliverables:**
1. **Fiscal Year Convention & Interval Fix:** Prevent identical start/end ranges, enforce `startDate < endDate` and minimum duration.
2. **Default Accounts CRUD UI:** Manage system-default fallback accounts (Cash, Bank, Accounts Receivable, Accounts Payable, Retained Earnings).
3. **Chart of Accounts Tabular UI & CRUD:** Clean tabular hierarchy with search, type filter, parent grouping, inline edit/create/delete.
4. **Opening Balance CRUD UI:** Dedicated, tabular opening balance manager with real-time Debit = Credit balancing invariant indicator.
5. **In-App Objectives & Goals Page:** Live dashboard route (`/goals` or `/objectives`) listing accounting goals, compliance checkpoints, and feature statuses directly viewable in the app.

---

### Task 1: Fiscal Year Range & Naming Convention Validation

**Objective:** Enforce date range constraints (start < end, minimum 30 days interval, non-overlapping) and standardized naming pattern (e.g., `YYYY/YY` BS or AD).

**Files:**
- Modify: `apps/billing/src/pages/Settings.tsx`
- Modify: `apps/billing/src/components/FiscalYearSwitcher.tsx`
- Test: `apps/billing/src/components/FiscalYearSwitcher.test.tsx`

**Step 1: Write failing validation unit test**

In `apps/billing/src/components/FiscalYearSwitcher.test.tsx`:
```typescript
import { validateFiscalYearInterval } from './FiscalYearSwitcher'

describe('Fiscal Year Validation', () => {
  it('rejects identical start and end dates', () => {
    const res = validateFiscalYearInterval('2081-04-01', '2081-04-01')
    expect(res.valid).toBe(false)
    expect(res.error).toMatch(/interval/i)
  })

  it('rejects end date before start date', () => {
    const res = validateFiscalYearInterval('2081-04-01', '2080-04-01')
    expect(res.valid).toBe(false)
  })

  it('accepts valid 1-year interval', () => {
    const res = validateFiscalYearInterval('2081-04-01', '2082-03-31')
    expect(res.valid).toBe(true)
  })
})
```

**Step 2: Implement validation logic and apply to Settings / Fiscal Year forms**

In `apps/billing/src/components/FiscalYearSwitcher.tsx`:
```typescript
export function validateFiscalYearInterval(start: string, end: string): { valid: boolean; error?: string } {
  if (!start || !end) return { valid: false, error: 'Start and end dates required' }
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e)) return { valid: false, error: 'Invalid date format' }
  if (s >= e) return { valid: false, error: 'End date must be strictly after start date' }
  const dayDiff = (e - s) / (1000 * 60 * 60 * 24)
  if (dayDiff < 30) return { valid: false, error: 'Fiscal year interval must span at least 30 days' }
  return { valid: true }
}
```

**Step 3: Run test**

Run: `pnpm --filter billing test FiscalYearSwitcher.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/billing/src/components/FiscalYearSwitcher.tsx apps/billing/src/components/FiscalYearSwitcher.test.tsx apps/billing/src/pages/Settings.tsx
git commit -m "fix(billing): enforce strict fiscal year interval validation and date checking"
```

---

### Task 2: Chart of Accounts (CoA) Tabular UI & CRUD

**Objective:** Upgrade `Accounts.tsx` to display accounts in an organized tabular format with expandable groups, account codes, type badges, currency, and direct Add/Edit/Delete actions.

**Files:**
- Modify: `apps/billing/src/pages/Accounts.tsx`

**Step 1: Implement tabular structure with search and filter**

In `apps/billing/src/pages/Accounts.tsx`:
- Render `<table className="w-full text-left border-collapse">`
- Columns: `Code`, `Name`, `Type (Asset/Liability/Equity/Revenue/Expense)`, `Parent Group`, `Current Balance`, `Actions`
- Add Modal for Create/Edit Account with validation.
- Implement soft-delete with warning if balance $\ne 0$.

**Step 2: Verify in browser / Vitest**

Run: `pnpm --filter billing test Accounts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/billing/src/pages/Accounts.tsx
git commit -m "feat(billing): add tabular Chart of Accounts UI with inline CRUD"
```

---

### Task 3: Default Accounts Configuration UI

**Objective:** Add UI section in Settings / Accounts to configure system default accounts: Cash, Bank, AR (Debtors), AP (Creditors), Sales Tax/VAT, and Retained Earnings.

**Files:**
- Modify: `apps/billing/src/pages/Settings.tsx`
- Modify: `apps/billing/src/lib/types.ts`

**Step 1: Add default accounts state and persistence**

In `apps/billing/src/pages/Settings.tsx`:
- Add "Default Accounts" configuration card.
- Dropdown selects mapped to accounts of matching types (`receivable` $\rightarrow$ Asset, `payable` $\rightarrow$ Liability, etc.).
- Persist via `api('/globals/billing-settings', { method: 'POST', body: { defaultAccounts: ... } })`.

**Step 2: Commit**

```bash
git add apps/billing/src/pages/Settings.tsx apps/billing/src/lib/types.ts
git commit -m "feat(billing): add default system accounts mapping UI in settings"
```

---

### Task 4: Opening Balance Manager UI & Balancing Indicator

**Objective:** Refine `SetupOpeningBalances.tsx` to provide a spreadsheet-like tabular entry table for each account with live $\sum Debit - \sum Credit = 0$ validation bar.

**Files:**
- Modify: `apps/billing/src/pages/SetupOpeningBalances.tsx`

**Step 1: Enhance opening balance grid**

In `apps/billing/src/pages/SetupOpeningBalances.tsx`:
- Filter by Account Category (Assets, Liabilities, Equity).
- Input fields for Debit and Credit.
- Sticky footer showing:
  - Total Debit
  - Total Credit
  - Difference ($\Delta$)
  - Save button disabled unless $\Delta == 0.00$.

**Step 2: Commit**

```bash
git add apps/billing/src/pages/SetupOpeningBalances.tsx
git commit -m "feat(billing): enhance opening balance table with live balance validation footer"
```

---

### Task 5: Objectives & System Goals In-App Page

**Objective:** Create an in-app page (`/goals` or `/objectives`) where users and admins can view project milestones, accounting objectives, compliance rules, and test status.

**Files:**
- Create: `apps/billing/src/pages/Objectives.tsx`
- Modify: `apps/billing/src/App.tsx` (Route registration & Navigation sidebar item)

**Step 1: Create `Objectives.tsx` component**

In `apps/billing/src/pages/Objectives.tsx`:
```tsx
import React from 'react'
import { Target, CheckCircle2, Clock, ShieldCheck } from 'lucide-react'

export default function Objectives() {
  const goals = [
    {
      category: 'Accounting Invariants',
      items: [
        { title: 'Strict Double-Entry Zero Balance', desc: 'Every posted voucher maintains Debit == Credit', status: 'active' },
        { title: 'Zero Nominal Carry-Forward', desc: 'Fiscal year close clears Revenue & Expense to Retained Earnings', status: 'active' },
        { title: 'Multi-Tenant Data Isolation', desc: 'Strict scoping per Illaka with no ledger cross-talk', status: 'active' }
      ]
    },
    {
      category: 'System Milestones',
      items: [
        { title: 'Offline-First Outbox Synchronization', desc: 'Seamless background replay with collision-free doc numbers', status: 'active' },
        { title: 'Void Cascade Protection', desc: 'Prevent orphan invoices by enforcing reverse settlement unwinds', status: 'active' },
        { title: 'Dual-Calendar AD/BS Parity', desc: 'Nepali Bikram Sambat date pickers and fiscal reporting', status: 'active' }
      ]
    }
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Target className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Objectives & System Goals</h1>
          <p className="text-sm text-muted-foreground">Live roadmap, compliance standards, and architectural invariants</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {goals.map((g, idx) => (
          <div key={idx} className="border border-border rounded-xl p-5 bg-card">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              {g.category}
            </h2>
            <div className="space-y-3">
              {g.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Register route in `apps/billing/src/App.tsx`**

Add `/objectives` route and link in the sidebar under Settings / Info.

**Step 3: Verify build**

Run: `pnpm --filter billing build`
Expected: Build succeeds without TypeScript errors.

**Step 4: Commit**

```bash
git add apps/billing/src/pages/Objectives.tsx apps/billing/src/App.tsx
git commit -m "feat(billing): add in-app objectives and system goals roadmap page"
```
