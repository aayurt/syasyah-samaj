# Voucher Numbering per Fiscal Year — Plan & Spec

> Status: **Approved & implemented** (commit follows this doc's format decision).
> Decisions: format `SI-2083-84-0003`; existing numbers kept as-is with a one-time sequence bridge.
> Applies to: server (`src/collections/Documents/index.ts`) + billing SPA display (no client code change needed).

## 1. What exists today

Numbers are assigned **server-side only** (raw `doc_sequences` table, never
synced) the moment a draft is posted. Format today:

```
SI-2026-0003        →  {DOC_PREFIX}:{AD year of the date, nudged by the
                        fiscal-year start month/day}:{zero-padded sequence}
```

- `DOC_PREFIXES` already exists: `SQ SO SI PO PI PV RV CN DN PC GRN DC JV CT MR DON`.
- Sequence key in `doc_sequences`: `${docType}:${adYear}:${tenant}` (per-illaka restart from 1).
- Assigned from **4 places**, all in `src/collections/Documents/index.ts`:
  1. `nextNumber()` — shared engine (`postDocument`, order confirm, members pay-fee auto-post)
  2. Confirm-order endpoint (`/:id/confirm`)
  3. Full-void & partial-void endpoints → **bug:** they pass `undefined` as the
     fiscal-year start, so void credit notes are always calendar-year numbered (`CN-2026-0001`)
  4. `/number/next` GET — the "next number" preview the SPA shows in the voucher form
- Drafts have **no number** until posted/confirmed.

The problem: the FY the app works in is BS-labelled (`2083-84`), but numbers
carry a plain AD year (`2026`) with no visible link to the fiscal year — and
every voucher *type* restarts within one AD year, not per fiscal year.

## 2. Goal

A voucher's number should visibly carry the **fiscal year** it was booked in,
with sequences that **restart each fiscal year** per type per tenant — so the
vouchers list, PDFs and registers read naturally:

| Today | Proposed (recommended) |
|---|---|
| `SI-2026-0003` | `SI-2083-84-0003` |
| `CN-2026-0001` (void) | `CN-2083-84-0001` |

## 3. Format options (decision needed)

1. **`SI-2083-84-0001`** — prefix + BS label of the FY containing the voucher date. (Recommended)
2. `SI-2083-0001` — prefix + FY start year only.
3. `83-84/SI/0001` — FY label first, slash separators.
4. Keep AD: `SI-2026-0001` (current; only fixes restart-per-FY, no visible label).

## 4. Design

### 4.1 One date → fiscal-year resolver (server)

Add a helper next to `resolveFiscalYear`:

```
fiscalYearForDate(payload, tenant, dateAD)
  → { id, label, startDate, endDate } | null
```

1. Exact range match: a `fiscal-years` row where `startDate ≤ date ≤ endDate`
   (all AD on disk — same basis the FY filtering + closed-year guard already use).
2. Fallback: the tenant's working year (`isActive`) if its range contains the date.
3. Fallback: legacy `billing-settings.fiscalYearStart` month/day (back-compat).
4. Fallback: calendar year → label = AD year (so `SI-2026-…` until an FY exists).

Numbering keys off the **document's date** (correct for backdated entries and
for vouchers sitting in a closed-but-viewable year), *not* the currently
selected/working year.

### 4.2 `nextNumber` rework

- Change the parameter from `fiscalYearStart?: string` to the resolved
  `{ id, label }` (callers resolve first).
- Sequence key becomes `${docType}:${fy.id}:${tenant}` — the FY **row id**,
  stable even if the label is edited later.
- Output: `${prefix}-${label}-${seq}` (label sanitised: strip spaces, collapse
  non-alphanumerics to `-`, e.g. `2083-84` stays `2083-84`).
- Per-FY sequences restart at 0001 automatically (fresh key per FY).
- **Continuity seed** (cheap, recommended): when a new key is first used, look
  up the *old* key `${docType}:${adYear}:${tenant}` for the same tenant/type —
  if it has a higher number, start the new key there. Keeps numbering gapless
  inside the FY that is already mid-way. Old keys are then orphaned harmlessly
  (no cleanup needed — one row per doc type per year).

### 4.3 Call-site updates (all 4 places)

