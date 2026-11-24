# Plan: Fix infinite API refetch loop on seed-account-groups step

## Goal

Stop `SeedTableStep` from re-fetching the account-groups API on every render. The loop is caused by `tenantQuery` prop reference instability cascading through `tenantQueryStr` → `loadRecords` identity → `useEffect` re-fire → `setRecords` → re-render → new `tenantQuery` ref.

## Current context / assumptions

- Working tree: `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`
- Component: `apps/billing/src/pages/SetupWizard/components/SeedTableStep.tsx` — `SeedTableStep` (React.FC, ~507 lines)
- Parent: `apps/billing/src/pages/SetupWizard.tsx` — passes `tenantQuery` prop to `SeedTableStep`
- Relevant code in `SeedTableStep.tsx` (lines 55–75):

```tsx
const tenantQueryStr = useMemo(() => JSON.stringify(tenantQuery), [tenantQuery])

const loadRecords = useCallback(async () => {
  setLoading(true)
  try {
    const res = await api<{ docs: any[] }>(`/${collection}`, {
      immediate: true,
      query: { limit: 1000, depth: depth ?? 0, ...tenantQuery },
    })
    setRecords(res.docs ?? [])
  } catch {
    setRecords([])
  } finally {
    setLoading(false)
  }
}, [collection, depth, tenantQueryStr])

useEffect(() => {
  void loadRecords()
}, [loadRecords, tenantId])
```

- In `SetupWizard.tsx` (lines 1279 and 1314), `tenantQuery` is passed as an inline object literal:

```tsx
tenantQuery={isSubCompany && parentOfActiveTenant ? { tenant: parentOfActiveTenant.id } : tenantQuery}
```

This creates a **new object reference on every render** when `isSubCompany` is true.

- Chain of instability:
  1. Parent re-renders → inline `{ tenant: ... }` is a new object
  2. `tenantQuery` prop is a new ref → `tenantQueryStr` recomputes (JSON.stringify produces same string but `useMemo` dep changed so identity changes)
  3. `loadRecords` gets new function identity (dep `tenantQueryStr` changed)
  4. `useEffect([loadRecords, tenantId])` fires → `loadRecords()` → API call → `setRecords` → re-render → back to step 1

- `tsc --noEmit` passes on current tree. Build passes.

## Architecture / proposed approach

Two changes, belt-and-suspenders:

1. **`SetupWizard.tsx`** — Memoize the sub-company `tenantQuery` object so the parent stops handing `SeedTableStep` a fresh object literal every render. Add a `subTenantQuery` `useMemo` after `isSubCompany` and `parentOfActiveTenant` are declared, and use it at both JSX call sites (lines 1279, 1314).

2. **`SeedTableStep.tsx`** — Make the component resilient to unstable `tenantQuery` references regardless of parent behavior:
   - Deep-compare `tenantQuery` content instead of reference-equality for `tenantQueryStr`.
   - Guard the reload `useEffect` so it only fires when `tenantId` changes or when `tenantQuery` content actually differs from the last queried value.

## Step-by-step tasks

### Task 1: Add memoized `subTenantQuery` in `SetupWizard.tsx`

Insert after `parentOfActiveTenant` declaration (line 196) and before `currentCompanySubCompanies`:

```tsx
// Memoized sub-company tenant query — inline object literal in JSX would
// create a new reference every render, tripping SeedTableStep's reload effect
const subTenantQuery = useMemo(
  () => (isSubCompany && parentOfActiveTenant ? { tenant: parentOfActiveTenant.id } : tenantQuery),
  [isSubCompany, parentOfActiveTenant?.id, tenantQuery]
)
```

Replace both inline object literals (lines 1279, 1314):

```tsx
tenantQuery={subTenantQuery}
```

Verification: `npx tsc --noEmit -p apps/billing/tsconfig.json` → exit 0, no errors referencing `subTenantQuery`.

### Task 2: Deep-compare `tenantQuery` in `SeedTableStep.tsx`

Replace line 55:

```tsx
const tenantQueryStr = useMemo(() => JSON.stringify(tenantQuery), [tenantQuery])
```

