# Billing SPA — Agent Conventions

## Architecture: Cache-First with Background Sync

Every read in this app is **cache-first**. The UI renders instantly from local
storage, and fresh data is fetched in the background. The server catches up
when it can.

```
┌─────────────────────────────────────────────────────┐
│                   CACHE LAYER                       │
├──────────────┬──────────────┬───────────────────────┤
│  IndexedDB   │  localStorage│  Outbox (IndexedDB)   │
│  (collections│  (globals +  │  (pending writes)     │
│   + reports) │   calendar)  │                       │
├──────────────┴──────────────┴───────────────────────┤
│                    HOOKS                             │
│  useCachedList(slug)  → instant docs + bg refresh   │
│  useCachedGlobals()   → instant settings + bg ref   │
├─────────────────────────────────────────────────────┤
│               api() FUNCTION                         │
│  GET collection → cache-first (warm = 0ms)          │
│  GET globals    → localStorage cache-first           │
│  GET reports    → network-first + snapshot offline   │
│  POST/PATCH/DEL → outbox queue → sync when online   │
└─────────────────────────────────────────────────────┘
```

---

## Rule 1: Use `useCachedList` for Collection Pages

**Never** use `Promise.all([...list()])` to load multiple collections — it
blocks the entire page until ALL fetches complete.

Instead, use `useCachedList` for each collection independently:

```tsx
import { useCachedList } from '../lib/useCachedList'

const { docs: parties, setDocs: setParties } = useCachedList<Party>(
  'parties',
  { sort: 'name', ...tenantQuery },
)
const { docs: items, setDocs: setItems } = useCachedList<Item>(
  'items',
  { sort: 'name', ...tenantQuery },
)
// Each loads independently — form renders instantly on warm cache
```

For inline creates, use `setDocs` to append optimistically:

```tsx
const created = await api<{ doc: Party }>('/parties', { method: 'POST', body })
setParties((prev) => [...prev, created.doc]) // instant UI update
```

---

## Rule 2: Use `useCachedGlobals` for Singleton Settings

```tsx
import { useCachedGlobals } from '../lib/useCachedGlobals'
import type { BillingSettings } from '../lib/types'

const { data: settings } = useCachedGlobals<BillingSettings>('/globals/billing-settings')
// settings is null until loaded, then instantly available from localStorage
```

---

## Rule 3: Settings Changes Must Propagate via Events

**When you add a new toggle or setting to `BillingSettings`:**

### Step A: Add the field to the Payload schema

```ts
// src/globals/BillingSettings.ts
{
  name: 'myNewFeature',
  type: 'checkbox',
  defaultValue: false,
}
```

### Step B: Add to SPA types

```ts
// apps/billing/src/lib/types.ts
export interface BillingSettings {
  // ... existing fields ...
  myNewFeature?: boolean
}
```

### Step C: Add toggle UI to Settings page

```tsx
// apps/billing/src/pages/Settings.tsx
const [myFeature, setMyFeature] = useState(false)

// In load():
setMyFeature(res.myFeature || false)

// In persistFeatures() body:
{ myNewFeature: myFeature }
```

### Step D: Settings ALREADY dispatches the event — no extra work needed

`persistFeatures()`, `persistCalendar()`, and the full `save()` all dispatch:

```ts
window.dispatchEvent(new Event('billing-settings-changed'))
```

### Step E: Read the setting in your component

**Option 1 — via App.tsx (for sidebar/routing):**

App.tsx already listens for the event and re-reads. If your feature affects
the sidebar or route availability, add it to the `features` state:

```ts
// App.tsx
const [features, setFeatures] = useState({
  bankReconciliationEnabled: false,
  myNewFeature: false,  // ← add here
})

// In refreshFeatures():
setFeatures({
  bankReconciliationEnabled: !!s.bankReconciliationEnabled,
  myNewFeature: !!s.myNewFeature,  // ← add here
})
```

Then filter in the sidebar nav:

```tsx
if (item.to === '/my-page' && !features.myNewFeature) return false
```

**Option 2 — via `api()` in any page (for inline feature checks):**

```tsx
useEffect(() => {
  api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
    .then((s) => setMyFeature(s.myNewFeature || false))
    .catch(() => {})
}, [])
```

The `api()` call returns from localStorage cache instantly — no skeleton,
no loading state.

---

## Rule 4: Calendar Settings Auto-Save, Feature Toggles Require Save

| Setting type | Behavior |
|-------------|----------|
| **Calendar** (AD/BS, date/time format) | Auto-saves on change (500ms debounce) |
| **Feature toggles** (Bank Recon, Simplified Invoice) | Manual Save button at card bottom |
| **Fiscal year / freeze date** | Manual Save button |

---

## Rule 5: Never Block on Network for Initial Render

**Don't do this:**

```tsx
const [loading, setLoading] = useState(true)
useEffect(() => {
  api('/some-endpoint').then((data) => {
    setData(data)
    setLoading(false)  // ← page blocked until network responds
  })
}, [])
if (loading) return <Skeleton />
```

**Do this instead:**

```tsx
const { docs, loading } = useCachedList('some-collection')
// On warm cache: docs populated instantly, loading=false
// On cold cache: loading=true briefly, then docs populate
if (loading) return <Skeleton />
```

---

## Rule 6: Offline Writes Queue to the Outbox

All POST/PATCH/DELETE calls through `api()` automatically:
1. Queue to the IndexedDB outbox
2. Resolve immediately (UI shows success)
3. Sync to server when online
4. Invalidate the relevant cache entry

You don't need to handle this — it's built into `api()`.

---

## Adding a New Report Endpoint

Reports are network-first (fresh data matters) but snapshot to IndexedDB
for offline use:

```tsx
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  api('/my-report', { query: { ... } })
    .then(setData)
    .catch(() => {})
    .finally(() => setLoading(false))
}, [deps])
```

The `api()` function automatically:
- Serves from IndexedDB snapshot if offline
- Marks the report as stale when served from cache
- Snapshots the fresh response after network success

---

## Quick Reference: Adding a Feature End-to-End

1. `src/globals/BillingSettings.ts` — add field
2. `apps/billing/src/lib/types.ts` — add to `BillingSettings` interface
3. `apps/billing/src/pages/Settings.tsx` — add toggle + state + persistFeatures body
4. `apps/billing/src/App.tsx` — add to `features` state + `refreshFeatures()` + sidebar filter
5. Event dispatch is automatic — Settings already fires `billing-settings-changed`
6. Run `pnpm payload generate:types` and deploy migration if DB schema changed