| Call site | Change |
|---|---|
| `postDocument` | resolve FY from `doc.date` before `nextNumber` |
| order confirm | resolve FY from `doc.date` |
| full void / partial void | resolve FY from the credit note's date (`new Date()`) — fixes the `undefined` bug |
| `/number/next` preview | resolve FY from `?date=` (already gets one, now consistent) |

### 4.4 SPA

- **No parsing logic** depends on the number format today (verified: nothing
  splits numbers; audit logs store them as text), so the list just displays
  the new string.
- Voucher form "next number" preview (`/number/next`) returns the new format
  automatically.
- Optional nicety: when the list is unfiltered ("All time") or a filter spans
  years, show the number as-is — the FY label inside the number already groups
  visually. No extra column needed.

### 4.5 Existing documents & data

- Historical documents keep their current numbers (`SI-2026-0003` etc.) —
  no rewrite. New postings switch to the new format from the next issued number.
- Old `doc_sequences` rows remain; the continuity seed (4.2) bridges the
  current FY. A future FY simply starts at `0001` in the new format.
- No migration SQL needed (`doc_sequences` is keyed by text; new keys are new rows).
- Offline flow unchanged: queued drafts are posted server-side on sync, so the
  number is still assigned by the server (never by the client).

## 5. Edge cases

- **Closed-year posting** is already blocked; numbering a backdated doc whose
  FY is closed can't happen through the UI — but the resolver still maps its
  date correctly if it does (server-side posting only).
- **Label edited after numbers issued** — historical number strings keep the old
  label (normal); sequence key uses the row id, so numbering is unaffected.
- **Duplicate labels across tenants** — key is per-tenant; strings only collide
  if one tenant mis-creates two FYs with the same label (numbers then repeat).
  Optionally warn on duplicate label at creation (out of scope unless wanted).
- **FY id > old AD-year id ordering** — sequence key is opaque text; no issue.
- **Sanitising** — `2083-84` is already safe; guard for user labels like
  `"FY 2083 / 84"` → `FY-2083-84` so `prefix-label-seq` stays parseable.

## 6. Test checklist

- Post a sales invoice in FY 2083-84 → first number continues the legacy
  sequence (`…0013` when 12 old-format numbers existed), then `…0014`.
- Backdate a draft into 2082-83 → number uses 2082-83's sequence.
- Void a posted invoice → credit note numbered `CN-2083-84-…` (FY of today).
- Confirm a sales order → `SO-2083-84-0001`.
- Voucher form preview shows the same format before posting.
- Two tenants / illakas → independent sequences.
- Server `tsc --noEmit` + billing `tsc --noEmit` clean.

## 7. Decisions (resolved)

1. **Format** — `SI-2083-84-0003` (prefix + BS label).
2. **Existing numbers** — kept as-is; new per-FY keys are seeded from the
   legacy AD-year key (same doc type + tenant) so the current FY continues
   gaplessly instead of restarting at `0001`.

## 8. Implementation summary

All changes are in `src/collections/Documents/index.ts`:

- `findFiscalYearForDate()` now also returns the fiscal-year `id` (was used
  only by the closed-period guard).
- New `cleanFyLabel()` sanitizes a label for embedding (`"2083-84"` stays
  `2083-84`; `"FY 2083 / 84"` → `FY-2083-84`).
- `nextNumber()` takes the resolved fiscal year instead of a bare start date,
  keys `doc_sequences` by `${docType}:${fyId}:${tenant}` (per-FY restart,
  immune to later label edits), and — when the FY key is brand new — seeds
  it from the legacy `${docType}:${fyAdYear}:${tenant}` key in the same
  atomic UPSERT. No fiscal-year row → legacy AD numbering unchanged.
- Call sites updated: `postDocument` (covers the SPA post, Members pay-fee
  and BankStatement auto-post), order confirm, full void and partial void
  (previously passed `undefined` → calendar-year credit notes — now resolved
  from the credit note's own date), and the `/number/next` preview (same
  key + seed logic so the form preview matches the posted number).
- Sequence examples after deploy: `SI-2083-84-0013` (bridged) or
  `SO-2084-85-0001` (a genuinely new fiscal year restarts at 1).