with:

```tsx
const tenantQueryStr = useMemo(() => JSON.stringify(tenantQuery), [
  tenantQuery,
  JSON.stringify(tenantQuery),
])
```

This guarantees `tenantQueryStr` only changes when the actual serialized content changes, not when a new object with identical content arrives.

Verification: `npx tsc --noEmit -p apps/billing/tsconfig.json` → exit 0.

### Task 3: Guard the reload effect in `SeedTableStep.tsx`

Replace lines 72–75:

```tsx
useEffect(() => {
  void loadRecords()
}, [loadRecords, tenantId])
```

with:

```tsx
const lastTenantQueryRef = useRef<string>(tenantQueryStr)

useEffect(() => {
  // Only reload when tenantId changes, or when tenantQuery content actually
  // differs from what was last loaded. Prevents infinite loop when parent
  // re-renders with a new object reference but identical query content.
  if (lastTenantQueryRef.current === tenantQueryStr) return
  lastTenantQueryRef.current = tenantQueryStr
  void loadRecords()
}, [loadRecords, tenantId, tenantQueryStr])
```

Note: `tenantQueryStr` is added to the dep array but the early-return guard prevents re-firing when its value is unchanged.

Verification: `npx tsc --noEmit -p apps/billing/tsconfig.json` → exit 0.

### Task 4: Build and deploy

Run:
```
pnpm --dir apps/billing build
```
Expected: exit 0, `dist/` output.

Sync to VPS:
```
rsync -av --delete apps/billing/dist/ aayurt@88.208.227.93:/home/aayurt/projects/cvx-mychevron/cvx-mychevron-moveme/dist/
```

Reload PM2:
```
ssh aayurt@88.208.227.93 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 24.15.0 && pm2 reload cvx-moveme'
```

Expected: `[PM2] [cvx-moveme](0) ✓`

### Task 5: Verify live page stability

Open `https://syasyahsamaj.com/app/setup?step=seed-account-groups`, log in as `demo@syasyahsamaj.com / SyashaDemo2026!`, select "Role Test Parent Co", click "Select & Continue".

Then:
1. Read `document.body.innerText` length and content.
2. Wait 10 seconds, read again.
3. Assert: same URL, same content length, no `.animate-spin` elements, no repeated "Loading" text.

Expected: content identical across waits, length 1793 (8 account groups visible), zero loading spinners.

## Tests / validation

TDD cycle per code task where practical:

**Task 1 (SetupWizard memo)** — No unit test; verified by `tsc` + live page stability.

**Task 2 (deep-compare)** — No unit test; verified by `tsc` + live page stability.

**Task 3 (effect guard)** — Optional vitest test:
- File: `apps/billing/src/pages/SetupWizard/components/SeedTableStep.test.tsx` (create if missing)
- Render `SeedTableStep` with `tenantQuery={{ tenant: 'abc' }}` that is recreated as a new object reference on each render (via parent state toggle).
- Mock `api` to record call count.
- Assert: after 2 renders, `api` called exactly once (not growing).

Command:
```
npx vitest run apps/billing/src/pages/SetupWizard/components/SeedTableStep.test.tsx
```
Expected: 1 test file, tests pass, api call count stable.

## Risks, tradeoffs, and open questions

- **Risk:** Adding `tenantQueryStr` to the `useEffect` dep array (Task 3) means a genuine content change will trigger reload — that's intended and correct.
- **Tradeoff:** The `useRef` guard in Task 3 adds a small amount of stateful plumbing. Alternative: rely solely on `JSON.stringify` dep comparison in Task 2 (no ref needed). But the ref guard is the stronger safeguard against any residual parent-side instability.
- **Open question:** Does `tenantId` itself ever change while on this step? If `tenantId` is stable and `tenantQuery` content is stable, the effect should never re-fire after initial load — which is the desired behavior.
- **Open question:** Are there other call sites passing inline `tenantQuery` objects to `SeedTableStep` beyond lines 1279/1314? Search confirmed exactly 2 matches for the inline literal pattern.